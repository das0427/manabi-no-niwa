/**
 * 実験のシミュレーションの部品（純粋関数）。条件の値 → 例示の結果。
 * 結果は「この アプリの せってい」（単純な式・問題データの固定表）であり、実際の実験の代わりではない。
 *  pendulum … 1往復の時間 = 2π√(長さ ÷ 980cm/s²)（0.1秒に丸める）。重さ・振れ幅では変わらない（小さい振れ幅の近似）
 *  lever    … 左右の (支点からの位置 × 重さ) を比べる。大きい方が下がる。等しければつり合う
 *  circuit  … 乾電池の数とつなぎ方で流れる電流の強さ（1個=1、直列2個=2、並列2個=1）。向きを変えるとモーターは逆に回る
 *  table    … 条件の組 → 結果 の固定表（問題データ）
 */
import type { RichText } from '../../curriculum/types';
import type { Figure } from '../figure/types';

export type CondValue = number | string;
/** 条件（因子の id → 値） */
export type Cond = Record<string, CondValue>;

export interface TableFactor {
  id: string;
  label: RichText;
  values: { id: string; label: RichText }[];
}
export interface TableRow {
  /** 条件の組（因子の id → 値の id）。全部の因子を書く */
  when: Record<string, string>;
  result: RichText;
  /** 結果の見分け（reach の target に使う。省略時は result の文） */
  key?: string;
  /** 結果の絵 */
  figure?: Figure;
}

export type ExpSetup =
  | {
      kind: 'pendulum';
      /** ふりこの長さ（cm）の候補。1つだけなら固定 */
      length: number[];
      /** おもりの重さ（g） */
      weight: number[];
      /** 振れ幅（度。1〜45） */
      amplitude: number[];
    }
  | {
      kind: 'lever';
      /** 支点からの位置（目盛りの番号 1〜6）とおもりの重さ（g）。1つだけなら固定 */
      leftPos: number[];
      leftWeight: number[];
      rightPos: number[];
      rightWeight: number[];
    }
  | {
      kind: 'circuit';
      /** 豆電球（明るさ）かモーター（回る速さ・向き） */
      device: 'bulb' | 'motor';
      /** 乾電池の数（1・2） */
      cells: number[];
      /** つなぎ方（乾電池2個のとき） */
      connection: ('series' | 'parallel')[];
      /** 乾電池の向き（モーターの回る向き） */
      direction?: ('forward' | 'reverse')[];
    }
  | {
      kind: 'table';
      factors: TableFactor[];
      /** 結果の列の名前 */
      output: RichText;
      rows: TableRow[];
    };

export interface Factor {
  id: string;
  label: RichText;
  values: { v: CondValue; label: RichText }[];
}

export interface ExpResult {
  /** 結果の見分け（reach の target と比べる） */
  key: string;
  /** 結果の文（表に書く） */
  text: RichText;
  /** 絵に使う量（ふりこの周期・てこの傾き・電流の強さ） */
  amount?: number;
  figure?: Figure;
}

const cm = (v: number) => `${v}cm`;
const g = (v: number) => `${v}g`;

export const CIRCUIT_LABEL = {
  series: '直列《ちょくれつ》',
  parallel: '並列《へいれつ》',
  forward: 'はじめの 向《む》き',
  reverse: 'ぎゃく 向《む》き',
} as const;

/** 因子（条件の種類と、選べる値） */
export function factorsOf(s: ExpSetup): Factor[] {
  switch (s.kind) {
    case 'pendulum':
      return [
        { id: 'length', label: '長《なが》さ', values: s.length.map((v) => ({ v, label: cm(v) })) },
        { id: 'weight', label: '重《おも》さ', values: s.weight.map((v) => ({ v, label: g(v) })) },
        {
          id: 'amplitude',
          label: '振《ふ》れ幅《はば》',
          values: s.amplitude.map((v) => ({ v, label: `${v}°` })),
        },
      ];
    case 'lever':
      return [
        {
          id: 'leftPos',
          label: 'ひだりの 位置《いち》',
          values: s.leftPos.map((v) => ({ v, label: String(v) })),
        },
        {
          id: 'leftWeight',
          label: 'ひだりの 重《おも》さ',
          values: s.leftWeight.map((v) => ({ v, label: g(v) })),
        },
        {
          id: 'rightPos',
          label: 'みぎの 位置《いち》',
          values: s.rightPos.map((v) => ({ v, label: String(v) })),
        },
        {
          id: 'rightWeight',
          label: 'みぎの 重《おも》さ',
          values: s.rightWeight.map((v) => ({ v, label: g(v) })),
        },
      ];
    case 'circuit': {
      const fs: Factor[] = [
        {
          id: 'cells',
          label: '乾電池《かんでんち》',
          values: s.cells.map((v) => ({ v, label: `${v}こ` })),
        },
        {
          id: 'connection',
          label: 'つなぎ方《かた》',
          values: s.connection.map((v) => ({ v, label: CIRCUIT_LABEL[v] })),
        },
      ];
      if (s.direction)
        fs.push({
          id: 'direction',
          label: '電池《でんち》の 向《む》き',
          values: s.direction.map((v) => ({ v, label: CIRCUIT_LABEL[v] })),
        });
      return fs;
    }
    case 'table':
      return s.factors.map((f) => ({
        id: f.id,
        label: f.label,
        values: f.values.map((x) => ({ v: x.id, label: x.label })),
      }));
  }
}

/** 因子が意味を持つか（乾電池1個のときは つなぎ方 を選べない） */
export function factorActive(s: ExpSetup, id: string, c: Cond): boolean {
  if (s.kind === 'circuit' && id === 'connection') return c.cells === 2;
  return true;
}

/** ふりこの1往復の時間（秒。0.1秒に丸める） */
export function pendulumPeriod(lengthCm: number): number {
  return Math.round(2 * Math.PI * Math.sqrt(lengthCm / 980) * 10) / 10;
}

/** てこ: 左右のうでを傾けるはたらき（位置×重さ） */
export function leverMoments(c: Cond): { left: number; right: number } {
  return {
    left: Number(c.leftPos) * Number(c.leftWeight),
    right: Number(c.rightPos) * Number(c.rightWeight),
  };
}

/** 回路: 電流の強さ（乾電池1個 = 1） */
export function circuitCurrent(c: Cond): number {
  if (c.cells === 2) return c.connection === 'series' ? 2 : 1;
  return 1;
}

/** 条件の結果。表に無い組は null */
export function resultOf(s: ExpSetup, c: Cond): ExpResult | null {
  switch (s.kind) {
    case 'pendulum': {
      const t = pendulumPeriod(Number(c.length));
      const txt = t.toFixed(1);
      return { key: txt, text: `${txt}びょう`, amount: t };
    }
    case 'lever': {
      const m = leverMoments(c);
      if (m.left === m.right) return { key: 'balance', text: 'つりあう', amount: 0 };
      return m.left > m.right
        ? { key: 'left', text: 'ひだりが さがる', amount: -1 }
        : { key: 'right', text: 'みぎが さがる', amount: 1 };
    }
    case 'circuit': {
      const i = circuitCurrent(c);
      const rev = c.direction === 'reverse';
      if (s.device === 'bulb')
        return i >= 2
          ? { key: 'bright', text: 'あかるい', amount: i }
          : { key: 'normal', text: 'ふつう', amount: i };
      const speed = i >= 2 ? 'fast' : 'normal';
      const speedText = i >= 2 ? 'はやく まわる' : 'ふつうに まわる';
      if (!s.direction) return { key: speed, text: speedText, amount: i };
      return {
        key: `${speed}-${rev ? 'ccw' : 'cw'}`,
        text: `${speedText}（${rev ? 'ひだりまわり' : 'みぎまわり'}）`,
        amount: rev ? -i : i,
      };
    }
    case 'table': {
      const row = s.rows.find((r) => s.factors.every((f) => r.when[f.id] === c[f.id]));
      if (!row) return null;
      return { key: row.key ?? row.result, text: row.result, figure: row.figure };
    }
  }
}

/** 条件の組を全部（因子の値の直積。意味を持たない因子は最初の値に固定） */
export function allConds(s: ExpSetup): Cond[] {
  const fs = factorsOf(s);
  let out: Cond[] = [{}];
  for (const f of fs) {
    const next: Cond[] = [];
    for (const c of out)
      for (const x of f.values) {
        const nc = { ...c, [f.id]: x.v };
        next.push(nc);
      }
    out = next;
  }
  // 意味を持たない因子の違いだけの組は1つにまとめる
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = condKey(s, c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** 条件の見分け（意味を持たない因子は除く） */
export function condKey(s: ExpSetup, c: Cond): string {
  return factorsOf(s)
    .filter((f) => factorActive(s, f.id, c))
    .map((f) => `${f.id}=${c[f.id]}`)
    .join('&');
}

/** はじめの条件（initial で上書き。無ければ各因子の最初の値） */
export function initialCond(s: ExpSetup, initial?: Cond): Cond {
  const c: Cond = {};
  for (const f of factorsOf(s)) c[f.id] = initial?.[f.id] ?? f.values[0]?.v ?? '';
  return c;
}

/** 2つの条件で違う（意味を持つ）因子の id */
export function diffFactors(s: ExpSetup, a: Cond, b: Cond): string[] {
  return factorsOf(s)
    .filter((f) => (factorActive(s, f.id, a) || factorActive(s, f.id, b)) && a[f.id] !== b[f.id])
    .map((f) => f.id);
}

/** 結果の key の候補（reach の target の検査） */
export function resultKeys(s: ExpSetup): Set<string> {
  return new Set(
    allConds(s)
      .map((c) => resultOf(s, c)?.key)
      .filter((k): k is string => k !== undefined),
  );
}
