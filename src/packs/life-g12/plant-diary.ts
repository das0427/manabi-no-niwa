/**
 * g1.life.plant-diary 育てている植物の観察記録（curriculum-matrix 3.4、生活 (7)。2学年継続して扱う）。
 *
 * 植物を育てて、よく見る・さわる・世話をするのは、ほんものの植物でする。
 * この単元は、観察して分かったことを絵・ことばで記録し、育ちの順や世話に要るものを整理する補助（採点するのは絵の例についてだけ）。
 *
 * 到達項目:
 *   diary  … 見て・さわって・かいで分かったことを、えやことばに かく（explain。採点しない）。別例 = ことばを えらぶ（explain）
 *   growth … 植物の育ちの順（たね → め → はっぱ → つぼみ → はな → み）を並べる（order）。別例 = つぎはどれ（choice）
 *   care   … 世話に要るもの（水・ひなた・つち など）を選ぶ（choice）。別例 = ひつよう・ひつようない に分ける（sort）
 * 同一性キー: 問題の id。
 */
import type { ChoiceItem, ExplainItem, Item, OrderItem, UnitSpec } from '../../curriculum/types';
import { baseLife, choiceItem, explainItem, illust, orderItem, sortItem } from './util';

// ---- diary ----
const DIARY_EXPLAIN =
  'よく みて、かんじた ことを かいたね。かんさつ きろくは、じぶんの めで みた ことを のこす だいじな ノートだよ。じょうずか どうかは きに しなくて いいよ。';
interface Dr {
  id: string;
  level: number;
  prompt: string;
  guide?: 'none' | 'lines';
  reasons?: string[];
  multi?: boolean;
  hints: [string, string, string];
}
const DIARY: Dr[] = [
  {
    id: 'd1',
    level: 0,
    prompt: 'きょうの たねや め、はっぱを よく みて、えに かこう。',
    hints: [
      'うえきばちを ゆっくり のぞきこんで みよう。',
      'くき、はっぱ、つちの ようすを みよう。',
      'いくつ あるか、どんな かたちか、かぞえながら かこう。',
    ],
  },
  {
    id: 'd2',
    level: 0,
    prompt: 'はっぱの いろを みて、いろを ぬって かこう。どんな いろかな。',
    hints: [
      'はっぱを ひかりの ほうへ むけて みよう。',
      'みどりでも、うすい みどり・こい みどりが あるよ。',
      'いろを えらんで、ぬって みよう。',
    ],
  },
  {
    id: 'd3',
    level: 0,
    prompt: 'さわった かんじを えらぼう。（いくつでも）',
    reasons: ['つるつる', 'ざらざら', 'ふわふわ', 'ちくちく'],
    multi: true,
    hints: [
      'そっと さわって みよう。（はっぱを ちぎらないでね）',
      'ゆびの はらで、やさしく なでるよ。',
      'どんな かんじか、ちかい ことばを えらぼう。',
    ],
  },
  {
    id: 'd4',
    level: 1,
    prompt: 'おおきさを、じぶんの てのひらと くらべて、えに かこう。',
    hints: [
      'てのひらを、はっぱの そばに おいて みよう。',
      'はっぱが てのひらより おおきいか、ちいさいか みよう。',
      'くらべて わかった ことを、えに かこう。',
    ],
  },
  {
    id: 'd5',
    level: 1,
    prompt: 'においを かいで みよう。どんな においかな。ことばで かこう。',
    guide: 'lines',
    hints: [
      'はなに すこし ちかづけて、そっと かいで みよう。',
      'くさの におい、つちの におい、はなの においが あるよ。',
      'においが しなければ「においは しない」と かいても いいよ。',
    ],
  },
  {
    id: 'd6',
    level: 1,
    prompt: 'ひなたと かげの どちらに おいて あるかを、えに かこう。',
    hints: [
      'うえきばちは、どこに おいて あるかな。',
      'たいようの ひかりは、あたって いるかな。',
      'たいようの むきも、えに かいて みよう。',
    ],
  },
];
const diaryItems: ExplainItem[] = DIARY.map((d) =>
  explainItem({
    id: `diary-${d.id}`,
    obj: 'diary',
    level: d.level,
    prompt: d.prompt,
    ...(d.reasons ? { reasons: d.reasons, multi: d.multi } : { canvas: { aspect: 4 / 3, guide: d.guide ?? 'none' } }),
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
    prompt: 'きょう、せわで した ことを えらぼう。（いくつでも）',
    reasons: ['みずを あげた', 'ひなたに おいた', 'くさを ぬいた', 'まだ なにも して いない'],
    multi: true,
    hints: [
      'きょうの ことを おもいだして みよう。',
      'うえきばちの せわで した ことは あるかな。',
      'いくつでも、えらんで いいよ。',
    ],
    explain: DIARY_EXPLAIN,
  }),
  explainItem({
    id: 'diary-alt-a2',
    obj: 'diary',
    level: 1,
    alt: true,
    prompt: 'せわを して、きづいた ことを えらぼう。（いくつでも）',
    reasons: ['はっぱが ふえた', 'おおきく なった', 'いろが かわった', 'つぼみが できた'],
    multi: true,
    hints: [
      'まえに みた ときと くらべて みよう。',
      'どこが かわったかな。',
      'いくつでも、えらんで いいよ。',
    ],
    explain: DIARY_EXPLAIN,
  }),
  explainItem({
    id: 'diary-alt-a3',
    obj: 'diary',
    level: 1,
    alt: true,
    prompt: 'つぎに みて みたい ところを えらぼう。',
    reasons: ['はっぱの かたち', 'くきの ふとさ', 'つぼみ や はな', 'ねっこ'],
    hints: [
      'もっと しりたい ところは どこかな。',
      'ひとつだけ えらぼう。',
      'どれを えらんでも だいじょうぶ。つぎの かんさつで みて みよう。',
    ],
    explain: DIARY_EXPLAIN,
  }),
];

// ---- growth ----
const STAGES = {
  seed: ['たね', illust('life-seed')],
  sprout: ['め', illust('life-sprout')],
  leaves: ['はっぱ', illust('life-leaves')],
  bud: ['つぼみ', illust('life-bud')],
  flower: ['はな', illust('flower')],
  fruit: ['み（トマト）', illust('tomato')],
} as const;
type St = keyof typeof STAGES;
interface Go {
  id: string;
  level: number;
  prompt: string;
  seq: St[];
  hints: [string, string, string];
  explain: string;
}
const GROWTH: Go[] = [
  {
    id: 'o1',
    level: 0,
    prompt: 'そだつ じゅんに ならべよう。',
    seq: ['seed', 'sprout', 'leaves', 'flower'],
    hints: [
      'はじめは、つちの なかに ある ものだよ。',
      'たねから でて きた ものは、ちいさな めだよ。',
      'はっぱが ふえて、さいごに はなが さくよ。',
    ],
    explain: 'たね、め、はっぱ、はな の じゅんだよ。たねから めが でて、はっぱが ふえて、はなが さくね。',
  },
  {
    id: 'o2',
    level: 0,
    prompt: 'はなが さくまでを、そだつ じゅんに ならべよう。',
    seq: ['seed', 'sprout', 'leaves', 'bud', 'flower'],
    hints: [
      'はじめに ある ものを さがそう。',
      'はなが さく まえに、ふくらんだ ものが できるよ。',
      'はっぱの つぎは つぼみ、そのつぎは はなだよ。',
    ],
    explain: 'たね、め、はっぱ、つぼみ、はな の じゅんだよ。つぼみが ひらいて はなに なるよ。',
  },
  {
    id: 'o3',
    level: 1,
    prompt: 'めが でて から、はなが さくまでを ならべよう。',
    seq: ['sprout', 'leaves', 'bud', 'flower'],
    hints: [
      'いちばん ちいさい すがたから はじめよう。',
      'はっぱが ふえて、おおきく なって いくよ。',
      'はなが さく まえは、つぼみだよ。',
    ],
    explain: 'め、はっぱ、つぼみ、はな の じゅんだよ。だんだん おおきく なって いくね。',
  },
  {
    id: 'o4',
    level: 1,
    prompt: 'たねから はなが さくまでを、そだつ じゅんに ならべよう。',
    seq: ['seed', 'sprout', 'bud', 'flower'],
    hints: [
      'たねが いちばん はじめだよ。',
      'めが でてから、つぼみが できるよ。',
      'つぼみが ひらくと はなだよ。',
    ],
    explain: 'たね、め、つぼみ、はな の じゅんだよ。（まんなかで はっぱも ふえて いくよ）',
  },
  {
    id: 'o5',
    level: 2,
    prompt: 'トマトが できるまでを、そだつ じゅんに ならべよう。',
    seq: ['seed', 'sprout', 'flower', 'fruit'],
    hints: [
      'トマトも、たねから はじまるよ。',
      'みが できる まえに、はなが さくよ。',
      'さいごに、あかい みが なるよ。',
    ],
    explain: 'たね、め、はな、み の じゅんだよ。トマトは、はなが さいてから みが できるよ。',
  },
  {
    id: 'o6',
    level: 2,
    prompt: 'トマトの そだちの うち、はっぱが ふえた ところから ならべよう。',
    seq: ['leaves', 'bud', 'flower', 'fruit'],
    hints: [
      'はっぱが ふえた あとの ことだよ。',
      'はなが さく まえに、つぼみが できるよ。',
      'みが できるのは、いちばん さいごだよ。',
    ],
    explain: 'はっぱ、つぼみ、はな、み の じゅんだよ。はなの あとに みが できるね。',
  },
];
const growthItems: OrderItem[] = GROWTH.map((g) =>
  orderItem({
    id: `growth-${g.id}`,
    obj: 'growth',
    level: g.level,
    prompt: g.prompt,
    cards: g.seq.map((s) => [STAGES[s][0], STAGES[s][1]]),
    ends: ['はじめ', 'おわり'],
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
    prompt: 'つぼみの つぎは どれかな。',
    right: 'はな',
    rightFigure: illust('flower'),
    wrongs: [
      ['たね', 'growth-order'],
      ['め', 'growth-order'],
    ],
    wrongFigures: [illust('life-seed'), illust('life-sprout')],
    layout: 'row',
    hints: [
      'つぼみは、ふくらんだ まるい ものだよ。',
      'つぼみが ひらくと どうなるかな。',
      'いろが きれいな ものに なるよ。',
    ],
    explain: 'つぼみが ひらくと、はなが さくよ。',
  }),
  choiceItem({
    id: 'growth-alt-a2',
    obj: 'growth',
    level: 1,
    alt: true,
    prompt: 'めが でた あと、そだって いくと どうなるかな。',
    right: 'はっぱが ふえる',
    rightFigure: illust('life-leaves'),
    wrongs: [
      ['また たねに もどる', 'growth-order'],
      ['すぐに みが なる', 'growth-order'],
    ],
    wrongFigures: [illust('life-seed'), illust('tomato')],
    layout: 'row',
    hints: [
      'めの うえの ほうを よく みよう。',
      'めが のびて いくと、はっぱが ふえて いくよ。',
      'はな や み に なる まえの すがたを えらぼう。',
    ],
    explain: 'めが でたら、はっぱが ふえて、だんだん おおきく なるよ。',
  }),
  choiceItem({
    id: 'growth-alt-a3',
    obj: 'growth',
    level: 2,
    alt: true,
    prompt: 'トマトの はなが さいた あとに できる ものは どれかな。',
    right: 'み',
    rightFigure: illust('tomato'),
    wrongs: [
      ['たね', 'growth-order'],
      ['め', 'growth-order'],
    ],
    wrongFigures: [illust('life-seed'), illust('life-sprout')],
    layout: 'row',
    hints: [
      'トマトは、なにを たべるかな。',
      'はなが さいた あとの ことだよ。',
      'あかい たべものに なる ものだよ。',
    ],
    explain: 'トマトは、はなが さいた あとに みが できるよ。',
  }),
];

// ---- care ----
interface Cr {
  id: string;
  level: number;
  prompt: string;
  fig?: string;
  right: string;
  wrongs: [string, string][];
  hints: [string, string, string];
  explain: string;
}
const CARE: Cr[] = [
  {
    id: 'c1',
    level: 0,
    prompt: 'うえきばちの つちが かわいて いるよ。どうするかな。',
    fig: 'life-watering-can',
    right: 'みずを あげる',
    wrongs: [
      ['ジュースを あげる', 'care-wrong'],
      ['なにも しない', 'care-skip'],
    ],
    hints: [
      'つちを さわって みよう。',
      'かわいて いると、しょくぶつは どうなるかな。',
      'のどが かわいた ときに のむ ものを、あげよう。',
    ],
    explain: 'つちが かわいて いたら、みずを あげるよ。しょくぶつは、みずを のんで そだつからね。',
  },
  {
    id: 'c2',
    level: 0,
    prompt: 'しょくぶつは どこに おくと よいかな。',
    fig: 'life-sun',
    right: 'ひなた（たいようの ひかりが あたる ところ）',
    wrongs: [
      ['くらい ところ', 'care-wrong'],
      ['れいぞうこの なか', 'care-wrong'],
    ],
    hints: [
      'しょくぶつは、ひかりを あびて そだつよ。',
      'くらくて さむい ところは、どうかな。',
      'たいようが あたる ところを えらぼう。',
    ],
    explain: 'しょくぶつは、たいようの ひかりを あびて そだつよ。ひなたに おくと、げんきに なるね。',
  },
  {
    id: 'c3',
    level: 1,
    prompt: 'みずを いちどに たくさん あげすぎると、どうなるかな。',
    right: 'ねが いたんで、かれて しまう ことが ある',
    wrongs: [
      ['もっと げんきに なる', 'care-wrong'],
      ['ぜんぜん かわらない', 'care-wrong'],
    ],
    hints: [
      'しょくぶつの ねは、つちの なかで いきを して いるよ。',
      'みずが おおすぎると、いきが しにくく なるね。',
      'ほどよい りょうが だいじだよ。',
    ],
    explain: 'みずを あげすぎると ねが いたんで、かれる ことが あるよ。つちが かわいてから あげると いいね。',
  },
  {
    id: 'c4',
    level: 1,
    prompt: 'はっぱに むしが ついて いたよ。どうするかな。',
    right: 'おとなに いって、いっしょに たしかめる',
    wrongs: [
      ['なにも しない', 'care-skip'],
      ['はっぱを ぜんぶ ちぎる', 'care-wrong'],
    ],
    hints: [
      'どんな むしか、よく みて みよう。',
      'ひとりで さわるのが あぶない むしも いるよ。',
      'おとなに みて もらいながら、どうするか きめよう。',
    ],
    explain: 'おとなに いって、いっしょに たしかめよう。むしの なかには、さわると あぶない ものも いるからね。',
  },
  {
    id: 'c5',
    level: 2,
    prompt: 'はっぱが しおれて いるよ。まず どうするかな。',
    fig: 'life-pot',
    right: 'つちを さわって、かわいて いないか たしかめる',
    wrongs: [
      ['すぐに ひっこぬく', 'care-wrong'],
      ['うえきばちを ゆらす', 'care-wrong'],
    ],
    hints: [
      'しおれる わけは、いろいろ あるよ。',
      'まず つちの ようすを みて みよう。',
      'つちが かわいて いたら、みずが たりないのかも しれないね。',
    ],
    explain: 'しおれて いたら、まず つちが かわいて いないか たしかめるよ。みずが たりない ことが おおいね。',
  },
  {
    id: 'c6',
    level: 2,
    prompt: 'たいふうが くる ひ、うえきばちは どうするかな。',
    right: 'いえの なかに いれる',
    wrongs: [
      ['そとに おいた ままに する', 'care-skip'],
      ['もっと みずを あげる', 'care-wrong'],
    ],
    hints: [
      'つよい かぜが ふくと、うえきばちは どうなるかな。',
      'たおれたり、とばされたり する ことが あるね。',
      'あんぜんな ばしょに うつして あげよう。',
    ],
    explain: 'つよい かぜの ひは、いえの なかに いれるよ。たおれたり、とばされたり しないように ね。',
  },
];
const careItems: ChoiceItem[] = CARE.map((c) =>
  choiceItem({
    id: `care-${c.id}`,
    obj: 'care',
    level: c.level,
    prompt: c.prompt,
    ...(c.fig ? { figure: illust(c.fig) } : {}),
    right: c.right,
    wrongs: c.wrongs,
    layout: 'column',
    hints: c.hints,
    explain: c.explain,
  }),
);

const NEED_HINTS: [string, string, string] = [
  'しょくぶつが そだつ ために ひつような ものを かんがえよう。',
  'みず・ひかり・つち などは、そだつ ために たいせつだよ。',
  'しょくぶつが たべない ものや、いらない ものは「ひつようない」だよ。',
];
const careSorts = [
  sortItem({
    id: 'care-alt-s1',
    obj: 'care',
    level: 1,
    alt: true,
    prompt: 'そだつ ために「ひつよう」か わけよう。',
    boxes: ['ひつよう', 'ひつようない'],
    cards: [
      ['みず', 0],
      ['たいようの ひかり', 0],
      ['つち', 0],
      ['ジュース', 1],
      ['おおきな おと', 1],
      ['くつ', 1],
    ],
    mis: 'care-sort',
    hints: NEED_HINTS,
    explain: 'みず・ひかり・つち は ひつよう。ジュース・おおきな おと・くつ は しょくぶつには いらないよ。',
  }),
  sortItem({
    id: 'care-alt-s2',
    obj: 'care',
    level: 2,
    alt: true,
    prompt: 'うえきの せわで「する」「しない」に わけよう。',
    boxes: ['する こと', 'しない こと'],
    cards: [
      ['つちが かわいたら みずを あげる', 0],
      ['ひなたに おく', 0],
      ['まいにち ようすを みる', 0],
      ['みずを いちどに たくさん あげる', 1],
      ['はっぱを ひっぱる', 1],
      ['くらい ところに おく', 1],
    ],
    mis: 'care-sort',
    hints: NEED_HINTS,
    explain: 'ようすを みて、ひなたに おいて、かわいたら みずを あげるのが せわだよ。むりに ひっぱったり、あげすぎたり しないよ。',
  }),
  sortItem({
    id: 'care-alt-s3',
    obj: 'care',
    level: 2,
    alt: true,
    prompt: 'せわの こころがけを「よい」「よくない」に わけよう。',
    boxes: ['よい こと', 'よくない こと'],
    cards: [
      ['やさしく さわる', 0],
      ['てを あらってから さわる', 0],
      ['おわったら かたづける', 0],
      ['つよく にぎる', 1],
      ['はっぱを ちぎって あそぶ', 1],
      ['ほうって おく', 1],
    ],
    mis: 'care-sort',
    hints: NEED_HINTS,
    explain: 'やさしく さわって、てを あらい、かたづけるのが よい こと。つよく にぎる・ちぎる・ほうって おく のは よくないね。',
  }),
];

const items: Item[] = [
  ...diaryItems,
  ...diaryAlts,
  ...growthItems,
  ...growthAlts,
  ...careItems,
  ...careSorts,
];

export const plantDiary: UnitSpec = {
  ...baseLife('g1.life.plant-diary', 'g1'),
  title: 'そだてて いる しょくぶつ',
  kind: 'inquiry',
  prereq: [],
  objectives: [
    { id: 'diary', title: 'よく みて、わかった ことを かく' },
    { id: 'growth', title: 'しょくぶつの そだつ じゅんばん' },
    { id: 'care', title: 'せわに ひつような こと' },
  ],
  misconceptions: [
    {
      id: 'growth-order',
      explain:
        'そだつ じゅんばんが ちがったのかな。たねから めが でて、はっぱが ふえて、つぼみ・はなに なる じゅんだよ。',
    },
    {
      id: 'care-wrong',
      explain:
        'しょくぶつに あわない せわを えらんだのかな。しょくぶつは、みず・ひかり・つち で そだつよ。',
    },
    {
      id: 'care-skip',
      explain:
        'なにも しなかったのかな。しょくぶつも いきて いるから、ようすを みて せわを して あげよう。',
    },
    {
      id: 'care-sort',
      explain:
        'ひつようと ひつようないが いれかわったのかな。しょくぶつが そだつ ために たいせつな ものを おもいだそう。',
    },
  ],
  levels: [
    { label: 'みて かく・そだつ じゅん', chance: 0.2 },
    { label: 'くらべて かく・せわ', chance: 0.2 },
    { label: 'トマトと せわの わけ', chance: 0.2 },
  ],
  intro: [
    {
      text: 'しょくぶつを そだてて、よく みて、わかった ことを かこう。たねから はなまでの じゅんばんも ならべて みよう。',
      figure: {
        kind: 'row',
        items: [illust('life-seed'), illust('life-sprout'), illust('life-leaves'), illust('life-bud'), illust('flower')],
        gap: 6,
      },
    },
    {
      text: 'ほんものの しょくぶつを、じぶんの めで みて、さわって、せわを して みよう。この がめんは、わかった ことを ととのえる ところだよ。',
      figure: illust('life-watering-can'),
    },
    {
      text: 'かんさつ きろくに、まちがいは ないよ。じぶんの めで みた ことを かこう。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）生活 (7)（動物を飼ったり植物を育てたりする活動。2学年間継続）。学年の割当は本アプリの案（生活は第1・2学年のまとまり）。観察・栽培は実体験が本体で、本単元は記録・整理の補助',
  gradeIsAppProposal: true,
};








