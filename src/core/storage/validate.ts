/**
 * 手書きの型検証。不正なら null を返す（例外を投げない）。
 * 書き出しファイルの読み込みと、保存済み設定の補完で使う。
 */
import { AUDIENCE_IDS } from '../../audience/audience';
import {
  type ArtworkBlobKind,
  type ArtworkRecord,
  type AudienceId,
  type Grade,
  type SupportSettings,
  type UnitProgress,
  isArtworkBlobKind,
  MODE_IDS,
  OUTCOMES,
  SKILL_IDS,
  defaultSettings,
  type AttemptRecord,
  type ChildSettings,
  type DraftRecord,
  type FavoritesRecord,
  type InputKind,
  type MemoRecord,
  type ModeId,
  type Outcome,
  type Profile,
  type RoundRecord,
  type SkillId,
  type SkillProgress,
  type TraceTolerance,
  type WorkRecord,
} from '../types';

export const LIMITS = {
  id: 100,
  name: 40,
  avatar: 60,
  title: 100,
  itemKey: 200,
  variantId: 100,
  memo: 2000,
  detailKeys: 50,
  detailString: 200,
  workData: 2_000_000,
  /** 作品の文書 JSON（はんこの SVG を埋め込むため大きめ） */
  artDoc: 5_000_000,
  /** 作品の画像1枚の data URL */
  artBlob: 12_000_000,
  level: 20,
  count: 100_000,
} as const;

export type Obj = Record<string, unknown>;
export const isObj = (x: unknown): x is Obj =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown, max: number, min = 0): x is string =>
  typeof x === 'string' && x.length <= max && x.length >= min;
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const int = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
const time = (x: unknown): x is number => num(x) && x >= 0;
const bool = (x: unknown): x is boolean => typeof x === 'boolean';
const oneOf = <T extends string>(list: readonly T[], x: unknown): x is T =>
  typeof x === 'string' && (list as readonly string[]).includes(x);

const isMode = (x: unknown): x is ModeId => oneOf(MODE_IDS, x);
const isSkill = (x: unknown): x is SkillId => oneOf(SKILL_IDS, x);
const isOutcome = (x: unknown): x is Outcome => oneOf(OUTCOMES, x);
const INPUT_KINDS: readonly InputKind[] = ['touch', 'pen', 'mouse', 'unknown'];
const TOLERANCES: readonly TraceTolerance[] = ['wide', 'normal', 'narrow'];

/** 自動採番の id を除いたコピー */
export function withoutId<T extends { id?: number }>(x: T): Omit<T, 'id'> {
  const c = { ...x };
  delete c.id;
  return c;
}

/** プロフィール */
export function validateProfile(x: unknown): Profile | null {
  if (!isObj(x)) return null;
  if (!str(x.id, LIMITS.id, 1) || !str(x.name, LIMITS.name, 1)) return null;
  if (!str(x.avatar, LIMITS.avatar) || !time(x.createdAt)) return null;
  const p: Profile = { id: x.id, name: x.name, avatar: x.avatar, createdAt: x.createdAt };
  // スキーマ2の項目（任意。あるのに不正なら拒否）
  if (x.audience !== undefined) {
    if (!oneOf(AUDIENCE_IDS, x.audience)) return null;
    p.audience = x.audience;
  }
  if (x.toddlerStage !== undefined) {
    if (x.toddlerStage !== 2 && x.toddlerStage !== 3) return null;
    p.toddlerStage = x.toddlerStage;
  }
  if (x.enrolledGrade !== undefined) {
    if (!(x.enrolledGrade === null || int(x.enrolledGrade, 1, 6))) return null;
    p.enrolledGrade = x.enrolledGrade as Grade | null;
  }
  if (x.ageGuide !== undefined) {
    if (typeof x.ageGuide !== 'string' || !/^y([2-9]|1[0-2])$/.test(x.ageGuide)) return null;
    p.ageGuide = x.ageGuide;
  }
  return p;
}

const SUPPORT_CHOICES: { [K in keyof SupportSettings]: readonly SupportSettings[K][] } = {
  furigana: ['unlearned', 'all', 'none'],
  readAloud: ['always', 'button', 'off'],
  textScale: [1, 1.15, 1.3],
  instruction: ['short', 'normal'],
  style: ['gentle', 'standard', 'calm'],
  drawingTools: ['simple', 'detailed'],
  effects: ['on', 'quiet', 'off'],
};

type Check<T> = (v: unknown) => T | undefined;

/**
 * 設定の正規化。欠けた項目は既定値で補う。
 * strict=true のとき、値があるのに不正なら null（読み込み拒否）。strict=false は不正値も既定に戻す。
 */
export function normalizeSettings(
  raw: unknown,
  profileId: string,
  strictMode: boolean,
  audience: AudienceId = 'p4',
): ChildSettings | null {
  if (!isObj(raw)) return strictMode ? null : defaultSettings(profileId, audience);
  const d = defaultSettings(profileId, audience);
  let bad = false;
  const take = <T>(v: unknown, check: Check<T>, def: T): T => {
    if (v === undefined) return def;
    const ok = check(v);
    if (ok === undefined) {
      bad = true;
      return def;
    }
    return ok;
  };
  const tol = (v: unknown): ChildSettings['traceTolerance'] | undefined => {
    if (!isObj(v)) return undefined;
    const out = { ...d.traceTolerance };
    for (const k of ['touch', 'pen', 'mouse'] as const) {
      if (v[k] === undefined) continue;
      if (!oneOf(TOLERANCES, v[k])) return undefined;
      out[k] = v[k];
    }
    return out;
  };
  const locks = (v: unknown): ChildSettings['levelLocks'] | undefined => {
    if (!isObj(v)) return undefined;
    const out: ChildSettings['levelLocks'] = {};
    for (const [k, val] of Object.entries(v)) {
      if (!isSkill(k) || !int(val, 0, LIMITS.level)) return undefined;
      out[k] = val;
    }
    return out;
  };
  const modes = (v: unknown): ModeId[] | undefined =>
    Array.isArray(v) && v.every(isMode) ? [...v] : undefined;
  const support = (v: unknown): SupportSettings | undefined => {
    if (!isObj(v)) return undefined;
    const out = { ...d.support } as Record<string, unknown>;
    for (const k of Object.keys(SUPPORT_CHOICES) as (keyof SupportSettings)[]) {
      if (v[k] === undefined) continue;
      if (!(SUPPORT_CHOICES[k] as readonly unknown[]).includes(v[k])) return undefined;
      out[k] = v[k];
    }
    return out as unknown as SupportSettings;
  };
  const units = (v: unknown): string[] | undefined =>
    Array.isArray(v) &&
    v.length <= 500 &&
    v.every((x) => typeof x === 'string' && /^(p23|p4|p5|g[1-6])\.[a-z]+\.[a-z0-9-]+$/.test(x))
      ? [...new Set(v as string[])]
      : undefined;
  const s: ChildSettings = {
    support: take(raw.support, support, d.support),
    unitsOpened: take(raw.unitsOpened, units, d.unitsOpened),
    profileId,
    volume: take(raw.volume, (v) => (num(v) && v >= 0 && v <= 1 ? v : undefined), d.volume),
    sfx: take(raw.sfx, (v) => (bool(v) ? v : undefined), d.sfx),
    reduceMotion: take(raw.reduceMotion, (v) => (bool(v) ? v : undefined), d.reduceMotion),
    sessionMinutes: take(
      raw.sessionMinutes,
      (v) => (int(v, 0, 600) ? v : undefined),
      d.sessionMinutes,
    ),
    roundSize: take(
      raw.roundSize,
      (v) => (v === 3 || v === 4 || v === 5 ? v : undefined),
      d.roundSize,
    ),
    homeDisplay: take(
      raw.homeDisplay,
      (v) => (v === 'all' || v === 'selected' ? v : undefined),
      d.homeDisplay,
    ),
    visibleModes: take(raw.visibleModes, modes, d.visibleModes),
    traceTolerance: take(raw.traceTolerance, tol, d.traceTolerance),
    memoryAutoHideSec: take(
      raw.memoryAutoHideSec,
      (v) => (v === 0 || v === 3 || v === 5 || v === 8 ? v : undefined),
      d.memoryAutoHideSec,
    ),
    levelLocks: take(raw.levelLocks, locks, d.levelLocks),
  };
  return bad && strictMode ? null : s;
}

/** スキル進度 */
export function validateProgress(x: unknown): SkillProgress | null {
  if (!isObj(x) || !isSkill(x.skillId)) return null;
  const core = progressCore(x);
  return core ? { ...core, skillId: x.skillId } : null;
}

const STAGES = ['none', 'learning', 'learned', 'secured'] as const;

/** 新しい単元の進度 */
export function validateUnitProgress(x: unknown): UnitProgress | null {
  if (!isObj(x) || !str(x.unitId, LIMITS.id, 1)) return null;
  const core = progressCore(x);
  const rv = x.review;
  if (!core || !isObj(rv)) return null;
  if (!oneOf(STAGES, rv.stage) || !int(rv.reviewStep, 0, 10)) return null;
  if (!(rv.reviewDue === null || time(rv.reviewDue))) return null;
  if (!(rv.lastReviewAt === null || time(rv.lastReviewAt))) return null;
  return {
    ...core,
    unitId: x.unitId,
    review: {
      stage: rv.stage,
      reviewStep: rv.reviewStep,
      reviewDue: rv.reviewDue,
      lastReviewAt: rv.lastReviewAt,
    },
  };
}

/** 作品（文書の中身は drawing/ が開くときに検証する。ここでは形と大きさだけ） */
export function validateArtwork(x: unknown): ArtworkRecord | null {
  if (!isObj(x)) return null;
  if (!str(x.id, LIMITS.id, 1) || !str(x.profileId, LIMITS.id, 1)) return null;
  if (!str(x.title, LIMITS.title) || !time(x.createdAt) || !time(x.updatedAt)) return null;
  if (!isObj(x.doc)) return null;
  let size: number;
  try {
    size = JSON.stringify(x.doc).length;
  } catch {
    return null;
  }
  if (size > LIMITS.artDoc) return null;
  return {
    id: x.id,
    profileId: x.profileId,
    title: x.title,
    createdAt: x.createdAt,
    updatedAt: x.updatedAt,
    doc: x.doc,
  };
}

/** 書き出しファイル内の作品の画像（Blob の代わりに PNG の data URL） */
export interface ArtworkBlobFile {
  key: string;
  artId: string;
  profileId: string;
  kind: ArtworkBlobKind;
  dataUrl: string;
}

export function validateArtworkBlobFile(x: unknown): ArtworkBlobFile | null {
  if (!isObj(x)) return null;
  if (!str(x.artId, LIMITS.id, 1) || !str(x.profileId, LIMITS.id, 1)) return null;
  if (!isArtworkBlobKind(x.kind)) return null;
  if (x.key !== `${x.artId}:${x.kind}`) return null;
  if (!str(x.dataUrl, LIMITS.artBlob) || !x.dataUrl.startsWith('data:image/png;base64,'))
    return null;
  return { key: x.key, artId: x.artId, profileId: x.profileId, kind: x.kind, dataUrl: x.dataUrl };
}

function progressCore(x: Obj): Omit<SkillProgress, 'skillId'> | null {
  if (!str(x.profileId, LIMITS.id, 1)) return null;
  if (!int(x.level, 0, LIMITS.level) || !time(x.changedAt)) return null;
  if (!Array.isArray(x.window) || x.window.length > 20 || !x.window.every(isOutcome)) return null;
  if (!bool(x.mastered) || !bool(x.attempted)) return null;
  let lastChange: SkillProgress['lastChange'] = null;
  if (x.lastChange !== null && x.lastChange !== undefined) {
    const c = x.lastChange;
    if (!isObj(c) || !int(c.from, 0, LIMITS.level) || !int(c.to, 0, LIMITS.level)) return null;
    if (!oneOf(['promote', 'demote', 'parent'] as const, c.reason) || !time(c.at)) return null;
    lastChange = { from: c.from, to: c.to, reason: c.reason, at: c.at };
  }
  return {
    profileId: x.profileId,
    level: x.level,
    window: [...x.window],
    mastered: x.mastered,
    attempted: x.attempted,
    changedAt: x.changedAt,
    lastChange,
  };
}

/** 1問の記録（id は引き継がない） */
/** 記録の出どころ（v1 のモード、または 'unit' と単元ID）。不正なら null */
function recordSource(x: Obj): { modeId: ModeId | 'unit'; unitId?: string } | null {
  if (x.modeId === 'unit')
    return str(x.unitId, LIMITS.id, 1) ? { modeId: 'unit', unitId: x.unitId } : null;
  return isMode(x.modeId) && x.unitId === undefined ? { modeId: x.modeId } : null;
}

export function validateAttempt(x: unknown): AttemptRecord | null {
  if (!isObj(x)) return null;
  const src = recordSource(x);
  if (!str(x.profileId, LIMITS.id, 1) || !src) return null;
  if (!str(x.variantId, LIMITS.variantId) || !time(x.at)) return null;
  if (!(x.skillId === null || isSkill(x.skillId))) return null;
  if (!int(x.level, 0, LIMITS.level) || !str(x.itemKey, LIMITS.itemKey)) return null;
  if (!isOutcome(x.outcome) || !oneOf(INPUT_KINDS, x.inputKind)) return null;
  if (!int(x.wrongTries, 0, LIMITS.count) || !int(x.hintsUsed, 0, LIMITS.count)) return null;
  if (!int(x.reviewsUsed, 0, LIMITS.count) || !bool(x.operationIssue)) return null;
  const out: AttemptRecord = {
    profileId: x.profileId,
    ...src,
    variantId: x.variantId,
    skillId: x.skillId,
    level: x.level,
    itemKey: x.itemKey,
    outcome: x.outcome,
    wrongTries: x.wrongTries,
    hintsUsed: x.hintsUsed,
    reviewsUsed: x.reviewsUsed,
    operationIssue: x.operationIssue,
    inputKind: x.inputKind,
    at: x.at,
  };
  if (x.detail !== undefined) {
    if (!isObj(x.detail)) return null;
    const entries = Object.entries(x.detail);
    if (entries.length > LIMITS.detailKeys) return null;
    const detail: Record<string, string | number | boolean> = {};
    for (const [k, v] of entries) {
      if (k.length > LIMITS.name) return null;
      if (typeof v === 'string') {
        if (v.length > LIMITS.detailString) return null;
      } else if (!num(v) && !bool(v)) return null;
      detail[k] = v;
    }
    out.detail = detail;
  }
  return out;
}

/** 1回分の記録（id は引き継がない） */
export function validateRound(x: unknown): RoundRecord | null {
  if (!isObj(x)) return null;
  const src = recordSource(x);
  if (!str(x.profileId, LIMITS.id, 1) || !src) return null;
  if (!str(x.variantId, LIMITS.variantId) || !time(x.startedAt) || !time(x.endedAt)) return null;
  if (!int(x.count, 0, LIMITS.count) || !bool(x.completed)) return null;
  return {
    profileId: x.profileId,
    ...src,
    variantId: x.variantId,
    startedAt: x.startedAt,
    endedAt: x.endedAt,
    count: x.count,
    completed: x.completed,
  };
}

/** 作品 */
export function validateWork(x: unknown): WorkRecord | null {
  if (!isObj(x)) return null;
  if (!str(x.id, LIMITS.id, 1) || !str(x.profileId, LIMITS.id, 1) || !isMode(x.modeId)) return null;
  if (x.kind !== 'trace' && x.kind !== 'road') return null;
  if (!str(x.title, LIMITS.title) || !time(x.createdAt) || x.data === undefined) return null;
  try {
    const json = JSON.stringify(x.data);
    if (json === undefined || json.length > LIMITS.workData) return null;
  } catch {
    return null;
  }
  return {
    id: x.id,
    profileId: x.profileId,
    modeId: x.modeId,
    kind: x.kind,
    title: x.title,
    createdAt: x.createdAt,
    data: x.data,
  };
}

/** メモ */
export function validateMemo(x: unknown): MemoRecord | null {
  if (!isObj(x)) return null;
  if (!str(x.id, LIMITS.id, 1) || !str(x.profileId, LIMITS.id, 1)) return null;
  if (typeof x.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date)) return null;
  if (!str(x.text, LIMITS.memo) || !time(x.createdAt)) return null;
  return {
    id: x.id,
    profileId: x.profileId,
    date: x.date,
    text: x.text,
    createdAt: x.createdAt,
  };
}

/** お気に入り */
export function validateFavorites(x: unknown): FavoritesRecord | null {
  if (!isObj(x) || !str(x.profileId, LIMITS.id, 1)) return null;
  if (!Array.isArray(x.modeIds) || !x.modeIds.every(isMode)) return null;
  return { profileId: x.profileId, modeIds: [...x.modeIds] };
}

/** 中断データ（保存直前の簡易確認用） */
export function validateDraft(x: unknown): DraftRecord | null {
  if (!isObj(x) || !str(x.profileId, LIMITS.id, 1) || !isMode(x.modeId)) return null;
  if (!str(x.variantId, LIMITS.variantId) || !time(x.savedAt)) return null;
  return {
    profileId: x.profileId,
    modeId: x.modeId,
    variantId: x.variantId,
    savedAt: x.savedAt,
    state: x.state,
  };
}
