/**
 * g1.math.compare-quantity ながさ・ひろさ・かさの くらべかた（curriculum-matrix 3.4）。
 * 直接比較（はしを そろえる）→ いくつ分（めもり・クリップ・コップ）→ いくつ分で比べる → 広さ・かさ。
 *
 * 同一性キー: 問い方＋数値（2本の長さ・ずれ、いくつ分の数、ますの数）。上下・左右の入れかえ（正解の位置）は同じ（1.4）。
 * 図は svg（色はトークンの CSS 変数だけ）と measure のものさし・ます。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { MeasureItem } from '../../engines/measure/measure';
import type { ChoiceItem, ChoiceOption, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { REVISED } from './util';

type Obj = 'chokusetsu' | 'ikutsubun' | 'tani' | 'hirosa' | 'kasa';

const U = 24;
const INK = 'stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"';
const FILL = ['var(--sky)', 'var(--sun)'];
const label = (x: number, y: number, t: string) =>
  `<text x="${x}" y="${y}" font-size="28" font-weight="700" fill="var(--ink)" text-anchor="middle">${t}</text>`;
const svg = (w: number, h: number, body: string, lab: string): Figure => ({
  kind: 'svg',
  markup: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  label: lab,
});

// ---- 直接比較（よこの テープ・たての つみき） ----
interface Pair {
  len: [number, number];
  off: [number, number];
}

/** 2本の長さとずれ。そろえない ときは、みじかい ほうの はしが さきに でる（はしを そろえない誤りを見分ける） */
function makePair(rng: Rng, aligned: boolean): Pair {
  const a = rng.int(3, 11);
  let b = rng.int(3, 11);
  while (b === a) b = rng.int(3, 11);
  if (aligned) return { len: [a, b], off: [0, 0] };
  const s = Math.min(a, b);
  const l = Math.max(a, b);
  // みじかい方を o ずらして、はしが ながい方より さきに でる: o + s > l, o + s ≤ 13
  const o = rng.int(l - s + 1, Math.max(l - s + 1, 13 - s));
  if (a < b) return { len: [a, b], off: [o, 0] };
  return { len: [a, b], off: [0, o] };
}

function barsFig(p: Pair, vertical: boolean): Figure {
  if (!vertical) {
    const w = 50 + 14 * U;
    const body = [0, 1]
      .map((i) => {
        const y = 20 + i * 60;
        return `${label(20, y + 26, i === 0 ? 'あ' : 'い')}<rect x="${44 + p.off[i]! * U}" y="${y}" width="${p.len[i]! * U}" height="32" rx="4" fill="${FILL[i]}" ${INK}/>`;
      })
      .join('');
    return svg(w, 140, body, 'テープが 2ほん');
  }
  const h = 20 + 14 * U;
  const body = [0, 1]
    .map((i) => {
      const x = 40 + i * 110;
      const bottom = h - p.off[i]! * U;
      const step =
        p.off[i]! > 0
          ? `<rect x="${x - 10}" y="${bottom}" width="80" height="${p.off[i]! * U}" fill="var(--paper)" ${INK}/>`
          : '';
      return `${step}<rect x="${x}" y="${bottom - p.len[i]! * U}" width="60" height="${p.len[i]! * U}" rx="4" fill="${FILL[i]}" ${INK}/>${label(x + 30, h + 34, i === 0 ? 'あ' : 'い')}`;
    })
    .join('');
  return svg(260, h + 44, body, 'つみきの とうが 2つ');
}

function chokusetsu(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const aligned = rng.next() < 0.4;
  const p = makePair(rng, aligned);
  const askLong = rng.next() < 0.6;
  const word = alt ? (askLong ? 'たかい' : 'ひくい') : askLong ? 'ながい' : 'みじかい';
  const longer = p.len[0] > p.len[1] ? 0 : 1;
  const ans = askLong ? longer : 1 - longer;
  const names = ['あ', 'い'];
  const options: ChoiceOption[] = [
    { label: names[ans]!, correct: true },
    { label: names[1 - ans]!, misconception: aligned ? 'mis-reverse-ask' : 'mis-ends' },
    { label: 'おなじ', misconception: 'mis-same' },
  ];
  const id = `${alt ? 'tate' : 'yoko'}:${p.len.join('-')}:${p.off.join('-')}:${askLong ? 'l' : 's'}`;
  return {
    engine: 'choice',
    id,
    objective: 'chokusetsu',
    level,
    prompt: `${word}のは どっち？`,
    figure: barsFig(p, alt),
    hints: [
      alt ? 'したの はしが そろって いるか みよう。' : 'ひだりの はしが そろって いるか みよう。',
      alt
        ? 'だいに のって いる ぶんは たかさに いれないよ。つみきの ますを かぞえて みよう。'
        : 'はしが そろって いない ときは、テープの ながさ そのものを くらべよう。',
      // 答えの手前で止める: あの つぶんだけを言い、いは 自分で かぞえて くらべる
      `あは ${p.len[0]}つぶん。いは なんつぶん かな。かぞえて くらべよう。`,
    ],
    explain: `あは ${p.len[0]}つぶん、いは ${p.len[1]}つぶん。${word}のは ${names[ans]} だよ。${aligned ? '' : 'はしを そろえて くらべると よく わかるね。'}`,
    identity: id,
    alt,
    options,
    fixedOrder: true,
  };
}

// ---- いくつ分（ものさしの めもり・クリップ） ----
function ruler(level: number, rng: Rng): MeasureItem {
  // v: 2〜9、f: 0〜(10−v)（45通り）
  const all: [number, number][] = [];
  for (let v = 2; v <= 9; v++) for (let f = 0; f <= 10 - v; f++) all.push([v, f]);
  const [v, f] = all[rng.int(0, all.length - 1)]!;
  const id = `ruler:${v}@${f}`;
  return {
    engine: 'measure',
    id,
    objective: 'ikutsubun',
    level,
    prompt: 'テープの ながさは めもりの ます いくつぶん？',
    hints: [
      'テープの ひだりはしが どの めもりに あるか みよう。',
      'ひだりはしから みぎはしまで、めもりと めもりの あいだを かぞえよう。',
      f > 0
        ? `ひだりはしの めもりから 1、2、… と かぞえよう。`
        : '0の めもりから 1、2、… と かぞえよう。',
    ],
    explain: `テープは ${f}の めもりから ${f + v}の めもりまで。あいだの ますは ${v}こで、${v}ますぶん だよ。`,
    identity: id,
    instrument: 'ruler',
    scale: { unit: 'ます', min: 0, max: 10, minor: 1, mid: 5, major: 10 },
    task: 'read',
    value: v,
    from: f,
    misconceptions: f > 0 ? { fromEnd: 'mis-from-end' } : undefined,
    wrongAnswers: [{ value: v + 1, misconception: 'mis-count-lines' }],
  };
}

const UNITS = [
  { obj: 'えんぴつ', unit: 'クリップ', ko: 'こ' },
  { obj: 'つくえの よこ', unit: 'えんぴつ', ko: 'ほん' },
  { obj: 'ほんの たて', unit: 'けしごむ', ko: 'こ' },
];

function clips(level: number, rng: Rng): NumberItem {
  const n = rng.int(3, 10);
  const u = UNITS[rng.int(0, UNITS.length - 1)]!;
  const w = 20 + n * U * 1.5;
  const body =
    `<rect x="10" y="10" width="${n * U * 1.5}" height="30" rx="6" fill="var(--sun)" ${INK}/>` +
    Array.from(
      { length: n },
      (_, i) =>
        `<rect x="${12 + i * U * 1.5}" y="56" width="${U * 1.5 - 4}" height="22" rx="8" fill="var(--sky)" ${INK}/>`,
    ).join('');
  const id = `clips:${n}`;
  return {
    engine: 'number',
    id,
    objective: 'ikutsubun',
    level,
    prompt: `${u.obj}の ながさは ${u.unit} なん${u.ko === 'ほん' ? 'ぼん' : 'こ'}ぶん？`,
    figure: svg(w, 90, body, `${u.unit}が ならんで いる`),
    hints: [
      `したに ならんだ ${u.unit}を みよう。`,
      'はしから 1つずつ ゆびで おさえて かぞえよう。',
      '5まで かぞえたら、のこりを かぞえよう。',
    ],
    explain: `${u.unit} ${n}${u.ko}ぶんの ながさ だよ。`,
    explainFigure: { kind: 'blocks', ones: n },
    identity: id,
    alt: true,
    fields: [{ label: `${u.ko}ぶん`, answer: { kind: 'int', value: n } }],
    wrongAnswers: [
      { value: String(n + 1), misconception: 'mis-miscount' },
      { value: String(n - 1), misconception: 'mis-miscount' },
    ],
  };
}

// ---- いくつ分で比べる ----
function tani(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    // 大きい ブロック a こ（1こ ＝ 小さい 2こ）と 小さい ブロック b こ（a < b < 2a）
    const all: [number, number][] = [];
    for (let a = 2; a <= 5; a++) for (let b = a + 1; b < 2 * a; b++) all.push([a, b]);
    const [a, b] = all[rng.int(0, all.length - 1)]!;
    // 大きい ブロックの テープを あ・い のどちらに おくか（半々）。正答が いつも「あ」にならないように
    const bigIsA = rng.next() < 0.5;
    const row = (y: number, n: number, size: number, fill: string) =>
      Array.from(
        { length: n },
        (_, i) =>
          `<rect x="${44 + i * size * U}" y="${y}" width="${size * U}" height="30" fill="${fill}" ${INK}/>`,
      ).join('');
    const top = bigIsA
      ? row(16, a, 2, 'var(--sun)')
      : row(16, b, 1, 'var(--sky)');
    const bottom = bigIsA
      ? row(76, b, 1, 'var(--sky)')
      : row(76, a, 2, 'var(--sun)');
    const fig = svg(
      60 + 10 * U,
      130,
      `${label(20, 40, 'あ')}${top}${label(20, 100, 'い')}${bottom}`,
      'ブロックを ならべた テープ',
    );
    const big = bigIsA ? 'あ' : 'い';
    const small = bigIsA ? 'い' : 'あ';
    // id は あ・い の入れかえも区別する。同一性キー（identity）は入れかえを同じとみる（1.4: 正解の位置）
    const id = `tani-size:${a}-${b}:${big}`;
    return {
      engine: 'choice',
      id,
      objective: 'tani',
      level,
      prompt: `${big}は おおきい ブロック ${a}こ、${small}は ちいさい ブロック ${b}こ ぶんの ながさです。ながいのは どっち？`,
      figure: fig,
      hints: [
        'ブロックの おおきさは おなじかな。',
        'おおきい ブロック 1こは、ちいさい ブロック 2こ ぶん だよ。',
        `${big}を ちいさい ブロックで かぞえると ${a}こが 2つずつ…`,
      ],
      explain: `おおきい ブロック 1こは ちいさい ブロック 2こ ぶん。${big}は ちいさい ブロック ${2 * a}こ ぶんで、${small}の ${b}こ より ながいよ。`,
      identity: `tani-size:${a}-${b}`,
      alt: true,
      options: [
        // あ・い の順に固定して並べ、正答の印だけを入れかえる
        bigIsA
          ? { label: 'あ', correct: true }
          : { label: 'あ', misconception: 'mis-unit-size' },
        bigIsA
          ? { label: 'い', misconception: 'mis-unit-size' }
          : { label: 'い', correct: true },
        { label: 'おなじ', misconception: 'mis-same' },
      ],
      fixedOrder: true,
    };
  }
  const a = rng.int(2, 10);
  let b = rng.int(2, 10);
  while (b === a) b = rng.int(2, 10);
  const u = UNITS[rng.int(0, UNITS.length - 1)]!;
  const cnt = u.ko === 'ほん' ? 'ほん' : 'こ';
  const text = `たては ${u.unit} ${a}${cnt}ぶん、よこは ${b}${cnt}ぶん です。`;
  const hint1 = `おなじ ${u.unit}で はかって いるね。かずを くらべよう。`;
  if (rng.next() < 0.5) {
    const id = `tani-which:${a}-${b}`;
    const ans = a > b ? 'たて' : 'よこ';
    return {
      engine: 'choice',
      id,
      objective: 'tani',
      level,
      prompt: `${text}ながいのは どっち？`,
      hints: [
        hint1,
        `${u.unit}の かずが おおい ほうが ながいよ。`,
        `${a}と ${b}、おおきいのは どちらかな。`,
      ],
      explain: `${Math.max(a, b)}${cnt}ぶんの ${ans}の ほうが ながいよ。`,
      identity: id,
      options: [
        { label: ans, correct: true },
        { label: ans === 'たて' ? 'よこ' : 'たて', misconception: 'mis-reverse-ask' },
        { label: 'おなじ', misconception: 'mis-same' },
      ],
      fixedOrder: true,
    };
  }
  const id = `tani-diff:${a}-${b}`;
  const d = Math.abs(a - b);
  return {
    engine: 'number',
    id,
    objective: 'tani',
    level,
    prompt: `${text}ながい ほうは、${u.unit} なん${cnt === 'ほん' ? 'ぼん' : 'こ'}ぶん ながい？`,
    figure: {
      kind: 'column',
      items: [
        { kind: 'blocks', ones: a, tone: 'a' },
        { kind: 'blocks', ones: b, tone: 'b' },
      ],
    },
    hints: [
      hint1,
      'ちがいを もとめるので ひきざん だよ。',
      `${Math.max(a, b)} − ${Math.min(a, b)} を かんがえよう。`,
    ],
    explain: `${Math.max(a, b)} − ${Math.min(a, b)} ＝ ${d}。${d}${cnt}ぶん ながいよ。`,
    identity: id,
    fields: [{ label: `${cnt}ぶん`, answer: { kind: 'int', value: d } }],
    wrongAnswers: [
      { value: String(a + b), misconception: 'mis-add' },
      { value: String(Math.max(a, b)), misconception: 'mis-one-number' },
    ],
  };
}

// ---- ひろさ（ますの かず） ----
function gridFig(r: [number, number], c: [number, number]): Figure {
  const s = 30;
  const body = [0, 1]
    .map((i) => {
      const x0 = 20 + i * (7 * s + 20);
      let cells = '';
      for (let y = 0; y < r[i]!; y++)
        for (let x = 0; x < c[i]!; x++)
          cells += `<rect x="${x0 + x * s}" y="${50 + y * s}" width="${s}" height="${s}" fill="${FILL[i]}" ${INK}/>`;
      return `${label(x0 + (c[i]! * s) / 2, 36, i === 0 ? 'あ' : 'い')}${cells}`;
    })
    .join('');
  return svg(40 + 14 * s + 20, 60 + 5 * s, body, 'ますで できた かたちが 2つ');
}

function hirosa(level: number, rng: Rng, alt: boolean): Item {
  let r: [number, number];
  let c: [number, number];
  do {
    r = [rng.int(1, 5), rng.int(1, 5)];
    c = [rng.int(1, 7), rng.int(1, 7)];
  } while (r[0] * c[0] === r[1] * c[1] || r[0] * c[0] < 2 || r[1] * c[1] < 2);
  const A = [r[0] * c[0], r[1] * c[1]];
  const big = A[0]! > A[1]! ? 0 : 1;
  const longSide = (i: number) => Math.max(r[i]!, c[i]!);
  const key = `${r.join('x')}/${c.join('x')}`;
  const names = ['あ', 'い'];
  const hints = [
    'ますの かずを くらべよう。',
    `あは よこに ${c[0]}こが ${r[0]}だん、いは よこに ${c[1]}こが ${r[1]}だん だよ。`,
    'ますを 1つずつ かぞえて みよう。',
  ];
  if (!alt) {
    const wrongMis = longSide(1 - big) > longSide(big) ? 'mis-length-for-area' : 'mis-reverse-ask';
    const id = `area:${key}`;
    return {
      engine: 'choice',
      id,
      objective: 'hirosa',
      level,
      prompt: 'ひろいのは どっち？ ますの かずで くらべよう。',
      figure: gridFig(r, c),
      hints,
      explain: `あは ${A[0]}ます、いは ${A[1]}ます。ひろいのは ${names[big]} だよ。`,
      identity: id,
      options: [
        { label: names[big]!, correct: true },
        { label: names[1 - big]!, misconception: wrongMis },
        { label: 'おなじ', misconception: 'mis-same' },
      ],
      fixedOrder: true,
    };
  }
  const d = Math.abs(A[0]! - A[1]!);
  const id = `area-diff:${key}`;
  return {
    engine: 'number',
    id,
    objective: 'hirosa',
    level,
    prompt: 'ひろい ほうは、ます いくつぶん ひろい？',
    figure: gridFig(r, c),
    hints: [hints[0]!, hints[2]!, `${Math.max(...A)} − ${Math.min(...A)} を かんがえよう。`],
    explain: `あは ${A[0]}ます、いは ${A[1]}ます。${Math.max(...A)} − ${Math.min(...A)} ＝ ${d}で、${d}ますぶん ひろいよ。`,
    identity: id,
    alt: true,
    fields: [{ label: 'ますぶん', answer: { kind: 'int', value: d } }],
    wrongAnswers: [
      { value: String(A[0]! + A[1]!), misconception: 'mis-add' },
      { value: String(Math.max(...A)), misconception: 'mis-one-number' },
    ],
  };
}

// ---- かさ（コップ いくつ分） ----
function cupsFig(n: [number, number], tall: number): Figure {
  const cw = 26;
  const body = [0, 1]
    .map((i) => {
      const x0 = 20 + i * 230;
      // いれもの: tall の方は ほそくて たかい
      const w = i === tall ? 60 : 130;
      const h = i === tall ? 130 : 60;
      const box = `<rect x="${x0 + (200 - w) / 2}" y="${150 - h}" width="${w}" height="${h}" fill="var(--paper)" ${INK}/>`;
      const cups = Array.from({ length: n[i]! }, (_, k) => {
        const x = x0 + (k % 4) * (cw + 20);
        const y = 180 + Math.floor(k / 4) * 50;
        return `<path d="M${x} ${y} L${x + cw} ${y} L${x + cw - 4} ${y + 36} L${x + 4} ${y + 36} Z" fill="var(--sky)" ${INK}/>`;
      }).join('');
      return `${label(x0 + 100, 26, i === 0 ? 'あ' : 'い')}${box}${cups}`;
    })
    .join('');
  return svg(480, 290, body, 'いれもの 2つと コップ');
}

function kasa(level: number, rng: Rng, alt: boolean): Item {
  if (alt && rng.next() < 0.5) {
    const v = rng.int(2, 6);
    const id = `masu:${v}`;
    const item: MeasureItem = {
      engine: 'measure',
      id,
      objective: 'kasa',
      level,
      prompt: 'みずの かさは ます なんばいぶん？',
      hints: [
        'いっぱいに なった ますを みよう。',
        'ます 1つが 1ぱいぶん だよ。',
        'はしから 1つずつ かぞえよう。',
      ],
      explain: `ますが ${v}つ いっぱいで、${v}はいぶん だよ。`,
      identity: id,
      alt: true,
      instrument: 'masu',
      scale: { unit: 'はい', min: 0, max: 1, minor: 1, major: 1 },
      task: 'read',
      value: v,
      wrongAnswers: [
        { value: v + 1, misconception: 'mis-miscount' },
        { value: v - 1, misconception: 'mis-miscount' },
      ],
    };
    return item;
  }
  const a = rng.int(2, 8);
  let b = rng.int(2, 8);
  while (b === a) b = rng.int(2, 8);
  const n: [number, number] = [a, b];
  const big = a > b ? 0 : 1;
  // せが たかい いれものを、すくない ほうに する（見た目の誤りを見分ける）ことが多い
  const tall = rng.next() < 0.7 ? 1 - big : big;
  const names = ['あ', 'い'];
  const base = 'あと いの いれものの みずを、おなじ おおきさの コップに うつしました。';
  if (!alt) {
    const id = `kasa:${a}-${b}:${tall === big ? 'b' : 's'}`;
    return {
      engine: 'choice',
      id,
      objective: 'kasa',
      level,
      prompt: `${base}みずが おおいのは どっち？`,
      figure: cupsFig(n, tall),
      hints: [
        'いれものの かたちでは なく、コップの かずを みよう。',
        'コップが おおい ほうが、みずも おおいよ。',
        `あは コップ ${a}はい。いの コップも かぞえて くらべよう。`,
      ],
      explain: `あは コップ ${a}はい、いは ${b}はい。おおいのは ${names[big]} だよ。`,
      identity: id,
      options: [
        { label: names[big]!, correct: true },
        {
          label: names[1 - big]!,
          misconception: tall === 1 - big ? 'mis-tall-container' : 'mis-reverse-ask',
        },
        { label: 'おなじ', misconception: 'mis-same' },
      ],
      fixedOrder: true,
    };
  }
  const d = Math.abs(a - b);
  const id = `kasa-diff:${a}-${b}`;
  return {
    engine: 'number',
    id,
    objective: 'kasa',
    level,
    prompt: `${base}おおい ほうは、コップ なんばいぶん おおい？`,
    figure: cupsFig(n, tall),
    hints: [
      'コップの かずを くらべよう。',
      'ちがいを もとめるので ひきざん だよ。',
      `${Math.max(a, b)} − ${Math.min(a, b)} を かんがえよう。`,
    ],
    explain: `${Math.max(a, b)} − ${Math.min(a, b)} ＝ ${d}。コップ ${d}はいぶん おおいよ。`,
    identity: id,
    alt: true,
    fields: [{ label: 'はいぶん', answer: { kind: 'int', value: d } }],
    wrongAnswers: [
      { value: String(a + b), misconception: 'mis-add' },
      { value: String(Math.max(a, b)), misconception: 'mis-one-number' },
    ],
  };
}

const LEVELS: Obj[][] = [
  ['chokusetsu', 'tani'],
  ['ikutsubun', 'tani', 'kasa', 'chokusetsu'],
  ['hirosa', 'kasa', 'ikutsubun', 'tani'],
];

export function generateCompareQuantity(level: number, rng: Rng, index: number): Item {
  const objs = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = objs[(index + rng.int(0, objs.length - 1)) % objs.length]!;
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'chokusetsu':
      return chokusetsu(level, rng, alt);
    case 'ikutsubun':
      return alt ? clips(level, rng) : ruler(level, rng);
    case 'tani':
      return tani(level, rng, alt);
    case 'hirosa':
      return hirosa(level, rng, alt);
    case 'kasa':
      return kasa(level, rng, alt);
  }
}

export const compareQuantity: UnitSpec = {
  id: 'g1.math.compare-quantity',
  title: 'ながさ・ひろさ・かさ くらべ',
  stage: 'g1',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-compare',
  prereq: ['p5.math.measure-compare'],
  objectives: [
    { id: 'chokusetsu', title: 'はしを そろえて くらべる' },
    { id: 'ikutsubun', title: 'いくつぶんで あらわす' },
    { id: 'tani', title: 'いくつぶんで くらべる' },
    { id: 'hirosa', title: 'ひろさを くらべる' },
    { id: 'kasa', title: 'かさを くらべる' },
  ],
  misconceptions: [
    {
      id: 'mis-ends',
      explain:
        'はしが そろって いないのに、さきが でて いる ほうを えらんだのかな。はしを そろえてから くらべよう。',
    },
    {
      id: 'mis-reverse-ask',
      explain:
        'きかれて いる ことと はんたいの ほうを えらんだのかな。もんだいを もう いちど よもう。',
    },
    { id: 'mis-same', explain: 'おなじに みえたのかな。ますや かずを かぞえて たしかめよう。' },
    {
      id: 'mis-from-end',
      explain:
        'テープの みぎはしの めもりを そのまま よんだのかな。テープは 0から はじまって いないよ。ひだりはしから かぞえよう。',
    },
    {
      id: 'mis-count-lines',
      explain: 'めもりの せんを かぞえたのかな。せんと せんの あいだ（ます）を かぞえよう。',
    },
    {
      id: 'mis-miscount',
      explain: 'かぞえる ときに 1つ ずれたのかな。ゆびで おさえながら かぞえよう。',
    },
    {
      id: 'mis-unit-size',
      explain:
        'かずが おおい ほうが ながいと かんがえたのかな。はかる ものの おおきさが ちがうと、かずだけでは くらべられないよ。',
    },
    {
      id: 'mis-length-for-area',
      explain: 'ながい ほうが ひろいと かんがえたのかな。ひろさは ますの かずで くらべよう。',
    },
    {
      id: 'mis-tall-container',
      explain:
        'せが たかい いれものの ほうが おおいと かんがえたのかな。おなじ コップに うつした かずで くらべよう。',
    },
    { id: 'mis-add', explain: 'ふたつの かずを たしたのかな。「いくつ ちがう」は ひきざん だよ。' },
    {
      id: 'mis-one-number',
      explain: 'おおきい ほうの かずを そのまま かいたのかな。ちがいを もとめよう。',
    },
  ],
  levels: [
    { label: 'はしを そろえる・いくつぶんで くらべる', chance: 0.05 },
    { label: 'めもり・コップ いくつぶん', chance: 0.05 },
    { label: 'ひろさ・かさ', chance: 0.05 },
  ],
  intro: [
    {
      text: 'テープが 2ほん。ながさを くらべる ときは、はしを そろえます。',
      figure: barsFig({ len: [7, 5], off: [0, 0] }, false),
    },
    {
      text: 'おなじ ものが いくつぶんかで くらべる ことも できます。あは ブロック 7こぶん、いは 5こぶん。',
      figure: {
        kind: 'column',
        items: [
          { kind: 'blocks', ones: 7, tone: 'a' },
          { kind: 'blocks', ones: 5, tone: 'b' },
        ],
      },
    },
    {
      text: '7は 5より おおきいので、あの ほうが ながい です。',
      figure: { kind: 'text', text: '7は 5より おおきい', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateCompareQuantity(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 C 長さ・広さ・かさの直接比較・間接比較・任意単位によるいくつ分',
  revised: REVISED,
};
