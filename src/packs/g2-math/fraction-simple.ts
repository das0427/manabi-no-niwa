/**
 * g2.math.fraction-simple 簡単な分数（curriculum-matrix 3.5）。
 * 折り紙を半分に → 図を選ぶ →「もとの 1/2」の量。
 *
 * 範囲（統括の依頼・本アプリの判断）: 学習指導要領 第2学年の「1/2、1/4 など」（具体値は EJM 7-3 で要確認）を、
 * [[1/2]]・[[1/4]]・[[1/3]] の3つ（もとの大きさの何分の一）にとどめる。分数の数直線・加減・2/3 などは3年。
 * 分数を答えとして入力させない（数の入力は「もとの 1/2 は いくつ」の整数だけ）。
 *
 * 手作り（生成した一覧）の問題。同一性キー: 問う形 × 分数 × 図の形 × 誤りの選択肢の組。
 */
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, ChoiceOption, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { wrongList } from './util';

type K = 2 | 3 | 4;
const FR: Record<K, string> = { 2: '[[1/2]]', 3: '[[1/3]]', 4: '[[1/4]]' };
const NAME: Record<K, string> = { 2: 'にぶんの いち', 3: 'さんぶんの いち', 4: 'よんぶんの いち' };
const OBJ: Record<K, string> = { 2: 'half', 3: 'third', 4: 'quarter' };

const S = 'stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"';
/** 色を ぬった ところは 斜線も 引く（色だけで区別しない） */
const HATCH =
  '<defs><pattern id="g2m-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--sun)"/><line x1="0" y1="0" x2="0" y2="8" stroke="var(--ink)" stroke-width="2"/></pattern></defs>';
const fillOf = (on: boolean) => (on ? 'url(#g2m-hatch)' : 'var(--white)');
const svg = (label: string, w: number, h: number, body: string): Figure => ({
  kind: 'svg',
  label,
  markup: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${HATCH}${body}</svg>`,
});

type Style = 'tape' | 'square' | 'circle' | 'diag' | 'grid' | 'hstrip';

/** 幅の比（等分なら全部 1） */
function stripsFig(
  style: 'tape' | 'square' | 'hstrip',
  widths: number[],
  colored: number[],
): Figure {
  const W = style === 'tape' ? 200 : 100;
  const H = style === 'tape' ? 40 : 100;
  const total = widths.reduce((s, x) => s + x, 0);
  let pos = 0;
  const parts = widths.map((w, i) => {
    const len = ((style === 'hstrip' ? H : W) * w) / total;
    const r =
      style === 'hstrip'
        ? `<rect x="2" y="${2 + pos}" width="${W - 4}" height="${len}" fill="${fillOf(colored.includes(i))}" ${S}/>`
        : `<rect x="${2 + pos}" y="2" width="${len}" height="${H - 4}" fill="${fillOf(colored.includes(i))}" ${S}/>`;
    pos += len;
    return r;
  });
  // 最後の rect が はみ出さないよう 全体の大きさを少し広げる
  return svg('わけた かたち', W + 4, H + 4, parts.join(''));
}

/** 円を角度の比で分ける */
function circleFig(angles: number[], colored: number[]): Figure {
  const total = angles.reduce((s, x) => s + x, 0);
  const c = 52;
  const r = 48;
  let a0 = -90;
  const pt = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(c + r * Math.cos(rad)).toFixed(2)} ${(c + r * Math.sin(rad)).toFixed(2)}`;
  };
  const body = angles
    .map((a, i) => {
      const deg = (360 * a) / total;
      const p = `<path d="M${c} ${c} L${pt(a0)} A${r} ${r} 0 ${deg > 180 ? 1 : 0} 1 ${pt(a0 + deg)} Z" fill="${fillOf(colored.includes(i))}" ${S}/>`;
      a0 += deg;
      return p;
    })
    .join('');
  return svg('わけた まる', 104, 104, body);
}

/** 正方形を 対角線で 2つ・4つに */
function diagFig(k: 2 | 4, colored: number[]): Figure {
  const tri =
    k === 2
      ? ['2,2 102,2 102,102', '2,2 2,102 102,102']
      : ['2,2 102,2 52,52', '102,2 102,102 52,52', '102,102 2,102 52,52', '2,102 2,2 52,52'];
  return svg(
    'わけた しかく',
    104,
    104,
    tri
      .map((p, i) => `<polygon points="${p}" fill="${fillOf(colored.includes(i))}" ${S}/>`)
      .join(''),
  );
}

/** 正方形を 2×2 に */
function gridFig(colored: number[]): Figure {
  const cells = [
    [2, 2],
    [52, 2],
    [2, 52],
    [52, 52],
  ];
  return svg(
    'わけた しかく',
    104,
    104,
    cells
      .map(
        ([x, y], i) =>
          `<rect x="${x}" y="${y}" width="50" height="50" fill="${fillOf(colored.includes(i))}" ${S}/>`,
      )
      .join(''),
  );
}

/** 形と分け方から図 */
function fig(style: Style, parts: number[], colored: number[]): Figure {
  if (style === 'circle') return circleFig(parts, colored);
  if (style === 'diag') return diagFig(parts.length as 2 | 4, colored);
  if (style === 'grid') return gridFig(colored);
  return stripsFig(style, parts, colored);
}

const eq = (n: number) => Array.from({ length: n }, () => 1);
/** 等しくない分け方（n こ） */
const UNEQ: Record<number, number[][]> = {
  2: [
    [1, 2],
    [3, 2],
  ],
  3: [
    [1, 2, 1],
    [2, 1, 3],
  ],
  4: [
    [1, 2, 1, 3],
    [2, 1, 1, 2],
  ],
};

/** その形で 作れる等分（diag は 2・4、grid は 4 だけ） */
const STYLES: Record<K, Style[]> = {
  2: ['tape', 'square', 'circle', 'diag', 'hstrip'],
  3: ['tape', 'square', 'circle', 'hstrip'],
  4: ['tape', 'square', 'circle', 'diag', 'grid'],
};

/** [[1/k]] に色をぬったのを選ぶ */
function pickItems(k: K, level: number): ChoiceItem[] {
  const out: ChoiceItem[] = [];
  for (const style of STYLES[k]) {
    const nonEq = style === 'diag' || style === 'grid' ? 'tape' : style; // 等しくない分け方は帯・円で
    for (let v = 0; v < 2; v++) {
      const otherK = ([2, 3, 4] as K[]).filter((x) => x !== k)[v]!;
      const otherStyle = STYLES[otherK].includes(style) ? style : 'tape';
      const options: ChoiceOption[] = [
        { figure: fig(style, style === 'grid' ? eq(4) : eq(k), [0]), correct: true },
        {
          figure: fig(nonEq, UNEQ[k]![v]!, [0]),
          misconception: 'unequal-parts',
        },
        { figure: fig(otherStyle, eq(otherK), [0]), misconception: 'count-den' },
      ];
      if (k !== 2)
        options.push({
          figure: fig(style === 'grid' || style === 'diag' ? 'tape' : style, eq(k), [0, 1]),
          misconception: 'colored-count',
        });
      out.push({
        engine: 'choice',
        id: `pick:${k}:${style}:${v}`,
        objective: OBJ[k],
        level,
        prompt: `${FR[k]}（${NAME[k]}）に いろを ぬった のは どれ？`,
        hints: [
          'いくつに わけて あるか、おなじ おおきさに わけて あるかを みよう。',
          `${FR[k]}は、もとの おおきさを おなじ おおきさに ${k}つに わけた 1つ ぶん。`,
          `${k}つに わけた ものの なかで、わけた 1つ 1つが おなじ おおきさの ものは どれかな。`,
        ],
        explain: `おなじ おおきさに ${k}つに わけた 1つ ぶんが ${FR[k]}です。おおきさが ちがう わけかたは ${FR[k]}では ありません。`,
        explainFigure: fig(style, style === 'grid' ? eq(4) : eq(k), [0]),
        identity: `pick:${k}:${style}:${v}`,
        alt: false,
        layout: 'row',
        options,
      });
    }
  }
  return out;
}

/** 図の ぬった ところは もとの なんぶんの いち？（別例） */
function nameItems(k: K, level: number): ChoiceItem[] {
  return STYLES[k].map((style) => {
    const colored = [style === 'grid' ? 3 : k - 1];
    return {
      engine: 'choice',
      id: `name:${k}:${style}`,
      objective: OBJ[k],
      level,
      prompt: 'いろを ぬった ところは、もとの おおきさの なんぶんの いち？',
      figure: fig(style, style === 'grid' ? eq(4) : eq(k), colored),
      hints: [
        'ぜんぶで いくつに わけて あるか かぞえよう。',
        'わけた 1つ 1つは おなじ おおきさ だね。',
        `${k === 2 ? 'ふたつ' : k === 3 ? 'みっつ' : 'よっつ'}に わけた 1つ ぶん…`,
      ],
      explain: `おなじ おおきさに ${k}つに わけた 1つ ぶんなので ${FR[k]}です。`,
      identity: `name:${k}:${style}`,
      alt: true,
      fixedOrder: true,
      options: ([2, 3, 4] as K[]).map((x) =>
        x === k
          ? { label: FR[x], correct: true }
          : { label: FR[x], misconception: x === k - 1 ? 'count-rest' : 'count-den' },
      ),
    } satisfies ChoiceItem;
  });
}

/** 折り紙の言葉の問題（別例） */
function origamiItems(level: number): ChoiceItem[] {
  const qs: { k: K; text: string; id: string }[] = [
    {
      k: 2,
      id: 'fold1',
      text: 'おりがみを はんぶんに 1かい おって ひらきました。1つ ぶんは もとの なんぶんの いち？',
    },
    {
      k: 4,
      id: 'fold2',
      text: 'おりがみを はんぶんに おって、もう いちど はんぶんに おって ひらきました。1つ ぶんは もとの なんぶんの いち？',
    },
    {
      k: 3,
      id: 'cake',
      text: 'ケーキを おなじ おおきさに 3つに きりました。1きれは もとの なんぶんの いち？',
    },
    {
      k: 2,
      id: 'apple',
      text: 'りんごを おなじ おおきさに 2つに きりました。1つは もとの なんぶんの いち？',
    },
    {
      k: 4,
      id: 'pizza',
      text: 'まるい パンを おなじ おおきさに 4つに わけました。1つは もとの なんぶんの いち？',
    },
    {
      k: 3,
      id: 'ribbon',
      text: 'リボンを おなじ ながさに 3つに きりました。1本《ぽん》は もとの なんぶんの いち？',
    },
    {
      k: 4,
      id: 'tape4',
      text: 'テープを はんぶんに きって、それを また はんぶんに きりました。1本《ぽん》は もとの なんぶんの いち？',
    },
    {
      k: 2,
      id: 'bread',
      text: 'パンを おなじ おおきさに はんぶんに しました。1つは もとの なんぶんの いち？',
    },
    {
      k: 3,
      id: 'paper3',
      text: 'かみを おなじ はばで 3つに おりました。1つ ぶんは もとの なんぶんの いち？',
    },
  ];
  return qs.map((q) => ({
    engine: 'choice',
    id: `words:${q.id}`,
    objective: OBJ[q.k],
    level,
    prompt: q.text,
    hints: [
      'ぜんぶで いくつに わけたかを かんがえよう。',
      'はんぶんの はんぶんは、4つに わけた 1つ だよ。',
      `${q.k}つに わけた 1つ ぶん…`,
    ],
    explain: `おなじ おおきさに ${q.k}つに わけた 1つ ぶんなので ${FR[q.k]}です。`,
    identity: `words:${q.id}`,
    alt: true,
    fixedOrder: true,
    options: ([2, 3, 4] as K[]).map((x) =>
      x === q.k ? { label: FR[x], correct: true } : { label: FR[x], misconception: 'count-den' },
    ),
  }));
}

/** もとの 大きさの 1/k は いくつ（整数で答える） */
function motoItems(level: number): NumberItem[] {
  const out: NumberItem[] = [];
  const things = ['apple', 'mikan', 'strawberry', 'egg'];
  let t = 0;
  for (const k of [2, 3, 4] as K[]) {
    for (let n = k * 2; n <= 12; n += k) {
      const id = things[t++ % things.length]!;
      const q = n / k;
      out.push({
        engine: 'number',
        id: `moto:${k}:${n}`,
        objective: 'moto',
        level,
        prompt: `${n}この ${FR[k]}は なんこ？`,
        figure: { kind: 'illust', id, count: n },
        fields: [{ label: 'こ', answer: { kind: 'int', value: q } }],
        hints: [
          `${FR[k]}は、おなじ かずずつ ${k}つに わけた 1つ ぶん。`,
          `${n}こを ${k}つの さらに 1こずつ じゅんに くばって みよう。`,
          `${k}つの さらに おなじ かずずつ。1さらは…`,
        ],
        explain: `${n}こを おなじ かずずつ ${k}つに わけると 1つ ぶんは ${q}こ。${n}この ${FR[k]}は ${q}こ です。`,
        identity: `moto:${k}:${n}`,
        alt: false,
        wrongAnswers: wrongList(String(q), 1, [
          [k, 'den-as-answer'],
          [n * k, 'den-as-answer'],
          [n - 1, 'colored-count'],
        ]),
      });
    }
  }
  // 別例: テープの長さ・もとの大きさを求める
  for (const [k, len] of [
    [2, 10],
    [4, 12],
    [3, 9],
    [2, 16],
    [4, 20],
  ] as [K, number][]) {
    out.push({
      engine: 'number',
      id: `moto-tape:${k}:${len}`,
      objective: 'moto',
      level,
      prompt: `${len}cmの テープの ${FR[k]}の ながさは なんcm？`,
      figure: {
        kind: 'tape',
        parts: Array.from({ length: k }, (_, i) => ({
          length: 1,
          label: i === 0 ? '？' : '',
          tone: i === 0 ? ('b' as const) : ('plain' as const),
        })),
        total: `${len}cm`,
      },
      fields: [{ label: 'cm', answer: { kind: 'int', value: len / k } }],
      hints: [
        `${FR[k]}は おなじ ながさに ${k}つに わけた 1つ ぶん。`,
        `${len / k}cmが ${k}つで ${len}cm に なるかな。`,
        `□cmが ${k}つ ぶんで ${len}cm。`,
      ],
      explain: `${len}cmを おなじ ながさに ${k}つに わけると ${len / k}cm です。`,
      identity: `moto-tape:${k}:${len}`,
      alt: true,
      wrongAnswers: wrongList(String(len / k), 1, [
        [k, 'den-as-answer'],
        [len * k, 'den-as-answer'],
      ]),
    });
  }
  for (const [k, part] of [
    [2, 4],
    [3, 2],
    [4, 3],
  ] as [K, number][]) {
    out.push({
      engine: 'number',
      id: `moto-whole:${k}:${part}`,
      objective: 'moto',
      level,
      prompt: `あめの ${FR[k]}は ${part}こ でした。もとの あめは なんこ？`,
      figure: {
        kind: 'tape',
        parts: Array.from({ length: k }, (_, i) => ({
          length: 1,
          label: i === 0 ? `${part}こ` : '',
          tone: i === 0 ? ('b' as const) : ('plain' as const),
        })),
        total: '？こ',
      },
      fields: [{ label: 'こ', answer: { kind: 'int', value: part * k } }],
      hints: [
        `${FR[k]}が ${k}つ あつまると もとの おおきさ。`,
        `${part}こが ${k}つ ぶん。`,
        `${part} × ${k} を けいさん しよう。`,
      ],
      explain: `${FR[k]}が ${k}つで もとの おおきさ。${part}こが ${k}つで ${part * k}こ です。`,
      identity: `moto-whole:${k}:${part}`,
      alt: true,
      wrongAnswers: wrongList(String(part * k), 1, [
        [part, 'den-as-answer'],
        [part + k, 'den-as-answer'],
      ]),
    });
  }
  return out;
}

const ITEMS: Item[] = [
  ...pickItems(2, 0),
  ...pickItems(4, 0),
  ...pickItems(3, 1),
  ...nameItems(2, 0),
  ...nameItems(4, 0),
  ...nameItems(3, 1),
  ...origamiItems(1),
  ...motoItems(1),
];

export const fractionSimple: UnitSpec = {
  id: 'g2.math.fraction-simple',
  title: 'ぶんすう（[[1/2]]・[[1/4]]・[[1/3]]）',
  stage: 'g2',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'math-split',
  prereq: [],
  objectives: [
    { id: 'half', title: '[[1/2]]（はんぶん）' },
    { id: 'quarter', title: '[[1/4]]' },
    { id: 'third', title: '[[1/3]]' },
    { id: 'moto', title: 'もとの おおきさの [[1/2]]・[[1/3]]・[[1/4]]' },
  ],
  misconceptions: [
    {
      id: 'unequal-parts',
      explain:
        '4つに わけて あっても、おおきさが ちがうと [[1/4]]とは いわないよ。おなじ おおきさに わけて いるか みよう。',
      figure: stripsFig('tape', [1, 2, 1, 3], [0]),
    },
    {
      id: 'count-den',
      explain:
        'いくつに わけて あるかを かぞえなおそう。2つなら [[1/2]]、3つなら [[1/3]]、4つなら [[1/4]] だよ。',
    },
    {
      id: 'count-rest',
      explain:
        'いろを ぬって いない ところの かずを かぞえたのかな。ぜんぶで いくつに わけたかを かぞえよう。',
    },
    {
      id: 'colored-count',
      explain: 'いろを ぬった ところが 2つ あるね。[[1/4]]は わけた うちの 1つ ぶん だよ。',
    },
    {
      id: 'den-as-answer',
      explain:
        'わける かずと こたえを まぜたのかな。おなじ かずずつ わけて、1つ ぶんの かずを かぞえよう。',
    },
  ],
  levels: [
    { label: '[[1/2]]・[[1/4]]', chance: 0.25 },
    { label: '[[1/3]]・もとの おおきさ', chance: 0.25 },
  ],
  intro: [
    {
      text: 'おりがみを ぴったり はんぶんに おります。おなじ おおきさに 2つに わけた 1つ ぶんを、もとの おおきさの [[1/2]]（にぶんの いち）と いいます。',
      figure: diagFig(2, [0]),
    },
    {
      text: 'もう いちど はんぶんに おると、おなじ おおきさに 4つに わけた 1つ ぶん。[[1/4]]（よんぶんの いち）です。',
      figure: gridFig([0]),
    },
    {
      text: 'おなじ おおきさに 3つに わけた 1つ ぶんは [[1/3]]（さんぶんの いち）。おおきさが ちがう わけかたでは いいません。',
      figure: stripsFig('tape', eq(3), [0]),
    },
  ],
  source: { kind: 'items', items: ITEMS },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第2学年 A(4) 簡単な分数（1/2、1/4 など。具体値は解説の文脈によるため要確認: EJM 7-3）。1/3 を含めるのは本アプリの判断',
  revised: '2026-10-24',
};
