/**
 * g1.ja.special-kana のばす おと・ちいさい じ・「ん」（長音・拗音・促音・撥音の書き表し方）。curriculum-matrix 3.4。
 *
 * 到達項目（各: 聞いて表記を選ぶ = 練習、タイルで語を作る・文の中で正しい書き方を選ぶ = 別例）:
 *   chouon  … のばす おと（おかあさん・おとうさん・とけい など）
 *   youon   … ちいさい「ゃ・ゅ・ょ」
 *   sokuon  … ちいさい「っ」
 *   hatsuon … 「ん」（とくに「む」の ように きこえる「ん」）
 * 長音の書き方は現代仮名遣い（昭和61年内閣告示）の本則（ア・イ・ウ段は同じ母音、エ段は「い」、オ段は「う」）。
 * 例外（おねえさん、「お」と書くオ段の長音 = こおり 等）は、おねえさん だけを扱い、「お」型は g2.ja.orthography に回す。
 * 同一性キー: 形式ごとに語（`listen:<語>`・`build:<語>`・`sentence:<id>`）。
 */
import type { BuildItem } from '../../engines/build/build';
import type { ListenItem } from '../../engines/listen/listen';
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import { opts, REVISED, type Wrong } from './util';

type Kind = 'chouon' | 'youon' | 'sokuon' | 'hatsuon';

const HINT2: Record<Kind, string> = {
  chouon: 'のばす ところが あるよ。のばす おとも じで かくよ。',
  youon: '「や」「ゆ」「よ」を ちいさく かく ところが あるよ。',
  sokuon: 'つまる おと（いきが とまる ところ）が あるよ。',
  hatsuon: 'はねる おと「ん」が あるよ。',
};
const HINT3: Record<Kind, string> = {
  chouon: 'のばす ところは、まえの じの なかまの じ（あ・い・う・え・お）で かくよ。',
  youon: '「き」と ちいさい「ゃ」で「きゃ」。ふたつの じで ひとつの おとだよ。',
  sokuon: 'つまる ところには ちいさい「っ」を かくよ。',
  hatsuon: '「む」の ように きこえても、はねる おとは「ん」と かくよ。',
};
const RULE: Record<Kind, string> = {
  chouon: 'のばす おとも わすれずに かこう。',
  youon: 'ちいさい じは ますの みぎうえに ちいさく かくよ。',
  sokuon: 'つまる ところは ちいさい「っ」。ますの みぎうえに かくよ。',
  hatsuon: '「む」の ように きこえても「ん」と かくよ。',
};

/** [種類, 語, 誤り, 解説に足す一言, ヒント③を変えるとき] */
type L = [kind: Kind, word: string, wrongs: Wrong[], note?: string, hint3?: string];
const LISTEN: L[] = [
  // のばす おと（ア段・イ段・ウ段は同じ母音、エ段は「い」、オ段は「う」）
  [
    'chouon',
    'おかあさん',
    [
      ['おかさん', 'chouon-drop'],
      ['おかーさん', 'chouon-bar'],
    ],
    '「か」を のばすから「あ」。',
    '「か」を のばす おとは「あ」の なかまだよ。',
  ],
  [
    'chouon',
    'おにいさん',
    [
      ['おにさん', 'chouon-drop'],
      ['おにーさん', 'chouon-bar'],
    ],
    '「に」を のばすから「い」。',
    '「に」を のばす おとは「い」の なかまだよ。',
  ],
  [
    'chouon',
    'くうき',
    [
      ['くき', 'chouon-drop'],
      ['くーき', 'chouon-bar'],
    ],
    '「く」を のばすから「う」。',
    '「く」を のばす おとは「う」の なかまだよ。',
  ],
  [
    'chouon',
    'ふうせん',
    [
      ['ふせん', 'chouon-drop'],
      ['ふーせん', 'chouon-bar'],
    ],
    '「ふ」を のばすから「う」。',
    '「ふ」を のばす おとは「う」の なかまだよ。',
  ],
  [
    'chouon',
    'おとうさん',
    [
      ['おとおさん', 'chouon-vowel'],
      ['おとさん', 'chouon-drop'],
    ],
    '「と」を のばす ときは「う」と かくよ。',
    '「お」の なかまの じを のばす ときは「う」と かく ことが おおいよ。',
  ],
  [
    'chouon',
    'ぼうし',
    [
      ['ぼおし', 'chouon-vowel'],
      ['ぼし', 'chouon-drop'],
    ],
    '「ぼ」を のばす ときは「う」と かくよ。',
    '「お」の なかまの じを のばす ときは「う」と かく ことが おおいよ。',
  ],
  [
    'chouon',
    'ひこうき',
    [
      ['ひこおき', 'chouon-vowel'],
      ['ひこき', 'chouon-drop'],
    ],
    '「こ」を のばす ときは「う」と かくよ。',
    '「お」の なかまの じを のばす ときは「う」と かく ことが おおいよ。',
  ],
  [
    'chouon',
    'ゆうがた',
    [
      ['ゆがた', 'chouon-drop'],
      ['ゆーがた', 'chouon-bar'],
    ],
    '「ゆ」を のばすから「う」。',
    '「ゆ」を のばす おとは「う」の なかまだよ。',
  ],
  [
    'chouon',
    'とけい',
    [
      ['とけえ', 'chouon-vowel'],
      ['とけ', 'chouon-drop'],
    ],
    '「け」を のばす ときは「い」と かくよ。',
    '「え」の なかまの じを のばす ときは「い」と かく ことが おおいよ。',
  ],
  [
    'chouon',
    'せんせい',
    [
      ['せんせえ', 'chouon-vowel'],
      ['せんせ', 'chouon-drop'],
    ],
    '「せ」を のばす ときは「い」と かくよ。',
    '「え」の なかまの じを のばす ときは「い」と かく ことが おおいよ。',
  ],
  [
    'chouon',
    'おねえさん',
    [
      ['おねいさん', 'chouon-vowel'],
      ['おねさん', 'chouon-drop'],
    ],
    '「おねえさん」は とくべつに「え」と かくよ。',
    '「おねえさん」は とくべつな かきかたを する ことばだよ。',
  ],
  // ちいさい ゃ・ゅ・ょ
  [
    'youon',
    'きしゃ',
    [
      ['きしや', 'youon-size'],
      ['きし', 'youon-drop'],
    ],
  ],
  [
    'youon',
    'でんしゃ',
    [
      ['でんしや', 'youon-size'],
      ['でんし', 'youon-drop'],
    ],
  ],
  [
    'youon',
    'しゃしん',
    [
      ['しやしん', 'youon-size'],
      ['ししん', 'youon-drop'],
    ],
  ],
  [
    'youon',
    'おもちゃ',
    [
      ['おもちや', 'youon-size'],
      ['おもち', 'youon-drop'],
    ],
  ],
  [
    'youon',
    'きんぎょ',
    [
      ['きんぎよ', 'youon-size'],
      ['きんぎ', 'youon-drop'],
    ],
  ],
  [
    'youon',
    'じゃんけん',
    [
      ['じやんけん', 'youon-size'],
      ['じんけん', 'youon-drop'],
    ],
  ],
  [
    'youon',
    'ひゃく',
    [
      ['ひやく', 'youon-size'],
      ['ひく', 'youon-drop'],
    ],
  ],
  [
    'youon',
    'りょこう',
    [
      ['りよこう', 'youon-size'],
      ['りこう', 'youon-drop'],
    ],
  ],
  [
    'youon',
    'びょういん',
    [
      ['びよういん', 'youon-size'],
      ['びょいん', 'chouon-drop'],
    ],
    '「びよういん」と かくと、かみを きる おみせに なって しまうよ。',
  ],
  [
    'youon',
    'きゅうしょく',
    [
      ['きゆうしょく', 'youon-size'],
      ['きゅしょく', 'chouon-drop'],
    ],
  ],
  [
    'youon',
    'ぎゅうにゅう',
    [
      ['ぎゆうにゆう', 'youon-size'],
      ['ぎゅにゅう', 'chouon-drop'],
    ],
  ],
  // ちいさい っ
  [
    'sokuon',
    'がっこう',
    [
      ['がこう', 'sokuon-drop'],
      ['がつこう', 'sokuon-size'],
    ],
  ],
  [
    'sokuon',
    'きって',
    [
      ['きて', 'sokuon-drop'],
      ['きつて', 'sokuon-size'],
    ],
  ],
  [
    'sokuon',
    'らっぱ',
    [
      ['らぱ', 'sokuon-drop'],
      ['らつぱ', 'sokuon-size'],
    ],
  ],
  [
    'sokuon',
    'きっぷ',
    [
      ['きぷ', 'sokuon-drop'],
      ['きつぷ', 'sokuon-size'],
    ],
  ],
  [
    'sokuon',
    'しっぽ',
    [
      ['しぽ', 'sokuon-drop'],
      ['しつぽ', 'sokuon-size'],
    ],
  ],
  [
    'sokuon',
    'はっぱ',
    [
      ['はぱ', 'sokuon-drop'],
      ['はつぱ', 'sokuon-size'],
    ],
  ],
  [
    'sokuon',
    'ばった',
    [
      ['ばた', 'sokuon-drop'],
      ['ばつた', 'sokuon-size'],
    ],
  ],
  [
    'sokuon',
    'せっけん',
    [
      ['せけん', 'sokuon-drop'],
      ['せつけん', 'sokuon-size'],
    ],
  ],
  [
    'sokuon',
    'にっき',
    [
      ['にき', 'sokuon-drop'],
      ['につき', 'sokuon-size'],
    ],
  ],
  [
    'sokuon',
    'ねっこ',
    [
      ['ねこ', 'sokuon-drop'],
      ['ねつこ', 'sokuon-size'],
    ],
    '「ねこ」と かくと、どうぶつの ねこに なって しまうよ。',
  ],
  // ん（「む」の ように きこえる ところ）
  [
    'hatsuon',
    'えんぴつ',
    [
      ['えぴつ', 'n-drop'],
      ['えむぴつ', 'n-mu'],
    ],
  ],
  [
    'hatsuon',
    'しんぶん',
    [
      ['しぶん', 'n-drop'],
      ['しむぶん', 'n-mu'],
    ],
  ],
  [
    'hatsuon',
    'さんぽ',
    [
      ['さぽ', 'n-drop'],
      ['さむぽ', 'n-mu'],
    ],
  ],
  [
    'hatsuon',
    'てんぷら',
    [
      ['てぷら', 'n-drop'],
      ['てむぷら', 'n-mu'],
    ],
  ],
  [
    'hatsuon',
    'とんぼ',
    [
      ['とぼ', 'n-drop'],
      ['とむぼ', 'n-mu'],
    ],
  ],
  [
    'hatsuon',
    'こんぶ',
    [
      ['こぶ', 'n-drop'],
      ['こむぶ', 'n-mu'],
    ],
  ],
  [
    'hatsuon',
    'たんぽぽ',
    [
      ['たぽぽ', 'n-drop'],
      ['たむぽぽ', 'n-mu'],
    ],
  ],
  [
    'hatsuon',
    'かんぱい',
    [
      ['かぱい', 'n-drop'],
      ['かむぱい', 'n-mu'],
    ],
  ],
];

const LEVEL: Record<Kind, number> = { chouon: 0, hatsuon: 0, youon: 1, sokuon: 1 };

function listenItem([kind, word, wrongs, note, hint3]: L): ListenItem {
  return {
    engine: 'listen',
    id: `listen:${word}`,
    objective: kind,
    level: LEVEL[kind],
    prompt: 'きこえた ことばの ただしい かきかたは どれ？',
    audio: { text: word },
    options: opts(word, wrongs),
    hints: [
      'もういちど きいて、ことばを ゆっくり いって みよう。',
      HINT2[kind],
      hint3 ?? HINT3[kind],
    ],
    explain: `「${word}」と かくよ。${note ?? RULE[kind]}`,
    identity: `listen:${word}`,
  };
}

// ---- 別例1: タイルで語を作る（絵か、なぞなぞで語を示す。問題文に答えの書き方を出さない） ----
type B = [
  kind: Kind,
  word: string,
  clue: { illust: string } | { riddle: string },
  extra: string[],
  wrongs: Wrong[],
];
const BUILD: B[] = [
  ['chouon', 'ひこうき', { illust: 'airplane' }, ['お'], [['ひこおき', 'chouon-vowel']]],
  ['chouon', 'ぞう', { illust: 'elephant' }, ['お'], [['ぞお', 'chouon-vowel']]],
  [
    'chouon',
    'じどうしゃ',
    { illust: 'car-red' },
    ['お', 'や'],
    [
      ['じどおしゃ', 'chouon-vowel'],
      ['じどうしや', 'youon-size'],
    ],
  ],
  ['youon', 'でんしゃ', { illust: 'train' }, ['や'], [['でんしや', 'youon-size']]],
  ['youon', 'じてんしゃ', { illust: 'bicycle' }, ['や'], [['じてんしや', 'youon-size']]],
  ['youon', 'きゅうり', { illust: 'cucumber' }, ['ゆ'], [['きゆうり', 'youon-size']]],
  ['sokuon', 'はっぱ', { illust: 'leaf' }, ['つ'], [['はつぱ', 'sokuon-size']]],
  ['sokuon', 'きって', { riddle: 'てがみに はる もの' }, ['つ'], [['きつて', 'sokuon-size']]],
  [
    'sokuon',
    'きっぷ',
    { riddle: 'でんしゃに のる ときに かう もの' },
    ['つ'],
    [['きつぷ', 'sokuon-size']],
  ],
  ['hatsuon', 'えんぴつ', { illust: 'pencil' }, ['む'], [['えむぴつ', 'n-mu']]],
  ['hatsuon', 'にんじん', { illust: 'carrot' }, ['む'], [['にむじん', 'n-mu']]],
  [
    'hatsuon',
    'しんぶん',
    { riddle: 'まいあさ いえに とどく、ニュースが かいて ある かみ' },
    ['む'],
    [['しむぶん', 'n-mu']],
  ],
];

function buildItem([kind, word, clue, extra, wrongs]: B): BuildItem {
  const chars = [...word];
  return {
    engine: 'build',
    id: `build:${word}`,
    objective: kind,
    level: 2,
    prompt:
      'illust' in clue
        ? 'えに あう ことばを つくろう。ちいさい じや のばす おとに きを つけてね。'
        : `「${clue.riddle}」は なに？ じを ならべて つくろう。`,
    figure: 'illust' in clue ? { kind: 'illust', id: clue.illust } : undefined,
    tiles: [...chars, ...extra],
    answer: { kind: 'text', values: [word] },
    wrongAnswers: wrongs.map(([value, misconception]) => ({
      value,
      misconception: misconception!,
    })),
    hints: [
      'ことばを ゆっくり こえに だして、てを たたいて みよう。',
      HINT2[kind],
      `はじめの じは「${chars[0]}」だよ。`,
    ],
    explain: `「${word}」。${RULE[kind]}`,
    identity: `build:${word}`,
    alt: true,
  };
}

// ---- 別例2: 文の中で、正しく書いている文を選ぶ ----
type St = [kind: Kind, id: string, right: string, wrongs: Wrong[], word: string];
const SENT: St[] = [
  [
    'chouon',
    'otousan',
    'おとうさんと こうえんに いく。',
    [
      ['おとおさんと こうえんに いく。', 'chouon-vowel'],
      ['おとさんと こうえんに いく。', 'chouon-drop'],
    ],
    'おとうさん',
  ],
  [
    'chouon',
    'oneesan',
    'おねえさんが ほんを よむ。',
    [
      ['おねいさんが ほんを よむ。', 'chouon-vowel'],
      ['おねさんが ほんを よむ。', 'chouon-drop'],
    ],
    'おねえさん',
  ],
  [
    'chouon',
    'fuusen',
    'ふうせんが そらに とんだ。',
    [
      ['ふーせんが そらに とんだ。', 'chouon-bar'],
      ['ふせんが そらに とんだ。', 'chouon-drop'],
    ],
    'ふうせん',
  ],
  [
    'youon',
    'densha',
    'でんしゃに のって でかけた。',
    [
      ['でんしやに のって でかけた。', 'youon-size'],
      ['でんしに のって でかけた。', 'youon-drop'],
    ],
    'でんしゃ',
  ],
  [
    'youon',
    'kingyo',
    'きんぎょに えさを やる。',
    [
      ['きんぎよに えさを やる。', 'youon-size'],
      ['きんぎに えさを やる。', 'youon-drop'],
    ],
    'きんぎょ',
  ],
  [
    'youon',
    'shashin',
    'しゃしんを とって もらった。',
    [
      ['しやしんを とって もらった。', 'youon-size'],
      ['ししんを とって もらった。', 'youon-drop'],
    ],
    'しゃしん',
  ],
  [
    'sokuon',
    'gakkou',
    'がっこうで ともだちと あそぶ。',
    [
      ['がこうで ともだちと あそぶ。', 'sokuon-drop'],
      ['がつこうで ともだちと あそぶ。', 'sokuon-size'],
    ],
    'がっこう',
  ],
  [
    'sokuon',
    'nikki',
    'よるに にっきを かいた。',
    [
      ['よるに にきを かいた。', 'sokuon-drop'],
      ['よるに につきを かいた。', 'sokuon-size'],
    ],
    'にっき',
  ],
  [
    'sokuon',
    'batta',
    'くさの うえで ばったが はねた。',
    [
      ['くさの うえで ばたが はねた。', 'sokuon-drop'],
      ['くさの うえで ばつたが はねた。', 'sokuon-size'],
    ],
    'ばった',
  ],
  [
    'hatsuon',
    'tonbo',
    'いけの うえを とんぼが とぶ。',
    [
      ['いけの うえを とぼが とぶ。', 'n-drop'],
      ['いけの うえを とむぼが とぶ。', 'n-mu'],
    ],
    'とんぼ',
  ],
  [
    'hatsuon',
    'sanpo',
    'いぬと さんぽに いこう。',
    [
      ['いぬと さぽに いこう。', 'n-drop'],
      ['いぬと さむぽに いこう。', 'n-mu'],
    ],
    'さんぽ',
  ],
  [
    'hatsuon',
    'konbu',
    'こんぶの おにぎりを たべた。',
    [
      ['こぶの おにぎりを たべた。', 'n-drop'],
      ['こむぶの おにぎりを たべた。', 'n-mu'],
    ],
    'こんぶ',
  ],
];

function sentenceItem([kind, id, right, wrongs, word]: St): ChoiceItem {
  return {
    engine: 'choice',
    id: `sentence:${id}`,
    objective: kind,
    level: 2,
    prompt: 'ただしく かいて ある ぶんは どれ？',
    options: opts(right, wrongs),
    layout: 'column',
    hints: [
      'ぶんを ひとつずつ こえに だして よもう。ちがう ところは ひとつだけ。',
      HINT2[kind],
      HINT3[kind],
    ],
    explain: `「${word}」が ただしい かきかただよ。${RULE[kind]}`,
    identity: `sentence:${id}`,
    alt: true,
  };
}

const items: Item[] = [
  ...LISTEN.map(listenItem),
  ...BUILD.map(buildItem),
  ...SENT.map(sentenceItem),
];

export const specialKana: UnitSpec = {
  id: 'g1.ja.special-kana',
  title: 'のばす おと・ちいさい じ・「ん」',
  stage: 'g1',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-hiragana',
  prereq: ['g1.ja.hiragana-read'],
  objectives: [
    { id: 'chouon', title: 'のばす おと（おかあさん・とけい）' },
    { id: 'youon', title: 'ちいさい「ゃ」「ゅ」「ょ」' },
    { id: 'sokuon', title: 'ちいさい「っ」' },
    { id: 'hatsuon', title: 'はねる おと「ん」' },
  ],
  misconceptions: [
    {
      id: 'chouon-drop',
      explain:
        'のばす おとを かかなかったのかな。「おとうさん」の「う」の ように、のばす おとも じで かくよ。',
    },
    {
      id: 'chouon-vowel',
      explain:
        'きこえた とおりに かいたのかな。「お」の なかまを のばす ときは「う」、「え」の なかまは「い」と かく ことが おおいよ。',
    },
    {
      id: 'chouon-bar',
      explain:
        '「ー」を つかったのかな。「ー」は カタカナの ことばで つかうよ。ひらがなでは「あ・い・う・え・お」で のばすよ。',
    },
    {
      id: 'youon-size',
      explain:
        '「や・ゆ・よ」を おおきく かいたのかな。おおきく かくと「き・や」の ように ふたつの おとに なって しまうよ。',
    },
    {
      id: 'youon-drop',
      explain:
        'ちいさい「ゃ・ゅ・ょ」を わすれたのかな。「きしゃ」の「しゃ」は「し」と ちいさい「ゃ」で かくよ。',
    },
    {
      id: 'sokuon-drop',
      explain: 'つまる おとを わすれたのかな。いきが とまる ところには ちいさい「っ」を かくよ。',
    },
    {
      id: 'sokuon-size',
      explain: '「つ」を おおきく かいたのかな。つまる おとは ちいさい「っ」で かくよ。',
    },
    {
      id: 'n-drop',
      explain: '「ん」を わすれたのかな。ゆっくり いうと「ん」の おとが きこえるよ。',
    },
    {
      id: 'n-mu',
      explain:
        '「む」の ように きこえたのかな。「ぴ」「ぶ」「ぽ」の まえの「ん」は「む」に にて きこえるけど、「ん」と かくよ。',
    },
  ],
  levels: [
    { label: 'のばす おと・「ん」', chance: 0.15 },
    { label: 'ちいさい「ゃゅょ」「っ」', chance: 0.15 },
    { label: 'つくる・ぶんの なか', chance: 0.1 },
  ],
  intro: [
    {
      text: 'のばす おとも じで かくよ。「おかあさん」の「あ」、「おとうさん」の「う」。',
      figure: { kind: 'text', text: 'おかあさん　おとうさん', size: 'l' },
    },
    {
      text: '「き」と ちいさい「ゃ」で「きゃ」。ちいさい じは ますの みぎうえに かくよ。',
      figure: { kind: 'text', text: 'きしゃ　きって', size: 'xl' },
    },
    {
      text: 'いきが とまる ところは ちいさい「っ」。はねる おとは「ん」。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'illust', id: 'leaf' },
          { kind: 'text', text: 'はっぱ', size: 'xl' },
        ],
      },
    },
  ],
  source: { kind: 'items', items },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年 〔知識及び技能〕(1)ウ（長音、拗音、促音、撥音などの表記、助詞の「は」「へ」「を」の使い方）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
