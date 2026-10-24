/**
 * 教材の自動検査と充足の数え方（curriculum-matrix.md 1.2〜1.5・1.8）。純粋関数。
 * 各パックのテストから `checkUnit` を呼び、問題が無いこと・量 Q・網羅 C を確かめる。
 */
import { createRng, hashSeed } from '../core/util/rng';
import { engineOf } from '../engines/registry';
import { MODE_BY_ID } from '../modes/registry';
import { findBareKanji } from '../text/rich';
import type { Item, UnitKind, UnitSpec } from './types';

/** 種別ごとの量の基準 N・M（curriculum-matrix 1.3） */
export const QUANTITY_BASE: Record<UnitKind, { generated: number; handmade: number }> = {
  calc: { generated: 100, handmade: 100 },
  concept: { generated: 60, handmade: 30 },
  reading: { generated: 30, handmade: 30 },
  knowledge: { generated: 30, handmade: 30 },
  writing: { generated: 1, handmade: 1 },
  inquiry: { generated: 24, handmade: 24 },
  record: { generated: 6, handmade: 6 },
  play: { generated: 12, handmade: 12 },
};

/** 生成器の検査に使う seed の数（1.4） */
export const SEED_COUNT = 1000;
/** 1つのキーが全体に占めてよい割合の上限（1.4） */
export const MAX_KEY_SHARE = 0.03;

export interface UnitReport {
  unitId: string;
  errors: string[];
  /** 異なる有効問題の数（同一性キー） */
  distinct: number;
  /** 量 Q = distinct ÷ 基準 */
  q: number;
  /** 到達項目ごとの充足（練習6問以上・別例・誤概念の説明） */
  objectives: { id: string; distinct: number; alt: number; ok: boolean }[];
  /** 網羅 C（そろった到達項目の数 / 全数） */
  c: [number, number];
  /** 誤概念IDの付いていない誤りの選択肢の割合（choice のみ。20%以下が条件） */
  genericWrongShare: number;
}

/** 文として扱わない項目（ID・キー・絵の名前・SVG・ローマ字の答えなど） */
const NON_TEXT_KEYS = new Set([
  'id',
  'identity',
  'engine',
  'objective',
  'misconception',
  'icon',
  'key',
  'svg',
  'markup',
  'kind',
  'shape',
  'tone',
  'layout',
]);

/**
 * 問題データの中の文を全部（エンジンの項目名に頼らない。どのエンジンでも漏れなく検査するため）。
 * かな・漢字を含む文字列だけを文とみなす。
 */
export function textsOf(x: unknown, out: string[] = [], key = ''): string[] {
  if (typeof x === 'string') {
    if (!NON_TEXT_KEYS.has(key) && /[ぁ-ゖァ-ヺ一-鿿]/.test(x)) out.push(x);
  } else if (Array.isArray(x)) {
    for (const v of x) textsOf(v, out, key);
  } else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) if (typeof v !== 'function') textsOf(v, out, k);
  }
  return out;
}

/** 問題データの中の誤概念IDを全部（項目名 misconception / reverseMisconception） */
export function misconceptionIdsOf(x: unknown, out: string[] = [], key = ''): string[] {
  if (typeof x === 'string') {
    if (key === 'misconception' || key === 'reverseMisconception') out.push(x);
  } else if (Array.isArray(x)) {
    for (const v of x) misconceptionIdsOf(v, out, key);
  } else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) misconceptionIdsOf(v, out, k);
  }
  return out;
}

/** 生成器なら seed 0..SEED_COUNT-1 × 各段階で生成した問題、手作りならその一覧 */
export function sampleItems(unit: UnitSpec, seeds = SEED_COUNT): Item[] {
  const src = unit.source;
  const out: Item[] = [...(src.items ?? [])];
  if (src.kind === 'generator') {
    for (let level = 0; level < unit.levels.length; level++) {
      for (let s = 0; s < seeds; s++) {
        out.push(
          src.generate({ level, rng: createRng(hashSeed('qa', unit.id, level, s)), index: s % 8 }),
        );
      }
    }
  }
  return out;
}

export function checkUnit(unit: UnitSpec, opts: { seeds?: number } = {}): UnitReport {
  const errors: string[] = [];
  const err = (m: string) => {
    if (errors.length < 200) errors.push(m);
  };
  const preschool = unit.stage.startsWith('p');
  const objIds = new Set(unit.objectives.map((o) => o.id));
  const misIds = new Set(unit.misconceptions.map((m) => m.id));

  // 単元の形
  if (!/^(p23|p4|p5|g[1-6])\.[a-z]+\.[a-z0-9-]+$/.test(unit.id))
    err(`単元IDの形が違う: ${unit.id}`);
  if (!unit.id.startsWith(`${unit.stage}.${unit.subject}.`))
    err('単元IDと stage・subject が一致しない');
  if (unit.objectives.length < 1 || unit.objectives.length > 8) err('到達項目は1〜8個');
  if (unit.levels.length < 1) err('段階が無い');

  // v1 のモードの単元: 中身は v1 のモードとそのテストが受け持つ。参照の正しさだけを見る
  if (unit.source.kind === 'legacy') {
    const lg = unit.source.legacy;
    const mode = MODE_BY_ID[lg.modeId];
    if (!mode) err(`v1 のモード ${lg.modeId} が無い`);
    for (const v of lg.variants ?? [])
      if (mode && !mode.variants.some((x) => x.id === v))
        err(`v1 の遊び方 ${lg.modeId}/${v} が無い`);
    if (lg.levelRange && lg.levelRange[0] > lg.levelRange[1]) err('段階の範囲が逆');
    return {
      unitId: unit.id,
      errors,
      distinct: 0,
      q: 1,
      objectives: unit.objectives.map((o) => ({ id: o.id, distinct: 0, alt: 0, ok: true })),
      c: [unit.objectives.length, unit.objectives.length],
      genericWrongShare: 0,
    };
  }
  if (unit.intro.length < 1 && unit.kind !== 'record') err('導入（おてほん）が無い');
  const needMis = unit.kind === 'calc' || unit.kind === 'concept' ? 3 : 2;
  if (
    !preschool &&
    unit.kind !== 'record' &&
    unit.kind !== 'writing' &&
    unit.misconceptions.length < needMis
  )
    err(`誤概念が${needMis}つ未満`);
  for (const t of [
    unit.title,
    ...unit.intro.map((s) => s.text),
    ...unit.misconceptions.map((m) => m.explain),
  ])
    for (const k of findBareKanji(t)) err(`よみの無い漢字「${k}」: ${t.slice(0, 30)}`);

  // 問題
  const items = sampleItems(unit, opts.seeds);
  const keyCount = new Map<string, number>();
  const perObj = new Map<string, { keys: Set<string>; alt: Set<string> }>();
  let wrongOpts = 0;
  let genericWrong = 0;
  const seenItemErr = new Set<string>();
  for (const it of items) {
    const itemErr = (m: string) => {
      const k = `${it.identity}:${m}`;
      if (!seenItemErr.has(k)) {
        seenItemErr.add(k);
        err(`[${it.id}] ${m}`);
      }
    };
    if (!objIds.has(it.objective)) itemErr(`到達項目 ${it.objective} が無い`);
    if (it.level < 0 || it.level >= unit.levels.length) itemErr(`段階 ${it.level} が範囲外`);
    const needHints = preschool ? 2 : 3;
    if (it.hints.length !== needHints) itemErr(`ヒントは${needHints}段階（今 ${it.hints.length}）`);
    if (!it.explain.trim()) itemErr('解説が無い');
    for (const t of textsOf(it))
      for (const k of findBareKanji(t)) itemErr(`よみの無い漢字「${k}」`);
    for (const m of engineOf(it).check(it)) itemErr(m);
    // 誤概念IDが定義にあるか（全エンジン共通）
    for (const m of misconceptionIdsOf(it)) if (!misIds.has(m)) itemErr(`誤概念 ${m} が定義に無い`);
    // 汎用の誤答応答の割合（誤りの選択肢を持つ choice で数える）
    if (it.engine === 'choice') {
      for (const o of it.options) {
        if (o.correct) continue;
        wrongOpts++;
        if (!o.misconception) genericWrong++;
      }
    }
    keyCount.set(it.identity, (keyCount.get(it.identity) ?? 0) + 1);
    const o = perObj.get(it.objective) ?? { keys: new Set(), alt: new Set() };
    (it.alt ? o.alt : o.keys).add(it.identity);
    perObj.set(it.objective, o);
  }

  // 偏り（生成器のみ, 1.4）。段階ごとに数える。段階の定義域が小さい（例: 和5まで＝11通り）ときは
  // 3% が成り立たないので、上限を max(3%, 2 ÷ その段階のキーの数) とする（均等の2倍まで）。
  if (unit.source.kind === 'generator') {
    for (let level = 0; level < unit.levels.length; level++) {
      const at = items.filter(
        (it) => it.level === level && !(unit.source.items ?? []).includes(it),
      );
      const cnt = new Map<string, number>();
      for (const it of at) cnt.set(it.identity, (cnt.get(it.identity) ?? 0) + 1);
      const limit = Math.max(MAX_KEY_SHARE, 2 / cnt.size);
      for (const [k, n] of cnt)
        if (n / at.length > limit)
          err(
            `段階${level}: 同一性キー ${k} が ${((n / at.length) * 100).toFixed(1)}% を占める（上限 ${(limit * 100).toFixed(1)}%）`,
          );
    }
  }

  const distinct = keyCount.size;
  const base = QUANTITY_BASE[unit.kind];
  const n =
    unit.source.kind === 'generator'
      ? Math.min(base.generated, unit.source.domainSize ?? Infinity)
      : base.handmade;
  const objectives = unit.objectives.map((ob) => {
    const o = perObj.get(ob.id);
    const d = o?.keys.size ?? 0;
    const alt = o?.alt.size ?? 0;
    return { id: ob.id, distinct: d, alt, ok: d >= 6 && alt >= 3 };
  });
  return {
    unitId: unit.id,
    errors,
    distinct,
    q: distinct / n,
    objectives,
    c: [objectives.filter((o) => o.ok).length, objectives.length],
    genericWrongShare: wrongOpts === 0 ? 0 : genericWrong / wrongOpts,
  };
}

/** 「実装済み」（ready）の条件: 検査の誤りなし・Q≥1・C 全部・汎用の誤答応答 20% 以下 */
export function isReady(r: UnitReport): boolean {
  return r.errors.length === 0 && r.q >= 1 && r.c[0] === r.c[1] && r.genericWrongShare <= 0.2;
}
