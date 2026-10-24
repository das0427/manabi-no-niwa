/**
 * g3.en.numbers-colors かず（1〜20）・いろ・かたちを 聞《き》いて えらぶ（curriculum-matrix 3.6。外活34 聞く）。
 * 色は 色の名前の文字（あか など）か、その色の ものの 絵で示す（色だけで区別しない。DESINGN 3.1）。
 * 赤と緑を同じ問題に並べない。
 *
 * 同一性キー: 形式（数字で選ぶ・絵で選ぶ など） × 英語の語。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { en, enText, listen, pickOthers } from './lib';

const WORDS = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

/** 1〜10 の、はじめの音が にている数（聞きまちがえやすい） */
const SAME_START: Record<number, number[]> = {
  1: [9, 7],
  2: [3, 10],
  3: [2, 10],
  4: [5, 1],
  5: [4, 9],
  6: [7, 8],
  7: [6, 11],
  8: [6, 1],
  9: [5, 1],
  10: [2, 3],
};

const num = (n: number) => en('num', WORDS[n]!);

function numberItems(): Item[] {
  const out: Item[] = [];
  for (let n = 1; n <= 20; n++) {
    const small = n <= 10;
    let opts: ChoiceOption[];
    if (small) {
      opts = [
        { label: String(n), correct: true },
        ...SAME_START[n]!.map((m) => ({ label: String(m), misconception: 'same-start' })),
      ];
    } else if (n >= 13 && n <= 19) {
      // 13 と 30 のような teen と ty、teen の前だけの 3
      opts = [
        { label: String(n), correct: true },
        { label: String((n - 10) * 10), misconception: 'teen-ty' },
        { label: String(n - 10), misconception: 'teen-base' },
      ];
    } else {
      const other: Record<number, [number, number]> = { 11: [7, 17], 12: [20, 2], 20: [12, 2] };
      opts = [
        { label: String(n), correct: true },
        ...other[n]!.map((m) => ({
          label: String(m),
          misconception: n === 11 ? 'same-start' : 'tw-start',
        })),
      ];
    }
    out.push(
      listen({
        id: `num:${n}`,
        objective: small ? 'num10' : 'num20',
        level: small ? 0 : 1,
        prompt: '聞《き》こえた かずは どれ？',
        audio: num(n),
        options: opts,
        hints: [
          'さいごまで よく 聞《き》こう。',
          small
            ? 'はじめの 音《おと》が にている かずが あるよ。ちがいを 聞《き》きわけよう。'
            : 'おわりの 音《おと》を のばして いうか、みじかく おわるかを 聞《き》こう。',
          small
            ? `${n <= 5 ? '1から5' : '6から10'}の どれかだよ。`
            : '10より 大《おお》きく 20までの かずだよ。',
        ],
        explain: `${n}の ことでした。`,
        explainFigure: enText(`${n}  ${WORDS[n]}`),
        identity: `num:${n}`,
      }),
    );
  }
  // 別例: 聞いて、その数の 絵（りんご・ブロック）を えらぶ
  const ITEMS = ['apple', 'strawberry', 'mikan', 'ball', 'flower', 'p23-star'];
  for (let n = 1; n <= 20; n++) {
    const small = n <= 10;
    const id = ITEMS[n % ITEMS.length]!;
    const fig = (k: number): Figure =>
      small
        ? { kind: 'illust', id, count: k }
        : { kind: 'blocks', tens: Math.floor(k / 10), ones: k % 10 };
    const wrong: [number, string][] = small
      ? SAME_START[n]!.slice(0, 2).map((m) => [m, 'same-start'])
      : n === 20
        ? [
            [12, 'tw-start'],
            [19, 'teen-near'],
          ]
        : n === 12
          ? [
              [20, 'tw-start'],
              [11, 'teen-near'],
            ]
          : [
              [n + 1, 'teen-near'],
              [n - 1, 'teen-near'],
            ];
    out.push(
      listen({
        id: `num-pic:${n}`,
        objective: small ? 'num10' : 'num20',
        level: small ? 1 : 2,
        prompt: '聞《き》こえた かずだけ ある ものは どれ？',
        audio: num(n),
        options: [
          { figure: fig(n), correct: true },
          ...wrong.map(([m, mis]) => ({ figure: fig(m), misconception: mis })),
        ],
        layout: 'column',
        hints: [
          'まず かずを 聞《き》きとろう。',
          small
            ? 'つぎに、えの かずを かぞえよう。'
            : '10の まとまりと、のこりの ブロックを かぞえよう。',
          small ? 'かぞえた かずと 聞《き》いた かずを くらべよう。' : `10と いくつ かな。`,
        ],
        explain: `${n}こ ある ものが こたえ。`,
        explainFigure: enText(`${n}  ${WORDS[n]}`),
        identity: `num-pic:${n}`,
        alt: true,
      }),
    );
  }
  return out;
}

interface Color {
  word: string;
  ja: string;
  start: string;
  thing?: { id: string; ja: string };
}
const COLORS: Color[] = [
  { word: 'red', ja: 'あか', start: 'r', thing: { id: 'tomato', ja: 'トマト' } },
  { word: 'blue', ja: 'あお', start: 'b' },
  { word: 'yellow', ja: 'きいろ', start: 'y', thing: { id: 'banana', ja: 'バナナ' } },
  { word: 'green', ja: 'みどり', start: 'g', thing: { id: 'cucumber', ja: 'きゅうり' } },
  { word: 'pink', ja: 'ピンク', start: 'p', thing: { id: 'peach', ja: 'もも' } },
  { word: 'purple', ja: 'むらさき', start: 'p', thing: { id: 'eggplant', ja: 'なす' } },
  { word: 'orange', ja: 'オレンジいろ', start: 'o', thing: { id: 'carrot', ja: 'にんじん' } },
  { word: 'white', ja: 'しろ', start: 'w', thing: { id: 'egg', ja: 'たまご' } },
  { word: 'black', ja: 'くろ', start: 'b' },
  { word: 'brown', ja: 'ちゃいろ', start: 'b', thing: { id: 'bread', ja: 'パン' } },
  { word: 'gray', ja: 'はいいろ', start: 'g', thing: { id: 'rock', ja: 'いし' } },
];

/** 赤と緑を同じ問題に並べない */
const redGreen = (a: Color, b: Color) =>
  (a.word === 'red' && b.word === 'green') || (a.word === 'green' && b.word === 'red');

function colorItems(): Item[] {
  const out: Item[] = [];
  COLORS.forEach((c, i) => {
    const same = pickOthers(COLORS, i, 1, (d) => d !== c && d.start === c.start);
    const rest = pickOthers(
      COLORS,
      i,
      2 - same.length,
      (d) => d !== c && !same.includes(d) && !redGreen(c, d) && !same.some((s) => redGreen(s, d)),
    );
    out.push(
      listen({
        id: `color:${c.word}`,
        objective: 'color',
        level: 0,
        prompt: '聞《き》こえた 色《いろ》は どれ？',
        audio: en('color', c.word),
        options: [
          { label: c.ja, correct: true },
          ...same.map((d) => ({ label: d.ja, misconception: 'same-start' })),
          ...rest.map((d) => ({ label: d.ja, misconception: 'color-mix' })),
        ],
        hints: [
          'さいごまで よく 聞《き》こう。',
          'はじめの 音《おと》が にている 色《いろ》の なまえが あるよ。',
          c.thing
            ? `${c.thing.ja}の 色《いろ》だよ。`
            : c.word === 'blue'
              ? 'はれた ひの そらの 色《いろ》だよ。'
              : 'よるの そらの 色《いろ》だよ。',
        ],
        explain: `「${c.ja}」の ことです。`,
        explainFigure: enText(c.word),
        identity: `color:${c.word}`,
      }),
    );
  });
  // 別例: 聞いた色の ものを 絵で えらぶ
  const withThing = COLORS.filter((c) => c.thing);
  withThing.forEach((c, i) => {
    const others = pickOthers(withThing, i, 2, (d) => d !== c && !redGreen(c, d));
    if (others.length === 2 && redGreen(others[0]!, others[1]!)) others.pop();
    while (others.length < 2)
      others.push(
        withThing.find(
          (d) =>
            d !== c &&
            !others.includes(d) &&
            !redGreen(c, d) &&
            !others.some((o) => redGreen(o, d)),
        )!,
      );
    out.push(
      listen({
        id: `color-thing:${c.word}`,
        objective: 'color',
        level: 1,
        prompt: '聞《き》こえた 色《いろ》の ものは どれ？',
        audio: en('color', c.word),
        options: [
          { figure: { kind: 'illust', id: c.thing!.id }, label: c.thing!.ja, correct: true },
          ...others.map((d) => ({
            figure: { kind: 'illust' as const, id: d.thing!.id },
            label: d.thing!.ja,
            misconception: d.start === c.start ? 'same-start' : 'color-mix',
          })),
        ],
        hints: [
          'まず 色《いろ》の なまえを 聞《き》きとろう。',
          'その 色《いろ》を して いる ものを さがそう。',
          `「${c.ja}」の ものだよ。`,
        ],
        explain: `「${c.ja}」なので、${c.thing!.ja}です。`,
        explainFigure: enText(c.word),
        identity: `color-thing:${c.word}`,
        alt: true,
      }),
    );
  });
  return out;
}

interface Shape {
  word: string;
  ja: string;
  fig: Figure;
  kin: string;
}
const SHAPES: Shape[] = [
  { word: 'circle', ja: 'まる', fig: { kind: 'shape', shape: 'circle' }, kin: 'round' },
  { word: 'triangle', ja: 'さんかく', fig: { kind: 'shape', shape: 'triangle' }, kin: 'tri' },
  { word: 'square', ja: 'ましかく', fig: { kind: 'shape', shape: 'square' }, kin: 'four' },
  {
    word: 'rectangle',
    ja: 'ながしかく',
    fig: { kind: 'shape', shape: 'rect', w: 160, h: 90 },
    kin: 'four',
  },
  {
    word: 'oval',
    ja: 'たまごがた',
    fig: { kind: 'shape', shape: 'circle', w: 160, h: 100 },
    kin: 'round',
  },
  {
    word: 'cross',
    ja: 'じゅうじ',
    fig: {
      kind: 'shape',
      shape: 'polygon',
      points: [
        [35, 5],
        [65, 5],
        [65, 35],
        [95, 35],
        [95, 65],
        [65, 65],
        [65, 95],
        [35, 95],
        [35, 65],
        [5, 65],
        [5, 35],
        [35, 35],
      ],
    },
    kin: 'mark',
  },
  { word: 'star', ja: 'ほし', fig: { kind: 'illust', id: 'p23-star' }, kin: 'mark' },
  { word: 'heart', ja: 'ハート', fig: { kind: 'illust', id: 'heart' }, kin: 'mark' },
  {
    word: 'diamond',
    ja: 'ひしがた',
    fig: {
      kind: 'shape',
      shape: 'polygon',
      points: [
        [50, 5],
        [90, 50],
        [50, 95],
        [10, 50],
      ],
    },
    kin: 'four',
  },
];

function shapeItems(): Item[] {
  const out: Item[] = [];
  SHAPES.forEach((s, i) => {
    const same = pickOthers(SHAPES, i, 1, (t) => t !== s && t.kin === s.kin);
    const rest = pickOthers(SHAPES, i, 2 - same.length, (t) => t !== s && !same.includes(t));
    out.push(
      listen({
        id: `shape:${s.word}`,
        objective: 'shape',
        level: 0,
        prompt: '聞《き》こえた 形《かたち》は どれ？',
        audio: en('shape', s.word),
        options: [
          { figure: s.fig, label: s.ja, correct: true },
          ...same.map((t) => ({ figure: t.fig, label: t.ja, misconception: 'shape-mix' })),
          ...rest.map((t) => ({ figure: t.fig, label: t.ja, misconception: 'shape-word' })),
        ],
        hints: [
          'さいごまで よく 聞《き》こう。',
          'かどが ある 形《かたち》か、まるい 形《かたち》か かんがえよう。',
          s.kin === 'four'
            ? 'かどが 4つ ある 形《かたち》だよ。'
            : s.kin === 'mark'
              ? 'しるしに よく つかう 形《かたち》だよ。'
              : s.kin === 'tri'
                ? 'かどが ある 形《かたち》だよ。'
                : 'かどが ない 形《かたち》だよ。',
        ],
        explain: `「${s.ja}」の ことです。`,
        explainFigure: enText(s.word),
        identity: `shape:${s.word}`,
      }),
    );
  });
  // 別例: 色と形の くみあわせ（a red circle など）
  const COMBOS: [string, string][] = [
    ['red', 'circle'],
    ['blue', 'triangle'],
    ['yellow', 'star'],
    ['green', 'square'],
    ['pink', 'heart'],
    ['purple', 'rectangle'],
    ['white', 'diamond'],
    ['brown', 'circle'],
  ];
  COMBOS.forEach(([cw, sw], i) => {
    const c = COLORS.find((x) => x.word === cw)!;
    const s = SHAPES.find((x) => x.word === sw)!;
    const c2 = pickOthers(COLORS, i + 3, 1, (x) => x !== c && !redGreen(x, c))[0]!;
    const s2 = pickOthers(SHAPES, i + 1, 1, (x) => x !== s)[0]!;
    const text = `${/^[aeiou]/.test(cw) ? 'an' : 'a'} ${cw} ${sw}`;
    out.push(
      listen({
        id: `combo:${cw}-${sw}`,
        objective: 'shape',
        level: 2,
        prompt:
          '聞《き》こえた ものは どれ？ 色《いろ》と 形《かたち》の りょうほうを 聞《き》こう。',
        audio: en('combo', text),
        options: [
          { label: `${c.ja}の ${s.ja}`, correct: true },
          { label: `${c2.ja}の ${s.ja}`, misconception: 'color-mix' },
          { label: `${c.ja}の ${s2.ja}`, misconception: 'shape-mix' },
        ],
        hints: [
          'はじめに 色《いろ》、つぎに 形《かたち》が 聞《き》こえるよ。',
          `色《いろ》は「${c.ja}」だよ。`,
          'さいごの ことばが 形《かたち》だよ。もういちど 聞《き》こう。',
        ],
        explain: `「${c.ja}の ${s.ja}」です。色《いろ》→ 形《かたち》の じゅんに いうよ。`,
        explainFigure: enText(text),
        identity: `combo:${cw}-${sw}`,
        alt: true,
      }),
    );
  });
  return out;
}

export const numbersColors: UnitSpec = {
  id: 'g3.en.numbers-colors',
  title: 'かず・いろ・かたち',
  stage: 'g3',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-eigo',
  prereq: [],
  objectives: [
    { id: 'num10', title: '1から 10の かずが わかる' },
    { id: 'num20', title: '11から 20の かずが わかる' },
    { id: 'color', title: '色《いろ》の なまえが わかる' },
    { id: 'shape', title: '形《かたち》の なまえ・色《いろ》との くみあわせが わかる' },
  ],
  misconceptions: [
    {
      id: 'same-start',
      explain:
        '音《おと》が にている ことばと まちがえたのかな。さいごまで 聞《き》いて くらべよう。',
    },
    {
      id: 'teen-ty',
      explain:
        '13と 30のように、おわりの 音《おと》が にている かずと まちがえたのかな。10より 大《おお》きく 20より 小《ちい》さい かずは、おわりを のばして いうよ。',
    },
    {
      id: 'teen-base',
      explain:
        'まえの ぶぶんだけ 聞《き》いたのかな。おわりまで 聞《き》くと、10より 大《おお》きい かずだと わかるよ。',
    },
    {
      id: 'tw-start',
      explain: '12と 20は はじめの 音《おと》が にているね。おわりの 音《おと》を くらべよう。',
    },
    { id: 'teen-near', explain: 'となりの かずと まちがえたのかな。ブロックを かぞえなおそう。' },
    {
      id: 'color-mix',
      explain: 'ほかの 色《いろ》の なまえと とりちがえたのかな。もういちど 聞《き》こう。',
    },
    {
      id: 'shape-mix',
      explain: 'にている 形《かたち》と とりちがえたのかな。かどの かずや、ながさを くらべよう。',
    },
    {
      id: 'shape-word',
      explain: '形《かたち》の なまえを とりちがえたのかな。もういちど 聞《き》こう。',
    },
  ],
  levels: [
    { label: '1〜10・色《いろ》・形《かたち》', chance: 0.05 },
    { label: '11〜20・ものの 色《いろ》', chance: 0.05 },
    { label: '色《いろ》と 形《かたち》の くみあわせ', chance: 0.05 },
  ],
  intro: [
    {
      text: 'えいごの かずを 聞《き》いて、すうじを えらぶよ。',
      figure: enText('3  three', 'xl'),
    },
    {
      text: '色《いろ》や 形《かたち》の なまえも 聞《き》こう。たとえば、まるい 形《かたち》は この ことば。',
      figure: { kind: 'row', items: [{ kind: 'shape', shape: 'circle' }, enText('circle', 'xl')] },
    },
  ],
  source: { kind: 'items', items: [...numberItems(), ...colorItems(), ...shapeItems()] },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）外国語活動 第3・4学年 聞くこと（数・色・形など身近で簡単な事柄を表す語句）',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
