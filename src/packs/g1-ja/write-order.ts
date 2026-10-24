/**
 * g1.ja.write-order じゅんじょよく かこう（けいけんを じゅんに ならべる。curriculum-matrix 3.4）。
 *
 * 到達項目:
 *   pics  … えにっきの えを じかんの じゅんに ならべる（order・え＋みじかい ことば）。別例: えだけの カード
 *   cards … ぶんの カードを じゅんに ならべる（order・たて）。別例: てじゅんの ぶん
 *   words … じゅんじょの ことば（はじめに・つぎに・さいごに）を えらぶ（choice）。別例: まず・それから
 *   write … 「かいてみよう」（explain。採点しない。保護者が見る）。別例: えと ぶんで かく
 * 同一性キー: ならべる カードの くみ・といかけ。
 * matrix の エンジン列は order・explain。じゅんじょの ことばの 到達項目だけ choice を つかう。
 */
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import type { ExplainItem } from '../../engines/explain/explain';
import type { OrderItem } from '../../engines/order/order';
import { opts, REVISED } from './util';

// ---- pics: えにっき（え＋ことば） ----
interface PicStory {
  id: string;
  title: string;
  steps: [label: string, illust: string][];
  /** ほかに みとめる じゅん */
  alsoAccept?: number[][];
  /** ヒント①（なにに めを つけるか） */
  h1: string;
}

const PIC_STORIES: PicStory[] = [
  {
    id: 'ensoku',
    title: 'えんそく',
    h1: 'いえを でて、さいごは いえに かえるね。',
    steps: [
      ['バスに のる', 'bus-yellow'],
      ['ぞうを みる', 'elephant'],
      ['おにぎりを たべる', 'onigiri'],
      ['いえに かえる', 'house'],
    ],
    alsoAccept: [[0, 2, 1, 3]],
  },
  {
    id: 'hiyoko',
    title: 'ひよこが うまれた',
    h1: 'いちばん はじめは なにかな。',
    steps: [
      ['たまご', 'egg'],
      ['ひよこ', 'chick'],
      ['にわとり', 'bird'],
    ],
  },
  {
    id: 'ame',
    title: 'あめの ひ',
    h1: 'そとに でる まえに する ことは なにかな。',
    steps: [
      ['かさを もつ', 'umbrella'],
      ['でんしゃに のる', 'train'],
      ['いえに かえる', 'house'],
    ],
  },
  {
    id: 'kaimono',
    title: 'かいもの',
    h1: 'おみせに いく ところから はじまるよ。',
    steps: [
      ['じてんしゃで いく', 'bicycle'],
      ['りんごを かう', 'apple'],
      ['いえで たべる', 'house'],
    ],
  },
  {
    id: 'umi',
    title: 'うみへ いった',
    h1: 'うみに つく までの ことから かんがえよう。',
    steps: [
      ['じどうしゃで いく', 'car-red'],
      ['ふねに のる', 'ship'],
      ['いえに かえる', 'house'],
    ],
  },
  {
    id: 'hana',
    title: 'はなを そだてた',
    h1: 'たねを まいた あと、どう そだつかな。',
    steps: [
      ['はっぱが でる', 'leaf'],
      ['はなが さく', 'flower'],
      ['えに かく', 'pencil'],
    ],
  },
  {
    id: 'koen',
    title: 'こうえんで あそんだ',
    h1: 'あそびに いく ところから はじまるよ。',
    steps: [
      ['こうえんに いく', 'tree'],
      ['ボールで あそぶ', 'ball'],
      ['いえに かえる', 'house'],
    ],
  },
];

function picOrder(s: PicStory): OrderItem {
  return {
    engine: 'order',
    id: `pics:${s.id}`,
    objective: 'pics',
    level: 0,
    prompt: `「${s.title}」の えにっき。した ことの じゅんに ならべよう。`,
    cards: s.steps.map(([label, id]) => ({ label, figure: { kind: 'illust', id } })),
    ends: ['はじめ', 'おわり'],
    alsoAccept: s.alsoAccept,
    reverseMisconception: 'order-reverse',
    wrongOrders:
      s.steps.length >= 3
        ? [{ order: [1, 0, ...s.steps.slice(2).map((_, i) => i + 2)], misconception: 'start-skip' }]
        : [],
    hints: [
      s.h1,
      `いちばん はじめは 「${s.steps[0]![0]}」 だよ。`,
      `「${s.steps[0]![0]}」の つぎは 「${s.steps[1]![0]}」。のこりを ならべよう。`,
    ],
    explain: `${s.steps.map(([l]) => l).join(' → ')} の じゅん だよ。`,
    identity: `pics:${s.id}`,
  };
}

/** 別例: えだけの カード（なまえは 読み上げ用） */
const PIC_ALT: PicStory[] = [
  {
    id: 'alt-zoo',
    title: 'どうぶつえん',
    h1: 'どうぶつえんへは なにで いったかな。',
    steps: [
      ['バスで いく', 'bus-yellow'],
      ['さるを みる', 'monkey'],
      ['いえに かえる', 'house'],
    ],
  },
  {
    id: 'alt-ringo',
    title: 'りんごの き',
    h1: 'はなが さく まえに でる ものは なにかな。',
    steps: [
      ['はっぱが でる', 'leaf'],
      ['はなが さく', 'flower'],
      ['りんごが なる', 'apple'],
    ],
  },
  {
    id: 'alt-sky',
    title: 'りょこう',
    h1: 'えきから はじまるよ。',
    steps: [
      ['でんしゃで くうこうへ', 'train'],
      ['ひこうきに のる', 'airplane'],
      ['うみを みる', 'ship'],
    ],
  },
];

function picAlt(s: PicStory): OrderItem {
  return {
    ...picOrder(s),
    id: `pics-alt:${s.id}`,
    alt: true,
    prompt: `「${s.title}」の え。おはなしの じゅんに ならべよう。`,
    cards: s.steps.map(([name, id]) => ({ name, figure: { kind: 'illust', id } })),
    identity: `pics-alt:${s.id}`,
  };
}

// ---- cards: ぶんの カード ----
interface Diary {
  id: string;
  title: string;
  lines: string[];
  h1: string;
  alt?: boolean;
}

const DIARIES: Diary[] = [
  {
    id: 'ensoku',
    title: 'えんそく',
    h1: '「あさ」「おひる」「かえり」に めを つけよう。',
    lines: [
      'あさ、がっこうに あつまりました。',
      'バスで やまへ いきました。',
      'おひるに おべんとうを たべました。',
      'かえりの バスで ねて しまいました。',
    ],
  },
  {
    id: 'imohori',
    title: 'いもほり',
    h1: 'いもを ほる まえに する ことは なにかな。',
    lines: [
      'はたけに つきました。',
      'ぐんてを はめました。',
      'つちを ほって、いもを ぬきました。',
      'とれた いもを ふくろに いれました。',
    ],
  },
  {
    id: 'otetsudai',
    title: 'おてつだい',
    h1: '「はじめに」「つぎに」「さいごに」を さがそう。',
    lines: [
      'はじめに、テーブルを ふきました。',
      'つぎに、おさらを ならべました。',
      'さいごに、おはしを おきました。',
    ],
  },
  {
    id: 'pool',
    title: 'プール',
    h1: 'プールに はいる まえに する ことは なにかな。',
    lines: [
      'みずぎに きがえました。',
      'シャワーを あびました。',
      'プールで およぎました。',
      'タオルで からだを ふきました。',
    ],
  },
  {
    id: 'tanabata',
    title: 'たなばた',
    h1: 'かざる まえに、まず かく ものが あるね。',
    lines: [
      'たんざくに ねがいごとを かきました。',
      'ささに たんざくを つるしました。',
      'よる、ほしを みました。',
    ],
  },
  {
    id: 'yuki',
    title: 'ゆきの ひ',
    h1: '「あさ」から はじまるよ。',
    lines: [
      'あさ、まどの そとを みたら ゆきでした。',
      'てぶくろを して そとに でました。',
      'ゆきだるまを つくりました。',
      'いえに はいって、てを あたためました。',
    ],
  },
  {
    id: 'tomodachi',
    title: 'ともだちと',
    h1: 'あそぶ やくそくを した ときから はじまるよ。',
    lines: [
      'ともだちと あそぶ やくそくを しました。',
      'こうえんで まちあわせました。',
      'いっしょに すなやまを つくりました。',
      '「また あしたね」と いって わかれました。',
    ],
  },
  {
    id: 'hon',
    title: 'としょしつ',
    h1: 'ほんを よむ まえに、まず なにを するかな。',
    lines: [
      'としょしつで ほんを えらびました。',
      'せきに すわって よみました。',
      'よみおわって、ほんを たなに もどしました。',
    ],
  },
  // 別例: てじゅんの ぶん（せつめい）
  {
    id: 'alt-hamigaki',
    title: 'はみがきの しかた',
    alt: true,
    h1: 'はぶらしに つける ものから はじまるよ。',
    lines: [
      'はぶらしに はみがきこを つけます。',
      'はを みがきます。',
      'みずで くちを すすぎます。',
    ],
  },
  {
    id: 'alt-tegami',
    title: 'てがみの だしかた',
    alt: true,
    h1: 'まず てがみを かかないと だせないね。',
    lines: [
      'てがみを かきます。',
      'ふうとうに いれます。',
      'きってを はります。',
      'ポストに いれます。',
    ],
  },
  {
    id: 'alt-asagao',
    title: 'あさがおの たねまき',
    alt: true,
    h1: 'たねを いれる まえに、つちに なにを するかな。',
    lines: [
      'うえきばちに つちを いれます。',
      'ゆびで あなを あけます。',
      'たねを いれて つちを かけます。',
      'みずを やります。',
    ],
  },
];

function cardOrder(d: Diary): OrderItem {
  return {
    engine: 'order',
    id: `cards:${d.id}`,
    objective: 'cards',
    level: 1,
    alt: d.alt,
    prompt: d.alt
      ? `「${d.title}」。てじゅんの じゅんに ぶんを ならべよう。`
      : `「${d.title}」の にっき。した ことの じゅんに ぶんを ならべよう。`,
    layout: 'column',
    cards: d.lines.map((label) => ({ label })),
    ends: ['はじめ', 'おわり'],
    reverseMisconception: 'order-reverse',
    wrongOrders: [
      { order: [1, 0, ...d.lines.slice(2).map((_, i) => i + 2)], misconception: 'start-skip' },
      ...(d.lines.length >= 3
        ? [
            {
              order: [
                ...d.lines.slice(0, -2).map((_, i) => i),
                d.lines.length - 1,
                d.lines.length - 2,
              ],
              misconception: 'end-swap',
            },
          ]
        : []),
    ],
    hints: [
      d.h1,
      'いちばん はじめに した ことの ぶんを さがそう。',
      `はじめの ぶんは 「${d.lines[0]}」。つぎを かんがえよう。`,
    ],
    explain: d.lines.map((l, i) => `${i + 1}. ${l}`).join(' '),
    identity: `cards:${d.id}`,
  };
}

// ---- words: じゅんじょの ことば ----
interface Word {
  id: string;
  text: string;
  answer: string;
  wrongs: [string, string][];
  h2: string;
  alt?: boolean;
}

const WORDS: Word[] = [
  {
    id: 'kao',
    text: 'はじめに かおを あらいました。（　）、はを みがきました。さいごに きがえました。',
    answer: 'つぎに',
    wrongs: [
      ['はじめに', 'time-word'],
      ['さいごに', 'time-word'],
    ],
    h2: 'まんなかに した ことだね。',
  },
  {
    id: 'e',
    text: '（　）、えの ぐを だしました。つぎに えを かきました。さいごに ふでを あらいました。',
    answer: 'はじめに',
    wrongs: [
      ['つぎに', 'time-word'],
      ['さいごに', 'time-word'],
    ],
    h2: 'いちばん はじめに した ことだね。',
  },
  {
    id: 'ryouri',
    text: 'はじめに やさいを あらいました。つぎに やさいを きりました。（　）、なべで にました。',
    answer: 'さいごに',
    wrongs: [
      ['はじめに', 'time-word'],
      ['つぎに', 'time-word'],
    ],
    h2: 'いちばん おわりに した ことだね。',
  },
  {
    id: 'kutsu',
    text: 'はじめに くつを ぬぎました。（　）、くつばこに いれました。さいごに うわばきを はきました。',
    answer: 'つぎに',
    wrongs: [
      ['さいごに', 'time-word'],
      ['はじめに', 'time-word'],
    ],
    h2: 'まんなかに した ことだね。',
  },
  {
    id: 'sanpo',
    text: '（　）、いぬに リードを つけました。つぎに こうえんまで あるきました。さいごに いえに かえりました。',
    answer: 'はじめに',
    wrongs: [
      ['さいごに', 'time-word'],
      ['つぎに', 'time-word'],
    ],
    h2: 'いちばん はじめに した ことだね。',
  },
  {
    id: 'katazuke',
    text: 'はじめに おもちゃを あつめました。つぎに はこに いれました。（　）、たなに しまいました。',
    answer: 'さいごに',
    wrongs: [
      ['つぎに', 'time-word'],
      ['はじめに', 'time-word'],
    ],
    h2: 'いちばん おわりに した ことだね。',
  },
  // 別例: まず・それから
  {
    id: 'alt-sentaku',
    alt: true,
    text: 'まず、せんたくものを たたみました。（　）、たんすに しまいました。',
    answer: 'それから',
    wrongs: [
      ['まず', 'time-word'],
      ['きのう', 'not-order-word'],
    ],
    h2: 'まえの ことの あとに した ことだね。',
  },
  {
    id: 'alt-kami',
    alt: true,
    text: '（　）、かみを はんぶんに おりました。それから はさみで きりました。',
    answer: 'まず',
    wrongs: [
      ['それから', 'time-word'],
      ['でも', 'not-order-word'],
    ],
    h2: 'いちばん はじめに した ことだね。',
  },
  {
    id: 'alt-mizu',
    alt: true,
    text: 'まず、じょうろに みずを いれました。（　）、はなに みずを やりました。',
    answer: 'それから',
    wrongs: [
      ['まず', 'time-word'],
      ['だから', 'not-order-word'],
    ],
    h2: 'まえの ことの あとに した ことだね。',
  },
];

function wordItem(w: Word): ChoiceItem {
  return {
    engine: 'choice',
    id: `words:${w.id}`,
    objective: 'words',
    level: 2,
    alt: w.alt,
    prompt: '（　）に はいる ことばは どれ？',
    figure: { kind: 'text', text: w.text, size: 'm' },
    options: opts(w.answer, w.wrongs),
    hints: [
      '（　）の まえと あとの ぶんを よもう。',
      w.h2,
      'おなじ じゅんじょの ことばは、1つの ぶんしょうで 1かいずつ つかうよ。',
    ],
    explain: `「${w.answer}」が はいるよ。${w.text.replace('（　）', w.answer)}`,
    identity: `words:${w.id}`,
  };
}

// ---- write: かいてみよう（採点しない） ----
const WRITES: { id: string; prompt: string; h: [string, string, string]; alt?: boolean }[] = [
  {
    id: 'asa',
    prompt: 'けさ おきてから がっこうに いく までに した ことを、じゅんに かいてみよう。',
    h: [
      'おきて さいしょに した ことは なにかな。',
      '「はじめに」「つぎに」「さいごに」を つかうと かきやすいよ。',
      '3つ かけたら じゅうぶん だよ。',
    ],
  },
  {
    id: 'asobi',
    prompt: 'きのう あそんだ ことを、じゅんに かいてみよう。',
    h: [
      'だれと、どこで あそんだかな。',
      'あそんだ じゅんに おもいだそう。',
      'さいごに、どんな きもち だったかも かけるよ。',
    ],
  },
  {
    id: 'kyushoku',
    prompt: 'きゅうしょくの じゅんびで する ことを、じゅんに かいてみよう。',
    h: [
      'いちばん はじめに する ことは なにかな。',
      '「まず」「それから」を つかって みよう。',
      'みじかい ぶんで いいよ。',
    ],
  },
  {
    id: 'otetsudai',
    prompt: 'おうちで した おてつだいを、じゅんに かいてみよう。',
    h: [
      'どんな おてつだいを したかな。',
      'はじめに した ことから かこう。',
      'おわった あとの きもちも かけるよ。',
    ],
  },
  {
    id: 'kaerimichi',
    prompt: 'がっこうから かえって した ことを、じゅんに かいてみよう。',
    h: [
      'いえに ついて さいしょに した ことは なにかな。',
      '「つぎに」で つなげよう。',
      '3つ かけたら じゅうぶん だよ。',
    ],
  },
  {
    id: 'yasumi',
    prompt: 'やすみの ひに した ことを、じゅんに かいてみよう。',
    h: [
      'あさ・ひる・よるの どれから かくかな。',
      'じかんの じゅんに ならべよう。',
      'いちばん たのしかった ことも かこう。',
    ],
  },
  // 別例: えと ぶんで（えにっき）
  {
    id: 'alt-enikki',
    alt: true,
    prompt: 'たのしかった ひの えにっきを かこう。うえに え、したに ぶんを かいてみよう。',
    h: [
      'いちばん こころに のこった ばめんを えに しよう。',
      'ぶんは 「はじめに」「つぎに」で じゅんに かこう。',
      'みじかくて いいよ。',
    ],
  },
  {
    id: 'alt-sodate',
    alt: true,
    prompt: 'そだてて いる はなや やさいの ようすを、えと ぶんで かいてみよう。',
    h: [
      'いまの ようすを よく みて えに しよう。',
      'まえと くらべて かわった ことを かこう。',
      'ひづけも かくと いいよ。',
    ],
  },
  {
    id: 'alt-tsukurikata',
    alt: true,
    prompt: 'おりがみや こうさくの つくりかたを、えと ぶんで じゅんに かいてみよう。',
    h: [
      'はじめに なにを したかな。',
      '1、2、3 と ばんごうを つけても いいよ。',
      'できあがりの えも かこう。',
    ],
  },
];

function writeItem(w: (typeof WRITES)[number]): ExplainItem {
  return {
    engine: 'explain',
    id: `write:${w.id}`,
    objective: 'write',
    level: 2,
    alt: w.alt,
    prompt: w.prompt,
    canvas: w.alt
      ? { aspect: 3 / 4, guide: 'lines', colors: true }
      : { aspect: 16 / 9, guide: 'lines', colors: false },
    require: { drawing: true },
    hints: [...w.h],
    explain:
      'かけたね。じゅんばんに かくと、よむ ひとに よく つたわるよ。おうちの ひとにも よんで もらおう。',
    identity: `write:${w.id}`,
  };
}

const items: Item[] = [
  ...PIC_STORIES.map(picOrder),
  ...PIC_ALT.map(picAlt),
  ...DIARIES.map(cardOrder),
  ...WORDS.map(wordItem),
  ...WRITES.map(writeItem),
];

export const writeOrder: UnitSpec = {
  id: 'g1.ja.write-order',
  title: 'じゅんじょよく かこう',
  stage: 'g1',
  subject: 'ja',
  domain: 'kaku',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'notebook',
  prereq: ['g1.ja.sentence-build'],
  objectives: [
    { id: 'pics', title: 'えにっきの えを じゅんに ならべる' },
    { id: 'cards', title: 'ぶんの カードを じゅんに ならべる' },
    { id: 'words', title: '「はじめに」「つぎに」「さいごに」を つかう' },
    { id: 'write', title: 'じゅんに かいてみる' },
  ],
  misconceptions: [
    {
      id: 'order-reverse',
      explain: 'おわりから ならべたのかな。いちばん はじめに した ことを ひだり（うえ）に おこう。',
    },
    {
      id: 'start-skip',
      explain:
        'はじめの ことを とばしたのかな。「それを する まえに なにを したか」を かんがえよう。',
    },
    {
      id: 'end-swap',
      explain: 'さいごの 2つが いれかわったのかな。どちらが あとに した ことか、たしかめよう。',
    },
    {
      id: 'time-word',
      explain:
        'じゅんじょの ことばを とりちがえたのかな。「はじめに」は さいしょ、「つぎに」は そのあと、「さいごに」は おわりに つかうよ。',
    },
    {
      id: 'not-order-word',
      explain:
        'じゅんじょを あらわさない ことばを えらんだのかな。「まず」「それから」のように、した じゅんを あらわす ことばを えらぼう。',
    },
  ],
  levels: [
    { label: 'えを ならべる', chance: 0.05 },
    { label: 'ぶんを ならべる', chance: 0.05 },
    { label: 'じゅんじょの ことば・かいてみよう', chance: 0.1 },
  ],
  intro: [
    { text: 'にっきは、した ことを じゅんばんに かくと よく わかるよ。' },
    {
      text: 'バスに のった → ぞうを みた → おにぎりを たべた → いえに かえった。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'illust', id: 'bus-yellow' },
          { kind: 'illust', id: 'elephant' },
          { kind: 'illust', id: 'onigiri' },
          { kind: 'illust', id: 'house' },
        ],
      },
    },
    {
      text: '「はじめに」「つぎに」「さいごに」を つかうと、じゅんばんが もっと よく つたわるよ。',
    },
  ],
  source: { kind: 'items', items },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年 B 書くこと (1)イ（自分の思いや考えが明確になるように、事柄の順序に沿って簡単な構成を考えること）、(2)イ（日記を書くなど、経験したことを書く言語活動）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
