/**
 * モードの実行枠（architecture.md 4.2）。全モード共通で次を受け持つ:
 * ヘッダー、問題文と「もういちど きく」、結果の保存と進度、中断データ、回の記録、完了画面、利用時間。
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../core/audio/index';
import { addOutcome, emptyProgress, evaluate } from '../core/progress/rules';
import type { AttemptInput, ModeSession, RoundSummary, WorkInput } from '../core/session/types';
import * as db from '../core/storage/index';
import type { ModeId, RoundRecord, SkillProgress } from '../core/types';
import { freshSeed } from '../core/util/rng';
import { MODE_BY_ID, roundSizeFor, SKILLS, type VariantDef } from '../modes/registry';
import type { VoiceSeq } from '../voice/catalog/index';
import { ModeHeader } from '../ui/ModeHeader';
import { useApp } from './AppState';
import { DoneScreen } from './DoneScreen';
import { ChunkErrorBoundary } from './ChunkErrorBoundary';
import { navigate } from './router';
import { textOf } from './voiceText';
import { exposeForTest } from './testHook';

interface Props {
  modeId: ModeId;
  variant: VariantDef;
  /** 中断データから再開する場合（保存した seed と、モードが保存した状態） */
  resume: { seed: number; data: unknown; level?: number; roundSize?: number } | null;
}

const DAY_START = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function ModeRunner({ modeId, variant, resume }: Props) {
  const app = useApp();
  const profile = app.profile!;
  const settings = app.settings!;
  const mode = MODE_BY_ID[modeId];
  const skill = variant.skillId ? SKILLS[variant.skillId] : null;

  const [progress, setProgress] = useState<SkillProgress | null>(null);
  const progressRef = useRef<SkillProgress | null>(null);
  const [roundKey, setRoundKey] = useState(0);
  const [seed, setSeed] = useState(() => resume?.seed ?? freshSeed());
  const [resumeState, setResumeState] = useState<unknown>(resume?.data ?? null);
  const [resumeMeta, setResumeMeta] = useState(
    resume ? { level: resume.level, roundSize: resume.roundSize } : null,
  );
  const [summary, setSummary] = useState<RoundSummary | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [promptText, setPromptText] = useState('');
  const promptRef = useRef<VoiceSeq | null>(null);
  const roundRef = useRef<RoundRecord | null>(null);
  const countRef = useRef(0);

  // 進度の読み込み
  useEffect(() => {
    let alive = true;
    void (async () => {
      const p = skill ? await db.getProgress(profile.id, skill.id) : null;
      if (!alive) return;
      progressRef.current = p;
      setProgress(p ?? emptyProgress(profile.id, 'shop'));
    })();
    return () => {
      alive = false;
    };
  }, [profile.id, skill]);

  const locked = skill ? settings.levelLocks[skill.id] : undefined;
  const levelCount = skill?.levels.length ?? 1;
  // 保存データの段階がスキルの段階数を超えていても、最上段に丸める（読み込んだ古いデータ等）
  const skillLevel = skill ? Math.min(levelCount - 1, locked ?? progress?.level ?? 0) : 0;
  const [lo, hi] = variant.levelRange ?? [0, levelCount - 1];
  const level = Math.max(lo, Math.min(hi, skillLevel));
  /** 遊び方の範囲で段階を丸めた場合（なぞりの「せん」を後で遊ぶ等）は練習として扱い、進度を動かさない */
  const countsForProgress = skill !== null && level === skillLevel;

  // 回の記録を開始
  useEffect(() => {
    if (!progress) return;
    const r: RoundRecord = {
      profileId: profile.id,
      modeId,
      variantId: variant.id,
      startedAt: Date.now(),
      endedAt: Date.now(),
      count: 0,
      completed: false,
    };
    countRef.current = 0;
    roundRef.current = r;
    void db.addRound(r).then((id) => {
      if (roundRef.current === r) roundRef.current = { ...r, id };
    });
    return () => {
      // 画面を離れる（おうち等）: 未完了として終了時刻を残す
      const cur = roundRef.current;
      if (cur && !cur.completed && cur.id !== undefined) {
        void db.updateRound({ ...cur, endedAt: Date.now(), count: countRef.current });
      }
    };
    // roundKey が変わるたびに新しい回
  }, [progress === null, roundKey, profile.id, modeId, variant.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const playPrompt = useCallback((seq: VoiceSeq, display?: VoiceSeq) => {
    promptRef.current = display ?? seq;
    setPromptText(textOf(display ?? seq));
    return audio.play(seq);
  }, []);

  const roundSize = roundSizeFor(variant.roundKind, settings.roundSize);
  /** 中断データは、保存したときと段階・1回の問題数が同じときだけ使う（保護者が設定を変えた等で食い違うと壊れるため） */
  const resumeValid =
    resumeMeta !== null && resumeMeta.level === level && resumeMeta.roundSize === roundSize;

  const session = useMemo<ModeSession | null>(() => {
    if (!progress) return null;
    return {
      profileId: profile.id,
      modeId,
      variantId: variant.id,
      skillId: skill?.id ?? null,
      level,
      levelCount,
      roundSize,
      seed,
      settings,
      reduceMotion: app.reduceMotion,
      resume: resumeValid ? resumeState : null,
      prompt: playPrompt,
      say: (seq) => audio.play(seq),
      sfx: (name) => audio.sfx(name),
      record: (a: AttemptInput) => {
        countRef.current += 1;
        void db.addAttempt({
          profileId: profile.id,
          modeId,
          variantId: variant.id,
          skillId: skill?.id ?? null,
          level,
          itemKey: a.itemKey,
          outcome: a.outcome,
          wrongTries: a.wrongTries,
          hintsUsed: a.hintsUsed,
          reviewsUsed: a.reviewsUsed ?? 0,
          operationIssue: a.operationIssue ?? false,
          inputKind: a.inputKind ?? 'unknown',
          at: Date.now(),
          detail: { ...a.detail, practice: !countsForProgress },
        });
        if (skill && countsForProgress && progressRef.current) {
          progressRef.current = addOutcome(progressRef.current, a.outcome, a.operationIssue);
          void db.saveProgress(progressRef.current);
        }
      },
      saveDraft: (state) =>
        void db.saveDraft({
          profileId: profile.id,
          modeId,
          variantId: variant.id,
          savedAt: Date.now(),
          state: { level, seed, roundSize, data: state },
        }),
      clearDraft: () => void db.deleteDraft(profile.id, modeId, variant.id),
      saveWork: async (w: WorkInput) => {
        const id = w.id ?? crypto.randomUUID();
        await db.saveWork({
          id,
          profileId: profile.id,
          modeId,
          kind: w.kind,
          title: w.draft ? `${w.title}（つくりかけ）` : w.title,
          createdAt: Date.now(),
          data: { ...(w.data as object), draft: !!w.draft },
        });
        return id;
      },
      finish: (s: RoundSummary) => {
        void (async () => {
          void db.deleteDraft(profile.id, modeId, variant.id);
          // 進度の判定は回の終わりだけ（AD-04）
          if (skill && countsForProgress && progressRef.current) {
            const lv = skill.levels[progressRef.current.level];
            const r = evaluate(progressRef.current, {
              levelCount,
              locked,
              chance: lv?.chance,
              autoPromoteAfter: lv?.autoPromoteAfter,
              now: Date.now(),
            });
            progressRef.current = r.next;
            await db.saveProgress(r.next);
          }
          const cur = roundRef.current;
          if (cur) {
            const done = { ...cur, endedAt: Date.now(), count: countRef.current, completed: true };
            roundRef.current = done;
            if (done.id !== undefined) await db.updateRound(done);
          }
          // 利用時間の目安（区切りでだけ知らせる。CX-04）
          if (settings.sessionMinutes > 0) {
            const rounds = await db.listRounds(profile.id, { since: DAY_START() });
            const ms = rounds.reduce((sum, r) => sum + Math.max(0, r.endedAt - r.startedAt), 0);
            setTimeUp(ms >= settings.sessionMinutes * 60_000);
          }
          audio.sfx('complete');
          setSummary(s);
        })();
      },
      expose: (data) => exposeForTest({ modeId, variantId: variant.id, level, data }),
    };
  }, [
    progress,
    profile.id,
    modeId,
    variant.id,
    skill,
    level,
    levelCount,
    locked,
    countsForProgress,
    seed,
    settings,
    app.reduceMotion,
    resumeState,
    resumeValid,
    roundSize,
    playPrompt,
  ]);

  const again = useCallback(() => {
    // 段階が変わっている可能性があるので、先に読み直してから一度に切り替える
    // （古い段階のまま一瞬描画して問題文が鳴るのを防ぐ）
    const restart = (p: SkillProgress | null) => {
      if (p) {
        progressRef.current = p;
        setProgress(p);
      }
      setSummary(null);
      setTimeUp(false);
      setResumeState(null);
      setResumeMeta(null);
      setSeed(freshSeed());
      setPromptText('');
      promptRef.current = null;
      setRoundKey((k) => k + 1);
    };
    if (skill) void db.getProgress(profile.id, skill.id).then(restart);
    else restart(null);
  }, [profile.id, skill]);

  if (!session) return null;
  const Component = mode.Component;

  if (summary) {
    return (
      <DoneScreen
        modeId={modeId}
        summary={summary}
        timeUp={timeUp}
        onAgain={again}
        onHome={() => navigate({ name: 'home' }, { force: true })}
      />
    );
  }

  return (
    <div className="screen" data-testid={`mode-${modeId}`} data-level={level}>
      <ModeHeader
        promptText={promptText}
        onHome={() => navigate({ name: 'home' }, { force: true })}
        onListen={() => {
          if (promptRef.current) void audio.play(promptRef.current);
        }}
        canListen={promptText !== ''}
      />
      <div className="screen" style={{ top: 'calc(var(--u) * 8)' }} key={`${roundKey}-${seed}`}>
        <ChunkErrorBoundary onError={() => void db.deleteDraft(profile.id, modeId, variant.id)}>
          <Suspense fallback={null}>
            <Component session={session} />
          </Suspense>
        </ChunkErrorBoundary>
      </div>
    </div>
  );
}
