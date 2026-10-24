/**
 * p5.think.pattern きまり（つづき）（curriculum-matrix 3.3・4.4）: 2つが かわる きまり、かずの ならび。
 * - one: ABC・ABB・AABB など 1つの きまり（別例: 音の きまり）
 * - two: かたち と おおきさ（別例: かたち と もよう）が べつべつに かわる きまり。色だけでは区別しない
 * - number: 1・2・3・？／2・4・6・？／5・4・3・？（任意の発展。別例: てんの かず）
 * 同一性キー（1.4。形の絵柄は同じ）: one:型:長さ、two:形の周期:2つめの周期:長さ、num:はじめ:ふえかた。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import type { ListenItem } from '../../engines/listen/listen';
import { mix } from './lib';

type Sh = 'circle' | 'triangle' | 'square' | 'star';
const SHAPES: Sh[] = ['circle', 'triangle', 'square', 'star'];
const NAME: Record<Sh, string> = {
  circle: 'まる',
  triangle: 'さんかく',
  square: 'しかく',
  star: 'ほし',
};
const FILL: Record<Sh, string> = {
  circle: 'var(--sky)',
  triangle: 'var(--leaf)',
  square: 'var(--wood)',
  star: 'var(--sun)',
};
const ST = 'stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round"';

interface Cell {
  s: Sh;
  /** 0: おおきい 1: ちいさい（two）／ 0: ぬり 1: しま（two の別例） */
  v: number;
  mode: 'size' | 'stripe' | 'none';
}
function cellSvg(c: Cell, x: number): string {
  const k = c.mode === 'size' && c.v === 1 ? 0.55 : 1;
  const cx = x + 25;
  const cy = 25;
  const fill = c.mode === 'stripe' && c.v === 1 ? 'var(--paper)' : FILL[c.s];
  let shape: string;
  switch (c.s) {
    case 'circle':
      shape = `<circle cx="${cx}" cy="${cy}" r="${19 * k}" fill="${fill}" ${ST}/>`;
      break;
    case 'triangle':
      shape = `<polygon points="${cx},${cy - 20 * k} ${cx + 20 * k},${cy + 19 * k} ${cx - 20 * k},${cy + 19 * k}" fill="${fill}" ${ST}/>`;
      break;
    case 'square':
      shape = `<rect x="${cx - 18 * k}" y="${cy - 18 * k}" width="${36 * k}" height="${36 * k}" fill="${fill}" ${ST}/>`;
      break;
    case 'star': {
      const p = Array.from({ length: 10 }, (_, i) => {
        const r = (i % 2 ? 9 : 21) * k;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + 1 + r * Math.sin(a)).toFixed(1)}`;
      }).join(' ');
      shape = `<polygon points="${p}" fill="${fill}" ${ST}/>`;
    }
  }
  const stripes =
    c.mode === 'stripe' && c.v === 1
      ? `<path d="M${cx - 14} ${cy - 6} H${cx + 14} M${cx - 16} ${cy + 2} H${cx + 16} M${cx - 14} ${cy + 10} H${cx + 14}" stroke="var(--ink)" stroke-width="2.5"/>`
      : '';
  return shape + stripes;
}
const cellName = (c: Cell) =>
  c.mode === 'size'
    ? `${c.v ? 'ちいさい' : 'おおきい'} ${NAME[c.s]}`
    : c.mode === 'stripe'
      ? `${c.v ? 'しまの' : 'ぬった'} ${NAME[c.s]}`
      : NAME[c.s];
const blank = (x: number) =>
  `<rect x="${x + 5}" y="5" width="40" height="40" rx="8" fill="var(--paper)" stroke="var(--ink)" stroke-width="3" stroke-dasharray="6 5"/><text x="${x + 25}" y="34" font-size="26" text-anchor="middle" fill="var(--ink)">？</text>`;
const seqFig = (cells: Cell[]): Figure => ({
  kind: 'svg',
  label: `${cells.map(cellName).join('、')}、なに？`,
  markup: `<svg viewBox="0 0 ${(cells.length + 1) * 50} 50" xmlns="http://www.w3.org/2000/svg">${cells.map((c, i) => cellSvg(c, i * 50)).join('')}${blank(cells.length * 50)}</svg>`,
});
const oneFig = (c: Cell): Figure => ({
  kind: 'svg',
  label: cellName(c),
  markup: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">${cellSvg(c, 0)}</svg>`,
});

type Task =
  | { k: 'one'; type: string; len: number; sound: boolean }
  | { k: 'two'; sp: number; vp: number; len: number; mode: 'size' | 'stripe' }
  | { k: 'num'; start: number; step: number; dots: boolean };

const ONE_TYPES = ['ABC', 'ABB', 'AAB', 'AABB', 'ABCC', 'ABAC'];
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const LEVEL_T: Task[][] = [
  [
    ...ONE_TYPES.flatMap((type) =>
      range(type.length + 2, 8).map((len) => ({ k: 'one', type, len, sound: false }) as Task),
    ),
    ...['ABC', 'ABB', 'AABB'].flatMap((type) =>
      [type.length * 2, type.length * 2 + 1].map(
        (len) => ({ k: 'one', type, len, sound: true }) as Task,
      ),
    ),
  ],
  [
    ...[2, 3].flatMap((sp) =>
      [2].flatMap((vp) =>
        range(4, 7).map((len) => ({ k: 'two', sp, vp, len, mode: 'size' }) as Task),
      ),
    ),
    ...[3].flatMap((sp) =>
      [1].flatMap(() =>
        range(5, 7).map((len) => ({ k: 'two', sp, vp: 3, len, mode: 'size' }) as Task),
      ),
    ),
    ...[2, 3].flatMap((sp) =>
      range(5, 6).map((len) => ({ k: 'two', sp, vp: 2, len, mode: 'stripe' }) as Task),
    ),
  ],
  [
    ...range(1, 6).flatMap((start) =>
      [1, 2].map((step) => ({ k: 'num', start, step, dots: false }) as Task),
    ),
    ...range(5, 9).map((start) => ({ k: 'num', start, step: -1, dots: false }) as Task),
    ...range(1, 4).map((start) => ({ k: 'num', start, step: 1, dots: true }) as Task),
  ],
];

const SOUND = ['ぱん', 'ぽん', 'ぴん'];

function make(t: Task, level: number, rng: Rng): Item {
  if (t.k === 'num') {
    const seq = range(0, 3).map((i) => t.start + i * t.step);
    const ans = t.start + 4 * t.step;
    const key = `num:${t.start}:${t.step}${t.dots ? ':dots' : ''}`;
    const out: ChoiceOption[] = [{ label: String(ans), correct: true }];
    const add = (v: number, mis: string) => {
      if (v >= 0 && !out.some((o) => o.label === String(v)) && out.length < 4)
        out.push({ label: String(v), misconception: mis });
    };
    add(seq[3]!, 'repeat-prev');
    add(t.step === 2 ? ans - 1 : t.step === 1 ? ans + 1 : ans - 1, 'step-wrong');
    add(t.step === -1 ? seq[3]! + 1 : ans + 2, 'step-wrong');
    const dotsSvg = (n: number, x: number) =>
      range(0, n - 1)
        .map(
          (i) =>
            `<circle cx="${x + 12 + (i % 3) * 13}" cy="${12 + Math.floor(i / 3) * 13}" r="5" fill="var(--ink)"/>`,
        )
        .join('');
    return {
      engine: 'choice',
      id: key,
      objective: 'number',
      level,
      alt: t.dots,
      prompt: t.dots
        ? 'てんの かずの きまり。つぎは いくつ？'
        : 'かずの ならびの きまり。つぎは いくつ？',
      figure: t.dots
        ? {
            kind: 'svg',
            label: seq.join('、'),
            markup: `<svg viewBox="0 0 250 50" xmlns="http://www.w3.org/2000/svg">${seq.map((n, i) => `<rect x="${i * 50 + 3}" y="3" width="44" height="44" rx="6" fill="var(--paper)" stroke="var(--ink)" stroke-width="3"/>${dotsSvg(n, i * 50 + 3)}`).join('')}${blank(200)}</svg>`,
          }
        : { kind: 'text', text: `${seq.join('、')}、？`, size: 'xl' },
      hints: [
        'となりの かずと くらべて みよう。',
        t.step === 2
          ? 'ひとつ とばしで ふえて いるよ。'
          : t.step === 1
            ? 'ひとつずつ ふえて いるよ。'
            : 'ひとつずつ へって いるよ。',
      ],
      explain: `${[...seq, ans].join('、')}。${t.step > 0 ? `${t.step}ずつ ふえる` : '1ずつ へる'} きまり だね。`,
      identity: key,
      options: mix(key, out),
    };
  }
  if (t.k === 'one' && t.sound) {
    const sym = (i: number) => SOUND['ABC'.indexOf(t.type[i % t.type.length]!)]!;
    const ans = sym(t.len);
    const prev = sym(t.len - 1);
    const key = `sound:${t.type}:${t.len}`;
    const opts: ChoiceOption[] = [{ label: ans, correct: true }];
    for (const s of SOUND)
      if (s !== ans)
        opts.push({ label: s, misconception: s === prev ? 'repeat-prev' : 'pattern-skip' });
    const item: ListenItem = {
      engine: 'listen',
      id: key,
      objective: 'one',
      level,
      alt: true,
      prompt: 'おとの きまり。つぎの おとは どれ？',
      audio: range(0, t.len - 1).map((i) => ({ text: sym(i) })),
      gapMs: 450,
      hints: [
        'いっしょに いいながら きいて みよう。',
        `「${range(0, t.type.length - 1)
          .map(sym)
          .join('・')}」の くりかえし だよ。`,
      ],
      explain: `${range(0, t.len).map(sym).join('・')}。つぎは「${ans}」。`,
      identity: key,
      options: mix(key, opts),
    };
    return item;
  }
  const els = rng.sample(SHAPES, 4) as Sh[];
  let cells: Cell[];
  let key: string;
  let objective: string;
  let alt = false;
  let hint2: string;
  if (t.k === 'one') {
    cells = range(0, t.len).map((i) => ({
      s: els['ABC'.indexOf(t.type[i % t.type.length]!)]!,
      v: 0,
      mode: 'none',
    }));
    key = `one:${t.type}:${t.len}`;
    objective = 'one';
    hint2 = `「${range(0, t.type.length - 1)
      .map((i) => NAME[cells[i]!.s])
      .join('・')}」の くりかえし だよ。`;
  } else {
    // かたちは sp ごと、おおきさ（もよう）は vp ごとに くりかえす（vp 3 は「おおきい・おおきい・ちいさい」）
    cells = range(0, t.len).map((i) => ({
      s: els[i % t.sp]!,
      v: t.vp === 3 ? (i % 3 === 2 ? 1 : 0) : i % 2,
      mode: t.mode,
    }));
    key = `two:${t.sp}:${t.vp}:${t.len}:${t.mode}`;
    objective = 'two';
    alt = t.mode === 'stripe';
    hint2 =
      t.mode === 'size'
        ? 'かたちと おおきさを べつべつに みよう。'
        : 'かたちと もようを べつべつに みよう。';
  }
  const ans = cells[t.len]!;
  const shown = cells.slice(0, t.len);
  const same = (a: Cell, b: Cell) => a.s === b.s && a.v === b.v;
  const opts: ChoiceOption[] = [{ label: cellName(ans), figure: oneFig(ans), correct: true }];
  const push = (c: Cell, mis: string) => {
    if (!opts.some((o) => o.label === cellName(c)) && opts.length < 4)
      opts.push({ label: cellName(c), figure: oneFig(c), misconception: mis });
  };
  if (t.k === 'two') {
    push({ ...ans, v: 1 - ans.v }, 'one-attr');
    push({ ...shown[t.len - 1]!, v: ans.v }, 'one-attr');
  }
  push(shown[t.len - 1]!, 'repeat-prev');
  for (const c of shown) if (!same(c, ans)) push(c, 'pattern-skip');
  push(
    { s: els.find((s) => !shown.some((c) => c.s === s))!, v: ans.v, mode: ans.mode },
    'not-in-pattern',
  );
  return {
    engine: 'choice',
    id: `${key}:${els.join('-')}`,
    objective,
    level,
    alt,
    prompt: 'きまりを みつけよう。？に はいるのは どれ？',
    figure: seqFig(shown),
    hints: ['はじめから ゆびで さしながら いって みよう。', hint2],
    explain: `${[...shown, ans].map(cellName).join('、')}。？は ${cellName(ans)}。`,
    identity: key,
    options: mix(`${key}:${els.join('-')}`, opts),
  };
}

export function generatePattern(level: number, rng: Rng): Item {
  const ts = LEVEL_T[Math.min(level, LEVEL_T.length - 1)]!;
  return make(ts[rng.int(0, ts.length - 1)]!, level, rng);
}

const DOMAIN = LEVEL_T.flat().length;

export const patternUnit: UnitSpec = {
  id: 'p5.think.pattern',
  title: 'きまり（つづき）',
  stage: 'p5',
  subject: 'think',
  domain: 'play',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-sorting',
  prereq: ['p4.think.pattern'],
  objectives: [
    { id: 'one', title: 'ひとつの きまり（ABC・ABB など）' },
    { id: 'two', title: 'ふたつが かわる きまり' },
    { id: 'number', title: 'かずの ならびの きまり' },
  ],
  misconceptions: [
    {
      id: 'repeat-prev',
      explain: 'すぐ まえと おなじに したのかな。はじめから くりかえしを たしかめよう。',
    },
    {
      id: 'pattern-skip',
      explain: 'くりかえしの じゅんばんが ずれたかな。はじめから いって みよう。',
    },
    { id: 'not-in-pattern', explain: 'ならびに ない ものだね。ならびの なかから えらぼう。' },
    {
      id: 'one-attr',
      explain:
        'かたちは あって いるかな、おおきさ（もよう）は あって いるかな。ふたつとも みよう。',
    },
    {
      id: 'step-wrong',
      explain: 'ふえかた（へりかた）が ちがったかな。となりどうしの ちがいを みよう。',
    },
  ],
  levels: [
    { label: 'ひとつの きまり', chance: 1 / 4 },
    { label: 'ふたつが かわる きまり', chance: 1 / 4 },
    { label: 'かずの ならび（はってん）', chance: 1 / 4 },
  ],
  intro: [
    {
      text: 'まる、さんかく、しかく、まる、さんかく…。つぎは しかく。',
      figure: seqFig(
        ['circle', 'triangle', 'square', 'circle', 'triangle'].map((s) => ({
          s: s as Sh,
          v: 0,
          mode: 'none',
        })),
      ),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng }) => generatePattern(level, rng),
    domainSize: DOMAIN,
  },
  review: 'view',
  basis: '幼稚園教育要領 環境（法則性に気付く）、curriculum-matrix 3.3・4.4',
  revised: '2026-10-24',
};
