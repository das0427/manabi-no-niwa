/**
 * g2.ja.orthography かなづかいの きまり（curriculum-matrix 3.5）。
 * 現代仮名遣い（昭和61年内閣告示第1号）に沿う:
 *  - オ列の長音は「う」（おとうさん・がっこう）。ただし歴史的仮名遣いで「ほ・を」に由来する語は「お」（こおり・おおきい・とおい 等。告示の例に挙がる語だけを使う）。
 *  - エ列の長音は「い」（せんせい・とけい）。「おねえさん」は「え」。
 *  - 「ぢ・づ」は 同音の連呼（ちぢむ・つづく）と 二語の連合（はな＋ち→はなぢ、みか＋つき→みかづき）。
 *    それ以外は「じ・ず」（じめん・ずこう・すずめ・みず）。「じ・ず」も許される語（いなずま・せかいじゅう 等）は使わない。
 *
 * 同一性キー: 語ごと（別例は文の中の語）。
 */
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import { opts, REVISED, type Wrong } from './util';

type Obj = 'oo' | 'ou' | 'didu' | 'jizu';
interface Word {
  ok: string;
  meaning: string;
  wrongs: Wrong[];
}
const W = (ok: string, meaning: string, ...wrongs: Wrong[]): Word => ({ ok, meaning, wrongs });

const OO: Word[] = [
  W(
    'こおり',
    'みずが ひえて かたまった もの',
    ['こうり', 'ou-for-oo'],
    ['こーり', 'bar-in-hiragana'],
  ),
  W(
    'おおきい',
    '「ちいさい」の はんたい',
    ['おうきい', 'ou-for-oo'],
    ['おーきい', 'bar-in-hiragana'],
  ),
  W('とおい', '「ちかい」の はんたい', ['とうい', 'ou-for-oo'], ['とーい', 'bar-in-hiragana']),
  W(
    'おおかみ',
    'もりに すむ、いぬに にた どうぶつ',
    ['おうかみ', 'ou-for-oo'],
    ['おーかみ', 'bar-in-hiragana'],
  ),
  W('とおる', 'みちを すすんで いく こと', ['とうる', 'ou-for-oo'], ['とーる', 'bar-in-hiragana']),
  W('おおい', '「すくない」の はんたい', ['おうい', 'ou-for-oo'], ['おーい', 'bar-in-hiragana']),
  W('とお', 'かずの 10', ['とう', 'ou-for-oo'], ['とー', 'bar-in-hiragana']),
  W(
    'ほのお',
    'もえて いる ひの さきの ところ',
    ['ほのう', 'ou-for-oo'],
    ['ほのー', 'bar-in-hiragana'],
  ),
  W(
    'こおろぎ',
    'あきに なく、くろい むし',
    ['こうろぎ', 'ou-for-oo'],
    ['こーろぎ', 'bar-in-hiragana'],
  ),
  W('ほお', 'かおの、ほっぺたの ところ', ['ほう', 'ou-for-oo'], ['ほー', 'bar-in-hiragana']),
];
const OU: Word[] = [
  W('おとうさん', 'ちち の こと', ['おとおさん', 'oo-for-ou'], ['おとーさん', 'bar-in-hiragana']),
  W(
    'がっこう',
    'まいにち べんきょうに いく ところ',
    ['がっこお', 'oo-for-ou'],
    ['がっこー', 'bar-in-hiragana'],
  ),
  W('ひこうき', 'そらを とぶ のりもの', ['ひこおき', 'oo-for-ou'], ['ひこーき', 'bar-in-hiragana']),
  W('ぼうし', 'あたまに かぶる もの', ['ぼおし', 'oo-for-ou'], ['ぼーし', 'bar-in-hiragana']),
  W(
    'おとうと',
    'としが したの おとこの きょうだい',
    ['おとおと', 'oo-for-ou'],
    ['おとーと', 'bar-in-hiragana'],
  ),
  W(
    'こうえん',
    'すべりだいや ぶらんこが ある ところ',
    ['こおえん', 'oo-for-ou'],
    ['こーえん', 'bar-in-hiragana'],
  ),
  W(
    'どうぶつ',
    'いぬや ねこや ぞうの なかま',
    ['どおぶつ', 'oo-for-ou'],
    ['どーぶつ', 'bar-in-hiragana'],
  ),
  W(
    'せんせい',
    'がっこうで おしえて くれる 人《ひと》',
    ['せんせえ', 'ee-for-ei'],
    ['せんせー', 'bar-in-hiragana'],
  ),
  W('とけい', 'じこくを しらせる どうぐ', ['とけえ', 'ee-for-ei'], ['とけー', 'bar-in-hiragana']),
  W(
    'えいが',
    'おおきな がめんで みる おはなし',
    ['ええが', 'ee-for-ei'],
    ['えーが', 'bar-in-hiragana'],
  ),
  W(
    'おねえさん',
    'としが うえの おんなの きょうだい',
    ['おねいさん', 'ei-for-ee'],
    ['おねーさん', 'bar-in-hiragana'],
  ),
];
const DIDU: Word[] = [
  W('はなぢ', 'はなから でる ち', ['はなじ', 'ji-for-di'], ['はなち', 'dakuten-drop']),
  W('みかづき', 'ほそく みえる つき', ['みかずき', 'zu-for-du'], ['みかつき', 'dakuten-drop']),
  W('ちぢむ', 'ちいさく なる こと', ['ちじむ', 'ji-for-di'], ['ちちむ', 'dakuten-drop']),
  W('つづく', 'おわらずに まだ ある こと', ['つずく', 'zu-for-du']),
  W(
    'こづつみ',
    'ゆうびんで おくる にもつ',
    ['こずつみ', 'zu-for-du'],
    ['こつつみ', 'dakuten-drop'],
  ),
  W(
    'てづくり',
    'じぶんの てで つくる こと',
    ['てずくり', 'zu-for-du'],
    ['てつくり', 'dakuten-drop'],
  ),
  W(
    'おこづかい',
    'おうちの 人《ひと》から もらう おかね',
    ['おこずかい', 'zu-for-du'],
    ['おこつかい', 'dakuten-drop'],
  ),
  W(
    'ちぢれる',
    'かみのけが くるくると まがる こと',
    ['ちじれる', 'ji-for-di'],
    ['ちちれる', 'dakuten-drop'],
  ),
];
const JIZU: Word[] = [
  W('じめん', 'あしの したの つちの ところ', ['ぢめん', 'di-for-ji']),
  W('すずめ', 'ちゅんちゅんと なく ちいさな とり', ['すづめ', 'du-for-zu']),
  W('ねずみ', 'ちゅうちゅうと なく ちいさな どうぶつ', ['ねづみ', 'du-for-zu']),
  W('もみじ', 'あきに あかく なる はっぱ', ['もみぢ', 'di-for-ji']),
  W('ずこう', 'えを かいたり ものを つくったり する べんきょう', ['づこう', 'du-for-zu']),
  W('みず', 'のんだり あらったり する、すきとおった もの', ['みづ', 'du-for-zu']),
];

const RULE: Record<Obj, [string, string, string]> = {
  oo: [
    'こえに だして、のばす おとを たしかめよう。',
    'ひらがなでは のばす しるし「ー」を つかわないよ。',
    '「お」の ながい おとは ふつう「う」と かくけれど、「お」と かく とくべつな ことばも あるよ。',
  ],
  ou: [
    'こえに だして、のばす おとを たしかめよう。',
    'ひらがなでは のばす しるし「ー」を つかわないよ。',
    '「お」の ながい おとは「う」、「え」の ながい おとは「い」と かく ことが おおいよ。',
  ],
  didu: [
    'この ことばは どんな ことばから できて いるかな。',
    'もとの ことばの「ち」「つ」が にごった ときや、「ち」「つ」の あとに つづく ときは とくべつだよ。',
    'もとが「ち」「つ」なら、てんてんを つけて「ぢ」「づ」と かくよ。',
  ],
  jizu: [
    'こえに だして よもう。',
    '「ぢ」「づ」を つかうのは とくべつな ときだけ だよ。',
    'もとの ことばが「ち」「つ」で なければ、ふつうの「じ」「ず」で かくよ。',
  ],
};
const EXPLAIN: Record<Obj, (w: string) => string> = {
  oo: (w) => `「${w}」は「お」で のばす とくべつな ことばです。`,
  ou: (w) => `「${w}」と かきます。のばす おとの かきかたに きを つけよう。`,
  didu: (w) =>
    `「${w}」は もとの ことばの「ち」「つ」が にごった ものなので「ぢ」「づ」で かきます。`,
  jizu: (w) => `「${w}」は ふつうの「じ」「ず」で かきます。`,
};
const LEVEL: Record<Obj, number> = { ou: 0, oo: 1, didu: 2, jizu: 2 };

function wordItem(obj: Obj, w: Word): ChoiceItem {
  return {
    engine: 'choice',
    id: `${obj}:${w.ok}`,
    objective: obj,
    level: LEVEL[obj],
    prompt: `「${w.meaning}」を あらわす ことば。ただしい かきかたは どれ？`,
    options: opts(w.ok, w.wrongs),
    hints: RULE[obj],
    explain: EXPLAIN[obj](w.ok),
    identity: `${obj}:${w.ok}`,
  };
}

/** 別例: 文の中で。[語, 正しい文, 誤りの文と誤概念…] */
const ALT: [Obj, string, string, ...Wrong[]][] = [
  [
    'oo',
    'おおきい',
    'おおきな いぬが いる。',
    ['おうきな いぬが いる。', 'ou-for-oo'],
    ['おーきな いぬが いる。', 'bar-in-hiragana'],
  ],
  [
    'oo',
    'とおい',
    'えきは とおい。',
    ['えきは とうい。', 'ou-for-oo'],
    ['えきは とーい。', 'bar-in-hiragana'],
  ],
  [
    'oo',
    'とおる',
    'くるまが とおる。',
    ['くるまが とうる。', 'ou-for-oo'],
    ['くるまが とーる。', 'bar-in-hiragana'],
  ],
  [
    'ou',
    'ひこうき',
    'ひこうきが とぶ。',
    ['ひこおきが とぶ。', 'oo-for-ou'],
    ['ひこーきが とぶ。', 'bar-in-hiragana'],
  ],
  [
    'ou',
    'せんせい',
    'せんせいに あう。',
    ['せんせえに あう。', 'ee-for-ei'],
    ['せんせーに あう。', 'bar-in-hiragana'],
  ],
  [
    'ou',
    'ぼうし',
    'ぼうしを かぶる。',
    ['ぼおしを かぶる。', 'oo-for-ou'],
    ['ぼーしを かぶる。', 'bar-in-hiragana'],
  ],
  ['didu', 'はなぢ', 'はなぢが でた。', ['はなじが でた。', 'ji-for-di']],
  ['didu', 'つづく', 'おはなしが つづく。', ['おはなしが つずく。', 'zu-for-du']],
  ['didu', 'みかづき', 'そらに みかづきが みえる。', ['そらに みかずきが みえる。', 'zu-for-du']],
  ['jizu', 'じめん', 'じめんに すわる。', ['ぢめんに すわる。', 'di-for-ji']],
  ['jizu', 'すずめ', 'すずめが なく。', ['すづめが なく。', 'du-for-zu']],
  ['jizu', 'みず', 'みずを のむ。', ['みづを のむ。', 'du-for-zu']],
];

function altItem([obj, w, ok, ...wrongs]: (typeof ALT)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `${obj}-alt:${w}`,
    objective: obj,
    level: LEVEL[obj],
    alt: true,
    layout: 'column',
    prompt: 'かなづかいが ただしい ぶんは どれ？',
    options: opts(ok, wrongs),
    hints: RULE[obj],
    explain: `ただしい ぶんは「${ok}」です。${EXPLAIN[obj](w)}`,
    identity: `${obj}-alt:${w}`,
  };
}

const items: Item[] = [
  ...OU.map((w) => wordItem('ou', w)),
  ...OO.map((w) => wordItem('oo', w)),
  ...DIDU.map((w) => wordItem('didu', w)),
  ...JIZU.map((w) => wordItem('jizu', w)),
  ...ALT.map(altItem),
];

export const orthography: UnitSpec = {
  id: 'g2.ja.orthography',
  title: 'かなづかいの きまり',
  stage: 'g2',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-hiragana',
  prereq: ['g1.ja.special-kana'],
  objectives: [
    { id: 'ou', title: 'のばす おと（おとうさん・せんせい）' },
    { id: 'oo', title: '「お」で のばす ことば（こおり・おおきい）' },
    { id: 'didu', title: '「ぢ」「づ」を つかう ことば' },
    { id: 'jizu', title: 'ふつうは「じ」「ず」' },
  ],
  misconceptions: [
    {
      id: 'ou-for-oo',
      explain:
        '「お」の ながい おとを いつもの ように「う」と かいたのかな。「こおり」「おおきい」「とおい」は「お」と かく とくべつな ことばだよ。',
    },
    {
      id: 'oo-for-ou',
      explain:
        'きこえた とおりに「お」と かいたのかな。「お」の ながい おとは、ふつう「う」と かくよ（おとうさん・がっこう）。',
    },
    {
      id: 'bar-in-hiragana',
      explain:
        'カタカナの のばす しるし「ー」を つかったのかな。ひらがなの ことばでは「ー」を つかわないよ。',
    },
    {
      id: 'ee-for-ei',
      explain:
        'きこえた とおりに「え」と かいたのかな。「え」の ながい おとは、ふつう「い」と かくよ（せんせい・とけい）。',
    },
    {
      id: 'ei-for-ee',
      explain: '「い」と かいたのかな。「おねえさん」は「え」と かく とくべつな ことばだよ。',
    },
    {
      id: 'ji-for-di',
      explain:
        'いつもの「じ」で かいたのかな。「はな」と「ち」で できた「はなぢ」の ように、もとが「ち」なら「ぢ」と かくよ。',
    },
    {
      id: 'zu-for-du',
      explain:
        'いつもの「ず」で かいたのかな。「みか」と「つき」で できた「みかづき」の ように、もとが「つ」なら「づ」と かくよ。',
    },
    {
      id: 'di-for-ji',
      explain:
        '「ぢ」を つかったのかな。もとの ことばが「ち」で なければ、ふつうの「じ」で かくよ。',
    },
    {
      id: 'du-for-zu',
      explain:
        '「づ」を つかったのかな。もとの ことばが「つ」で なければ、ふつうの「ず」で かくよ。',
    },
    {
      id: 'dakuten-drop',
      explain: 'てんてんを わすれたのかな。こえに だして、にごる おとを たしかめよう。',
    },
  ],
  levels: [
    { label: 'のばす おと', chance: 0.05 },
    { label: '「お」で のばす ことば', chance: 0.05 },
    { label: '「ぢ」「づ」と「じ」「ず」', chance: 0.05 },
  ],
  intro: [
    {
      text: '「お」の ながい おとは、ふつう「う」と かきます。おとうさん、がっこう。',
      figure: { kind: 'text', text: 'おと**う**さん　がっこ**う**', size: 'xl' },
    },
    {
      text: 'でも「こおり」「おおきい」「とおい」の ように、「お」と かく とくべつな ことばも あります。',
      figure: { kind: 'text', text: 'こ**お**り　お**お**きい　と**お**い', size: 'xl' },
    },
    {
      text: '「はな」と「ち」で「はなぢ」、「みか」と「つき」で「みかづき」。もとが「ち」「つ」なら「ぢ」「づ」と かきます。',
    },
  ],
  source: { kind: 'items', items },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕(1)ウ（長音、拗音、促音、撥音などの表記、助詞の「は」、「へ」及び「を」の使い方）。表記は現代仮名遣い（昭和61年内閣告示第1号）による',
  gradeIsAppProposal: true,
  revised: REVISED,
};
