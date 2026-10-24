/**
 * g1.ja.vocab-groups ことばの なかま（いみの まとまり。curriculum-matrix 3.4）。
 *
 * 到達項目:
 *   sort … なかまに わける（え）。別例: ことばの カードで わける
 *   name … なかまを まとめて いう ことば（くだもの・のりもの）を えらぶ。別例: えを みて えらぶ
 *   odd  … なかまで ない ものを えらぶ。別例: えの せんたくし
 * 同一性キー: わける カードの くみ・なかまの くみ。
 * くだもの／やさいの さかいが あいまいな もの（いちご・すいか・メロン・トマト）は くだもの と やさいの もんだいに つかわない。
 */
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import type { SortItem } from '../../engines/sort/sort';
import { opts, REVISED } from './util';

type Group =
  | 'くだもの'
  | 'やさい'
  | 'どうぶつ'
  | 'のりもの'
  | 'いろ'
  | 'からだ'
  | 'ぶんぼうぐ'
  | 'ふく'
  | 'てんき'
  | 'むし'
  | 'がっき';

/** えの ある もの（絵ID） */
const PIC: Record<string, { id: string; g: Group }> = {
  りんご: { id: 'apple', g: 'くだもの' },
  バナナ: { id: 'banana', g: 'くだもの' },
  みかん: { id: 'mikan', g: 'くだもの' },
  もも: { id: 'peach', g: 'くだもの' },
  レモン: { id: 'lemon', g: 'くだもの' },
  にんじん: { id: 'carrot', g: 'やさい' },
  きゅうり: { id: 'cucumber', g: 'やさい' },
  なす: { id: 'eggplant', g: 'やさい' },
  ピーマン: { id: 'green-pepper', g: 'やさい' },
  いぬ: { id: 'dog', g: 'どうぶつ' },
  ねこ: { id: 'cat', g: 'どうぶつ' },
  うさぎ: { id: 'rabbit', g: 'どうぶつ' },
  ぞう: { id: 'elephant', g: 'どうぶつ' },
  さる: { id: 'monkey', g: 'どうぶつ' },
  くま: { id: 'bear', g: 'どうぶつ' },
  きつね: { id: 'fox', g: 'どうぶつ' },
  うし: { id: 'cow', g: 'どうぶつ' },
  バス: { id: 'bus-yellow', g: 'のりもの' },
  でんしゃ: { id: 'train', g: 'のりもの' },
  ふね: { id: 'ship', g: 'のりもの' },
  ひこうき: { id: 'airplane', g: 'のりもの' },
  じてんしゃ: { id: 'bicycle', g: 'のりもの' },
  じどうしゃ: { id: 'car-red', g: 'のりもの' },
  えんぴつ: { id: 'pencil', g: 'ぶんぼうぐ' },
  はさみ: { id: 'scissors', g: 'ぶんぼうぐ' },
};

const pic = (w: string) => ({ figure: { kind: 'illust' as const, id: PIC[w]!.id }, name: w });

/** まちがえた ときの 誤概念（くだもの と やさい は とりちがえやすい） */
function misFor(from: Group, to: Group): string {
  if ((from === 'くだもの' && to === 'やさい') || (from === 'やさい' && to === 'くだもの'))
    return 'veg-fruit';
  return 'group-mix';
}

// ---- sort ----
interface SortSet {
  boxes: Group[];
  cards: [word: string, group: Group][];
  /** えで だす（false は ことばの カード = 別例） */
  pics: boolean;
}

const g = (w: string): [string, Group] => [w, PIC[w]!.g];

const SORTS: SortSet[] = [
  {
    pics: true,
    boxes: ['くだもの', 'やさい'],
    cards: [g('りんご'), g('にんじん'), g('バナナ'), g('きゅうり'), g('みかん'), g('なす')],
  },
  {
    pics: true,
    boxes: ['どうぶつ', 'のりもの'],
    cards: [g('いぬ'), g('バス'), g('ぞう'), g('ふね'), g('さる'), g('でんしゃ')],
  },
  {
    pics: true,
    boxes: ['くだもの', 'どうぶつ', 'のりもの'],
    cards: [g('もも'), g('ねこ'), g('ひこうき'), g('レモン'), g('うさぎ'), g('じてんしゃ')],
  },
  {
    pics: true,
    boxes: ['やさい', 'どうぶつ'],
    cards: [g('ピーマン'), g('くま'), g('なす'), g('きつね'), g('にんじん'), g('うし')],
  },
  {
    pics: true,
    boxes: ['くだもの', 'やさい'],
    cards: [g('もも'), g('ピーマン'), g('レモン'), g('きゅうり'), g('バナナ'), g('にんじん')],
  },
  {
    pics: true,
    boxes: ['のりもの', 'ぶんぼうぐ'],
    cards: [g('じどうしゃ'), g('えんぴつ'), g('ふね'), g('はさみ'), g('バス')],
  },
  {
    pics: true,
    boxes: ['くだもの', 'やさい', 'のりもの'],
    cards: [g('みかん'), g('なす'), g('でんしゃ'), g('りんご'), g('きゅうり'), g('ひこうき')],
  },
  {
    pics: true,
    boxes: ['どうぶつ', 'くだもの'],
    cards: [g('ぞう'), g('もも'), g('うし'), g('みかん'), g('きつね'), g('レモン')],
  },
  // ことばの カード（別例）
  {
    pics: false,
    boxes: ['いろ', 'からだ'],
    cards: [
      ['あか', 'いろ'],
      ['て', 'からだ'],
      ['あお', 'いろ'],
      ['あし', 'からだ'],
      ['きいろ', 'いろ'],
      ['くち', 'からだ'],
    ],
  },
  {
    pics: false,
    boxes: ['てんき', 'むし'],
    cards: [
      ['はれ', 'てんき'],
      ['とんぼ', 'むし'],
      ['くもり', 'てんき'],
      ['ちょう', 'むし'],
      ['ゆき', 'てんき'],
      ['せみ', 'むし'],
    ],
  },
  {
    pics: false,
    boxes: ['ふく', 'ぶんぼうぐ', 'がっき'],
    cards: [
      ['シャツ', 'ふく'],
      ['のり', 'ぶんぼうぐ'],
      ['たいこ', 'がっき'],
      ['ズボン', 'ふく'],
      ['けしゴム', 'ぶんぼうぐ'],
      ['ふえ', 'がっき'],
    ],
  },
  {
    pics: false,
    boxes: ['くだもの', 'やさい'],
    cards: [
      ['ぶどう', 'くだもの'],
      ['キャベツ', 'やさい'],
      ['なし', 'くだもの'],
      ['だいこん', 'やさい'],
      ['かき', 'くだもの'],
      ['たまねぎ', 'やさい'],
    ],
  },
];

function sortItem(s: SortSet, k: number): SortItem {
  const cards: SortItem['cards'] = s.cards.map(([w, grp]) => {
    const box = s.boxes.indexOf(grp);
    const wrongBoxes = s.boxes.flatMap((b, i) =>
      i === box ? [] : [{ box: i, misconception: misFor(grp, b) }],
    );
    return s.pics ? { ...pic(w), box, wrongBoxes } : { label: w, box, wrongBoxes };
  });
  const [w0, g0] = s.cards[0]!;
  return {
    engine: 'sort',
    id: `sort:${k}`,
    objective: 'sort',
    level: 0,
    alt: !s.pics,
    prompt: `${s.boxes.map((b) => `「${b}」`).join('と ')}に わけよう。`,
    boxes: s.boxes.map((b) => ({ label: b })),
    cards,
    hints: [
      'ひとつずつ、なにの なかまか かんがえよう。',
      s.boxes.includes('くだもの') && s.boxes.includes('やさい')
        ? 'あまくて そのまま たべる ことが おおいのが くだもの、おかずに する ことが おおいのが やさい だよ。'
        : 'おなじ はこに はいる ものは、にて いる ところが あるよ。',
      `「${w0}」は 「${g0}」の なかま だよ。のこりも かんがえよう。`,
    ],
    explain:
      s.boxes
        .map(
          (b) =>
            `「${b}」は ${s.cards
              .filter(([, x]) => x === b)
              .map(([w]) => w)
              .join('・')}`,
        )
        .join('、') + ' だよ。',
    identity: `sort:${s.cards.map(([w]) => w).join('-')}`,
  };
}

// ---- name: まとめる ことば ----
interface NameSet {
  words: string[];
  group: Group;
  other: Group;
  pics?: boolean;
}

const NAMES: NameSet[] = [
  { words: ['りんご', 'みかん', 'もも'], group: 'くだもの', other: 'やさい' },
  { words: ['にんじん', 'なす', 'きゅうり'], group: 'やさい', other: 'くだもの' },
  { words: ['バス', 'でんしゃ', 'ふね'], group: 'のりもの', other: 'どうぶつ' },
  { words: ['いぬ', 'ぞう', 'くま'], group: 'どうぶつ', other: 'のりもの' },
  { words: ['あか', 'しろ', 'みどり'], group: 'いろ', other: 'からだ' },
  { words: ['め', 'みみ', 'くち'], group: 'からだ', other: 'いろ' },
  { words: ['はれ', 'あめ', 'くもり'], group: 'てんき', other: 'むし' },
  { words: ['ばった', 'あり', 'かぶとむし'], group: 'むし', other: 'てんき' },
  { words: ['えんぴつ', 'けしゴム', 'じょうぎ'], group: 'ぶんぼうぐ', other: 'がっき' },
  { words: ['シャツ', 'ズボン', 'セーター'], group: 'ふく', other: 'ぶんぼうぐ' },
  { words: ['たいこ', 'ふえ', 'ピアノ'], group: 'がっき', other: 'ふく' },
  // えを みて（別例）
  { words: ['バナナ', 'レモン', 'もも'], group: 'くだもの', other: 'やさい', pics: true },
  { words: ['ピーマン', 'にんじん', 'なす'], group: 'やさい', other: 'くだもの', pics: true },
  {
    words: ['ひこうき', 'じてんしゃ', 'じどうしゃ'],
    group: 'のりもの',
    other: 'どうぶつ',
    pics: true,
  },
  { words: ['さる', 'うさぎ', 'きつね'], group: 'どうぶつ', other: 'のりもの', pics: true },
];

function nameItem(n: NameSet): ChoiceItem {
  return {
    engine: 'choice',
    id: `name:${n.words.join('-')}`,
    objective: 'name',
    level: 1,
    alt: !!n.pics,
    prompt: n.pics
      ? 'この えの ものを まとめて いう ことばは どれ？'
      : `「${n.words.join('」「')}」を まとめて いう ことばは どれ？`,
    figure: n.pics
      ? { kind: 'row', items: n.words.map((w) => ({ kind: 'illust' as const, id: PIC[w]!.id })) }
      : undefined,
    options: opts(n.group, [
      [n.other, misFor(n.group, n.other)],
      [n.words[0]!, 'member-as-group'],
    ]),
    hints: [
      '3つに にて いる ところは なにかな。',
      'まとめる ことばは、3つ ぜんぶに あてはまる ことば だよ。',
      `「${n.words[0]}」は なかまの ひとつ。なかまの なまえでは ないよ。`,
    ],
    explain: `${n.words.join('・')}は どれも 「${n.group}」 だよ。`,
    identity: `name:${n.group}:${n.words.join('-')}`,
  };
}

// ---- odd: なかまで ない もの ----
interface OddSet {
  members: string[];
  odd: string;
  group: Group;
  /** みかけが にて いて まちがえやすい（いろ・かたち） */
  looks?: string;
  pics?: boolean;
}

const ODDS: OddSet[] = [
  { members: ['みかん', 'ぶどう'], odd: 'にんじん', group: 'くだもの', looks: 'みかん' },
  { members: ['きゅうり', 'キャベツ'], odd: 'もも', group: 'やさい' },
  { members: ['でんしゃ', 'ふね'], odd: 'くじら', group: 'のりもの', looks: 'ふね' },
  { members: ['いぬ', 'うさぎ'], odd: 'じてんしゃ', group: 'どうぶつ' },
  { members: ['あか', 'あお'], odd: 'くつ', group: 'いろ' },
  { members: ['て', 'あし'], odd: 'てぶくろ', group: 'からだ', looks: 'て' },
  { members: ['とんぼ', 'ちょう'], odd: 'すずめ', group: 'むし', looks: 'とんぼ' },
  { members: ['ゆき', 'あめ'], odd: 'かさ', group: 'てんき', looks: 'あめ' },
  { members: ['のり', 'はさみ'], odd: 'おにぎり', group: 'ぶんぼうぐ', looks: 'のり' },
  { members: ['ふえ', 'たいこ'], odd: 'ほうき', group: 'がっき' },
  // えの せんたくし（別例）
  { members: ['りんご', 'もも'], odd: 'ピーマン', group: 'くだもの', pics: true },
  { members: ['ねこ', 'うし'], odd: 'バス', group: 'どうぶつ', pics: true },
  { members: ['ひこうき', 'でんしゃ'], odd: 'えんぴつ', group: 'のりもの', pics: true },
  { members: ['にんじん', 'なす'], odd: 'バナナ', group: 'やさい', pics: true },
];

function oddItem(o: OddSet): ChoiceItem {
  const mk = (w: string) =>
    o.pics ? { label: w, figure: { kind: 'illust' as const, id: PIC[w]!.id } } : { label: w };
  const options: ChoiceItem['options'] = [
    { ...mk(o.odd), correct: true },
    ...o.members.map((m) => ({
      ...mk(m),
      misconception: m === o.looks ? 'looks-alike' : 'odd-member',
    })),
  ];
  return {
    engine: 'choice',
    id: `odd:${o.odd}`,
    objective: 'odd',
    level: 2,
    alt: !!o.pics,
    prompt: 'なかまで ない ものは どれ？',
    options,
    hints: [
      '3つの うち 2つは おなじ なかま だよ。',
      `「${o.members[0]}」は なにの なかまかな。`,
      `「${o.members[0]}」と 「${o.members[1]}」は 「${o.group}」の なかま だよ。`,
    ],
    explain: `${o.members.join('・')}は 「${o.group}」。「${o.odd}」は ちがう なかま だよ。`,
    identity: `odd:${o.group}:${o.odd}`,
  };
}

const items: Item[] = [...SORTS.map(sortItem), ...NAMES.map(nameItem), ...ODDS.map(oddItem)];

export const vocabGroups: UnitSpec = {
  id: 'g1.ja.vocab-groups',
  title: 'ことばの なかま',
  stage: 'g1',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-sorting',
  prereq: [],
  objectives: [
    { id: 'sort', title: 'なかまに わける' },
    { id: 'name', title: 'まとめて いう ことばを しる' },
    { id: 'odd', title: 'なかまで ない ものを みつける' },
  ],
  misconceptions: [
    {
      id: 'veg-fruit',
      explain:
        'くだものと やさいを とりちがえたのかな。あまくて そのまま たべる ことが おおいのが くだもの、おかずに する ことが おおいのが やさい だよ。',
    },
    {
      id: 'group-mix',
      explain:
        'ちがう なかまの なまえと かんがえたのかな。それが なにか、もう いちど おもいうかべて みよう。',
    },
    {
      id: 'member-as-group',
      explain:
        'なかまの ひとつの なまえを えらんだのかな。まとめて いう ことばは、ぜんぶに あてはまる ことば だよ。',
    },
    {
      id: 'looks-alike',
      explain:
        'いろや かたち、なまえが にて いるから おなじ なかまと かんがえたのかな。なにに つかうか、なんの なかまかで くらべよう。',
    },
    {
      id: 'odd-member',
      explain:
        'それは ほかの ものと おなじ なかま だよ。2つずつ くらべて、なかまの なまえを いって みよう。',
    },
  ],
  levels: [
    { label: 'なかまに わける', chance: 0.02 },
    { label: 'まとめる ことば', chance: 0.1 },
    { label: 'なかまで ない もの', chance: 0.1 },
  ],
  intro: [
    {
      text: 'りんご・みかん・ももは、みんな 「くだもの」の なかま だよ。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'illust', id: 'apple' },
          { kind: 'illust', id: 'mikan' },
          { kind: 'illust', id: 'peach' },
        ],
      },
    },
    {
      text: '「くだもの」のように、なかまを まとめて いう ことばが あるよ。「のりもの」「どうぶつ」も そうだね。',
    },
    {
      text: 'バスは どの なかま かな？ ひとが のって うごくから 「のりもの」 だね。',
      figure: { kind: 'illust', id: 'bus-yellow' },
    },
  ],
  source: { kind: 'items', items },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕(1)オ（身近なことを表す語句の量を増し、話や文章の中で使うとともに、言葉には意味による語句のまとまりがあることに気付き、語彙を豊かにすること）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
