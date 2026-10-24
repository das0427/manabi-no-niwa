/**
 * p23.math.compare おおきい・ちいさい、ながい・みじかい、おおい・すくない（curriculum-matrix 3.1）。
 * L2（段階0）: 大小（辺・半径が2倍以上）の2択。L3（段階1）: 長短・多少（差2以上、1〜4こ）。
 * 同一性キー: 比べる量（大きさ・長さ・数）× 物 × 問う向き（大きい方／小さい方）× 数の組。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { choiceItem, ill } from './lib';

const svg = (label: string, viewBox: string, body: string): Figure => ({
  kind: 'svg',
  label,
  markup: `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
});
const S = 'stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round"';

/** 大きさを比べる物（100×100 の中に、倍率 k で描く） */
const SIZE_THINGS: { id: string; name: string; draw: (k: number) => string }[] = [
  {
    id: 'ball',
    name: 'ボール',
    draw: (k) => `<circle cx="50" cy="50" r="${44 * k}" fill="var(--mat-red)" ${S}/>`,
  },
  {
    id: 'box',
    name: 'はこ',
    draw: (k) =>
      `<rect x="${50 - 42 * k}" y="${50 - 42 * k}" width="${84 * k}" height="${84 * k}" fill="var(--wood)" ${S}/>`,
  },
  {
    id: 'balloon',
    name: 'ふうせん',
    draw: (k) =>
      `<path d="M50 ${50 + 30 * k} L50 98" stroke="var(--ink)" stroke-width="2.5"/><ellipse cx="50" cy="${50 - 8 * k}" rx="${30 * k}" ry="${38 * k}" fill="var(--sky)" ${S}/>`,
  },
  {
    id: 'triangle',
    name: 'やね',
    draw: (k) =>
      `<polygon points="50,${50 - 42 * k} ${50 + 46 * k},${50 + 40 * k} ${50 - 46 * k},${50 + 40 * k}" fill="var(--sun)" ${S}/>`,
  },
];

/** 長さを比べる物（200×40 の中に、長さ len で描く。左はしをそろえる） */
const LEN_THINGS: { id: string; name: string; draw: (len: number) => string }[] = [
  {
    id: 'ribbon',
    name: 'リボン',
    draw: (l) => `<rect x="4" y="12" width="${l}" height="16" rx="4" fill="var(--mat-red)" ${S}/>`,
  },
  {
    id: 'string',
    name: 'ひも',
    draw: (l) =>
      `<path d="M6 20 H${l}" stroke="var(--ink)" stroke-width="6" stroke-linecap="round"/>`,
  },
  {
    id: 'pencil',
    name: 'えんぴつ',
    draw: (l) =>
      `<rect x="4" y="10" width="${l - 22}" height="20" fill="var(--sun)" ${S}/><polygon points="${l - 18},10 ${l},20 ${l - 18},30" fill="var(--wood)" ${S}/>`,
  },
  {
    id: 'train',
    name: 'でんしゃ',
    draw: (l) => {
      const n = Math.round(l / 46);
      return Array.from(
        { length: n },
        (_, i) =>
          `<rect x="${4 + i * 46}" y="8" width="40" height="24" rx="5" fill="var(--sky)" ${S}/>`,
      ).join('');
    },
  },
];

function sizeItem(
  level: number,
  t: (typeof SIZE_THINGS)[number],
  askBig: boolean,
  alt: boolean,
): Item {
  const big = svg(`おおきい ${t.name}`, '0 0 100 100', t.draw(1));
  const small = svg(`ちいさい ${t.name}`, '0 0 100 100', t.draw(0.4));
  const id = `size:${t.id}:${askBig ? 'big' : 'small'}${alt ? ':alt' : ''}`;
  const want = askBig ? 'おおきい' : 'ちいさい';
  return choiceItem({
    id,
    objective: 'size',
    level,
    alt,
    prompt: alt
      ? askBig
        ? `ぞうさんに ${t.name}を あげよう。おおきい ほうは どっち？`
        : `ありさんに ${t.name}を あげよう。ちいさい ほうは どっち？`
      : `${want} ${t.name}は どっち？`,
    hints: [
      'ふたつを ならべて よく みよう。',
      askBig ? 'りょうてで かかえる くらいの ほうだよ。' : 'てのひらに のる くらいの ほうだよ。',
    ],
    explain: `こっちが ${want} ${t.name}。`,
    explainFigure: askBig ? big : small,
    identity: id,
    correct: { label: `${want} ${t.name}`, figure: askBig ? big : small },
    wrong: [
      {
        label: `${askBig ? 'ちいさい' : 'おおきい'} ${t.name}`,
        figure: askBig ? small : big,
        misconception: 'opposite',
      },
    ],
  });
}

function lengthItem(t: (typeof LEN_THINGS)[number], askLong: boolean, alt: boolean): Item {
  const long = svg(`ながい ${t.name}`, '0 0 200 40', t.draw(190));
  const short = svg(`みじかい ${t.name}`, '0 0 200 40', t.draw(t.id === 'train' ? 92 : 80));
  const id = `len:${t.id}:${askLong ? 'long' : 'short'}${alt ? ':alt' : ''}`;
  const want = askLong ? 'ながい' : 'みじかい';
  return choiceItem({
    id,
    objective: 'length',
    level: 1,
    alt,
    layout: 'column',
    prompt: alt
      ? askLong
        ? `たかい きに とどくのは どっちの ${t.name}かな？`
        : `ちいさな はこに はいるのは どっちの ${t.name}かな？`
      : `${want} ${t.name}は どっち？`,
    hints: [
      'ひだりの はしは そろって いるよ。みぎの はしを みよう。',
      askLong ? 'とおくまで のびて いる ほうだよ。' : 'はやく おわって いる ほうだよ。',
    ],
    explain: `こっちが ${want} ${t.name}。`,
    identity: id,
    correct: { label: `${want} ${t.name}`, figure: askLong ? long : short },
    wrong: [
      {
        label: `${askLong ? 'みじかい' : 'ながい'} ${t.name}`,
        figure: askLong ? short : long,
        misconception: 'opposite',
      },
    ],
  });
}

const COUNT_WORD = ['', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ'];
const FRUITS: { id: string; name: string }[] = [
  { id: 'apple', name: 'りんご' },
  { id: 'strawberry', name: 'いちご' },
  { id: 'mikan', name: 'みかん' },
  { id: 'carrot', name: 'にんじん' },
];

function amountItem(
  f: { id: string; name: string },
  a: number,
  b: number,
  askMore: boolean,
  alt: boolean,
): Item {
  const id = `amount:${a}-${b}:${askMore ? 'more' : 'less'}${alt ? ':alt' : ''}`;
  const want = askMore ? 'おおい' : 'すくない';
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const right = askMore ? big : small;
  const other = askMore ? small : big;
  return choiceItem({
    id: `${id}:${f.id}`,
    objective: 'amount',
    level: 1,
    alt,
    prompt: alt
      ? askMore
        ? `おなかが ぺこぺこ。${f.name}が たくさん ある おさらは どっち？`
        : `すこしだけ ほしいな。${f.name}が すくない おさらは どっち？`
      : `${f.name}が ${want} ほうは どっち？`,
    hints: [
      'ゆびで ひとつずつ さわって みよう。',
      askMore ? 'たくさん ある ほうだよ。' : 'すこしだけ の ほうだよ。',
    ],
    explain: `${f.name} ${COUNT_WORD[right]}の ほうが ${want}ね。`,
    identity: id,
    correct: { label: `${f.name} ${COUNT_WORD[right]}`, figure: ill(f.id, right) },
    wrong: [
      {
        label: `${f.name} ${COUNT_WORD[other]}`,
        figure: ill(f.id, other),
        misconception: 'opposite',
      },
    ],
  });
}

function build(): Item[] {
  const items: Item[] = [];
  // 段階0（L2）: 大小
  for (const t of SIZE_THINGS)
    for (const big of [true, false]) items.push(sizeItem(0, t, big, false));
  items.push(
    sizeItem(0, SIZE_THINGS[0]!, true, true),
    sizeItem(0, SIZE_THINGS[1]!, false, true),
    sizeItem(1, SIZE_THINGS[2]!, true, true),
  );
  // 段階1（L3）: 長短
  for (const t of LEN_THINGS)
    for (const long of [true, false]) items.push(lengthItem(t, long, false));
  items.push(
    lengthItem(LEN_THINGS[0]!, true, true),
    lengthItem(LEN_THINGS[1]!, false, true),
    lengthItem(LEN_THINGS[2]!, true, true),
  );
  // 段階1（L3）: 多少（差2以上、1〜4こ）
  const PAIRS: [number, number][] = [
    [1, 3],
    [1, 4],
    [2, 4],
  ];
  PAIRS.forEach(([a, b], i) => {
    items.push(
      amountItem(FRUITS[i]!, a, b, true, false),
      amountItem(FRUITS[(i + 1) % 4]!, a, b, false, false),
    );
  });
  items.push(
    amountItem(FRUITS[3]!, 1, 3, true, true),
    amountItem(FRUITS[0]!, 2, 4, false, true),
    amountItem(FRUITS[1]!, 1, 4, true, true),
  );
  return items;
}

export const compareUnit: UnitSpec = {
  id: 'p23.math.compare',
  title: 'おおきい・ちいさい',
  stage: 'p23',
  subject: 'math',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-compare',
  prereq: [],
  objectives: [
    { id: 'size', title: 'おおきい・ちいさい' },
    { id: 'length', title: 'ながい・みじかい' },
    { id: 'amount', title: 'おおい・すくない' },
  ],
  misconceptions: [
    {
      id: 'opposite',
      explain: 'はんたいの ほうを えらんだのかな。もういちど ふたつを くらべて みよう。',
    },
    {
      id: 'look-only',
      explain: 'ぱっと みた かんじで えらんだのかな。ゆびで さわって くらべよう。',
    },
  ],
  levels: [
    { label: '2さいの だんかい: おおきい・ちいさい', chance: 0.5 },
    { label: '3さいの だんかい: ながい・みじかい、おおい・すくない', chance: 0.5 },
  ],
  intro: [
    {
      text: 'ボールが ふたつ。こっちは おおきい、こっちは ちいさい。',
      figure: {
        kind: 'row',
        items: [
          svg('おおきい ボール', '0 0 100 100', SIZE_THINGS[0]!.draw(1)),
          svg('ちいさい ボール', '0 0 100 100', SIZE_THINGS[0]!.draw(0.4)),
        ],
      },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis: '保育所保育指針 1歳以上3歳未満児 環境（量の性質）、curriculum-matrix 3.1',
  revised: '2026-10-24',
};
