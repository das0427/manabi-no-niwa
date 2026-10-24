/**
 * g2.ja.polite ていねいな ことば（curriculum-matrix 3.5）。
 * 相手に合う言い方を選ぶ → 普通の言い方を丁寧に直す → 敬体（です・ます）でそろえて書く。
 *
 * 同一性キー: 「場面（相手と言うこと）」「直す語」「文章」ごと。
 */
import type { ChoiceItem, FillItem, Item, UnitSpec } from '../../curriculum/types';
import { opts, REVISED } from './util';

const SENSEI = '先生《せんせい》';

// ---- 1. あいてに あう いいかた ----
/** [相手, 場面のことば, ていねい, ふつう, まちがった ていねい, その誤概念] */
const AITE: [string, string, string, string, string, string][] = [
  [
    SENSEI,
    'テレビで みた ことを はなす',
    'きのう テレビで みました。',
    'きのう テレビで みた。',
    'きのう テレビで みましたです。',
    'double-polite',
  ],
  [
    SENSEI,
    'せつめいが わかった ことを つたえる',
    'よく わかりました。',
    'よく わかった。',
    'よく わかったです。',
    'desu-on-verb',
  ],
  [
    '校長《こうちょう》' + SENSEI,
    'あさ あった とき',
    'おはよう ございます。',
    'おはよう。',
    'おはよう ございますです。',
    'double-polite',
  ],
  [
    'となりの いえの おばあさん',
    'でかける とき',
    'いって きます。',
    'いって くる。',
    'いって くるです。',
    'desu-on-verb',
  ],
  [
    'おみせの 人《ひと》',
    'ものを うけとった とき',
    'ありがとう ございます。',
    'ありがとう。',
    'ありがとう ございますです。',
    'double-polite',
  ],
  [
    SENSEI,
    'あした どこへ いくか はなす',
    'あした としょかんへ いきます。',
    'あした としょかんへ いく。',
    'あした としょかんへ いくです。',
    'desu-on-verb',
  ],
  [
    'クラスの みんな',
    'はっぴょうで すきな ものを いう',
    'ぼくは いぬが すきです。',
    'ぼくは いぬが すきだ。',
    'ぼくは いぬが すきだです。',
    'double-polite',
  ],
  [
    SENSEI,
    'わからない ものの なまえを きく',
    'これは なんですか。',
    'これ なに？',
    'これは なんだですか。',
    'double-polite',
  ],
];

function aiteItem([who, scene, ok, plain, bad, mis]: (typeof AITE)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `aite:${ok}`,
    objective: 'aite',
    level: 0,
    layout: 'column',
    prompt: `${who}に、${scene}。どの いいかたが よいかな？`,
    options: opts(ok, [
      [plain, 'plain-to-elder'],
      [bad, mis],
    ]),
    hints: [
      `あいては ${who}だね。`,
      'めうえの 人《ひと》や みんなの まえでは、ていねいな いいかたを つかうよ。',
      '「です」「ます」「ございます」が ただしく ついて いるか みよう。',
    ],
    explain: `${who}には ていねいに「${ok}」と いいます。`,
    identity: `aite:${ok}`,
  };
}

/** 別例: 文の中に入れる。[文, ていねい, ふつう, まちがい, 誤概念] */
const AITE_ALT: [string, string, string, string, string][] = [
  [
    '先生《せんせい》、きのう えほんを {{}}。',
    'よみました',
    'よんだ',
    'よんだです',
    'desu-on-verb',
  ],
  [
    '先生《せんせい》、この はなの なまえは {{}}。',
    'なんですか',
    'なに',
    'なんだですか',
    'double-polite',
  ],
  [
    '校長《こうちょう》先生《せんせい》、さようなら。また あした {{}}。',
    'きます',
    'くる',
    'くるです',
    'desu-on-verb',
  ],
];

function aiteAlt([t, ok, plain, bad, mis]: (typeof AITE_ALT)[number]): FillItem {
  return {
    engine: 'fill',
    id: `aite-alt:${ok}`,
    objective: 'aite',
    level: 1,
    alt: true,
    prompt: '{{}}に はいる、あいてに あう いいかたを えらぼう。',
    text: t,
    options: [ok, plain, bad],
    blanks: [
      {
        answers: [ok],
        wrong: [
          { value: plain, misconception: 'plain-to-elder' },
          { value: bad, misconception: mis },
        ],
      },
    ],
    hints: [
      'だれに はなして いるかな。',
      'めうえの 人《ひと》には ていねいに いうよ。',
      '「〜ます」「〜です」の ただしい かたちを えらぼう。',
    ],
    explain: `${plainOf(t)}は めうえの 人《ひと》への ことばなので「${ok}」が あいます。`,
    identity: `aite-alt:${ok}`,
  };
}

/** 解説で使う、文のはじめ（呼びかけ） */
function plainOf(t: string): string {
  return t.startsWith('校長') ? '校長《こうちょう》先生《せんせい》' : '先生《せんせい》';
}

// ---- 2. ていねいに なおす ----
/** [文（{{}}入り）, ふつう, ていねい, まちがい, 誤概念] */
const NAOSU: [string, string, string, string, string][] = [
  ['きのう こうえんへ {{}}。', 'いった', 'いきました', 'いったです', 'desu-on-verb'],
  ['あさごはんに パンを {{}}。', 'たべた', 'たべました', 'たべたです', 'desu-on-verb'],
  ['まいにち ほんを {{}}。', 'よむ', 'よみます', 'よむです', 'desu-on-verb'],
  ['よるは 九《く》じに {{}}。', 'ねる', 'ねます', 'ねるです', 'desu-on-verb'],
  ['ともだちと すなばで {{}}。', 'あそんだ', 'あそびました', 'あそんだです', 'desu-on-verb'],
  ['にっきを {{}}。', 'かいた', 'かきました', 'かいたです', 'desu-on-verb'],
  ['うんどうかいで {{}}。', 'はしった', 'はしりました', 'はしったです', 'desu-on-verb'],
  ['あしたは {{}}。', 'にちようびだ', 'にちようびです', 'にちようびだです', 'double-polite'],
  ['わたしの すきな いろは {{}}。', 'みどりだ', 'みどりです', 'みどりだです', 'double-polite'],
];

function naosuItem([t, plain, ok, bad, mis]: (typeof NAOSU)[number]): FillItem {
  return {
    engine: 'fill',
    id: `naosu:${plain}`,
    objective: 'naosu',
    level: 1,
    prompt: `「${plain}」を ていねいな いいかたに なおして いれよう。`,
    text: t,
    options: [ok, bad, plain],
    blanks: [
      {
        answers: [ok],
        wrong: [
          { value: bad, misconception: mis },
          { value: plain, misconception: 'plain-to-elder' },
        ],
      },
    ],
    hints: [
      'ていねいな いいかたは「です」「ます」で おわるよ。',
      mis === 'double-polite'
        ? '「だ」と「です」は いっしょに つかわないよ。'
        : 'うごきの ことばには「です」を そのまま つけないよ。',
      mis === 'double-polite'
        ? '「〜だ」の「だ」を「です」に かえよう。'
        : '「〜ます」「〜ました」の かたちに かえよう。',
    ],
    explain: `「${plain}」を ていねいに いうと「${ok}」です。`,
    identity: `naosu:${plain}`,
  };
}

/** 別例: 選ぶ。[ふつう, ていねい, まちがい, 誤概念] */
const NAOSU_ALT: [string, string, string, string][] = [
  ['のんだ', 'のみました', 'のんだです', 'desu-on-verb'],
  ['おきる', 'おきます', 'おきるです', 'desu-on-verb'],
  ['ねこだ', 'ねこです', 'ねこだです', 'double-polite'],
];

function naosuAlt([plain, ok, bad, mis]: (typeof NAOSU_ALT)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `naosu-alt:${plain}`,
    objective: 'naosu',
    level: 1,
    alt: true,
    prompt: `「${plain}」を ていねいに した いいかたは どれ？`,
    options: opts(ok, [
      [bad, mis],
      [`${plain}よ`, 'plain-to-elder'],
    ]),
    hints: [
      'ていねいな いいかたは「です」「ます」で おわるよ。',
      mis === 'double-polite'
        ? '「だ」と「です」を かさねないよ。'
        : 'うごきの ことばは「ます」の かたちに かわるよ。',
      'こえに だして、しぜんに きこえるか たしかめよう。',
    ],
    explain: `「${plain}」の ていねいな いいかたは「${ok}」です。`,
    identity: `naosu-alt:${plain}`,
  };
}

// ---- 3. です・ます で そろえて かく ----
/** [前の文（です・ます）, 空欄の文, ていねい, ふつう, まちがい, 誤概念] */
const KEITAI: [string, string, string, string, string, string][] = [
  [
    'わたしは 花《はな》が すきです。',
    'とくに ひまわりが {{}}。',
    'すきです',
    'すきだ',
    'すきだです',
    'double-polite',
  ],
  [
    'きのう いもを ほりました。',
    'とても {{}}。',
    'おもかったです',
    'おもかった',
    'おもかったでした',
    'double-polite',
  ],
  [
    'ぼくの いえには ねこが います。',
    'なまえは {{}}。',
    'ミケです',
    'ミケだ',
    'ミケだです',
    'double-polite',
  ],
  [
    'なつやすみに うみへ いきました。',
    'みんなで {{}}。',
    'およぎました',
    'およいだ',
    'およいだです',
    'desu-on-verb',
  ],
  [
    'あさがおの たねを まきました。',
    'まいあさ 水《みず》を {{}}。',
    'やります',
    'やる',
    'やるです',
    'desu-on-verb',
  ],
  [
    'えんそくで どうぶつえんへ いきました。',
    'ぞうが {{}}。',
    'いました',
    'いた',
    'いたです',
    'desu-on-verb',
  ],
  [
    'わたしの いもうとは 三《みっ》つです。',
    'よく {{}}。',
    'わらいます',
    'わらう',
    'わらうです',
    'desu-on-verb',
  ],
];

function keitaiItem([first, t, ok, plain, bad, mis]: (typeof KEITAI)[number]): FillItem {
  return {
    engine: 'fill',
    id: `keitai:${ok}`,
    objective: 'keitai',
    level: 2,
    prompt: 'まえの ぶんと そろうように、{{}}に はいる ことばを えらぼう。',
    text: `${first}${t}`,
    options: [ok, plain, bad],
    blanks: [
      {
        answers: [ok],
        wrong: [
          { value: plain, misconception: 'mixed-style' },
          { value: bad, misconception: mis },
        ],
      },
    ],
    hints: [
      'まえの ぶんは どんな ことばで おわって いるかな。',
      'ひとつの ぶんしょうでは、おわりの いいかたを そろえるよ。',
      '「です」「ます」の かたちで、しぜんに きこえる ものを えらぼう。',
    ],
    explain: `まえの ぶんが「です・ます」なので、「${ok}」で そろえます。`,
    identity: `keitai:${ok}`,
  };
}

/** 別例: そろった文章を選ぶ */
const KEITAI_ALT: [string, string, string][] = [
  [
    'きょうは あめでした。いえで えを かきました。',
    'きょうは あめでした。いえで えを かいた。',
    'きょうは あめだです。いえで えを かきました。',
  ],
  [
    'ぼくの すきな たべものは カレーです。こんやも たべたいです。',
    'ぼくの すきな たべものは カレーです。こんやも たべたい。',
    'ぼくの すきな たべものは カレーだです。こんやも たべたいです。',
  ],
  [
    'がっこうの にわに さくらが あります。はるに さきます。',
    'がっこうの にわに さくらが ある。はるに さきます。',
    'がっこうの にわに さくらが あるです。はるに さきます。',
  ],
];

function keitaiAlt([ok, mixed, bad]: (typeof KEITAI_ALT)[number], i: number): ChoiceItem {
  return {
    engine: 'choice',
    id: `keitai-alt:${i}`,
    objective: 'keitai',
    level: 2,
    alt: true,
    layout: 'column',
    prompt: '「です」「ます」で ただしく そろって いる ぶんしょうは どれ？',
    options: opts(ok, [
      [mixed, 'mixed-style'],
      [bad, i === 2 ? 'desu-on-verb' : 'double-polite'],
    ]),
    hints: [
      'ひとつずつ、ぶんの おわりを みよう。',
      'ふつうの いいかたが まじって いないかな。',
      '「だです」「るです」の ような おかしな かたちが ないかな。',
    ],
    explain: `「${ok}」は どの ぶんも「です」「ます」で そろって います。`,
    identity: `keitai-alt:${i}`,
  };
}

const items: Item[] = [
  ...AITE.map(aiteItem),
  ...AITE_ALT.map(aiteAlt),
  ...NAOSU.map(naosuItem),
  ...NAOSU_ALT.map(naosuAlt),
  ...KEITAI.map(keitaiItem),
  ...KEITAI_ALT.map(keitaiAlt),
];

export const polite: UnitSpec = {
  id: 'g2.ja.polite',
  title: 'ていねいな ことば',
  stage: 'g2',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: [],
  objectives: [
    { id: 'aite', title: 'あいてに あう いいかたを えらぶ' },
    { id: 'naosu', title: 'ふつうの いいかたを ていねいに なおす' },
    { id: 'keitai', title: '「です」「ます」で そろえて かく' },
  ],
  misconceptions: [
    {
      id: 'plain-to-elder',
      explain:
        'ともだちと はなす ときの いいかたを えらんだのかな。めうえの 人《ひと》や みんなの まえでは「です」「ます」を つかうよ。',
    },
    {
      id: 'desu-on-verb',
      explain:
        'うごきの ことばに「です」を つけたのかな。「いった」は「いったです」では なく「いきました」に なるよ。',
    },
    {
      id: 'double-polite',
      explain:
        'ていねいな ことばを かさねたのかな。「だ」と「です」、「ました」と「です」は いっしょに つかわないよ。',
    },
    {
      id: 'mixed-style',
      explain:
        'ふつうの いいかたが まじったのかな。ひとつの ぶんしょうでは「です」「ます」で そろえると よみやすいよ。',
    },
  ],
  levels: [
    { label: 'あいてに あう いいかた', chance: 0.05 },
    { label: 'ていねいに なおす', chance: 0.05 },
    { label: 'です・ます で そろえる', chance: 0.05 },
  ],
  intro: [
    {
      text: 'ともだちには「きのう みた。」と いいますね。',
    },
    {
      text: '先生《せんせい》や めうえの 人《ひと》には「きのう みました。」と、「です」「ます」を つけて ていねいに いいます。',
      figure: { kind: 'text', text: 'みた → **みました**', size: 'xl' },
    },
    {
      text: 'ぶんしょうを かく ときは、おわりを「です」「ます」で そろえます。',
    },
  ],
  source: { kind: 'items', items },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕(1)キ（丁寧な言葉と普通の言葉との違いに気を付けて使うとともに、敬体で書かれた文章に慣れること）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
