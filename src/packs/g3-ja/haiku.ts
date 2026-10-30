/**
 * g3.ja.haiku 俳句を楽しもう（curriculum-matrix 456 行。設計書 docs/expansion/p2-design/g3-ja.md 1章）。
 * 音の数 → 五・七・五に区切る → きせつの言葉 → お手本を聞く。
 * 句は、著作権の切れた古典の句（表記を小3向けに直した。作者名は出さない）と、本アプリの自作の句。
 * 音声は台本から作る（key なし）。音声の文は lines.join('、') + '。'、図の文は lines.join('')。
 * 同一性キー: haiku:<到達項目>:<種類>:<句の id か語>。
 */
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import type { BuildItem } from '../../engines/build/build';
import type { ListenItem } from '../../engines/listen/listen';
import { opts, REVISED, type Wrong } from './util';

type Season = '春' | '夏' | '秋' | '冬';
interface Haiku {
  id: string;
  /** classic = 著作権の切れた古典の句（作者名は出さない）、original = 本アプリの自作 */
  src: 'classic' | 'original';
  lines: [string, string, string];
  season: Season;
  /** きせつの言葉（表示の形） */
  kigo: string;
}

const HAIKU: Record<string, Haiku> = {
  // ---- 古典（表記を小3向けに直した形） ----
  furuike: {
    id: 'furuike',
    src: 'classic',
    lines: ['古《ふる》池《いけ》や', 'かわずとびこむ', '水《みず》の音《おと》'],
    season: '春',
    kigo: 'かわず',
  },
  shizukasa: {
    id: 'shizukasa',
    src: 'classic',
    lines: ['しずかさや', '岩《いわ》にしみ入《い》る', 'せみの声《こえ》'],
    season: '夏',
    kigo: 'せみ',
  },
  harunoumi: {
    id: 'harunoumi',
    src: 'classic',
    lines: ['春《はる》の海《うみ》', 'ひねもすのたり', 'のたりかな'],
    season: '春',
    kigo: '春《はる》の海《うみ》',
  },
  yukitokete: {
    id: 'yukitokete',
    src: 'classic',
    lines: ['雪《ゆき》とけて', '村《むら》いっぱいの', '子《こ》どもかな'],
    season: '春',
    kigo: '雪《ゆき》とけて',
  },
  yareutsuna: {
    id: 'yareutsuna',
    src: 'classic',
    lines: ['やれ打《う》つな', 'はえが手《て》をすり', '足《あし》をする'],
    season: '夏',
    kigo: 'はえ',
  },
  meigetsu: {
    id: 'meigetsu',
    src: 'classic',
    lines: ['名月《めいげつ》を', '取《と》ってくれろと', 'なく子《こ》かな'],
    season: '秋',
    kigo: '名月《めいげつ》',
  },
  ikutabi: {
    id: 'ikutabi',
    src: 'classic',
    lines: ['いくたびも', '雪《ゆき》の深《ふか》さを', 'たずねけり'],
    season: '冬',
    kigo: '雪《ゆき》',
  },
  yamaji: {
    id: 'yamaji',
    src: 'classic',
    lines: ['山路《やまじ》来《き》て', 'なにやらゆかし', 'すみれ草《ぐさ》'],
    season: '春',
    kigo: 'すみれ',
  },
  konomichi: {
    id: 'konomichi',
    src: 'classic',
    lines: ['この道《みち》や', '行《ゆ》く人《ひと》なしに', '秋《あき》のくれ'],
    season: '秋',
    kigo: '秋《あき》のくれ',
  },
  suzukaze: {
    id: 'suzukaze',
    src: 'classic',
    lines: ['すず風《かぜ》の', '曲《ま》がりくねって', '来《き》たりけり'],
    season: '夏',
    kigo: 'すず風《かぜ》',
  },
  // 季節の言葉の問題には使わない（区切りだけ）
  utsukushiya: {
    id: 'utsukushiya',
    src: 'classic',
    lines: ['うつくしや', 'しょうじのあなの', '天《あま》の川《がわ》'],
    season: '秋',
    kigo: '天《あま》の川《がわ》',
  },
  // ---- オリジナル（本アプリの自作） ----
  tsukushi: {
    id: 'tsukushi',
    src: 'original',
    lines: ['つくしんぼ', '土《つち》からぽこり', 'かおを出《だ》す'],
    season: '春',
    kigo: 'つくしんぼ',
  },
  kakigoori: {
    id: 'kakigoori',
    src: 'original',
    lines: ['かき氷《ごおり》', '赤《あか》いしずくが', 'うでにつく'],
    season: '夏',
    kigo: 'かき氷《ごおり》',
  },
  akatonbo: {
    id: 'akatonbo',
    src: 'original',
    lines: ['赤《あか》とんぼ', 'ぼうしの上《うえ》で', 'ひと休《やす》み'],
    season: '秋',
    kigo: '赤《あか》とんぼ',
  },
  senpuuki: {
    id: 'senpuuki',
    src: 'original',
    lines: ['せんぷうき', '前《まえ》で話《はな》すと', '声《こえ》ふるえ'],
    season: '夏',
    kigo: 'せんぷうき',
  },
  donguri: {
    id: 'donguri',
    src: 'original',
    lines: ['どんぐりを', 'ポケットに入《い》れ', '走《はし》り出《だ》す'],
    season: '秋',
    kigo: 'どんぐり',
  },
  kogarashi: {
    id: 'kogarashi',
    src: 'original',
    lines: ['こがらしに', 'せなかをおされ', '帰《かえ》り道《みち》'],
    season: '冬',
    kigo: 'こがらし',
  },
  otsukimi: {
    id: 'otsukimi',
    src: 'original',
    lines: ['お月見《つきみ》の', 'だんごを数《かぞ》え', '待《ま》つ夜《よ》かな'],
    season: '秋',
    kigo: 'お月見《つきみ》',
  },
  shimobashira: {
    id: 'shimobashira',
    src: 'original',
    lines: ['しもばしら', 'ざくざくふんで', '学校《がっこう》へ'],
    season: '冬',
    kigo: 'しもばしら',
  },
};

const H = (id: string): Haiku => {
  const h = HAIKU[id];
  if (!h) throw new Error(`句がない: ${id}`);
  return h;
};
const sayOf = (h: Haiku) => h.lines.join('、') + '。';
const textOf = (h: Haiku) => h.lines.join('');

// ---- 1.6.1 oto 音の数 ----
const Y = '小《ちい》さい「ゃ・ゅ・ょ」は、前《まえ》の字《じ》といっしょに1回《かい》たたくよ。';
const S = '小《ちい》さい「っ」や「ん」、のばす音《おん》も、それぞれ1回《かい》たたくよ。';
const K = '漢字《かんじ》は、読《よ》みがなで数《かぞ》えよう。';

interface Oto {
  id: string;
  word: string;
  n: number;
  wrong: [number, string][];
  h2: string;
  h3: string;
  e: string;
}
const OTO: Oto[] = [
  {
    id: 'chouchou',
    word: 'ちょうちょう',
    n: 4,
    wrong: [
      [6, 'h-youon'],
      [2, 'h-skip'],
    ],
    h2: Y,
    h3: '「ちょ」「う」……と区《く》切《ぎ》って、のこりも数《かぞ》えよう。',
    e: '「ちょ・う・ちょ・う」で4音《おん》。小《ちい》さい「ょ」は前《まえ》の字《じ》といっしょに1音《おん》、のばす「う」も1音《おん》だよ。',
  },
  {
    id: 'kyuushoku',
    word: 'きゅうしょく',
    n: 4,
    wrong: [
      [6, 'h-youon'],
      [3, 'h-skip'],
    ],
    h2: Y,
    h3: '「きゅ」「う」……と区《く》切《ぎ》って、のこりも数《かぞ》えよう。',
    e: '「きゅ・う・しょ・く」で4音《おん》。',
  },
  {
    id: 'gakkou',
    word: 'がっこう',
    n: 4,
    wrong: [
      [3, 'h-skip'],
      [2, 'h-skip'],
    ],
    h2: S,
    h3: '「が」「っ」……と区《く》切《ぎ》って、のこりも数《かぞ》えよう。',
    e: '「が・っ・こ・う」で4音《おん》。小《ちい》さい「っ」も1音《おん》だよ。',
  },
  {
    id: 'chokoreeto',
    word: 'チョコレート',
    n: 5,
    wrong: [
      [6, 'h-youon'],
      [4, 'h-skip'],
    ],
    h2: '小《ちい》さい「ョ」は前《まえ》の字《じ》といっしょ。のばす「ー」は1音《おん》だよ。',
    h3: '「チョ」「コ」……と区《く》切《ぎ》って、のこりも数《かぞ》えよう。',
    e: '「チョ・コ・レ・ー・ト」で5音《おん》。',
  },
  {
    id: 'meigetsuwo',
    word: '名月《めいげつ》を',
    n: 5,
    wrong: [
      [3, 'h-moji'],
      [4, 'h-skip'],
    ],
    h2: K,
    h3: '「め」「い」……と区《く》切《ぎ》って、のこりも数《かぞ》えよう。',
    e: '「め・い・げ・つ・を」で5音《おん》。「名月《めいげつ》」は2字《じ》だけど4音《おん》だよ。',
  },
  {
    id: 'gakkouhe',
    word: '学校《がっこう》へ',
    n: 5,
    wrong: [
      [3, 'h-moji'],
      [4, 'h-skip'],
    ],
    h2: K,
    h3: '「が」「っ」……と区《く》切《ぎ》って、のこりも数《かぞ》えよう。',
    e: '「が・っ・こ・う・へ」で5音《おん》。「学校《がっこう》」は2字《じ》だけど4音《おん》だよ。',
  },
  {
    id: 'shouji',
    word: 'しょうじのあなの',
    n: 7,
    wrong: [
      [8, 'h-youon'],
      [6, 'h-skip'],
    ],
    h2: Y,
    h3: '「しょ」「う」……と区《く》切《ぎ》って、のこりも数《かぞ》えよう。',
    e: '「しょ・う・じ・の・あ・な・の」で7音《おん》。',
  },
  {
    id: 'senpuuki',
    word: 'せんぷうき',
    n: 5,
    wrong: [
      [3, 'h-skip'],
      [4, 'h-skip'],
    ],
    h2: S,
    h3: '「せ」「ん」……と区《く》切《ぎ》って、のこりも数《かぞ》えよう。',
    e: '「せ・ん・ぷ・う・き」で5音《おん》。「ん」も、のばす「う」も1音《おん》だよ。',
  },
];

const otoItems: Item[] = OTO.map((w): ListenItem => ({
  engine: 'listen',
  id: `oto:${w.id}`,
  objective: 'oto',
  level: 0,
  prompt: '手《て》をたたきながら聞《き》こう。いくつの音《おん》かな。',
  audio: { text: w.word },
  figure: { kind: 'text', text: w.word, size: 'l' },
  options: opts(
    `${w.n}音《おん》`,
    w.wrong.map(([x, m]) => [`${x}音《おん》`, m] as Wrong),
  ),
  hints: ['手《て》をたたきながら、ゆっくり言《い》ってみよう。', w.h2, w.h3],
  explain: w.e,
  identity: `haiku:oto:${w.id}`,
}));

interface OtoAlt {
  id: string;
  prompt: string;
  ok: string;
  wrong: Wrong[];
  h2: string;
  h3: string;
  e: string;
}
const OTO_ALT: OtoAlt[] = [
  {
    id: 'go-kana',
    prompt: '5音《おん》の言葉《ことば》はどれ。',
    ok: 'ランドセル',
    wrong: [
      ['しゅくだい', 'h-youon'],
      ['はっぴょうかい', 'h-skip'],
    ],
    h2: '小《ちい》さい「ゅ」「ょ」は前《まえ》の字《じ》といっしょに1音《おん》だよ。',
    h3: '小《ちい》さい「っ」も1音《おん》。どれも、字《じ》の数《かず》と音《おん》の数《かず》がちがうことがあるよ。',
    e: '「ラ・ン・ド・セ・ル」で5音《おん》。「しゅ・く・だ・い」は4音《おん》、「は・っ・ぴょ・う・か・い」は6音《おん》だよ。',
  },
  {
    id: 'shichi-kana',
    prompt: '7音《おん》の言葉《ことば》はどれ。',
    ok: 'てんとうむしが',
    wrong: [
      ['じゃんけんぽん', 'h-youon'],
      ['ゆっくりあるこう', 'h-skip'],
    ],
    h2: '小《ちい》さい「ゃ」は前《まえ》の字《じ》といっしょに1音《おん》だよ。',
    h3: '小《ちい》さい「っ」も1音《おん》として数《かぞ》えよう。',
    e: '「て・ん・と・う・む・し・が」で7音《おん》。「じゃ・ん・け・ん・ぽ・ん」は6音《おん》、「ゆ・っ・く・り・あ・る・こ・う」は8音《おん》だよ。',
  },
  {
    id: 'go-kanji',
    prompt: '5音《おん》の言葉《ことば》はどれ。',
    ok: '夏草《なつくさ》や',
    wrong: [
      ['赤《あか》いぼうし', 'h-moji'],
      ['りょこうに', 'h-youon'],
    ],
    h2: K,
    h3: '「りょ」は1音《おん》。「赤《あか》」は2音《おん》だよ。',
    e: '「な・つ・く・さ・や」で5音《おん》。「あ・か・い・ぼ・う・し」は6音《おん》、「りょ・こ・う・に」は4音《おん》だよ。',
  },
];
const otoAltItems: Item[] = OTO_ALT.map((a): ChoiceItem => ({
  engine: 'choice',
  id: `oto-alt:${a.id}`,
  objective: 'oto',
  level: 0,
  alt: true,
  prompt: a.prompt,
  options: opts(a.ok, a.wrong),
  layout: 'column',
  hints: ['一《ひと》つずつ、手《て》をたたきながら言《い》ってみよう。', a.h2, a.h3],
  explain: a.e,
  identity: `haiku:oto-alt:${a.id}`,
}));

// ---- 1.6.2 kugiri 五・七・五に区切る ----
const KUGIRI_H2 =
  '5つ目《め》の音《おん》のところで、一《ひと》つ目《め》のカードが終《お》わるよ。';
interface Kugiri {
  id: string;
  decoys: [string, string];
  split: string;
  mis: string;
  h2?: string;
  note: string;
}
const KUGIRI: Kugiri[] = [
  {
    id: 'furuike',
    decoys: ['古《ふる》池《いけ》', 'やかわずとびこむ'],
    split: '古《ふる》池《いけ》 やかわずとびこむ 水《みず》の音《おと》',
    mis: 'h-split',
    note: '「かわず」は、かえるのむかしの言《い》い方《かた》だよ。',
  },
  {
    id: 'harunoumi',
    decoys: ['ひねもす', 'のたりのたりかな'],
    split: '春《はる》の海《うみ》 ひねもす のたりのたりかな',
    mis: 'h-split',
    note: '「ひねもす」は「一日《いちにち》じゅう」という意味《いみ》だよ。',
  },
  {
    id: 'meigetsu',
    decoys: ['名月《めいげつ》を取《と》って', 'くれろと'],
    split: '名月《めいげつ》を取《と》って くれろと なく子《こ》かな',
    mis: 'h-split',
    h2: '小《ちい》さい「っ」も1音《おん》。5つ目《め》の音《おん》のところで区《く》切《ぎ》ろう。',
    note: '「取《と》ってくれろ」は「取《と》ってちょうだい」という意味《いみ》だよ。',
  },
  {
    id: 'konomichi',
    decoys: ['行《ゆ》く人《ひと》', 'なしに秋《あき》のくれ'],
    split: 'この道《みち》や 行《ゆ》く人《ひと》 なしに秋《あき》のくれ',
    mis: 'h-split',
    h2: 'まん中《なか》は7音《おん》。「行《ゆ》く人《ひと》」のあとも、つづけて数《かぞ》えよう。',
    note: '「秋《あき》のくれ」は、秋《あき》の夕《ゆう》ぐれのことだよ。',
  },
  {
    id: 'suzukaze',
    decoys: ['すず風《かぜ》', 'の曲《ま》がりくねって'],
    split: 'すず風《かぜ》 の曲《ま》がりくねって 来《き》たりけり',
    mis: 'h-split',
    h2: '漢字《かんじ》は読《よ》みがなで数《かぞ》えよう。「風《かぜ》」は2音《おん》だよ。',
    note: '「すず風《かぜ》」は、夏《なつ》にふくすずしい風《かぜ》のことだよ。',
  },
  {
    id: 'utsukushiya',
    decoys: ['しょうじのあな', 'の天《あま》の川《がわ》'],
    split: 'うつくしや しょうじのあな の天《あま》の川《がわ》',
    mis: 'h-youon',
    h2: '小《ちい》さい「ょ」は、前《まえ》の字《じ》といっしょに1音《おん》だよ。',
    note: '「しょうじ」は、木《き》のわくに紙《かみ》をはった戸《と》のこと。あなから天《あま》の川《がわ》が見《み》えたんだね。',
  },
  {
    id: 'donguri',
    decoys: ['ポケットに', '入《い》れ走《はし》り出《だ》す'],
    split: 'どんぐりを ポケットに 入《い》れ走《はし》り出《だ》す',
    mis: 'h-split',
    h2: 'まん中《なか》は7音《おん》。小《ちい》さい「っ」も1音《おん》だよ。',
    note: 'どんぐりを拾《ひろ》って、うれしくて走《はし》り出《だ》す様子《ようす》だよ。',
  },
  {
    id: 'shimobashira',
    decoys: ['しもばしらざく', 'ざくふんで'],
    split: 'しもばしらざく ざくふんで 学校《がっこう》へ',
    mis: 'h-split',
    note: '「しもばしら」は、冬《ふゆ》の朝《あさ》、土《つち》の中《なか》の水《みず》がこおってできる氷《こおり》の柱《はしら》のこと。',
  },
];
const kugiriItems: Item[] = KUGIRI.map((k): BuildItem => {
  const h = H(k.id);
  return {
    engine: 'build',
    id: `kugiri:${h.id}`,
    objective: 'kugiri',
    level: 1,
    prompt: `「${textOf(h)}」を五《ご》・七《しち》・五《ご》に区《く》切《ぎ》って、カードをならべよう。`,
    tiles: [...h.lines, ...k.decoys],
    joiner: ' ',
    answer: { kind: 'text', values: [h.lines.join(' ')] },
    wrongAnswers: [
      { value: k.split, misconception: k.mis },
      { value: [h.lines[1], h.lines[0], h.lines[2]].join(' '), misconception: 'h-order' },
    ],
    hints: [
      'はじめから、手《て》をたたいて音《おん》を数《かぞ》えよう。',
      k.h2 ?? KUGIRI_H2,
      `はじめの五《ご》音《おん》は「${h.lines[0]}」。のこりを七《しち》音《おん》と五《ご》音《おん》に分《わ》けよう。`,
    ],
    explain: `「${h.lines[0]}」（5音《おん》）、「${h.lines[1]}」（7音《おん》）、「${h.lines[2]}」（5音《おん》）に区《く》切《ぎ》るよ。${k.note}`,
    identity: `haiku:kugiri:${h.id}`,
  };
});

interface KugiriAlt {
  id: string;
  part: string;
  ok: string;
  wrong: Wrong[];
  h2: string;
  h3: string;
  e: string;
}
const KUGIRI_ALT: KugiriAlt[] = [
  {
    id: 'shizukasa',
    part: 'さいごの五《ご》音《おん》',
    ok: 'せみの声《こえ》',
    wrong: [
      ['しみ入《い》るせみの声《こえ》', 'h-split'],
      ['岩《いわ》にしみ入《い》る', 'h-order'],
    ],
    h2: 'さいごに区《く》切《ぎ》って読《よ》んだところを思《おも》い出《だ》そう。',
    h3: '「しみ入《い》る」はまん中《なか》の七《しち》音《おん》に入《はい》るよ。',
    e: '「しずかさや／岩《いわ》にしみ入《い》る／せみの声《こえ》」。さいごの五《ご》音《おん》は「せみの声《こえ》」だよ。',
  },
  {
    id: 'tsukushi',
    part: 'まん中《なか》の七《しち》音《おん》',
    ok: '土《つち》からぽこり',
    wrong: [
      ['からぽこり', 'h-split'],
      ['つくしんぼ', 'h-order'],
    ],
    h2: '二《ふた》つ目《め》に区《く》切《ぎ》って読《よ》んだところを思《おも》い出《だ》そう。',
    h3: '「から」の前《まえ》にも1字《じ》あるよ。7音《おん》を数《かぞ》えよう。',
    e: '「つくしんぼ／土《つち》からぽこり／かおを出《だ》す」。まん中《なか》の七《しち》音《おん》は「土《つち》からぽこり」だよ。',
  },
  {
    id: 'yareutsuna',
    part: 'はじめの五《ご》音《おん》',
    ok: 'やれ打《う》つな',
    wrong: [
      ['やれ打《う》つなはえが', 'h-split'],
      ['足《あし》をする', 'h-order'],
    ],
    h2: 'さいしょに区《く》切《ぎ》って読《よ》んだところを思《おも》い出《だ》そう。',
    h3: '「はえが」は、まん中《なか》の七《しち》音《おん》のはじめだよ。',
    e: '「やれ打《う》つな／はえが手《て》をすり／足《あし》をする」。はじめの五《ご》音《おん》は「やれ打《う》つな」だよ。',
  },
];
const kugiriAltItems: Item[] = KUGIRI_ALT.map((a): ListenItem => {
  const h = H(a.id);
  return {
    engine: 'listen',
    id: `kugiri-alt:${h.id}`,
    objective: 'kugiri',
    level: 1,
    alt: true,
    prompt: `お手本《てほん》の音読《おんどく》を聞《き》こう。${a.part}はどれ。`,
    audio: { text: sayOf(h) },
    options: opts(a.ok, a.wrong),
    layout: 'column',
    hints: [
      'もう一度《いちど》聞《き》いて、お手本《てほん》が区《く》切《ぎ》って読《よ》むところに気《き》をつけよう。',
      a.h2,
      a.h3,
    ],
    explain: a.e,
    identity: `haiku:kugiri-alt:${h.id}`,
  };
});

// ---- 1.6.3 kigo きせつの言葉 ----
const SEASONS: Season[] = ['春', '夏', '秋', '冬'];
const SEASON_LABEL: Record<Season, string> = {
  春: '春《はる》',
  夏: '夏《なつ》',
  秋: '秋《あき》',
  冬: '冬《ふゆ》',
};
const FIND_H1 =
  'その言葉《ことば》を聞《き》くと、きせつが一《ひと》つに決《き》まる言葉《ことば》をさがそう。';

interface KigoFind {
  id: string;
  ok: string;
  wrong: [string, string][];
  h2: string;
  h3: string;
  e: string;
}
const KIGO_FIND: KigoFind[] = [
  {
    id: 'furuike',
    ok: 'かわず',
    wrong: [
      ['古《ふる》池《いけ》', 'h-kigo-thing'],
      ['水《みず》の音《おと》', 'h-kigo-thing'],
    ],
    h2: '池《いけ》は、いつのきせつにもあるね。',
    h3: '「水《みず》の音《おと》」も、どのきせつでも聞《き》こえるね。',
    e: 'きせつの言葉《ことば》は「かわず」。かえるのむかしの言《い》い方《かた》で、春《はる》の言葉《ことば》だよ。',
  },
  {
    id: 'shizukasa',
    ok: 'せみ',
    wrong: [
      ['岩《いわ》', 'h-kigo-thing'],
      ['しずかさ', 'h-kigo-thing'],
    ],
    h2: '「しずかさ」は様子《ようす》の言葉《ことば》。いつのきせつにもあるね。',
    h3: '岩《いわ》は、一年《いちねん》じゅうあるね。',
    e: 'きせつの言葉《ことば》は「せみ」。夏《なつ》の言葉《ことば》だよ。',
  },
  {
    id: 'kogarashi',
    ok: 'こがらし',
    wrong: [
      ['せなか', 'h-kigo-thing'],
      ['帰《かえ》り道《みち》', 'h-kigo-thing'],
    ],
    h2: '体《からだ》の言葉《ことば》や、道《みち》の言葉《ことば》は、いつのきせつにもあるね。',
    h3: 'せなかをおしたものは何《なん》だったかな。',
    e: 'きせつの言葉《ことば》は「こがらし」。冬《ふゆ》のはじめにふく、つめたく強《つよ》い風《かぜ》で、冬《ふゆ》の言葉《ことば》だよ。',
  },
  {
    id: 'senpuuki',
    ok: 'せんぷうき',
    wrong: [
      ['声《こえ》', 'h-kigo-thing'],
      ['前《まえ》', 'h-kigo-thing'],
    ],
    h2: '声《こえ》は、一年《いちねん》じゅう出《で》るね。',
    h3: '「前《まえ》」は場所《ばしょ》の言葉《ことば》だね。',
    e: 'きせつの言葉《ことば》は「せんぷうき」。あつい夏《なつ》に使《つか》うので、夏《なつ》の言葉《ことば》だよ。',
  },
  {
    id: 'otsukimi',
    ok: 'お月見《つきみ》',
    wrong: [
      ['だんご', 'h-kigo-thing'],
      ['夜《よ》', 'h-kigo-thing'],
    ],
    h2: '夜《よ》は、毎日《まいにち》あるね。',
    h3: 'だんごは、いつでも食《た》べられるね。',
    e: 'きせつの言葉《ことば》は「お月見《つきみ》」。秋《あき》の夜《よる》に月《つき》をながめる行事《ぎょうじ》で、秋《あき》の言葉《ことば》だよ。',
  },
];
const kigoFindItems: Item[] = KIGO_FIND.map((q): ListenItem => {
  const h = H(q.id);
  return {
    engine: 'listen',
    id: `kigo:find:${h.id}`,
    objective: 'kigo',
    level: 2,
    prompt: '俳句《はいく》を聞《き》こう。きせつの言葉《ことば》はどれ。',
    audio: { text: sayOf(h) },
    figure: { kind: 'text', text: textOf(h), size: 'm' },
    options: opts(q.ok, q.wrong),
    layout: 'column',
    hints: [FIND_H1, q.h2, q.h3],
    explain: q.e,
    identity: `haiku:kigo:find:${h.id}`,
  };
});

/** 春夏秋冬の4択（この順。fixedOrder）。ans が正解、mis は ans 以外の誤概念 */
function seasonOptions(ans: Season, mis: Record<string, string>) {
  return SEASONS.map((s) =>
    s === ans
      ? { label: SEASON_LABEL[s], correct: true }
      : { label: SEASON_LABEL[s], misconception: mis[s]! },
  );
}
interface KigoSeason {
  id: string;
  mis: Record<string, string>;
  h1: string;
  h2: string;
  h3: string;
  e: string;
}
const KIGO_SEASON: KigoSeason[] = [
  {
    id: 'akatonbo',
    mis: { 春: 'h-season-mix', 夏: 'h-season-mix', 冬: 'h-season-mix' },
    h1: '「赤《あか》とんぼ」がたくさんとぶのは、いつごろかな。',
    h2: '赤《あか》とんぼは、すずしくなるころ、町《まち》や田《た》んぼに多《おお》く出《で》てくるよ。',
    h3: '春《はる》と冬《ふゆ》ではないね。',
    e: 'きせつの言葉《ことば》は「赤《あか》とんぼ」。秋《あき》の言葉《ことば》だよ。',
  },
  {
    id: 'yukitokete',
    mis: { 冬: 'h-season-part', 夏: 'h-season-mix', 秋: 'h-season-mix' },
    h1: '「雪《ゆき》とけて」は、雪《ゆき》がどうなったと言《い》っているかな。',
    h2: '雪《ゆき》がとけるのは、さむい冬《ふゆ》が終《お》わるころだね。',
    h3: '夏《なつ》と秋《あき》ではないね。冬《ふゆ》の「つぎ」を考《かんが》えよう。',
    e: 'きせつの言葉《ことば》は「雪《ゆき》とけて」。雪《ゆき》がとけて、子《こ》どもたちが外《そと》に出《で》てきた様子《ようす》。春《はる》の言葉《ことば》だよ。',
  },
  {
    id: 'kakigoori',
    mis: { 冬: 'h-season-feel', 春: 'h-season-mix', 秋: 'h-season-mix' },
    h1: 'かき氷《ごおり》は、どんな日《ひ》に食《た》べたくなるかな。',
    h2: 'つめたい食《た》べ物《もの》は、あつい日《ひ》に食《た》べることが多《おお》いね。',
    h3: '春《はる》と秋《あき》ではないね。',
    e: 'きせつの言葉《ことば》は「かき氷《ごおり》」。あつい夏《なつ》に食《た》べるので、夏《なつ》の言葉《ことば》だよ。',
  },
];
const kigoSeasonItems: Item[] = KIGO_SEASON.map((q): ListenItem => {
  const h = H(q.id);
  return {
    engine: 'listen',
    id: `kigo:season:${h.id}`,
    objective: 'kigo',
    level: 2,
    prompt: '俳句《はいく》を聞《き》こう。この俳句《はいく》のきせつはいつ。',
    audio: { text: sayOf(h) },
    figure: { kind: 'text', text: textOf(h), size: 'm' },
    options: seasonOptions(h.season, q.mis),
    fixedOrder: true,
    layout: 'row',
    hints: [q.h1, q.h2, q.h3],
    explain: q.e,
    identity: `haiku:kigo:season:${h.id}`,
  };
});

interface KigoAltBuild {
  id: string;
  prompt: string;
  tiles: string[];
  parts: string[];
  wrong: [string, string][];
  hints: string[];
  e: string;
}
const KIGO_ALT_BUILD: KigoAltBuild[] = [
  {
    id: 'fuyu',
    prompt: '冬《ふゆ》のきせつの言葉《ことば》を二《ふた》つえらんでならべよう。',
    tiles: ['こがらし', 'しもばしら', 'せんぷうき', 'どんぐり', 'つくしんぼ', 'かき氷《ごおり》'],
    parts: ['こがらし', 'しもばしら'],
    wrong: [
      ['しもばしら+かき氷《ごおり》', 'h-season-feel'],
      ['こがらし+どんぐり', 'h-season-mix'],
      ['せんぷうき+しもばしら', 'h-season-feel'],
    ],
    hints: [
      '一《ひと》つずつ、いつのきせつに見《み》られるか考《かんが》えよう。',
      'つめたい感《かん》じがしても、夏《なつ》の物《もの》があるよ。',
      '一《ひと》つは「風《かぜ》」、もう一《ひと》つは「土《つち》の中《なか》の氷《こおり》」だよ。',
    ],
    e: '冬《ふゆ》の言葉《ことば》は「こがらし」と「しもばしら」。せんぷうき・かき氷《ごおり》は夏《なつ》、どんぐりは秋《あき》、つくしんぼは春《はる》の言葉《ことば》だよ。',
  },
  {
    id: 'haru',
    prompt: '春《はる》のきせつの言葉《ことば》を二《ふた》つえらんでならべよう。',
    tiles: ['さくら', 'かわず', 'せみ', '赤《あか》とんぼ', '雪《ゆき》だるま', 'すず風《かぜ》'],
    parts: ['さくら', 'かわず'],
    wrong: [
      ['さくら+せみ', 'h-season-mix'],
      ['かわず+赤《あか》とんぼ', 'h-season-mix'],
    ],
    hints: [
      '一《ひと》つずつ、いつのきせつに見《み》られるか考《かんが》えよう。',
      'むかしの言葉《ことば》の「かわず」は、かえるのことだよ。',
      '一《ひと》つは花《はな》の言葉《ことば》だよ。',
    ],
    e: '春《はる》の言葉《ことば》は「さくら」と「かわず」（かえる）。せみ・すず風《かぜ》は夏《なつ》、赤《あか》とんぼは秋《あき》、雪《ゆき》だるまは冬《ふゆ》の言葉《ことば》だよ。',
  },
];
const kigoAltBuildItems: Item[] = KIGO_ALT_BUILD.map((a): BuildItem => ({
  engine: 'build',
  id: `kigo-alt:${a.id}`,
  objective: 'kigo',
  level: 2,
  alt: true,
  prompt: a.prompt,
  tiles: a.tiles,
  answer: { kind: 'parts', parts: a.parts },
  wrongAnswers: a.wrong.map(([value, misconception]) => ({ value, misconception })),
  hints: a.hints,
  explain: a.e,
  identity: `haiku:kigo-alt:${a.id}`,
}));
const kigoAltListen: ListenItem = {
  engine: 'listen',
  id: 'kigo-alt:suzukaze',
  objective: 'kigo',
  level: 2,
  alt: true,
  prompt: '聞《き》いた言葉《ことば》は、どのきせつの言葉《ことば》かな。',
  audio: { text: 'すず風《かぜ》' },
  figure: { kind: 'text', text: 'すず風《かぜ》', size: 'l' },
  options: seasonOptions('夏', { 春: 'h-season-mix', 秋: 'h-season-feel', 冬: 'h-season-mix' }),
  fixedOrder: true,
  layout: 'row',
  hints: [
    '「すず風《かぜ》」は、すずしい風《かぜ》のことだよ。',
    'すずしい風《かぜ》がうれしいのは、どんな日《ひ》かな。',
    '春《はる》と冬《ふゆ》ではないね。',
  ],
  explain:
    '「すず風《かぜ》」は、夏《なつ》のあつい日《ひ》にふく、すずしい風《かぜ》のこと。夏《なつ》の言葉《ことば》だよ。',
  identity: 'haiku:kigo-alt:suzukaze',
};

// ---- 1.6.4 kiku お手本を聞く ----
interface Kiku {
  id: string;
  ok: string;
  wrong: Wrong[];
  h2: string;
  h3: string;
  e: string;
}
const KIKU: Kiku[] = [
  {
    id: 'furuike',
    ok: 'しずかな池《いけ》に、かえるがとびこむ',
    wrong: [
      ['かえるがたくさん鳴《な》いている', 'h-scene-add'],
      ['雨《あめ》が池《いけ》にふっている', 'h-scene-add'],
    ],
    h2: '「かわず」は、かえるのむかしの言《い》い方《かた》だよ。',
    h3: '聞《き》こえるのは「水《みず》の音《おと》」だけ。鳴《な》き声《ごえ》や雨《あめ》の音《おと》は出《で》てこないね。',
    e: '古《ふる》い池《いけ》に、かえるがとびこんだ。その水《みず》の音《おと》で、まわりのしずかさがよく分《わ》かるね。',
  },
  {
    id: 'yareutsuna',
    ok: 'はえが手《て》をすり合《あ》わせている',
    wrong: [
      ['はえが手《て》をたたいている', 'h-scene-word'],
      ['はえを手《て》でつかまえた', 'h-scene-add'],
    ],
    h2: '「やれ打《う》つな」は「これ、たたくなよ」という意味《いみ》だよ。',
    h3: '「手《て》をすり」は、手《て》をこすり合《あ》わせることだよ。',
    e: '「やれ打《う》つな」は「これ、たたくなよ」という意味《いみ》。はえが手《て》や足《あし》をすり合《あ》わせる様子《ようす》を、たのんでいるように見《み》ているんだね。',
  },
  {
    id: 'ikutabi',
    ok: '何度《なんど》も雪《ゆき》のつもり方《かた》を聞《き》く',
    wrong: [
      ['何度《なんど》も雪《ゆき》の中《なか》を歩《ある》く', 'h-scene-word'],
      ['雪《ゆき》がすぐにとけてしまう', 'h-scene-add'],
    ],
    h2: '「いくたびも」は「何度《なんど》も」という意味《いみ》だよ。',
    h3: '「たずねけり」の「たずねる」は、人《ひと》に聞《き》くことだよ。',
    e: '「いくたびも」は「何度《なんど》も」、「たずねけり」は「聞《き》いた」という意味《いみ》。雪《ゆき》がどのくらいつもったか、何度《なんど》も聞《き》いている様子《ようす》だよ。',
  },
  {
    id: 'meigetsu',
    ok: '月《つき》を取《と》ってと、子《こ》どもがなく',
    wrong: [
      ['子《こ》どもが月《つき》を見《み》てわらう', 'h-scene-word'],
      ['子《こ》どもが月《つき》の絵《え》をかく', 'h-scene-add'],
    ],
    h2: '「取《と》ってくれろ」は「取《と》ってちょうだい」という意味《いみ》だよ。',
    h3: '「なく子《こ》」の「なく」は、わらうことかな、なくことかな。',
    e: '「名月《めいげつ》を取《と》ってくれろとなく子《こ》」は、まるい月《つき》を「取《と》ってちょうだい」とないている子《こ》どものこと。',
  },
  {
    id: 'senpuuki',
    ok: 'せんぷうきの前《まえ》で声《こえ》がふるえる',
    wrong: [
      ['さむくて声《こえ》がふるえる', 'h-scene-word'],
      ['せんぷうきがこわれている', 'h-scene-add'],
    ],
    h2: 'せんぷうきの前《まえ》で話《はな》すと、どうなるかな。',
    h3: '「こわれている」とは言《い》っていないね。',
    e: 'せんぷうきの前《まえ》で話《はな》すと、風《かぜ》で声《こえ》がふるえて聞《き》こえるね。夏《なつ》の楽《たの》しい様子《ようす》だよ。',
  },
  {
    id: 'yamaji',
    ok: '山道《やまみち》のすみれに心《こころ》ひかれる',
    wrong: [
      ['山道《やまみち》でまよってこまる', 'h-scene-word'],
      ['すみれをつんで家《いえ》に帰《かえ》る', 'h-scene-add'],
    ],
    h2: '「なにやらゆかし」は「なんとなく心《こころ》ひかれる」という意味《いみ》だよ。',
    h3: 'すみれをつんだとは言《い》っていないね。',
    e: '「山路《やまじ》」は山道《やまみち》のこと。山道《やまみち》を歩《ある》いてきて、道《みち》ばたのすみれに、なんとなく心《こころ》ひかれた様子《ようす》だよ。',
  },
  {
    id: 'harunoumi',
    ok: '海《うみ》が一日《いちにち》じゅうゆったりゆれる',
    wrong: [
      ['海《うみ》があれて波《なみ》が高《たか》い', 'h-scene-word'],
      ['海《うみ》で人《ひと》がおよいでいる', 'h-scene-add'],
    ],
    h2: '「ひねもす」は「一日《いちにち》じゅう」という意味《いみ》だよ。',
    h3: '「のたりのたり」は、ゆっくりした様子《ようす》かな、はげしい様子《ようす》かな。',
    e: '「ひねもす」は「一日《いちにち》じゅう」、「のたりのたり」は波《なみ》がゆったりとうねる様子《ようす》。のんびりした春《はる》の海《うみ》だね。',
  },
];
const kikuItems: Item[] = KIKU.map((q): ListenItem => {
  const h = H(q.id);
  return {
    engine: 'listen',
    id: `kiku:${h.id}`,
    objective: 'kiku',
    level: 3,
    prompt:
      'お手本《てほん》の音読《おんどく》を聞《き》こう。目《め》にうかぶ様子《ようす》はどれ。',
    audio: { text: sayOf(h) },
    options: opts(q.ok, q.wrong),
    layout: 'column',
    hints: [
      'もう一度《いちど》聞《き》いて、出《で》てくるものと、その様子《ようす》を思《おも》いうかべよう。',
      q.h2,
      q.h3,
    ],
    explain: q.e,
    identity: `haiku:kiku:${h.id}`,
  };
});

interface KikuAlt {
  id: string;
  ask: string;
  ok: [string, string];
  wrong: [string, string, string][];
  h2: string;
  h3: string;
  e: string;
}
const KIKU_ALT: KikuAlt[] = [
  {
    id: 'akatonbo',
    ask: 'とんぼがとまっているのはどこ。',
    ok: ['ぼうし', 'p23-hat'],
    wrong: [
      ['木《き》', 'tree', 'h-scene-add'],
      ['花《はな》', 'flower', 'h-scene-add'],
    ],
    h2: '「〜の上《うえ》で」のところをよく聞《き》こう。',
    h3: '木《き》は出《で》てこないね。',
    e: '「ぼうしの上《うえ》で　ひと休《やす》み」。赤《あか》とんぼがぼうしにとまって休《やす》んでいるよ。',
  },
  {
    id: 'meigetsu',
    ask: '子《こ》どもがほしがっているものはどれ。',
    ok: ['お月《つき》さま', 'p5-moon'],
    wrong: [
      ['たいよう', 'p5-sun', 'h-scene-add'],
      ['星《ほし》', 'p23-star', 'h-scene-add'],
    ],
    h2: '「名月《めいげつ》」は、秋《あき》の夜《よる》の空《そら》に見《み》えるものだよ。',
    h3: '星《ほし》は出《で》てこないね。',
    e: '「名月《めいげつ》を取《と》ってくれろ」。子《こ》どもは月《つき》をほしがっているよ。',
  },
  {
    id: 'yamaji',
    ask: '山道《やまみち》で見《み》つけたものはどれ。',
    ok: ['花《はな》', 'flower'],
    wrong: [
      ['きのこ', 'life-mushroom', 'h-scene-add'],
      ['はっぱ', 'leaf', 'h-scene-add'],
    ],
    h2: '「すみれ草《ぐさ》」の「すみれ」は何《なん》のなかまかな。',
    h3: 'きのこは出《で》てこないね。',
    e: '「すみれ草《ぐさ》」はすみれの花《はな》のこと。山道《やまみち》ですみれの花《はな》を見《み》つけたよ。',
  },
];
const kikuAltItems: Item[] = KIKU_ALT.map((a): ListenItem => {
  const h = H(a.id);
  return {
    engine: 'listen',
    id: `kiku-alt:${h.id}`,
    objective: 'kiku',
    level: 3,
    alt: true,
    prompt: `お手本《てほん》を聞《き》こう。${a.ask}`,
    audio: { text: sayOf(h) },
    options: [
      { label: a.ok[0], figure: { kind: 'illust', id: a.ok[1] }, correct: true },
      ...a.wrong.map(([label, id, misconception]) => ({
        label,
        figure: { kind: 'illust' as const, id },
        misconception,
      })),
    ],
    layout: 'row',
    hints: [
      'もう一度《いちど》聞《き》いて、出《で》てくるものを思《おも》いうかべよう。',
      a.h2,
      a.h3,
    ],
    explain: a.e,
    identity: `haiku:kiku-alt:${h.id}`,
  };
});

const ITEMS: Item[] = [
  ...otoItems,
  ...otoAltItems,
  ...kugiriItems,
  ...kugiriAltItems,
  ...kigoFindItems,
  ...kigoSeasonItems,
  ...kigoAltBuildItems,
  kigoAltListen,
  ...kikuItems,
  ...kikuAltItems,
];

export const haiku: UnitSpec = {
  id: 'g3.ja.haiku',
  title: '俳句《はいく》を楽《たの》しもう',
  stage: 'g3',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'knowledge',
  priority: 'P2',
  status: 'ready',
  icon: 'leaf',
  prereq: [],
  objectives: [
    { id: 'oto', title: '音《おん》の数《かず》を数《かぞ》える' },
    { id: 'kugiri', title: '五《ご》・七《しち》・五《ご》に区《く》切《ぎ》る' },
    { id: 'kigo', title: 'きせつの言葉《ことば》を見《み》つける' },
    { id: 'kiku', title: 'お手本《てほん》を聞《き》いて様子《ようす》を思《おも》いうかべる' },
  ],
  misconceptions: [
    {
      id: 'h-youon',
      explain:
        '小《ちい》さい「ゃ・ゅ・ょ」も1音《おん》と数《かぞ》えたのかな。「ちょ」「しゅ」のように、前《まえ》の字《じ》といっしょに1回《かい》で言《い》う音《おん》は1音《おん》だよ。手《て》をたたきながら言《い》ってみよう。',
    },
    {
      id: 'h-skip',
      explain:
        '小《ちい》さい「っ」や「ん」、のばす音《おん》（ー・う）は数《かぞ》えないと考《かんが》えたのかな。どれも1音《おん》として、手《て》を1回《かい》たたくよ。',
    },
    {
      id: 'h-moji',
      explain:
        '字《じ》の数《かず》を数《かぞ》えたのかな。漢字《かんじ》は1字《じ》でも、読《よ》むと2音《おん》や3音《おん》になることがあるよ。読《よ》みがなで数《かぞ》えよう。',
    },
    {
      id: 'h-split',
      explain:
        '音《おん》の数《かず》をたしかめずに区《く》切《ぎ》ったのかな。はじめは5音《おん》、まん中《なか》は7音《おん》、さいごは5音《おん》。カードを一《ひと》つずつ、手《て》をたたいて数《かぞ》えよう。',
    },
    {
      id: 'h-order',
      explain:
        '五《ご》・七《しち》・五《ご》のじゅん番《ばん》を取《と》りちがえたのかな。俳句《はいく》は、はじめの五《ご》音《おん》、まん中《なか》の七《しち》音《おん》、さいごの五《ご》音《おん》のじゅんに読《よ》むよ。',
    },
    {
      id: 'h-kigo-thing',
      explain:
        'いつのきせつにもある物《もの》・場所《ばしょ》・様子《ようす》の言葉《ことば》をえらんだのかな。その言葉《ことば》を聞《き》いて、きせつが一《ひと》つに決《き》まるかを考《かんが》えよう。',
    },
    {
      id: 'h-season-mix',
      explain:
        'ほかのきせつと取《と》りちがえたのかな。その物《もの》や様子《ようす》が、いちばん多《おお》く見《み》られるのはいつか、思《おも》い出《だ》してみよう。',
    },
    {
      id: 'h-season-part',
      explain:
        '言葉《ことば》の一部《いちぶ》だけを見《み》て、きせつを決《き》めたのかな。後《うし》ろにつづく言葉《ことば》（「〜とけて」など）で、きせつがかわることがあるよ。言葉《ことば》全体《ぜんたい》で考《かんが》えよう。',
    },
    {
      id: 'h-season-feel',
      explain:
        '「つめたい」「すずしい」という感《かん》じだけで、きせつを決《き》めたのかな。あつい日《ひ》に食《た》べるつめたい物《もの》や、あつい日《ひ》にふくすずしい風《かぜ》もあるよ。それがいつのことかを考《かんが》えよう。',
    },
    {
      id: 'h-scene-add',
      explain:
        '俳句《はいく》に出《で》てこないことを、つけたしたのかな。聞《き》こえた言葉《ことば》だけから、様子《ようす》を思《おも》いうかべよう。',
    },
    {
      id: 'h-scene-word',
      explain:
        '言葉《ことば》の意味《いみ》を取《と》りちがえたのかな。むかしの言葉《ことば》は、今《いま》とちがう意味《いみ》のことがあるよ。答《こた》えを見《み》たあとで、言葉《ことば》の意味《いみ》をたしかめよう。',
    },
  ],
  levels: [
    { label: '音を数える', chance: 0.1 },
    { label: '五・七・五に区切る', chance: 0.1 },
    { label: 'きせつの言葉', chance: 0.1 },
    { label: 'お手本を聞く', chance: 0.1 },
  ],
  intro: [
    {
      text: '俳句《はいく》は、五《ご》・七《しち》・五《ご》の十七《じゅうしち》音《おん》でできた短《みじか》い詩《し》だよ。',
      figure: {
        kind: 'text',
        text: 'たんぽぽの　わた毛《げ》がとんで　空《そら》高《たか》く',
        size: 'm',
      },
    },
    {
      text: '音《おん》は手《て》をたたいて数《かぞ》えるよ。小《ちい》さい「ゃ・ゅ・ょ」は前《まえ》の字《じ》といっしょに1音《おん》。小《ちい》さい「っ」、「ん」、のばす音《おん》は、それぞれ1音《おん》に数《かぞ》えるよ。',
      figure: {
        kind: 'text',
        text: 'きょ・う・りゅ・う（4音《おん》）　き・っ・て（3音《おん》）',
        size: 'm',
      },
    },
    {
      text: '俳句《はいく》には、きせつを表《あらわ》す言葉《ことば》（きせつの言葉《ことば》）を入《い》れるよ。れい: たんぽぽ（春《はる》）、ほたる（夏《なつ》）、もみじ（秋《あき》）、こたつ（冬《ふゆ》）。',
    },
    {
      text: 'むかしの俳句《はいく》には、今《いま》とちがう言葉《ことば》もあるよ。お手本《てほん》の音読《おんどく》を聞《き》いて、リズムと、目《め》にうかぶ様子《ようす》を楽《たの》しもう。',
    },
  ],
  source: { kind: 'items', items: ITEMS },
  review: 'none',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第3学年及び第4学年〔知識及び技能〕(3)ア（易しい文語調の短歌や俳句を音読したり暗唱したりするなどして、言葉の響きやリズムに親しむこと）。きせつの言葉（季語）は教科書で一般的な扱いに合わせた本アプリの範囲',
  gradeIsAppProposal: true,
  revised: REVISED,
};
