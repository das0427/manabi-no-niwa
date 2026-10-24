/**
 * g2.life.animals 生き物の世話と観察記録（curriculum-matrix 3.5、生活 (7)。1年の植物の栽培から続く）。
 *
 * 生き物を飼う・観察するのは、ほんものの生き物でする。この単元は、世話に要るものや育ちの順を整理し、
 * 観察したことを かいて記録する補助（採点するのは例の絵・順序についてだけ）。種類ごとの飼い方の細かい違いは
 * 扱わず、どの生き物にも言える一般的なことだけを問う。
 *
 * 到達項目:
 *   needs  … 世話に要ること・気をつけること（choice）。別例 = ひつよう・いらないに分ける（sort）
 *   diary  … 観察したことを えやことばに かく（explain。採点しない）。別例 = 気づいたことを えらぶ
 *   growth … 生き物の育ちの順を並べる（order）。別例 = つぎはどれ（choice）
 * 同一性キー: 問題の id。
 */
import type { ChoiceItem, ExplainItem, Item, OrderItem, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { baseLife, choiceItem, explainItem, illust, orderItem, sortItem } from './util';

// ---- needs ----
interface Nd {
  id: string;
  level: number;
  prompt: string;
  fig?: string;
  right: string;
  wrongs: [string, string][];
  hints: [string, string, string];
  explain: string;
}
const NEEDS: Nd[] = [
  {
    id: 'n1',
    level: 0,
    prompt: 'いきものを かう まえに、まず どうするかな。',
    right: 'ごはんや すみかを しらべる',
    wrongs: [
      ['すぐに つれて くる', 'animal-rush'],
      ['ともだちに まかせる', 'animal-rush'],
    ],
    hints: [
      'いきものにも、すきな ごはんや すみやすい ところが あるよ。',
      'つれて きてから こまらない ように、さきに しる ことが だいじだね。',
      'ほんや せんせいに きいて、しらべよう。',
    ],
    explain: 'ごはんや すみかを しらべて から つれて くるよ。いきものが げんきに くらせる ように するためだよ。',
  },
  {
    id: 'n2',
    level: 0,
    prompt: 'えさを あげる とき、どうするかな。',
    right: 'きめた りょうと じかんを まもる',
    wrongs: [
      ['たくさん あげれば いい', 'animal-wrong'],
      ['ひとが たべる おかしを あげる', 'animal-wrong'],
    ],
    hints: [
      'あげすぎると、いきものは どうなるかな。',
      'ひとの たべものが、いきものの からだに あうとは かぎらないよ。',
      'きめた りょうと じかんを まもろう。',
    ],
    explain: 'きめた りょうと じかんを まもって あげるよ。たくさん あげたり、ひとの おかしを あげたり すると、からだを こわす ことが あるよ。',
  },
  {
    id: 'n3',
    level: 1,
    prompt: 'いきものの すみかが よごれて きたよ。どうするかな。',
    right: 'きれいに そうじを する',
    wrongs: [
      ['そのままに する', 'animal-skip'],
      ['みずを あげない ように する', 'animal-wrong'],
    ],
    hints: [
      'よごれた ところで くらすと、いきものは どうなるかな。',
      'びょうきに なる ことも あるよ。',
      'きれいな すみかを たもとう。',
    ],
    explain: 'すみかは きれいに そうじを するよ。よごれた ままだと、いきものが びょうきに なる ことが あるからだよ。',
  },
  {
    id: 'n4',
    level: 1,
    prompt: 'いきものを さわる ときは、どうするかな。',
    right: 'やさしく さわる。さわった あとは てを あらう',
    wrongs: [
      ['つよく にぎる', 'animal-wrong'],
      ['てを あらわない', 'animal-wrong'],
    ],
    hints: [
      'いきものは、からだが ちいさくて よわい ことが あるよ。',
      'いきものの からだや すみかには、ばいきんが いる ことも あるよ。',
      'やさしく さわって、さわった あとの ことも かんがえよう。',
    ],
    explain: 'やさしく さわって、さわった あとは てを あらうよ。いきものも ひとも、びょうきに ならない ためだよ。',
  },
  {
    id: 'n5',
    level: 2,
    prompt: 'かえるを かんさつ したよ。そのあと、どうするかな。',
    fig: 'frog',
    right: 'とって きた ばしょに かえす',
    wrongs: [
      ['そのまま ずっと かう', 'animal-rush'],
      ['ともだちに あげる', 'animal-rush'],
    ],
    hints: [
      'かえるは、もともと どこで くらして いたかな。',
      'そこには、かえるの ごはんや なかまが いるよ。',
      'いつも くらして いた ところに かえして あげよう。',
    ],
    explain: 'かんさつが おわったら、とって きた ばしょに かえすよ。かえるが いつもの ところで くらせる ように ね。',
  },
  {
    id: 'n6',
    level: 2,
    prompt: 'かごの なかの いきものが、げんきが ないよ。どうするかな。',
    right: 'おとなに しらせる',
    wrongs: [
      ['なにも しない', 'animal-skip'],
      ['ゆらして おこす', 'animal-wrong'],
    ],
    hints: [
      'げんきが ない ときは、びょうきかも しれないよ。',
      'ひとりで なんとか しようと しない ほうが いいね。',
      'おとなに みて もらって、どう するか きめよう。',
    ],
    explain: 'げんきが ない ときは、おとなに しらせるよ。びょうきや けがの ことも あるからね。',
  },
];
const needItems: ChoiceItem[] = NEEDS.map((n) =>
  choiceItem({
    id: `need-${n.id}`,
    obj: 'needs',
    level: n.level,
    prompt: n.prompt,
    ...(n.fig ? { figure: illust(n.fig) } : {}),
    right: n.right,
    wrongs: n.wrongs,
    layout: 'column',
    hints: n.hints,
    explain: n.explain,
  }),
);
const NEED_HINTS: [string, string, string] = [
  'いきものが げんきに くらす ために いる ものを かんがえよう。',
  'ごはん・みず・すみか は、いきものには たいせつだよ。',
  'いきものが たべない ものや、いらない ものは「いらない」だよ。',
];
const needSorts = [
  sortItem({
    id: 'need-alt-s1',
    obj: 'needs',
    level: 1,
    alt: true,
    prompt: 'くらす ために「ひつよう」か わけよう。',
    boxes: ['ひつよう', 'いらない'],
    cards: [
      ['ごはん', 0],
      ['きれいな みず', 0],
      ['すみか', 0],
      ['おかし', 1],
      ['テレビ', 1],
      ['ぼうし', 1],
    ],
    mis: 'animal-sort',
    hints: NEED_HINTS,
    explain: 'ごはん・きれいな みず・すみか は ひつよう。おかし・テレビ・ぼうし は いきものには いらないよ。',
  }),
  sortItem({
    id: 'need-alt-s2',
    obj: 'needs',
    level: 2,
    alt: true,
    prompt: 'いきものの せわで「する」「しない」に わけよう。',
    boxes: ['する こと', 'しない こと'],
    cards: [
      ['まいにち ようすを みる', 0],
      ['すみかを そうじする', 0],
      ['さわった あとに てを あらう', 0],
      ['つよく にぎる', 1],
      ['えさを あげすぎる', 1],
      ['せわを わすれて ほうって おく', 1],
    ],
    mis: 'animal-sort',
    hints: NEED_HINTS,
    explain: 'ようすを みて、そうじして、てを あらう のが せわ。つよく にぎる・あげすぎる・ほうって おく のは しない こと だよ。',
  }),
  sortItem({
    id: 'need-alt-s3',
    obj: 'needs',
    level: 2,
    alt: true,
    prompt: 'いきものに ついて「よい」「よくない」に わけよう。',
    boxes: ['よい こと', 'よくない こと'],
    cards: [
      ['しらべて から かう', 0],
      ['おわったら かえす', 0],
      ['こまった ときは おとなに はなす', 0],
      ['つれて かえる', 1],
      ['ともだちに むりやり あげる', 1],
      ['からだを ひっぱる', 1],
    ],
    mis: 'animal-sort',
    hints: NEED_HINTS,
    explain: 'しらべて・かえして・おとなに はなす のは よい こと。かって に つれて かえる・むりやり あげる・ひっぱる のは よくないね。',
  }),
];

// ---- diary ----
const DIARY_EXPLAIN =
  'よく みて、かんじた ことを かいたね。かんさつ きろくは、じぶんの めで みた ことを のこす だいじな ノートだよ。じょうずか どうかは きに しなくて いいよ。';
interface Dr {
  id: string;
  level: number;
  prompt: string;
  guide?: 'none' | 'lines';
  hints: [string, string, string];
}
const DIARY: Dr[] = [
  {
    id: 'd1',
    level: 0,
    prompt: 'せわを して いる いきものの すがたを、えに かこう。',
    hints: [
      'いきものの かたちを ゆっくり みよう。',
      'あたま、からだ、あし、しっぽ など、どんな かたちか みよう。',
      'みた とおりに かこう。',
    ],
  },
  {
    id: 'd2',
    level: 0,
    prompt: 'からだの いろを みて、いろを ぬって かこう。',
    hints: [
      'いきものの からだを よく みよう。',
      'いろは ひとつ かな。いくつか あるかな。',
      'いろを えらんで ぬって みよう。',
    ],
  },
  {
    id: 'd3',
    level: 0,
    prompt: 'えさを たべて いる ようすを、えに かこう。',
    hints: [
      'どんな ふうに たべて いるか みよう。',
      'くち や あしの うごきを みよう。',
      'みた ことを えに かこう。',
    ],
  },
  {
    id: 'd4',
    level: 1,
    prompt: 'いきものの うごき かたを、ことばで かこう。（はしる・およぐ・はねる など）',
    guide: 'lines',
    hints: [
      'いきものが うごく ところを じっと みよう。',
      'どこを つかって うごいて いるかな。',
      '「ぴょん ぴょん」のように、ようすの ことばを つかっても いいよ。',
    ],
  },
  {
    id: 'd5',
    level: 1,
    prompt: 'まえに みた ときと くらべて、かわった ところを えに かこう。',
    hints: [
      'まえの きろくを みて みよう。',
      'おおきさや かたち、いろは どうかな。',
      'かわった ところを えに かこう。',
    ],
  },
  {
    id: 'd6',
    level: 1,
    prompt: 'せわを して、きづいた ことを ことばで かこう。',
    guide: 'lines',
    hints: [
      'せわを して いる とき、どんな ことに きづいたかな。',
      'いきものの ようすや、じぶんの きもちでも いいよ。',
      'おもった ことを、ことばで かこう。',
    ],
  },
];
const diaryItems: ExplainItem[] = DIARY.map((d) =>
  explainItem({
    id: `diary-${d.id}`,
    obj: 'diary',
    level: d.level,
    prompt: d.prompt,
    canvas: { aspect: 4 / 3, guide: d.guide ?? 'none' },
    hints: d.hints,
    explain: DIARY_EXPLAIN,
  }),
);
const diaryAlts: ExplainItem[] = [
  explainItem({
    id: 'diary-alt-a1',
    obj: 'diary',
    level: 0,
    alt: true,
    prompt: 'いきものの ようすで、きづいた ことを えらぼう。（いくつでも えらべるよ）',
    reasons: ['よく うごく', 'ごはんを たくさん たべる', 'じっと して いる', 'こえを だす'],
    multi: true,
    hints: [
      'いきものを じっと みて みよう。',
      'まえと くらべて、かわった ことは あるかな。',
      'いくつでも、えらんで いいよ。',
    ],
    explain: DIARY_EXPLAIN,
  }),
  explainItem({
    id: 'diary-alt-a2',
    obj: 'diary',
    level: 1,
    alt: true,
    prompt: 'いきものの せわを して、どんな きもちに なったかな。（いくつでも えらべるよ）',
    reasons: ['たのしい', 'かわいい', 'むずかしい', 'もっと しりたい'],
    multi: true,
    hints: [
      'せわを して いる ときの ことを おもいだして みよう。',
      'いろいろな きもちが あるよ。',
      'いくつでも、えらんで いいよ。',
    ],
    explain: DIARY_EXPLAIN,
  }),
  explainItem({
    id: 'diary-alt-a3',
    obj: 'diary',
    level: 1,
    alt: true,
    prompt: 'つぎに しらべて みたい ことを えらぼう。',
    reasons: ['なにを たべるか', 'どこで ねるか', 'どう そだつか'],
    hints: [
      'もっと しりたい ことを かんがえよう。',
      'ひとつだけ えらぼう。',
      'どれを えらんでも だいじょうぶ。つぎの かんさつで しらべて みよう。',
    ],
    explain: DIARY_EXPLAIN,
  }),
];

// ---- growth ----
interface Gr {
  id: string;
  level: number;
  prompt: string;
  cards: [string, Figure | undefined][];
  hints: [string, string, string];
  explain: string;
}
const GROWTH: Gr[] = [
  {
    id: 'g1',
    level: 0,
    prompt: 'にわとりが そだつ じゅんに ならべよう。',
    cards: [
      ['たまご', illust('egg')],
      ['ひよこ', illust('chick')],
      ['おとなの にわとり', undefined],
    ],
    hints: [
      'いちばん はじめは、うまれる まえの すがただよ。',
      'たまごから でて きた ばかりの ときは、ちいさいね。',
      'ちいさい ひよこが、だんだん おおきく なるよ。',
    ],
    explain: 'たまご、ひよこ、おとなの にわとり の じゅんだよ。たまごから ひよこが うまれて、おおきく なるよ。',
  },
  {
    id: 'g2',
    level: 0,
    prompt: 'かえるが そだつ じゅんに ならべよう。',
    cards: [
      ['たまご', undefined],
      ['おたまじゃくし', undefined],
      ['あしが はえた おたまじゃくし', undefined],
      ['かえる', illust('frog')],
    ],
    hints: [
      'いちばん はじめは、みずの なかの たまごだよ。',
      'みずの なかで およぐ ときの すがたを おもいだそう。',
      'あしが はえて、さいごに かえるに なるよ。',
    ],
    explain: 'たまご、おたまじゃくし、あしが はえた おたまじゃくし、かえる の じゅんだよ。',
  },
  {
    id: 'g3',
    level: 1,
    prompt: 'ちょうが そだつ じゅんに ならべよう。',
    cards: [
      ['たまご', undefined],
      ['あおむし', undefined],
      ['さなぎ', undefined],
      ['ちょう', undefined],
    ],
    hints: [
      'ちょうも、たまごから はじまるよ。',
      'はっぱを たべて おおきく なる ときの すがたは？',
      'うごかない すがたに なって、さいごに はねが はえた ちょうに なるよ。',
    ],
    explain: 'たまご、あおむし、さなぎ、ちょう の じゅんだよ。すがたを かえながら そだつね。',
  },
  {
    id: 'g4',
    level: 1,
    prompt: 'ひとが そだつ じゅんに ならべよう。',
    cards: [
      ['あかちゃん', undefined],
      ['ようちえん', undefined],
      ['1年生《ねんせい》', undefined],
      ['2年生《ねんせい》', undefined],
    ],
    hints: [
      'じぶんも、あかちゃんの ときが あったね。',
      'ようちえんの あとに、小学校《しょうがっこう》に はいるよ。',
      '1年生《ねんせい》の つぎは、なん年生《ねんせい》かな。',
    ],
    explain: 'あかちゃん、ようちえん、1年生《ねんせい》、2年生《ねんせい》の じゅんだよ。ひとも だんだん せいちょう するね。',
  },
  {
    id: 'g5',
    level: 2,
    prompt: 'かぶとむしが そだつ じゅんに ならべよう。',
    cards: [
      ['たまご', undefined],
      ['ようちゅう（こどもの むし）', undefined],
      ['さなぎ', undefined],
      ['おとなの かぶとむし', undefined],
    ],
    hints: [
      'いちばん はじめは たまごだよ。',
      'たまごから でた むしは、おとなとは ちがう すがたを して いるよ。',
      'さなぎに なって、さいごに おとなの むしに なるよ。',
    ],
    explain: 'たまご、ようちゅう、さなぎ、おとなの かぶとむし の じゅんだよ。',
  },
  {
    id: 'g6',
    level: 2,
    prompt: 'かえるが そだつ ようすを、5つに わけて ならべよう。',
    cards: [
      ['たまご', undefined],
      ['おたまじゃくし', undefined],
      ['うしろあしが はえる', undefined],
      ['まえあしも はえる', undefined],
      ['かえる', illust('frog')],
    ],
    hints: [
      'たまごから はじまるよ。',
      'あしは、うしろから さきに はえるよ。',
      'まえあしが はえた あとに、かえるの すがたに なるよ。',
    ],
    explain: 'たまご、おたまじゃくし、うしろあし、まえあし、かえる の じゅんだよ。',
  },
];
const growthItems: OrderItem[] = GROWTH.map((g) =>
  orderItem({
    id: `growth-${g.id}`,
    obj: 'growth',
    level: g.level,
    prompt: g.prompt,
    cards: g.cards,
    ends: ['はじめ', 'おわり'],
    layout: g.cards.length <= 4 && g.cards.some(([l]) => l.length > 8) ? 'column' : 'row',
    mis: 'growth-order',
    hints: g.hints,
    explain: g.explain,
  }),
);
const growthAlts: ChoiceItem[] = [
  choiceItem({
    id: 'growth-alt-a1',
    obj: 'growth',
    level: 0,
    alt: true,
    prompt: 'おたまじゃくしの つぎは どれかな。',
    right: 'あしが はえる',
    wrongs: [
      ['たまごに もどる', 'growth-order'],
      ['さなぎに なる', 'growth-order'],
    ],
    layout: 'column',
    hints: [
      'おたまじゃくしは、みずの なかを およいで いるね。',
      'だんだん かえるに ちかづくよ。',
      'かえるの からだで、あたらしく はえて くる ところを かんがえよう。',
    ],
    explain: 'おたまじゃくしは、あしが はえて、かえるに なって いくよ。',
  }),
  choiceItem({
    id: 'growth-alt-a2',
    obj: 'growth',
    level: 1,
    alt: true,
    prompt: 'あおむしの つぎは どれかな。',
    right: 'さなぎ',
    wrongs: [
      ['たまご', 'growth-order'],
      ['おたまじゃくし', 'growth-order'],
    ],
    layout: 'column',
    hints: [
      'あおむしは、ちょうの こどもだよ。',
      'おとなの ちょうに なる まえに、うごかない すがたに なるよ。',
      'かたい かわに つつまれて、からだを つくりかえるよ。',
    ],
    explain: 'あおむしは さなぎに なって、そのあと ちょうに なるよ。',
  }),
  choiceItem({
    id: 'growth-alt-a3',
    obj: 'growth',
    level: 2,
    alt: true,
    prompt: 'ひよこが そだつと、なにに なるかな。',
    figure: illust('chick'),
    right: 'にわとり',
    wrongs: [
      ['かえる', 'growth-order'],
      ['ちょう', 'growth-order'],
    ],
    layout: 'row',
    hints: [
      'ひよこは、とりの こどもだよ。',
      'おなじ なかまに そだつよ。',
      'たまごを うむ、とりの なかまだよ。',
    ],
    explain: 'ひよこは そだって、にわとりに なるよ。',
  }),
];

const items: Item[] = [
  ...needItems,
  ...needSorts,
  ...diaryItems,
  ...diaryAlts,
  ...growthItems,
  ...growthAlts,
];

export const animals: UnitSpec = {
  ...baseLife('g2.life.animals', 'g2'),
  title: 'いきものの せわと かんさつ',
  kind: 'inquiry',
  prereq: ['g1.life.plant-diary'],
  objectives: [
    { id: 'needs', title: 'いきものの せわに ひつような こと' },
    { id: 'diary', title: 'いきものを よく みて かく' },
    { id: 'growth', title: 'いきものが そだつ じゅんばん' },
  ],
  misconceptions: [
    {
      id: 'animal-rush',
      explain:
        'さきに かんがえずに うごいたのかな。いきものは いのちが ある。かう まえに しらべて、かんさつの あとの ことも かんがえよう。',
    },
    {
      id: 'animal-wrong',
      explain:
        'いきものに あわない せわを えらんだのかな。いきもの ごとに、ごはんや さわり かたが ちがうよ。しらべて、やさしく せわを しよう。',
    },
    {
      id: 'animal-skip',
      explain:
        'なにも しなかったのかな。いきものは じぶんで せわが できないよ。ようすを みて、おとなにも しらせよう。',
    },
    {
      id: 'animal-sort',
      explain:
        'ひつようと いらない が、いれかわったのかな。いきものが げんきに くらす ために たいせつな ものを おもいだそう。',
    },
    {
      id: 'growth-order',
      explain:
        'そだつ じゅんばんが ちがったのかな。いきものは、たまごや ちいさい すがたから、だんだん おおきく なっていくよ。',
    },
  ],
  levels: [
    { label: 'せわの きほん・みて かく', chance: 0.1 },
    { label: 'せわと そだつ じゅん', chance: 0.1 },
    { label: 'いきものと つきあう こと', chance: 0.1 },
  ],
  intro: [
    {
      text: 'いきものも、いのちが ある ものだよ。ごはんや すみかなど、せわを して、よく みて かこう。',
      figure: {
        kind: 'row',
        items: [illust('rabbit'), illust('frog'), illust('chick')],
        gap: 8,
      },
    },
    {
      text: 'ほんものの いきものを せわするのは、おとなと いっしょに、やさしく、やって みよう。この がめんは、わかった ことを ととのえる ところだよ。',
    },
    {
      text: 'かんさつの きろくに、まちがいは ないよ。じぶんの めで みた ことを かこう。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）生活 (7)（動物を飼ったり植物を育てたりする活動。生命をもち成長していることへの気付き）。学年の割当は本アプリの案（生活は第1・2学年のまとまり）。種類ごとの飼い方の違いは扱わず、一般的なことだけ',
  gradeIsAppProposal: true,
};





