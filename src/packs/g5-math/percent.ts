/**
 * g5.math.percent 割合・百分率・歩合（curriculum-matrix 3.8）。
 *
 * 割合 ＝ 比べる量 ÷ もとにする量、比べる量 ＝ もとにする量 × 割合、もとにする量 ＝ 比べる量 ÷ 割合。
 * 百分率（%）は 割合 × 100。歩合は 割・分（厘は 小学校で 習わない字なので 使わない）。
 * 数は整数で持ち、割合は「百分率の整数 p」で持つ（浮動小数点で計算しない）。
 * 同一性キー: 到達項目 × 場面 × 数。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  divText,
  doubleLine,
  dec,
  decAns,
  finishUnit,
  opts,
  pick,
  pickObj,
  REVISED,
  wrongList,
} from './util';

type Obj = 'ratio' | 'pct' | 'compare' | 'base' | 'sale';

const BASES = [20, 25, 40, 50, 80, 100, 120, 125, 150, 200, 250, 300, 400, 500];

/** もとにする量 B（maxB まで）と 百分率 p（B × p ÷ 100 が 整数。100%は 答えが そのままなので 使わない） */
function pickBP(rng: Rng, pMax = 99, maxB = Infinity): { B: number; p: number; C: number } {
  for (;;) {
    const B = pick(
      rng,
      BASES.filter((b) => b <= maxB),
    );
    const p = rng.int(1, pMax);
    if ((B * p) % 100 !== 0 || p === 100) continue;
    return { B, p, C: (B * p) / 100 };
  }
}

/** 割合の 数直線（上: もとに する 量 B と 比べる量 C、下: 100% と p%）。pNum は 位置を 決める 百分率 */
const pctLine = (B: string, C: string, p: string, pNum: number) => {
  const m = Math.max(pNum, 100);
  return doubleLine(
    [
      { at: 0, text: '0' },
      { at: (pNum / m) * 0.9, text: C },
      { at: (100 / m) * 0.9, text: B },
    ],
    [
      { at: 0, text: '0' },
      { at: (pNum / m) * 0.9, text: p },
      { at: (100 / m) * 0.9, text: '100' },
    ],
    '上が 量、下が 割合（%）の 数直線',
    '',
    '%',
  );
};

// ---- 割合を 求める（ratio） ----
interface RatioScene {
  id: string;
  text: (B: number, C: number) => string;
  baseWord: string;
  cmpWord: string;
  /** もとにする量の 上限（場面に 合う 大きさ） */
  maxB?: number;
}
const RATIO_SCENES: RatioScene[] = [
  {
    id: 'shoot',
    text: (B, C) =>
      `シュートを ${B}回 うって、${C}回 入《はい》りました。入《はい》った 割合を 求めよう。`,
    baseWord: 'うった 回数',
    cmpWord: '入《はい》った 回数',
  },
  {
    id: 'bus',
    text: (B, C) =>
      `定員 ${B}人の バスに ${C}人 乗って います。定員を もとに した、乗って いる 人の 割合を 求めよう。`,
    baseWord: '定員',
    cmpWord: '乗って いる 人数',
    maxB: 80,
  },
  {
    id: 'seed',
    text: (B, C) =>
      `たねを ${B}こ まいたら、${C}こが 芽《め》を 出しました。芽《め》が 出た 割合を 求めよう。`,
    baseWord: 'まいた 数',
    cmpWord: '芽《め》が 出た 数',
  },
  {
    id: 'field',
    text: (B, C) =>
      `${B}m²の 畑の うち、${C}m²に トマトを 植《う》えました。トマトを 植《う》えた 部分の 割合を 求めよう。`,
    baseWord: '畑の 広さ',
    cmpWord: 'トマトの 広さ',
  },
];

function ratioItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, RATIO_SCENES);
  const { B, p, C } = pickBP(rng, 99, sc.maxB);
  const r = dec(p, 2);
  const answers = alt ? [{ kind: 'int' as const, value: p }] : [decAns(p, 2)];
  return {
    engine: 'number',
    id: `ratio${alt ? '-alt' : ''}:${sc.id}:${B}:${C}`,
    objective: 'ratio',
    level,
    prompt: alt ? `${sc.text(B, C)}（百分率で 答えよう）` : `${sc.text(B, C)}（小数で 答えよう）`,
    figure: alt ? pctLine(String(B), String(C), '?', p) : undefined,
    hints: [
      `もとに する 量は ${sc.baseWord}、比べる量は ${sc.cmpWord}だよ。`,
      '割合 ＝ 比べる量 ÷ もとに する 量',
      alt ? `${C} ÷ ${B}を 計算して、100倍しよう。` : `${C} ÷ ${B}を 計算しよう。`,
    ],
    explain: alt
      ? `${C} ÷ ${B} ＝ ${r}。百分率に すると ${r} × 100 ＝ ${p}%です。`
      : `${C} ÷ ${B} ＝ ${r}。割合は ${r}です。`,
    identity: `ratio:${sc.id}:${B}:${C}${alt ? ':pct' : ''}`,
    alt,
    fields: [{ ...(alt ? { label: '%' } : {}), answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(
      answers,
      alt
        ? [
            [r, 'pct-shift'],
            [divText(B * 100, C), 'base-swap'],
            [divText(p, 10), 'pct-shift'],
          ]
        : [
            [divText(B, C), 'base-swap'],
            [p, 'pct-shift'],
            [dec(p, 3), 'pct-shift'],
          ],
    ),
  };
}

// ---- 百分率・小数・歩合（pct） ----
function pctItem(level: number, rng: Rng, alt: boolean): Item {
  const p = rng.int(1, 150);
  const d = dec(p, 2);
  if (alt) {
    if (rng.next() < 0.5 && p < 100 && p % 10 !== 0 && p >= 10) {
      // 歩合（割・分）
      const answers = [
        { kind: 'int' as const, value: Math.floor(p / 10) },
        { kind: 'int' as const, value: p % 10 },
      ];
      return {
        engine: 'number',
        id: `pct-alt:bu:${p}`,
        objective: 'pct',
        level,
        prompt: `割合 ${d}を 歩合で 表そう。`,
        hints: [
          '歩合では、0.1を 1割、0.01を 1分《ぶ》と いうよ。',
          `${d}は 0.1が ${Math.floor(p / 10)}こと、0.01が ${p % 10}こ。`,
          '0.1の 数を「割」の ところに、0.01の 数を「分《ぶ》」の ところに 書こう。',
        ],
        explain: `${d}は 0.1が ${Math.floor(p / 10)}こ、0.01が ${p % 10}こ なので、${Math.floor(p / 10)}割${p % 10}分《ぶ》です。`,
        identity: `pct-bu:${p}`,
        alt: true,
        fields: [
          { label: '割', answer: answers[0]! },
          { label: '分《ぶ》', answer: answers[1]! },
        ],
        wrongAnswers: wrongList(answers, [
          [`${p}|0`, 'pct-shift'],
          [`${p % 10}|${Math.floor(p / 10)}`, 'pct-shift'],
          [`0|${p}`, 'pct-shift'],
        ]),
      };
    }
    // 同じ 割合を 選ぶ
    const item: ChoiceItem = {
      engine: 'choice',
      id: `pct-alt:pick:${p}`,
      objective: 'pct',
      level,
      prompt: `${p}%と 同じ 割合を 表して いる 小数は どれ？`,
      hints: [
        '百分率の 1%は、割合の 0.01だよ。',
        '100%が 1に あたるね。',
        `${p}%は 0.01が ${p}こ分だよ。`,
      ],
      explain: `${p}%は 0.01が ${p}こ分なので、小数で ${d}です。`,
      identity: `pct-pick:${p}`,
      alt: true,
      options: opts(d, [
        [dec(p, 1), 'pct-shift'],
        [dec(p, 3), 'pct-shift'],
        [String(p), 'pct-shift'],
      ]),
    };
    return item;
  }
  if (rng.next() < 0.5) {
    // 小数 → 百分率
    const answers = [{ kind: 'int' as const, value: p }];
    return {
      engine: 'number',
      id: `pct:d2p:${p}`,
      objective: 'pct',
      level,
      prompt: `割合 ${d}を 百分率で 表そう。`,
      hints: [
        '割合の 1が 100%だよ。',
        '百分率は 割合を 100倍した 数。',
        `${d} × 100を 計算しよう。`,
      ],
      explain: `${d} × 100 ＝ ${p}。${d}は ${p}%です。`,
      identity: `pct:d2p:${p}`,
      alt: false,
      fields: [{ label: '%', answer: answers[0]! }],
      keys: ['decimal'],
      wrongAnswers: wrongList(answers, [
        [dec(p, 1), 'pct-shift'],
        [p * 10, 'pct-shift'],
        [d, 'pct-shift'],
      ]),
    };
  }
  // 百分率 → 小数
  const answers = [decAns(p, 2)];
  return {
    engine: 'number',
    id: `pct:p2d:${p}`,
    objective: 'pct',
    level,
    prompt: `${p}%を 小数の 割合で 表そう。`,
    hints: ['100%が 割合の 1だよ。', '1%は 0.01。', `${p} ÷ 100を 計算しよう。`],
    explain: `${p} ÷ 100 ＝ ${d}。${p}%は ${d}です。`,
    identity: `pct:p2d:${p}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [dec(p, 1), 'pct-shift'],
      [p, 'pct-shift'],
      [dec(p, 3), 'pct-shift'],
    ]),
  };
}

// ---- 比べる量を 求める（compare） ----
interface CmpScene {
  id: string;
  text: (B: number, rate: string) => string;
  unit: string;
  /** もとにする量の 上限（場面に 合う 大きさ） */
  maxB?: number;
}
const CMP_SCENES: CmpScene[] = [
  {
    id: 'bus',
    text: (B, r) =>
      `定員 ${B}人の バスに、定員の ${r}の 人が 乗って います。乗って いる 人は 何人ですか。`,
    unit: '人',
    maxB: 80,
  },
  {
    id: 'test',
    text: (B, r) => `${B}問の 問題の うち、${r}が 正かいでした。正かいした 問題は 何問ですか。`,
    unit: '問',
    maxB: 100,
  },
  {
    id: 'juice',
    text: (B, r) => `${B}mLの ジュースの ${r}が 果《か》じゅうです。果《か》じゅうは 何mLですか。`,
    unit: 'mL',
  },
  {
    id: 'book',
    text: (B, r) => `図書室の 本 ${B}さつの うち、${r}が 物語の 本です。物語の 本は 何さつですか。`,
    unit: 'さつ',
  },
];

function compareItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, CMP_SCENES);
  // alt: 歩合（○割）で 書いた 割合
  const { B, p, C } = alt
    ? (() => {
        for (;;) {
          const B = pick(
            rng,
            BASES.filter((b) => b <= (sc.maxB ?? Infinity)),
          );
          const p = rng.int(1, 9) * 10;
          if ((B * p) % 100 === 0) return { B, p, C: (B * p) / 100 };
        }
      })()
    : pickBP(rng, 99, sc.maxB);
  const rate = alt ? `${p / 10}割` : `${p}%`;
  const answers = [{ kind: 'int' as const, value: C }];
  return {
    engine: 'number',
    id: `compare${alt ? '-alt' : ''}:${sc.id}:${B}:${p}`,
    objective: 'compare',
    level,
    prompt: sc.text(B, rate),
    figure: pctLine(String(B), '?', String(p), p),
    hints: [
      `もとに する 量は ${B}${sc.unit}。${rate}は 割合を 表して いるよ。`,
      `${rate}を 小数に なおすと ${dec(p, 2)}。比べる量 ＝ もとに する 量 × 割合。`,
      `${B} × ${dec(p, 2)}を 計算しよう。`,
    ],
    explain: `${rate} ＝ ${dec(p, 2)}。${B} × ${dec(p, 2)} ＝ ${C}。答えは ${C}${sc.unit}です。`,
    identity: `compare:${sc.id}:${B}:${p}${alt ? ':wari' : ''}`,
    alt,
    fields: [{ label: sc.unit, answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [B * p, 'pct-shift'],
      [alt ? B * (p / 10) : null, 'pct-shift'],
      [divText(B * 100, p), 'formula-swap'],
      [B - p, 'pct-shift'],
      [divText(p * 100, B * 100), 'div-swap'],
    ]),
  };
}

// ---- もとにする量を 求める（base） ----
interface BaseScene {
  id: string;
  text: (C: number, p: number) => string;
  unit: string;
  /** 100% を こえる 割合が 場面に 合う（去年より 多い など） */
  over?: boolean;
}
const BASE_SCENES: BaseScene[] = [
  {
    id: 'bike',
    text: (C, p) =>
      `自転車で 通学《つうがく》する 人は ${C}人で、これは 全校の 人数の ${p}%です。全校の 人数は 何人ですか。`,
    unit: '人',
  },
  {
    id: 'save',
    text: (C, p) =>
      `ちょ金《きん》の ${p}%に あたる ${C}円で 本を 買いました。ちょ金《きん》は 何円 ありましたか。`,
    unit: '円',
  },
  {
    id: 'visit',
    over: true,
    text: (C, p) =>
      `今年《ことし》の 子ども会《かい》の 参加者《さんかしゃ》は ${C}人で、これは 去年《きょねん》の 参加者《さんかしゃ》の ${p}%です。去年《きょねん》は 何人でしたか。`,
    unit: '人',
  },
];

function baseItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, BASE_SCENES);
  const { B, p, C } = pickBP(rng, sc.over ? 150 : 99);
  const answers = [{ kind: 'int' as const, value: B }];
  return {
    engine: 'number',
    id: `base${alt ? '-alt' : ''}:${sc.id}:${C}:${p}`,
    objective: 'base',
    level,
    prompt: alt ? `${sc.text(C, p)}（数直線で 考えよう）` : sc.text(C, p),
    figure: alt ? pctLine('?', String(C), String(p), p) : undefined,
    hints: [
      `もとに する 量が 分からない 問題だよ。${C}${sc.unit}が ${p}%に あたるね。`,
      `もとに する 量を □と すると、□ × ${dec(p, 2)} ＝ ${C}。`,
      `${C} ÷ ${dec(p, 2)}を 計算しよう。`,
    ],
    explain: `□ × ${dec(p, 2)} ＝ ${C} なので、□ ＝ ${C} ÷ ${dec(p, 2)} ＝ ${B}。答えは ${B}${sc.unit}です。`,
    identity: `base:${sc.id}:${C}:${p}${alt ? ':line' : ''}`,
    alt,
    fields: [{ label: sc.unit, answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [divText(C * p, 100), 'formula-swap'],
      [divText(p, C * 100), 'div-swap'],
      [divText(C, p), 'pct-shift'],
      [C * p, 'pct-shift'],
    ]),
  };
}

// ---- 割引・増量（sale） ----
function saleItem(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    // 増量
    for (;;) {
      const X = rng.int(2, 40) * 50; // g・mL
      const p = pick(rng, [10, 15, 20, 25, 30, 40, 50]);
      if ((X * p) % 100 !== 0) continue;
      const u = rng.next() < 0.5 ? 'g' : 'mL';
      const thing = u === 'g' ? 'おかし' : 'ジュース';
      const ans = (X * (100 + p)) / 100;
      const answers = [{ kind: 'int' as const, value: ans }];
      return {
        engine: 'number',
        id: `sale-alt:${X}${u}:${p}`,
        objective: 'sale',
        level,
        prompt: `ふだん ${X}${u}入りの ${thing}が、今日は ${p}% 増量して います。今日の 量は 何${u}ですか。`,
        figure: pctLine(String(X), '?', String(100 + p), 100 + p),
        hints: [
          `もとに する 量は ふだんの ${X}${u}。${p}% 増えるので、今日は ${100 + p}%に あたるよ。`,
          `${100 + p}%を 小数に なおすと ${dec(100 + p, 2)}。`,
          `${X} × ${dec(100 + p, 2)}を 計算しよう。`,
        ],
        explain: `${X} × ${dec(100 + p, 2)} ＝ ${ans}。（${X} ＋ ${X} × ${dec(p, 2)} と しても よい）今日は ${ans}${u}です。`,
        identity: `sale-up:${X}${u}:${p}`,
        alt: true,
        fields: [{ label: u, answer: answers[0]! }],
        keys: ['decimal'],
        wrongAnswers: wrongList(answers, [
          [(X * p) / 100, 'discount-direct'],
          [X + p, 'pct-shift'],
          [(X * (100 - p)) / 100, 'sale-dir'],
        ]),
      };
    }
  }
  for (;;) {
    const X = rng.int(5, 60) * 100;
    const p = pick(rng, [10, 15, 20, 25, 30, 35, 40, 50]);
    if ((X * p) % 100 !== 0) continue;
    const ans = (X * (100 - p)) / 100;
    const answers = [{ kind: 'int' as const, value: ans }];
    const wari = p % 10 === 0 && rng.next() < 0.4;
    const rate = wari ? `${p / 10}割` : `${p}%`;
    return {
      engine: 'number',
      id: `sale:${X}:${p}:${wari ? 'w' : 'p'}`,
      objective: 'sale',
      level,
      prompt: `${X}円の シャツを、${rate}引きで 買います。代金は 何円ですか。`,
      hints: [
        `もとの ねだん ${X}円を 100%と すると、${rate}引きの 代金は ${100 - p}%に あたるよ。`,
        `${100 - p}%を 小数に なおすと ${dec(100 - p, 2)}。`,
        `${X} × ${dec(100 - p, 2)}を 計算しよう。`,
      ],
      explain: `${X} × ${dec(100 - p, 2)} ＝ ${ans}。（${X} − ${X} × ${dec(p, 2)} と しても よい）代金は ${ans}円です。`,
      identity: `sale:${X}:${p}:${wari ? 'w' : 'p'}`,
      alt: false,
      fields: [{ label: '円', answer: answers[0]! }],
      keys: ['decimal'],
      wrongAnswers: wrongList(answers, [
        [(X * p) / 100, 'discount-direct'],
        [X - p, 'pct-shift'],
        [wari ? X - p / 10 : null, 'pct-shift'],
        [(X * (100 + p)) / 100, 'sale-dir'],
      ]),
    };
  }
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['ratio', 'pct'] },
  { objs: ['compare', 'base', 'pct'] },
  { objs: ['sale', 'compare', 'base', 'ratio'] },
];

export function generatePercent(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'ratio':
      return ratioItem(level, rng, alt);
    case 'pct':
      return pctItem(level, rng, alt);
    case 'compare':
      return compareItem(level, rng, alt);
    case 'base':
      return baseItem(level, rng, alt);
    case 'sale':
      return saleItem(level, rng, alt);
  }
}

export const percent: UnitSpec = finishUnit(
  {
    id: 'g5.math.percent',
    title: '割合と 百分率',
    stage: 'g5',
    subject: 'math',
    domain: 'C-measure',
    kind: 'calc',
    priority: 'P1',
    status: 'ready',
    icon: 'math-split',
    prereq: ['g5.math.decimal-div'],
    objectives: [
      { id: 'ratio', title: '割合を 求める' },
      { id: 'pct', title: '百分率・小数・歩合' },
      { id: 'compare', title: '比べる量を 求める' },
      { id: 'base', title: 'もとに する 量を 求める' },
      { id: 'sale', title: '割引・増量' },
    ],
    misconceptions: [
      {
        id: 'base-swap',
        explain:
          'もとに する 量と 比べる量を 取りちがえたのかな。「〜を もとに して」「〜の うち」の 〜が もとに する 量。割合 ＝ 比べる量 ÷ もとに する 量だよ。',
      },
      {
        id: 'pct-shift',
        explain:
          '百分率と 小数の なおし方で けたが ずれたのかな。割合の 1が 100%、0.1が 10%、0.01が 1%。百分率は 割合を 100倍した 数だよ。歩合では 0.1が 1割、0.01が 1分《ぶ》。',
      },
      {
        id: 'div-swap',
        explain:
          'わる 数と わられる 数が 反対に なったのかな。もとに する 量 ＝ 比べる量 ÷ 割合。数直線に かいて、何で わるか たしかめよう。',
      },
      {
        id: 'formula-swap',
        explain:
          'かけ算と わり算を 取りちがえたのかな。比べる量 ＝ もとに する 量 × 割合、もとに する 量 ＝ 比べる量 ÷ 割合。',
      },
      {
        id: 'discount-direct',
        explain:
          '引かれる（増える）分だけを 求めたのかな。20%引きの 代金は、もとの ねだんの 100 − 20 ＝ 80%。増量なら 100 ＋ 増えた 分の %で 考えよう。',
      },
      {
        id: 'sale-dir',
        explain: '引くのと 増えるのを 反対に したのかな。「引き」は へる、「増量」は ふえるよ。',
      },
    ],
    levels: [
      { label: '割合・百分率', chance: 0.05 },
      { label: '比べる量・もとに する 量', chance: 0.05 },
      { label: '割引・増量、まとめ', chance: 0.05 },
    ],
    intro: [
      {
        text: 'シュートを 20回 うって 12回 入《はい》りました。うった 回数（もとに する 量）を 1と みると、入《はい》った 回数（比べる量）は 12 ÷ 20 ＝ 0.6。この 0.6を 割合と いいます。',
        figure: pctLine('20', '12', '60', 60),
      },
      {
        text: '割合 ＝ 比べる量 ÷ もとに する 量。割合を 100倍して %を つけた ものが 百分率です。0.6 ＝ 60%。0.01 ＝ 1%、1 ＝ 100%。',
      },
      {
        text: '比べる量 ＝ もとに する 量 × 割合（定員 40人の 75%は 40 × 0.75 ＝ 30人）。もとに する 量 ＝ 比べる量 ÷ 割合。歩合では 0.1を 1割、0.01を 1分《ぶ》と いいます。',
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generatePercent(level, rng, index),
    },
    review: 'type',
    basis:
      '小学校学習指導要領（平成29年告示）算数 第5学年 C(3) 割合（百分率）。歩合は 内容の取扱いの範囲で 割・分まで',
    revised: REVISED,
  },
  '自転車《じてんしゃ》 畑《はたけ》 芽《め》 出《だ》し 出《で》 植《う》えました 植《う》えた 乗《の》って 通学《つうがく》 全校《ぜんこう》 予定《よてい》 歩《ある》きました 図書室《としょしつ》 物語《ものがたり》 問《もん》 果《か》じゅう 今日《きょう》 入《い》り 引《び》き 引《ひ》き 引《ひ》かれる 引《ひ》く 正《せい》かい ちょ金《きん》 買《か》いました',
);
