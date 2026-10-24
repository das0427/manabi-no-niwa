/**
 * g1.life.seasons 季節の見つけたこと（比べる・記録する）（curriculum-matrix 3.4、生活 (5)）。
 *
 * 季節の様子・行事・植物の時期は地域によって違う。この単元では固定の正解を置かず、季節に出す問題は
 * 「いっぱんてきな れい」と書く（問題文に「ちいきに よって ちがう ことが あるよ」を入れた）。
 * 見つけたことの記録は explain（採点しない）。
 *
 * 到達項目:
 *   find    … いま見つけたこと・かんじたことを、えやことばに かく（explain）。別例 = 理由やことばを えらぶ（explain・採点しない）
 *   compare … 季節ごとの ものを いっぱんてきな れいで くらべる（choice）。別例 = 季節に わける（sort）
 *   change  … 季節に あわせた くらしの くふう（choice）。別例 = 季節を じゅんに ならべる（order）
 * 同一性キー: 問題の id。
 */
import type { ChoiceItem, ExplainItem, Item, UnitSpec } from '../../curriculum/types';
import { baseLife, choiceItem, explainItem, illust, orderItem, sortItem } from './util';

// ---- find ----
interface Fd {
  id: string;
  level: number;
  prompt: string;
  guide?: 'none' | 'lines';
  hints: [string, string, string];
  explain: string;
}
const DRAW_EXPLAIN =
  'じぶんで みつけた ことを かいたね。これは じぶんだけの だいじな きろくだよ。ほかの ひとと ちがって いても だいじょうぶ。';
const FINDS: Fd[] = [
  {
    id: 'f1',
    level: 0,
    prompt: 'そとに でて、いま みつけた しぜんの ものを ひとつ えらんで、えに かこう。',
    hints: [
      'まわりを ゆっくり みわたして みよう。',
      'はな・むし・くさ・くも など、きに なる ものを ひとつ えらぼう。',
      'かたちや いろを よく みて、えに かこう。',
    ],
    explain: DRAW_EXPLAIN,
  },
  {
    id: 'f2',
    level: 0,
    prompt: 'そらの ようす（はれ・くもり・あめ）を えに かこう。',
    hints: [
      'まどから、または そとに でて、そらを みあげて みよう。',
      'くもは あるかな。たいようは みえるかな。',
      'みえた とおりに、そらと くもを かこう。',
    ],
    explain: DRAW_EXPLAIN,
  },
  {
    id: 'f3',
    level: 0,
    prompt: 'いま かんじる あつさや さむさを、ことばで あらわそう。',
    guide: 'lines',
    hints: [
      'からだで かんじる ことを おもいだして みよう。',
      '「あつい」「さむい」「すずしい」「ぽかぽか」など、じぶんの ことばで いいよ。',
      'なにが あつい（さむい）と かんじたか、いっしょに かいても いいよ。',
    ],
    explain: DRAW_EXPLAIN,
  },
  {
    id: 'f4',
    level: 1,
    prompt: 'いまの きせつに たべる ものを ひとつ えらんで、えに かこう。',
    hints: [
      'きょうの ごはんや おやつを おもいだして みよう。',
      'いまの きせつに おいしい ものは どれかな。',
      'すきな たべものの いろと かたちを よく おもいだして かこう。',
    ],
    explain: DRAW_EXPLAIN,
  },
  {
    id: 'f5',
    level: 1,
    prompt: 'いま きて いる ふくを えに かこう。いまの きせつに あって いるかな。',
    hints: [
      'じぶんの ふくを みて みよう。',
      'あつい（さむい）ので、どんな ふくに しているかな。',
      'あたまや あしに つけて いる ものも かこう。',
    ],
    explain: DRAW_EXPLAIN,
  },
  {
    id: 'f6',
    level: 1,
    prompt: 'いまの きせつに すきな ことを えに かこう。',
    hints: [
      'いまの きせつに できる ことを おもいだして みよう。',
      'そとで する こと、うちで する ことを おもいうかべよう。',
      'いちばん すきな ことを ひとつ えらんで かこう。',
    ],
    explain: DRAW_EXPLAIN,
  },
];
const findItems: ExplainItem[] = FINDS.map((f) =>
  explainItem({
    id: `find-${f.id}`,
    obj: 'find',
    level: f.level,
    prompt: f.prompt,
    canvas: { aspect: 4 / 3, guide: f.guide ?? 'none' },
    hints: f.hints,
    explain: f.explain,
  }),
);

const REASON_EXPLAIN =
  'じぶんの かんがえを えらんだね。どれを えらんでも だいじょうぶ。つぎは、わけを だれかに はなして みよう。';
const findAlts: ExplainItem[] = [
  explainItem({
    id: 'find-alt-a1',
    obj: 'find',
    level: 0,
    alt: true,
    prompt: 'いまの きせつの すきな ところは どれかな。ひとつ えらぼう。',
    reasons: [
      'すずしい（あたたかい）',
      'きれいな はなや は',
      'おいしい たべもの',
      'あそびが たのしい',
    ],
    hints: [
      'いまの きせつを おもいうかべて みよう。',
      'いちばん すきな ところは どれかな。',
      'どれを えらんでも まちがいでは ないよ。じぶんの きもちで えらぼう。',
    ],
    explain: REASON_EXPLAIN,
  }),
  explainItem({
    id: 'find-alt-a2',
    obj: 'find',
    level: 1,
    alt: true,
    prompt: 'みつけた ものを、どうやって みつけたかな。あてはまる ものを ぜんぶ えらぼう。',
    reasons: ['めで みた', 'てで さわった', 'みみで きいた', 'はなで かいだ'],
    multi: true,
    hints: [
      'みつけた ものを おもいだして みよう。',
      'からだの どこを つかって かんじたかな。',
      'ひとつでも、いくつでも えらんで いいよ。',
    ],
    explain: REASON_EXPLAIN,
  }),
  explainItem({
    id: 'find-alt-a3',
    obj: 'find',
    level: 1,
    alt: true,
    prompt: 'みつけた ことを、だれに おしえたいかな。',
    reasons: ['おうちの ひと', 'ともだち', '先生《せんせい》'],
    hints: [
      'みつけた ことを おもいだして みよう。',
      'おしえたら よろこんで くれそうな ひとは だれかな。',
      'どれを えらんでも だいじょうぶ。',
    ],
    explain: REASON_EXPLAIN,
  }),
];

// ---- compare ----
interface Cp {
  id: string;
  level: number;
  prompt: string;
  fig: string;
  right: string;
  wrongs: string[];
  hints: [string, string, string];
  explain: string;
}
const REGION = '（ちいきに よって ちがう ことが あるよ）';
const COMPARES: Cp[] = [
  {
    id: 'c1',
    level: 0,
    prompt: `この はなが いっぱんてきに さく きせつは いつかな。${REGION}`,
    fig: 'life-cherry',
    right: 'はる',
    wrongs: ['なつ', 'ふゆ'],
    hints: [
      'はなの いろと かたちを よく みよう。',
      'さむい ふゆが おわって、あたたかく なる ころに さく ことが おおいよ。',
      'ふゆの つぎの きせつだよ。',
    ],
    explain:
      'さくらは、いっぱんてきに はるに さくよ。ちいきに よって さく じきは ちがう ことが あるよ。',
  },
  {
    id: 'c2',
    level: 0,
    prompt: `すいかが いっぱんてきに おいしい きせつは いつかな。${REGION}`,
    fig: 'watermelon',
    right: 'なつ',
    wrongs: ['ふゆ', 'はる'],
    hints: [
      'すいかは、あまくて みずが たくさん あるよ。',
      'あつい ひに つめたく して たべると おいしいね。',
      'いちばん あつい きせつだよ。',
    ],
    explain:
      'すいかは、いっぱんてきに なつに おいしい くだものだよ。あつい ひに たべると、からだが すずしく なるね。',
  },
  {
    id: 'c3',
    level: 0,
    prompt: `この はっぱが いろを かえる きせつは、いっぱんてきに いつかな。${REGION}`,
    fig: 'life-redleaf',
    right: 'あき',
    wrongs: ['はる', 'なつ'],
    hints: [
      'はっぱが あかく なって いるね。',
      'はっぱが おちる すこし まえに、いろが かわる ことが あるよ。',
      'あつい なつの あとの、すずしく なる きせつだよ。',
    ],
    explain:
      'もみじの はっぱは、いっぱんてきに あきに あかく なるよ。ちいきに よって、いろが かわる ころは ちがうよ。',
  },
  {
    id: 'c4',
    level: 1,
    prompt: `ゆきが ふる ところでは、ゆきが ふるのは いっぱんてきに どの きせつかな。${REGION}`,
    fig: 'life-snowflake',
    right: 'ふゆ',
    wrongs: ['なつ', 'あき'],
    hints: [
      'ゆきは、つめたい ときに ふるよ。',
      'いちねんで いちばん さむい ころだよ。',
      'あきの つぎの きせつだよ。',
    ],
    explain:
      'ゆきが ふる ところでは、いっぱんてきに ふゆに ふるよ。ゆきが ふらない ちいきも あるよ。',
  },
  {
    id: 'c5',
    level: 1,
    prompt: 'うきわを つかって みずあそびを したく なる のは、いっぱんてきに どの きせつかな。',
    fig: 'life-swimring',
    right: 'なつ',
    wrongs: ['ふゆ', 'あき'],
    hints: [
      'うきわは、みずに ういて あそぶ どうぐだよ。',
      'みずあそびが きもちいい のは、どんな ひかな。',
      'あつくて、たいようが ぎらぎらする きせつだよ。',
    ],
    explain: 'なつは あつくて、つめたい みずが きもちいいから、みずあそびを するね。',
  },
  {
    id: 'c6',
    level: 1,
    prompt: `きのこが いっぱんてきに たくさん みつかる きせつは いつかな。${REGION}`,
    fig: 'life-mushroom',
    right: 'あき',
    wrongs: ['はる', 'ふゆ'],
    hints: [
      'きのこは、しめった ところに はえるよ。',
      'すずしく なって、おちばが ふえる ころだよ。',
      'なつの あとの きせつだよ。たべられるか わからない きのこは、さわらない・たべない ように しよう。',
    ],
    explain:
      'きのこは、いっぱんてきに あきに たくさん みつかるよ。たべられるか わからない きのこは、さわらない・たべない やくそくだよ。',
  },
];
const compareItems: ChoiceItem[] = COMPARES.map((c) =>
  choiceItem({
    id: `compare-${c.id}`,
    obj: 'compare',
    level: c.level,
    prompt: c.prompt,
    figure: illust(c.fig),
    right: c.right,
    wrongs: c.wrongs.map((w) => [w, 'season-mix'] as [string, string]),
    layout: 'row',
    hints: c.hints,
    explain: c.explain,
  }),
);

const SORT_HINTS: [string, string, string] = [
  'カードを ひとつ えらんで、どんな きせつの ものか おもいだそう。',
  'あつい（さむい）か、はなが さく（はっぱが おちる）かを かんがえよう。',
  'ちいきに よって ちがう ことが あるよ。いっぱんてきな れいで わけよう。',
];
const compareSorts = [
  sortItem({
    id: 'compare-alt-s1',
    obj: 'compare',
    level: 1,
    alt: true,
    prompt: 'いっぱんてきな れいで きせつごとに わけよう。',
    boxes: ['はる', 'なつ', 'あき', 'ふゆ'],
    cards: [
      ['さくら', 0, illust('life-cherry')],
      ['おはなみ', 0],
      ['うきわ', 1, illust('life-swimring')],
      ['すいか', 1, illust('watermelon')],
      ['もみじ', 2, illust('life-redleaf')],
      ['きのこ', 2, illust('life-mushroom')],
      ['ゆきだるま', 3, illust('life-snowman')],
      ['ゆき', 3, illust('life-snowflake')],
    ],
    mis: 'season-mix',
    hints: SORT_HINTS,
    explain:
      'はるは さくら・おはなみ、なつは うきわ・すいか、あきは もみじ・きのこ、ふゆは ゆきだるま・ゆき。いっぱんてきな れいだよ。',
  }),
  sortItem({
    id: 'compare-alt-s2',
    obj: 'compare',
    level: 2,
    alt: true,
    prompt: 'いっぱんてきな れいで「はる」「ふゆ」に わけよう。',
    boxes: ['はる', 'ふゆ'],
    cards: [
      ['さくら', 0, illust('life-cherry')],
      ['おはなみ', 0],
      ['たんぽぽ', 0],
      ['ゆきだるま', 1, illust('life-snowman')],
      ['ゆき', 1, illust('life-snowflake')],
      ['こたつ', 1],
    ],
    mis: 'season-mix',
    hints: SORT_HINTS,
    explain:
      'さくら・おはなみ・たんぽぽ は はるの こと。ゆきだるま・ゆき・こたつ は ふゆの ことだよ。',
  }),
  sortItem({
    id: 'compare-alt-s3',
    obj: 'compare',
    level: 2,
    alt: true,
    prompt: 'いっぱんてきな れいで「なつ」「あき」に わけよう。',
    boxes: ['なつ', 'あき'],
    cards: [
      ['うきわ', 0, illust('life-swimring')],
      ['すいか', 0, illust('watermelon')],
      ['プール', 0],
      ['もみじ', 1, illust('life-redleaf')],
      ['きのこ', 1, illust('life-mushroom')],
      ['おつきみ', 1],
    ],
    mis: 'season-mix',
    hints: SORT_HINTS,
    explain: 'うきわ・すいか・プール は なつの こと。もみじ・きのこ・おつきみ は あきの ことだよ。',
  }),
];

// ---- change ----
interface Ch {
  id: string;
  level: number;
  prompt: string;
  right: string;
  wrongs: string[];
  hints: [string, string, string];
  explain: string;
}
const CHANGES: Ch[] = [
  {
    id: 'h1',
    level: 1,
    prompt: 'あつい きせつに きる ふくは どれかな。',
    right: 'はんそで',
    wrongs: ['あつい コート', 'てぶくろ'],
    hints: [
      'あつい ときは、からだが どうなるかな。',
      'すずしく すごす ために、ふくを どう するといいかな。',
      'うでが でて いる ふくだよ。',
    ],
    explain: 'あつい きせつは、はんそでを きて、すずしく すごすよ。',
  },
  {
    id: 'h2',
    level: 1,
    prompt: 'さむい きせつに、からだを あたためる ために する ことは どれかな。',
    right: 'マフラーを まく',
    wrongs: ['うちわで あおぐ', 'つめたい ジュースを たくさん のむ'],
    hints: [
      'さむい ときは、からだが ひえて しまうね。',
      'あたたかい ものを みに つけたり、のんだり するよ。',
      'くびに まく ものだよ。',
    ],
    explain:
      'さむい きせつは、マフラーや てぶくろで あたたかく するよ。つめたい ものを たくさん のむと、からだが ひえて しまうね。',
  },
  {
    id: 'h3',
    level: 1,
    prompt: 'あめの ひに そとへ いく とき、もって いく ものは どれかな。',
    right: 'かさ',
    wrongs: ['うきわ', 'てぶくろ'],
    hints: [
      'あめの ひは、なにが ふって くるかな。',
      'ぬれない ために つかう どうぐだよ。',
      'てに もって、あたまの うえに さす ものだよ。',
    ],
    explain: 'あめの ひは、かさを もって いくよ。ぬれないで すむね。',
  },
  {
    id: 'h4',
    level: 2,
    prompt: 'ひざしが つよい ひに、あたまを まもる ために かぶる ものは どれかな。',
    right: 'ぼうし',
    wrongs: ['マフラー', 'てぶくろ'],
    hints: [
      'たいようの ひかりが つよい ときは、あたまが あつく なるね。',
      'あたまに のせる ものだよ。',
      'そとで あそぶ とき、あたまを まもる ものだよ。',
    ],
    explain: 'ひざしが つよい ひは、ぼうしを かぶって、あたまを まもるよ。',
  },
  {
    id: 'h5',
    level: 2,
    prompt: 'ゆきが ふった あさ、あしもとが すべりやすい とき、どうするかな。',
    right: 'ちいさな あしどりで ゆっくり あるく',
    wrongs: ['はしって いく', 'ポケットに てを いれて あるく'],
    hints: [
      'ゆきの うえは、つるつる すべる ことが あるよ。',
      'ころんだら、けがを するかも しれないね。',
      'あしを どんな はやさと おおきさで うごかすと いいかな。',
    ],
    explain:
      'すべりやすい ときは、ちいさな あしどりで ゆっくり あるくよ。ポケットに てを いれると、ころんだ ときに あぶないね。',
  },
  {
    id: 'h6',
    level: 2,
    prompt: 'あつい ひに、からだの ために よく する ことは どれかな。',
    right: 'みずや むぎちゃを こまめに のむ',
    wrongs: ['なにも のまない', 'あつい スープを たくさん のむ'],
    hints: [
      'あつい ひは、あせを たくさん かくね。',
      'からだの なかの みずが へって しまうよ。',
      'なくなった みずを、すこしずつ たして あげよう。',
    ],
    explain: 'あつい ひは あせを たくさん かくから、みずや むぎちゃを こまめに のむよ。',
  },
];
const changeItems: ChoiceItem[] = CHANGES.map((c) =>
  choiceItem({
    id: `change-${c.id}`,
    obj: 'change',
    level: c.level,
    prompt: c.prompt,
    right: c.right,
    wrongs: c.wrongs.map((w) => [w, 'season-care'] as [string, string]),
    layout: 'column',
    hints: c.hints,
    explain: c.explain,
  }),
);

const changeOrders = [
  orderItem({
    id: 'change-alt-o1',
    obj: 'change',
    level: 1,
    alt: true,
    prompt: 'はるから はじめて、きせつの じゅんに ならべよう。',
    cards: [
      ['はる', illust('life-cherry')],
      ['なつ', illust('life-swimring')],
      ['あき', illust('life-redleaf')],
      ['ふゆ', illust('life-snowflake')],
    ],
    ends: ['はじめ', 'おわり'],
    mis: 'season-order',
    hints: [
      'きせつは、ぐるっと まわって くりかえすよ。',
      'はるの つぎは、あたたかさが ふえて くる きせつだよ。',
      'はる、なつ、の つぎは なにかな。',
    ],
    explain: 'はる・なつ・あき・ふゆ の じゅんだよ。ふゆの つぎは また はるが くるよ。',
  }),
  orderItem({
    id: 'change-alt-o2',
    obj: 'change',
    level: 2,
    alt: true,
    prompt: 'ふゆから はじめて、きせつの じゅんに ならべよう。',
    cards: [
      ['ふゆ', illust('life-snowflake')],
      ['はる', illust('life-cherry')],
      ['なつ', illust('life-swimring')],
      ['あき', illust('life-redleaf')],
    ],
    ends: ['はじめ', 'おわり'],
    mis: 'season-order',
    hints: [
      'ふゆが いちばん はじめだよ。',
      'ふゆの つぎは、あたたかく なって くる きせつだよ。',
      'ふゆ、はる、の つぎは なにかな。',
    ],
    explain:
      'ふゆ・はる・なつ・あき の じゅんだよ。はじまりが ちがっても、きせつの じゅんばんは おなじだよ。',
  }),
  orderItem({
    id: 'change-alt-o3',
    obj: 'change',
    level: 2,
    alt: true,
    prompt: 'なつの つぎから、3つ ならべよう。',
    cards: [
      ['あき', illust('life-redleaf')],
      ['ふゆ', illust('life-snowflake')],
      ['はる', illust('life-cherry')],
    ],
    ends: ['はじめ', 'おわり'],
    mis: 'season-order',
    hints: [
      'なつの つぎの きせつは どれかな。',
      'あつい なつの あとは、すずしく なって いくよ。',
      'あき、ふゆ、の つぎに くる きせつは なにかな。',
    ],
    explain:
      'なつの つぎは あき、そのつぎは ふゆ、そして はる。きせつは ぐるっと まわって いくよ。',
  }),
];

const items: Item[] = [
  ...findItems,
  ...findAlts,
  ...compareItems,
  ...compareSorts,
  ...changeItems,
  ...changeOrders,
];

export const seasons: UnitSpec = {
  ...baseLife('g1.life.seasons', 'g1'),
  title: 'きせつの みつけもの',
  kind: 'inquiry',
  prereq: [],
  objectives: [
    { id: 'find', title: 'みつけた ことを えや ことばに かく' },
    { id: 'compare', title: 'きせつごとの ようすを くらべる' },
    { id: 'change', title: 'きせつに あわせた くらしの くふう' },
  ],
  misconceptions: [
    {
      id: 'season-mix',
      explain:
        'べつの きせつと まちがえたのかな。あつい・さむい、はなが さく・はっぱが おちる、など ようすを おもいだして みよう。ちいきに よって ちがう ことも あるよ。',
    },
    {
      id: 'season-care',
      explain:
        'きせつと あわない ものを えらんだのかな。あつい ときは すずしく、さむい ときは あたたかく、からだを まもる くふうを かんがえよう。',
    },
    {
      id: 'season-order',
      explain:
        'じゅんばんが ちがったのかな。きせつは はる・なつ・あき・ふゆ の じゅんに ぐるっと まわって いくよ。',
    },
  ],
  levels: [
    { label: 'みつけて かく・くらべる', chance: 0.2 },
    { label: 'きせつの ようす', chance: 0.2 },
    { label: 'くらしの くふう・じゅんばん', chance: 0.2 },
  ],
  intro: [
    {
      text: 'きせつの ようすを みつけて、えに かいたり、くらべたり しよう。',
      figure: {
        kind: 'row',
        items: [
          illust('life-cherry'),
          illust('watermelon'),
          illust('life-redleaf'),
          illust('life-snowflake'),
        ],
        gap: 8,
      },
    },
    {
      text: 'ほんものの そとの ようすは、じぶんで そとに でて みよう。この がめんは、みつけた ことを ととのえる ところだよ。',
    },
    {
      text: 'はなが さく ころや ぎょうじは、ちいきに よって ちがう ことが あるよ。ここに でて くるのは「いっぱんてきな れい」だよ。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）生活 (5)（季節の変化と生活）。学年の割当は本アプリの案（生活は第1・2学年のまとまり）。季節の行事・植物の時期は地域差があるため、固定の正解を置かず「いっぱんてきな れい」と明示',
  gradeIsAppProposal: true,
};
