/**
 * 単元の実行枠（architecture.md 5章、ux-by-age 2.4〜2.5）。全エンジン共通で次を受け持つ:
 * パックの読み込み、段階の決定、1回分の問題、問題文とふりがな・読み上げ、誤答の説明・ヒント・解説・つぎへ、
 * 記録（attempts・rounds）、進度と復習（回の終わりだけ）、完了画面。
 * 区画は全単元で同じ: 上＝問題文、中央＝図と作業領域、左下＝ヒント、右下＝つぎへ（X-UX-05）。
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { audienceUx, gradeOf } from '../audience/audience';
import { audio } from '../core/audio/index';
import { addOutcome, evaluate } from '../core/progress/rules';
import * as db from '../core/storage/index';
import { profileAudience, type UnitProgress } from '../core/types';
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
import type { Item, UnitSpec } from '../curriculum/types';
import { unitMeta } from '../curriculum/unitIndex';
import { Figure } from '../engines/figure/Figure';
import { engineOf } from '../engines/registry';
import type { Judgement, RenderCtx } from '../engines/types';
import { Illust } from '../illust/Illust';
import { loadPack, PACK_UNAVAILABLE_CHILD_TEXT, PackUnavailableError } from '../packs/loader';
import { Rt } from '../text/Rt';
import { plainText } from '../text/rich';
import { ModeHeader } from '../ui/ModeHeader';
import { registerRich } from '../voice/dynamic';
import { useApp } from '../app/AppState';
import { navigate } from '../app/router';
import { exposeForTest } from '../app/testHook';
import { canSkip, currentItem, flowReducer, initialFlow, type FlowState } from './unitFlow';
import './unit.css';

type Loaded =
  | { kind: 'loading' }
  | { kind: 'error'; text: string }
  | { kind: 'ready'; unit: UnitSpec; packId: string; progress: UnitProgress; review: boolean };

export function UnitRunner({ unitId }: { unitId: string }) {
  const app = useApp();
  const profile = app.profile!;
  const settings = app.settings!;
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [roundKey, setRoundKey] = useState(0);

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
        if (alive) setLoaded({ kind: 'ready', unit, packId: meta.pack, progress, review });
      } catch (e) {
        if (!alive) return;
        setLoaded({
          kind: 'error',
          text:
            e instanceof PackUnavailableError
              ? PACK_UNAVAILABLE_CHILD_TEXT[e.reason]
              : 'いまは ひらけないよ。おうちの ひとに みてもらってね',
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [unitId, profile.id, roundKey]);

  const home = () => navigate({ name: 'home' }, { force: true });
  if (loaded.kind === 'loading') return <div className="screen" data-testid="unit-loading" />;
  if (loaded.kind === 'error')
    return (
      <div className="screen" data-testid="unit-error">
        <ModeHeader promptText="" onHome={home} onListen={() => undefined} canListen={false} />
        <div className="center-col">
          <p className="label-text">{loaded.text}</p>
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
      settings={settings}
      profile={profile}
      onAgain={() => setRoundKey((k) => k + 1)}
      onHome={home}
    />
  );
}

interface RoundProps {
  unit: UnitSpec;
  packId: string;
  progress: UnitProgress;
  review: boolean;
  settings: NonNullable<ReturnType<typeof useApp>['settings']>;
  profile: NonNullable<ReturnType<typeof useApp>['profile']>;
  onAgain(): void;
  onHome(): void;
}

function UnitRound({
  unit,
  packId,
  progress,
  review,
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
  const level = Math.min(unit.levels.length - 1, progress.level);
  const [seed] = useState(() => freshSeed());
  const items = useMemo(
    () =>
      buildRound(unit, {
        level: review ? unit.levels.length - 1 : level,
        seed,
        count: review ? REVIEW_SIZE : (unit.roundSize ?? ux.roundSize),
      }),
    [unit, level, seed, review, ux.roundSize],
  );
  const firstTime = !progress.attempted && unit.intro.length > 0;
  const [s, dispatch] = useReducer(flowReducer, undefined, () => initialFlow(items, firstTime));
  const item = currentItem(s);
  const misText = useCallback(
    (id?: string) => unit.misconceptions.find((m) => m.id === id)?.explain,
    [unit.misconceptions],
  );

  // 読み上げ（設定: always は問題を開くと読む、button は「きく」で読む、off は読まない）
  const say = useCallback(
    (texts: string[]) => {
      if (support.readAloud === 'off' || texts.length === 0) return;
      void audio.play(texts.map((t) => registerRich(packId, t)));
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
    roundId.current ??= db.addRound(roundRecord(0, false));
    return roundId.current;
  }, [roundRecord]);

  // 1問が確定したら記録する
  const recorded = useRef(0);
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
          ...(r.misconception ? { misconception: r.misconception } : {}),
        },
      });
    }
  }, [s.results, profile.id, unit.id, review, ensureRound, roundRecord]);

  // 回の終わり: 進度と復習（AD-04: 段階の変更は回の終わりだけ）
  const finished = useRef(false);
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
      await db.saveUnitProgress(p);
      if (s.results.length > 0) {
        const id = await ensureRound();
        await db.updateRound(roundRecord(s.results.length, true, id));
      }
      audio.sfx('complete');
    })();
  }, [s.phase, s.results, progress, review, unit, ux.recordMastery, ensureRound, roundRecord]);

  useEffect(() => {
    exposeForTest({ unitId: unit.id, level, index: s.index, phase: s.phase, item });
  }, [unit.id, level, s.index, s.phase, item]);

  const submit = useCallback(
    (response: unknown) => {
      if (!item) return;
      const j: Judgement = engineOf(item).judge(item, response);
      if (j.result === 'correct') audio.sfx(ux.softJudgement ? 'place' : 'correct');
      else if (j.result === 'wrong' && !ux.softJudgement) audio.sfx('wrong');
      const mt = j.result === 'wrong' ? misText(j.misconception) : undefined;
      dispatch({ type: 'judged', j, misconceptionText: mt });
      if (j.result === 'wrong') say([mt ?? 'ちがったよ。もういちど かんがえて みよう。']);
      if (j.result === 'retry') say([j.message]);
    },
    [item, misText, say, ux.softJudgement],
  );

  if (s.phase === 'done')
    return (
      <UnitDone
        unit={unit}
        state={s}
        soft={ux.softJudgement}
        ctx={ctx}
        onAgain={onAgain}
        onHome={onHome}
      />
    );

  const hints = item ? item.hints.slice(0, s.hintsShown) : [];
  const Engine = item ? engineOf(item).Component : null;
  return (
    <div
      className="screen unit"
      data-testid={`unit-${unit.id}`}
      data-phase={s.phase}
      data-index={s.index}
    >
      <ModeHeader
        promptText=""
        onHome={onHome}
        onListen={() => say([promptText])}
        canListen={promptText !== '' && support.readAloud !== 'off'}
      />
      <div className="unit__prompt" data-testid="prompt-text">
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
            <div className="unit__figure">
              <Figure fig={item.figure} ctx={ctx} />
            </div>
          ) : null}
          <div className="unit__engine" key={`${s.index}`}>
            <Engine
              item={item as never}
              ctx={ctx}
              revealed={s.phase === 'explain'}
              wrongMark={s.wrongMark}
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
        <div className="unit__explain" data-testid="explain">
          {!ux.softJudgement ? (
            <p className="unit__explain-head">
              {s.results[s.results.length - 1]?.outcome === 'skipped' ? 'こたえ' : 'せいかい'}
            </p>
          ) : null}
          <p className="unit__explain-text">
            <Rt text={item.explain} ctx={ctx} />
          </p>
          {item.explainFigure ? <Figure fig={item.explainFigure} ctx={ctx} /> : null}
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
            if (s.phase === 'explain') dispatch({ type: 'next' });
            else {
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
  ctx,
  onAgain,
  onHome,
}: {
  unit: UnitSpec;
  state: FlowState;
  soft: boolean;
  ctx: RenderCtx;
  onAgain(): void;
  onHome(): void;
}) {
  const self = state.results.filter(
    (r) => r.outcome === 'independent' || r.outcome === 'self_corrected',
  ).length;
  return (
    <div className="screen done" data-testid="unit-done">
      <ModeHeader promptText="" onHome={onHome} onListen={() => undefined} canListen={false} />
      <div className="center-col" style={{ gap: 'calc(var(--u) * 2.4)' }}>
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
        <div className="row" style={{ gap: 'calc(var(--u) * 3)' }}>
          <button
            type="button"
            className="tap tap--main"
            onClick={onAgain}
            data-testid="again-button"
          >
            <Illust id="again" className="tap__icon" decorative />
            もういちど
          </button>
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
