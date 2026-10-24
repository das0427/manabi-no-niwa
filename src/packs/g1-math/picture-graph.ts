/**
 * g1.math.picture-graph えグラフ（絵や図に表す）（curriculum-matrix 3.4）。
 * 読む（いちばん おおい・すくない、いくつ、ちがい）→ 作る（○や絵を つむ）。
 *
 * 同一性キー: 問い方＋題材＋項目と数の組（題材の絵柄は同じとみない: 項目が違う）。
 */
import type { Rng } from '../../core/util/rng';
import type { GraphData, GraphItem } from '../../engines/graph/graph';
import type { Item, UnitSpec } from '../../curriculum/types';
import { REVISED } from './util';

type Obj = 'yomu' | 'kazu' | 'chigai' | 'tsukuru';

interface Theme {
  id: string;
  title: string;
  labels: string[];
  unit: string;
  /** 表の見出し */
  head: string;
  /** 数を数える語（「なんにん」） */
  nan: string;
  /** 数を問う主語（「ぶどうが すきな ひと」） */
  who: (label: string) => string;
  illust?: string;
}

const THEMES: Theme[] = [
  {
    id: 'fruit',
    head: 'くだもの',
    title: 'すきな くだもの',
    labels: ['りんご', 'みかん', 'バナナ', 'いちご', 'ぶどう'],
    unit: 'にん',
    nan: 'なんにん',
    who: (l) => `${l}が すきな ひと`,
  },
  {
    id: 'animal',
    head: 'どうぶつ',
    title: 'すきな どうぶつ',
    labels: ['いぬ', 'ねこ', 'うさぎ', 'ハムスター'],
    unit: 'にん',
    nan: 'なんにん',
    who: (l) => `${l}が すきな ひと`,
  },
  {
    id: 'play',
    head: 'あそび',
    title: 'すきな あそび',
    labels: ['なわとび', 'ボール', 'おにごっこ', 'すなば'],
    unit: 'にん',
    nan: 'なんにん',
    who: (l) => `${l}が すきな ひと`,
  },
  {
    id: 'ride',
    head: 'のりもの',
    title: 'のって みたい のりもの',
    labels: ['でんしゃ', 'バス', 'ふね', 'ひこうき'],
    unit: 'にん',
    nan: 'なんにん',
    who: (l) => `${l}に のって みたい ひと`,
  },
  {
    id: 'bird',
    head: 'ばしょ',
    title: 'みつけた とりの かず',
    labels: ['いけ', 'もり', 'にわ', 'かわら'],
    unit: 'わ',
    nan: 'なんわ',
    who: (l) => `${l}で みつけた とり`,
    illust: 'bird',
  },
  {
    id: 'flower',
    head: 'ばしょ',
    title: 'さいた はなの かず',
    labels: ['はなだん', 'うえきばち', 'はたけ'],
    unit: 'ほん',
    nan: 'なんぼん',
    who: (l) => `${l}に さいた はな`,
    illust: 'flower',
  },
  {
    id: 'apple',
    head: 'き',
    title: 'とれた りんごの かず',
    labels: ['1ばんの き', '2ばんの き', '3ばんの き', '4ばんの き'],
    unit: 'こ',
    nan: 'なんこ',
    who: (l) => `${l}で とれた りんご`,
    illust: 'apple',
  },
];

interface Data {
  theme: Theme;
  labels: string[];
  values: number[];
}

/** 項目3〜4と数1〜8。unique: いちばん大きい数・小さい数が1つずつ */
function makeData(rng: Rng, unique: boolean): Data {
  const theme = THEMES[rng.int(0, THEMES.length - 1)]!;
  const n = theme.labels.length >= 4 && rng.next() < 0.5 ? 4 : 3;
  const labels = rng.sample(theme.labels, n);
  for (;;) {
    const values = labels.map(() => rng.int(1, 8));
    const mx = Math.max(...values);
    const mn = Math.min(...values);
    if (mx === mn) continue;
    if (
      unique &&
      (values.filter((v) => v === mx).length > 1 || values.filter((v) => v === mn).length > 1)
    )
      continue;
    return { theme, labels, values };
  }
}

const keyOf = (d: Data) =>
  `${d.theme.id}:${d.labels.map((l, i) => `${l}${d.values[i]}`).join(',')}`;

function graphData(d: Data, table: boolean, max?: number): GraphData {
  return table
    ? {
        kind: 'table',
        labels: d.labels,
        values: d.values,
        header: [d.theme.head, 'かず'],
        title: d.theme.title,
      }
    : {
        kind: 'picture',
        labels: d.labels,
        values: d.values,
        illust: d.theme.illust,
        max: max ?? 9,
        unit: d.theme.unit,
        title: d.theme.title,
      };
}

function item(
  obj: Obj,
  level: number,
  id: string,
  alt: boolean,
  rest: Pick<GraphItem, 'prompt' | 'hints' | 'explain' | 'data' | 'task'>,
): GraphItem {
  return { engine: 'graph', id, objective: obj, level, identity: id, alt, ...rest };
}

function yomu(level: number, rng: Rng, alt: boolean): GraphItem {
  const d = makeData(rng, true);
  const most = rng.next() < 0.6;
  const target = most ? Math.max(...d.values) : Math.min(...d.values);
  const opposite = most ? Math.min(...d.values) : Math.max(...d.values);
  const ans = d.labels[d.values.indexOf(target)]!;
  const word = most ? 'おおい' : 'すくない';
  const id = `${alt ? 'table' : 'pic'}-${most ? 'most' : 'least'}:${keyOf(d)}`;
  return item('yomu', level, id, alt, {
    prompt: `いちばん ${word}のは どれ？`,
    hints: alt
      ? [
          'ひょうの かずを みよう。',
          `かずを くらべて、いちばん ${most ? 'おおきい' : 'ちいさい'} かずを さがそう。`,
          `${d.values.join('、')} の なかで いちばん ${most ? 'おおきい' : 'ちいさい'} かずは どれかな。`,
        ]
      : [
          '○の たかさを くらべよう。',
          `いちばん ${most ? 'たかく' : 'ひくく'} ならんで いるのは どれかな。`,
          `${most ? 'たかい' : 'ひくい'} ものを 2つ えらんで、くらべて みよう。`,
        ],
    explain: `${ans}が ${target}${d.theme.unit}で いちばん ${word}よ。`,
    data: graphData(d, alt),
    task: {
      kind: 'choice',
      options: d.labels.map((l, i) =>
        l === ans
          ? { label: l, correct: true }
          : {
              label: l,
              misconception: d.values[i] === opposite ? 'mis-opposite' : 'mis-not-tallest',
            },
      ),
    },
  });
}

function kazu(level: number, rng: Rng, alt: boolean): GraphItem {
  const d = makeData(rng, false);
  if (alt) {
    // かずから 項目を えらぶ（その数の項目が1つだけ）
    const once = d.values.filter((v) => d.values.filter((x) => x === v).length === 1);
    const v = once.length ? once[rng.int(0, once.length - 1)]! : d.values[0]!;
    const i = d.values.indexOf(v);
    if (d.values.filter((x) => x === v).length !== 1) return kazu(level, rng, false);
    const id = `pick-by-count:${keyOf(d)}:${v}`;
    return item('kazu', level, id, true, {
      prompt: `${v}${d.theme.unit}なのは どれ？`,
      hints: [
        'それぞれの れつの ○を かぞえよう。',
        'したから 1つずつ かぞえよう。',
        `○が ${v}こ ならんで いる れつを さがそう。`,
      ],
      explain: `${d.labels[i]}の れつは ○が ${v}こ。${d.labels[i]}が ${v}${d.theme.unit} だよ。`,
      data: graphData(d, false),
      task: {
        kind: 'choice',
        options: d.labels.map((l, k) =>
          k === i ? { label: l, correct: true } : { label: l, misconception: 'mis-miscount' },
        ),
      },
    });
  }
  const i = rng.int(0, d.labels.length - 1);
  const v = d.values[i]!;
  const id = `count:${keyOf(d)}:${d.labels[i]}`;
  return item('kazu', level, id, false, {
    prompt: `${d.theme.who(d.labels[i]!)}は ${d.theme.nan}？`,
    hints: [
      `${d.labels[i]}の れつを みよう。`,
      'したから 1つずつ かぞえよう。',
      '5まで かぞえたら、のこりを かぞえよう。',
    ],
    explain: `${d.labels[i]}の れつは ○が ${v}こ。${v}${d.theme.unit} だよ。`,
    data: graphData(d, false),
    task: {
      kind: 'number',
      fields: [{ label: d.theme.unit, answer: { kind: 'int', value: v } }],
      wrongAnswers: [
        { value: String(v + 1), misconception: 'mis-miscount' },
        ...(v > 1 ? [{ value: String(v - 1), misconception: 'mis-miscount' }] : []),
      ],
    },
  });
}

function chigai(level: number, rng: Rng, alt: boolean): GraphItem {
  const d = makeData(rng, false);
  let i = rng.int(0, d.labels.length - 1);
  let j = rng.int(0, d.labels.length - 1);
  while (j === i || d.values[i] === d.values[j]) {
    i = rng.int(0, d.labels.length - 1);
    j = rng.int(0, d.labels.length - 1);
  }
  const [a, b] = [d.values[i]!, d.values[j]!];
  const big = a > b ? d.labels[i]! : d.labels[j]!;
  const small = a > b ? d.labels[j]! : d.labels[i]!;
  const diff = Math.abs(a - b);
  const id = `${alt ? 'table' : 'pic'}-diff:${keyOf(d)}:${[d.labels[i], d.labels[j]].sort().join('-')}`;
  const wrongs: { value: string; misconception: string }[] = [
    { value: String(a + b), misconception: 'mis-add' },
    { value: String(Math.max(a, b)), misconception: 'mis-one-number' },
  ];
  return item('chigai', level, id, alt, {
    // 「みかんは ぶどうより なんにん」だと みかんが ひとに なるので、かぞえる ものを 主語に する
    prompt: `${d.theme.who(big)}は ${d.theme.who(small)}より ${d.theme.nan} おおい？`,
    hints: alt
      ? [
          'ひょうで 2つの かずを みよう。',
          'ちがいは ひきざんで もとめるよ。',
          `${Math.max(a, b)} − ${Math.min(a, b)} を かんがえよう。`,
        ]
      : [
          `${big}と ${small}の れつを くらべよう。`,
          `${small}より たかく でて いる ○を かぞえよう。`,
          `${Math.max(a, b)} − ${Math.min(a, b)} を かんがえよう。`,
        ],
    explain: `${big}は ${Math.max(a, b)}、${small}は ${Math.min(a, b)}。${Math.max(a, b)} − ${Math.min(a, b)} ＝ ${diff}で、${diff}${d.theme.unit} おおいよ。`,
    data: graphData(d, alt),
    task: {
      kind: 'number',
      fields: [{ label: d.theme.unit, answer: { kind: 'int', value: diff } }],
      wrongAnswers: wrongs.filter((w) => w.value !== String(diff)),
    },
  });
}

function tsukuru(level: number, rng: Rng, alt: boolean): GraphItem {
  const d = makeData(rng, false);
  const id = `${alt ? 'make-text' : 'make'}:${keyOf(d)}`;
  const list = d.labels.map((l, i) => `${l} ${d.values[i]}${d.theme.unit}`).join('、');
  return item('tsukuru', level, id, alt, {
    prompt: alt
      ? `${d.theme.title}を しらべたら、${list} でした。えグラフに しよう。`
      : 'ひょうを みて、えグラフを つくろう。',
    hints: [
      alt ? 'ぶんの なかの かずを 1つずつ みよう。' : 'ひょうの かずを 1つずつ みよう。',
      'れつを タップすると、その たかさまで ○が つまれるよ。',
      `${d.labels[0]}は ${d.values[0]}。したから ${d.values[0]}こめの ところを タップしよう。のこりも おなじように。`,
    ],
    explain: `${list}。○を かずの ぶんだけ したから つむと、たかさで くらべられるよ。`,
    data: graphData(d, false, 9),
    task: { kind: 'make', showTable: !alt },
  });
}

const LEVELS: Obj[][] = [
  ['yomu', 'kazu'],
  ['yomu', 'kazu', 'chigai'],
  ['tsukuru', 'chigai', 'yomu', 'tsukuru'],
];

export function generatePictureGraph(level: number, rng: Rng, index: number): Item {
  const objs = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = objs[(index + rng.int(0, objs.length - 1)) % objs.length]!;
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'yomu':
      return yomu(level, rng, alt);
    case 'kazu':
      return kazu(level, rng, alt);
    case 'chigai':
      return chigai(level, rng, alt);
    case 'tsukuru':
      return tsukuru(level, rng, alt);
  }
}

export const pictureGraph: UnitSpec = {
  id: 'g1.math.picture-graph',
  title: 'えグラフ',
  stage: 'g1',
  subject: 'math',
  domain: 'D-data',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-sansu',
  prereq: ['g1.math.numbers-10'],
  objectives: [
    { id: 'yomu', title: 'いちばん おおい・すくないを よむ' },
    { id: 'kazu', title: 'かずを よむ' },
    { id: 'chigai', title: 'ちがいを よむ' },
    { id: 'tsukuru', title: 'えグラフを つくる' },
  ],
  misconceptions: [
    {
      id: 'mis-opposite',
      explain:
        '「おおい」と 「すくない」を はんたいに したのかな。いちばん たかい れつが いちばん おおいよ。',
    },
    {
      id: 'mis-not-tallest',
      explain:
        'ならんで いる ばしょで えらんだのかな。○の たかさを くらべよう。いちばん たかい（ひくい）れつを さがそう。',
    },
    {
      id: 'mis-miscount',
      explain: '○を かぞえる ときに 1つ ずれたのかな。したから ゆびで おさえて かぞえよう。',
    },
    {
      id: 'mis-add',
      explain: 'ふたつの かずを たしたのかな。「いくつ おおい」は ちがいなので ひきざん だよ。',
    },
    {
      id: 'mis-one-number',
      explain:
        'おおい ほうの かずを そのまま かいたのかな。2つの れつの たかさの ちがいを みよう。',
    },
  ],
  levels: [
    { label: 'えグラフを よむ', chance: 0.05 },
    { label: 'ちがいを よむ', chance: 0.05 },
    { label: 'えグラフを つくる', chance: 0.05 },
  ],
  intro: [
    {
      text: 'すきな くだものを しらべました。りんご 4にん、みかん 6にん、バナナ 2にん。',
      figure: {
        kind: 'table',
        header: ['くだもの', 'かず'],
        rows: [
          ['りんご', '4'],
          ['みかん', '6'],
          ['バナナ', '2'],
        ],
      },
    },
    {
      text: 'ひとり ○1こで、したから おなじ おおきさで ならべると、たかさで くらべられます。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'blocks', ones: 4, tone: 'a' },
          { kind: 'blocks', ones: 6, tone: 'a' },
          { kind: 'blocks', ones: 2, tone: 'a' },
        ],
        gap: 6,
      },
    },
    {
      text: 'いちばん たかい みかんが いちばん おおい。みかんは バナナより 4にん おおい です。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generatePictureGraph(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第1学年 D 絵や図を用いた数量の表現',
  revised: REVISED,
};
