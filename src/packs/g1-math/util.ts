/**
 * g1-math の単元で共有する小さな部品（パックの中だけで使う。他のパックは import しない）。
 * add-basic.ts は見本なので、ここを使わずに単独で書いてある（変えない）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceOption } from '../../curriculum/types';

export const REVISED = '2026-10-24';

/** 誤りの選択肢: [文, 誤概念ID] */
export type Wrong = readonly [label: string, misconception?: string];

/**
 * 正解1つと誤りから選択肢を作る（正解を先頭に書く。画面では並べ替える）。小1は4つまで（ux-by-age）。
 * 同じ文の誤りは1つにまとめ、正解と同じ文の誤りは捨てる。
 */
export function opts(correct: string, wrongs: readonly Wrong[], max = 4): ChoiceOption[] {
  const out: ChoiceOption[] = [{ label: correct, correct: true }];
  for (const [label, m] of wrongs) {
    if (out.length >= max) break;
    if (out.some((o) => o.label === label)) continue;
    out.push(m ? { label, misconception: m } : { label });
  }
  return out;
}

/**
 * 数の選択肢: 正解の数と、誤概念つきの誤りの数（範囲外・重複・正解と同じは捨てる）。
 * 足りなければ近い数（誤概念なし）で埋める。
 */
export function numberOpts(
  answer: number,
  wrongs: readonly (readonly [number, string])[],
  opt: { min?: number; max?: number; count?: number } = {},
): ChoiceOption[] {
  const min = opt.min ?? 0;
  const max = opt.max ?? Infinity;
  const count = opt.count ?? 4;
  const out: ChoiceOption[] = [{ label: String(answer), correct: true }];
  const used = new Set([answer]);
  for (const [v, m] of wrongs) {
    if (out.length >= count) break;
    if (used.has(v) || v < min || v > max || !Number.isInteger(v)) continue;
    used.add(v);
    out.push({ label: String(v), misconception: m });
  }
  for (let d = 2; out.length < Math.min(count, 3) && d < 50; d++) {
    for (const v of [answer + d, answer - d]) {
      if (out.length >= Math.min(count, 3)) break;
      if (used.has(v) || v < min || v > max) continue;
      used.add(v);
      out.push({ label: String(v) });
    }
  }
  return out;
}

/**
 * 「from から かぞえて いこう」のヒント③。答えの手前で止める（答えの数を書かない: curriculum-matrix 1.2-5）。
 * answer が from の 2つ以上先のときは「from、from+1、…」と 途中までしか見せない。
 * 1つ先のときは数を書かず「1めもり（1つ）すすむ」とだけ言う。
 */
export function countUpHint(from: number, answer: number): string {
  const d = answer - from;
  if (d >= 2) return `${from}、${from + 1}、…と かぞえて いこう。`;
  if (d === 1) return `${from}の めもりから 1めもり すすんだ ところだよ。`;
  return `${from}の めもりを よく みよう。`;
}

/** 定義域（配列）から均等に1つ（生成のあとで数をずらさない: add-basic の pickPair と同じ考え） */
export function pickFrom<T>(rng: Rng, domain: readonly T[]): T {
  return domain[rng.int(0, domain.length - 1)]!;
}

/** 「けいさん しよう」の大きな式（{{}} が答えの欄の位置） */
export const expr = (text: string): Figure => ({ kind: 'text', text, size: 'xl' });

/** 10の棒と ばらの ブロック */
export const blocks = (n: number, frame = false): Figure =>
  n >= 10 && !frame
    ? { kind: 'blocks', tens: Math.floor(n / 10), ones: n % 10 }
    : { kind: 'blocks', ones: n, frame };

/**
 * 10の ぼうを 5ほんずつの まとまりで よこに ならべた ずと、ばらの ブロック（n は 0〜120）。
 * 文字を ふくまない ので、うちがわの だんの たかさ（7.7u）で かたちが きまる。
 * ざいりょうの え（engines/figure の blocks）は 10の ぼうが 20u の たかさに なり、
 * 問題文・回答欄と ならべると 図の段に はいらない（text-layout-fixes 第4回）ため、パックで えがく。
 * 100の いたは 1まい（100〜120。はばは ぼう 10ぽんぶん）。色・線は blocks と おなじ（sky の ぼう・sun の ばら）。
 */
export function tenBars(n: number): Figure {
  const H = 55; // ぼう・いたの たかさ（ばらは 5こ ぶん）
  const BW = 10; // ぼうの はば
  const hundreds = n >= 100 ? 1 : 0;
  const rest = n - hundreds * 100;
  const tens = Math.floor(rest / 10);
  const ones = rest % 10;
  const S = 'stroke="var(--ink)" stroke-width="1.5"';
  const G = 'stroke="var(--ink)" stroke-width="0.7"';
  const parts: string[] = [];
  let x = 1;
  if (hundreds) {
    // 100の いたは 10の ぼう 10ぽんぶんの はば（ます目を ぼうと おなじ 大きさに して「ぼう 10ぽんで 100」が みえるように）
    const PW = BW * 10;
    parts.push(`<rect x="${x}" y="1" width="${PW}" height="${H}" fill="var(--sky)" ${S}/>`);
    for (let k = 1; k < 10; k++) {
      parts.push(`<line x1="${x + BW * k}" y1="1" x2="${x + BW * k}" y2="${1 + H}" ${G}/>`);
      const y = 1 + (H * k) / 10;
      parts.push(`<line x1="${x}" y1="${y}" x2="${x + PW}" y2="${y}" ${G}/>`);
    }
    x += PW + 10;
  }
  for (let i = 0; i < tens; i++) {
    parts.push(`<rect x="${x}" y="1" width="${BW}" height="${H}" fill="var(--sky)" ${S}/>`);
    for (let k = 1; k < 10; k++) {
      const y = 1 + (H * k) / 10;
      parts.push(`<line x1="${x}" y1="${y}" x2="${x + BW}" y2="${y}" ${G}/>`);
    }
    x += BW + 3;
    if (i % 5 === 4 && i < tens - 1) x += 7; // 5ほんごとの すきま
  }
  if (tens > 0) x += 3;
  for (let i = 0; i < ones; i++) {
    const cx = x + Math.floor(i / 5) * 12 + 5.5;
    const cy = 1 + (i % 5) * 11 + 5.5;
    parts.push(`<circle cx="${cx}" cy="${cy}" r="4.8" fill="var(--sun)" ${S}/>`);
  }
  if (ones > 0) x += Math.ceil(ones / 5) * 12;
  const W = Math.max(x, 12) + 1;
  const label = [
    hundreds ? '100の いた 1まい' : '',
    tens ? `10の ぼう ${tens}ほん` : '',
    ones ? `ばら ${ones}こ` : '',
  ]
    .filter(Boolean)
    .join('、');
  return {
    kind: 'svg',
    label: `${n}を あらわす ブロック（${label || '0'}）`,
    markup:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + 2}" ` +
      `style="width:calc(var(--u) * ${(W * 0.14).toFixed(2)})">${parts.join('')}</svg>`,
  };
}
