/**
 * g3-math の共通の部品（このパックの中だけで使う。他のパックは import しない）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceOption, NumberField } from '../../curriculum/types';

export type Wrong = { value: string; misconception: string };

/** 誤答の例の一覧を作る（正答と同じもの・重複・欄の数が合わないもの・負の数を除く） */
export function wrongList(
  correct: string,
  fields: number,
  cands: [string | number | null | undefined | false, string][],
): Wrong[] {
  const out: Wrong[] = [];
  for (const [v, m] of cands) {
    if (v === null || v === undefined || v === false) continue;
    const t = String(v);
    if (t === correct || t.split('|').length !== fields) continue;
    if (t.split('|').some((p) => p === '' || p.startsWith('-') || p === 'NaN' || p === 'Infinity'))
      continue;
    if (out.some((w) => w.value === t)) continue;
    out.push({ value: t, misconception: m });
  }
  return out;
}

/** 位の名前（右から。一の位・十の位…） */
export const PLACE = [
  '一《いち》',
  '十《じゅう》',
  '百《ひゃく》',
  '千《せん》',
  '一万《いちまん》',
  '十万《じゅうまん》',
] as const;
export const placeName = (i: number) => `${PLACE[i]}のくらい`;

/** 数 n を位ごとの欄（大きい位から）に分けた文字列（'1|2|5'）。欄が足りなければ null */
export function toFields(n: number, count: number): string | null {
  if (!Number.isInteger(n) || n < 0) return null;
  const s = String(n);
  if (s.length > count) return null;
  return s.padStart(count, '0').split('').join('|');
}

/** 筆算の答えの欄（大きい位から） */
export function placeFields(answer: number): NumberField[] {
  const s = String(answer);
  return s.split('').map((d, i) => ({
    label: placeName(s.length - 1 - i),
    answer: { kind: 'int', value: Number(d) },
  }));
}

/** 位ごとの数字（一の位から） */
export const digits = (n: number): number[] => String(n).split('').reverse().map(Number);
export const fromDigits = (ds: number[]): number =>
  Number(
    ds
      .slice()
      .reverse()
      .join('')
      .replace(/^0+(?=\d)/, ''),
  );

/**
 * 筆算の形の図（SVG。位をそろえて書く。答えの行は ？。fill を渡すと 答えの数を書く）。
 * rows: 上から書く数（2つ目以降の先頭に記号）。表（位の名前の見出し付き）で描くと、4〜6行で
 * 22u を こえた（text-layout の第4回）ので、罫線の 筆算（1行 2.5u）で小さく描く。
 * 位の名前は 答えの欄の名札（一のくらい…）に ある。
 * 字は 数字と 記号だけなので、行の外接が 小さい（字の高さの 1.12 倍）欧文の字体にする。
 * 本文の字体（外接が 1.45 倍）だと 行ごとの外接が 重なる（検査の overlap-text）。
 */
export function columnFigure(
  a: number,
  b: number,
  op: '＋' | '−' | '×',
  ansLen: number,
  extra: (number | string)[] = [],
  fill?: number,
): Figure {
  const width = Math.max(
    String(a).length,
    String(b).length,
    ansLen,
    ...extra.map((x) => String(x).length),
  );
  const cells = (n: number | string) => String(n).padStart(width, ' ').split('');
  const ans =
    fill === undefined
      ? Array.from({ length: width }, (_, i) => (i >= width - ansLen ? '？' : ' '))
      : cells(fill);
  const rows: { cs: string[]; line?: boolean }[] = [
    { cs: cells(a) },
    { cs: cells(b) },
    ...extra.map((x) => ({ cs: cells(x) })),
    { cs: ans },
  ];
  const lineAfter = new Set([1, ...(extra.length > 0 ? [rows.length - 2] : [])]);
  const PX = 2.4; // 1けたの幅
  const PY = 2.4; // 1行の高さ（字の外接は 1.12 倍。下の font-family で 行が重ならない）
  const FS = 2.0; // 字の大きさ（小3・小4 の補助の文字の最小 1.8u より大きく）
  const X0 = PX * 1.1; // 記号の列
  const W = X0 + width * PX + 0.4;
  const H = rows.length * PY + 0.8;
  let body = '';
  rows.forEach((r, ri) => {
    const y = ri * PY + PY * 0.78;
    r.cs.forEach((c, ci) => {
      if (c === ' ' || c === '\u3000') return;
      const q = c === '？';
      const ch = q ? '?' : c;
      body += `<text x="${(X0 + ci * PX + PX / 2).toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" font-size="${FS}" font-weight="${q ? 400 : 700}" fill="${q ? 'var(--ink-soft)' : 'var(--ink)'}">${ch}</text>`;
    });
    if (ri === 1)
      body += `<text x="${(PX * 0.5).toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" font-size="${FS}" font-weight="700" fill="var(--ink)">${op === '＋' ? '+' : op}</text>`;
    if (lineAfter.has(ri)) {
      const ly = (ri + 1) * PY + 0.1;
      body += `<line x1="0.2" y1="${ly.toFixed(2)}" x2="${(W - 0.2).toFixed(2)}" y2="${ly.toFixed(2)}" stroke="var(--ink)" stroke-width="0.25"/>`;
    }
  });
  return {
    kind: 'svg',
    label: `${a} ${op} ${b} の ひっさん`,
    markup: `<svg viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}" style="width:calc(var(--u) * ${W.toFixed(2)})" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif">${body}</svg>`,
  };
}

/** 定義域の配列から均等に1つ */
export function pickOne<T>(rng: Rng, arr: readonly T[]): T {
  return arr[rng.int(0, arr.length - 1)]!;
}

/** 段階の到達項目を均等に選ぶ（回の中の番号でずらす） */
export function pickObj<T>(rng: Rng, objs: readonly T[], index: number): T {
  return objs[(index + rng.int(0, objs.length - 1)) % objs.length]!;
}

/** 選択肢（正解1つ＋誤り）。label が重なるものは除く。4つまで */
export function opts(correct: string, wrongs: [string, string][]): ChoiceOption[] {
  const out: ChoiceOption[] = [{ label: correct, correct: true }];
  for (const [label, m] of wrongs) {
    if (out.some((o) => o.label === label)) continue;
    out.push({ label, misconception: m });
  }
  return out.slice(0, 4);
}

/** 小数（10分の1の整数 t）を文字列に。13 → '1.3'、10 → '1' */
export function tenths(t: number): string {
  const s = (t / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** 3けたごとの区切りなしの数を、万で区切った読みやすい文字（12345678 → '1234万5678'） */
export function manText(n: number): string {
  if (n < 10000) return String(n);
  const hi = Math.floor(n / 10000);
  const lo = n % 10000;
  return `${hi}万《まん》${lo === 0 ? '' : String(lo)}`;
}

/**
 * 「同じ数のまとまりを g こ ならべた」図（SVG。字は描かない）。まとまり1つを枠にして、
 * 中に 10 の棒（縦長）か 100 の板（正方形）を t 個ならべる。ブロックの絵を g × t 個
 * ならべると横に 56u になった（text-layout の第4回）ので、まとまりの枠で小さく描く。
 * 枠のならべ方（1行に何枠か・枠の中を何段か）は、いちばん大きく描ける組を選ぶ。
 */
export function bundleFigure(label: string, g: number, t: number, shape: 'bar' | 'plate'): Figure {
  const iw = shape === 'bar' ? 1.4 : 3;
  const ih = shape === 'bar' ? 3.4 : 3;
  const px = iw + 0.6;
  const py = ih + 0.6;
  const GAP = 2.6;
  let best: { k: number; perRow: number; cols: number; W: number; H: number } | null = null;
  for (const rows of [1, 2]) {
    const cols = Math.ceil(t / rows);
    const bw = cols * px + 0.6;
    const bh = Math.ceil(t / cols) * py + 0.6;
    for (let perRow = 1; perRow <= g; perRow++) {
      const rowsN = Math.ceil(g / perRow);
      const W = perRow * bw + (perRow - 1) * GAP;
      const H = rowsN * bh + (rowsN - 1) * GAP;
      const k = Math.min(1.4, 56 / W, 12 / H);
      if (!best || k > best.k + 1e-6) best = { k, perRow, cols, W, H };
    }
  }
  const { k, perRow, cols, W, H } = best!;
  const bw = cols * px + 0.6;
  const bh = Math.ceil(t / cols) * py + 0.6;
  let body = '';
  for (let i = 0; i < g; i++) {
    const x0 = (i % perRow) * (bw + GAP);
    const y0 = Math.floor(i / perRow) * (bh + GAP);
    body += `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" rx="0.9" fill="var(--paper)" stroke="var(--ink)" stroke-width="0.35"/>`;
    for (let j = 0; j < t; j++) {
      const x = x0 + 0.6 + (j % cols) * px;
      const y = y0 + 0.6 + Math.floor(j / cols) * py;
      body += `<rect x="${x}" y="${y}" width="${iw}" height="${ih}" rx="0.3" fill="${shape === 'bar' ? 'var(--sun)' : 'var(--sky)'}" stroke="var(--ink)" stroke-width="0.3"/>`;
    }
  }
  return {
    kind: 'svg',
    label,
    markup: `<svg viewBox="-0.3 -0.3 ${W + 0.6} ${H + 0.6}" style="width:calc(var(--u) * ${((W + 0.6) * k).toFixed(1)})" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  };
}
