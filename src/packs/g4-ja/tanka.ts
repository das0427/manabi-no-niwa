/**
 * g4.ja.tanka 短歌《たんか》の音読《おんどく》（curriculum-matrix 3.7: 短歌の音読（五七五七七））。
 * 音を数える（listen）→ 五・七・五・七・七に区切る（build）→ 短歌の形（listen）→ ようす・季節（listen）。
 * 歌は10首とも本アプリのオリジナル（古典の歌は使わない。作者名が実在の人物名になるため）。5・7・5・7・7 ちょうどで、字余り・字足らずなし。
 * 「句」は5年の字だが、短歌の用語（上の句・下の句）に必要なので《よみ》付きで使う（テストの ALLOWED_OVER）。
 * 「はいく」は「俳」が6年の字なので、かなで書く。
 *
 * 到達項目と表し方:
 *   oto     … 句の音の数を数える（練習 listen 8: 字を見ながら／別例 listen 4: 字を見ずに聞くだけ）
 *   kiru    … 五・七・五・七・七に区切る（練習 build 10／別例 listen 4: 聞いて○つめの句を選ぶ）
 *   katachi … 上の句・下の句・三十一音（練習 listen 10／別例 build 4: 上の句につづく下の句を作る）
 *   yousu   … ようす・文語の意味（練習 listen 11／別例 listen 5: 季節を絵で選ぶ）
 *
 * 同一性キー: 句の音の数は句のかな、区切りは歌×上下、事実（三十一音など）は歌に関係なく1つずつ。
 * 選択肢・誤答のすべてに誤概念IDを付ける（汎用誤答なし）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { BuildItem } from '../../engines/build/build';
import type { ListenItem } from '../../engines/listen/listen';
import { parseRich, type Token } from '../../text/rich';
import { opts, REVISED, type Wrong } from './util';

export interface Tanka {
  id: string;
  /** 5つの句（RichText） */
  ku: [string, string, string, string, string];
  season?: '春' | '夏' | '秋' | '冬';
}

export const TANKA: Tanka[] = [
  {
    id: 'sakura',
    season: '春',
    ku: [
      'さくら散《ち》る',
      '校庭《こうてい》のすみ',
      'ブランコに',
      'ひとりすわれば',
      '風《かぜ》のやさしさ',
    ],
  },
  {
    id: 'mugi',
    season: '夏',
    ku: [
      '夏休《なつやす》み',
      '麦《むぎ》わらぼうし',
      '風《かぜ》にのり',
      '青田《あおた》の上《うえ》を',
      'ゆっくりとゆく',
    ],
  },
  {
    id: 'tonbo',
    season: '秋',
    ku: [
      '赤《あか》とんぼ',
      '夕日《ゆうひ》の中《なか》を',
      '一列《いちれつ》に',
      '山《やま》へかえりぬ',
      '秋《あき》のゆうぐれ',
    ],
  },
  {
    id: 'yuki',
    season: '冬',
    ku: [
      '雪《ゆき》の朝《あさ》',
      'まどをあければ',
      '白《しろ》い道《みち》',
      'まだだれひとり',
      '歩《ある》いていない',
    ],
  },
  {
    id: 'soda',
    season: '夏',
    ku: [
      'しゅわしゅわと',
      'ソーダのあわが',
      'はじけたら',
      '空《そら》にきらきら',
      '夏《なつ》の星《ほし》ふる',
    ],
  },
  {
    id: 'tanpopo',
    season: '春',
    ku: [
      'たんぽぽの',
      'わた毛《げ》をふっと',
      'ふいたなら',
      '白《しろ》いかさたち',
      '空《そら》へとびたつ',
    ],
  },
  {
    id: 'mushi',
    season: '秋',
    ku: [
      '虫《むし》の声《こえ》',
      '草《くさ》のしげみに',
      'ひびきけり',
      '月《つき》のひかりの',
      'しずかなる夜《よる》',
    ],
  },
  {
    id: 'kotatsu',
    season: '冬',
    ku: [
      'こたつには',
      'みかんとねこと',
      'おばあちゃん',
      '冬《ふゆ》の日曜《にちよう》',
      'まるくなる午後《ごご》',
    ],
  },
  {
    id: 'nami',
    season: '夏',
    ku: [
      '波《なみ》の音《おと》',
      '耳《みみ》にのこして',
      '帰《かえ》り道《みち》',
      'ポケットの中《なか》',
      '貝《かい》がらひとつ',
    ],
  },
  {
    id: 'asagao',
    ku: [
      '朝顔《あさがお》の',
      'つるがのびゆく',
      'まどの外《そと》',
      'きょうも一《ひと》つの',
      '花《はな》ひらきけり',
    ],
  },
];

const song = (id: string): Tanka => {
  const t = TANKA.find((x) => x.id === id);
  if (!t) throw new Error(`tanka: 歌 ${id} が無い`);
  return t;
};

// ---- 音の数（問題文・ヒント・解説の作成用。テストは別に数える） ----

function kanaOf(src: string): string {
  const walk = (ts: Token[]): string =>
    ts
      .map((t) =>
        t.t === 'ruby'
          ? t.reading
          : t.t === 'text'
            ? t.s
            : t.t === 'strong'
              ? walk(t.children)
              : '',
      )
      .join('');
  return walk(parseRich(src))
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[^ぁ-ゖー]/g, '');
}

const SMALL = 'ゃゅょぁぃぅぇぉゎ';

/** 音（拍）に分ける。小さい「ゃゅょ」は前の字と1音 */
function moraOf(src: string): string[] {
  const out: string[] = [];
  for (const c of kanaOf(src)) {
    if (SMALL.includes(c) && out.length > 0) out[out.length - 1] += c;
    else out.push(c);
  }
  return out;
}

const countOf = (src: string): number => moraOf(src).length;
const kazu = (n: number): string => `${n}音《おん》`;

const SP = '　';
const quote = (s: string): string => `「${s}」`;

const ORD = [
  '一《ひと》つめ',
  '二《ふた》つめ',
  '三《みっ》つめ',
  '四《よっ》つめ',
  '五《いつ》つめ',
] as const;

/** 数の大きさ順に並べる（fixedOrder の選択肢） */
const byNumber = (xs: ChoiceOption[]): ChoiceOption[] =>
  [...xs].sort((a, b) => parseInt(a.label ?? '', 10) - parseInt(b.label ?? '', 10));

// ---- O1 oto: 音を数える（listen 12） ----

type Feat = 'small' | 'extra' | 'kanji';

interface OtoRow {
  song: string;
  /** 句の番号（1〜） */
  k: number;
  feat: Feat[];
  right: number;
  wrongs: [number, string][];
  alt?: boolean;
}

const OTO: OtoRow[] = [
  {
    song: 'soda',
    k: 1,
    feat: ['small'],
    right: 5,
    wrongs: [
      [4, 'tk-count'],
      [6, 'tk-count'],
      [7, 'tk-small'],
    ],
  },
  {
    song: 'kotatsu',
    k: 3,
    feat: ['small', 'extra'],
    right: 5,
    wrongs: [
      [3, 'tk-skip'],
      [4, 'tk-skip'],
      [6, 'tk-small'],
    ],
  },
  {
    song: 'mugi',
    k: 5,
    feat: ['extra'],
    right: 7,
    wrongs: [
      [5, 'tk-count'],
      [6, 'tk-skip'],
      [8, 'tk-count'],
    ],
  },
  {
    song: 'soda',
    k: 2,
    feat: ['extra'],
    right: 7,
    wrongs: [
      [6, 'tk-skip'],
      [8, 'tk-count'],
      [9, 'tk-count'],
    ],
  },
  {
    song: 'tanpopo',
    k: 1,
    feat: ['extra'],
    right: 5,
    wrongs: [
      [4, 'tk-skip'],
      [6, 'tk-count'],
      [7, 'tk-count'],
    ],
  },
  {
    song: 'asagao',
    k: 4,
    feat: ['small', 'extra', 'kanji'],
    right: 7,
    wrongs: [
      [6, 'tk-skip'],
      [8, 'tk-small'],
      [9, 'tk-count'],
    ],
  },
  {
    song: 'sakura',
    k: 2,
    feat: ['extra', 'kanji'],
    right: 7,
    wrongs: [
      [5, 'tk-kanji'],
      [6, 'tk-count'],
      [8, 'tk-count'],
    ],
  },
  {
    song: 'kotatsu',
    k: 4,
    feat: ['extra', 'kanji'],
    right: 7,
    wrongs: [
      [4, 'tk-kanji'],
      [5, 'tk-count'],
      [6, 'tk-skip'],
    ],
  },
  {
    song: 'nami',
    k: 4,
    feat: ['extra'],
    right: 7,
    wrongs: [
      [5, 'tk-count'],
      [6, 'tk-skip'],
      [8, 'tk-count'],
    ],
    alt: true,
  },
  {
    song: 'kotatsu',
    k: 2,
    feat: ['extra'],
    right: 7,
    wrongs: [
      [6, 'tk-skip'],
      [8, 'tk-count'],
      [9, 'tk-count'],
    ],
    alt: true,
  },
  {
    song: 'sakura',
    k: 3,
    feat: ['extra'],
    right: 5,
    wrongs: [
      [3, 'tk-count'],
      [4, 'tk-skip'],
      [6, 'tk-count'],
    ],
    alt: true,
  },
  {
    song: 'mugi',
    k: 2,
    feat: ['extra'],
    right: 7,
    wrongs: [
      [5, 'tk-count'],
      [6, 'tk-skip'],
      [8, 'tk-count'],
    ],
    alt: true,
  },
];

const FEAT_TEXT: Record<Feat, string> = {
  small:
    '小《ちい》さい「ゃ・ゅ・ょ」は、前《まえ》の字《じ》といっしょで一《ひと》つの音《おん》だよ。',
  extra: '「っ」「ん」「ー」や、のばす音《おん》も、一《ひと》つの音《おん》に数《かぞ》えるよ。',
  kanji: '漢字《かんじ》は、読《よ》み方《かた》の音《おん》で数《かぞ》えるよ。',
};
const FEAT_ORDER: Feat[] = ['small', 'extra', 'kanji'];

function otoItem(r: OtoRow): ListenItem {
  const ku = song(r.song).ku[r.k - 1]!;
  const mora = moraOf(ku);
  const feat = FEAT_ORDER.filter((f) => r.feat.includes(f))
    .map((f) => FEAT_TEXT[f])
    .join('');
  const options = byNumber([
    { label: kazu(r.right), correct: true },
    ...r.wrongs.map(([n, m]) => ({ label: kazu(n), misconception: m })),
  ]);
  return {
    id: `oto:${r.song}-${r.k}`,
    engine: 'listen',
    objective: 'oto',
    level: 0,
    ...(r.alt ? { alt: true } : {}),
    prompt: r.alt
      ? '聞《き》こえた句《く》は、いくつの音《おん》でできていますか。手《て》をたたきながら数《かぞ》えよう。'
      : 'この句《く》は、いくつの音《おん》でできていますか。',
    ...(r.alt ? {} : { figure: { kind: 'text', text: ku, size: 'l' } as const }),
    audio: { text: ku },
    options,
    fixedOrder: true,
    layout: 'row',
    hints: [
      '手《て》をたたきながら、一《ひと》つずつ声《こえ》に出《だ》して数《かぞ》えよう。',
      feat,
      `「${mora.slice(0, 3).join('・')}・…」とつづけて、さいごまで数《かぞ》えよう。`,
    ],
    explain: `「${mora.join('・')}」で${kazu(mora.length)}です。${feat}`,
    identity: `tanka:oto:${kanaOf(ku)}`,
  };
}

// ---- O2 kiru: 区切る（build 10 + listen 4） ----

interface KiruRow {
  song: string;
  part: 'kami' | 'shimo';
  /** 正しいタイル（順） */
  tiles: string[];
  /** まちがった区切りのタイル（順） */
  wrong: string[];
  mis: 'tk-split' | 'tk-kanji' | 'tk-skip';
}

const KIRU: KiruRow[] = [
  {
    song: 'sakura',
    part: 'kami',
    tiles: ['さくら散《ち》る', '校庭《こうてい》のすみ', 'ブランコに'],
    wrong: ['さくら', '散《ち》る校庭《こうてい》の', 'すみブランコに'],
    mis: 'tk-split',
  },
  {
    song: 'tonbo',
    part: 'kami',
    tiles: ['赤《あか》とんぼ', '夕日《ゆうひ》の中《なか》を', '一列《いちれつ》に'],
    wrong: ['赤《あか》とんぼ夕《ゆう》', '日《ひ》の中《なか》を一列《いちれつ》に'],
    mis: 'tk-kanji',
  },
  {
    song: 'soda',
    part: 'kami',
    tiles: ['しゅわしゅわと', 'ソーダのあわが', 'はじけたら'],
    wrong: ['しゅわしゅわ', 'とソーダのあわが'],
    mis: 'tk-split',
  },
  {
    song: 'mushi',
    part: 'kami',
    tiles: ['虫《むし》の声《こえ》', '草《くさ》のしげみに', 'ひびきけり'],
    wrong: ['虫《むし》の声《こえ》草《くさ》の', 'しげみにひびき', 'けり'],
    mis: 'tk-kanji',
  },
  {
    song: 'nami',
    part: 'kami',
    tiles: ['波《なみ》の音《おと》', '耳《みみ》にのこして', '帰《かえ》り道《みち》'],
    wrong: ['波《なみ》の音《おと》耳《みみ》に', 'のこして帰《かえ》り道《みち》'],
    mis: 'tk-kanji',
  },
  {
    song: 'mugi',
    part: 'shimo',
    tiles: ['青田《あおた》の上《うえ》を', 'ゆっくりとゆく'],
    wrong: ['青田《あおた》の上《うえ》', 'をゆっくりとゆく'],
    mis: 'tk-skip',
  },
  {
    song: 'yuki',
    part: 'shimo',
    tiles: ['まだだれひとり', '歩《ある》いていない'],
    wrong: ['まだだれ', 'ひとり', '歩《ある》いていない'],
    mis: 'tk-split',
  },
  {
    song: 'tanpopo',
    part: 'shimo',
    tiles: ['白《しろ》いかさたち', '空《そら》へとびたつ'],
    wrong: ['白《しろ》いかさ', 'たち空《そら》へとびたつ'],
    mis: 'tk-split',
  },
  {
    song: 'kotatsu',
    part: 'shimo',
    tiles: ['冬《ふゆ》の日曜《にちよう》', 'まるくなる午後《ごご》'],
    wrong: ['冬《ふゆ》の日曜《にちよう》まるく', 'なる午後《ごご》'],
    mis: 'tk-kanji',
  },
  {
    song: 'asagao',
    part: 'shimo',
    tiles: ['きょうも一《ひと》つの', '花《はな》ひらきけり'],
    wrong: ['きょうも一《ひと》つ', 'の花《はな》ひらきけり'],
    mis: 'tk-split',
  },
];

function kiruItem(r: KiruRow): BuildItem {
  const kami = r.part === 'kami';
  const counts = r.tiles.map((t) => `${quote(t)}（${kazu(countOf(t))}）`);
  const kanjiNote =
    r.mis === 'tk-kanji'
      ? '漢字《かんじ》は読《よ》み方《かた》の音《おん》で数《かぞ》えます。'
      : '';
  return {
    id: `kiru:${r.song}`,
    engine: 'build',
    objective: 'kiru',
    level: 1,
    prompt: kami
      ? '上《かみ》の句《く》を、五《ご》・七《しち》・五《ご》に区切《くぎ》ってならべよう。'
      : '下《しも》の句《く》を、七《しち》・七《しち》に区切《くぎ》ってならべよう。',
    figure: { kind: 'text', text: r.tiles.join(''), size: 'm' },
    tiles: [...r.tiles, ...r.wrong],
    answer: { kind: 'text', values: [r.tiles.join(' ')] },
    joiner: ' ',
    hideLength: true,
    wrongAnswers: [{ value: r.wrong.join(' '), misconception: r.mis }],
    hints: [
      kami
        ? '上《かみ》の句《く》は、五《ご》・七《しち》・五《ご》の三《みっ》つの句《く》に分《わ》かれるよ。'
        : '下《しも》の句《く》は、七《しち》・七《しち》の二《ふた》つの句《く》に分《わ》かれるよ。',
      kami
        ? 'はじめから手《て》をたたいて、五《いつ》つめの音《おん》のところで区切《くぎ》ろう。'
        : 'はじめから手《て》をたたいて、七《なな》つめの音《おん》のところで区切《くぎ》ろう。',
      `はじめの句《く》は${quote(r.tiles[0]!)}だよ。そのつぎの音《おん》から、また数《かぞ》えよう。`,
    ],
    explain: `${counts.join('、')}と区切《くぎ》ります。${kanjiNote}`,
    identity: `tanka:kiru:${r.song}:${kami ? 'kami' : 'shimo'}`,
  };
}

interface KiruListenRow {
  song: string;
  /** 問う句の番号（1〜） */
  k: number;
  wrongs: Wrong[];
}

const KIRU_LISTEN: KiruListenRow[] = [
  {
    song: 'yuki',
    k: 3,
    wrongs: [
      ['まどをあければ', 'tk-order'],
      ['まだだれひとり', 'tk-order'],
      ['あければ白《しろ》い', 'tk-split'],
    ],
  },
  {
    song: 'tanpopo',
    k: 2,
    wrongs: [
      ['たんぽぽの', 'tk-order'],
      ['ふいたなら', 'tk-order'],
      ['わた毛《げ》を', 'tk-split'],
    ],
  },
  {
    song: 'kotatsu',
    k: 4,
    wrongs: [
      ['おばあちゃん', 'tk-order'],
      ['まるくなる午後《ごご》', 'tk-order'],
      ['冬《ふゆ》の日曜《にちよう》まるく', 'tk-split'],
    ],
  },
  {
    song: 'asagao',
    k: 5,
    wrongs: [
      ['きょうも一《ひと》つの', 'tk-order'],
      ['まどの外《そと》', 'tk-order'],
      ['ひらきけり', 'tk-split'],
    ],
  },
];

function kiruListenItem(r: KiruListenRow): ListenItem {
  const t = song(r.song);
  const right = t.ku[r.k - 1]!;
  const prev = t.ku[r.k - 2]!;
  return {
    id: `kiru-kiku:${r.song}`,
    engine: 'listen',
    objective: 'kiru',
    level: 1,
    alt: true,
    prompt: `聞《き》こえた短歌《たんか》の${ORD[r.k - 1]}の句《く》はどれですか。`,
    audio: { text: t.ku.join('') },
    options: opts(right, r.wrongs),
    layout: 'column',
    hints: [
      '短歌《たんか》は、五《ご》・七《しち》・五《ご》・七《しち》・七《しち》の五《いつ》つの句《く》でできているよ。',
      'もういちど聞《き》いて、句《く》が一《ひと》つ終《お》わるごとに指《ゆび》を一本《いっぽん》ずつおろそう。',
      `${ORD[r.k - 2]}の句《く》は${quote(prev)}だよ。そのつぎの句《く》は何《なん》だったかな。`,
    ],
    explain: `${quote(t.ku.join(' '))}の${ORD[r.k - 1]}の句《く》は${quote(right)}です。`,
    identity: `tanka:kiru-listen:${r.song}`,
  };
}

// ---- O3 katachi: 短歌の形（listen 10 + build 4） ----

const audioOf = (t: Tanka) => t.ku.map((text) => ({ text }));
const kuFigure = (t: Tanka) => ({ kind: 'text', text: t.ku.join(SP), size: 'm' }) as const;

const KAMI_SHIMO_HINT =
  '短歌《たんか》は、上《かみ》の句《く》（五《ご》・七《しち》・五《ご》）と下《しも》の句《く》（七《しち》・七《しち》）に分《わ》かれるよ。';
const SHIMO_FIRST_PROMPT =
  'この短歌《たんか》の、下《しも》の句《く》のはじめの句《く》はどれですか。';
const KAMI_LAST_PROMPT =
  'この短歌《たんか》の、上《かみ》の句《く》のさいごの句《く》はどれですか。';

const halves = (t: Tanka): string =>
  `上《かみ》の句《く》は${quote(t.ku[0])}${quote(t.ku[1])}${quote(t.ku[2])}、下《しも》の句《く》は${quote(t.ku[3])}${quote(t.ku[4])}です。`;

const shimoFirstHints = (t: Tanka): string[] => [
  KAMI_SHIMO_HINT,
  '上《かみ》の句《く》は、はじめから三《みっ》つめの句《く》までだよ。',
  `上《かみ》の句《く》のさいごの句《く》は${quote(t.ku[2])}だよ。下《しも》の句《く》はそのつぎから始《はじ》まるよ。`,
];
const shimoFirstExplain = (t: Tanka): string =>
  `${halves(t)}下《しも》の句《く》のはじめは${quote(t.ku[3])}です。`;
const kamiLastHints = (t: Tanka): string[] => [
  KAMI_SHIMO_HINT,
  '上《かみ》の句《く》は、五《ご》・七《しち》・五《ご》の三《みっ》つの句《く》だよ。',
  `はじめから${quote(t.ku[0])}${quote(t.ku[1])}とつづけて、そのつぎで上《かみ》の句《く》が終《お》わるよ。`,
];
const kamiLastExplain = (t: Tanka): string =>
  `${halves(t)}上《かみ》の句《く》のさいごは${quote(t.ku[2])}です。`;

interface KatachiRow {
  id: string;
  identity: string;
  song: string;
  prompt: string;
  right: string;
  wrongs: Wrong[];
  hints: (t: Tanka) => string[];
  explain: (t: Tanka) => string;
  /** 数を選ぶ問題（小さい順に固定） */
  numeric?: boolean;
}

const KATACHI: KatachiRow[] = [
  {
    id: 'katachi:mugi',
    identity: 'tanka:katachi:mugi:shimo-first',
    song: 'mugi',
    prompt: SHIMO_FIRST_PROMPT,
    right: '青田《あおた》の上《うえ》を',
    wrongs: [
      ['風《かぜ》にのり', 'tk-katachi'],
      ['麦《むぎ》わらぼうし', 'tk-order'],
      ['ゆっくりとゆく', 'tk-order'],
    ],
    hints: shimoFirstHints,
    explain: shimoFirstExplain,
  },
  {
    id: 'katachi:tanpopo',
    identity: 'tanka:katachi:tanpopo:shimo-first',
    song: 'tanpopo',
    prompt: SHIMO_FIRST_PROMPT,
    right: '白《しろ》いかさたち',
    wrongs: [
      ['ふいたなら', 'tk-katachi'],
      ['わた毛《げ》をふっと', 'tk-order'],
      ['空《そら》へとびたつ', 'tk-order'],
    ],
    hints: shimoFirstHints,
    explain: shimoFirstExplain,
  },
  {
    id: 'katachi:nami',
    identity: 'tanka:katachi:nami:shimo-first',
    song: 'nami',
    prompt: SHIMO_FIRST_PROMPT,
    right: 'ポケットの中《なか》',
    wrongs: [
      ['帰《かえ》り道《みち》', 'tk-katachi'],
      ['耳《みみ》にのこして', 'tk-order'],
      ['貝《かい》がらひとつ', 'tk-order'],
    ],
    hints: shimoFirstHints,
    explain: shimoFirstExplain,
  },
  {
    id: 'katachi:yuki',
    identity: 'tanka:katachi:yuki:kami-last',
    song: 'yuki',
    prompt: KAMI_LAST_PROMPT,
    right: '白《しろ》い道《みち》',
    wrongs: [
      ['まだだれひとり', 'tk-katachi'],
      ['まどをあければ', 'tk-order'],
      ['雪《ゆき》の朝《あさ》', 'tk-order'],
    ],
    hints: kamiLastHints,
    explain: kamiLastExplain,
  },
  {
    id: 'katachi:kotatsu',
    identity: 'tanka:katachi:kotatsu:kami-last',
    song: 'kotatsu',
    prompt: KAMI_LAST_PROMPT,
    right: 'おばあちゃん',
    wrongs: [
      ['冬《ふゆ》の日曜《にちよう》', 'tk-katachi'],
      ['みかんとねこと', 'tk-order'],
      ['こたつには', 'tk-order'],
    ],
    hints: kamiLastHints,
    explain: kamiLastExplain,
  },
  {
    id: 'katachi:asagao',
    identity: 'tanka:katachi:asagao:kami-last',
    song: 'asagao',
    prompt: KAMI_LAST_PROMPT,
    right: 'まどの外《そと》',
    wrongs: [
      ['きょうも一《ひと》つの', 'tk-katachi'],
      ['つるがのびゆく', 'tk-order'],
      ['朝顔《あさがお》の', 'tk-order'],
    ],
    hints: kamiLastHints,
    explain: kamiLastExplain,
  },
  {
    id: 'katachi:all',
    identity: 'tanka:katachi:fact:all31',
    song: 'tonbo',
    prompt: 'この短歌《たんか》は、ぜんぶでいくつの音《おん》でできていますか。',
    right: kazu(31),
    numeric: true,
    wrongs: [
      [kazu(17), 'tk-haiku'],
      [kazu(24), 'tk-katachi'],
      [kazu(35), 'tk-count'],
    ],
    hints: () => [
      '短歌《たんか》の五《いつ》つの句《く》の音《おん》の数《かず》を、たし算《ざん》しよう。',
      '上《かみ》の句《く》は、5＋7＋5で17音《おん》だよ。',
      '17に、下《しも》の句《く》の7＋7をたそう。',
    ],
    explain: () =>
      '五《ご》・七《しち》・五《ご》・七《しち》・七《しち》で、5＋7＋5＋7＋7＝31。短歌《たんか》は三十一音《さんじゅういちおん》です。はいくは十七音《じゅうしちおん》です。',
  },
  {
    id: 'katachi:shimo',
    identity: 'tanka:katachi:fact:shimo14',
    song: 'mushi',
    prompt: 'この短歌《たんか》の下《しも》の句《く》は、いくつの音《おん》でできていますか。',
    right: kazu(14),
    numeric: true,
    wrongs: [
      [kazu(12), 'tk-count'],
      [kazu(17), 'tk-katachi'],
      [kazu(31), 'tk-katachi'],
    ],
    hints: () => [
      '下《しも》の句《く》は、四《よっ》つめと五《いつ》つめの句《く》だよ。',
      '下《しも》の句《く》の句《く》は、どちらも七音《しちおん》だよ。',
      '7＋7を計算《けいさん》しよう。',
    ],
    explain: () =>
      '下《しも》の句《く》は七《しち》・七《しち》なので、7＋7＝14で14音《おん》です。',
  },
  {
    id: 'katachi:kami',
    identity: 'tanka:katachi:fact:kami17',
    song: 'soda',
    prompt: 'この短歌《たんか》の上《かみ》の句《く》は、いくつの音《おん》でできていますか。',
    right: kazu(17),
    numeric: true,
    wrongs: [
      [kazu(14), 'tk-katachi'],
      [kazu(24), 'tk-katachi'],
      [kazu(31), 'tk-katachi'],
    ],
    hints: () => [
      '上《かみ》の句《く》は、はじめから三《みっ》つめの句《く》までだよ。',
      '上《かみ》の句《く》は、五《ご》・七《しち》・五《ご》だよ。',
      '5＋7＋5を計算《けいさん》しよう。',
    ],
    explain: () =>
      '上《かみ》の句《く》は五《ご》・七《しち》・五《ご》なので、5＋7＋5＝17で17音《おん》です。はいくと同《おな》じ音《おん》の数《かず》です。',
  },
  {
    id: 'katachi:ku',
    identity: 'tanka:katachi:fact:ku5',
    song: 'sakura',
    prompt: 'この短歌《たんか》は、いくつの句《く》でできていますか。',
    right: '5つ',
    numeric: true,
    wrongs: [
      ['3つ', 'tk-haiku'],
      ['6つ', 'tk-count'],
      ['7つ', 'tk-count'],
    ],
    hints: () => [
      'もういちど聞《き》いて、句《く》が一《ひと》つ終《お》わるごとに指《ゆび》をおろそう。',
      '短歌《たんか》は、上《かみ》の句《く》と下《しも》の句《く》に分《わ》かれるよ。',
      '上《かみ》の句《く》は三《みっ》つの句《く》。そこに下《しも》の句《く》の句《く》の数《かず》をたそう。',
    ],
    explain: () =>
      '上《かみ》の句《く》が三《みっ》つ、下《しも》の句《く》が二《ふた》つで、短歌《たんか》は五《いつ》つの句《く》でできています。はいくは三《みっ》つです。',
  },
];

function katachiItem(r: KatachiRow): ListenItem {
  const t = song(r.song);
  const options = r.numeric
    ? byNumber([
        { label: r.right, correct: true },
        ...r.wrongs.map(([label, m]) => ({ label, misconception: m })),
      ])
    : opts(r.right, r.wrongs);
  return {
    id: r.id,
    engine: 'listen',
    objective: 'katachi',
    level: 2,
    prompt: r.prompt,
    figure: kuFigure(t),
    audio: audioOf(t),
    gapMs: 600,
    options,
    ...(r.numeric ? { fixedOrder: true, layout: 'row' as const } : { layout: 'column' as const }),
    hints: r.hints(t),
    explain: r.explain(t),
    identity: r.identity,
  };
}

interface KatachiBuildRow {
  song: string;
  /** まぎらわしいタイル2つ */
  extra: [string, string];
  /** 誤答の並び（2枚のタイル）と誤概念 */
  wrongs: [[string, string], string][];
}

const KATACHI_BUILD: KatachiBuildRow[] = [
  {
    song: 'sakura',
    extra: ['風《かぜ》のおと', 'ひとりすわる'],
    wrongs: [
      [['ひとりすわれば', '風《かぜ》のおと'], 'tk-katachi'],
      [['ひとりすわる', '風《かぜ》のやさしさ'], 'tk-count'],
      [['風《かぜ》のやさしさ', 'ひとりすわれば'], 'tk-order'],
    ],
  },
  {
    song: 'tonbo',
    extra: ['秋《あき》の夕《ゆう》', '山《やま》へとかえりぬ'],
    wrongs: [
      [['山《やま》へかえりぬ', '秋《あき》の夕《ゆう》'], 'tk-katachi'],
      [['山《やま》へとかえりぬ', '秋《あき》のゆうぐれ'], 'tk-count'],
      [['秋《あき》のゆうぐれ', '山《やま》へかえりぬ'], 'tk-order'],
    ],
  },
  {
    song: 'soda',
    extra: ['星《ほし》がふる', '空《そら》にきらきらと'],
    wrongs: [
      [['空《そら》にきらきら', '星《ほし》がふる'], 'tk-katachi'],
      [['空《そら》にきらきらと', '夏《なつ》の星《ほし》ふる'], 'tk-count'],
      [['夏《なつ》の星《ほし》ふる', '空《そら》にきらきら'], 'tk-order'],
    ],
  },
  {
    song: 'mushi',
    extra: ['月《つき》のかげ', 'しずかな夜《よる》'],
    wrongs: [
      [['月《つき》のかげ', 'しずかなる夜《よる》'], 'tk-katachi'],
      [['月《つき》のひかりの', 'しずかな夜《よる》'], 'tk-count'],
      [['しずかなる夜《よる》', '月《つき》のひかりの'], 'tk-order'],
    ],
  },
];

function katachiBuildItem(r: KatachiBuildRow): BuildItem {
  const t = song(r.song);
  const k4 = t.ku[3];
  const k5 = t.ku[4];
  return {
    id: `katachi-tsukuru:${r.song}`,
    engine: 'build',
    objective: 'katachi',
    level: 2,
    alt: true,
    prompt:
      'この上《かみ》の句《く》につづく下《しも》の句《く》を、七《しち》・七《しち》になるようにタイルでつくろう。',
    figure: { kind: 'text', text: t.ku.slice(0, 3).join(SP), size: 'm' },
    tiles: [k4, k5, ...r.extra],
    answer: { kind: 'text', values: [`${k4} ${k5}`] },
    joiner: ' ',
    wrongAnswers: r.wrongs.map(([[a, b], m]) => ({ value: `${a} ${b}`, misconception: m })),
    hints: [
      '下《しも》の句《く》は、七《しち》・七《しち》の二《ふた》つの句《く》だよ。',
      'タイルの音《おん》を一《ひと》つずつ数《かぞ》えて、七音《しちおん》のタイルを見《み》つけよう。',
      `はじめの句《く》は${quote(k4)}だよ。そのあとにつづく七音《しちおん》の句《く》は？`,
    ],
    explain: `下《しも》の句《く》は${quote(k4)}（${kazu(countOf(k4))}）と${quote(k5)}（${kazu(countOf(k5))}）です。${quote(t.ku[0])}から読《よ》むと、五《ご》・七《しち》・五《ご》・七《しち》・七《しち》のリズムになります。`,
    identity: `tanka:katachi-build:${r.song}`,
  };
}

// ---- O4 yousu: ようす・季節（listen 11 + 5） ----

interface YousuRow {
  id: string;
  song: string;
  prompt: string;
  right: string;
  wrongs: Wrong[];
  hints: [string, string, string];
  explain: string;
}

const YOUSU: YousuRow[] = [
  {
    id: 'yousu:sakura',
    song: 'sakura',
    prompt: 'この短歌《たんか》の人《ひと》は、どこにすわっていますか。',
    right: 'ブランコ',
    wrongs: [
      ['さくらの木《き》の下《した》', 'tk-scene'],
      ['教室《きょうしつ》のいす', 'tk-scene'],
      ['すな場《ば》', 'tk-scene'],
    ],
    hints: [
      '短歌《たんか》をもういちど聞《き》いて、人《ひと》がいる場所《ばしょ》をさがそう。',
      '四《よっ》つめの句《く》「ひとりすわれば」に気《き》をつけよう。',
      'すわった場所《ばしょ》は、そのすぐ前《まえ》の句《く》に書《か》いてあるよ。',
    ],
    explain: '「ブランコに ひとりすわれば」とあるので、ブランコにすわっています。',
  },
  {
    id: 'yousu:mugi',
    song: 'mugi',
    prompt: '麦《むぎ》わらぼうしは、どうなりましたか。',
    right: '風《かぜ》にのってとんだ',
    wrongs: [
      ['田《た》んぼに落《お》ちた', 'tk-scene'],
      ['あたまにかぶったまま', 'tk-scene'],
      ['雨《あめ》でぬれた', 'tk-scene'],
    ],
    hints: [
      'ぼうしが出《で》てきたあとの句《く》をよく聞《き》こう。',
      '三《みっ》つめの句《く》は「風《かぜ》にのり」だよ。',
      '風《かぜ》にのったぼうしは、そのあと「青田《あおた》の上《うえ》を」どうしたかな。',
    ],
    explain:
      '「風《かぜ》にのり 青田《あおた》の上《うえ》を ゆっくりとゆく」とあるので、ぼうしは風《かぜ》にのってとんでいきました。「青田《あおた》」は、いねが青《あお》くそだった田《た》んぼです。',
  },
  {
    id: 'yousu:tonbo',
    song: 'tonbo',
    prompt: '赤《あか》とんぼは、どのようにとんでいますか。',
    right: '一列《いちれつ》にならんで',
    wrongs: [
      ['ばらばらに', 'tk-scene'],
      ['くるくるまわって', 'tk-scene'],
      ['一《いっ》ぴきだけで', 'tk-scene'],
    ],
    hints: [
      '赤《あか》とんぼが出《で》てくる句《く》のあとをよく聞《き》こう。',
      '三《みっ》つめの句《く》に、とび方《かた》が書《か》いてあるよ。',
      '「一列《いちれつ》」は、たてやよこに一《ひと》つのれつになることだよ。',
    ],
    explain:
      '「一列《いちれつ》に」とあるので、赤《あか》とんぼは一列《いちれつ》にならんでとんでいます。',
  },
  {
    id: 'yousu:tonbo-bungo',
    song: 'tonbo',
    prompt: '「山《やま》へかえりぬ」は、どういう意味《いみ》ですか。',
    right: '山《やま》へかえった',
    wrongs: [
      ['山《やま》へかえらない', 'tk-bungo'],
      ['山《やま》からきた', 'tk-scene'],
      ['山《やま》にのぼる', 'tk-scene'],
    ],
    hints: [
      'むかしの言《い》い方《かた》の「〜ぬ」に気《き》をつけよう。',
      'ここの「ぬ」は、「〜ない」という意味《いみ》ではないよ。',
      '「かえりぬ」の「ぬ」は、そのことがすっかり終《お》わったことを表《あらわ》すよ。',
    ],
    explain:
      '「かえりぬ」の「ぬ」は、「〜してしまった」という意味《いみ》のむかしの言《い》い方《かた》です。赤《あか》とんぼは山《やま》へかえっていきました。',
  },
  {
    id: 'yousu:yuki',
    song: 'yuki',
    prompt: '道《みち》は、どんなようすですか。',
    right: 'だれも歩《ある》いていない',
    wrongs: [
      ['足《あし》あとがたくさん', 'tk-scene'],
      ['雪《ゆき》がとけている', 'tk-scene'],
      ['車《くるま》が通《とお》っている', 'tk-scene'],
    ],
    hints: [
      '道《みち》が出《で》てくる句《く》のあとをよく聞《き》こう。',
      '四《よっ》つめの句《く》は「まだだれひとり」だよ。',
      '「まだだれひとり」のあとに、どんなことばがつづいていたかな。',
    ],
    explain:
      '「まだだれひとり 歩《ある》いていない」とあるので、雪《ゆき》の道《みち》にはまだ足《あし》あとがありません。',
  },
  {
    id: 'yousu:soda',
    song: 'soda',
    prompt: '「しゅわしゅわと」は、何《なに》の音《おと》ですか。',
    right: 'ソーダのあわ',
    wrongs: [
      ['夏《なつ》の星《ほし》', 'tk-scene'],
      ['雨《あめ》', 'tk-scene'],
      ['風《かぜ》', 'tk-scene'],
    ],
    hints: [
      '「しゅわしゅわと」のすぐあとの句《く》をよく聞《き》こう。',
      '二《ふた》つめの句《く》は「ソーダのあわが」だよ。',
      'しゅわしゅわと音《おと》を立《た》てて、はじけたのは何《なに》かな。',
    ],
    explain:
      '「しゅわしゅわと ソーダのあわが はじけたら」とあるので、ソーダのあわがはじける音《おと》です。',
  },
  {
    id: 'yousu:tanpopo',
    song: 'tanpopo',
    prompt: '「白《しろ》いかさたち」は、何《なに》のことですか。',
    right: 'たんぽぽのわた毛《げ》',
    wrongs: [
      ['雨《あめ》の日《ひ》のかさ', 'tk-literal'],
      ['白《しろ》い雲《くも》', 'tk-scene'],
      ['白《しろ》い鳥《とり》', 'tk-scene'],
    ],
    hints: [
      '「白《しろ》いかさたち」の前《まえ》の句《く》をよく聞《き》こう。',
      'ふっとふいたのは、「たんぽぽの」何《なに》だったかな。',
      'それがふわふわと空《そら》へとんでいくようすを、かさにたとえているよ。',
    ],
    explain:
      'たんぽぽのわた毛《げ》がとんでいくようすを、「白《しろ》いかさたち」とたとえています。',
  },
  {
    id: 'yousu:mushi',
    song: 'mushi',
    prompt: 'この短歌《たんか》で聞《き》こえている音《おと》は何《なん》ですか。',
    right: '虫《むし》の声《こえ》',
    wrongs: [
      ['風《かぜ》の音《おと》', 'tk-scene'],
      ['雨《あめ》の音《おと》', 'tk-scene'],
      ['鳥《とり》の声《こえ》', 'tk-scene'],
    ],
    hints: [
      '一《ひと》つめの句《く》をよく聞《き》こう。',
      '「ひびきけり」は、音《おと》がひびいていることだよ。',
      '草《くさ》のしげみの中《なか》で、声《こえ》を出《だ》しているものは何《なに》かな。',
    ],
    explain:
      '「虫《むし》の声《こえ》 草《くさ》のしげみに ひびきけり」とあるので、虫《むし》の声《こえ》が聞《き》こえています。',
  },
  {
    id: 'yousu:kotatsu',
    song: 'kotatsu',
    prompt: 'この短歌《たんか》は、いつのことですか。',
    right: '冬《ふゆ》の日曜《にちよう》の午後《ごご》',
    wrongs: [
      ['冬《ふゆ》の日曜《にちよう》の朝《あさ》', 'tk-scene'],
      ['夏休《なつやす》みの午後《ごご》', 'tk-season'],
      ['冬《ふゆ》の夜《よる》', 'tk-scene'],
    ],
    hints: [
      '季節《きせつ》や日《ひ》、時《とき》がわかることばをさがそう。',
      '四《よっ》つめの句《く》は「冬《ふゆ》の日曜《にちよう》」だよ。',
      '五《いつ》つめの句《く》のさいごのことばが、一日《いちにち》のいつかを表《あらわ》しているよ。',
    ],
    explain:
      '「冬《ふゆ》の日曜《にちよう》」「まるくなる午後《ごご》」とあるので、冬《ふゆ》の日曜《にちよう》の午後《ごご》のことです。',
  },
  {
    id: 'yousu:nami',
    song: 'nami',
    prompt: 'ポケットの中《なか》には、何《なに》が入《はい》っていますか。',
    right: '貝《かい》がら',
    wrongs: [
      ['波《なみ》の音《おと》', 'tk-scene'],
      ['小《ちい》さな石《いし》', 'tk-scene'],
      ['すな', 'tk-scene'],
    ],
    hints: [
      'ポケットが出《で》てくる句《く》のあとをよく聞《き》こう。',
      '「波《なみ》の音《おと》」は、耳《みみ》にのこしたものだよ。',
      '五《いつ》つめの句《く》に、ポケットの中《なか》のものが書《か》いてあるよ。',
    ],
    explain:
      '「ポケットの中《なか》 貝《かい》がらひとつ」とあるので、ポケットには貝《かい》がらが入《はい》っています。波《なみ》の音《おと》は耳《みみ》にのこしたものです。',
  },
  {
    id: 'yousu:asagao',
    song: 'asagao',
    prompt: '朝顔《あさがお》の花《はな》は、きょういくつさきましたか。',
    right: '一《ひと》つ',
    wrongs: [
      ['二《ふた》つ', 'tk-scene'],
      ['たくさん', 'tk-scene'],
      ['まださいていない', 'tk-bungo'],
    ],
    hints: [
      '四《よっ》つめと五《いつ》つめの句《く》をよく聞《き》こう。',
      '「ひらきけり」は「ひらいたなあ」という意味《いみ》だよ。',
      '「きょうも一《ひと》つの」につづけて読《よ》もう。',
    ],
    explain:
      '「きょうも一《ひと》つの 花《はな》ひらきけり」とあるので、きょうさいた花《はな》は一《ひと》つです。「ひらきけり」は「ひらいたなあ」という意味《いみ》です。',
  },
];

function yousuItem(r: YousuRow): ListenItem {
  const t = song(r.song);
  return {
    id: r.id,
    engine: 'listen',
    objective: 'yousu',
    level: 3,
    prompt: r.prompt,
    figure: kuFigure(t),
    audio: audioOf(t),
    gapMs: 600,
    options: opts(r.right, r.wrongs),
    layout: 'column',
    hints: [...r.hints],
    explain: r.explain,
    identity: `tanka:yousu:${r.id.slice('yousu:'.length)}`,
  };
}

type Season = '春' | '夏' | '秋' | '冬';

interface KisetsuRow {
  song: string;
  right: Season;
  h2: string;
  h3: string;
  explain: string;
}

const KISETSU: KisetsuRow[] = [
  {
    song: 'sakura',
    right: '春',
    h2: '一《ひと》つめの句《く》の「さくら」に気《き》をつけよう。',
    h3: 'さくらの花《はな》がちるのは、新《あたら》しい学年《がくねん》が始《はじ》まるころだよ。',
    explain: '「さくら散《ち》る」とあるので、春《はる》の歌《うた》です。',
  },
  {
    song: 'tanpopo',
    right: '春',
    h2: '一《ひと》つめの句《く》の「たんぽぽ」に気《き》をつけよう。',
    h3: 'たんぽぽは、さくらと同《おな》じころに花《はな》がさき、そのあとわた毛《げ》になるよ。',
    explain: 'たんぽぽのわた毛《げ》がとぶのは春《はる》です。春《はる》の歌《うた》です。',
  },
  {
    song: 'soda',
    right: '夏',
    h2: '五《いつ》つめの句《く》をよく聞《き》こう。',
    h3: '五《いつ》つめの句《く》に、季節《きせつ》の名前《なまえ》がそのまま入《はい》っているよ。',
    explain: '「夏《なつ》の星《ほし》ふる」とあるので、夏《なつ》の歌《うた》です。',
  },
  {
    song: 'mushi',
    right: '秋',
    h2: '一《ひと》つめの句《く》の「虫《むし》の声《こえ》」に気《き》をつけよう。',
    h3: '草《くさ》むらで虫《むし》がたくさん鳴《な》き、月《つき》がきれいに見《み》えるのは、夏《なつ》が終《お》わったあとの季節《きせつ》だよ。',
    explain:
      '草《くさ》むらで鳴《な》く虫《むし》の声《こえ》と月《つき》は、秋《あき》を表《あらわ》すことばです。秋《あき》の歌《うた》です。',
  },
  {
    song: 'yuki',
    right: '冬',
    h2: '一《ひと》つめの句《く》の「雪《ゆき》」に気《き》をつけよう。',
    h3: '雪《ゆき》がつもるのは、一年《いちねん》でいちばん寒《さむ》いころだよ。',
    explain: '「雪《ゆき》の朝《あさ》」とあるので、冬《ふゆ》の歌《うた》です。',
  },
];

const SEASONS: { key: Season; label: string; illust: string }[] = [
  { key: '春', label: '春《はる》', illust: 'life-cherry' },
  { key: '夏', label: '夏《なつ》', illust: 'life-swimring' },
  { key: '秋', label: '秋《あき》', illust: 'life-redleaf' },
  { key: '冬', label: '冬《ふゆ》', illust: 'life-snowman' },
];

function kisetsuItem(r: KisetsuRow): ListenItem {
  const t = song(r.song);
  return {
    id: `kisetsu:${r.song}`,
    engine: 'listen',
    objective: 'yousu',
    level: 3,
    alt: true,
    prompt: '聞《き》こえた短歌《たんか》は、どの季節《きせつ》の歌《うた》ですか。',
    audio: audioOf(t),
    gapMs: 600,
    options: SEASONS.map((s) => ({
      label: s.label,
      figure: { kind: 'illust' as const, id: s.illust },
      ...(s.key === r.right ? { correct: true } : { misconception: 'tk-season' }),
    })),
    fixedOrder: true,
    layout: 'row',
    hints: ['季節《きせつ》がわかることばをさがしながら聞《き》こう。', r.h2, r.h3],
    explain: r.explain,
    identity: `tanka:kisetsu:${r.song}`,
  };
}

// ---- 単元 ----

const ITEMS: Item[] = [
  ...OTO.map(otoItem),
  ...KIRU.map(kiruItem),
  ...KIRU_LISTEN.map(kiruListenItem),
  ...KATACHI.map(katachiItem),
  ...KATACHI_BUILD.map(katachiBuildItem),
  ...YOUSU.map(yousuItem),
  ...KISETSU.map(kisetsuItem),
];

export const tanka: UnitSpec = {
  id: 'g4.ja.tanka',
  title: '短歌《たんか》の音読《おんどく》',
  stage: 'g4',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'knowledge',
  priority: 'P2',
  status: 'ready',
  icon: 'notebook',
  prereq: ['g3.ja.haiku'],
  objectives: [
    {
      id: 'oto',
      title:
        '句《く》の音《おん》の数《かず》を数《かぞ》える（小《ちい》さい「ゃゅょ」・「っ」「ん」・のばす音《おん》）',
    },
    { id: 'kiru', title: '五《ご》・七《しち》・五《ご》・七《しち》・七《しち》に区切《くぎ》る' },
    {
      id: 'katachi',
      title:
        '短歌《たんか》の形《かたち》（上《かみ》の句《く》・下《しも》の句《く》・三十一音《さんじゅういちおん》）を知《し》る',
    },
    { id: 'yousu', title: '歌《うた》のようすや季節《きせつ》を思《おも》いうかべる' },
  ],
  misconceptions: [
    {
      id: 'tk-small',
      explain:
        '小《ちい》さい「ゃ」「ゅ」「ょ」も、一《ひと》つの音《おん》と数《かぞ》えたのかな。「ちゃ」「しゅ」「きょ」は、前《まえ》の字《じ》といっしょで一《ひと》つの音《おん》だよ。手《て》をたたくと「ちゃ」で一回《いっかい》だね。',
    },
    {
      id: 'tk-skip',
      explain:
        '「っ」「ん」や、のばす音《おん》（「ー」や「ぼうし」の「う」）を数《かぞ》えなかったのかな。短歌《たんか》では、どれも一《ひと》つの音《おん》に数《かぞ》えるよ。「ゆっくり」は「ゆ・っ・く・り」で4音《おん》だね。',
    },
    {
      id: 'tk-kanji',
      explain:
        '漢字《かんじ》一字《いちじ》を一《ひと》つの音《おん》と数《かぞ》えたのかな。音《おん》は読《よ》み方《かた》で数《かぞ》えるよ。「校庭《こうてい》」は二字《にじ》だけど、「こ・う・て・い」で4音《おん》だね。',
    },
    {
      id: 'tk-count',
      explain:
        'とちゅうで数《かぞ》えまちがえたのかな。一《ひと》つの音《おん》で手《て》を一回《いっかい》たたきながら、ゆっくり数《かぞ》えなおそう。',
    },
    {
      id: 'tk-split',
      explain:
        'ことばのまとまりだけを見《み》て区切《くぎ》ったのかな。短歌《たんか》は、音《おん》の数《かず》で五《ご》・七《しち》・五《ご》・七《しち》・七《しち》に区切《くぎ》るよ。はじめから手《て》をたたいて、五《いつ》つめ、七《なな》つめで区切《くぎ》ろう。',
    },
    {
      id: 'tk-order',
      explain:
        '句《く》の順番《じゅんばん》を数《かぞ》えまちがえたのかな。はじめの句《く》から「一《ひと》つめ、二《ふた》つめ」と指《ゆび》をおって数《かぞ》えよう。',
    },
    {
      id: 'tk-katachi',
      explain:
        '上《かみ》の句《く》と下《しも》の句《く》の分《わ》かれ目《め》を取《と》りちがえたのかな。上《かみ》の句《く》は五《ご》・七《しち》・五《ご》の三《みっ》つ、下《しも》の句《く》は七《しち》・七《しち》の二《ふた》つだよ。',
    },
    {
      id: 'tk-haiku',
      explain:
        'はいくと同《おな》じだと考《かんが》えたのかな。はいくは五《ご》・七《しち》・五《ご》の十七音《じゅうしちおん》、短歌《たんか》はそのあとに七《しち》・七《しち》がつづいて三十一音《さんじゅういちおん》だよ。',
    },
    {
      id: 'tk-scene',
      explain:
        '歌《うた》にないことを思《おも》いうかべたのかな。歌《うた》のことばをもういちど一《ひと》つずつ読《よ》んで、書《か》いてあることからようすを考《かんが》えよう。',
    },
    {
      id: 'tk-literal',
      explain:
        'ことばを字《じ》のとおりに受《う》け取《と》ったのかな。短歌《たんか》では、あるものをべつのものにたとえて書《か》くことがあるよ。前《まえ》の句《く》とつなげて考《かんが》えよう。',
    },
    {
      id: 'tk-bungo',
      explain:
        'むかしの言《い》い方《かた》を、今《いま》の言《い》い方《かた》と同《おな》じだと考《かんが》えたのかな。短歌《たんか》の「〜ぬ」「〜けり」は、「〜した」「〜したなあ」という意味《いみ》になることがあるよ。「かえりぬ」は「かえった」だよ。',
    },
    {
      id: 'tk-season',
      explain:
        '季節《きせつ》のことばを取《と》りちがえたのかな。歌《うた》の中《なか》の、季節《きせつ》がわかることば（花《はな》・生《い》き物《もの》・天気《てんき》など）をさがそう。',
    },
  ],
  levels: [
    { label: '音を数える', chance: 0.05 },
    { label: '五・七・五・七・七に区切る', chance: 0.05 },
    { label: '短歌の形', chance: 0.05 },
    { label: 'ようすを思いうかべる', chance: 0.05 },
  ],
  intro: [
    {
      text: '短歌《たんか》は、五《ご》・七《しち》・五《ご》・七《しち》・七《しち》の三十一音《さんじゅういちおん》でできた、みじかい歌《うた》です。',
      figure: {
        kind: 'text',
        text: 'さくら散《ち》る（5）／校庭《こうてい》のすみ（7）／ブランコに（5）／ひとりすわれば（7）／風《かぜ》のやさしさ（7）',
        size: 'm',
      },
    },
    {
      text: 'はじめの五《ご》・七《しち》・五《ご》を上《かみ》の句《く》、あとの七《しち》・七《しち》を下《しも》の句《く》といいます。はいくは五《ご》・七《しち》・五《ご》の十七音《じゅうしちおん》で、短歌《たんか》は下《しも》の句《く》の七《しち》・七《しち》がつづきます。',
      figure: {
        kind: 'text',
        text: '上《かみ》の句《く》＝五《ご》・七《しち》・五《ご》　下《しも》の句《く》＝七《しち》・七《しち》',
        size: 'm',
      },
    },
    {
      text: '音《おん》は、手《て》をたたいて数《かぞ》えます。小《ちい》さい「ゃ・ゅ・ょ」は前《まえ》の字《じ》といっしょに一《ひと》つ、「っ」「ん」「ー」はそれぞれ一《ひと》つと数《かぞ》えます。',
      figure: { kind: 'text', text: 'お・ば・あ・ちゃ・ん（5音《おん》）', size: 'l' },
    },
    {
      text: '句《く》と句《く》の間《あいだ》で少《すこ》し間《ま》をとって読《よ》むと、リズムよく音読《おんどく》できます。歌《うた》のようすを思《おも》いうかべながら読《よ》みましょう。',
    },
  ],
  source: { kind: 'items', items: ITEMS },
  review: 'none',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第3学年及び第4学年〔知識及び技能〕(3)ア（易しい文語調の短歌や俳句を音読したり暗唱したりするなどして、言葉の響きやリズムに親しむこと）。歌はすべて本アプリのオリジナル',
  gradeIsAppProposal: true,
  revised: REVISED,
};
