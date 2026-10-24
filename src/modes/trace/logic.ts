/**
 * なぞりの出題と補助（純粋関数）。判定そのものは judge.ts。
 * 仕様: docs/learning-design.md 8章・0.3、docs/architecture.md 6.3。
 */
import type { QuestionState } from '../../core/session/questionFlow';
import type { ChildSettings } from '../../core/types';
import { createRng, hashSeed } from '../../core/util/rng';
import { findItem, itemsForLevel, MAZE_HALF_WIDTH, type TraceItem } from './content';
import { TOLERANCE_R, type Pt } from './judge';

export type PointerKind = 'touch' | 'pen' | 'mouse';

/** 追跡に使えなかった線がこの本数たまるごとに、誤答1回と数える */
export const UNUSED_PER_WRONG = 3;

/** 1回の題を選ぶ（段階 level の教材から、seed で決まる並びで count 題。同じ回で重複しない） */
export function pickRound(level: number, seed: number, count: number): TraceItem[] {
  const pool = itemsForLevel(level);
  if (pool.length === 0) throw new Error(`no trace items for level ${level}`);
  const rng = createRng(hashSeed('trace', level, seed));
  return rng.sample(pool, Math.min(count, pool.length));
}

/** PointerEvent.pointerType → 判定幅の設定の種類。不明なものはマウス扱い */
export function pointerKind(t: string): PointerKind {
  return t === 'touch' || t === 'pen' ? t : 'mouse';
}

/** 判定幅 r。迷路は通路の半幅に固定（設定は使わない） */
export function toleranceFor(item: TraceItem, kind: PointerKind, settings: ChildSettings): number {
  if (item.kind === 'maze') return item.halfWidth ?? MAZE_HALF_WIDTH;
  return TOLERANCE_R[settings.traceTolerance[kind]];
}

/** 追跡に使えなかった線の累計が wrong を1回数える区切りか（3, 6, 9 本目） */
export function isWrongStep(unusedEver: number): boolean {
  return unusedEver > 0 && unusedEver % UNUSED_PER_WRONG === 0;
}

/**
 * 保存・描画用に線を整える: 0〜1000 に収め、整数にし、近すぎる点を間引く（作品の容量を抑える。arch 5.3）。
 * 始点と終点は必ず残す。
 */
export function simplifyLine(pts: readonly Pt[], minGap = 3): [number, number][] {
  const out: [number, number][] = [];
  const clamp = (v: number) => Math.max(0, Math.min(1000, Math.round(v)));
  for (const p of pts) {
    const q: [number, number] = [clamp(p[0]), clamp(p[1])];
    const last = out[out.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) >= minGap) out.push(q);
  }
  const end = pts[pts.length - 1];
  if (end && out.length > 0) {
    const q: [number, number] = [clamp(end[0]), clamp(end[1])];
    const last = out[out.length - 1]!;
    if (last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  return out;
}

/** 作品として保存するデータ（WorkRecord.data の一部。実行枠が draft フラグを足す） */
export interface TraceWorkData {
  guideId: string;
  /** 整数化した線（書いた順。使われなかった線も含む） */
  strokes: [number, number][][];
}

export function isTraceWorkData(x: unknown): x is TraceWorkData {
  if (typeof x !== 'object' || x === null) return false;
  const d = x as Partial<TraceWorkData>;
  return (
    typeof d.guideId === 'string' &&
    Array.isArray(d.strokes) &&
    d.strokes.every(
      (s) =>
        Array.isArray(s) &&
        s.every((p) => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number'),
    )
  );
}

/** 中断データ（session.saveDraft に渡す状態）。再開時に session.resume から戻る */
export interface SavedLine {
  p: [number, number][];
  k: PointerKind;
}
export interface DoneItem {
  guideId: string;
  strokes: [number, number][][];
  skipped: boolean;
  fromStart: boolean;
}
export interface TraceDraft {
  index: number;
  lines: SavedLine[];
  q: QuestionState;
  unused: number;
  opIssue: boolean;
  done: DoneItem[];
  kind: PointerKind;
}

const isPt = (p: unknown): p is [number, number] =>
  Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number';

/** 中断データの形を確かめる（古い版・壊れたデータなら null。題の数 total の範囲外の index も null） */
export function parseDraft(x: unknown, total: number): TraceDraft | null {
  if (typeof x !== 'object' || x === null) return null;
  const d = x as Partial<TraceDraft>;
  if (
    typeof d.index !== 'number' ||
    !Number.isInteger(d.index) ||
    d.index < 0 ||
    d.index >= total
  ) {
    return null;
  }
  if (
    !Array.isArray(d.lines) ||
    !d.lines.every((l) => l && Array.isArray(l.p) && l.p.every(isPt))
  ) {
    return null;
  }
  if (typeof d.q !== 'object' || d.q === null || typeof d.q.wrongTries !== 'number') return null;
  if (!Array.isArray(d.done) || !d.done.every((e) => e && typeof e.guideId === 'string'))
    return null;
  const kind = d.kind === 'touch' || d.kind === 'pen' || d.kind === 'mouse' ? d.kind : 'mouse';
  return {
    index: d.index,
    lines: d.lines.map((l) => ({ p: l.p, k: pointerKind(l.k) })),
    q: d.q,
    unused: typeof d.unused === 'number' ? d.unused : 0,
    opIssue: d.opIssue === true,
    done: d.done,
    kind,
  };
}

/** 作品データからお手本の題を引く（見つからなければ undefined） */
export function guideOf(data: TraceWorkData): TraceItem | undefined {
  return findItem(data.guideId);
}

/**
 * 回の終わりの声かけ。観測できた行動だけ（learning-design.md 0.5）。
 * - 完成した題がすべて「みどりの まるから 書き始めた線」で完成 → みどりの まるから かけたね
 * - 1題でも完成した → さいごまで なぞれたね
 * - 完成した題がない（すべて「つぎへ」）→ いっしょに さいごまで みたね
 */
export function praiseOf(results: readonly { skipped: boolean; fromStart: boolean }[]): string {
  const done = results.filter((r) => !r.skipped);
  if (done.length > 0 && done.every((r) => r.fromStart)) return 'praise.start-point';
  if (done.length > 0) return 'praise.traced';
  // 自分でなぞった題が0（全部「つぎへ」）の回: いっしょに さいごまで みたね（共通ルール L6）
  return done.length === 0 && results.length > 0 ? 'praise.watched' : 'praise.finished';
}
