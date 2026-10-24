/**
 * g2.life.town 町の場所と人（一般的な絵＋自分の記録。正誤は例の絵についてだけ）（curriculum-matrix 3.5、生活 (3)(4)）。
 *
 * ほんとうの町たんけんは、実際に歩いて、見て、聞いて行う。この単元は、その前後に
 * 「いっぱんてきな まちの ばしょと はたらく ひと」を整理し、たんけんで見つけたことを かく補助。
 * 絵の建物は一般的な例で、特定の町・店の名前は出さない。町たんけんの記録は explain（採点しない）。
 *
 * 到達項目:
 *   place-people … 町の場所と、そこではたらく人をつなぐ（match）。別例 = はたらく人から場所を選ぶ（choice）
 *   use-rules    … 公共の場所（図書館・公園・乗り物）の使い方の約束（choice）。別例 = よいこと・よくないことに分ける（sort）
 *   my-town      … 町たんけんで見つけたことを かく（explain。採点しない）。別例 = しらべ方や気持ちを えらぶ
 * 同一性キー: 問題の id。
 */
import type { ChoiceItem, ExplainItem, Item, MatchItem, UnitSpec } from '../../curriculum/types';
import { baseLife, choiceItem, explainItem, illust, matchItem, sortItem } from './util';

// ---- place-people ----
const PLACES = {
  bakery: ['life-bakery', 'パンやさん', 'パンを やく ひと'],
  hospital: ['life-hospital', 'びょういん', 'びょうきや けがを みる ひと'],
  library: ['life-library', 'としょかん', 'ほんを かしだす ひと'],
  station: ['life-station', 'えき', 'でんしゃの のりばを あんないする ひと'],
  // 「まちの あんぜんを まもる」は しょうぼうしょの ひとにも あてはまるので、みまわり・みちあんないで いう
  police: ['life-police', 'こうばん', 'まちを みまわり、みちを おしえる ひと'],
  fire: ['life-firestation', 'しょうぼうしょ', 'かじを けす ひと'],
  flower: ['life-flowershop', 'おはなやさん', 'はなを うる ひと'],
  vege: ['life-vegeshop', 'やおやさん', 'やさいを うる ひと'],
} as const;
type Pk = keyof typeof PLACES;
interface Pm {
  id: string;
  level: number;
  keys: Pk[];
  extra: Pk[];
}
const MATCHES: Pm[] = [
  { id: 'm1', level: 0, keys: ['bakery', 'hospital', 'library'], extra: ['flower'] },
  { id: 'm2', level: 0, keys: ['station', 'police', 'fire'], extra: ['vege'] },
  { id: 'm3', level: 0, keys: ['flower', 'vege', 'bakery'], extra: ['library'] },
  { id: 'm4', level: 1, keys: ['hospital', 'police', 'library'], extra: ['bakery'] },
  { id: 'm5', level: 1, keys: ['station', 'flower', 'fire'], extra: ['hospital'] },
  { id: 'm6', level: 1, keys: ['vege', 'hospital', 'station', 'bakery'], extra: [] },
];
const matchItems: MatchItem[] = MATCHES.map((m) =>
  matchItem({
    id: `place-${m.id}`,
    obj: 'place-people',
    level: m.level,
    prompt:
      'まちの ばしょと、そこで はたらく ひとを、せんで むすぼう。（いっぱんてきな えの れいだよ）',
    pairs: m.keys.map(
      (k) =>
        [illust(PLACES[k][0]), PLACES[k][1], PLACES[k][2]] as [
          ReturnType<typeof illust>,
          string,
          string,
        ],
    ),
    extras: m.extra.map((k) => PLACES[k][2]),
    mis: 'place-mix',
    hints: [
      'えを ひとつ えらんで、なにを する ばしょか、かんがえよう。',
      'かんばんの えを みよう。パン、ほん、とけい など、ヒントが あるよ。',
      'のこった えを むすぶ ときは、まだ つかって いない ことばを さがそう。',
    ],
    explain: `${m.keys.map((k) => `${PLACES[k][1]}は「${PLACES[k][2]}」`).join('、')}が はたらく ばしょだよ。ちがう ばしょの ひとと むすばないように ね。`,
  }),
);

interface Pa {
  id: string;
  level: number;
  prompt: string;
  right: Pk;
  wrongs: [Pk, Pk];
}
const PALT: Pa[] = [
  {
    id: 'a1',
    level: 0,
    prompt: 'パンを やく ひとが はたらく ところは どこかな。',
    right: 'bakery',
    wrongs: ['library', 'hospital'],
  },
  {
    id: 'a2',
    level: 1,
    prompt: 'かじを けす ひとが はたらく ところは どこかな。',
    right: 'fire',
    wrongs: ['police', 'station'],
  },
  {
    id: 'a3',
    level: 2,
    prompt: 'やさいを うって いる ひとが はたらく ところは どこかな。',
    right: 'vege',
    wrongs: ['flower', 'bakery'],
  },
];
const placeAlts: ChoiceItem[] = PALT.map((p) =>
  choiceItem({
    id: `place-alt-${p.id}`,
    obj: 'place-people',
    level: p.level,
    alt: true,
    prompt: p.prompt,
    right: PLACES[p.right][1],
    rightFigure: illust(PLACES[p.right][0]),
    wrongs: p.wrongs.map((w) => [PLACES[w][1], 'place-mix'] as [string, string]),
    wrongFigures: p.wrongs.map((w) => illust(PLACES[w][0])),
    layout: 'row',
    hints: [
      'しごとの ようすを おもいうかべよう。',
      'かんばんの えが、ヒントに なるよ。',
      'その しごとを する ばしょの かんばんは どれかな。',
    ],
    explain: `${PLACES[p.right][2]}が はたらく のは「${PLACES[p.right][1]}」だよ。`,
  }),
);

// ---- use-rules ----
interface Ur {
  id: string;
  level: number;
  prompt: string;
  right: string;
  wrongs: string[];
  /** 誤りの選択肢の誤概念（省略すると public-break） */
  mis?: string;
  hints: [string, string, string];
  explain: string;
}
const RULES: Ur[] = [
  {
    id: 'u1',
    level: 0,
    prompt: 'としょかんで ほんを よむ とき、どうするかな。',
    right: 'しずかに よむ',
    wrongs: ['おおきな こえで はなす', 'はしりまわる'],
    hints: [
      'としょかんには、ほかの ひとも ほんを よんで いるよ。',
      'みんなが きもちよく よむには、どうしたら いいかな。',
      'こえの おおきさと、あるきかたを かんがえよう。',
    ],
    explain: 'としょかんでは しずかに よむよ。ほかの ひとも ほんを たのしんで いるからね。',
  },
  {
    id: 'u2',
    level: 0,
    prompt: 'としょかんで かりた ほんは、どうするかな。',
    right: 'きまりの 日《ひ》までに かえす',
    wrongs: ['ずっと もって いる', 'ともだちに あげる'],
    hints: [
      'かりた ほんは、としょかんの ものだよ。',
      'ほかの ひとも、よみたいと おもって いるかも しれないね。',
      'かりる ときに、なにが きまって いたかな。',
    ],
    explain:
      'かりた ほんは、きまりの 日《ひ》までに かえすよ。ほかの ひとも よめるように するためだよ。',
  },
  {
    id: 'u3',
    level: 1,
    prompt: 'こうえんの ブランコに、ほかの ひとも のりたがって いるよ。どうするかな。',
    right: 'じゅんばんに かわる',
    wrongs: ['ずっと のりつづける', 'おして どかす'],
    hints: [
      'こうえんの ブランコは、みんなの ものだよ。',
      'のりたい ひとが たくさん いる ときは、どうしたら いいかな。',
      'まって いる ひとも のれる ように するには、どう すると いいかな。',
    ],
    explain: 'こうえんの ものは みんなの もの。じゅんばんに かわって つかうよ。',
  },
  {
    id: 'u4',
    level: 1,
    prompt: 'でんしゃや バスの なかでは、どうするかな。',
    right: 'しずかに して、たって いる ときは てすりに つかまる',
    wrongs: ['おおきな こえで はなす', 'せきの うえに たつ'],
    hints: [
      'のりものには、いろいろな ひとが のって いるよ。',
      'ゆれた ときに、ころばない ように する ことも だいじだよ。',
      'こえの おおきさと、からだの ささえ かたを かんがえよう。',
    ],
    explain:
      'のりものでは しずかに して、たって いる ときは てすりに つかまるよ。ほかの ひとの めいわくに ならず、じぶんも あんぜんだね。',
  },
  {
    id: 'u5',
    level: 2,
    prompt: 'こうえんで ごみが でたよ。どうするかな。',
    right: 'ごみばこに すてる（なければ もちかえる）',
    wrongs: ['その ばしょに すてて かえる', 'ほかの ひとに おしつける'],
    hints: [
      'こうえんは、みんなが つかう ところだよ。',
      'ごみが あると、つぎに つかう ひとが こまるね。',
      'すてる ばしょが ない ときは、どうしたらいいかな。',
    ],
    explain: 'ごみは ごみばこに すてるよ。ごみばこが なければ、もちかえろうね。',
  },
  {
    id: 'u6',
    level: 2,
    prompt: 'おもい にもつを もって、こまって いる ひとが いたよ。どうするかな。',
    right: '「もちましょうか」と こえを かける',
    wrongs: ['みなかった ふりを する', 'わらって みて いる'],
    mis: 'help-skip',
    hints: [
      'こまって いる ひとを みたら、どう おもうかな。',
      'じぶんが こまった ときに、してほしい ことを かんがえよう。',
      'てつだいたい ときは、まず あいてに なんと いうと いいかな。',
    ],
    explain:
      'こまって いる ひとには「もちましょうか」と こえを かけるよ。むりな ときは、おとなを よぼうね。',
  },
];
const ruleItems: ChoiceItem[] = RULES.map((r) =>
  choiceItem({
    id: `rule-${r.id}`,
    obj: 'use-rules',
    level: r.level,
    prompt: r.prompt,
    right: r.right,
    wrongs: r.wrongs.map((w) => [w, r.mis ?? 'public-break'] as [string, string]),
    layout: 'column',
    hints: r.hints,
    explain: r.explain,
  }),
);
const GB_HINTS: [string, string, string] = [
  'カードを ひとつ えらんで、みんなが きもちよく つかえるか かんがえよう。',
  'ほかの ひとが こまる ことは、よくない ことだよ。',
  'ばしょを たいせつに して、みんなで つかう ことが よい ことだよ。',
];
const ruleSorts = [
  sortItem({
    id: 'rule-alt-s1',
    obj: 'use-rules',
    level: 1,
    alt: true,
    prompt: 'としょかんで「よい」「よくない」に わけよう。',
    boxes: ['よい こと', 'よくない こと'],
    cards: [
      ['しずかに よむ', 0],
      ['ほんを たいせつに あつかう', 0],
      ['かりた ほんを かえす', 0],
      ['ほんに らくがきを する', 1],
      ['おおごえで はなす', 1],
      ['ほんを なげる', 1],
    ],
    mis: 'public-sort',
    hints: GB_HINTS,
    explain:
      'しずかに よむ・たいせつに あつかう・かえす のは よい こと。らくがき・おおごえ・なげる のは よくないね。',
  }),
  sortItem({
    id: 'rule-alt-s2',
    obj: 'use-rules',
    level: 2,
    alt: true,
    prompt: 'こうえんで「よい」「よくない」に わけよう。',
    boxes: ['よい こと', 'よくない こと'],
    cards: [
      ['じゅんばんに あそぶ', 0],
      ['ごみばこに すてる', 0],
      ['ほかの ひとに ぶつからない', 0],
      ['ごみを すてて かえる', 1],
      ['はなを ちぎって しまう', 1],
      ['ブランコを ひとりじめ する', 1],
    ],
    mis: 'public-sort',
    hints: GB_HINTS,
    explain:
      'じゅんばん・ごみを すてる・ぶつからない のは よい こと。ごみを すてて かえる・はなを ちぎる・ひとりじめ は よくないね。',
  }),
  sortItem({
    id: 'rule-alt-s3',
    obj: 'use-rules',
    level: 2,
    alt: true,
    prompt: 'でんしゃや バスの なかで「よい」「よくない」に わけよう。',
    boxes: ['よい こと', 'よくない こと'],
    cards: [
      ['しずかに する', 0],
      ['せきを ゆずる', 0],
      ['てすりに つかまる', 0],
      ['おおごえで はなす', 1],
      ['せきを ひとりじめ する', 1],
      ['ドアの ところで あそぶ', 1],
    ],
    mis: 'public-sort',
    hints: GB_HINTS,
    explain:
      'しずかに する・ゆずる・つかまる のは よい こと。おおごえ・ひとりじめ・ドアで あそぶ のは よくないね。',
  }),
];

// ---- my-town ----
const MYTOWN_EXPLAIN =
  'じぶんの めで みた ことを かいたね。まちたんけんの きろくは、じぶんだけの たからものだよ。ほかの ひとと ちがって いても だいじょうぶ。';
interface Mt {
  id: string;
  level: number;
  prompt: string;
  guide?: 'none' | 'lines';
  hints: [string, string, string];
}
const MYTOWN: Mt[] = [
  {
    id: 'mt1',
    level: 0,
    prompt: 'まちたんけんで みつけた ところを、えに かこう。',
    hints: [
      'たんけんで あるいた みちを おもいだして みよう。',
      'めに とまった たてものや おみせは なにかな。',
      'ひとつ えらんで、えに かこう。',
    ],
  },
  {
    id: 'mt2',
    level: 0,
    prompt: 'そこで はたらいて いた ひとを、えに かこう。',
    hints: [
      'たんけんで あった ひとを おもいだして みよう。',
      'どんな ふくや どうぐを つかって いたかな。',
      'ひとりを えらんで、えに かこう。',
    ],
  },
  {
    id: 'mt3',
    level: 0,
    prompt: 'どうして その ひとは、そこで はたらいて いると おもうかな。ことばで かこう。',
    guide: 'lines',
    hints: [
      'その ひとの しごとを おもいだして みよう。',
      'その しごとが ないと、まちの ひとは どう こまるかな。',
      'じぶんの かんがえを、ことばで かこう。',
    ],
  },
  {
    id: 'mt4',
    level: 1,
    prompt: 'もう いちど いって みたい ところは どこかな。えに かこう。',
    hints: [
      'たんけんで たのしかった ところは どこかな。',
      'どうして また いきたいのか、かんがえて みよう。',
      'ひとつ えらんで、えに かこう。',
    ],
  },
  {
    id: 'mt5',
    level: 1,
    prompt: 'まちたんけんで ふしぎに おもった ことを、ことばで かこう。',
    guide: 'lines',
    hints: [
      'たんけんの とき、「あれ?」と おもった ことを おもいだして みよう。',
      'かたちや しくみ、ひとの うごきでも いいよ。',
      '「なぜ ○○ なのかな」の かたちで かいても いいよ。',
    ],
  },
  {
    id: 'mt6',
    level: 1,
    prompt: 'じぶんの まちの すきな ところを、えに かこう。',
    hints: [
      'まちの なかで、すきな ばしょや ものを おもいだして みよう。',
      'どうして すきなのか、かんがえて みよう。',
      'ひとつ えらんで、えに かこう。',
    ],
  },
];
const myTownItems: ExplainItem[] = MYTOWN.map((m) =>
  explainItem({
    id: `mytown-${m.id}`,
    obj: 'my-town',
    level: m.level,
    prompt: m.prompt,
    canvas: { aspect: 4 / 3, guide: m.guide ?? 'none' },
    hints: m.hints,
    explain: MYTOWN_EXPLAIN,
  }),
);
const myTownAlts: ExplainItem[] = [
  explainItem({
    id: 'mytown-alt-a1',
    obj: 'my-town',
    level: 0,
    alt: true,
    prompt: 'まちたんけんで、どうやって しらべたかな。（いくつでも えらべるよ）',
    reasons: ['みた', 'きいた', 'メモを とった', 'さわって みた'],
    multi: true,
    hints: [
      'たんけんの ときの ことを おもいだして みよう。',
      'からだの どこを つかって しらべたかな。',
      'いくつでも、えらんで いいよ。',
    ],
    explain: MYTOWN_EXPLAIN,
  }),
  explainItem({
    id: 'mytown-alt-a2',
    obj: 'my-town',
    level: 1,
    alt: true,
    prompt: 'まちで はたらく ひとに、どんな ことを きいて みたいかな。',
    reasons: ['しごとの こと', 'たいへんな こと', 'うれしい こと'],
    hints: [
      'しりたい ことを おもいうかべよう。',
      'どの ことが いちばん きに なるかな。',
      'どれを えらんでも だいじょうぶ。',
    ],
    explain: MYTOWN_EXPLAIN,
  }),
  explainItem({
    id: 'mytown-alt-a3',
    obj: 'my-town',
    level: 1,
    alt: true,
    prompt: 'まちたんけんの あとで、なにを したいかな。',
    reasons: ['みんなに はなす', 'かみに まとめる', 'また いって みる'],
    hints: [
      'たんけんで わかった ことを どうしたいか かんがえよう。',
      'ひとつ えらんで みよう。',
      'どれを えらんでも だいじょうぶ。',
    ],
    explain: MYTOWN_EXPLAIN,
  }),
];

const items: Item[] = [
  ...matchItems,
  ...placeAlts,
  ...ruleItems,
  ...ruleSorts,
  ...myTownItems,
  ...myTownAlts,
];

export const town: UnitSpec = {
  ...baseLife('g2.life.town', 'g2'),
  title: 'まちの ばしょと ひと',
  kind: 'inquiry',
  prereq: ['g1.life.school-safety'],
  objectives: [
    { id: 'place-people', title: 'まちの ばしょと、そこで はたらく ひと' },
    { id: 'use-rules', title: 'みんなで つかう ところの やくそく' },
    { id: 'my-town', title: 'まちたんけんで みつけた ことを かく' },
  ],
  misconceptions: [
    {
      id: 'place-mix',
      explain:
        'ほかの ばしょの ひとと むすんだのかな。かんばんの えと、その ひとの しごとを ならべて みよう。',
    },
    {
      id: 'public-break',
      explain:
        'じぶんの ことだけ かんがえたのかな。みんなで つかう ところは、ほかの ひとの ことも かんがえて つかうよ。',
    },
    {
      id: 'help-skip',
      explain:
        'こまって いる ひとに きづいても、なにも しなかったのかな。こえを かけたり、じぶんで むりな ときは おとなを よんだり できるよ。',
    },
    {
      id: 'public-sort',
      explain:
        'よい ことと よくない ことが、いれかわったのかな。ほかの ひとが こまったり、あぶなく なったり する ことは よくない ことだよ。',
    },
  ],
  levels: [
    { label: 'ばしょと ひと', chance: 0.1 },
    { label: 'みんなの ばしょの やくそく', chance: 0.2 },
    { label: 'まちたんけんの きろく', chance: 0.2 },
  ],
  intro: [
    {
      text: 'まちには、いろいろな ばしょが あって、いろいろな ひとが はたらいて いるよ。かんばんの えを ヒントに、むすんで みよう。',
      figure: {
        kind: 'row',
        items: [illust('life-bakery'), illust('life-hospital'), illust('life-library')],
        gap: 8,
      },
    },
    {
      text: 'ほんものの まちたんけんは、じぶんの あしで あるいて、みて、きいて みよう。ここに でて くる えは「いっぱんてきな れい」だよ。',
    },
    {
      text: 'まちたんけんで みつけた ことは、えや ことばで かいて みよう。かいた ものは、おうちの ひとも みられるよ。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）生活 (3)（地域と生活）、(4)（公共物・公共施設の利用）。学年の割当は本アプリの案（生活は第1・2学年のまとまり）。町の絵は一般的な例（特定の町・店の名前は使わない）。町たんけんの記録は採点しない explain',
  gradeIsAppProposal: true,
};
