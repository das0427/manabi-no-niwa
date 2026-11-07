/**
 * 単元の実行枠（architecture.md 5章、ux-by-age 2.4〜2.5）。全エンジン共通で次を受け持つ:
 * パックの読み込み、段階の決定、1回分の問題、問題文とふりがな・読み上げ、誤答の説明・ヒント・解説・つぎへ、
 * 記録（attempts・rounds）、進度と復習（回の終わりだけ）、完了画面。
 * 区画は全単元で同じ: 上＝問題文、中央＝図と作業領域、左下＝ヒント、右下＝つぎへ（X-UX-05）。
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { audienceUx, gradeOf } from '../audience/audience';
import { audio } from '../core/audio/index';
import { addOutcome, evaluate } from '../core/progress/rules';
import { isSessionTimeUp } from '../core/session/sessionTime';
import * as db from '../core/storage/index';
import { profileAudience, type Profile, type UnitProgress } from '../core/types';
import { freshSeed } from '../core/util/rng';
import {
  isReviewDue,
  onAttempt,
  onMastered,
  onReview,
  relaxOverdue,
  REVIEW_SIZE,
} from '../curriculum/review';
import { buildRound } from '../curriculum/round';
import {
  buildReviewRound,
  representationOf,
  restoreReviewRound,
  reviewHistoryOf,
  type HistoryAttempt,
} from '../curriculum/reviewRound';
import type { Item, UnitSpec } from '../curriculum/types';
import { unitMeta } from '../curriculum/unitIndex';
import { Figure } from '../engines/figure/Figure';
import { engineOf } from '../engines/registry';
import type { Judgement, RenderCtx } from '../engines/types';
import { Illust } from '../illust/Illust';
import {
  loadPack,
  PACK_UNAVAILABLE_CHILD_TEXT,
  PACK_UNAVAILABLE_PARENT_TEXT,
  PackUnavailableError,
} from '../packs/loader';
import { Rt } from '../text/Rt';
import { plainText } from '../text/rich';
import { ModeHeader } from '../ui/ModeHeader';
import { registerRich } from '../voice/dynamic';
import { useApp } from '../app/AppState';
import { navigate } from '../app/router';
import { exposeForTest } from '../app/testHook';
import { Tap } from '../ui/Tap';
import {
  canSkip,
  currentItem,
  draftOf,
  flowReducer,
  initialFlow,
  nextLocked,
  playsWrongSfx,
  restoreFlow,
  type FlowDraft,
  type FlowState,
} from './unitFlow';
import './unit.css';
import './unit-error.css';

/** 図を左・エンジンを右に並べない種類（数の入力・読解・なぞり・解説。もともと自前の配置） */
const SIDE_EXCLUDED: ReadonlySet<string> = new Set(['number', 'reading', 'trace', 'explain']);

/**
 * 作業領域をスクロールの枠にしない種類。
 * - 読解: 本文の枠が自分でスクロールする（data-scroll-region="passage"）
 * - 数の入力: 足りないのは数字キーの区画（--u0 で縮まない 6u のキー）で、枠にすると「こたえあわせ」のキーが枠で切れて押せない
 *   （g2.math.mult-beyond/2 のヒント②・1280×720）。図も縮めない（図の高さは number.css が cqh で決める）
 */
const NO_WORK_SCROLL: ReadonlySet<string> = new Set(['reading', 'number']);
/** 図を --fig-max で縮めない種類（自前で図の高さを決める） */
const NO_FIG_FIT: ReadonlySet<string> = new Set(['number']);

// 分かち書きの段階（DESINGN.md 17章。改行の規則・S2 が data-wakachi を使う）
const WAKACHI_STAGES: ReadonlySet<string> = new Set(['p23', 'p4', 'p5', 'g1', 'g2']);
// 段階は分かち書きでなくても、日本語を分かち書きで書く教材（pack-brief: 英語の単元の日本語）。
// 段階だけで決めると、小3以上の英語が auto-phrase で「聞／こう」と語の途中で折れる
const WAKACHI_PACKS: ReadonlySet<string> = new Set(['en-g34', 'en-g56']);

/** 単元の中断データ（drafts ストア: modeId 'unit'・variantId 単元ID。review-1 #31） */
interface UnitDraft {
  seed: number;
  level: number;
  review: boolean;
  count: number;
  flow: FlowDraft;
  /** 中断前の回の記録の id（引き継ぐ） */
  roundId?: number;
  /**
   * 復習の回で選んだ問題の同一性キー（再開で同じ回を作り直すため。記録は消えたり復元されたりするので、
   * 記録から選び直さない）。2.0 までの中断データには無い。無い復習の回は前の選び方（buildRound）で作り直す
   */
  reviewPicks?: string[];
}

const DRAFT_TTL = 24 * 60 * 60 * 1000;
/** 復習の問題を選ぶときに読む記録の期間（復習の間隔は最長 21日。その数倍をみる） */
const HISTORY_DAYS = 180;
const NO_HISTORY: HistoryAttempt[] = [];
/**
 * この回の段階。2歳段階は常に段階0（2歳向け）。段階の自動判定をしないうえ、3歳段階で進んだ段階の問題\n * （3択など）を2歳段階で出さない（コードレビュー #3）。
 */
function roundLevel(unit: UnitSpec, progress: UnitProgress, profile: Profile): number {
  if (profileAudience(profile) === 'toddler' && profile.toddlerStage === 2) return 0;
  return Math.min(unit.levels.length - 1, progress.level);
}

/** 2歳段階の誤答の声かけ（正誤を強く出さない） */
const SOFT_AGAIN = 'もういちど みてみよう。';

type Loaded =
  | { kind: 'loading' }
  // parentText: 保護者向けの説明（教材を開けないとき。FX12）
  | { kind: 'error'; text: string; parentText?: string }
  | {
      kind: 'ready';
      unit: UnitSpec;
      packId: string;
      progress: UnitProgress;
      review: boolean;
      draft: UnitDraft | null;
      /** 復習の回のとき、この単元の最近の記録（別の表現を選ぶのに使う） */
      history: HistoryAttempt[];
    };

/** 文の行数（ふりがなで行の高さが変わるので、高さでなく ruby の rt を除いた字の行の位置を数える） */
function countLines(el: HTMLElement): number {
  const lh = parseFloat(getComputedStyle(el).lineHeight);
  const tops: number[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim() || n.parentElement?.closest('rt')) continue;
    range.selectNodeContents(n);
    for (const r of Array.from(range.getClientRects())) {
      if (r.width <= 0) continue;
      const mid = (r.top + r.bottom) / 2;
      if (!tops.some((t) => Math.abs(t - mid) < (lh > 0 ? lh * 0.4 : 8))) tops.push(mid);
    }
  }
  return tops.length || 99;
}

export function UnitRunner({ unitId }: { unitId: string }) {
  const app = useApp();
  const profile = app.profile!;
  const settings = app.settings!;
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [roundKey, setRoundKey] = useState(0);
  /** undefined: まだ聞いていない／null: はじめから／UnitDraft: つづきから */
  const [resume, setResume] = useState<UnitDraft | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const meta = unitMeta(unitId);
      if (!meta) {
        if (alive) setLoaded({ kind: 'error', text: 'この たんげんは ないよ' });
        return;
      }
      try {
        const pack = await loadPack(meta.pack);
        const unit = pack.units.find((u) => u.id === unitId);
        if (!unit) throw new Error(`unit ${unitId} not in pack`);
        const now = Date.now();
        let progress = await db.getUnitProgress(profile.id, unitId);
        progress = { ...progress, review: relaxOverdue(progress.review, now) };
        const review =
          isReviewDue(progress.review, now) &&
          (progress.review.stage === 'learned' || progress.review.stage === 'secured');
        // 中断データ: 24時間以内・段階と復習かどうかが同じときだけ使う（設定が変わると問題が作り直せないため）
        const d = await db.getDraft(profile.id, 'unit', unitId);
        const st = d?.state as UnitDraft | undefined;
        const level = roundLevel(unit, progress, profile);
        const draft =
          d && st && now - d.savedAt < DRAFT_TTL && st.level === level && st.review === review
            ? st
            : null;
        if (d && !draft) void db.deleteDraft(profile.id, 'unit', unitId);
        const history = review
          ? (
              await db.listAttempts(profile.id, { since: now - HISTORY_DAYS * 24 * 60 * 60 * 1000 })
            ).filter((a) => a.unitId === unitId)
          : [];
        if (alive)
          setLoaded({
            kind: 'ready',
            unit,
            packId: meta.pack,
            progress,
            review,
            draft,
            history,
          });
      } catch (e) {
        if (!alive) return;
        setLoaded({
          kind: 'error',
          text:
            e instanceof PackUnavailableError
              ? PACK_UNAVAILABLE_CHILD_TEXT[e.reason]
              : 'いまは ひらけないよ。おうちの ひとに みてもらってね',
          ...(e instanceof PackUnavailableError
            ? { parentText: PACK_UNAVAILABLE_PARENT_TEXT[e.reason] }
            : {}),
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [unitId, profile, roundKey]);

  const home = () => navigate({ name: 'home' }, { force: true });
  if (loaded.kind === 'loading') return <div className="screen" data-testid="unit-loading" />;
  if (loaded.kind === 'error')
    return (
      <div className="screen" data-testid="unit-error">
        <ModeHeader promptText="" onHome={home} onListen={() => undefined} canListen={false} />
        <div className="center-col">
          <p className="label-text">{loaded.text}</p>
          {loaded.parentText ? (
            <p className="unit__parent-note" data-testid="unit-error-parent">
              {loaded.parentText}
            </p>
          ) : null}
        </div>
      </div>
    );
  // つづきから？（v1 の ModeEntry と同じ形）
  if (loaded.draft && resume === undefined)
    return (
      <div className="screen" data-testid="resume-prompt">
        <ModeHeader
          promptText="つづきから する？"
          onHome={home}
          onListen={() => void audio.play('app.resume')}
          canListen
        />
        <div className="center-col">
          <Illust
            id={loaded.unit.icon}
            style={{ width: 'calc(var(--u) * 16)', height: 'calc(var(--u) * 16)' }}
            decorative
          />
          <div className="row">
            <Tap
              label="つづきから"
              text="つづきから"
              icon="next"
              variant="main"
              size="big"
              testId="resume-yes"
              onPress={() => setResume(loaded.draft)}
            />
            <Tap
              label="はじめから"
              text="はじめから"
              icon="again"
              size="big"
              testId="resume-no"
              onPress={() => {
                void db.deleteDraft(profile.id, 'unit', loaded.unit.id);
                setResume(null);
              }}
            />
          </div>
        </div>
      </div>
    );
  return (
    <UnitRound
      key={roundKey}
      unit={loaded.unit}
      packId={loaded.packId}
      progress={loaded.progress}
      review={loaded.review}
      history={loaded.history}
      resume={resume ?? null}
      settings={settings}
      profile={profile}
      onAgain={() => {
        setResume(null);
        setRoundKey((k) => k + 1);
      }}
      onHome={home}
    />
  );
}

interface RoundProps {
  unit: UnitSpec;
  packId: string;
  progress: UnitProgress;
  review: boolean;
  /** 復習の回のとき、この単元の最近の記録（省略時は記録なし） */
  history?: HistoryAttempt[];
  resume: UnitDraft | null;
  settings: NonNullable<ReturnType<typeof useApp>['settings']>;
  profile: NonNullable<ReturnType<typeof useApp>['profile']>;
  onAgain(): void;
  onHome(): void;
}

export function UnitRound({
  unit,
  packId,
  progress,
  review,
  history = NO_HISTORY,
  resume,
  settings,
  profile,
  onAgain,
  onHome,
}: RoundProps) {
  const audience = profileAudience(profile);
  const ux = audienceUx(audience, profile.toddlerStage ?? 3);
  const support = settings.support;
  const ctx: RenderCtx = useMemo(
    () => ({
      packId,
      readAloud: support.readAloud,
      furigana: support.furigana,
      learnerGrade: profile.enrolledGrade ?? gradeOf(audience),
      preschool: gradeOf(audience) === 0,
      textScale: support.textScale,
      ux,
    }),
    [
      packId,
      support.readAloud,
      support.furigana,
      support.textScale,
      profile.enrolledGrade,
      audience,
      ux,
    ],
  );
  const level = roundLevel(unit, progress, profile);
  const [seed] = useState(() => resume?.seed ?? freshSeed());
  const count = resume?.count ?? (review ? REVIEW_SIZE : (unit.roundSize ?? ux.roundSize));
  // 復習は別の表現の問題を優先する（curriculum/reviewRound.ts）
  const [historyBefore] = useState(() => Date.now());
  // picked: 復習の選び方（reviewRound）で作った回。中断データに選んだ問題を残す
  const { items, picked } = useMemo(() => {
    if (!review) return { items: buildRound(unit, { level, seed, count }), picked: false };
    const top = unit.levels.length - 1;
    if (resume) {
      // 2.0 までの中断データの復習は前の選び方で作り直す（つづきを中断しても前の選び方のまま）
      if (!resume.reviewPicks)
        return { items: buildRound(unit, { level: top, seed, count }), picked: false };
      const restored = restoreReviewRound(unit, { level: top, seed, picks: resume.reviewPicks });
      if (restored) return { items: restored, picked: true };
    }
    const built = buildReviewRound(unit, {
      level: top,
      seed,
      count,
      history: reviewHistoryOf(history, unit.id, historyBefore),
    });
    return { items: built, picked: true };
  }, [unit, level, seed, review, count, history, resume, historyBefore]);
  const firstTime = !progress.attempted && unit.intro.length > 0;
  const [s, dispatch] = useReducer(flowReducer, undefined, () =>
    resume ? restoreFlow(items, resume.flow) : initialFlow(items, firstTime),
  );
  const item = currentItem(s);
  const misText = useCallback(
    (id?: string) => unit.misconceptions.find((m) => m.id === id)?.explain,
    [unit.misconceptions],
  );

  // 読み上げ（設定: always は問題を開くと読む、button は「きく」で読む、off は読まない）
  const say = useCallback(
    (texts: string[]) => {
      if (support.readAloud === 'off' || texts.length === 0) return;
      // 文と文の間に短い間（300ms）
      void audio.play(
        texts.flatMap((t, i) => [
          ...(i > 0 ? [300] : []),
          ...(registerRich(packId, t) as string[]),
        ]),
      );
    },
    [packId, support.readAloud],
  );
  const promptText =
    s.phase === 'intro' ? (unit.intro[s.introStep]?.text ?? '') : (item?.prompt ?? '');
  useEffect(() => {
    if (support.readAloud === 'always' && promptText && s.phase !== 'explain') say([promptText]);
  }, [promptText, s.phase, s.index, support.readAloud, say]);

  // 回の記録: 最初の1問が確定したときに作る（開いただけ・0問でやめた回を残さない）
  const startedAt = useRef(Date.now());
  const roundId = useRef<Promise<number> | null>(null);
  const roundRecord = useCallback(
    (count: number, completed: boolean, id?: number) => ({
      ...(id !== undefined ? { id } : {}),
      profileId: profile.id,
      modeId: 'unit' as const,
      unitId: unit.id,
      variantId: review ? 'review' : 'main',
      startedAt: startedAt.current,
      endedAt: Date.now(),
      count,
      completed,
    }),
    [profile.id, unit.id, review],
  );
  const ensureRound = useCallback(() => {
    // 再開したときは中断前の回を引き継ぐ（回を二重に数えない: コードレビュー #4）
    roundId.current ??=
      resume?.roundId !== undefined
        ? Promise.resolve(resume.roundId)
        : db.addRound(roundRecord(0, false));
    return roundId.current;
  }, [roundRecord, resume]);

  // 1問が確定したら記録する
  // 再開したときは、前に記録した問題を記録し直さない
  const recorded = useRef(resume?.flow.done.length ?? 0);
  useEffect(() => {
    while (recorded.current < s.results.length) {
      const r = s.results[recorded.current]!;
      recorded.current += 1;
      const n = recorded.current;
      void ensureRound().then((id) => db.updateRound(roundRecord(n, false, id)));
      void db.addAttempt({
        profileId: profile.id,
        modeId: 'unit',
        unitId: unit.id,
        variantId: review ? 'review' : 'main',
        skillId: null,
        level: r.item.level,
        itemKey: r.item.id.slice(0, 200),
        outcome: r.outcome,
        wrongTries: r.q.wrongTries,
        hintsUsed: r.q.hintsUsed,
        reviewsUsed: r.q.reviewsUsed,
        operationIssue: r.q.operationIssue,
        inputKind: 'unknown',
        at: Date.now(),
        detail: {
          objective: r.item.objective,
          identity: r.item.identity.slice(0, 200),
          rep: representationOf(r.item),
          ...(r.misconception ? { misconception: r.misconception } : {}),
        },
      });
    }
    // 中断に備えて保存（最後の問題の解説で離れても、その問題を二重に記録しない: コードレビュー #4）。
    // 回の終わりの処理で消す
    if (s.results.length > 0 && s.phase !== 'done') {
      void ensureRound().then((rid) => {
        const state: UnitDraft = {
          seed,
          level,
          review,
          count,
          flow: draftOf(s),
          roundId: rid,
          ...(review && picked ? { reviewPicks: s.items.map((it) => it.identity) } : {}),
        };
        return db.saveDraft({
          profileId: profile.id,
          modeId: 'unit',
          variantId: unit.id,
          savedAt: Date.now(),
          state,
        });
      });
    }
  }, [s, profile.id, unit.id, review, ensureRound, roundRecord, seed, level, count, picked]);

  // 回の終わり: 進度と復習（AD-04: 段階の変更は回の終わりだけ）
  const finished = useRef(false);
  // 利用時間の目安に達したか（FX10）。null は回の記録を書き終えて判定するまで（完了画面はそれまで出さない）
  const [timeUp, setTimeUp] = useState<boolean | null>(null);
  useEffect(() => {
    if (s.phase !== 'done' || finished.current) return;
    finished.current = true;
    void (async () => {
      const now = Date.now();
      let p: UnitProgress = progress;
      if (ux.recordMastery) {
        if (review) {
          p = {
            ...p,
            review: onReview(
              p.review,
              s.results.map((r) => r.outcome),
              now,
            ),
          };
        } else {
          for (const r of s.results) p = addOutcome(p, r.outcome, r.q.operationIssue);
          const lv = unit.levels[p.level];
          const ev = evaluate(p, {
            levelCount: unit.levels.length,
            chance: lv?.chance,
            autoPromoteAfter: lv?.autoPromoteAfter,
            now,
          });
          p = { ...ev.next, review: onAttempt(ev.next.review) };
          if (ev.change === 'mastered') p = { ...p, review: onMastered(p.review, now) };
        }
      } else {
        // 2歳段階: 段階も正誤の記録も動かさない（遊んだことだけ）。review-1 #8
        p = { ...p, attempted: true };
      }
      // 1問も答えずに終わった回（導入だけ）は、状態を「とりくみちゅう」にしない（コードレビュー #8）
      if (s.results.length === 0) p = progress;
      await db.saveUnitProgress(p);
      void db.deleteDraft(profile.id, 'unit', unit.id);
      if (s.results.length > 0) {
        const id = await ensureRound();
        await db.updateRound(roundRecord(s.results.length, true, id));
      }
      // 利用時間の目安（区切りでだけ知らせる。CX-04）。v1 のモードと同じ判定（core/session/sessionTime.ts）
      const over = await isSessionTimeUp(profile.id, settings.sessionMinutes);
      setTimeUp(over);
      audio.sfx('complete');
      if (over && support.readAloud !== 'off') void audio.play('app.timeup');
    })().catch(() => setTimeUp((t) => t ?? false));
  }, [
    s.phase,
    s.results,
    progress,
    review,
    unit,
    ux.recordMastery,
    ensureRound,
    roundRecord,
    profile.id,
    settings.sessionMinutes,
    support.readAloud,
  ]);

  useEffect(() => {
    exposeForTest({ unitId: unit.id, level, index: s.index, phase: s.phase, item });
  }, [unit.id, level, s.index, s.phase, item]);

  // 解説の板が出てから NEXT_LOCK_MS は「つぎへ」を受け付けない（FX01: すばやい2回押しで解説を飛ばさない）
  const explainAt = useRef(0);
  useEffect(() => {
    if (s.phase === 'explain') explainAt.current = Date.now();
  }, [s.phase, s.index]);

  // 連打で同じ答えを2回判定しない（効果音・読み上げが重ならないように: コードレビュー #15）
  const lastSubmit = useRef(0);
  const submit = useCallback(
    (response: unknown) => {
      if (!item || s.phase !== 'question') return;
      const now = Date.now();
      if (now - lastSubmit.current < 400) return;
      lastSubmit.current = now;
      const j: Judgement = engineOf(item).judge(item, response);
      // 不正解の効果音: 2歳段階と、単元が穏やかな判定（gentleJudgement。幼児の英語）のときは鳴らさない
      if (j.result === 'correct') audio.sfx(ux.softJudgement ? 'place' : 'correct');
      else if (j.result === 'wrong' && playsWrongSfx(ux.softJudgement, unit.gentleJudgement))
        audio.sfx('wrong');
      // 2歳段階は正誤を強く出さない（統括の判断1、コードレビュー #6）: 説明の代わりに「もういちど」
      const mt =
        j.result === 'wrong'
          ? ux.softJudgement
            ? SOFT_AGAIN
            : misText(j.misconception)
          : undefined;
      dispatch({
        type: 'judged',
        j: ux.softJudgement && j.result === 'wrong' ? { ...j, misconception: undefined } : j,
        misconceptionText: mt,
        genericText: ux.softJudgement ? SOFT_AGAIN : undefined,
      });
      if (j.result === 'wrong') say([mt ?? 'ちがったよ。もういちど かんがえて みよう。']);
      if (j.result === 'retry') say([j.message]);
    },
    [item, misText, say, ux.softJudgement, unit.gentleJudgement, s.phase],
  );

  // 問題文が2行以上になったら、作業領域をその下から始める（なぞり盤などと重ならないように）
  const rootRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const isDone = s.phase === 'done';
  useLayoutEffect(() => {
    const root = rootRef.current;
    const p = promptRef.current;
    if (!root || !p) return;
    let last = '';
    const write = () => {
      const v = `${p.offsetTop + p.offsetHeight}px`;
      if (v === last) return;
      last = v;
      root.style.setProperty('--prompt-bottom', v);
    };
    // 描く前に1回書く。あとの変化は次のフレームで書く（観測の通知の中で作業領域の寸法を変えると、
    // 作業領域を見ている fit の ResizeObserver と合わせて「ResizeObserver loop」になる）
    write();
    if (typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(write);
    });
    ro.observe(p);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [isDone]);

  // 作業領域の fit は板の高さ（--panel-h）を使うので、板の測りを先に（同じ描画の中で作業領域の高さを確定させる）
  const phaseKey = `${s.index}:${s.phase}:${s.hintsShown}`;
  // 解説の板の高さを --panel-h に書き（作業領域は板の上まで）、スクロールが要るときは ▼ の印を出す
  useLayoutEffect(() => {
    const root = rootRef.current;
    const panel = root?.querySelector<HTMLElement>('.unit__explain') ?? null;
    if (!root) return;
    if (!panel) {
      root.style.removeProperty('--panel-h');
      return;
    }
    // 図を文の右に置けるか（data-fig-side）: 図が SVG・絵・10の棒で（表・文の図は下の段のまま）、
    // 自然な幅が板の幅の 40% 以下、文が右置きの幅で3行以下（下の段のままでは板に入らないときは4行以下）のとき。付け外しは同じ描画の中で測り直す
    const decideSide = () => {
      const keep = panel.scrollTop;
      panel.removeAttribute('data-fig-side');
      const figBox = panel.querySelector<HTMLElement>('.unit__explain-figure');
      const text = panel.querySelector<HTMLElement>('.unit__explain-text');
      const inner = figBox?.firstElementChild as HTMLElement | null | undefined;
      if (
        !figBox ||
        !text ||
        !inner ||
        // 図の根は SVG（絵・10の棒の svg は class なし）か、fig-* の箱
        !(
          inner instanceof SVGElement ||
          inner.matches('.fig-svg, .fig-illust, .fig-blocks, .fig-column')
        ) ||
        inner.querySelector('.fig-table, .fig-text')
      ) {
        return;
      }
      // パックの SVG は箱（.fig-svg）が板の幅いっぱいなので、中の svg の幅で測る
      const figW = (
        inner.matches('.fig-svg') ? (inner.querySelector('svg') ?? inner) : inner
      ).getBoundingClientRect().width;
      if (figW <= 0 || figW > panel.clientWidth * 0.4) return;
      // 下の段のままでは板に入らない（スクロールになる）ときは、行数に関わらず、右に置いて板の高さが減るなら右に置く
      const before = panel.scrollHeight;
      const overflow = before > panel.clientHeight + 1;
      panel.setAttribute('data-fig-side', '');
      if (overflow) {
        if (panel.scrollHeight >= before - 1) panel.removeAttribute('data-fig-side');
      } else if (countLines(text) > 3) {
        panel.removeAttribute('data-fig-side');
      }
      if (keep > 0) panel.scrollTop = keep;
    };
    const unitPx = () => {
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:absolute;visibility:hidden;pointer-events:none;width:var(--u)';
      root.appendChild(probe);
      const u = probe.getBoundingClientRect().width;
      probe.remove();
      return u;
    };
    // 板の高さの上限: 下の帯の上端 −（問題文の下端 ＋ 作業領域の最小の高さ）。作業領域の最小の高さは、
    // 解説の状態で残すもの（数の入力は式と回答欄、選択肢は札）を fit の下限（0.6）で縮めた高さ。
    // 板が 22u の決まった値だと、作業領域に空きが多いのに板の図・表が切れた（g5.math.decimal-shift/0）
    const limitPanel = () => {
      const work = root.querySelector<HTMLElement>('.unit__work');
      const prompt = root.querySelector<HTMLElement>('.unit__prompt');
      if (!work || !prompt) return;
      const u = unitPx();
      if (!(u > 0)) return;
      // 作業領域の子を fit の下限で縮めたときの高さ（子の高さ ＋ 子の間のすき間）。測りは板を今までの上限（22u）に戻して
      // から: 板が広がると作業領域が狭まり、伸びる子の高さが縮んで、測り直すたびに板が広がるのを防ぐ。
      // display: contents の箱（数の入力の .unit__engine）は中の子を数える。図の段が 0 に縮められていても、
      // 中身の高さ（scrollHeight）で測る
      panel.style.removeProperty('max-height');
      const prevFit = work.style.getPropertyValue('--fit');
      work.style.setProperty('--fit', '0.6');
      // 正解の印（右下の角の ○・大きな輪）は札の外へ出るが、作業領域の高さには数えない（fitNow と同じ）
      work.setAttribute('data-measure', '');
      const heightOf = (el: HTMLElement): number => {
        if (getComputedStyle(el).display === 'contents') {
          return Array.from(el.children).reduce((sum, c) => sum + heightOf(c as HTMLElement), 0);
        }
        const cs = getComputedStyle(el);
        // 見えない箱（数字キーの区画: visibility: hidden・max-height: 0）は数えない。overflow が visible の箱は、
        // 高さが 0 に縮められていても中身の高さで測る
        if (cs.visibility === 'hidden') return 0;
        // 格子の段（図の段は 1fr）で引き伸ばされた高さではなく、中身の高さで測る
        const prevSelf = el.style.alignSelf;
        el.style.alignSelf = 'start';
        const h =
          cs.overflowY === 'visible' ? Math.max(el.offsetHeight, el.scrollHeight) : el.offsetHeight;
        el.style.alignSelf = prevSelf;
        return h;
      };
      const kids = Array.from(work.children) as HTMLElement[];
      const hs = kids.map(heightOf).filter((h) => h > 0);
      const minWork = hs.reduce((a, b) => a + b, 0) + Math.max(0, hs.length - 1) * 2 * u;
      work.removeAttribute('data-measure');
      if (prevFit) work.style.setProperty('--fit', prevFit);
      else work.style.removeProperty('--fit');
      const workTop = Math.max(15 * u, prompt.offsetTop + prompt.offsetHeight + u);
      // 作業領域の下の余白（板との間 0.8u）のうち 0.5u までは、作業領域の中身が入ってよい（fit の許容と同じ）
      const max = root.clientHeight - 2.4 * u - workTop - minWork + 0.5 * u;
      // 22u（今までの上限）より狭くはしない。広げるだけ
      panel.style.maxHeight = `${Math.max(max, 22 * u).toFixed(1)}px`;
    };
    // 絵を並べた図（.fig-illust）は 1 行に並べる（flex-wrap: nowrap。unit.css）。入らないときは絵の大きさを
    // （図の幅 − すき間）÷ 絵の数 に縮める（下限 4u）。下の段の図の高さは、折り返しをなくした分だけ変わる
    // （p5.math.compose/1: いちご 5 このうち 3 こが overflow: hidden で消えていた）
    const fitIllust = (u: number) => {
      const figBox = panel.querySelector<HTMLElement>('.unit__explain-figure');
      figBox?.style.removeProperty('--illust-w');
      figBox?.removeAttribute('data-illust-fit');
      const row = figBox?.querySelector<HTMLElement>('.fig-row, .fig-illust')?.closest('.fig-row');
      const illusts = Array.from(figBox?.querySelectorAll<HTMLElement>('.fig-illust') ?? []);
      if (!figBox || illusts.length === 0) return;
      const box = row instanceof HTMLElement ? row : figBox;
      const gapOf = (el: Element) => parseFloat(getComputedStyle(el).columnGap) || 0;
      let n = 0;
      let natural = 0;
      let gaps = illusts.length > 1 ? gapOf(box) * (illusts.length - 1) : 0;
      for (const il of illusts) {
        const groups = Array.from(il.querySelectorAll<HTMLElement>('.fig-illust__group'));
        gaps += Math.max(0, groups.length - 1) * gapOf(il);
        for (const g of groups) {
          const icons = Array.from(g.children) as HTMLElement[];
          n += icons.length;
          gaps += Math.max(0, icons.length - 1) * gapOf(g);
          for (const ic of icons) natural += ic.getBoundingClientRect().width;
        }
      }
      const room = figBox.clientWidth;
      if (n === 0 || natural + gaps <= room + 0.5) return;
      const w = Math.max(4 * u, (room - gaps) / n);
      figBox.style.setProperty('--illust-w', `${w.toFixed(1)}px`);
      figBox.setAttribute('data-illust-fit', '');
    };
    // 図が板に入らないとき（右に置いても足りないとき）は、図の高さを残りまで縮める（下限 6u）。図は切らない。
    // 表・文の図（縮めると字が最小を割る）と、縦に並べた図（数直線の列。高さは中身が決める）は縮めない
    const shrinkFig = (u: number) => {
      const figBox = panel.querySelector<HTMLElement>('.unit__explain-figure');
      figBox?.style.removeProperty('--fig-h');
      if (!figBox || figBox.querySelector('.fig-table, .fig-text, .fig-column')) return;
      for (let i = 0; i < 2; i++) {
        const over = panel.scrollHeight - panel.clientHeight;
        if (over <= 1) return;
        const figH = figBox.getBoundingClientRect().height;
        const target = Math.max(6 * u, figH - over);
        if (target >= figH - 0.5) return;
        figBox.style.setProperty('--fig-h', `${target.toFixed(1)}px`);
      }
    };
    const measure = () => {
      limitPanel();
      // width の無いパックの SVG の縦横比（高さ ÷ 幅）を、箱（.fig-svg）の --fig-ar に書く。unit.css が
      // 「高さ 12u まで・比で幅」を決めるのに使う。svg 自身の --fig-ar は svgText が字から測って書くが、
      // 字の無い図には無く、描き直しで消えることもあるので、箱に書いて継ぐ
      for (const svg of panel.querySelectorAll<SVGSVGElement>(
        '.unit__explain-figure .fig-svg svg:not([width])',
      )) {
        const vb = svg.viewBox.baseVal;
        if (vb && vb.width > 0 && vb.height > 0) {
          svg.parentElement?.style.setProperty('--fig-ar', (vb.height / vb.width).toFixed(4));
        }
      }
      const u = unitPx();
      panel.querySelector<HTMLElement>('.unit__explain-figure')?.style.removeProperty('--fig-h');
      fitIllust(u);
      decideSide();
      shrinkFig(u);
      measureH();
    };
    const measureH = () => {
      root.style.setProperty('--panel-h', `${panel.offsetHeight}px`);
      const more = panel.scrollHeight > panel.clientHeight + 1;
      const atEnd = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 2;
      if (more && !atEnd) panel.setAttribute('data-scroll-cue', '');
      else panel.removeAttribute('data-scroll-cue');
    };
    measure();
    panel.addEventListener('scroll', measureH, { passive: true });
    if (typeof ResizeObserver === 'undefined') {
      return () => panel.removeEventListener('scroll', measureH);
    }
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    });
    ro.observe(panel);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      panel.removeEventListener('scroll', measureH);
    };
  }, [phaseKey, isDone]);

  // ヒントの吹き出し: 中身が 11.6u に入らないときは伸ばし（data-tall: 字は最小・行間 1.3・16u まで）、高さを
  // --bubble-h に書いて作業領域をその上までにする。それでも入らないときは ▼（data-scroll-cue）
  const bubbleKey = `${phaseKey}:${s.message?.text ?? ''}`;
  useLayoutEffect(() => {
    const root = rootRef.current;
    const bubble = root?.querySelector<HTMLElement>('.unit__bubble') ?? null;
    if (!root) return;
    if (!bubble) {
      root.style.removeProperty('--bubble-h');
      return;
    }
    const cue = () => {
      const more = bubble.scrollHeight > bubble.clientHeight + 1;
      const atEnd = bubble.scrollTop + bubble.clientHeight >= bubble.scrollHeight - 2;
      if (more && !atEnd) bubble.setAttribute('data-scroll-cue', '');
      else bubble.removeAttribute('data-scroll-cue');
    };
    const measureBubble = () => {
      bubble.removeAttribute('data-tall');
      bubble.removeAttribute('data-scroll-cue');
      if (bubble.scrollHeight > bubble.clientHeight + 1) {
        bubble.setAttribute('data-tall', '');
        root.style.setProperty('--bubble-h', `${bubble.offsetHeight}px`);
      } else {
        root.style.removeProperty('--bubble-h');
      }
      cue();
    };
    measureBubble();
    bubble.addEventListener('scroll', cue, { passive: true });
    // 画面の大きさが変わると吹き出しの高さ（u で決まる）も変わる。--bubble-h は px なので、古いままだと作業領域の
    // 下端が吹き出しに重なる・空きすぎる。舞台（root）の大きさの変化で測り直す（次のフレームにまとめる）
    let raf = 0;
    const ro =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(measureBubble);
          });
    ro?.observe(root);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      bubble.removeEventListener('scroll', cue);
    };
  }, [bubbleKey, isDone]);

  // 作業領域の中身が空きに収まらないとき、まず図を縮め（--fig-max）、足りない分を --fit（0.8〜1。解説は 0.6〜1）で
  // 中身の寸法 --u ごと縮める。図が高く幅が狭いときは図を左・エンジンを右の横並び（data-layout="side"）にする。
  // それでも収まらなければ重ねずに作業領域の中でスクロールさせ（data-scroll-region="work"・▼）、1件として検査に残す。
  // 子の寸法は --fit=1 に戻して測り直す（文字の折り返しが変わるので 2 回まで補正）。問題が変わったら 1 から
  const engineId = item?.engine ?? '';
  useLayoutEffect(() => {
    const root = rootRef.current;
    const work = root?.querySelector<HTMLElement>('.unit__work') ?? null;
    if (!root || !work) return;
    const minFit = s.phase === 'explain' ? 0.6 : 0.8;
    const sideOk = !SIDE_EXCLUDED.has(engineId);
    const cue = () => {
      if (!work.hasAttribute('data-scroll-region')) {
        work.removeAttribute('data-scroll-cue');
        return;
      }
      const atEnd = work.scrollTop + work.clientHeight >= work.scrollHeight - 2;
      if (atEnd) work.removeAttribute('data-scroll-cue');
      else work.setAttribute('data-scroll-cue', '');
    };
    const fitNow = () => {
      // 測る間は正解・誤答の印（.mark）を外す（ui.css の data-measure）。右下の角の ○（第6回 W1）は札の下へ 1.8u 出て、
      // 作業領域の下の余白（板・帯との間 2.4u）に描かれるだけなのに、scrollHeight に入って --fit を縮め、
      // 下の札が正解のときは作業領域をスクロールの枠にしていた（g3.soc.safety・g6.en.past/19 の解説。レビュー）
      work.setAttribute('data-measure', '');
      // 作業領域の高さ（fit=1。px）を子に渡す（絵の札の高さの上限: V2 が var(--work-h, 9999px) で読む）
      work.style.setProperty('--work-h', `${work.clientHeight}px`);
      // 測り直しでスクロールの枠を外すと位置が 0 に戻るので、覚えておいて戻す（中身の大きさが変わったときの測り直し）
      const keepTop = work.scrollTop;
      work.style.removeProperty('--fit');
      work.style.removeProperty('--fig-max');
      work.removeAttribute('data-fig-fit');
      work.querySelector<HTMLElement>(':scope > .unit__figure')?.style.removeProperty('--fig-k');
      work.removeAttribute('data-layout');
      work.removeAttribute('data-scroll-region');
      const fig = work.querySelector<HTMLElement>(':scope > .unit__figure');
      const textFig = !!fig?.querySelector('.fig-text, .fig-table');
      // 横に並べるか: 図の自然な高さが空きの 45% を超え、幅が作業領域の 55% 以下
      if (fig && sideOk && work.clientHeight > 0) {
        const r = fig.getBoundingClientRect();
        if (r.height > work.clientHeight * 0.45 && r.width <= work.clientWidth * 0.55) {
          work.setAttribute('data-layout', 'side');
        }
      }
      // 図を先に縮める: 自然な高さ figH と不足から --fig-max = max(min(figH, 12u), figH − 不足)
      if (fig && !textFig && !NO_FIG_FIT.has(engineId) && work.clientHeight > 0) {
        const shortage = work.scrollHeight - work.clientHeight;
        const figH = fig.getBoundingClientRect().height;
        if (shortage > 1 && figH > 0) {
          const probe = document.createElement('div');
          probe.style.cssText =
            'position:absolute;visibility:hidden;pointer-events:none;width:calc(var(--u0, var(--u)) * 12)';
          work.appendChild(probe);
          const u12 = probe.getBoundingClientRect().width;
          probe.remove();
          const figMax = Math.max(Math.min(figH, u12), figH - shortage);
          work.style.setProperty('--fig-max', `${figMax.toFixed(1)}px`);
          // 中の SVG・画像の寸法の上書き（max-height・height: auto）は、縮めるときだけ（unit.css）
          work.setAttribute('data-fig-fit', '');
          // 絵を並べた図（行・格子）は SVG 1つずつの高さでは縮まないので、図の中の --u ごと縮める（--fig-k）
          let k = 1;
          for (let i = 0; i < 2; i++) {
            // 高さの上限で切られていても、中身の高さで測る
            const h = Math.max(fig.getBoundingClientRect().height, fig.scrollHeight);
            if (h <= figMax + 1) break;
            k = Math.max(0.35, k * (figMax / h));
            fig.style.setProperty('--fig-k', k.toFixed(3));
          }
        }
      }
      let fit = 1;
      for (let i = 0; i < 6; i++) {
        const avail = work.clientHeight;
        // 数の入力の解説: 図の段は格子の minmax(0, 1fr) なので、図が段からはみ出しても work.scrollHeight に入らない。
        // はみ出す分も足して、--fit で図（式）を縮める（板を広げるとき、式と回答欄は fit の下限（0.6）で測っている）
        let extra = 0;
        if (s.phase === 'explain' && engineId === 'number') {
          const nf = work.querySelector<HTMLElement>(':scope > .unit__figure');
          if (nf && !nf.hasAttribute('data-scroll-region')) {
            extra = Math.max(0, nf.scrollHeight - nf.clientHeight);
          }
        }
        const need = work.scrollHeight + extra;
        if (avail <= 0 || need <= avail + 1) break;
        let next = Math.max(minFit, fit * (avail / need));
        // 比で縮めても数 px 足りないまま止まる（縮まない段・折り返しの変化）ときは、少しずつ下げて下限まで試す
        // （下限より上で止めてスクロールにしない: g2.ja.culture/22 の解説が fit 0.81 で 4px 足りずスクロールしていた）
        if (fit - next < 0.005) next = Math.max(minFit, fit - 0.02);
        if (next >= fit) break;
        fit = next;
        work.style.setProperty('--fit', fit.toFixed(3));
      }
      if (fit >= 1) work.style.removeProperty('--fit');
      // 下限でも収まらないときは重ねずに作業領域の中でスクロール（上そろえ。右下に ▼）。
      // 読解・数の入力は作業領域を枠にしない（NO_WORK_SCROLL）。0.5u までの不足は枠にしない
      // （下の 2.4u の余白に収まり、板・吹き出しに重ならない。枠にすると数 px のために ▼ とスクロールが出る）
      const tol = Math.max(1, (work.clientWidth / 92) * 0.5);
      if (
        !NO_WORK_SCROLL.has(engineId) &&
        work.clientHeight > 0 &&
        work.scrollHeight > work.clientHeight + tol
      ) {
        work.setAttribute('data-scroll-region', 'work');
        if (keepTop > 0) work.scrollTop = keepTop;
      }
      work.removeAttribute('data-measure');
      cue();
    };
    work.scrollTop = 0;
    fitNow();
    work.addEventListener('scroll', cue, { passive: true });
    if (typeof ResizeObserver === 'undefined') {
      return () => work.removeEventListener('scroll', cue);
    }
    // 観測の通知の中で寸法を書くと ResizeObserver の loop エラーになるので、次のフレームで測り直す
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        fitNow();
      });
    });
    ro.observe(work);
    for (const c of Array.from(work.children)) ro.observe(c);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      work.removeEventListener('scroll', cue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  if (s.phase === 'done')
    return (
      <UnitDone
        unit={unit}
        state={s}
        soft={ux.softJudgement}
        timeUp={timeUp}
        ctx={ctx}
        onAgain={onAgain}
        onHome={onHome}
      />
    );

  const hints = item ? item.hints.slice(0, s.hintsShown) : [];
  const Engine = item ? engineOf(item).Component : null;
  return (
    <div
      ref={rootRef}
      className="screen unit"
      data-testid={`unit-${unit.id}`}
      data-phase={s.phase}
      data-stage={unit.stage}
      data-wakachi={WAKACHI_STAGES.has(unit.stage) || WAKACHI_PACKS.has(packId) ? '' : undefined}
      data-index={s.index}
      style={{ ['--ts' as string]: String(ctx.textScale) }}
    >
      <ModeHeader
        promptText=""
        onHome={onHome}
        onListen={() => say([promptText])}
        canListen={promptText !== '' && support.readAloud !== 'off'}
      />
      <div ref={promptRef} className="unit__prompt" data-testid="prompt-text">
        <Rt text={promptText} ctx={ctx} />
      </div>

      {s.phase === 'intro' ? (
        <div className="unit__work">
          {unit.intro[s.introStep]?.figure ? (
            <Figure fig={unit.intro[s.introStep]!.figure!} ctx={ctx} />
          ) : null}
        </div>
      ) : null}
      {s.phase === 'intro' ? (
        <button
          type="button"
          className="tap tap--main unit__corner-right"
          onClick={() => dispatch({ type: 'intro-next', introLength: unit.intro.length })}
          data-testid="intro-next"
        >
          <Illust id="next" className="tap__icon" decorative />
          つぎへ
        </button>
      ) : null}

      {s.phase !== 'intro' && item && Engine ? (
        <div className={`unit__work unit__work--${item.engine}`}>
          {item.figure ? (
            <div
              className={`unit__figure${item.figure.kind === 'row' ? ' unit__figure--row' : ''}`}
            >
              <Figure fig={item.figure} ctx={ctx} />
            </div>
          ) : null}
          <div className="unit__engine" key={`${s.index}`}>
            <Engine
              item={item as never}
              ctx={ctx}
              revealed={s.phase === 'explain'}
              wrongMark={s.wrongMark}
              hintsShown={s.hintsShown}
              disabled={s.phase !== 'question'}
              submit={submit}
            />
          </div>
        </div>
      ) : null}

      {s.phase === 'question' && (s.message || hints.length > 0) ? (
        <div className="unit__bubble" role="status" data-testid="unit-message">
          {s.message ? (
            <p className={`unit__msg unit__msg--${s.message.kind}`}>
              <Rt text={s.message.text} ctx={ctx} />
            </p>
          ) : null}
          {hints.length > 0 ? (
            <p className="unit__hint" data-testid="hint-text">
              <span className="unit__hint-mark" aria-hidden>
                {hints.length}
              </span>
              <Rt text={hints[hints.length - 1]!} ctx={ctx} />
            </p>
          ) : null}
        </div>
      ) : null}

      {s.phase === 'explain' && item ? (
        <div className="unit__explain" data-testid="explain" data-scroll-region="explain">
          {!ux.softJudgement ? (
            <p className="unit__explain-head">
              {s.results[s.results.length - 1]?.outcome === 'skipped' ? 'こたえ' : 'せいかい'}
            </p>
          ) : null}
          <p className="unit__explain-text">
            <Rt text={item.explain} ctx={ctx} />
          </p>
          {item.explainFigure ? (
            <div className="unit__explain-figure">
              <Figure fig={item.explainFigure} ctx={ctx} />
            </div>
          ) : null}
          <span className="unit__scroll-cue" aria-hidden />
        </div>
      ) : null}

      {s.phase === 'question' && item ? (
        <button
          type="button"
          className="tap tap--white tap--aux unit__corner-left"
          aria-label="ヒント"
          onClick={() => {
            dispatch({ type: 'hint' });
            const next = item.hints[s.hintsShown];
            if (next) say([next]);
          }}
          disabled={s.hintsShown >= item.hints.length}
          data-testid="hint-button"
        >
          <Illust id="hint" className="tap__icon" decorative />
        </button>
      ) : null}
      {(s.phase === 'question' && canSkip(s)) || s.phase === 'explain' ? (
        <button
          type="button"
          className="tap tap--main unit__corner-right"
          onClick={() => {
            if (s.phase === 'explain') {
              if (!nextLocked(explainAt.current, Date.now())) dispatch({ type: 'next' });
            } else {
              dispatch({ type: 'skip' });
              if (item) say([item.explain]);
            }
          }}
          data-testid="next-button"
        >
          <Illust id="next" className="tap__icon" decorative />
          つぎへ
        </button>
      ) : null}
    </div>
  );
}

function UnitDone({
  unit,
  state,
  soft,
  timeUp,
  ctx,
  onAgain,
  onHome,
}: {
  unit: UnitSpec;
  state: FlowState;
  soft: boolean;
  /** 利用時間の目安に達したか。null は判定の前 */
  timeUp: boolean | null;
  ctx: RenderCtx;
  onAgain(): void;
  onHome(): void;
}) {
  const self = state.results.filter(
    (r) => r.outcome === 'independent' || r.outcome === 'self_corrected',
  ).length;
  // 目安の判定が済むまでは中身を出さない（「もういちど」が一瞬出て消えないように。判定は数十 ms で終わる）。
  // 上の帯（おうち）は残す（空の画面にしない。保存が遅い端末でも戻れる）
  if (timeUp === null)
    return (
      <div className="screen done" data-testid="unit-done-pending">
        <ModeHeader promptText="" onHome={onHome} onListen={() => undefined} canListen={false} />
      </div>
    );
  return (
    <div className="screen done" data-testid="unit-done">
      <ModeHeader promptText="" onHome={onHome} onListen={() => undefined} canListen={false} />
      <div
        className="center-col"
        // 目安の合図の1行が増えるぶん、上の帯（8u）にかからないよう v1 の完了画面と同じ 6u から並べる
        style={{ gap: 'calc(var(--u) * 2.4)', ...(timeUp ? { top: 'calc(var(--u) * 6)' } : null) }}
      >
        <Illust
          id={unit.icon}
          style={{ width: 'calc(var(--u) * 14)', height: 'calc(var(--u) * 14)' }}
          label={plainText(unit.title)}
        />
        <p className="label-text">
          <Rt text={unit.title} ctx={ctx} />
        </p>
        <p className="label-text" data-testid="unit-done-caption">
          {soft
            ? 'いっぱい あそんだね'
            : `${state.results.length}もん おわったね。じぶんで できたのは ${self}もん`}
        </p>
        {timeUp ? (
          <p className="label-text" data-testid="unit-done-timeup">
            きょうは ここまでに しよう
          </p>
        ) : null}
        <div className="row" style={{ gap: 'calc(var(--u) * 3)' }}>
          {!timeUp ? (
            <button
              type="button"
              className="tap tap--main"
              onClick={onAgain}
              data-testid="again-button"
            >
              <Illust id="again" className="tap__icon" decorative />
              もういちど
            </button>
          ) : null}
          <button
            type="button"
            className="tap tap--wood"
            onClick={onHome}
            data-testid="done-home-button"
          >
            <Illust id="home" className="tap__icon" decorative />
            おうち
          </button>
        </div>
      </div>
    </div>
  );
}

/** ルート用: 単元IDから UnitRunner（テストで item を参照するための型の再公開） */
export type { Item };
