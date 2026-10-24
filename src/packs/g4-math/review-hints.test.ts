/**
 * 内容レビュー 中-B「ヒントが答えを言う」の再発防止（g4-math の div-2digit・fraction-same・
 * fraction-kinds・rounding・quadrilaterals）。全段階 × seed 320（index 0..7）で生成し、
 * ヒントの文字列に答え（number の各欄の数・分数の表記、choice の正解ラベル）がそのまま出ないことを確かめる。
 *
 * 数は「答えの位置」に出たものだけを見る（「＝ 8」「あまり 18」「1250以上」「まん中は 1250」など）。
 * 「28 − 14」の 14 が たまたま答えと同じ、のような 式の中の数は答えを教えていないので数えない。
 * 分数・選択肢の文字列は、問題文・式の図に もともと出ているものを除いて、どこに出ても誤りとする。
 */
import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '../../core/util/rng';
import type { Item, UnitSpec } from '../../curriculum/types';
import pack from './index';

const SEEDS = 320;

function itemsOf(unit: UnitSpec): Item[] {
  const src = unit.source;
  const out: Item[] = [];
  if (src.kind !== 'generator') return out;
  for (let level = 0; level < unit.levels.length; level++)
    for (let s = 0; s < SEEDS; s++)
      out.push(
        src.generate({
          level,
          rng: createRng(hashSeed('review-hints', unit.id, level, s)),
          index: s % 8,
        }),
      );
  return out;
}

/** よみ（《…》）を 外した 文 */
const plain = (s: string) => s.replace(/《[^》]*》/g, '');

/** 問題文と（絵でない）図の文字 */
function contextText(it: Item): string {
  const fig = (it as { figure?: { kind?: string } }).figure;
  const figText = fig && fig.kind !== 'svg' ? JSON.stringify(fig) : '';
  return plain(`${it.prompt} ${figText}`);
}

/** 数 n が「答えの位置」に出ている形 */
const resultRe = (n: string) =>
  new RegExp(`(?:＝|あまり|まん中は)\\s*${n}(?![\\d/])|(?<![\\d/])${n}\\s*(?:以上|未満|以下)`);

type Ans = { kind: string; value?: number; num?: number; den?: number };

/** ヒントに出てはいけない文字列と、答えの位置に出てはいけない数 */
function forbidden(it: Item): { strs: string[]; res: RegExp[] } {
  const strs: string[] = [];
  const res: RegExp[] = [];
  if (it.engine === 'number') {
    for (const f of it.fields) {
      const a = f.answer as Ans;
      if (a.kind === 'fraction') {
        const n = a.num!;
        const d = a.den!;
        res.push(resultRe(String(n)));
        // 単位分数（[[1/d]]）は「いくつ分」の考え方そのものなので、ヒントに出てよい
        if (n > 1) strs.push(`[[${n}/${d}]]`, `${n}/${d}`);
        if (n > d && n % d !== 0) {
          const w = Math.floor(n / d);
          const r = n % d;
          strs.push(`[[${w} ${r}/${d}]]`, `${w}と${r}/${d}`);
          // 仮分数 → 帯分数の わり算の 答え（商が整数の部分、あまりが分子）
          res.push(new RegExp(`＝\\s*${w}\\s*あまり\\s*${r}(?!\\d)`));
        }
      } else if (typeof a.value === 'number') res.push(resultRe(String(a.value)));
    }
  }
  if (it.engine === 'choice') {
    for (const o of it.options) {
      if (!o.correct || !o.label) continue;
      const label = plain(o.label);
      if (/^\d+$/.test(label)) res.push(resultRe(label));
      // 「同じ」は ヒントの ふつうの 言葉にも 出るので、文字列では 見ない（大小くらべは 下で 別に 見る）
      else if (label.length >= 2 && label !== '同じ') strs.push(label);
    }
  }
  return { strs, res };
}

function leaks(unit: UnitSpec, prefixes: string[]): string[] {
  const errs: string[] = [];
  let checked = 0;
  for (const it of itemsOf(unit)) {
    if (!prefixes.some((p) => it.id.startsWith(p))) continue;
    checked++;
    const { strs, res } = forbidden(it);
    const ctx = contextText(it);
    it.hints.map(plain).forEach((h, i) => {
      for (const s of strs)
        if (h.includes(s) && !ctx.includes(s))
          errs.push(`[${it.id}] ヒント${i + 1}に 答え「${s}」: ${h}`);
      for (const re of res)
        if (re.test(h)) errs.push(`[${it.id}] ヒント${i + 1}に 答え（${re.source}）: ${h}`);
    });
    // 大小くらべ: 帯分数を なおした 仮分数を ヒントで 見せると「同じ」「どっちが 大きい」が 決まる
    const m = /^compare(?:-alt)?:(\d+)\/(\d+):(\d+)-(\d+)$/.exec(it.id);
    if (m) {
      const den = Number(m[2]);
      const mixedVal = Number(m[3]) * den + Number(m[4]);
      const conv = `[[${mixedVal}/${den}]]`;
      const inPrompt = ctx.includes(conv) ? 1 : 0;
      for (const h of it.hints.map(plain))
        if (h.split(conv).length - 1 > inPrompt || resultRe(String(mixedVal)).test(h))
          errs.push(`[${it.id}] ヒントに なおした 仮分数 ${conv}: ${h}`);
    }
  }
  if (checked === 0) errs.push(`${unit.id}: ${prefixes.join(',')} の 問題が 1つも 出ない`);
  return [...new Set(errs)].slice(0, 20);
}

const CASES: [string, string[]][] = [
  ['g4.math.div-2digit', ['tens', 'story', 'rule:']],
  ['g4.math.fraction-same', ['addP', 'addM', 'subP', 'subM', 'story']],
  ['g4.math.fraction-kinds', ['toMixed', 'toImproper', 'compare']],
  ['g4.math.rounding', ['range']],
  ['g4.math.quadrilaterals', ['diag-alt']],
];

describe('g4-math: ヒントが 答えを そのまま 言わない（内容レビュー 中-B）', () => {
  for (const [id, prefixes] of CASES) {
    it(`${id}: ${prefixes.join('・')}`, () => {
      const unit = pack.units.find((u) => u.id === id);
      expect(unit).toBeDefined();
      expect(leaks(unit!, prefixes)).toEqual([]);
    });
  }
});
