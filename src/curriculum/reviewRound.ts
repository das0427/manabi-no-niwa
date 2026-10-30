/**
 * 復習の回の問題を選ぶ（architecture.md 3章「別の seed／別の表現で出す」、acceptance.md 2.1-3）。純粋関数。
 *
 * 表現の区別は教材の既存のデータから導く（パックは書き換えない）:
 *   表現 = エンジン ＋ 別例の印（ItemBase.alt）＋ 問題 id の「:」より前（生成器が付ける種類名。例 'bunshou-alt'）
 * id に「:」が無い手作りの問題は、エンジンと別例の印だけで区別する。
 *
 * 選ぶ順（前のものほど強い）:
 *   1. 別例（alt）の問題
 *   2. この回でまだ出していない表現（同じ表現を続けない）
 *   3. 前の記録で見ていない表現
 *   4. 前の記録で見ていない問題（同一性キー）
 * 別例が無い単元では、ふつうの問題から同じ順で選ぶ。seed から再現できる（中断・再開）。
 */
import { createRng, hashSeed } from '../core/util/rng';
import { poolFor } from './round';
import type { Item, UnitSpec } from './types';

/** 生成器から作る候補の数（別例は 4問に1問ほど。3問を選ぶのに十分な数） */
const CANDIDATES = 48;
/** 記録に残す表現のキーの長さの上限（attempts の detail の文字列の上限 200 に合わせる） */
const REP_MAX = 200;

/** 問題の表現のキー */
export function representationOf(it: Item): string {
  const cut = it.id.indexOf(':');
  const kind = cut >= 0 ? it.id.slice(0, cut) : '';
  return `${it.engine}|${it.alt ? 'alt' : 'base'}|${kind}`.slice(0, REP_MAX);
}

/** この単元で前に見たもの（attempts から作る） */
export interface ReviewHistory {
  /** 問題の id（attempts の itemKey） */
  itemIds: ReadonlySet<string>;
  /** 同一性キー（attempts の detail.identity） */
  identities: ReadonlySet<string>;
  /** 表現のキー（attempts の detail.rep。2.1.0 から記録） */
  reps: ReadonlySet<string>;
}

export const emptyHistory: ReviewHistory = {
  itemIds: new Set(),
  identities: new Set(),
  reps: new Set(),
};

/** attempts のうち、読むのに使う項目だけ */
export interface HistoryAttempt {
  unitId?: string;
  itemKey: string;
  at: number;
  detail?: Record<string, string | number | boolean>;
}

/** 単元の記録から、before より前に見たものを集める（中断・再開で同じ回を作り直せるように時刻で切る） */
export function reviewHistoryOf(
  attempts: readonly HistoryAttempt[],
  unitId: string,
  before: number,
): ReviewHistory {
  const itemIds = new Set<string>();
  const identities = new Set<string>();
  const reps = new Set<string>();
  for (const a of attempts) {
    if (a.unitId !== unitId || a.at >= before) continue;
    itemIds.add(a.itemKey);
    const id = a.detail?.identity;
    if (typeof id === 'string') identities.add(id);
    const rep = a.detail?.rep;
    if (typeof rep === 'string') reps.add(rep);
  }
  return { itemIds, identities, reps };
}

export interface ReviewRoundOptions {
  level: number;
  seed: number;
  count: number;
  history: ReviewHistory;
}

export function buildReviewRound(unit: UnitSpec, opt: ReviewRoundOptions): Item[] {
  const src = unit.source;
  if (src.kind === 'legacy') return [];
  const cands: Item[] = [];
  const ids = new Set<string>();
  const add = (it: Item) => {
    if (ids.has(it.identity)) return;
    ids.add(it.identity);
    cands.push(it);
  };
  if (src.kind === 'generator') {
    for (let k = 0; k < CANDIDATES; k++) {
      const rng = createRng(hashSeed(opt.seed, 'review', k));
      add(src.generate({ level: opt.level, rng, index: k }));
    }
  } else {
    const rng = createRng(hashSeed(opt.seed, 'review-items'));
    for (const it of rng.shuffle(poolFor(src.items, opt.level))) add(it);
  }

  const h = opt.history;
  const seenItem = (it: Item) => h.itemIds.has(it.id) || h.identities.has(it.identity);
  // 前に見た表現: 記録の表現のキー＋候補のうち前に見た問題の表現（2.0 までの記録は表現を持たない）
  const seenRep = new Set(h.reps);
  for (const it of cands) if (seenItem(it)) seenRep.add(representationOf(it));

  const roundRep = new Set<string>();
  const rank = (it: Item): number[] => {
    const rep = representationOf(it);
    return [
      it.alt ? 0 : 1,
      roundRep.has(rep) ? 1 : 0,
      seenRep.has(rep) ? 1 : 0,
      seenItem(it) ? 1 : 0,
    ];
  };
  const out: Item[] = [];
  const rest = [...cands];
  while (out.length < opt.count && rest.length > 0) {
    let best = 0;
    let bestRank = rank(rest[0]!);
    for (let i = 1; i < rest.length; i++) {
      const r = rank(rest[i]!);
      if (less(r, bestRank)) {
        best = i;
        bestRank = r;
      }
    }
    const [pick] = rest.splice(best, 1);
    out.push(pick!);
    roundRep.add(representationOf(pick!));
  }
  return out;
}

function less(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
  return false;
}
