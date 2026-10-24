/**
 * g2.ja.write-structure はじめ・なか・おわり（curriculum-matrix 3.5）。
 * 文カードを3部に分ける → つなぎ言葉を入れる → 読み返して誤りを見つける →「かいてみよう」（採点しない）。
 * 文章はすべて本アプリのオリジナル。
 *
 * 同一性キー: 文章（題）・つなぎの文・見直しの文・書く題ごと。
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

// ---- 1. はじめ・なか・おわり に わける ----
interface Essay {
  id: string;
  title: string;
  start: string;
  middle: [string, string, string];
  end: string;
}
const ESSAYS: Essay[] = [
  {
    id: 'undoukai',
    title: 'うんどうかい',
    start: 'きのう、うんどうかいが ありました。',
    middle: [
      'つなひきで あかぐみが かちました。',
      'わたしは かけっこで 二《に》ばんでした。',
      'おべんとうを みんなで たべました。',
    ],
    end: 'らいねんは 一《いち》ばんに なりたいです。',
  },
  {
    id: 'asagao',
    title: 'あさがおの かんさつ',
    start: 'あさがおの かんさつを しました。',
    middle: [
      'はっぱが 五《ご》まいに なりました。',
      'つるが ぼうに まきついて いました。',
      'つぼみが 一《ひと》つ ありました。',
    ],
    end: 'はやく 花《はな》が さいて ほしいです。',
  },
  {
    id: 'inu',
    title: 'ぼくの いぬ',
    start: 'ぼくの いえには、いぬの ポチが います。',
    middle: [
      'ポチは しろくて ふわふわです。',
      'さんぽが だいすきです。',
      'ボールを なげると とって きます。',
    ],
    end: 'ポチは ぼくの たいせつな かぞくです。',
  },
  {
    id: 'ensoku',
    title: 'えんそく',
    start: 'えんそくで 山《やま》に のぼりました。',
    middle: [
      'とちゅうで りすを 見《み》ました。',
      'ちょうじょうで おにぎりを たべました。',
      'かえりは あしが いたく なりました。',
    ],
    end: 'つかれたけれど、たのしい 一日《いちにち》でした。',
  },
  {
    id: 'cookie',
    title: 'クッキーづくり',
    start: 'おとうさんと クッキーを やきました。',
    middle: [
      'こむぎこと バターを まぜました。',
      'ほしの かたちに ぬきました。',
      'オーブンで やきました。',
    ],
    end: 'みんなが おいしいと いって くれて、うれしかったです。',
  },
  {
    id: 'toshokan',
    title: 'としょかんの しょうかい',
    start: 'がっこうの としょかんを しょうかいします。',
    middle: [
      'えほんが たくさん あります。',
      'まどの そばに、すわって よめる いすが あります。',
      '一《いっ》かいに 二《に》さつ かりられます。',
    ],
    end: 'みなさんも ぜひ つかって ください。',
  },
];
const PARTS = ['はじめ', 'なか', 'おわり'];

function kouseiItem(e: Essay): SortItem {
  return {
    engine: 'sort',
    id: `kousei:${e.id}`,
    objective: 'kousei',
    level: 0,
    prompt: `「${e.title}」の ぶんを、はじめ・なか・おわりに わけよう。`,
    boxes: PARTS.map((label) => ({ label })),
    cards: [
      { label: e.start, box: 0, wrongBoxes: [{ box: 2, misconception: 'start-end-swap' }] },
      ...e.middle.map((label) => ({
        label,
        box: 1,
        wrongBoxes: [{ box: 0, misconception: 'detail-as-start' }],
      })),
      {
        label: e.end,
        box: 2,
        wrongBoxes: [
          { box: 0, misconception: 'start-end-swap' },
          { box: 1, misconception: 'feeling-as-middle' },
        ],
      },
    ],
    hints: [
      'はじめは「なにに ついて かくか」を しらせる ぶんだよ。',
      'なかは、した ことや ようすを くわしく かく ぶんだよ。',
      'おわりは、おもった ことや まとめを かく ぶんだよ。',
    ],
    explain: `はじめは「${e.start}」、おわりは「${e.end}」。のこりの 三《みっ》つは くわしく かいた なかの ぶんです。`,
    identity: `kousei:${e.id}`,
  };
}

/** 別例: 4枚を順に並べる */
const ORDER_ALT: { id: string; title: string; cards: string[]; alsoAccept?: number[][] }[] = [
  {
    id: 'pool',
    title: 'はじめての プール',
    cards: [
      'はじめて プールで およぎました。',
      'さいしょは 水《みず》が こわかったです。',
      '先生《せんせい》に おしえて もらって、かおを つけられました。',
      'つぎは 五《ご》メートル およぎたいです。',
    ],
  },
  {
    id: 'nawatobi',
    title: 'なわとび',
    cards: [
      'なわとびの れんしゅうを しました。',
      'はじめは 十《じゅっ》かいしか とべませんでした。',
      'まいにち つづけて、三十《さんじゅっ》かい とべるように なりました。',
      'これからも がんばりたいです。',
    ],
  },
  {
    id: 'otetsudai',
    title: 'おてつだい',
    cards: [
      'にちようびに おてつだいを しました。',
      'おふろを あらいました。',
      'げんかんの くつも ならべました。',
      'かぞくに ほめられて、うれしかったです。',
    ],
    alsoAccept: [[0, 2, 1, 3]],
  },
];

function orderAlt(a: (typeof ORDER_ALT)[number]): OrderItem {
  return {
    engine: 'order',
    id: `kousei-alt:${a.id}`,
    objective: 'kousei',
    level: 0,
    alt: true,
    layout: 'column',
    prompt: `「${a.title}」の ぶんを、はじめ・なか・おわりの じゅんに ならべよう。`,
    cards: a.cards.map((label) => ({ label })),
    ...(a.alsoAccept ? { alsoAccept: a.alsoAccept } : {}),
    ends: ['はじめ', 'おわり'],
    reverseMisconception: 'start-end-swap',
    wrongOrders: [{ order: [3, 0, 1, 2], misconception: 'start-end-swap' }],
    hints: [
      'なにに ついて かくかを しらせる ぶんを さがそう。',
      'なかは、した じゅんに ならべよう。',
      'おもった ことや これからの ことは さいごだよ。',
    ],
    explain: `「${a.cards[0]}」で はじめ、「${a.cards[3]}」で おわります。`,
    identity: `kousei-alt:${a.id}`,
  };
}

// ---- 2. つなぎ ことば ----
/** [文, 正解, 誤り1, 誤概念1, 誤り2, 誤概念2] */
const TSUNAGI: [string, string, string, string, string, string][] = [
  [
    'あめが ふって きました。{{}}、かさを さしました。',
    'だから',
    'でも',
    'conj-reverse',
    'さいごに',
    'conj-order',
  ],
  [
    'いっしょうけんめい はしりました。{{}}、まけて しまいました。',
    'でも',
    'だから',
    'conj-reverse',
    'まず',
    'conj-order',
  ],
  [
    'あさ、かおを あらいました。{{}}、ごはんを たべました。さいごに、はを みがきました。',
    'それから',
    'でも',
    'conj-reverse',
    'さいごに',
    'conj-order',
  ],
  [
    '{{}}、こむぎこを ボウルに いれます。つぎに、たまごを いれます。',
    'まず',
    'さいごに',
    'conj-order',
    'でも',
    'conj-reverse',
  ],
  [
    'まず、たねを まきます。{{}}、水《みず》を やります。さいごに、ひなたに おきます。',
    'つぎに',
    'さいごに',
    'conj-order',
    'でも',
    'conj-reverse',
  ],
  [
    'まず、えを かきます。つぎに、いろを ぬります。{{}}、なまえを かきます。',
    'さいごに',
    'まず',
    'conj-order',
    'でも',
    'conj-reverse',
  ],
  [
    'おなかが すいて いました。{{}}、おにぎりを 三《みっ》つ たべました。',
    'だから',
    'でも',
    'conj-reverse',
    'まず',
    'conj-order',
  ],
  [
    'こうえんへ いきました。{{}}、だれも いませんでした。',
    'でも',
    'だから',
    'conj-reverse',
    'つぎに',
    'conj-order',
  ],
];

function tsunagiItem([t, ok, w1, m1, w2, m2]: (typeof TSUNAGI)[number], i: number): FillItem {
  const order = ['まず', 'つぎに', 'さいごに', 'それから'].includes(ok);
  return {
    engine: 'fill',
    id: `tsunagi:${i}`,
    objective: 'tsunagi',
    level: 1,
    prompt: 'あいて いる ところに はいる つなぎ ことばを えらぼう。',
    text: t,
    options: [ok, w1, w2],
    blanks: [
      {
        answers: [ok],
        wrong: [
          { value: w1, misconception: m1 },
          { value: w2, misconception: m2 },
        ],
      },
    ],
    hints: [
      'まえの ぶんと あとの ぶんの つながりを かんがえよう。',
      order
        ? 'する ことの じゅんばんを あらわす ことばが はいるよ。'
        : 'あとの ぶんは、まえの ぶんから おもった とおりかな、ちがうかな。',
      order
        ? 'いくつめに する ことかを たしかめよう。'
        : 'おもった とおりなら「だから」、ちがう ことが おきたら「でも」の なかまだよ。',
    ],
    explain: `${t.replace('{{}}', `**${ok}**`)}「${ok}」で つなぐと、ながれが よく わかります。`,
    identity: `tsunagi:${t}`,
  };
}

/** 別例: つながりのよい文章を選ぶ */
const TSUNAGI_ALT: [string, string, string][] = [
  [
    'ねつが でました。だから、がっこうを やすみました。',
    'ねつが でました。でも、がっこうを やすみました。',
    'ねつが でました。さいごに、がっこうを やすみました。',
  ],
  [
    'しゅくだいを しました。それから、こうえんで あそびました。',
    'しゅくだいを しました。でも、こうえんで あそびました。',
    'しゅくだいを しました。まず、こうえんで あそびました。',
  ],
  [
    'たくさん れんしゅうしました。でも、うまく いきませんでした。',
    'たくさん れんしゅうしました。だから、うまく いきませんでした。',
    'たくさん れんしゅうしました。まず、うまく いきませんでした。',
  ],
];

function tsunagiAlt([ok, w1, w2]: (typeof TSUNAGI_ALT)[number], i: number): ChoiceItem {
  return {
    engine: 'choice',
    id: `tsunagi-alt:${i}`,
    objective: 'tsunagi',
    level: 1,
    alt: true,
    layout: 'column',
    prompt: 'つなぎ ことばが いちばん あって いる ものは どれ？',
    options: opts(ok, [
      [w1, 'conj-reverse'],
      [w2, 'conj-order'],
    ]),
    hints: [
      'まえの ぶんと あとの ぶんは、どんな つながりかな。',
      'おもった とおりか、ちがうか、じゅんばんか を かんがえよう。',
      'つなぎ ことばを こえに だして よみくらべよう。',
    ],
    explain: `「${ok}」が しぜんな つながりです。`,
    identity: `tsunagi-alt:${i}`,
  };
}

// ---- 3. よみかえして まちがいを みつける ----
/** [文, 誤りの文節, 正しい書き方, 正しい文節1, 誤概念1, 正しい文節2, 誤概念2] */
const MINAOSHI: [string, string, string, string, string, string, string][] = [
  [
    'わたしわ がっこうへ ほんを もって いきました。',
    'わたしわ',
    'わたしは',
    'がっこうへ',
    'he-is-right',
    'ほんを',
    'wo-is-right',
  ],
  [
    'ぼくは こうえんえ ボールを もって いった。',
    'こうえんえ',
    'こうえんへ',
    'ぼくは',
    'ha-is-right',
    'ボールを',
    'wo-is-right',
  ],
  [
    'あねは にわへ でて、はなお そだてた。',
    'はなお',
    'はなを',
    'あねは',
    'ha-is-right',
    'にわへ',
    'he-is-right',
  ],
  [
    'ぼくは がこうへ ほんを かえしに いった。',
    'がこうへ',
    'がっこうへ',
    'ぼくは',
    'ha-is-right',
    'ほんを',
    'wo-is-right',
  ],
  [
    'おとおさんは えきへ かさを もって いった。',
    'おとおさんは',
    'おとうさんは',
    'えきへ',
    'he-is-right',
    'かさを',
    'wo-is-right',
  ],
  [
    'いもうとは しゆくだいを もって へやへ いった。',
    'しゆくだいを',
    'しゅくだいを',
    'いもうとは',
    'ha-is-right',
    'へやへ',
    'he-is-right',
  ],
  [
    'ともだちわ ゲームを もって ぼくの いえへ きた。',
    'ともだちわ',
    'ともだちは',
    'ゲームを',
    'wo-is-right',
    'いえへ',
    'he-is-right',
  ],
];

function minaoshiItem([s, bad, fixed, c1, m1, c2, m2]: (typeof MINAOSHI)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `minaoshi:${bad}`,
    objective: 'minaoshi',
    level: 2,
    prompt: `よみかえして みよう。\n「${s}」\nかきかたが まちがって いる ところは どれ？`,
    options: opts(bad, [
      [c1, m1],
      [c2, m2],
    ]),
    hints: [
      'ひとつずつ、こえに だして よんで みよう。',
      'ことばと ことばを つなぐ「は・へ・を」や、のばす おと・ちいさい じに ちゅうい しよう。',
      'きこえる とおりに かいては いけない ところが あるよ。',
    ],
    explain: `「${bad}」は「${fixed}」と かくのが ただしいです。`,
    identity: `minaoshi:${s}`,
  };
}

/** 別例: 直して入れる。[説明, 文, 正解, 誤り, 誤概念] */
const MINAOSHI_ALT: [string, string, string, string, string][] = [
  ['「ほんお よむ」を なおそう。', 'ほん{{}} よむ。', 'を', 'お', 'o-for-wo'],
  ['「わたしわ うたう」を なおそう。', 'わたし{{}} うたう。', 'は', 'わ', 'wa-for-ha'],
  ['「きつぷを かう」を なおそう。', 'き{{}}ぷを かう。', 'っ', 'つ', 'big-tsu'],
];

function minaoshiAlt([p, t, ok, bad, mis]: (typeof MINAOSHI_ALT)[number]): FillItem {
  return {
    engine: 'fill',
    id: `minaoshi-alt:${t}`,
    objective: 'minaoshi',
    level: 2,
    alt: true,
    prompt: `${p} あいて いる ところに はいる じを えらぼう。`,
    text: t,
    options: [ok, bad],
    blanks: [{ answers: [ok], wrong: [{ value: bad, misconception: mis }] }],
    hints: [
      'こえに だして よんで みよう。',
      ok === 'っ' ? 'つまる おとは どう かくかな。' : 'ことばと ことばを つなぐ ところだね。',
      ok === 'っ'
        ? 'つまる おとは ちいさく かくよ。'
        : 'つなぐ ところは、きこえる おとと ちがう じで かくよ。',
    ],
    explain: `${t.replace('{{}}', `**${ok}**`)} と かきます。`,
    identity: `minaoshi-alt:${t}`,
  };
}

// ---- 4. かいてみよう（採点しない） ----
const KAKU: [string, string][] = [
  ['すきな あそび', 'なにで あそぶのが すきかな'],
  ['がっこうで たのしかった こと', 'いつ、どこで、なにを したかな'],
  ['かぞくの こと', 'だれの ことを かこうかな'],
  ['やすみの 日《ひ》に した こと', 'どこへ いったかな'],
  ['すきな たべもの', 'どんな あじ、どんな かたちかな'],
  ['がんばった こと', 'どんな ふうに れんしゅう したかな'],
];

function kakuItem([title, q]: [string, string]): ExplainItem {
  return {
    engine: 'explain',
    id: `kaku:${title}`,
    objective: 'kaku',
    level: 2,
    prompt: `「${title}」に ついて、はじめ・なか・おわりに わけて かいてみよう。`,
    canvas: { aspect: 4 / 3, guide: 'lines', colors: false },
    require: { drawing: true },
    hints: [
      `はじめに、${q}。`,
      'なかに、した ことや ようすを くわしく かこう。',
      'おわりに、おもった ことを かこう。みじかくて いいよ。',
    ],
    explain:
      'かけたね。はじめ・なか・おわりに なって いるか、よみかえして みよう。おうちの 人《ひと》にも よんで もらおう。',
    identity: `kaku:${title}`,
  };
}

/** 別例: なかに書く事がらを選んでから書く */
const KAKU_ALT: { title: string; reasons: string[] }[] = [
  {
    title: 'すきな きせつ',
    reasons: ['その きせつに する あそび', 'その きせつの たべもの', 'その きせつの けしき'],
  },
  { title: 'すきな どうぶつ', reasons: ['かたちや いろ', 'たべる もの', 'なきごえや うごき'] },
  { title: 'たからもの', reasons: ['どこで てに いれたか', 'どんな かたちか', 'どう つかうか'] },
];

function kakuAlt(a: (typeof KAKU_ALT)[number]): ExplainItem {
  return {
    engine: 'explain',
    id: `kaku-alt:${a.title}`,
    objective: 'kaku',
    level: 2,
    alt: true,
    prompt: `「${a.title}」に ついて かこう。まず「なか」に かく ことを えらんで、それから かいてみよう。`,
    reasons: a.reasons.map((label) => ({ label })),
    multiReasons: true,
    canvas: { aspect: 4 / 3, guide: 'lines', colors: false },
    require: { reason: true, drawing: true },
    hints: [
      'なかに かく ことを ふたつ くらい えらぼう。',
      'えらんだ じゅんに、なかの ぶんを かこう。',
      'はじめと おわりの ぶんも わすれずに。',
    ],
    explain: 'かけたね。えらんだ ことが「なか」に かけて いるか、よみかえして みよう。',
    identity: `kaku-alt:${a.title}`,
  };
}

const items: Item[] = [
  ...ESSAYS.map(kouseiItem),
  ...ORDER_ALT.map(orderAlt),
  ...TSUNAGI.map(tsunagiItem),
  ...TSUNAGI_ALT.map(tsunagiAlt),
  ...MINAOSHI.map(minaoshiItem),
  ...MINAOSHI_ALT.map(minaoshiAlt),
  ...KAKU.map(kakuItem),
  ...KAKU_ALT.map(kakuAlt),
];

export const writeStructure: UnitSpec = {
  id: 'g2.ja.write-structure',
  title: 'はじめ・なか・おわり',
  stage: 'g2',
  subject: 'ja',
  domain: 'kaku',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'notebook',
  prereq: ['g1.ja.write-order'],
  objectives: [
    { id: 'kousei', title: 'はじめ・なか・おわりに わける' },
    { id: 'tsunagi', title: 'つなぎ ことばを つかう' },
    { id: 'minaoshi', title: 'よみかえして まちがいを なおす' },
    { id: 'kaku', title: 'かいてみよう' },
  ],
  misconceptions: [
    {
      id: 'start-end-swap',
      explain:
        'はじめと おわりを いれかえたのかな。はじめは「なにに ついて かくか」、おわりは「おもった こと・まとめ」だよ。',
    },
    {
      id: 'detail-as-start',
      explain:
        'くわしい ことを はじめに いれたのかな。くわしい ようすや した ことは「なか」に かくよ。',
    },
    {
      id: 'feeling-as-middle',
      explain:
        'おもった ことを なかに いれたのかな。「〜たいです」「うれしかったです」の ような きもちや まとめは「おわり」に かくよ。',
    },
    {
      id: 'conj-reverse',
      explain:
        'つながりを はんたいに かんがえたのかな。おもった とおりに つながる ときは「だから」「それから」、ちがう ことが おきる ときは「でも」だよ。',
    },
    {
      id: 'conj-order',
      explain:
        'じゅんばんの ことばを えらんだのかな。「まず」「つぎに」「さいごに」は する ことの じゅんばんを あらわすよ。',
    },
    {
      id: 'ha-is-right',
      explain:
        '「〜は」を まちがいと おもったのかな。つなぐ ところの「わ」の おとは「は」と かくので、ただしいよ。',
    },
    {
      id: 'he-is-right',
      explain:
        '「〜へ」を まちがいと おもったのかな。いく さきを あらわす「え」の おとは「へ」と かくので、ただしいよ。',
    },
    {
      id: 'wo-is-right',
      explain:
        '「〜を」を まちがいと おもったのかな。つなぐ ところの「お」の おとは「を」と かくので、ただしいよ。',
    },
    {
      id: 'wa-for-ha',
      explain:
        'きこえた とおりに「わ」と かいたのかな。「わたしは」の「は」は、「わ」と よむけれど「は」と かくよ。',
    },
    {
      id: 'o-for-wo',
      explain: 'きこえた とおりに「お」と かいたのかな。「ほんを よむ」の「を」は「を」と かくよ。',
    },
    {
      id: 'big-tsu',
      explain: 'おおきい「つ」を えらんだのかな。つまる おとは ちいさい「っ」で かくよ。',
    },
  ],
  levels: [
    { label: 'はじめ・なか・おわり', chance: 0.05 },
    { label: 'つなぎ ことば', chance: 0.05 },
    { label: 'よみかえし・かいてみよう', chance: 0.05 },
  ],
  intro: [
    {
      text: 'ぶんしょうは「はじめ」「なか」「おわり」に わけて かくと、よみやすく なります。',
      figure: { kind: 'text', text: 'はじめ → なか → おわり', size: 'xl' },
    },
    {
      text: 'はじめは なにに ついて かくか。なかは、した ことや ようすを くわしく。おわりは、おもった こと。',
    },
    {
      text: 'かいたら よみかえして、「は・へ・を」や ちいさい じを たしかめます。',
    },
  ],
  source: { kind: 'items', items },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年 B 書くこと(1)イ（自分の思いや考えが明確になるように、事柄の順序に沿って簡単な構成を考えること）・エ（文章を読み返す習慣を付けるとともに、間違いを正したり、語と語や文と文との続き方を確かめたりすること）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
