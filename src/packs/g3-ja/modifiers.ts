/**
 * g3.ja.modifiers くわしく する ことば（修飾語と被修飾語。curriculum-matrix 3.6）。
 * 導→基→応:「どんな」「どのように」の言葉を見つける（choice）→ くわしくする言葉と結ぶ（choice・match）
 * → 修飾語を足して文をくわしくする（fill・build）。
 * 文はすべて本アプリのオリジナル。
 *
 * 到達項目:
 *   find      … 「どんな」「どのように」に あたる 言葉を 見つける（段階0。別例: なかま分け sort）
 *   target    … 修飾語が くわしく する 言葉を 見つける（段階1。別例: 線で むすぶ match）
 *   kuwashiku … 修飾語を 足して 文を くわしく する（段階2。別例: 言葉の タイルで 文を 作る build）
 * 同一性キー: 文 × 問い（同じ文の「どんな」と「どのように」は別の問い）。
 */
import type {
  BuildItem,
  ChoiceItem,
  FillItem,
  Item,
  MatchItem,
  SortItem,
  UnitSpec,
} from '../../curriculum/types';
import { opts, REVISED, type Wrong } from './util';

// ---- 1. 「どんな」「どのように」を 見つける ----
interface Sen {
  id: string;
  /** 主語（くわしく される 名前の 言葉と 別の ときだけ） */
  subj?: string;
  /** 「どんな」の 言葉 */
  nm: string;
  /** くわしく される 名前の 言葉（助詞を 除く） */
  noun: string;
  /** 名前の 言葉の あとの 助詞 */
  pt: string;
  /** 「どのように」の 言葉 */
  am: string;
  /** 動きの 言葉 */
  verb: string;
}

const SENS: Sen[] = [
  {
    id: 'inu',
    nm: '小《ちい》さな',
    noun: '犬《いぬ》',
    pt: 'が',
    am: '元気《げんき》に',
    verb: '走《はし》る',
  },
  { id: 'kumo', nm: '白《しろ》い', noun: '雲《くも》', pt: 'が', am: 'ゆっくり', verb: 'うごく' },
  {
    id: 'boushi',
    subj: '弟《おとうと》が',
    nm: '赤《あか》い',
    noun: 'ぼうし',
    pt: 'を',
    am: 'そっと',
    verb: 'かぶる',
  },
  { id: 'neko', nm: '黒《くろ》い', noun: 'ねこ', pt: 'が', am: 'しずかに', verb: 'ねむる' },
  {
    id: 'tori',
    nm: '大《おお》きな',
    noun: '鳥《とり》',
    pt: 'が',
    am: '高《たか》く',
    verb: 'とぶ',
  },
  {
    id: 'sakana',
    nm: '青《あお》い',
    noun: '魚《さかな》',
    pt: 'が',
    am: 'すいすい',
    verb: '泳《およ》ぐ',
  },
  {
    id: 'hon',
    subj: '兄《あに》が',
    nm: '新《あたら》しい',
    noun: '本《ほん》',
    pt: 'を',
    am: '楽《たの》しそうに',
    verb: '読《よ》む',
  },
  { id: 'kaze', nm: 'つめたい', noun: '風《かぜ》', pt: 'が', am: 'ぴゅうぴゅう', verb: 'ふく' },
  {
    id: 'tsuki',
    nm: 'まるい',
    noun: '月《つき》',
    pt: 'が',
    am: '明《あか》るく',
    verb: '光《ひか》る',
  },
  {
    id: 'densha',
    nm: '長《なが》い',
    noun: '電車《でんしゃ》',
    pt: 'が',
    am: 'ガタゴト',
    verb: '走《はし》る',
  },
  {
    id: 'ha',
    nm: '黄色《きいろ》い',
    noun: '葉《は》',
    pt: 'が',
    am: 'ひらひら',
    verb: '落《お》ちる',
  },
  {
    id: 'nimotsu',
    subj: '姉《あね》が',
    nm: '重《おも》い',
    noun: '荷物《にもつ》',
    pt: 'を',
    am: 'しっかり',
    verb: '持《も》つ',
  },
];

const sentence = (s: Sen) => `${s.subj ?? ''}${s.nm}${s.noun}${s.pt}${s.am}${s.verb}。`;
/** 主語（主語が 名前の 言葉と 同じなら その 言葉） */
const subjOf = (s: Sen) => s.subj ?? `${s.noun}${s.pt}`;

function donnaItem(s: Sen): ChoiceItem {
  const wrongs: Wrong[] = [
    [s.am, 'm-kind'],
    [s.verb, 'm-subj-pred'],
  ];
  if (s.subj) wrongs.push([s.subj, 'm-subj-pred']);
  return {
    engine: 'choice',
    id: `find:donna:${s.id}`,
    objective: 'find',
    level: 0,
    prompt: `つぎの文《ぶん》で、「どんな${s.noun}？」に答《こた》える言葉《ことば》はどれですか。`,
    figure: { kind: 'text', text: sentence(s), size: 'l' },
    options: opts(s.nm, wrongs),
    hints: [
      'もののようす（色《いろ》・形《かたち》・大《おお》きさなど）を表《あらわ》す言葉《ことば》をさがそう。',
      '「どんな」の言葉《ことば》は、ものの名前《なまえ》の言葉《ことば》をくわしくするよ。動《うご》きのようすを表《あらわ》す言葉《ことば》とはちがうよ。',
      `えらびたい言葉《ことば》を「どんな${s.noun}？」の答《こた》えとして言《い》ってみよう。「${s.noun}」のようすを表《あらわ》しているかな。`,
    ],
    explain: `「どんな${s.noun}？」→「${s.nm}${s.noun}」。「${s.nm}」が「${s.noun}」をくわしくしています。「${s.am}」は動《うご》きのようすを表《あらわ》す「どのように」の言葉《ことば》です。`,
    identity: `find:donna:${s.id}`,
  };
}

function doyouniItem(s: Sen): ChoiceItem {
  return {
    engine: 'choice',
    id: `find:doyouni:${s.id}`,
    objective: 'find',
    level: 0,
    prompt: `つぎの文《ぶん》で、「どのように${s.verb}？」に答《こた》える言葉《ことば》はどれですか。`,
    figure: { kind: 'text', text: sentence(s), size: 'l' },
    options: opts(s.am, [
      [s.nm, 'm-kind'],
      [subjOf(s), 'm-subj-pred'],
    ]),
    hints: [
      '動《うご》きのようす（はやさ・やり方《かた》・音《おと》）を表《あらわ》す言葉《ことば》をさがそう。',
      '「どのように」の言葉《ことば》は、動《うご》きの言葉《ことば》の前《まえ》にあることが多《おお》いよ。',
      `「どのように${s.verb}？」と聞《き》いて、答《こた》えになる言葉《ことば》をさがそう。「だれが」に答《こた》える言葉《ことば》ではないよ。`,
    ],
    explain: `「どのように${s.verb}？」→「${s.am}${s.verb}」。「${s.am}」が「${s.verb}」をくわしくしています。「${s.nm}」はもののようすを表《あらわ》す「どんな」の言葉《ことば》です。`,
    identity: `find:doyouni:${s.id}`,
  };
}

/** 別例: 太字の 言葉を「どんな」「どのように」に 分ける */
const SORT_SETS: { id: string; donna: string[]; doyouni: string[] }[] = [
  {
    id: 'a',
    donna: ['**あまい**ケーキ', '**やさしい**先生《せんせい》', '**古《ふる》い**家《いえ》'],
    doyouni: ['**にこにこ**わらう', '**早《はや》く**起《お》きる', '**じっと**見《み》る'],
  },
  {
    id: 'b',
    donna: [
      '**ふかい**池《いけ》',
      '**かわいい**子犬《こいぬ》',
      '**大切《たいせつ》な**手紙《てがみ》',
    ],
    doyouni: ['**すらすら**読《よ》む', '**さっと**にげる', '**大《おお》きく**手《て》をふる'],
  },
  {
    id: 'c',
    donna: ['**きれいな**花《はな》', '**広《ひろ》い**海《うみ》', '**あたたかい**スープ'],
    doyouni: ['**ゆっくり**歩《ある》く', '**ぐっすり**ねむる', '**きれいに**あらう'],
  },
];

/** 「**あまい**ケーキ」の 太字の 部分 */
const boldOf = (d: string) => /\*\*(.+?)\*\*/.exec(d)?.[1] ?? d;

function sortItem(x: (typeof SORT_SETS)[number]): SortItem {
  return {
    engine: 'sort',
    id: `find:sort:${x.id}`,
    objective: 'find',
    level: 0,
    prompt: '太字《ふとじ》の言葉《ことば》を、「どんな」と「どのように」に分《わ》けよう。',
    boxes: [{ label: 'どんな（もののようす）' }, { label: 'どのように（動《うご》きのようす）' }],
    cards: [
      ...x.donna.map((label) => ({
        label,
        box: 0,
        wrongBoxes: [{ box: 1, misconception: 'm-kind' }],
      })),
      ...x.doyouni.map((label) => ({
        label,
        box: 1,
        wrongBoxes: [{ box: 0, misconception: 'm-kind' }],
      })),
    ],
    hints: [
      '太字《ふとじ》の言葉《ことば》が、後《うし》ろのどの言葉《ことば》をくわしくしているか見《み》よう。',
      '後《うし》ろがものの名前《なまえ》なら「どんな」、動《うご》きの言葉《ことば》なら「どのように」だよ。',
      '「〜い」「〜な」で終《お》わる言葉《ことば》は「どんな」、「〜く」「〜に」で終《お》わる言葉《ことば》は「どのように」になることが多《おお》いよ。',
    ],
    explain: `ものの名前《なまえ》をくわしくするのが「どんな」（${x.donna.map(boldOf).join('・')}）、動《うご》きをくわしくするのが「どのように」（${x.doyouni.map(boldOf).join('・')}）です。`,
    identity: `find:sort:${x.id}`,
    alt: true,
  };
}

// ---- 2. くわしく される 言葉を 見つける ----
interface Target {
  id: string;
  text: string;
  mod: string;
  ans: string;
  w: Wrong[];
  h2: string;
  h3: string;
  e: string;
}

const TARGETS: Target[] = [
  {
    id: 'kame',
    text: 'ゆっくり大《おお》きなかめが歩《ある》く。',
    mod: 'ゆっくり',
    ans: '歩《ある》く',
    w: [
      ['大《おお》きな', 'm-near'],
      ['かめが', 'm-subject-first'],
    ],
    h2: '「ゆっくり」は動《うご》きのようすを表《あらわ》す言葉《ことば》だよ。',
    h3: '「ゆっくり大《おお》きな」「ゆっくりかめが」は意味《いみ》が通《つう》じるかな。動《うご》きの言葉《ことば》につけてみよう。',
    e: '「ゆっくり歩《ある》く」とつながります。「ゆっくり」ははなれたところにある「歩《ある》く」をくわしくしています。',
  },
  {
    id: 'kinou',
    text: 'きのう公園《こうえん》で白《しろ》い花《はな》を見《み》た。',
    mod: 'きのう',
    ans: '見《み》た',
    w: [
      ['公園《こうえん》で', 'm-near'],
      ['花《はな》を', 'm-noun-only'],
    ],
    h2: '「きのう」は「いつ」を表《あらわ》す言葉《ことば》だよ。',
    h3: '「いつ○○？」と聞《き》ける言葉《ことば》をさがそう。「いつ花《はな》？」では意味《いみ》が通《つう》じないね。',
    e: '「きのう見《み》た」とつながります。「いつ見《み》たか」をくわしくしています。',
  },
  {
    id: 'totemo',
    text: 'とても大《おお》きな魚《さかな》がつれた。',
    mod: 'とても',
    ans: '大《おお》きな',
    w: [
      ['魚《さかな》が', 'm-noun-only'],
      ['つれた', 'm-skip'],
    ],
    h2: '「とても」は「どのくらい」を表《あらわ》す言葉《ことば》だよ。',
    h3: '「とても魚《さかな》」「とてもつれた」はおかしいね。どのくらいなのかを考《かんが》えよう。',
    e: '「とても大《おお》きな」とつながります。「とても」は、どのくらい大《おお》きいかをくわしくしています。くわしくする言葉《ことば》を、さらにくわしくすることもあります。',
  },
  {
    id: 'asobu',
    text: '友《とも》だちが楽《たの》しそうに公園《こうえん》であそぶ。',
    mod: '楽《たの》しそうに',
    ans: 'あそぶ',
    w: [
      ['公園《こうえん》で', 'm-near'],
      ['友《とも》だちが', 'm-subject-first'],
    ],
    h2: '「楽《たの》しそうに」は「どのように」の言葉《ことば》だよ。',
    h3: '「どのように公園《こうえん》で？」では意味《いみ》が通《つう》じないね。動《うご》きの言葉《ことば》をさがそう。',
    e: '「楽《たの》しそうにあそぶ」とつながります。すぐ後《うし》ろの「公園《こうえん》で」ではありません。',
  },
  {
    id: 'sora',
    text: '青《あお》い空《そら》に白《しろ》い雲《くも》がうかぶ。',
    mod: '青《あお》い',
    ans: '空《そら》に',
    w: [
      ['雲《くも》が', 'm-subject-first'],
      ['うかぶ', 'm-kind'],
    ],
    h2: '「青《あお》い」は「どんな」の言葉《ことば》だよ。ものの名前《なまえ》をくわしくするよ。',
    h3: '青《あお》いのは空《そら》かな、雲《くも》かな。雲《くも》には「白《しろ》い」がついているね。',
    e: '「青《あお》い空《そら》」とつながります。「雲《くも》」をくわしくしているのは「白《しろ》い」です。',
  },
  {
    id: 'okiru',
    text: 'ぼくは毎朝《まいあさ》早《はや》く起《お》きる。',
    mod: '早《はや》く',
    ans: '起《お》きる',
    w: [
      ['毎朝《まいあさ》', 'm-before'],
      ['ぼくは', 'm-subject-first'],
    ],
    h2: '「早《はや》く」は「どのように」の言葉《ことば》だよ。',
    h3: '「早《はや》く○○」と、動《うご》きの言葉《ことば》につけて読《よ》んでみよう。',
    e: '「早《はや》く起《お》きる」とつながります。「早《はや》く」は起《お》きる時《とき》のようすをくわしくしています。',
  },
  {
    id: 'hinata',
    text: 'ねこがひなたで気持《きも》ちよさそうにねむる。',
    mod: 'ひなたで',
    ans: 'ねむる',
    w: [
      ['ねこが', 'm-subject-first'],
      ['気持《きも》ちよさそうに', 'm-near'],
    ],
    h2: '「ひなたで」は「どこで」を表《あらわ》す言葉《ことば》だよ。',
    h3: '「どこで○○？」と聞《き》ける動《うご》きの言葉《ことば》をさがそう。',
    e: '「ひなたでねむる」とつながります。「どこでねむるか」をくわしくしています。',
  },
  {
    id: 'nioi',
    text: 'おいしそうなにおいが台所《だいどころ》からする。',
    mod: 'おいしそうな',
    ans: 'においが',
    w: [
      ['台所《だいどころ》から', 'm-far'],
      ['する', 'm-kind'],
    ],
    h2: '「おいしそうな」は「どんな」の言葉《ことば》だよ。',
    h3: '「どんな○○？」と聞《き》けるものの名前《なまえ》をさがそう。',
    e: '「おいしそうなにおい」とつながります。「どんなにおいか」をくわしくしています。',
  },
  {
    id: 'doa',
    text: 'ぼくはそっとドアをしめた。',
    mod: 'そっと',
    ans: 'しめた',
    w: [
      ['ドアを', 'm-near'],
      ['ぼくは', 'm-subject-first'],
    ],
    h2: '「そっと」は「どのように」の言葉《ことば》だよ。',
    h3: '「そっと」の後《うし》ろの言葉《ことば》に一《ひと》つずつつなげて読《よ》もう。「どのようにする」の形《かたち》になるのはどれかな。',
    e: '「そっとしめた」とつながります。すぐ後《うし》ろの「ドアを」ではありません。',
  },
  {
    id: 'hoshi',
    text: 'たくさんの星《ほし》が夜空《よぞら》に光《ひか》る。',
    mod: 'たくさんの',
    ans: '星《ほし》が',
    w: [
      ['夜空《よぞら》に', 'm-far'],
      ['光《ひか》る', 'm-kind'],
    ],
    h2: '「たくさんの」は「どのくらいの○○」を表《あらわ》す言葉《ことば》だよ。',
    h3: '「〜の」で終《お》わる言葉《ことば》は、ものの名前《なまえ》につくよ。たくさんあるのは何《なに》かな。',
    e: '「たくさんの星《ほし》」とつながります。「夜空《よぞら》」がたくさんあるのではありません。',
  },
  {
    id: 'kaze',
    text: 'まどからすずしい風《かぜ》がふいてきた。',
    mod: 'すずしい',
    ans: '風《かぜ》が',
    w: [
      ['まどから', 'm-before'],
      ['ふいてきた', 'm-kind'],
    ],
    h2: '「すずしい」は「どんな」の言葉《ことば》だよ。',
    h3: '「すずしい」の後《うし》ろにある、ものの名前《なまえ》をさがそう。',
    e: '「すずしい風《かぜ》」とつながります。「どんな風《かぜ》か」をくわしくしています。',
  },
  {
    id: 'kokuban',
    text: '先生《せんせい》が黒板《こくばん》に字《じ》を大《おお》きく書《か》いた。',
    mod: '大《おお》きく',
    ans: '書《か》いた',
    w: [
      ['字《じ》を', 'm-before'],
      ['先生《せんせい》が', 'm-subject-first'],
    ],
    h2: '「大《おお》きく」は「〜く」で終《お》わる「どのように」の言葉《ことば》だよ。',
    h3: '「大《おお》きく○○」と、動《うご》きの言葉《ことば》につけてみよう。',
    e: '「大《おお》きく書《か》いた」とつながります。「どのように書《か》いたか」をくわしくしています。',
  },
];

function targetItem(t: Target): ChoiceItem {
  return {
    engine: 'choice',
    id: `target:${t.id}`,
    objective: 'target',
    level: 1,
    prompt: `つぎの文《ぶん》で、「${t.mod}」がくわしくしている言葉《ことば》はどれですか。`,
    figure: { kind: 'text', text: t.text, size: 'l' },
    options: opts(t.ans, t.w),
    hints: [
      `「${t.mod}」を、えらびたい言葉《ことば》のすぐ前《まえ》につけて読《よ》んでみよう。意味《いみ》が通《つう》じるかな。`,
      t.h2,
      t.h3,
    ],
    explain: t.e,
    identity: `target:${t.id}`,
  };
}

/** 別例: 線で むすぶ */
interface MatchSet {
  id: string;
  text: string;
  left: string[];
  right: string[];
  pairs: [number, number][];
  wrong: { pair: [number, number]; misconception: string }[];
  e: string;
}
const MATCHES: MatchSet[] = [
  {
    id: 'boushi',
    text: '弟《おとうと》が赤《あか》いぼうしをそっとかぶる。',
    left: ['赤《あか》い', 'そっと'],
    right: ['ぼうしを', 'かぶる', '弟《おとうと》が'],
    pairs: [
      [0, 0],
      [1, 1],
    ],
    wrong: [
      { pair: [0, 2], misconception: 'm-subject-first' },
      { pair: [1, 0], misconception: 'm-before' },
    ],
    e: '「赤《あか》いぼうし」「そっとかぶる」です。',
  },
  {
    id: 'hon',
    text: '兄《あに》が新《あたら》しい本《ほん》を楽《たの》しそうに読《よ》む。',
    left: ['新《あたら》しい', '楽《たの》しそうに'],
    right: ['本《ほん》を', '読《よ》む', '兄《あに》が'],
    pairs: [
      [0, 0],
      [1, 1],
    ],
    wrong: [
      { pair: [0, 2], misconception: 'm-subject-first' },
      { pair: [1, 0], misconception: 'm-before' },
    ],
    e: '「新《あたら》しい本《ほん》」「楽《たの》しそうに読《よ》む」です。',
  },
  {
    id: 'nimotsu',
    text: '姉《あね》が重《おも》い荷物《にもつ》をしっかり持《も》つ。',
    left: ['重《おも》い', 'しっかり'],
    right: ['荷物《にもつ》を', '持《も》つ', '姉《あね》が'],
    pairs: [
      [0, 0],
      [1, 1],
    ],
    wrong: [
      { pair: [0, 2], misconception: 'm-subject-first' },
      { pair: [1, 0], misconception: 'm-before' },
    ],
    e: '「重《おも》い荷物《にもつ》」「しっかり持《も》つ」です。',
  },
  {
    id: 'uta',
    text: '小《ちい》さな子《こ》が大《おお》きな声《こえ》で元気《げんき》に歌《うた》う。',
    left: ['小《ちい》さな', '大《おお》きな', '元気《げんき》に'],
    right: ['子《こ》が', '声《こえ》で', '歌《うた》う'],
    pairs: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    wrong: [
      { pair: [1, 0], misconception: 'm-subject-first' },
      { pair: [2, 1], misconception: 'm-before' },
    ],
    e: '「小《ちい》さな子《こ》」「大《おお》きな声《こえ》」「元気《げんき》に歌《うた》う」です。',
  },
];

function matchItem(m: MatchSet): MatchItem {
  return {
    engine: 'match',
    id: `target:match:${m.id}`,
    objective: 'target',
    level: 1,
    prompt: '上《うえ》の言葉《ことば》がくわしくしている言葉《ことば》を、線《せん》でむすぼう。',
    figure: { kind: 'text', text: m.text, size: 'm' },
    left: m.left.map((label) => ({ label })),
    right: m.right.map((label) => ({ label })),
    pairs: m.pairs,
    wrongPairs: m.wrong,
    hints: [
      '上《うえ》の言葉《ことば》を、下《した》の言葉《ことば》の前《まえ》につけて読《よ》んでみよう。',
      '「〜い」「〜な」の言葉《ことば》はものの名前《なまえ》に、「〜に」やようすの言葉《ことば》は動《うご》きの言葉《ことば》につながるよ。',
      '文《ぶん》のはじめの「〜が」に、ぜんぶつながるとはかぎらないよ。',
    ],
    explain: m.e,
    identity: `target:match:${m.id}`,
    alt: true,
  };
}

// ---- 3. 文を くわしく する ----
interface Fill1 {
  id: string;
  text: string;
  ans: string;
  wrong: string;
  target: string;
  kind: 'donna' | 'doyouni';
}
const FILLS: Fill1[] = [
  {
    id: 'yuki',
    text: '空《そら》から{{}}雪《ゆき》がふってきた。',
    ans: '白《しろ》い',
    wrong: '白《しろ》く',
    target: '雪《ゆき》',
    kind: 'donna',
  },
  {
    id: 'shippo',
    text: '犬《いぬ》がしっぽを{{}}ふる。',
    ans: '元気《げんき》に',
    wrong: '元気《げんき》な',
    target: 'ふる',
    kind: 'doyouni',
  },
  {
    id: 'michi',
    text: 'ぼくは{{}}道《みち》を歩《ある》いた。',
    ans: 'せまい',
    wrong: 'せまく',
    target: '道《みち》',
    kind: 'donna',
  },
  {
    id: 'ocha',
    text: 'お茶《ちゃ》を{{}}飲《の》む。',
    ans: 'しずかに',
    wrong: 'しずかな',
    target: '飲《の》む',
    kind: 'doyouni',
  },
  {
    id: 'koinu',
    text: 'きのう、{{}}子犬《こいぬ》が生《う》まれた。',
    ans: 'かわいい',
    wrong: 'かわいく',
    target: '子犬《こいぬ》',
    kind: 'donna',
  },
  {
    id: 'tokei',
    text: '時計《とけい》のはりが{{}}進《すす》む。',
    ans: '正《ただ》しく',
    wrong: '正《ただ》しい',
    target: '進《すす》む',
    kind: 'doyouni',
  },
  {
    id: 'ike',
    text: '池《いけ》の水《みず》が{{}}光《ひか》る。',
    ans: 'きらきら',
    wrong: 'きらきらした',
    target: '光《ひか》る',
    kind: 'doyouni',
  },
  {
    id: 'kaban',
    text: '妹《いもうと》は{{}}かばんを買《か》ってもらった。',
    ans: '青《あお》い',
    wrong: '青《あお》く',
    target: 'かばん',
    kind: 'donna',
  },
  {
    id: 'uma',
    text: '馬《うま》が草原《そうげん》を{{}}走《はし》る。',
    ans: '速《はや》く',
    wrong: '速《はや》い',
    target: '走《はし》る',
    kind: 'doyouni',
  },
];

function fillItem(f: Fill1): FillItem {
  const donna = f.kind === 'donna';
  return {
    engine: 'fill',
    id: `kuwashiku:${f.id}`,
    objective: 'kuwashiku',
    level: 2,
    prompt: '文《ぶん》をくわしくしよう。{{}}に合《あ》う言葉《ことば》をえらぼう。',
    text: f.text,
    options: [f.ans, f.wrong],
    blanks: [{ answers: [f.ans], wrong: [{ value: f.wrong, misconception: 'm-kind' }] }],
    hints: [
      '{{}}に入《い》る言葉《ことば》がくわしくするのは、すぐ後《うし》ろの言葉《ことば》だよ。',
      `後《うし》ろの「${f.target}」は、ものの名前《なまえ》かな。それとも動《うご》きの言葉《ことば》かな。`,
      'ものの名前《なまえ》をくわしくする形《かたち》と、動《うご》きをくわしくする形《かたち》はちがうよ。二《ふた》つを{{}}に入《い》れて読《よ》みくらべよう。',
    ],
    explain: donna
      ? `「${f.ans}${f.target}」と、ものの名前《なまえ》をくわしくします。「${f.wrong}」は動《うご》きをくわしくする形《かたち》です。`
      : `「${f.ans}${f.target}」と、動《うご》きをくわしくします。「${f.wrong}」はものの名前《なまえ》をくわしくする形《かたち》です。`,
    identity: `kuwashiku:${f.id}`,
  };
}

/** 別例: 言葉の タイルで くわしい 文を 作る */
interface BuildSet {
  id: string;
  base: string;
  add: string[];
  tiles: string[];
  /** 正しい 並び（tiles の 番号の 列）。いくつ あっても よい */
  orders: number[][];
  wrong: number[];
  e: string;
}

/** 3つの まとまりを すべての 順に 並べる（文の 終わりは 固定） */
function perms3(a: number[], b: number[], c: number[], last: number): number[][] {
  const g = [a, b, c];
  const out: number[][] = [];
  for (const [i, j, k] of [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ] as const)
    out.push([...g[i]!, ...g[j]!, ...g[k]!, last]);
  return out;
}

const BUILDS: BuildSet[] = [
  {
    id: 'ringo',
    base: 'りんごがある。',
    add: ['赤《あか》い'],
    tiles: ['赤《あか》い', 'りんごが', 'ある'],
    orders: [[0, 1, 2]],
    wrong: [1, 0, 2],
    e: '「赤《あか》い」はくわしくする「りんご」の前《まえ》におきます。「赤《あか》いりんごがある」。',
  },
  {
    id: 'ki',
    base: '木《き》がゆれる。',
    add: ['大《おお》きな', 'ゆらゆら'],
    tiles: ['大《おお》きな', '木《き》が', 'ゆらゆら', 'ゆれる'],
    orders: [
      [0, 1, 2, 3],
      [2, 0, 1, 3],
    ],
    wrong: [1, 0, 2, 3],
    e: '「大《おお》きな木《き》がゆらゆらゆれる」。「大《おお》きな」は「木《き》」の前《まえ》、「ゆらゆら」は「ゆれる」をくわしくします。',
  },
  {
    id: 'pan',
    base: 'ぼくはパンを食《た》べた。',
    add: ['おいしい'],
    tiles: ['ぼくは', 'おいしい', 'パンを', '食《た》べた'],
    orders: [
      [0, 1, 2, 3],
      [1, 2, 0, 3],
    ],
    wrong: [0, 2, 1, 3],
    e: '「ぼくはおいしいパンを食《た》べた」。「おいしい」は「パン」のすぐ前《まえ》におきます。',
  },
  {
    id: 'neko',
    base: 'ねこがねむる。',
    add: ['白《しろ》い', 'しずかに'],
    tiles: ['白《しろ》い', 'ねこが', 'しずかに', 'ねむる'],
    orders: [
      [0, 1, 2, 3],
      [2, 0, 1, 3],
    ],
    wrong: [1, 0, 2, 3],
    e: '「白《しろ》いねこがしずかにねむる」。「白《しろ》い」は「ねこ」の前《まえ》におきます。',
  },
  {
    id: 'tegami',
    base: '兄《あに》が手紙《てがみ》を書《か》く。',
    add: ['長《なが》い', 'ていねいに'],
    tiles: ['兄《あに》が', '長《なが》い', '手紙《てがみ》を', 'ていねいに', '書《か》く'],
    orders: perms3([0], [1, 2], [3], 4),
    wrong: [0, 2, 1, 3, 4],
    e: '「兄《あに》が長《なが》い手紙《てがみ》をていねいに書《か》く」。「長《なが》い」は「手紙《てがみ》」のすぐ前《まえ》におきます。',
  },
];

function buildItem(b: BuildSet): BuildItem {
  const join = (o: number[]) => o.map((i) => b.tiles[i]!).join('');
  return {
    engine: 'build',
    id: `kuwashiku:build:${b.id}`,
    objective: 'kuwashiku',
    level: 2,
    prompt: `${b.add.map((a) => `「${a}」`).join('と')}を入《い》れて、「${b.base}」をくわしくしよう。`,
    tiles: b.tiles,
    answer: { kind: 'text', values: b.orders.map(join) },
    wrongAnswers: [{ value: join(b.wrong), misconception: 'm-order' }],
    hints: [
      '入《い》れる言葉《ことば》が、どの言葉《ことば》をくわしくするか考《かんが》えよう。',
      'くわしくする言葉《ことば》は、くわしくされる言葉《ことば》の前《まえ》におくよ。',
      '文《ぶん》のさいごは動《うご》きの言葉《ことば》にしよう。',
    ],
    explain: b.e,
    identity: `kuwashiku:build:${b.id}`,
    alt: true,
  };
}

const ITEMS: Item[] = [
  ...SENS.map(donnaItem),
  ...SENS.map(doyouniItem),
  ...SORT_SETS.map(sortItem),
  ...TARGETS.map(targetItem),
  ...MATCHES.map(matchItem),
  ...FILLS.map(fillItem),
  ...BUILDS.map(buildItem),
];

export const modifiers: UnitSpec = {
  id: 'g3.ja.modifiers',
  title: 'くわしくする言葉《ことば》',
  stage: 'g3',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: ['g2.ja.subject-predicate'],
  objectives: [
    { id: 'find', title: '「どんな」「どのように」にあたる言葉《ことば》を見《み》つける' },
    { id: 'target', title: 'くわしくしている言葉《ことば》を見《み》つける' },
    { id: 'kuwashiku', title: '言葉《ことば》を足《た》して文《ぶん》をくわしくする' },
  ],
  misconceptions: [
    {
      id: 'm-subj-pred',
      explain:
        '「だれが（何《なに》が）」や「どうする」の言葉《ことば》をえらんだのかな。それは文《ぶん》の中心《ちゅうしん》の言葉《ことば》だよ。くわしくする言葉《ことば》は、そこに「どんな」「どのように」を足《た》す言葉《ことば》だよ。',
    },
    {
      id: 'm-kind',
      explain:
        '「どんな」と「どのように」を取《と》りちがえたのかな。ものの名前《なまえ》をくわしくするのが「どんな」（赤《あか》い・小《ちい》さな）、動《うご》きをくわしくするのが「どのように」（ゆっくり・元気《げんき》に）だよ。',
    },
    {
      id: 'm-near',
      explain:
        'すぐ後《うし》ろにある言葉《ことば》をえらんだのかな。くわしくする言葉《ことば》は、はなれた言葉《ことば》につながることもあるよ。二《ふた》つをつなげて読《よ》んで、意味《いみ》が通《つう》じるかたしかめよう。',
    },
    {
      id: 'm-before',
      explain:
        'くわしくする言葉《ことば》より前《まえ》にある言葉《ことば》をえらんだのかな。くわしくする言葉《ことば》は、かならず自分《じぶん》より後《うし》ろの言葉《ことば》につながるよ。',
    },
    {
      id: 'm-far',
      explain:
        '答《こた》えより後《うし》ろの、はなれた言葉《ことば》をえらんだのかな。まずすぐ後《うし》ろの言葉《ことば》につなげて読《よ》んで、意味《いみ》が通《つう》じるかたしかめよう。',
    },
    {
      id: 'm-subject-first',
      explain:
        '文《ぶん》のはじめの「〜が」「〜は」につながると考《かんが》えたのかな。くわしくする言葉《ことば》は、いつも「だれが」をくわしくするとはかぎらないよ。',
    },
    {
      id: 'm-noun-only',
      explain:
        'くわしくする言葉《ことば》は、いつもものの名前《なまえ》につながると考《かんが》えたのかな。「いつ」「どのくらい」を表《あらわ》す言葉《ことば》は、動《うご》きやようすの言葉《ことば》につながるよ。',
    },
    {
      id: 'm-skip',
      explain:
        '文《ぶん》のさいごの言葉《ことば》につながると考《かんが》えたのかな。「とても」は「どのくらい」を表《あらわ》して、ようすの言葉《ことば》（大《おお》きな・早《はや》い）をくわしくすることが多《おお》いよ。',
    },
    {
      id: 'm-order',
      explain:
        'くわしくする言葉《ことば》を、くわしくされる言葉《ことば》の後《うし》ろにおいたのかな。日本語《にほんご》では、くわしくする言葉《ことば》を前《まえ》におくよ。「りんごが赤《あか》いある」ではなく「赤《あか》いりんごがある」。',
    },
  ],
  levels: [
    { label: '「どんな」「どのように」を見つける', chance: 0.05 },
    { label: 'くわしくされる言葉を見つける', chance: 0.05 },
    { label: '文をくわしくする', chance: 0.1 },
  ],
  intro: [
    {
      text: '「鳥《とり》が鳴《な》く。」に言葉《ことば》を足《た》すと、「かわいい鳥《とり》が楽《たの》しそうに鳴《な》く。」とくわしくなります。',
      figure: {
        kind: 'text',
        text: '**かわいい**鳥《とり》が**楽《たの》しそうに**鳴《な》く。',
        size: 'l',
      },
    },
    {
      text: '「かわいい」は「どんな鳥《とり》？」に答《こた》えて、「鳥《とり》」をくわしくします。「楽《たの》しそうに」は「どのように鳴《な》く？」に答《こた》えて、「鳴《な》く」をくわしくします。',
    },
    {
      text: 'くわしくする言葉《ことば》は、くわしくされる言葉《ことば》より前《まえ》にあります。二《ふた》つをつなげて読《よ》んで、意味《いみ》が通《つう》じるかたしかめよう。',
    },
  ],
  source: { kind: 'items', items: ITEMS },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）国語第3学年及び第4学年知識及び技能 (1) カ（主語と述語との関係、修飾と被修飾との関係、指示する語句と接続する語句の役割、段落の役割について理解すること）',
  revised: REVISED,
};
