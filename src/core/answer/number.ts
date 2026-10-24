/**
 * 数の答えの判定（docs/expansion/architecture.md 5.1, 要件 X-QA-03）。純粋関数。
 * 値は分数（整数の分子・分母）で正確に比べる。浮動小数点で比べない。
 */
export type NumberAnswer =
  | { kind: 'int'; value: number }
  | {
      kind: 'decimal';
      value: number;
      /** 小数点より下の桁数を指定する（例 1 なら 3 は「3.0」と書く）。省略時は桁数を問わない */
      places?: number;
    }
  | {
      kind: 'fraction';
      num: number;
      den: number;
      /** 約分が目標の単元: 約分していない等価な答えは「もう少し」 */
      mustReduce?: boolean;
      /** 仮分数を受け入れる（既定 true） */
      allowImproper?: boolean;
      /** 帯分数を受け入れる（既定 true） */
      allowMixed?: boolean;
      /** 小数の答え（0.5 など）も受け入れる（既定 false。5年の分数⇔小数以降で true） */
      allowDecimal?: boolean;
    }
  | {
      kind: 'quantity';
      value: number;
      unit: string;
      /** 換算して受け入れる単位（factor: 1 その単位 = factor 基準単位） */
      acceptUnits?: readonly { unit: string; factor: number }[];
      /** 許容誤差（概数・測定の単元だけ） */
      tolerance?: number;
    };

export interface Rational {
  n: number;
  d: number;
}

/** 入力の種類（帯分数・仮分数・小数・整数）。判定の細かな規則に使う */
export type InputForm = 'int' | 'decimal' | 'fraction' | 'mixed';

export interface ParsedNumber {
  value: Rational; // 約分済み・d>0
  form: InputForm;
  /** 入力どおりの分子・分母（分数・帯分数のとき。帯分数は仮分数に直した値） */
  raw?: { n: number; d: number };
  /** 小数の桁数 */
  places?: number;
  /** 帯分数の分数部分が分母以上（「1と4/3」など。値は同じでも帯分数の書き方として正しくない） */
  badMixed?: boolean;
}

export type Verdict =
  | { result: 'correct' }
  | { result: 'wrong'; misconception?: string }
  /** 誤答にしない。理由を示してもう一度入力してもらう */
  | { result: 'retry'; reason: 'reduce' | 'form' | 'unit' | 'unreadable' };

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function rational(n: number, d = 1): Rational {
  if (d === 0) throw new Error('den 0');
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export function eq(a: Rational, b: Rational): boolean {
  return a.n === b.n && a.d === b.d;
}

/** 有限小数・整数の number を分数に（例 0.25 → 1/4）。10桁まで */
export function fromNumber(x: number): Rational {
  if (Number.isInteger(x)) return rational(x, 1);
  const s = x.toFixed(10).replace(/0+$/, '');
  const places = s.length - s.indexOf('.') - 1;
  return rational(Math.round(x * 10 ** places), 10 ** places);
}

/** 全角→半角、空白の正規化、カンマ除去 */
export function normalizeInput(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[／]/g, '/')
    .replace(/[－ー−]/g, '-')
    .replace(/[,，、]/g, '')
    .replace(/\s+/g, ' ') // \s は全角空白も含む
    .trim();
}

/** 数の入力を読む。読めなければ null */
export function parseNumberInput(input: string): ParsedNumber | null {
  const s = normalizeInput(input);
  let m: RegExpExecArray | null;
  // 帯分数: "2 1/3" "2と1/3"
  if ((m = /^(-?)(\d+)\s*(?:と|\s)\s*(\d+)\s*\/\s*(\d+)$/.exec(s))) {
    const sign = m[1] ? -1 : 1;
    const w = Number(m[2]);
    const n = Number(m[3]);
    const d = Number(m[4]);
    if (d === 0) return null;
    const rn = sign * (w * d + n);
    return {
      value: rational(rn, d),
      form: 'mixed',
      raw: { n: rn, d },
      ...(n >= d ? { badMixed: true } : {}),
    };
  }
  // 分数: "3/4"
  if ((m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(s))) {
    const n = Number(m[1]);
    const d = Number(m[2]);
    if (d === 0) return null;
    return { value: rational(n, d), form: 'fraction', raw: { n, d } };
  }
  // 小数: "0.5" ".5" "0.50"
  if ((m = /^(-?)(\d*)\.(\d+)$/.exec(s))) {
    const places = m[3]!.length;
    const n = Number(`${m[2] || '0'}${m[3]}`) * (m[1] ? -1 : 1);
    return { value: rational(n, 10 ** places), form: 'decimal', places };
  }
  // 整数
  if (/^-?\d+$/.test(s)) {
    return { value: rational(Number(s), 1), form: 'int' };
  }
  return null;
}

/** 答えの値（分数） */
export function answerValue(a: NumberAnswer): Rational {
  switch (a.kind) {
    case 'int':
      return rational(a.value, 1);
    case 'decimal':
      return fromNumber(a.value);
    case 'fraction':
      return rational(a.num, a.den);
    case 'quantity':
      return fromNumber(a.value);
  }
}

/**
 * 判定する。unit は quantity のとき、子供が選んだ単位（問題が単位を固定表示するなら省略）。
 */
export function judgeNumber(answer: NumberAnswer, input: string, unit?: string): Verdict {
  const p = parseNumberInput(input);
  if (!p) return { result: 'retry', reason: 'unreadable' };
  const want = answerValue(answer);

  switch (answer.kind) {
    case 'int':
      return eq(p.value, want) ? { result: 'correct' } : { result: 'wrong' };

    case 'decimal': {
      if (!eq(p.value, want)) return { result: 'wrong' };
      // 小数で答える問題に分数で答えた: 値は合っているので形式だけ直してもらう
      if (p.form === 'fraction' || p.form === 'mixed') return { result: 'retry', reason: 'form' };
      // 桁数の指定（例「3.0」と 1/10 の位まで書く単元）: 値は合っているので形式だけ直してもらう
      if (answer.places !== undefined && (p.places ?? 0) !== answer.places)
        return { result: 'retry', reason: 'form' };
      return { result: 'correct' };
    }

    case 'fraction': {
      if (!eq(p.value, want)) return { result: 'wrong' };
      if (p.form === 'decimal' || p.form === 'int') {
        // 整数になる分数（4/2 など）は整数でよい
        if (p.form === 'int') return { result: 'correct' };
        return answer.allowDecimal ? { result: 'correct' } : { result: 'retry', reason: 'form' };
      }
      if (p.form === 'mixed' && answer.allowMixed === false)
        return { result: 'retry', reason: 'form' };
      // 「1と4/3」: 値は合っているが帯分数の書き方として正しくない → 形式を直してもらう
      if (p.badMixed) return { result: 'retry', reason: 'form' };
      if (p.form === 'fraction' && answer.allowImproper === false && Math.abs(p.raw!.n) >= p.raw!.d)
        return { result: 'retry', reason: 'form' };
      if (answer.mustReduce && p.raw) {
        // 帯分数は分数部分が約分済みかを見る
        const fracN = p.form === 'mixed' ? Math.abs(p.raw.n) % p.raw.d : Math.abs(p.raw.n);
        if (fracN !== 0 && gcd(fracN, p.raw.d) !== 1) return { result: 'retry', reason: 'reduce' };
      }
      return { result: 'correct' };
    }

    case 'quantity': {
      let factor = 1;
      if (unit !== undefined && unit !== answer.unit) {
        const u = answer.acceptUnits?.find((x) => x.unit === unit);
        if (!u) return { result: 'retry', reason: 'unit' };
        factor = u.factor;
      }
      // 換算: 入力 × factor（基準単位 answer.unit での値）
      const v = rational(p.value.n * toInt(factor).n, p.value.d * toInt(factor).d);
      if (answer.tolerance !== undefined) {
        const diff = Math.abs(v.n / v.d - want.n / want.d);
        return diff <= answer.tolerance + 1e-9 ? { result: 'correct' } : { result: 'wrong' };
      }
      return eq(v, want) ? { result: 'correct' } : { result: 'wrong' };
    }
  }
}

function toInt(x: number): Rational {
  return fromNumber(x);
}

/** 子供に見せる「もう一度」の理由（ひらがな） */
export const RETRY_MESSAGE: Record<'reduce' | 'form' | 'unit' | 'unreadable', string> = {
  reduce: 'あってるよ。もっと かんたんな ぶんすうに できるかな',
  form: 'あたいは あってるよ。もんだいの かたちで こたえてね',
  unit: 'たんいを たしかめてね',
  unreadable: 'すうじを たしかめてね',
};
