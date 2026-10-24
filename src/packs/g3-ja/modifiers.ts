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
    subj: '妹《いもうと》が',
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
    subj: '兄《あに》が',
    nm: '重《おも》い',
    noun: '荷物《にもつ》',
    pt: 'を',
    am: 'しっかり',
    verb: '持《も》つ',
  },
];

const sentence = (s: Sen) =>
  `${s.subj ? `${s.subj} ` : ''}${s.nm} ${s.noun}${s.pt} ${s.am} ${s.verb}。`;
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
    prompt: `つぎの 文《ぶん》で、「どんな ${s.noun}？」に 答《こた》える 言葉《ことば》は どれですか。`,
    figure: { kind: 'text', text: sentence(s), size: 'l' },
    options: opts(s.nm, wrongs),
    hints: [
      'ものの ようす（色《いろ》・形《かたち》・大《おお》きさ など）を 表《あらわ》す 言葉《ことば》を さがそう。',
      '「どんな」の 言葉《ことば》は、くわしく する 名前《なまえ》の 言葉《ことば》の 前《まえ》に あるよ。',
      `「${s.noun}」の 前《まえ》に ある 言葉《ことば》を、「どんな ${s.noun}？」に あてはめて みよう。`,
    ],
    explain: `「どんな ${s.noun}？」→「${s.nm} ${s.noun}」。「${s.nm}」が「${s.noun}」を くわしく して います。「${s.am}」は 動《うご》きの ようすを 表《あらわ》す「どのように」の 言葉《ことば》です。`,
    identity: `find:donna:${s.id}`,
  };
}

function doyouniItem(s: Sen): ChoiceItem {
  return {
    engine: 'choice',
    id: `find:doyouni:${s.id}`,
    objective: 'find',
    level: 0,
    prompt: `つぎの 文《ぶん》で、「どのように ${s.verb}？」に 答《こた》える 言葉《ことば》は どれですか。`,
    figure: { kind: 'text', text: sentence(s), size: 'l' },
    options: opts(s.am, [
      [s.nm, 'm-kind'],
      [subjOf(s), 'm-subj-pred'],
    ]),
    hints: [
      '動《うご》きの ようす（はやさ・やり方《かた》・音《おと》）を 表《あらわ》す 言葉《ことば》を さがそう。',
      '「どのように」の 言葉《ことば》は、動《うご》きの 言葉《ことば》の 前《まえ》に ある ことが 多《おお》いよ。',
      `「どのように ${s.verb}？」と 聞《き》いて、答《こた》えに なる 言葉《ことば》を さがそう。「だれが」に 答《こた》える 言葉《ことば》では ないよ。`,
    ],
    explain: `「どのように ${s.verb}？」→「${s.am} ${s.verb}」。「${s.am}」が「${s.verb}」を くわしく して います。「${s.nm}」は ものの ようすを 表《あらわ》す「どんな」の 言葉《ことば》です。`,
    identity: `find:doyouni:${s.id}`,
  };
}

/** 別例: 太字の 言葉を「どんな」「どのように」に 分ける */
const SORT_SETS: { id: string; donna: string[]; doyouni: string[] }[] = [
  {
    id: 'a',
    donna: ['**あまい** ケーキ', '**やさしい** 先生《せんせい》', '**古《ふる》い** 家《いえ》'],
    doyouni: ['**にこにこ** わらう', '**早《はや》く** 起《お》きる', '**じっと** 見《み》る'],
  },
  {
    id: 'b',
    donna: [
      '**ふかい** 池《いけ》',
      '**かわいい** 子犬《こいぬ》',
      '**大切《たいせつ》な** 手紙《てがみ》',
    ],
    doyouni: ['**すらすら** 読《よ》む', '**さっと** にげる', '**大《おお》きく** 手《て》を ふる'],
  },
  {
    id: 'c',
    donna: ['**きれいな** 花《はな》', '**広《ひろ》い** 海《うみ》', '**あたたかい** スープ'],
    doyouni: ['**ゆっくり** 歩《ある》く', '**ぐっすり** ねむる', '**きれいに** あらう'],
  },
];

function sortItem(x: (typeof SORT_SETS)[number]): SortItem {
  return {
    engine: 'sort',
    id: `find:sort:${x.id}`,
    objective: 'find',
    level: 0,
    prompt: '太字《ふとじ》の 言葉《ことば》を、「どんな」と「どのように」に 分《わ》けよう。',
    boxes: [{ label: 'どんな（ものの ようす）' }, { label: 'どのように（動《うご》きの ようす）' }],
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
      '太字《ふとじ》の 言葉《ことば》が、後《うし》ろの どの 言葉《ことば》を くわしく して いるか 見《み》よう。',
      '後《うし》ろが ものの 名前《なまえ》なら「どんな」、動《うご》きの 言葉《ことば》なら「どのように」だよ。',
      '「〜い」「〜な」で 終《お》わる 言葉《ことば》は「どんな」、「〜く」「〜に」で 終《お》わる 言葉《ことば》は「どのように」に なる ことが 多《おお》いよ。',
    ],
    explain: `ものの 名前《なまえ》を くわしく するのが「どんな」（${x.donna.map((d) => d.replace(/\*\*/g, '').split(' ')[0]).join('・')}）、動《うご》きを くわしく するのが「どのように」（${x.doyouni.map((d) => d.replace(/\*\*/g, '').split(' ')[0]).join('・')}）です。`,
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
    text: 'ゆっくり 大《おお》きな かめが 歩《ある》く。',
    mod: 'ゆっくり',
    ans: '歩《ある》く',
    w: [
      ['大《おお》きな', 'm-near'],
      ['かめが', 'm-subject-first'],
    ],
    h2: '「ゆっくり」は 動《うご》きの ようすを 表《あらわ》す 言葉《ことば》だよ。',
    h3: '「ゆっくり 大《おお》きな」「ゆっくり かめが」は 意味《いみ》が 通《つう》じるかな。動《うご》きの 言葉《ことば》に つけて みよう。',
    e: '「ゆっくり 歩《ある》く」と つながります。「ゆっくり」は はなれた ところに ある「歩《ある》く」を くわしく して います。',
  },
  {
    id: 'kinou',
    text: 'きのう 公園《こうえん》で 白《しろ》い 花《はな》を 見《み》た。',
    mod: 'きのう',
    ans: '見《み》た',
    w: [
      ['公園《こうえん》で', 'm-near'],
      ['花《はな》を', 'm-noun-only'],
    ],
    h2: '「きのう」は「いつ」を 表《あらわ》す 言葉《ことば》だよ。',
    h3: '「いつ ○○？」と 聞《き》ける 言葉《ことば》を さがそう。「いつ 花《はな》？」では 意味《いみ》が 通《つう》じないね。',
    e: '「きのう 見《み》た」と つながります。「いつ 見《み》たか」を くわしく して います。',
  },
  {
    id: 'totemo',
    text: 'とても 大《おお》きな 魚《さかな》が つれた。',
    mod: 'とても',
    ans: '大《おお》きな',
    w: [
      ['魚《さかな》が', 'm-noun-only'],
      ['つれた', 'm-skip'],
    ],
    h2: '「とても」は「どのくらい」を 表《あらわ》す 言葉《ことば》だよ。',
    h3: '「とても 魚《さかな》」「とても つれた」は おかしいね。どのくらい なのかを 考《かんが》えよう。',
    e: '「とても 大《おお》きな」と つながります。「とても」は、どのくらい 大《おお》きいかを くわしく して います。くわしく する 言葉《ことば》を、さらに くわしく する ことも あります。',
  },
  {
    id: 'asobu',
    text: '友《とも》だちが 楽《たの》しそうに 公園《こうえん》で あそぶ。',
    mod: '楽《たの》しそうに',
    ans: 'あそぶ',
    w: [
      ['公園《こうえん》で', 'm-near'],
      ['友《とも》だちが', 'm-subject-first'],
    ],
    h2: '「楽《たの》しそうに」は「どのように」の 言葉《ことば》だよ。',
    h3: '「どのように 公園《こうえん》で？」では 意味《いみ》が 通《つう》じないね。動《うご》きの 言葉《ことば》を さがそう。',
    e: '「楽《たの》しそうに あそぶ」と つながります。すぐ 後《うし》ろの「公園《こうえん》で」では ありません。',
  },
  {
    id: 'sora',
    text: '青《あお》い 空《そら》に 白《しろ》い 雲《くも》が うかぶ。',
    mod: '青《あお》い',
    ans: '空《そら》に',
    w: [
      ['雲《くも》が', 'm-subject-first'],
      ['うかぶ', 'm-kind'],
    ],
    h2: '「青《あお》い」は「どんな」の 言葉《ことば》だよ。ものの 名前《なまえ》を くわしく するよ。',
    h3: '青《あお》いのは 空《そら》かな、雲《くも》かな。雲《くも》には「白《しろ》い」が ついて いるね。',
    e: '「青《あお》い 空《そら》」と つながります。「雲《くも》」を くわしく して いるのは「白《しろ》い」です。',
  },
  {
    id: 'okiru',
    text: 'ぼくは 毎朝《まいあさ》 早《はや》く 起《お》きる。',
    mod: '早《はや》く',
    ans: '起《お》きる',
    w: [
      ['毎朝《まいあさ》', 'm-near'],
      ['ぼくは', 'm-subject-first'],
    ],
    h2: '「早《はや》く」は「どのように」の 言葉《ことば》だよ。',
    h3: '「早《はや》く ○○」と、動《うご》きの 言葉《ことば》に つけて 読《よ》んで みよう。',
    e: '「早《はや》く 起《お》きる」と つながります。「早《はや》く」は 起《お》きる 時《とき》の ようすを くわしく して います。',
  },
  {
    id: 'hinata',
    text: 'ねこが ひなたで 気持《きも》ちよさそうに ねむる。',
    mod: 'ひなたで',
    ans: 'ねむる',
    w: [
      ['ねこが', 'm-subject-first'],
      ['気持《きも》ちよさそうに', 'm-near'],
    ],
    h2: '「ひなたで」は「どこで」を 表《あらわ》す 言葉《ことば》だよ。',
    h3: '「どこで ○○？」と 聞《き》ける 動《うご》きの 言葉《ことば》を さがそう。',
    e: '「ひなたで ねむる」と つながります。「どこで ねむるか」を くわしく して います。',
  },
  {
    id: 'nioi',
    text: 'おいしそうな においが 台所《だいどころ》から する。',
    mod: 'おいしそうな',
    ans: 'においが',
    w: [
      ['台所《だいどころ》から', 'm-near'],
      ['する', 'm-kind'],
    ],
    h2: '「おいしそうな」は「どんな」の 言葉《ことば》だよ。',
    h3: '「どんな ○○？」と 聞《き》ける ものの 名前《なまえ》を さがそう。',
    e: '「おいしそうな におい」と つながります。「どんな においか」を くわしく して います。',
  },
  {
    id: 'doa',
    text: 'ぼくは そっと ドアを しめた。',
    mod: 'そっと',
    ans: 'しめた',
    w: [
      ['ドアを', 'm-near'],
      ['ぼくは', 'm-subject-first'],
    ],
    h2: '「そっと」は「どのように」の 言葉《ことば》だよ。',
    h3: '「そっと ドア」と「そっと しめた」、意味《いみ》が 通《つう》じるのは どちらかな。',
    e: '「そっと しめた」と つながります。すぐ 後《うし》ろの「ドアを」では ありません。',
  },
  {
    id: 'hoshi',
    text: 'たくさんの 星《ほし》が 夜空《よぞら》に 光《ひか》る。',
    mod: 'たくさんの',
    ans: '星《ほし》が',
    w: [
      ['夜空《よぞら》に', 'm-near'],
      ['光《ひか》る', 'm-kind'],
    ],
    h2: '「たくさんの」は「どのくらいの ○○」を 表《あらわ》す 言葉《ことば》だよ。',
    h3: '「〜の」で 終《お》わる 言葉《ことば》は、ものの 名前《なまえ》に つくよ。たくさん あるのは 何《なに》かな。',
    e: '「たくさんの 星《ほし》」と つながります。「夜空《よぞら》」が たくさん あるのでは ありません。',
  },
  {
    id: 'kaze',
    text: 'まどから すずしい 風《かぜ》が ふいて きた。',
    mod: 'すずしい',
    ans: '風《かぜ》が',
    w: [
      ['まどから', 'm-near'],
      ['ふいて きた', 'm-kind'],
    ],
    h2: '「すずしい」は「どんな」の 言葉《ことば》だよ。',
    h3: '「すずしい」の 後《うし》ろに ある、ものの 名前《なまえ》を さがそう。',
    e: '「すずしい 風《かぜ》」と つながります。「どんな 風《かぜ》か」を くわしく して います。',
  },
  {
    id: 'kokuban',
    text: '先生《せんせい》が 黒板《こくばん》に 字《じ》を 大《おお》きく 書《か》いた。',
    mod: '大《おお》きく',
    ans: '書《か》いた',
    w: [
      ['字《じ》を', 'm-near'],
      ['先生《せんせい》が', 'm-subject-first'],
    ],
    h2: '「大《おお》きく」は「〜く」で 終《お》わる「どのように」の 言葉《ことば》だよ。',
    h3: '「大《おお》きく ○○」と、動《うご》きの 言葉《ことば》に つけて みよう。',
    e: '「大《おお》きく 書《か》いた」と つながります。「どのように 書《か》いたか」を くわしく して います。',
  },
];

function targetItem(t: Target): ChoiceItem {
  return {
    engine: 'choice',
    id: `target:${t.id}`,
    objective: 'target',
    level: 1,
    prompt: `つぎの 文《ぶん》で、「${t.mod}」が くわしく して いる 言葉《ことば》は どれですか。`,
    figure: { kind: 'text', text: t.text, size: 'l' },
    options: opts(t.ans, t.w),
    hints: [
      `「${t.mod}」を、えらびたい 言葉《ことば》の すぐ 前《まえ》に つけて 読《よ》んで みよう。意味《いみ》が 通《つう》じるかな。`,
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
    text: '弟《おとうと》が 赤《あか》い ぼうしを そっと かぶる。',
    left: ['赤《あか》い', 'そっと'],
    right: ['ぼうしを', 'かぶる', '弟《おとうと》が'],
    pairs: [
      [0, 0],
      [1, 1],
    ],
    wrong: [
      { pair: [0, 2], misconception: 'm-subject-first' },
      { pair: [1, 0], misconception: 'm-near' },
    ],
    e: '「赤《あか》い ぼうし」「そっと かぶる」です。',
  },
  {
    id: 'hon',
    text: '妹《いもうと》が 新《あたら》しい 本《ほん》を 楽《たの》しそうに 読《よ》む。',
    left: ['新《あたら》しい', '楽《たの》しそうに'],
    right: ['本《ほん》を', '読《よ》む', '妹《いもうと》が'],
    pairs: [
      [0, 0],
      [1, 1],
    ],
    wrong: [
      { pair: [0, 2], misconception: 'm-subject-first' },
      { pair: [1, 0], misconception: 'm-near' },
    ],
    e: '「新《あたら》しい 本《ほん》」「楽《たの》しそうに 読《よ》む」です。',
  },
  {
    id: 'nimotsu',
    text: '兄《あに》が 重《おも》い 荷物《にもつ》を しっかり 持《も》つ。',
    left: ['重《おも》い', 'しっかり'],
    right: ['荷物《にもつ》を', '持《も》つ', '兄《あに》が'],
    pairs: [
      [0, 0],
      [1, 1],
    ],
    wrong: [
      { pair: [0, 2], misconception: 'm-subject-first' },
      { pair: [1, 0], misconception: 'm-near' },
    ],
    e: '「重《おも》い 荷物《にもつ》」「しっかり 持《も》つ」です。',
  },
  {
    id: 'uta',
    text: '小《ちい》さな 子《こ》が 大《おお》きな 声《こえ》で 元気《げんき》に 歌《うた》う。',
    left: ['小《ちい》さな', '大《おお》きな', '元気《げんき》に'],
    right: ['子《こ》が', '声《こえ》で', '歌《うた》う'],
    pairs: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    wrong: [
      { pair: [1, 0], misconception: 'm-subject-first' },
      { pair: [2, 1], misconception: 'm-near' },
    ],
    e: '「小《ちい》さな 子《こ》」「大《おお》きな 声《こえ》」「元気《げんき》に 歌《うた》う」です。',
  },
];

function matchItem(m: MatchSet): MatchItem {
  return {
    engine: 'match',
    id: `target:match:${m.id}`,
    objective: 'target',
    level: 1,
    prompt:
      '上《うえ》の 言葉《ことば》が くわしく して いる 言葉《ことば》を、線《せん》で むすぼう。',
    figure: { kind: 'text', text: m.text, size: 'm' },
    left: m.left.map((label) => ({ label })),
    right: m.right.map((label) => ({ label })),
    pairs: m.pairs,
    wrongPairs: m.wrong,
    hints: [
      '上《うえ》の 言葉《ことば》を、下《した》の 言葉《ことば》の 前《まえ》に つけて 読《よ》んで みよう。',
      '「〜い」「〜な」の 言葉《ことば》は ものの 名前《なまえ》に、「〜に」や ようすの 言葉《ことば》は 動《うご》きの 言葉《ことば》に つながるよ。',
      '文《ぶん》の はじめの「〜が」に、ぜんぶ つながるとは かぎらないよ。',
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
    text: '空《そら》から {{}} 雪《ゆき》が ふって きた。',
    ans: '白《しろ》い',
    wrong: '白《しろ》く',
    target: '雪《ゆき》',
    kind: 'donna',
  },
  {
    id: 'shippo',
    text: '犬《いぬ》が しっぽを {{}} ふる。',
    ans: '元気《げんき》に',
    wrong: '元気《げんき》な',
    target: 'ふる',
    kind: 'doyouni',
  },
  {
    id: 'michi',
    text: 'ぼくは {{}} 道《みち》を 歩《ある》いた。',
    ans: 'せまい',
    wrong: 'せまく',
    target: '道《みち》',
    kind: 'donna',
  },
  {
    id: 'ocha',
    text: 'お茶《ちゃ》を {{}} 飲《の》む。',
    ans: 'しずかに',
    wrong: 'しずかな',
    target: '飲《の》む',
    kind: 'doyouni',
  },
  {
    id: 'koinu',
    text: 'きのう、{{}} 子犬《こいぬ》が 生《う》まれた。',
    ans: 'かわいい',
    wrong: 'かわいく',
    target: '子犬《こいぬ》',
    kind: 'donna',
  },
  {
    id: 'tokei',
    text: '時計《とけい》の はりが {{}} 進《すす》む。',
    ans: '正《ただ》しく',
    wrong: '正《ただ》しい',
    target: '進《すす》む',
    kind: 'doyouni',
  },
  {
    id: 'ike',
    text: '池《いけ》の 水《みず》が {{}} 光《ひか》る。',
    ans: 'きらきら',
    wrong: 'きらきらした',
    target: '光《ひか》る',
    kind: 'doyouni',
  },
  {
    id: 'kaban',
    text: '妹《いもうと》は {{}} かばんを 買《か》って もらった。',
    ans: '青《あお》い',
    wrong: '青《あお》く',
    target: 'かばん',
    kind: 'donna',
  },
  {
    id: 'uma',
    text: '馬《うま》が 草原《そうげん》を {{}} 走《はし》る。',
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
    prompt: '文《ぶん》を くわしく しよう。{{}}に 合《あ》う 言葉《ことば》を えらぼう。',
    text: f.text,
    options: [f.ans, f.wrong],
    blanks: [{ answers: [f.ans], wrong: [{ value: f.wrong, misconception: 'm-kind' }] }],
    hints: [
      '{{}}の すぐ 後《うし》ろの 言葉《ことば》を 見《み》よう。',
      donna
        ? `後《うし》ろの「${f.target}」は ものの 名前《なまえ》だね。「どんな ${f.target}？」に 答《こた》える 形《かたち》が 合《あ》うよ。`
        : `後《うし》ろの「${f.target}」は 動《うご》きの 言葉《ことば》だね。「どのように ${f.target}？」に 答《こた》える 形《かたち》が 合《あ》うよ。`,
      donna
        ? '名前《なまえ》の 言葉《ことば》の 前《まえ》には、「〜い」「〜な」の 形《かたち》が 来《く》るよ。'
        : '動《うご》きの 言葉《ことば》の 前《まえ》には、「〜く」「〜に」などの 形《かたち》が 来《く》るよ。',
    ],
    explain: donna
      ? `「${f.ans} ${f.target}」と、ものの 名前《なまえ》を くわしく します。「${f.wrong}」は 動《うご》きを くわしく する 形《かたち》です。`
      : `「${f.ans} ${f.target}」と、動《うご》きを くわしく します。「${f.wrong}」は ものの 名前《なまえ》を くわしく する 形《かたち》です。`,
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
    base: 'りんごが ある。',
    add: ['赤《あか》い'],
    tiles: ['赤《あか》い', 'りんごが', 'ある'],
    orders: [[0, 1, 2]],
    wrong: [1, 0, 2],
    e: '「赤《あか》い」は くわしく する「りんご」の 前《まえ》に おきます。「赤《あか》い りんごが ある」。',
  },
  {
    id: 'ki',
    base: '木《き》が ゆれる。',
    add: ['大《おお》きな', 'ゆらゆら'],
    tiles: ['大《おお》きな', '木《き》が', 'ゆらゆら', 'ゆれる'],
    orders: [
      [0, 1, 2, 3],
      [2, 0, 1, 3],
    ],
    wrong: [1, 0, 2, 3],
    e: '「大《おお》きな 木《き》が ゆらゆら ゆれる」。「大《おお》きな」は「木《き》」の 前《まえ》、「ゆらゆら」は「ゆれる」を くわしく します。',
  },
  {
    id: 'pan',
    base: 'ぼくは パンを 食《た》べた。',
    add: ['おいしい'],
    tiles: ['ぼくは', 'おいしい', 'パンを', '食《た》べた'],
    orders: [
      [0, 1, 2, 3],
      [1, 2, 0, 3],
    ],
    wrong: [0, 2, 1, 3],
    e: '「ぼくは おいしい パンを 食《た》べた」。「おいしい」は「パン」の すぐ 前《まえ》に おきます。',
  },
  {
    id: 'neko',
    base: 'ねこが ねむる。',
    add: ['白《しろ》い', 'しずかに'],
    tiles: ['白《しろ》い', 'ねこが', 'しずかに', 'ねむる'],
    orders: [
      [0, 1, 2, 3],
      [2, 0, 1, 3],
    ],
    wrong: [1, 0, 2, 3],
    e: '「白《しろ》い ねこが しずかに ねむる」。「白《しろ》い」は「ねこ」の 前《まえ》に おきます。',
  },
  {
    id: 'tegami',
    base: '姉《あね》が 手紙《てがみ》を 書《か》く。',
    add: ['長《なが》い', 'ていねいに'],
    tiles: ['姉《あね》が', '長《なが》い', '手紙《てがみ》を', 'ていねいに', '書《か》く'],
    orders: perms3([0], [1, 2], [3], 4),
    wrong: [0, 2, 1, 3, 4],
    e: '「姉《あね》が 長《なが》い 手紙《てがみ》を ていねいに 書《か》く」。「長《なが》い」は「手紙《てがみ》」の すぐ 前《まえ》に おきます。',
  },
];

function buildItem(b: BuildSet): BuildItem {
  const join = (o: number[]) => o.map((i) => b.tiles[i]!).join('');
  return {
    engine: 'build',
    id: `kuwashiku:build:${b.id}`,
    objective: 'kuwashiku',
    level: 2,
    prompt: `${b.add.map((a) => `「${a}」`).join('と ')}を 入《い》れて、「${b.base}」を くわしく しよう。`,
    tiles: b.tiles,
    answer: { kind: 'text', values: b.orders.map(join) },
    wrongAnswers: [{ value: join(b.wrong), misconception: 'm-order' }],
    hints: [
      '入《い》れる 言葉《ことば》が、どの 言葉《ことば》を くわしく するか 考《かんが》えよう。',
      'くわしく する 言葉《ことば》は、くわしく される 言葉《ことば》の 前《まえ》に おくよ。',
      '文《ぶん》の さいごは 動《うご》きの 言葉《ことば》に しよう。',
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
  title: 'くわしく する 言葉《ことば》',
  stage: 'g3',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: ['g2.ja.subject-predicate'],
  objectives: [
    { id: 'find', title: '「どんな」「どのように」に あたる 言葉《ことば》を 見《み》つける' },
    { id: 'target', title: 'くわしく して いる 言葉《ことば》を 見《み》つける' },
    { id: 'kuwashiku', title: '言葉《ことば》を 足《た》して 文《ぶん》を くわしく する' },
  ],
  misconceptions: [
    {
      id: 'm-subj-pred',
      explain:
        '「だれが（何《なに》が）」や「どう する」の 言葉《ことば》を えらんだのかな。それは 文《ぶん》の 中心《ちゅうしん》の 言葉《ことば》だよ。くわしく する 言葉《ことば》は、そこに「どんな」「どのように」を 足《た》す 言葉《ことば》だよ。',
    },
    {
      id: 'm-kind',
      explain:
        '「どんな」と「どのように」を 取《と》りちがえたのかな。ものの 名前《なまえ》を くわしく するのが「どんな」（赤《あか》い・小《ちい》さな）、動《うご》きを くわしく するのが「どのように」（ゆっくり・元気《げんき》に）だよ。',
    },
    {
      id: 'm-near',
      explain:
        'すぐ となりに ある 言葉《ことば》を えらんだのかな。くわしく する 言葉《ことば》は、はなれた 言葉《ことば》に つながる ことも あるよ。二《ふた》つを つなげて 読《よ》んで、意味《いみ》が 通《つう》じるか たしかめよう。',
    },
    {
      id: 'm-subject-first',
      explain:
        '文《ぶん》の はじめの「〜が」「〜は」に つながると 考《かんが》えたのかな。くわしく する 言葉《ことば》は、いつも「だれが」を くわしく するとは かぎらないよ。',
    },
    {
      id: 'm-noun-only',
      explain:
        'くわしく する 言葉《ことば》は、いつも ものの 名前《なまえ》に つながると 考《かんが》えたのかな。「いつ」「どのくらい」を 表《あらわ》す 言葉《ことば》は、動《うご》きや ようすの 言葉《ことば》に つながるよ。',
    },
    {
      id: 'm-skip',
      explain:
        '文《ぶん》の さいごの 言葉《ことば》に つながると 考《かんが》えたのかな。「とても」は「どのくらい」を 表《あらわ》して、ようすの 言葉《ことば》（大《おお》きな・早《はや》い）を くわしく する ことが 多《おお》いよ。',
    },
    {
      id: 'm-order',
      explain:
        'くわしく する 言葉《ことば》を、くわしく される 言葉《ことば》の 後《うし》ろに おいたのかな。日本語《にほんご》では、くわしく する 言葉《ことば》を 前《まえ》に おくよ。「りんごが 赤《あか》い ある」ではなく「赤《あか》い りんごが ある」。',
    },
  ],
  levels: [
    { label: '「どんな」「どのように」を 見つける', chance: 0.05 },
    { label: 'くわしく される 言葉を 見つける', chance: 0.05 },
    { label: '文を くわしく する', chance: 0.1 },
  ],
  intro: [
    {
      text: '「犬《いぬ》が 走《はし》る。」に 言葉《ことば》を 足《た》すと、「小《ちい》さな 犬《いぬ》が 元気《げんき》に 走《はし》る。」と くわしく なります。',
      figure: {
        kind: 'text',
        text: '**小《ちい》さな** 犬《いぬ》が **元気《げんき》に** 走《はし》る。',
        size: 'l',
      },
    },
    {
      text: '「小《ちい》さな」は「どんな 犬《いぬ》？」に 答《こた》えて、「犬《いぬ》」を くわしく します。「元気《げんき》に」は「どのように 走《はし》る？」に 答《こた》えて、「走《はし》る」を くわしく します。',
    },
    {
      text: 'くわしく する 言葉《ことば》は、くわしく される 言葉《ことば》より 前《まえ》に あります。二《ふた》つを つなげて 読《よ》んで、意味《いみ》が 通《つう》じるか たしかめよう。',
    },
  ],
  source: { kind: 'items', items: ITEMS },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第3学年及び第4学年 知識及び技能 (1) カ（主語と述語との関係、修飾と被修飾との関係、指示する語句と接続する語句の役割、段落の役割について理解すること）',
  revised: REVISED,
};
