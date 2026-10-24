/**
 * g5.en.letters-write 大文字《おおもじ》・小文字《こもじ》を 書《か》く（curriculum-matrix 3.8。外56 書く）。
 *   段階0: 大文字の なぞり（書き順の追跡。字形は採点しない）
 *   段階1: 小文字の なぞり
 *   段階2: 4線の 位置、文の 書き方（大文字ではじめる・語の間・終わりの符号）
 * 別例: お手本と見比べて自由に書く（mode 'free'。採点しない）、符号のなぞり。
 *
 * 書き順データ: 英字は trace エンジンに書き順データが無いので、この単元で 0〜1000 の正方形の座標で持つ。
 * 字は 4線（上から 1〜4本め）の位置に置く: 1本め y=200、2本め y=430、3本め（基線）y=660、4本め y=860。
 *   大文字は 1〜3本め、小文字は x の高さが 2〜3本め、b d f h k l は 1本めまで、g j p q y は 4本めまで。
 * 書き順は 国内の小学校で広く使われる形（縦の線→横の線、左→右）に合わせた本アプリの案。
 * 盤に 4線は まだ出ない（エンジンへの要望）。いまの trace エンジンは書き順データを盤の中央に寄せる
 * （normalizeStrokes）ので、4線の位置はなぞりでは見えない。4線の位置は 段階2 の choice（band）で問う。
 *
 * 同一性キー: 形式 × 字。
 */
import type { ChoiceOption, Item, TraceItem, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { enText } from './lib';

type P = [number, number];
const L1 = 200;
const L2 = 430;
const L3 = 660;
const L4 = 860;
const XM = (L2 + L3) / 2; // 小文字の まんなか

const rnd = (v: number) => Math.max(0, Math.min(1000, Math.round(v)));

/** 折れ線（点を 40 ごとに 足して 追跡しやすくする） */
function ln(...pts: P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]!;
    if (i === 0) {
      out.push([rnd(x), rnd(y)]);
      continue;
    }
    const [px, py] = pts[i - 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / 40));
    for (let k = 1; k <= n; k++)
      out.push([rnd(px + ((x - px) * k) / n), rnd(py + ((y - py) * k) / n)]);
  }
  return out;
}

/** だ円の 弧（角度は度。0=右、90=下。a0→a1 の向きに進む） */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): P[] {
  const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 12));
  return Array.from({ length: n + 1 }, (_, k) => {
    const a = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180;
    return [rnd(cx + rx * Math.cos(a)), rnd(cy + ry * Math.sin(a))] as P;
  });
}

/** 部品を つなげて 1画に（つなぎ目の 重なった点は 1つに） */
function j(...parts: P[][]): P[] {
  const out: P[] = [];
  for (const part of parts)
    for (const p of part) {
      const last = out[out.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
    }
  return out;
}

/** 点（i・j の点、符号）。短い たての線 */
const dot = (x: number, y: number): P[] => ln([x, y - 25], [x, y + 25]);

const UPPER: Record<string, P[][]> = {
  A: [ln([500, L1], [320, L3]), ln([500, L1], [680, L3]), ln([395, 500], [605, 500])],
  B: [
    ln([350, L1], [350, L3]),
    j(ln([350, L1], [520, L1]), arc(520, 315, 115, 115, -90, 90), ln([520, 430], [350, 430])),
    j(ln([350, 430], [540, 430]), arc(540, 545, 125, 115, -90, 90), ln([540, L3], [350, L3])),
  ],
  C: [arc(500, 430, 180, 230, -40, -320)],
  D: [
    ln([350, L1], [350, L3]),
    j(ln([350, L1], [440, L1]), arc(440, 430, 220, 230, -90, 90), ln([440, L3], [350, L3])),
  ],
  E: [
    ln([360, L1], [360, L3]),
    ln([360, L1], [640, L1]),
    ln([360, 430], [610, 430]),
    ln([360, L3], [650, L3]),
  ],
  F: [ln([360, L1], [360, L3]), ln([360, L1], [640, L1]), ln([360, 430], [610, 430])],
  G: [arc(500, 430, 180, 230, -40, -360), ln([540, 430], [680, 430], [680, 640])],
  H: [ln([340, L1], [340, L3]), ln([660, L1], [660, L3]), ln([340, 430], [660, 430])],
  I: [ln([500, L1], [500, L3])],
  J: [j(ln([600, L1], [600, 560]), arc(480, 560, 120, 100, 0, 180))],
  K: [ln([350, L1], [350, L3]), ln([650, L1], [350, 460]), ln([440, 390], [660, L3])],
  L: [ln([360, L1], [360, L3], [650, L3])],
  M: [ln([320, L1], [320, L3]), ln([320, L1], [500, L3], [680, L1], [680, L3])],
  N: [ln([340, L1], [340, L3]), ln([340, L1], [660, L3], [660, L1])],
  O: [arc(500, 430, 190, 230, -90, -450)],
  P: [
    ln([350, L1], [350, L3]),
    j(ln([350, L1], [520, L1]), arc(520, 320, 120, 120, -90, 90), ln([520, 440], [350, 440])),
  ],
  Q: [arc(500, 430, 190, 230, -90, -450), ln([540, 560], [690, 700])],
  R: [
    ln([350, L1], [350, L3]),
    j(ln([350, L1], [520, L1]), arc(520, 320, 120, 120, -90, 90), ln([520, 440], [350, 440])),
    ln([470, 440], [660, L3]),
  ],
  S: [j(arc(500, 315, 150, 115, -20, -270), arc(500, 545, 160, 115, -90, 160))],
  T: [ln([320, L1], [680, L1]), ln([500, L1], [500, L3])],
  U: [j(ln([340, L1], [340, 520]), arc(500, 520, 160, 140, 180, 0), ln([660, 520], [660, L1]))],
  V: [ln([320, L1], [500, L3], [680, L1])],
  W: [ln([280, L1], [390, L3], [500, L1], [610, L3], [720, L1])],
  X: [ln([330, L1], [670, L3]), ln([670, L1], [330, L3])],
  Y: [ln([330, L1], [500, 430]), ln([670, L1], [500, 430], [500, L3])],
  Z: [ln([330, L1], [670, L1], [330, L3], [670, L3])],
};

const LOWER: Record<string, P[][]> = {
  a: [arc(480, XM, 110, 115, -20, -380), ln([595, L2], [595, L3])],
  b: [ln([380, L1], [380, L3]), arc(490, XM, 110, 115, 180, 520)],
  c: [arc(500, XM, 110, 115, -40, -320)],
  d: [arc(480, XM, 110, 115, -20, -380), ln([595, L1], [595, L3])],
  e: [j(ln([390, XM], [610, XM]), arc(500, XM, 110, 115, 0, -320))],
  f: [j(arc(560, 290, 80, 70, -20, -180), ln([480, 290], [480, L3])), ln([400, L2], [590, L2])],
  g: [
    arc(480, XM, 110, 115, -20, -380),
    j(ln([595, L2], [595, 790]), arc(500, 790, 95, 70, 0, 160)),
  ],
  h: [ln([380, L1], [380, L3]), j(arc(490, XM, 110, 115, 180, 360), ln([600, XM], [600, L3]))],
  i: [ln([500, L2], [500, L3]), dot(500, 330)],
  j: [j(ln([540, L2], [540, 790]), arc(450, 790, 90, 70, 0, 160)), dot(540, 330)],
  k: [ln([380, L1], [380, L3]), ln([590, L2], [380, 580]), ln([450, 540], [600, L3])],
  l: [ln([500, L1], [500, L3])],
  m: [
    ln([330, L2], [330, L3]),
    j(arc(410, 520, 80, 90, 180, 360), ln([490, 520], [490, L3])),
    j(arc(570, 520, 80, 90, 180, 360), ln([650, 520], [650, L3])),
  ],
  n: [ln([380, L2], [380, L3]), j(arc(490, XM, 110, 115, 180, 360), ln([600, XM], [600, L3]))],
  o: [arc(500, XM, 115, 115, -90, -450)],
  p: [ln([380, L2], [380, L4]), arc(490, XM, 110, 115, 180, 520)],
  q: [arc(480, XM, 110, 115, -20, -380), ln([595, L2], [595, L4])],
  r: [ln([400, L2], [400, L3]), arc(500, 560, 100, 100, 180, 300)],
  s: [j(arc(500, 487, 100, 57, -20, -270), arc(500, 602, 105, 58, -90, 160))],
  t: [j(ln([480, 280], [480, 610]), arc(540, 610, 60, 50, 180, 20)), ln([400, L2], [580, L2])],
  u: [
    j(ln([380, L2], [380, 560]), arc(490, 560, 110, 100, 180, 0), ln([600, 560], [600, L2])),
    ln([600, L2], [600, L3]),
  ],
  v: [ln([380, L2], [500, L3], [620, L2])],
  w: [ln([320, L2], [410, L3], [500, L2], [590, L3], [680, L2])],
  x: [ln([380, L2], [620, L3]), ln([620, L2], [380, L3])],
  y: [ln([380, L2], [500, L3]), ln([620, L2], [430, L4])],
  z: [ln([380, L2], [620, L2], [380, L3], [620, L3])],
};

/** 符号（? ! '） */
const MARKS: Record<string, { strokes: P[][]; ja: string }> = {
  '?': {
    strokes: [j(arc(500, 330, 110, 110, 200, 450), ln([500, 440], [500, 540])), dot(500, 620)],
    ja: 'たずねる 文《ぶん》の おわりの しるし',
  },
  '!': {
    strokes: [ln([500, L1], [500, 540]), dot(500, 620)],
    ja: 'つよく いう 文《ぶん》の おわりの しるし',
  },
  "'": {
    strokes: [ln([500, L1], [480, 300])],
    ja: '2つの ことばを みじかく つなげた ときの しるし',
  },
};

const NAME_HINT = '名前《なまえ》を いいながら 書《か》こう。';

function traceItem(
  c: string,
  strokes: P[][],
  obj: string,
  level: number,
  where: string,
): TraceItem {
  return {
    engine: 'trace',
    id: `trace:${c === c.toUpperCase() && c !== c.toLowerCase() ? 'U' : 'l'}-${c}`,
    objective: obj,
    level,
    prompt: 'お手本《てほん》を なぞろう。1画《かく》めから じゅんに 書《か》こう。',
    char: c,
    mode: 'trace',
    strokes,
    tolerance: 80,
    misconceptionIds: { order: 'stroke-order', direction: 'stroke-dir' },
    hints: [
      `この 字《じ》は ${strokes.length}画《かく》で 書《か》くよ。`,
      'はじめの 点《てん》から、やじるしの むきに すすもう。',
      `${where}。${NAME_HINT}`,
    ],
    explain: `${strokes.length}画《かく》で 書《か》けたね。${where}。`,
    identity: `trace:${c === c.toUpperCase() && c !== c.toLowerCase() ? 'U' : 'l'}-${c}`,
  };
}

function freeItem(c: string, obj: string, level: number): TraceItem {
  const up = c !== c.toLowerCase();
  return {
    engine: 'trace',
    id: `free:${up ? 'U' : 'l'}-${c}`,
    objective: obj,
    level,
    prompt:
      'お手本《てほん》を 見《み》てから、じぶんで 書《か》いて みよう。書《か》いたら お手本《てほん》と くらべよう。',
    char: c,
    mode: 'free',
    hints: [
      'お手本《てほん》の 形《かたち》を よく 見《み》よう。',
      up
        ? '大文字《おおもじ》は 1本《ぽん》めから 3本《ぼん》めの 線《せん》の あいだに 書《か》くよ。'
        : '小文字《こもじ》の 高《たか》さに 気《き》を つけよう。',
      '書《か》きおわったら、お手本《てほん》と かさねて くらべよう。',
    ],
    explain: 'お手本《てほん》と にている ところ、ちがう ところを 見《み》つけられたかな。',
    identity: `free:${up ? 'U' : 'l'}-${c}`,
    alt: true,
  };
}

/** 4線の どこに 書くか */
type Band = 'asc' | 'x' | 'desc';
const BAND_OF = (c: string): Band =>
  'bdfhklt'.includes(c)
    ? 'asc'
    : 'gjpqy'.includes(c)
      ? 'desc'
      : c !== c.toLowerCase()
        ? 'asc'
        : 'x';
const BAND_LABEL: Record<Band, string> = {
  asc: '1本《ぽん》めから 3本《ぼん》めまで',
  x: '2本《ほん》めから 3本《ぼん》めまで',
  desc: '2本《ほん》めから 4本《ほん》めまで',
};
const BAND_RANGE: Record<Band, [number, number]> = { asc: [0, 2], x: [1, 2], desc: [1, 3] };

/** 4線と、書く はんいを ぬった 図 */
function bandFig(b: Band): Figure {
  const ys = [15, 40, 65, 90];
  const [a, z] = BAND_RANGE[b];
  const lines = ys
    .map(
      (y, i) =>
        `<line x1="5" y1="${y}" x2="115" y2="${y}" stroke="var(--ink)" stroke-width="${i === 2 ? 2.5 : 1.5}" />`,
    )
    .join('');
  const rect = `<rect x="5" y="${ys[a]}" width="110" height="${ys[z]! - ys[a]!}" fill="var(--ink)" fill-opacity="0.2" />`;
  return {
    kind: 'svg',
    label: `${a + 1}ばんめから ${z + 1}ばんめの せん`,
    markup: `<svg viewBox="0 0 120 105" width="180" height="158" xmlns="http://www.w3.org/2000/svg">${rect}${lines}</svg>`,
  };
}

const BAND_MIS: Record<Band, string> = {
  asc: 'line-ascender',
  x: 'line-xheight',
  desc: 'line-descender',
};

function bandItems(): Item[] {
  const out: Item[] = [];
  const LETTERS = ['a', 'b', 'd', 'e', 'g', 'h', 'k', 'm', 'n', 'p', 'q', 'r', 'y', 'f', 'j', 'l'];
  for (const c of LETTERS) {
    const b = BAND_OF(c);
    const opts: ChoiceOption[] = (['asc', 'x', 'desc'] as Band[]).map((x) =>
      x === b
        ? { figure: bandFig(x), label: BAND_LABEL[x], correct: true }
        : { figure: bandFig(x), label: BAND_LABEL[x], misconception: BAND_MIS[b] },
    );
    out.push({
      engine: 'choice',
      id: `band:${c}`,
      objective: 'rule',
      level: 2,
      prompt:
        'この 小文字《こもじ》は、4本《ほん》の 線《せん》の どこから どこまでに 書《か》く？',
      figure: enText(c, 'xl'),
      options: opts,
      fixedOrder: true,
      hints: [
        '3本《ぼん》めの 線《せん》が、字《じ》が のる 線《せん》だよ。',
        'うえに のびる ぼうが あるか、したに のびる ぼうが あるかを 見《み》よう。',
        b === 'x'
          ? 'うえにも したにも のびない 字《じ》だね。'
          : b === 'asc'
            ? 'うえに のびる ぼうが あるね。'
            : 'したに のびる ぶぶんが あるね。',
      ],
      explain: `「${c}」は ${BAND_LABEL[b]}に 書《か》きます。`,
      identity: `band:${c}`,
    });
  }
  // 別例: 書く はんいを 見て、あう 字を えらぶ
  const ALT: [Band, string, string, string][] = [
    ['desc', 'p', 'b', 'o'],
    ['asc', 'h', 'n', 'y'],
    ['x', 'u', 'd', 'j'],
    ['desc', 'y', 'v', 'k'],
    ['asc', 'l', 'i', 'q'],
  ];
  for (const [b, right, w1, w2] of ALT) {
    out.push({
      engine: 'choice',
      id: `band-alt:${right}`,
      objective: 'rule',
      level: 2,
      prompt: 'ぬって ある ところに ちょうど 書《か》く 小文字《こもじ》は どれ？',
      figure: bandFig(b),
      options: [
        { label: right, correct: true },
        { label: w1, misconception: BAND_MIS[BAND_OF(w1)] },
        { label: w2, misconception: BAND_MIS[BAND_OF(w2)] },
      ],
      hints: [
        'ぬって ある はんいの いちばん うえと したの 線《せん》を 見《み》よう。',
        '3本《ぼん》めの 線《せん》が、字《じ》が のる 線《せん》だよ。',
        b === 'x'
          ? 'うえにも したにも のびない 字《じ》を さがそう。'
          : b === 'asc'
            ? 'うえに のびる 字《じ》を さがそう。'
            : 'したに のびる 字《じ》を さがそう。',
      ],
      explain: `「${right}」は ${BAND_LABEL[b]}に 書《か》く 字《じ》です。`,
      identity: `band-alt:${right}`,
      alt: true,
    });
  }
  return out;
}

/** 文の 書き方（大文字で はじめる・語の 間を あける・おわりの 符号） */
const RULES: { right: string; wrong: [string, string]; mis: [string, string]; ja: string }[] = [
  {
    right: 'I like dogs.',
    wrong: ['i like dogs.', 'Ilike dogs.'],
    mis: ['no-capital', 'no-space'],
    ja: 'わたしは いぬが すきです',
  },
  {
    right: 'Do you like cats?',
    wrong: ['Do you like cats.', 'do you like cats?'],
    mis: ['wrong-mark', 'no-capital'],
    ja: 'ねこは すきですか',
  },
  {
    right: 'I can swim.',
    wrong: ['I can swim?', 'I canswim.'],
    mis: ['wrong-mark', 'no-space'],
    ja: 'わたしは およげます',
  },
  {
    right: 'My name is Emi.',
    wrong: ['My name is emi.', 'my name is Emi.'],
    mis: ['no-capital', 'no-capital'],
    ja: 'わたしの なまえは エミです',
  },
  {
    right: 'What do you want?',
    wrong: ['What do you want.', 'Whatdo you want?'],
    mis: ['wrong-mark', 'no-space'],
    ja: 'なにが ほしいですか',
  },
  {
    right: "I'm hungry.",
    wrong: ['Im hungry.', "i'm hungry."],
    mis: ['no-apostrophe', 'no-capital'],
    ja: 'おなかが すきました',
  },
  {
    right: 'Can you play the piano?',
    wrong: ['Can you play the piano.', 'can you play the piano?'],
    mis: ['wrong-mark', 'no-capital'],
    ja: 'ピアノを ひけますか',
  },
  {
    right: 'I live in Japan.',
    wrong: ['I live in japan.', 'I live inJapan.'],
    mis: ['no-capital', 'no-space'],
    ja: 'わたしは にほんに すんで います',
  },
];

function ruleItems(): Item[] {
  const out: Item[] = [];
  RULES.forEach((r, i) => {
    out.push({
      engine: 'choice',
      id: `rule:${i}`,
      objective: 'rule',
      level: 2,
      prompt: `「${r.ja}」と いう 文《ぶん》を 正《ただ》しく 書《か》いて いるのは どれ？`,
      options: [
        { label: r.right, correct: true },
        { label: r.wrong[0], misconception: r.mis[0] },
        { label: r.wrong[1], misconception: r.mis[1] },
      ],
      layout: 'column',
      hints: [
        '文《ぶん》の はじめの 字《じ》、ことばと ことばの あいだ、文《ぶん》の おわりを 見《み》よう。',
        '文《ぶん》の はじめと、人《ひと》や 国《くに》の なまえの はじめは 大文字《おおもじ》で 書《か》くよ。',
        'たずねる 文《ぶん》の おわりには「？」の しるしを つけるよ。',
      ],
      explain:
        '文《ぶん》の はじめは 大文字《おおもじ》、ことばの あいだは 1字《じ》ぶん あけ、おわりに「.」か「?」を つけます。',
      explainFigure: enText(r.right),
      identity: `rule:${r.right}`,
    });
  });
  return out;
}

function letterItems(): Item[] {
  const out: Item[] = [];
  for (const [c, s] of Object.entries(UPPER))
    out.push(
      traceItem(c, s, 'upper', 0, '1本《ぽん》めの 線《せん》から 3本《ぼん》めの 線《せん》まで'),
    );
  for (const [c, s] of Object.entries(LOWER)) {
    const b = BAND_OF(c);
    out.push(traceItem(c, s, 'lower', 1, BAND_LABEL[b]));
  }
  for (const c of ['A', 'G', 'K', 'M', 'R', 'S']) out.push(freeItem(c, 'upper', 0));
  for (const c of ['a', 'b', 'd', 'g', 'p', 'q', 'y']) out.push(freeItem(c, 'lower', 1));
  // 符号のなぞり（文の書き方の 別例）
  for (const [c, m] of Object.entries(MARKS)) {
    out.push({
      ...traceItem(c, m.strokes, 'rule', 2, m.ja),
      id: `mark:${c === '?' ? 'question' : c === '!' ? 'exclamation' : 'apostrophe'}`,
      identity: `mark:${c}`,
      prompt: 'しるしを なぞろう。',
      alt: true,
    });
  }
  return out;
}

export const lettersWrite: UnitSpec = {
  id: 'g5.en.letters-write',
  title: 'アルファベットを 書《か》こう',
  stage: 'g5',
  subject: 'en',
  domain: 'en',
  kind: 'writing',
  priority: 'P1',
  status: 'ready',
  icon: 'trace-letters',
  prereq: ['g4.en.alphabet-lower'],
  objectives: [
    { id: 'upper', title: '大文字《おおもじ》を 書《か》く' },
    { id: 'lower', title: '小文字《こもじ》を 書《か》く' },
    {
      id: 'rule',
      title: '4本《ほん》の 線《せん》の 位置《いち》と 文《ぶん》の 書《か》き方《かた》',
    },
  ],
  misconceptions: [
    {
      id: 'stroke-order',
      explain:
        'ほかの 画《かく》から 書《か》きはじめたのかな。お手本《てほん》の 1画《かく》めから じゅんに 書《か》こう。',
    },
    {
      id: 'stroke-dir',
      explain:
        '線《せん》を はんたいの むきに 書《か》いたのかな。はじめの 点《てん》から 書《か》こう。',
    },
    {
      id: 'line-ascender',
      explain: 'うえに のびる ぼうの ある 字《じ》は、1本《ぽん》めの 線《せん》まで とどくよ。',
    },
    {
      id: 'line-xheight',
      explain:
        'うえにも したにも のびない 字《じ》は、2本《ほん》めと 3本《ぼん》めの 線《せん》の あいだに 書《か》くよ。',
    },
    {
      id: 'line-descender',
      explain: 'したに のびる ぶぶんの ある 字《じ》は、4本《ほん》めの 線《せん》まで とどくよ。',
    },
    {
      id: 'no-capital',
      explain:
        '文《ぶん》の はじめや、人《ひと》・国《くに》の なまえの はじめは 大文字《おおもじ》で 書《か》くよ。',
    },
    { id: 'no-space', explain: 'ことばと ことばの あいだを あけるのを わすれたのかな。' },
    {
      id: 'wrong-mark',
      explain: 'たずねる 文《ぶん》には「?」、ふつうの 文《ぶん》には「.」を つけるよ。',
    },
    {
      id: 'no-apostrophe',
      explain: '2つの ことばを みじかく つなげる ときは、うえに しるしを つけるよ。',
    },
  ],
  levels: [
    { label: '大文字《おおもじ》', chance: 0.05 },
    { label: '小文字《こもじ》', chance: 0.05 },
    { label: '4本《ほん》の 線《せん》と 文《ぶん》の 書《か》き方《かた》', chance: 0.05 },
  ],
  intro: [
    {
      text: 'えいごは 4本《ほん》の 線《せん》の うえに 書《か》くよ。3本《ぼん》めの 線《せん》が 字《じ》の のる 線《せん》。',
      figure: bandFig('x'),
    },
    {
      text: '大文字《おおもじ》は 1本《ぽん》めから 3本《ぼん》めまで。小文字《こもじ》は 字《じ》に よって ちがうよ。',
      figure: { kind: 'row', items: [bandFig('asc'), bandFig('desc')], gap: 16 },
    },
    {
      text: 'お手本《てほん》の 1画《かく》めから、じゅんに なぞろう。形《かたち》の 点数《てんすう》は つけないよ。',
    },
  ],
  source: { kind: 'items', items: [...letterItems(), ...bandItems(), ...ruleItems()] },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）外国語 第5・6学年 書くこと（大文字・小文字を活字体で書く。語順を意識しながら書き写す）',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
