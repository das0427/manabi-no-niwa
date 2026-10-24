/**
 * p23.math.shop おかいものごっこ（curriculum-matrix 3.1）。
 * L2（段階0）: 「〇〇 ちょうだい」で 2つの品物から渡す（数は問わない）。
 * L3（段階1）: 「〇〇を ふたつ ください」1〜3（数詞は ひとつずつ: 研R8）。
 * 同一性キー: 段階0 は 品物の組、段階1 は 頼む数と並べた数の組（品物の絵柄は同じとみなす: 1.4）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { choiceItem, ill } from './lib';

const GOODS: { id: string; name: string }[] = [
  { id: 'apple', name: 'りんご' },
  { id: 'banana', name: 'バナナ' },
  { id: 'mikan', name: 'みかん' },
  { id: 'strawberry', name: 'いちご' },
  { id: 'carrot', name: 'にんじん' },
  { id: 'tomato', name: 'トマト' },
  { id: 'bread', name: 'パン' },
  { id: 'egg', name: 'たまご' },
  { id: 'onigiri', name: 'おにぎり' },
  { id: 'peach', name: 'もも' },
  { id: 'watermelon', name: 'すいか' },
  { id: 'lemon', name: 'レモン' },
];
const CUSTOMERS: { id: string; name: string }[] = [
  { id: 'bear', name: 'くまさん' },
  { id: 'rabbit', name: 'うさぎさん' },
  { id: 'monkey', name: 'おさるさん' },
];
const WORD = ['', 'ひとつ', 'ふたつ', 'みっつ'];
const COUNTING = ['', 'いち', 'いち、に', 'いち、に、さん'];

function nameItem(i: number, alt: boolean): Item {
  const g = GOODS[i]!;
  const w = GOODS[(i + 5) % GOODS.length]!;
  const c = CUSTOMERS[i % CUSTOMERS.length]!;
  const id = `name:${g.id}:${w.id}${alt ? ':alt' : ''}`;
  return choiceItem({
    id,
    objective: 'name',
    level: 0,
    alt,
    figure: alt ? ill(c.id) : undefined,
    prompt: alt ? `${c.name}が ${g.name}を ほしいって。どっちかな？` : `${g.name} ちょうだい。`,
    hints: [`「${g.name}」を さがそう。`, `${g.name}の えは どっちかな。`],
    explain: `${g.name}、ありがとう。`,
    identity: id,
    correct: { label: g.name, figure: ill(g.id) },
    wrong: [{ label: w.name, figure: ill(w.id), misconception: 'other-goods' }],
  });
}

function countItem(n: number, shown: number[], gi: number, alt: boolean): Item {
  const g = GOODS[gi % GOODS.length]!;
  const id = `count:${n}:${shown.join('-')}${alt ? ':alt' : ''}`;
  const fig = (k: number) => (alt ? ({ kind: 'blocks', ones: k } as const) : ill(g.id, k));
  return choiceItem({
    id: `${id}:${g.id}`,
    objective: 'count',
    level: 1,
    alt,
    prompt: alt ? `つみきを ${WORD[n]} ちょうだい。` : `${g.name}を ${WORD[n]} ください。`,
    hints: ['ゆびで さわりながら かぞえよう。', `「${COUNTING[n]}」で ${WORD[n]}。`],
    explain: `${COUNTING[n]}。${WORD[n]} だね。`,
    identity: id,
    correct: { label: `${alt ? 'つみき' : g.name} ${WORD[n]}`, figure: fig(n) },
    wrong: shown
      .filter((k) => k !== n)
      .map((k) => ({
        label: `${alt ? 'つみき' : g.name} ${WORD[k]}`,
        figure: fig(k),
        misconception: k > n ? 'too-many' : 'too-few',
      })),
  });
}

function build(): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < 9; i++) items.push(nameItem(i, false));
  for (let i = 9; i < 12; i++) items.push(nameItem(i, true));
  // 段階1: 頼む数 n と並べる数の組（3択）
  const SETS: [number, number[]][] = [
    [1, [1, 2, 3]],
    [2, [1, 2, 3]],
    [3, [1, 2, 3]],
    [1, [1, 2]],
    [2, [1, 2]],
    [2, [2, 3]],
    [3, [2, 3]],
  ];
  SETS.forEach(([n, s], i) => items.push(countItem(n, s, i, false)));
  items.push(
    countItem(1, [1, 3], 0, true),
    countItem(2, [1, 2, 3], 0, true),
    countItem(3, [1, 3], 0, true),
  );
  return items;
}

export const shopUnit: UnitSpec = {
  id: 'p23.math.shop',
  title: 'おかいものごっこ',
  stage: 'p23',
  subject: 'math',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shopping',
  prereq: [],
  objectives: [
    { id: 'name', title: 'なまえを きいて わたす' },
    { id: 'count', title: '1〜3こ わたす' },
  ],
  misconceptions: [
    {
      id: 'other-goods',
      explain: 'それも おいしそうだね。たのまれたのは どれだったかな。もういちど きこう。',
    },
    { id: 'too-many', explain: 'ちょっと おおかったかな。ひとつずつ かぞえて みよう。' },
    { id: 'too-few', explain: 'もうすこし ほしいみたい。ひとつずつ かぞえて みよう。' },
  ],
  levels: [
    { label: '2さいの だんかい: なまえを きいて わたす（かずは とわない）', chance: 0.5 },
    { label: '3さいの だんかい: 1〜3こ わたす', chance: 1 / 3 },
  ],
  intro: [
    { text: 'おみせやさん ごっこを しよう。「りんご ちょうだい」', figure: ill('apple') },
    { text: 'りんごを わたすと「ありがとう」。', figure: ill('apple') },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis:
    '保育所保育指針 1歳以上3歳未満児 人間関係（ごっこ遊び）、研R8（数詞は1つずつ）、curriculum-matrix 3.1',
  revised: '2026-10-24',
};
