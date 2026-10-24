import { useEffect, useState } from 'react';
import { audio } from '../core/audio/index';
import * as db from '../core/storage/index';
import type { DraftRecord, ModeId, SkillId, SkillProgress } from '../core/types';
import { Illust } from '../illust/Illust';
import { MODE_BY_ID, type VariantDef } from '../modes/registry';
import { ModeHeader } from '../ui/ModeHeader';
import { Tap } from '../ui/Tap';
import { useApp } from './AppState';
import { ModeRunner } from './ModeRunner';
import { navigate } from './router';

const DRAFT_TTL = 24 * 60 * 60 * 1000;

/**
 * モードの入口。遊び方が2つ以上なら絵で選ぶ。途中でやめた回があれば「つづきから／はじめから」。
 */
export function ModeEntry({
  modeId,
  variantId,
  onlyVariants,
  levelRange,
  onPickVariant,
}: {
  modeId: ModeId;
  variantId?: string;
  /** 新しい単元（legacy）から開いたとき: 使う遊び方だけ */
  onlyVariants?: readonly string[];
  /** 新しい単元（legacy）から開いたとき: 使う段階の範囲（遊び方の範囲と重なる部分だけ） */
  levelRange?: readonly [number, number];
  /** 遊び方を選んだとき（省略時は #/play/<mode>/<variant> へ移る） */
  onPickVariant?: (variantId: string) => void;
}) {
  const app = useApp();
  const base = MODE_BY_ID[modeId];
  const mode = {
    ...base,
    variants: base.variants
      .filter((v) => !onlyVariants || onlyVariants.includes(v.id))
      .map((v) => (levelRange ? { ...v, levelRange: clampRange(v.levelRange, levelRange) } : v)),
  };
  const profileId = app.profile?.id;
  const [progress, setProgress] = useState<Partial<Record<SkillId, SkillProgress>> | null>(null);
  const [draft, setDraft] = useState<DraftRecord | null | undefined>(undefined);
  const [resume, setResume] = useState<
    { seed: number; data: unknown; level?: number; roundSize?: number } | null | undefined
  >(undefined);

  useEffect(() => {
    if (!profileId) return;
    void db.listProgress(profileId).then((list) => {
      const map: Partial<Record<SkillId, SkillProgress>> = {};
      for (const p of list) map[p.skillId] = p;
      setProgress(map);
    });
  }, [profileId]);

  // 単元から開いたとき（onlyVariants あり）は、v1 の解放条件で止めない（使う遊び方は単元が決める）
  const available = mode.variants.filter(
    (v) => !v.available || onlyVariants !== undefined || (progress && v.available(progress)),
  );
  const variant: VariantDef | undefined =
    available.length === 1 ? available[0] : available.find((v) => v.id === variantId);

  useEffect(() => {
    setDraft(undefined);
    setResume(undefined);
    if (!profileId || !variant) return;
    void db.getDraft(profileId, modeId, variant.id).then((d) => {
      if (d && Date.now() - d.savedAt < DRAFT_TTL) {
        setDraft(d);
        void audio.play('app.resume');
      } else {
        setDraft(null);
        setResume(null);
      }
    });
  }, [profileId, modeId, variant]);

  if (!profileId || !progress) return null;

  // 遊び方を選ぶ
  if (!variant) {
    return (
      <div className="screen" data-testid="variant-picker">
        <ModeHeader
          promptText="どれで あそぶ？"
          onHome={() => navigate({ name: 'home' }, { force: true })}
          onListen={() => void audio.play('app.choose-variant')}
          canListen
        />
        <VariantPicker
          variants={available}
          onPick={(v) => {
            if (onPickVariant) {
              void audio.play(v.titleVoice);
              onPickVariant(v.id);
            } else navigate({ name: 'mode', modeId, variantId: v.id }, { say: v.titleVoice });
          }}
        />
      </div>
    );
  }

  if (draft === undefined) return null;

  // つづきから？
  if (draft && resume === undefined) {
    const state = draft.state as {
      seed?: number;
      data?: unknown;
      level?: number;
      roundSize?: number;
    };
    return (
      <div className="screen" data-testid="resume-prompt">
        <ModeHeader
          promptText="つづきから する？"
          onHome={() => navigate({ name: 'home' }, { force: true })}
          onListen={() => void audio.play('app.resume')}
          canListen
        />
        <div className="center-col">
          <Illust
            id={mode.icon}
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
              onPress={() =>
                setResume({
                  seed: state.seed ?? 0,
                  data: state.data ?? null,
                  level: state.level,
                  roundSize: state.roundSize,
                })
              }
            />
            <Tap
              label="はじめから"
              text="はじめから"
              icon="again"
              size="big"
              testId="resume-no"
              onPress={() => {
                void db.deleteDraft(profileId, modeId, variant.id);
                setResume(null);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ModeRunner
      key={`${modeId}-${variant.id}`}
      modeId={modeId}
      variant={variant}
      resume={resume ?? null}
    />
  );
}

/** 遊び方の段階の範囲と、単元の段階の範囲の重なり（重ならなければ単元の範囲） */
function clampRange(
  own: readonly [number, number] | undefined,
  unit: readonly [number, number],
): [number, number] {
  if (!own) return [unit[0], unit[1]];
  const lo = Math.max(own[0], unit[0]);
  const hi = Math.min(own[1], unit[1]);
  return lo <= hi ? [lo, hi] : [unit[0], unit[1]];
}

function VariantPicker({
  variants,
  onPick,
}: {
  variants: VariantDef[];
  onPick: (v: VariantDef) => void;
}) {
  return (
    <div className="center-col" style={{ top: 'calc(var(--u) * 8)' }}>
      <div
        className="row"
        style={{ gap: 'calc(var(--u) * 2.4)', flexWrap: 'wrap', maxWidth: 'calc(var(--u) * 92)' }}
      >
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            className="choice"
            aria-label={v.title}
            onClick={() => onPick(v)}
            data-testid={`variant-${v.id}`}
            style={{
              width: 'calc(var(--u) * 24)',
              height: 'calc(var(--u) * 22)',
              minHeight: 'calc(var(--u) * 20)',
              gap: 'calc(var(--u) * 0.6)',
            }}
          >
            <Illust id={v.icon} className="choice__illust" decorative />
            <span className="label-text" style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
              {v.title.split(' ').map((w, i) => (
                <span key={i} style={{ display: 'block' }}>
                  {w}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
