/**
 * g4.ja.write-report 調べたことの報告（curriculum-matrix 3.7）。
 * 報告の型（調べたきっかけ・調べ方・分かったこと・考えたこと）に文を分ける → だんらくの順
 * → 引用を入れる（「 」と出典）→「かいてみよう」（explain。採点しない）。
 * 報告の文・本・書いた人・出版社はすべて本アプリの架空のもの（実在の名前を使わない）。
 * 「報告」「資料」「出版」は5年の字なので、かなで書く。
 *
 * 同一性キー: 報告の題・引用する本ごと（同じ報告の分け方と並べ方は別の問題）。
 * 「かいてみよう」は数に頼らない（どの到達項目も、採点する問題だけで練習6＋別例3 を満たす）。
 */
import type {
  ChoiceItem,
  ExplainItem,
  FillItem,
  Item,
  OrderItem,
  SortItem,
  UnitSpec,
} from '../../curriculum/types';
import { opts, REVISED } from './util';

const PARTS = [
  '調《しら》べたきっかけ',
  '調《しら》べ方《かた》',
  '分《わ》かったこと',
  '考《かんが》えたこと',
] as const;

interface Report {
  id: string;
  title: string;
  kikkake: string;
  shirabe: string;
  wakatta: string;
  kangae: string;
}

// 4つの文は、どれも 20字ほどまで（2行に入れる）。4まいの札が、sort では 2×2、order では 2列で、
// 作業領域に入る（text-layout-fixes 第4回。以前は文が 40〜90字で、12〜16u 足りなかった）
const REPORTS: Report[] = [
  {
    id: 'amenbo',
    title: '池《いけ》のアメンボ',
    kikkake: 'アメンボが水《みず》にうくのがふしぎでした。',
    shirabe: '本《ほん》を読《よ》み、先生《せんせい》に聞《き》きました。',
    wakatta: '足《あし》の毛《け》が水《みず》をはじいてうくそうです。',
    kangae: '体《からだ》にくふうがあると考《かんが》えました。',
  },
  {
    id: 'kyushoku',
    title: 'きゅう食《しょく》の食《た》べのこし',
    kikkake: '食《た》べのこしが多《おお》い日《ひ》が気《き》になりました。',
    shirabe: '一週間《いっしゅうかん》、量《りょう》を調《しら》べました。',
    wakatta: '魚《さかな》のおかずの日《ひ》がいちばん多《おお》かったです。',
    kangae: '食《た》べ方《かた》をしょうかいすればへると考《かんが》えます。',
  },
  {
    id: 'dangomushi',
    title: 'だんごむしのすみか',
    kikkake: '石《いし》の下《した》にたくさんいるのを見《み》つけました。',
    shirabe: '石《いし》の下《した》の数《かず》を数《かぞ》えました。',
    wakatta: '日《ひ》かげでしめった場所《ばしょ》に多《おお》くいました。',
    kangae: 'しめった場所《ばしょ》が好《す》きなのだと思《おも》います。',
  },
  {
    id: 'hashi',
    title: '町《まち》の古《ふる》い橋《はし》',
    kikkake: '古《ふる》い石《いし》の橋《はし》がいつできたのか気《き》になりました。',
    shirabe: '本《ほん》を読《よ》み、お年《とし》よりに聞《き》きました。',
    wakatta: 'およそ百年《ひゃくねん》前《まえ》に作《つく》られたと分《わ》かりました。',
    kangae: 'これからも大切《たいせつ》にしたいと考《かんが》えました。',
  },
  {
    id: 'goya',
    title: 'ゴーヤの日《ひ》よけ',
    kikkake: 'ゴーヤの日《ひ》よけが本当《ほんとう》か知《し》りたくなりました。',
    shirabe: '毎日《まいにち》、温度《おんど》をはかりました。',
    wakatta: 'ゴーヤのあるまどは温度《おんど》がひくかったです。',
    kangae: '日《ひ》よけに役立《やくだ》つのではないかと考《かんが》えます。',
  },
  {
    id: 'petbottle',
    title: 'ペットボトルのゆくえ',
    kikkake: 'ペットボトルがどうなるのか知《し》りたくなりました。',
    shirabe: 'リサイクルのしせつを見学《けんがく》しました。',
    wakatta: 'くだいて、新《あたら》しい物《もの》の材料《ざいりょう》になるそうです。',
    kangae: 'キャップを外《はず》すようよびかけたいと考《かんが》えました。',
  },
  {
    id: 'tulip',
    title: 'チューリップの花《はな》',
    kikkake: '夕方《ゆうがた》に花《はな》がとじているのに気《き》づきました。',
    shirabe: '朝《あさ》・昼《ひる》・夕方《ゆうがた》に記録《きろく》しました。',
    wakatta: '花《はな》は昼《ひる》にひらき、夕方《ゆうがた》にはとじていました。',
    kangae: 'あたたかさとかかわりがあると考《かんが》えました。',
  },
  {
    id: 'jitensha',
    title: '学校《がっこう》の前《まえ》の道《みち》',
    kikkake: '道《みち》で自転車《じてんしゃ》と人《ひと》がぶつかりそうでした。',
    shirabe: '通《とお》る自転車《じてんしゃ》を数《かぞ》えました。',
    wakatta: '自転車《じてんしゃ》が四十二台《よんじゅうにだい》通《とお》りました。',
    kangae: 'おりておすようによびかけるとよいと考《かんが》えます。',
  },
];

// ---- 1. 報告の型に分ける ----
function kataItem(r: Report): SortItem {
  return {
    engine: 'sort',
    id: `kata:${r.id}`,
    objective: 'kata',
    level: 0,
    prompt: `「${r.title}」のほうこくの文《ぶん》を、四《よっ》つのまとまりに分《わ》けよう。`,
    boxes: PARTS.map((label) => ({ label })),
    cards: [
      {
        label: r.kikkake,
        box: 0,
        wrongBoxes: [{ box: 1, misconception: 'method-reason' }],
      },
      {
        label: r.shirabe,
        box: 1,
        wrongBoxes: [
          { box: 0, misconception: 'method-reason' },
          { box: 2, misconception: 'method-reason' },
        ],
      },
      {
        label: r.wakatta,
        box: 2,
        wrongBoxes: [{ box: 3, misconception: 'fact-opinion' }],
      },
      {
        label: r.kangae,
        box: 3,
        wrongBoxes: [{ box: 2, misconception: 'fact-opinion' }],
      },
    ],
    hints: [
      'きっかけは「なぜ調《しら》べようと思《おも》ったか」、調《しら》べ方《かた》は「どうやって調《しら》べたか」だよ。',
      '分《わ》かったことは、調《しら》べて分《わ》かった事実《じじつ》。「〜そうです」「〜でした」の文《ぶん》が多《おお》いよ。',
      '考《かんが》えたことは自分《じぶん》の考《かんが》え。「〜と考《かんが》えます」「〜と思《おも》います」の文《ぶん》だよ。',
    ],
    explain:
      'きっかけ・調《しら》べ方《かた》・分《わ》かったこと（事実《じじつ》）・考《かんが》えたこと（自分《じぶん》の考《かんが》え）に分《わ》けます。',
    identity: `kata:${r.id}`,
  };
}

/** 別例: 1つの文がどのまとまりに入るかを選ぶ。[文, 正しい番号, [誤りの番号, 誤概念][]] */
const KATA_ALT: [string, number, [number, string][]][] = [
  [
    'インタビューしたパン屋《や》の人《ひと》は、毎朝《まいあさ》五時《ごじ》にパンをやき始《はじ》めると話《はな》していました。',
    2,
    [
      [3, 'fact-opinion'],
      [1, 'method-reason'],
    ],
  ],
  [
    '市《し》の図書館《としょかん》で、こん虫《ちゅう》の本《ほん》を三《さん》さつ読《よ》みました。',
    1,
    [
      [0, 'method-reason'],
      [2, 'method-reason'],
    ],
  ],
  [
    'わたしは、地《ち》いきの人《ひと》にもっと公園《こうえん》を使《つか》ってほしいと考《かんが》えました。',
    3,
    [
      [2, 'fact-opinion'],
      [0, 'method-reason'],
    ],
  ],
];

function kataAlt([s, ok, wrongs]: (typeof KATA_ALT)[number], i: number): ChoiceItem {
  return {
    engine: 'choice',
    id: `kata-alt:${i}`,
    objective: 'kata',
    level: 0,
    alt: true,
    prompt: 'この文《ぶん》は、ほうこくのどのまとまりに入《い》れるとよいですか。',
    figure: { kind: 'text', text: s, size: 'm' },
    options: opts(
      PARTS[ok]!,
      wrongs.map(([w, m]) => [PARTS[w]!, m] as const),
    ),
    hints: [
      'この文《ぶん》は、きっかけ・調《しら》べ方《かた》・分《わ》かったこと・考《かんが》えたことのどれを書《か》いているかな。',
      '「どうやって調《しら》べたか」なのか、「調《しら》べて何《なに》が分《わ》かったか」なのかを考《かんが》えよう。',
      '文《ぶん》の終《お》わりの言葉《ことば》（〜ました・〜そうです・〜と考《かんが》えました）に目《め》をつけよう。',
    ],
    explain: `この文《ぶん》は「${PARTS[ok]}」に入《い》ります。`,
    identity: `kata-alt:${i}`,
  };
}

// ---- 2. だんらくの順 ----
function junItem(r: Report): OrderItem {
  return {
    engine: 'order',
    id: `jun:${r.id}`,
    objective: 'jun',
    level: 1,
    layout: 'column',
    prompt: `「${r.title}」のほうこくのだんらくを、正《ただ》しいじゅんにならべよう。`,
    cards: [r.kikkake, r.shirabe, r.wakatta, r.kangae].map((label) => ({ label })),
    ends: ['はじめ', 'おわり'],
    reverseMisconception: 'report-order',
    wrongOrders: [
      { order: [0, 2, 1, 3], misconception: 'report-order' },
      { order: [0, 1, 3, 2], misconception: 'fact-opinion' },
      { order: [1, 0, 2, 3], misconception: 'method-reason' },
    ],
    hints: [
      'ほうこくは、「なぜ調《しら》べたか」から書《か》き始《はじ》めるよ。',
      'どうやって調《しら》べたかを書《か》いてから、分《わ》かったことを書《か》くよ。',
      '自分《じぶん》の考《かんが》えは、分《わ》かったことのあと、さいごに書《か》くよ。',
    ],
    explain: 'きっかけ→調《しら》べ方《かた》→分《わ》かったこと→考《かんが》えたこと。',
    identity: `jun:${r.id}`,
  };
}

/** 別例: 次に書くまとまりを選ぶ */
function junAlt(i: number): ChoiceItem {
  const next = i + 1;
  const wrongs = [0, 1, 2, 3]
    .filter((k) => k !== i && k !== next)
    .map((k) => [PARTS[k]!, 'report-order'] as const);
  return {
    engine: 'choice',
    id: `jun-alt:${i}`,
    objective: 'jun',
    level: 1,
    alt: true,
    prompt: `ほうこくで「${PARTS[i]}」のだんらくの次《つぎ》に書《か》くだんらくはどれ？`,
    options: opts(PARTS[next]!, wrongs),
    hints: [
      'ほうこくの四《よっ》つのまとまりのじゅんを思《おも》い出《だ》そう。',
      'はじめはきっかけ、さいごは自分《じぶん》の考《かんが》えだよ。',
      '調《しら》べた中身《なかみ》は、調《しら》べ方《かた》のあとに書《か》くよ。',
    ],
    explain: `「${PARTS[i]}」の次《つぎ》は「${PARTS[next]}」です。きっかけ → 調《しら》べ方《かた》 → 分《わ》かったこと → 考《かんが》えたことのじゅんに書《か》きます。`,
    identity: `jun-alt:${i}`,
  };
}

// ---- 3. 引用を入れる ----
interface Book {
  id: string;
  /** 本の名前（5字ほどまで） */
  name: string;
  year: number;
  /** 本の文（「 」の中に入れる。末尾の句点なし。11字ほどまで） */
  quote: string;
  /** 自分の言葉で変えてしまった文 */
  changed: string;
}

// 選択肢は 1つ 28字ほどまで（2行。4つが 2×2 で作業領域に入る。text-layout-fixes 第4回）。
// 出典は本の名前と発行年を（ ）に書く。書いた人・出ぱん社まで書く練習は info-compare の出典の問題で行う。
const BOOKS: Book[] = [
  {
    id: 'ari',
    name: '虫《むし》のひみつ',
    year: 2023,
    quote: 'アリは重《おも》い物《もの》を運《はこ》べる',
    changed: 'アリは力《ちから》もちだ',
  },
  {
    id: 'kumo',
    name: '雲《くも》のずかん',
    year: 2021,
    quote: '雲《くも》は水《みず》や氷《こおり》のつぶだ',
    changed: '雲《くも》は水《みず》でできている',
  },
  {
    id: 'cha',
    name: 'お茶《ちゃ》の本《ほん》',
    year: 2020,
    quote: '茶《ちゃ》の木《き》は雨《あめ》の多《おお》い所《ところ》で育《そだ》つ',
    changed: '茶《ちゃ》の木《き》は雨《あめ》がすきだ',
  },
  {
    id: 'tako',
    name: '海《うみ》の生《い》き物《もの》',
    year: 2022,
    quote: 'タコは体《からだ》の色《いろ》をかえる',
    changed: 'タコは色《いろ》をかえるのが好《す》きだ',
  },
  {
    id: 'hoshi',
    name: '星《ほし》の本《ほん》',
    year: 2019,
    quote: '星《ほし》は明《あか》るさがちがう',
    changed: '星《ほし》はみんなきれいだ',
  },
  {
    id: 'kyuri',
    name: '野菜《やさい》の本《ほん》',
    year: 2024,
    quote: 'キュウリは上《うえ》へのびる',
    changed: 'キュウリはのぼるのが好《す》きだ',
  },
  {
    id: 'gomi',
    name: 'ごみのゆくえ',
    year: 2022,
    quote: 'ごみは分《わ》ければ使《つか》える',
    changed: 'ごみは分《わ》けたほうがよい',
  },
  {
    id: 'hakucho',
    name: 'わたり鳥《どり》',
    year: 2021,
    quote: 'ハクチョウは冬《ふゆ》に来《く》る',
    changed: 'ハクチョウは冬《ふゆ》がすきだ',
  },
];

/** 出典（本の名前と発行年）。引用のあとの（ ）に書く */
const src = (b: Book) => `（『${b.name}』${b.year}年《ねん》）`;

// 本の情報の表は置かず、本の名前・発行年・本の文を問題文に入れる（表があると選択肢が作業領域に入らない）。
function inyouItem(b: Book): ChoiceItem {
  return {
    engine: 'choice',
    id: `inyou:${b.id}`,
    objective: 'inyou',
    level: 2,
    prompt: `『${b.name}』（${b.year}年《ねん》）の「${b.quote}。」という文《ぶん》を、出典《しゅってん》といっしょにほうこくに引用《いんよう》します。正《ただ》しい書《か》き方《かた》はどれ？`,
    options: opts(`「${b.quote}」${src(b)}`, [
      [`${b.quote}${src(b)}`, 'quote-no-kagi'],
      [`「${b.changed}」${src(b)}`, 'quote-changed'],
      [`「${b.quote}」`, 'source-missing'],
    ]),
    hints: [
      '引用《いんよう》するときに大切《たいせつ》なことは三《みっ》つ。かぎ（「 」）、本《ほん》の言葉《ことば》のまま、出典《しゅってん》だよ。',
      '「 」の中《なか》が、本《ほん》の文《ぶん》と一字《いちじ》もちがわないかくらべよう。',
      '本《ほん》の名前《なまえ》と発行年《はっこうねん》が（ ）に書《か》いてあるかも見《み》よう。',
    ],
    explain: `本《ほん》の言葉《ことば》をそのまま「 」に入《い》れ、${src(b)}と出典《しゅってん》も書《か》きます。`,
    identity: `inyou:${b.id}`,
  };
}

/** 別例: 文の空欄に引用を入れる */
const INYOU_ALT: { id: string; name: string; quote: string; changed: string }[] = [
  {
    id: 'toshokan',
    name: '町《まち》の図書館《としょかん》ものがたり',
    quote: '本《ほん》は、だれでもかりることができる',
    changed: '図書館《としょかん》はとてもべんりだ',
  },
  {
    id: 'kaeru',
    name: 'カエルのくらし',
    quote: 'おたまじゃくしは、えらでいきをする',
    changed: 'おたまじゃくしは水《みず》がすきだ',
  },
  {
    id: 'satou',
    name: 'さとうのふしぎ',
    quote: 'さとうは、水《みず》にとけてもなくならない',
    changed: 'さとうは水《みず》にとけて消《き》えてしまう',
  },
];

function inyouAlt(a: (typeof INYOU_ALT)[number]): FillItem {
  const ok = `「${a.quote}」`;
  return {
    engine: 'fill',
    id: `inyou-alt:${a.id}`,
    objective: 'inyou',
    level: 2,
    alt: true,
    // 本の文は「 」を付けずに見せる（問題文に正答の形がそのまま出ないように）
    prompt: `本《ほん》の文《ぶん》（${a.quote}。）を、ほうこくに引用《いんよう》します。{{}}に入《い》るものをえらぼう。`,
    text: `『${a.name}』には、{{}}と書《か》かれています。`,
    options: [ok, a.quote, `「${a.changed}」`],
    blanks: [
      {
        answers: [ok],
        wrong: [
          { value: a.quote, misconception: 'quote-no-kagi' },
          { value: `「${a.changed}」`, misconception: 'quote-changed' },
        ],
      },
    ],
    hints: [
      '引用《いんよう》は、本《ほん》の言葉《ことば》だと分《わ》かるように書《か》くよ。',
      '本《ほん》の言葉《ことば》は、かぎ（「 」）でかこむよ。',
      '「 」の中《なか》は、本《ほん》の文《ぶん》のまま書《か》くよ。',
    ],
    explain: `『${a.name}』には、${ok}と書《か》かれています。本《ほん》の言葉《ことば》をそのまま「 」でかこみます。`,
    identity: `inyou-alt:${a.id}`,
  };
}

// ---- 4. かいてみよう（採点しない） ----
const KAKU: { id: string; title: string; hint: string }[] = [
  {
    id: 'ikimono',
    title: '家《いえ》の近《ちか》くの生《い》き物《もの》',
    hint: 'どんな生《い》き物《もの》を見《み》かけるかな',
  },
  {
    id: 'gakkou',
    title: '学校《がっこう》のひみつ',
    hint: '学校《がっこう》でふしぎに思《おも》うことはあるかな',
  },
  {
    id: 'shigoto',
    title: '家族《かぞく》の仕事《しごと》',
    hint: 'だれに話《はなし》を聞《き》いてみたいかな',
  },
];

function kakuItem(k: (typeof KAKU)[number]): ExplainItem {
  return {
    engine: 'explain',
    id: `kaku:${k.id}`,
    objective: 'kata',
    level: 2,
    prompt: `「${k.title}」について調《しら》べて、きっかけ・調《しら》べ方《かた》・分《わ》かったこと・考《かんが》えたことのじゅんに書《か》いてみよう。`,
    canvas: { aspect: 4 / 3, guide: 'lines', colors: false },
    require: { drawing: true },
    hints: [
      `はじめに、なぜ調《しら》べたいか（きっかけ）を書《か》こう。${k.hint}。`,
      '次《つぎ》に、どうやって調《しら》べたか、何《なに》が分《わ》かったかを書《か》こう。本《ほん》の言葉《ことば》を使《つか》うときは「 」と出典《しゅってん》をわすれずに。',
      'さいごに、分《わ》かったことから考《かんが》えたことを書《か》こう。',
    ],
    explain:
      '書《か》けたね。分《わ》かったこと（事実《じじつ》）と考《かんが》えたこと（自分《じぶん》の考《かんが》え）が分《わ》けて書《か》けているか、読《よ》み返《かえ》してみよう。',
    identity: `kaku:${k.id}`,
  };
}

const items: Item[] = [
  ...REPORTS.map(kataItem),
  ...KATA_ALT.map(kataAlt),
  ...REPORTS.map(junItem),
  ...[0, 1, 2].map(junAlt),
  ...BOOKS.map(inyouItem),
  ...INYOU_ALT.map(inyouAlt),
  ...KAKU.map(kakuItem),
];

export const writeReport: UnitSpec = {
  id: 'g4.ja.write-report',
  title: '調《しら》べたことのほうこく',
  stage: 'g4',
  subject: 'ja',
  domain: 'kaku',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'notebook',
  prereq: ['g3.ja.write-reasons'],
  objectives: [
    { id: 'kata', title: 'ほうこくの四《よっ》つのまとまりに分《わ》ける' },
    { id: 'jun', title: 'ほうこくのだんらくをじゅんにならべる' },
    { id: 'inyou', title: '「 」と出典《しゅってん》をつけて引用《いんよう》する' },
  ],
  misconceptions: [
    {
      id: 'fact-opinion',
      explain:
        '分《わ》かったことと考《かんが》えたことを取《と》りちがえたのかな。調《しら》べて分《わ》かった事実《じじつ》は「分《わ》かったこと」、それをもとに自分《じぶん》が思《おも》ったことは「考《かんが》えたこと」だよ。「〜と考《かんが》えます」「〜と思《おも》います」に目《め》をつけよう。',
    },
    {
      id: 'method-reason',
      explain:
        'きっかけ・調《しら》べ方《かた》・分《わ》かったことを取《と》りちがえたのかな。きっかけは「なぜ調《しら》べたか」、調《しら》べ方《かた》は「どうやって調《しら》べたか」、分《わ》かったことは「調《しら》べて何《なに》が分《わ》かったか」だよ。',
    },
    {
      id: 'report-order',
      explain:
        'だんらくのじゅんをまちがえたのかな。ほうこくは、きっかけ → 調《しら》べ方《かた》 → 分《わ》かったこと → 考《かんが》えたことのじゅんに書《か》くと分《わ》かりやすいよ。',
    },
    {
      id: 'quote-no-kagi',
      explain:
        'かぎ（「 」）をつけなかったのかな。本《ほん》の言葉《ことば》を使《つか》うときは「 」でかこんで、自分《じぶん》の言葉《ことば》と分《わ》けるよ。',
    },
    {
      id: 'quote-changed',
      explain:
        '「 」の中《なか》を自分《じぶん》の言葉《ことば》にかえたのかな。「 」の中《なか》は、本《ほん》に書《か》いてあるとおりに書《か》くよ。',
    },
    {
      id: 'source-missing',
      explain:
        '出典《しゅってん》を書《か》かなかったのかな。引用《いんよう》したときは、本《ほん》の名前《なまえ》・書《か》いた人《ひと》・出《しゅっ》ぱん社《しゃ》・発行年《はっこうねん》を書《か》いて、どこから引用《いんよう》したか分《わ》かるようにするよ。',
    },
  ],
  levels: [
    { label: 'ほうこくの型', chance: 0.05 },
    { label: 'だんらくのじゅん', chance: 0.05 },
    { label: '引用・かいてみよう', chance: 0.05 },
  ],
  intro: [
    {
      text: '調《しら》べたことをほうこくするときは、四《よっ》つのまとまりで書《か》くと分《わ》かりやすくなります。',
      figure: {
        kind: 'text',
        text: 'きっかけ → 調《しら》べ方《かた》 → 分《わ》かったこと → 考《かんが》えたこと',
        size: 'm',
      },
    },
    {
      text: '「分《わ》かったこと」には調《しら》べた事実《じじつ》を、「考《かんが》えたこと」にはそれをもとにした自分《じぶん》の考《かんが》えを書《か》きます。',
    },
    {
      text: '本《ほん》の言葉《ことば》を使《つか》うときは、そのまま「 」でかこみ、本《ほん》の名前《なまえ》・書《か》いた人《ひと》・出《しゅっ》ぱん社《しゃ》・発行年《はっこうねん》（出典《しゅってん》）を書《か》きます。',
    },
  ],
  source: { kind: 'items', items },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）国語第3学年及び第4学年 B 書くこと(1)イ（内容のまとまりで段落をつくったり、段落相互の関係に注意したりして、文章の構成を考えること）、(2)ア（調べたことをまとめて報告するなど、事実やそれを基に考えたことを書く活動）、知識及び技能(2)イ（引用の仕方や出典の示し方）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
