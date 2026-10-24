/**
 * アプリ全体で共有する型。モード・保存・進度のすべてがここを基準にする。
 * 変更は Opus（統括）が行う。各担当はここを編集しない。
 */
import {
  defaultSupport,
  type AudienceId,
  type Grade,
  type SupportSettings,
  type ToddlerStage,
} from '../audience/audience';
export type { AudienceId, Grade, SupportSettings, ToddlerStage };
import type { ReviewState } from '../curriculum/review';

export const MODE_IDS = [
  'shopping',
  'hiragana',
  'sorting',
  'shapes',
  'memory',
  'compare',
  'road',
  'trace',
  'math',
] as const;
export type ModeId = (typeof MODE_IDS)[number];

export const SKILL_IDS = [
  'shop',
  'kana',
  'sort',
  'shape',
  'memory',
  'compare',
  'road',
  'trace',
  'add',
  'sub',
  'split',
  'formula_add',
  'formula_sub',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

/**
 * 1問の結果の種類（requirements AD-05）。
 * - independent: 最初の選択で正解。ヒント・見直しなし
 * - self_corrected: 誤答 → ヒント1（注目させるだけ）→ 選び直して正解
 * - after_hint: ヒント2（具体的なヒント）の後に正解
 * - after_review: 見直し（もういちど みる／えで みる）を使って正解。戻る判定に数えない
 * - skipped: 「つぎへ」で正解を見て次へ進んだ
 * - abandoned: 途中で離れた。進度の判定には使わない
 * 状態表は docs/architecture.md 4.3。
 */
export const OUTCOMES = [
  'independent',
  'self_corrected',
  'after_hint',
  'after_review',
  'skipped',
  'abandoned',
] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type InputKind = 'touch' | 'pen' | 'mouse' | 'unknown';

export type TraceTolerance = 'wide' | 'normal' | 'narrow';

export interface ChildSettings {
  profileId: string;
  /** 0〜1 */
  volume: number;
  sfx: boolean;
  reduceMotion: boolean;
  /** 利用時間の目安（分）。0 は「なし」 */
  sessionMinutes: number;
  /** 1回の問題数（3〜5） */
  roundSize: 3 | 4 | 5;
  homeDisplay: 'all' | 'selected';
  visibleModes: ModeId[];
  traceTolerance: Record<'touch' | 'pen' | 'mouse', TraceTolerance>;
  /** おぼえてさがす: 0 = 子供が「おぼえた！」を押すまで。3/5/8 秒で自動で隠す */
  memoryAutoHideSec: 0 | 3 | 5 | 8;
  /** スキルごとの固定。値がないスキルは自動調整 */
  levelLocks: Partial<Record<SkillId, number>>;
  /** 支援設定（スキーマ2〜。docs/expansion/architecture.md 2章） */
  support: SupportSettings;
  /** 保護者が開いた単元（既定で隠す単元 hiddenByDefault を子供画面に出す） */
  unitsOpened: string[];
}

export interface Profile {
  id: string;
  name: string;
  /** IllustId（プロフィールの絵） */
  avatar: string;
  createdAt: number;
  // ---- スキーマ2〜（無いときは profileAudience() で 'p4' として扱う） ----
  /** いま主に使う区分（ホームと既定の教材） */
  audience?: AudienceId;
  /** 2〜3歳の内部段階 */
  toddlerStage?: ToddlerStage;
  /** 在籍学年（就学前は null） */
  enrolledGrade?: Grade | null;
  /** 年齢の目安（'y2'〜'y12'。生年月日は保存しない） */
  ageGuide?: string;
}

/** v1 のプロフィールは4歳向けとして作られた */
export function profileAudience(p: Pick<Profile, 'audience'>): AudienceId {
  return p.audience ?? 'p4';
}

export interface LevelChange {
  from: number;
  to: number;
  reason: 'promote' | 'demote' | 'parent';
  at: number;
}

export interface SkillProgress {
  profileId: string;
  skillId: SkillId;
  level: number;
  /** 現在の段階での直近の結果（古い順、最大10件。abandoned は含めない） */
  window: Outcome[];
  /** 最上段で「進む」条件を満たしたことがある */
  mastered: boolean;
  /** 一度でも取り組んだか（未実施と不得意の区別） */
  attempted: boolean;
  changedAt: number;
  lastChange: LevelChange | null;
}

/** 新しい単元の進度（スキーマ2〜。ストア unitProgress） */
export interface UnitProgress extends Omit<SkillProgress, 'skillId'> {
  unitId: string;
  review: ReviewState;
}

/**
 * おえかきの作品（ストア artworks）。doc の中身は drawing/ が定義・検証する。
 * ここでは保存・書き出しに必要な共通の項目だけを決める。
 */
export interface ArtworkRecord {
  id: string;
  profileId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** 文書（ArtDoc。JSON 化できること） */
  doc: unknown;
}

/**
 * 作品の画像の種類（review-1 #1 の文書モデル）:
 * base = 焼き付けた背景の層、`ink:<itemId>` = インクの層（可変枚数）、full = 閲覧用の合成、thumb = 縮小。
 */
export const ARTWORK_BLOB_FIXED_KINDS = ['base', 'full', 'thumb'] as const;
export type ArtworkBlobKind = (typeof ARTWORK_BLOB_FIXED_KINDS)[number] | `ink:${string}`;
const INK_KIND = /^ink:[A-Za-z0-9_-]{1,64}$/;
export function isArtworkBlobKind(x: unknown): x is ArtworkBlobKind {
  return (
    typeof x === 'string' &&
    ((ARTWORK_BLOB_FIXED_KINDS as readonly string[]).includes(x) || INK_KIND.test(x))
  );
}

/** 作品の画像（ストア artworkBlobs）。key = `${artId}:${kind}` */
export interface ArtworkBlobRecord {
  key: string;
  artId: string;
  profileId: string;
  kind: ArtworkBlobKind;
  blob: Blob;
}

/** 記録の出どころ: v1 のモード、または新しい単元（'unit'。単元IDは unitId） */
export type RecordModeId = ModeId | 'unit';

export interface AttemptRecord {
  id?: number;
  profileId: string;
  modeId: RecordModeId;
  /** modeId が 'unit' のときの単元ID */
  unitId?: string;
  variantId: string;
  skillId: SkillId | null;
  level: number;
  /** 問題の内容を表す短いキー（保護者画面で読める形。例 "りんご×3"） */
  itemKey: string;
  outcome: Outcome;
  wrongTries: number;
  hintsUsed: number;
  reviewsUsed: number;
  /** 操作にとまどった（盤面外タップの多発など）。学力の記録とは分けて表示 */
  operationIssue: boolean;
  inputKind: InputKind;
  at: number;
  detail?: Record<string, string | number | boolean>;
}

export interface RoundRecord {
  id?: number;
  profileId: string;
  modeId: RecordModeId;
  /** modeId が 'unit' のときの単元ID */
  unitId?: string;
  variantId: string;
  startedAt: number;
  endedAt: number;
  count: number;
  completed: boolean;
}

export type WorkKind = 'trace' | 'road';

export interface WorkRecord {
  id: string;
  profileId: string;
  modeId: ModeId;
  kind: WorkKind;
  /** 保護者画面用の名前（例「し」「じゆうな みち」） */
  title: string;
  createdAt: number;
  /** 再表示に必要なデータ（モードが定義。JSON 化できること） */
  data: unknown;
}

export interface MemoRecord {
  id: string;
  profileId: string;
  /** YYYY-MM-DD */
  date: string;
  text: string;
  createdAt: number;
}

export interface DraftRecord {
  profileId: string;
  /** 'unit' のときは variantId が単元ID */
  modeId: RecordModeId;
  variantId: string;
  savedAt: number;
  state: unknown;
}

export interface FavoritesRecord {
  profileId: string;
  modeIds: ModeId[];
}

export interface AppRecord {
  activeProfileId: string | null;
  /** SHA-256 hex。誤操作防止のためのもので強固な保護ではない */
  parentPinHash: string | null;
}

export interface MetaRecord {
  schemaVersion: number;
  createdAt: number;
  lastAppVersion: string;
}

export type StorageHealth = 'ok' | 'full' | 'error' | 'unavailable';

export function defaultSettings(profileId: string, audience: AudienceId = 'p4'): ChildSettings {
  return {
    support: defaultSupport(audience),
    unitsOpened: [],
    profileId,
    volume: 0.8,
    sfx: true,
    reduceMotion: false,
    sessionMinutes: 10,
    roundSize: 4,
    homeDisplay: 'all',
    visibleModes: [...MODE_IDS],
    traceTolerance: { touch: 'wide', pen: 'wide', mouse: 'wide' },
    memoryAutoHideSec: 0,
    levelLocks: {},
  };
}
