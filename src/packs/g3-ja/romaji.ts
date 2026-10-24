/**
 * g3.ja.romaji ローマ字の 読み書き（curriculum-matrix 3.6）。
 * 国語のローマ字（令和7年内閣告示「ローマ字のつづり方」。ヘボン式に準ずる）。ローマ字入力（タイピング）とは別の単元。
 *
 * 音の表（清音・濁音・半濁音・拗音・ん）→ 語を読む（選ぶ）→ 語をタイルで書く → 長音・促音・撥音・拗音 → 地名・人名（語頭を大文字）。
 * 判定は build の answer { kind: 'romaji' }（ō・ou・oo を許容、訓令式は「もう一度」）。
 * 問題はこのファイルの音の表と語の表から組み立てる（読み方の正しさは romaji.test.ts で judgeRomaji と照合）。
 *
 * 同一性キー: 音 × 形式（table:read / table:write）、語 × 読む・書く（word:read / word:write）、句（phrase）、名前の選択（cap:choose）。
 * 音の表から外したもの: ぢ・づ（じ・ず と同じ つづり）、を（お と同じ つづり）。読む問題で答えが2つになるため。
 */
import type { BuildItem, ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import { opts, REVISED, type Wrong } from './util';

// ---- 音の表 ----
interface Row {
  /** 行の名前（「か行」） */
  name: string;
  kana: (string | null)[];
  ro: (string | null)[];
}
// prettier-ignore
const ROWS: Row[] = [
  { name: 'あ', kana: ['あ', 'い', 'う', 'え', 'お'], ro: ['a', 'i', 'u', 'e', 'o'] },
  { name: 'か', kana: ['か', 'き', 'く', 'け', 'こ'], ro: ['ka', 'ki', 'ku', 'ke', 'ko'] },
  { name: 'さ', kana: ['さ', 'し', 'す', 'せ', 'そ'], ro: ['sa', 'shi', 'su', 'se', 'so'] },
  { name: 'た', kana: ['た', 'ち', 'つ', 'て', 'と'], ro: ['ta', 'chi', 'tsu', 'te', 'to'] },
  { name: 'な', kana: ['な', 'に', 'ぬ', 'ね', 'の'], ro: ['na', 'ni', 'nu', 'ne', 'no'] },
  { name: 'は', kana: ['は', 'ひ', 'ふ', 'へ', 'ほ'], ro: ['ha', 'hi', 'fu', 'he', 'ho'] },
  { name: 'ま', kana: ['ま', 'み', 'む', 'め', 'も'], ro: ['ma', 'mi', 'mu', 'me', 'mo'] },
  { name: 'や', kana: ['や', null, 'ゆ', null, 'よ'], ro: ['ya', null, 'yu', null, 'yo'] },
  { name: 'ら', kana: ['ら', 'り', 'る', 'れ', 'ろ'], ro: ['ra', 'ri', 'ru', 're', 'ro'] },
  { name: 'わ', kana: ['わ', null, null, null, null], ro: ['wa', null, null, null, null] },
  { name: 'が', kana: ['が', 'ぎ', 'ぐ', 'げ', 'ご'], ro: ['ga', 'gi', 'gu', 'ge', 'go'] },
  { name: 'ざ', kana: ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'], ro: ['za', 'ji', 'zu', 'ze', 'zo'] },
  { name: 'だ', kana: ['だ', null, null, 'で', 'ど'], ro: ['da', null, null, 'de', 'do'] },
  { name: 'ば', kana: ['ば', 'び', 'ぶ', 'べ', 'ぼ'], ro: ['ba', 'bi', 'bu', 'be', 'bo'] },
  { name: 'ぱ', kana: ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'], ro: ['pa', 'pi', 'pu', 'pe', 'po'] },
];
/** 清音の行（0〜9）と濁音・半濁音の行（10〜14） */
const SEION_ROWS = 10;
/** 清音 ↔ 濁音・半濁音 */
const DAKU_PAIR: Record<number, number> = {
  1: 10,
  10: 1,
  2: 11,
  11: 2,
  3: 12,
  12: 3,
  5: 13,
  13: 5,
  14: 13,
};

interface KanaInfo {
  r: number;
  v: number;
  ro: string;
}
const KANA = new Map<string, KanaInfo>();
ROWS.forEach((row, r) =>
  row.kana.forEach((k, v) => {
    if (k) KANA.set(k, { r, v, ro: row.ro[v]! });
  }),
);
/** 語の中だけで使う（表の問題には出さない） */
const EXTRA_RO: Record<string, string> = { ぢ: 'ji', づ: 'zu', を: 'o' };

// prettier-ignore
const YOON_HEAD: [string, string][] = [
  ['き', 'ky'], ['し', 'sh'], ['ち', 'ch'], ['に', 'ny'], ['ひ', 'hy'], ['み', 'my'],
  ['り', 'ry'], ['ぎ', 'gy'], ['じ', 'j'], ['び', 'by'], ['ぴ', 'py'],
];
const YOON = new Map(YOON_HEAD);
const SMALL: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
const BIG: Record<string, string> = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' };
const SMALLS = ['ゃ', 'ゅ', 'ょ'];
// prettier-ignore
const KUNREI: Record<string, string> = {
  shi: 'si', chi: 'ti', tsu: 'tu', fu: 'hu', ji: 'zi', sha: 'sya', shu: 'syu', sho: 'syo',
  cha: 'tya', chu: 'tyu', cho: 'tyo', ja: 'zya', ju: 'zyu', jo: 'zyo',
};
const MACRON: Record<string, string> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

const isKata = (c: string) => /[ァ-ヶ]/.test(c);
const toHira = (c: string) => (isKata(c) ? String.fromCharCode(c.charCodeAt(0) - 0x60) : c);
const toKata = (c: string) => String.fromCharCode(c.charCodeAt(0) + 0x60);
/** like の字種（ひらがな・カタカナ）にそろえる */
const sameScript = (like: string, h: string) => (isKata(like) ? [...h].map(toKata).join('') : h);

// ---- 語を音に分ける ----
interface Syl {
  /** 元の字（っ・ゃ を含む） */
  kana: string;
  /** 元の語の中の位置（字の番号） */
  at: number;
  ro: string;
  /** 長音（前の音を のばす字） */
  long?: boolean;
  sok?: boolean;
  yoon?: boolean;
  /** b・m・p の前の ん */
  nb?: boolean;
  /** ふつうの1字の音（誤りの選択肢を作るのに使う） */
  base?: boolean;
}

function syllables(word: string): Syl[] {
  const w = [...word];
  const out: Syl[] = [];
  let sokAt = -1;
  for (let i = 0; i < w.length; i++) {
    const ch = w[i]!;
    const h = toHira(ch);
    const next = w[i + 1] !== undefined ? toHira(w[i + 1]!) : undefined;
    if (h === 'っ') {
      sokAt = i;
      continue;
    }
    if (ch === 'ー') {
      const p = out[out.length - 1]!;
      out.push({ kana: ch, at: i, ro: p.ro.slice(-1), long: true });
      continue;
    }
    if (h === 'ん') {
      const n2 = next ? (KANA.get(next)?.ro ?? '') : '';
      out.push({ kana: ch, at: i, ro: 'n', nb: /^[bmp]/.test(n2) });
      continue;
    }
    let s: Syl;
    if (next && SMALL[next] && YOON.has(h)) {
      s = { kana: ch + w[i + 1]!, at: i, ro: YOON.get(h)! + SMALL[next]!, yoon: true };
      i++;
    } else {
      const ro = KANA.get(h)?.ro ?? EXTRA_RO[h];
      if (!ro) throw new Error(`romaji unit: かなが表に無い ${ch} (${word})`);
      const p = out[out.length - 1];
      if (p && sokAt < 0 && /^[aiueo]$/.test(ro)) {
        const pv = p.ro.slice(-1);
        if (/[aueo]/.test(pv) && (ro === pv || (pv === 'o' && ro === 'u'))) {
          out.push({ kana: ch, at: i, ro, long: true });
          continue;
        }
      }
      s = { kana: ch, at: i, ro, base: KANA.has(h) };
    }
    if (sokAt >= 0) {
      s = {
        ...s,
        kana: w[sokAt]! + s.kana,
        at: sokAt,
        ro: s.ro[0]! + s.ro,
        sok: true,
        base: false,
      };
      sokAt = -1;
    }
    out.push(s);
  }
  return out;
}

/** 告示のつづり（長音符号を使う形）。読む問題の図に出す */
function canonical(word: string): string {
  let s = '';
  for (const y of syllables(word)) {
    if (y.long) s = s.slice(0, -1) + MACRON[s.slice(-1)]!;
    else s += y.ro;
  }
  return s;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** ほかの母音の音（同じ行） */
function vowelMix(ch: string): string | null {
  const k = KANA.get(toHira(ch));
  if (!k) return null;
  for (let d = 1; d < 5; d++) {
    const kk = ROWS[k.r]!.kana[(k.v + d) % 5];
    if (kk) return sameScript(ch, kk);
  }
  return null;
}
/** 同じ母音の、ほかの行の音 */
function consonantMix(ch: string, skip = 1): string | null {
  const k = KANA.get(toHira(ch));
  if (!k) return null;
  const lo = k.r < SEION_ROWS ? 0 : SEION_ROWS;
  const n = k.r < SEION_ROWS ? SEION_ROWS : ROWS.length - SEION_ROWS;
  let found = 0;
  for (let d = 1; d < n; d++) {
    const r = lo + ((k.r - lo + d) % n);
    const kk = ROWS[r]!.kana[k.v];
    if (kk && ++found === skip) return sameScript(ch, kk);
  }
  return null;
}
function dakuMix(ch: string): string | null {
  const k = KANA.get(toHira(ch));
  if (!k || DAKU_PAIR[k.r] === undefined) return null;
  const kk = ROWS[DAKU_PAIR[k.r]!]!.kana[k.v];
  return kk ? sameScript(ch, kk) : null;
}

// ---- ヒント・解説の部品 ----
type Feat = 'sok' | 'long' | 'yoon' | 'nb' | 'kunrei' | 'plain';
function featsOf(syls: Syl[]): Feat[] {
  const f: Feat[] = [];
  if (syls.some((s) => s.sok)) f.push('sok');
  if (syls.some((s) => s.long)) f.push('long');
  if (syls.some((s) => s.yoon)) f.push('yoon');
  if (syls.some((s) => s.nb)) f.push('nb');
  if (syls.some((s) => KUNREI[s.ro.replace(/^(.)\1/, '$1')])) f.push('kunrei');
  if (f.length === 0) f.push('plain');
  return f;
}
const READ_FEAT: Record<Feat, string> = {
  sok: '同《おな》じ字《じ》が2つならんでいるところ（tt・pp など）は、小《ちい》さい「っ」が入《はい》るよ。',
  long: 'ōのように上《うえ》に「ー」がついた字《じ》は、のばす音《おと》だよ。',
  yoon: 'kya・sho・ju のような音《おと》は、小《ちい》さい「ゃ・ゅ・ょ」がつく音《おと》だよ。',
  nb: 'n のあとに母音《ぼいん》がないときは「ん」だよ。',
  kunrei: 'shi は「し」、chi は「ち」、tsu は「つ」、fu は「ふ」、ji は「じ」だよ。',
  plain: '子音《しいん》と母音《ぼいん》を組《く》み合《あ》わせて、1つの音《おと》にしよう。',
};
const WRITE_FEAT: Record<Feat, string> = {
  sok: '小《ちい》さい「っ」は、つぎの音《おと》のはじめの字《じ》を2つかさねて書《か》くよ。',
  long: 'のばす音《おと》は、ōのように上《うえ》に「ー」をつけるか、母音《ぼいん》をならべて書《か》くよ（おうは ou）。',
  yoon: '小《ちい》さい「ゃ・ゅ・ょ」がつく音《おと》は、2つのかなで1つの音《おと》。ローマ字《じ》でも1つにまとめて書《か》くよ。',
  nb: '「ん」は、b・m・p の前《まえ》でも n と書《か》くよ。',
  kunrei: '「し」は shi、「ち」は chi、「つ」は tsu、「ふ」は fu、「じ」は ji と書《か》くよ。',
  plain:
    '1つの音《おと》は、子音《しいん》（k・s・t など）と母音《ぼいん》（a・i・u・e・o）でできているよ。',
};
const NOTE: Record<Feat, string> = {
  sok: '小《ちい》さい「っ」は、つぎの子音《しいん》をかさねて書《か》きます。',
  long: 'のばす音《おと》はōのように「ー」をつけるか、aa・uu・ou のように母音《ぼいん》をならべて書《か》きます。',
  yoon: '小《ちい》さい「ゃ・ゅ・ょ」のつく音《おと》は、まとめて1つの音《おと》で書《か》きます。',
  nb: '「ん」は b・m・p の前《まえ》でも n です。',
  kunrei: '「し・ち・つ・ふ・じ」は shi・chi・tsu・fu・ji と書《か》きます。',
  plain: '子音《しいん》と母音《ぼいん》の組《く》み合《あ》わせでできています。',
};

// ---- 1. 音の表 ----
const ROW_GYO = (r: number) => `${ROWS[r]!.name}行《ぎょう》`;

interface Sound {
  kana: string;
  ro: string;
  r: number;
  v: number;
  yoon?: string;
}
const SOUNDS: Sound[] = [];
ROWS.forEach((row, r) =>
  row.kana.forEach((k, v) => {
    if (k) SOUNDS.push({ kana: k, ro: row.ro[v]!, r, v });
  }),
);
for (const [h, c] of YOON_HEAD)
  SMALLS.forEach((s, i) =>
    SOUNDS.push({ kana: h + s, ro: c + SMALL[s]!, r: KANA.get(h)!.r, v: [0, 2, 4][i]!, yoon: h }),
  );

function soundWrongs(s: Sound): Wrong[] {
  const out: Wrong[] = [];
  const add = (k: string | null, m: string) => {
    if (k && k !== s.kana && !out.some(([l]) => l === k)) out.push([k, m]);
  };
  if (s.yoon) {
    const small = s.kana.slice(-1);
    add(s.yoon + BIG[small]!, 'romaji-yoon-split');
    add(s.yoon + SMALLS[(SMALLS.indexOf(small) + 1) % 3]!, 'romaji-vowel-mix');
    const hi = YOON_HEAD.findIndex(([h]) => h === s.yoon);
    add(YOON_HEAD[(hi + 1) % YOON_HEAD.length]![0] + small, 'romaji-consonant-mix');
    return out;
  }
  add(vowelMix(s.kana), 'romaji-vowel-mix');
  add(consonantMix(s.kana), 'romaji-consonant-mix');
  add(dakuMix(s.kana), 'romaji-dakuon-mix');
  add(consonantMix(s.kana, 2), 'romaji-consonant-mix');
  return out.slice(0, 3);
}

function tableReadItem(s: Sound): ChoiceItem {
  const gyo = ROW_GYO(s.r);
  const vowelOnly = s.r === 0;
  return {
    engine: 'choice',
    id: `table:read:${s.kana}`,
    objective: 'table',
    level: 0,
    prompt: 'このローマ字《じ》は、どのかなの音《おと》かな。',
    figure: { kind: 'text', text: s.ro, size: 'xl' },
    options: opts(s.kana, soundWrongs(s)),
    // ヒントは 表の 引き方を 教える（行や 母音を 名指しして 誤答を 消しきらない）
    hints: [
      vowelOnly
        ? '1字《じ》だけのときは、母音《ぼいん》（a・i・u・e・o）の音《おと》だよ。'
        : 'はじめの字《じ》（子音《しいん》）と、さいごの字《じ》（母音《ぼいん》）を見《み》よう。',
      vowelOnly
        ? 'a・i・u・e・o は、「あ・い・う・え・お」のじゅんにならんでいるよ。'
        : s.yoon
          ? '子音《しいん》のあとに y があるときは、小《ちい》さい「ゃ・ゅ・ょ」がつく音《おと》だよ。'
          : `はじめの「${s.ro.slice(0, -1)}」で、何行《ぎょう》の音《おと》か考《かんが》えよう。`,
      vowelOnly
        ? 'その字《じ》が a・i・u・e・o のなんばんめか数《かぞ》えよう。'
        : s.yoon
          ? 'さいごの母音《ぼいん》が a なら「ゃ」、u なら「ゅ」、o なら「ょ」だよ。'
          : '行《ぎょう》がわかったら、さいごの母音《ぼいん》で、表《ひょう》のどのだんかさがそう。',
    ],
    explain: s.yoon
      ? `「${s.ro}」は「${s.kana}」。小《ちい》さい「${s.kana.slice(-1)}」がつく音《おと》は、まとめて ${s.ro} と書《か》きます。`
      : vowelOnly
        ? `「${s.ro}」は「${s.kana}」。母音《ぼいん》の音《おと》です。`
        : `「${s.ro}」は「${s.kana}」。${gyo}の音《おと》で、母音《ぼいん》は ${'aiueo'[s.v]} です。${KUNREI[s.ro] ? `ローマ字《じ》では ${s.ro} と書《か》きます。` : ''}`,
    identity: `table:read:${s.kana}`,
  };
}

const N_ITEM: ChoiceItem = {
  engine: 'choice',
  id: 'table:read:ん',
  objective: 'table',
  level: 0,
  prompt: 'このローマ字《じ》は、どのかなの音《おと》かな。',
  figure: { kind: 'text', text: 'n', size: 'xl' },
  options: opts('ん', [
    ['な', 'romaji-n-alone'],
    ['ぬ', 'romaji-n-alone'],
    ['む', 'romaji-n-as-m'],
  ]),
  hints: [
    '字《じ》が1つだけ。母音《ぼいん》（a・i・u・e・o）はついているかな。',
    '「な・に・ぬ・ね・の」は、n のあとに母音《ぼいん》がつくよ。',
    'n のあとに母音《ぼいん》がない音《おと》は、な行《ぎょう》ではないよ。',
  ],
  explain:
    '「n」だけの音《おと》は「ん」です。n のあとに母音《ぼいん》がつくとな行《ぎょう》の音《おと》になります。',
  identity: 'table:read:ん',
};

/** 別例: 1音を 1字ずつ ならべて書く（まちがえやすい音） */
const TABLE_WRITE: [kana: string, letters: string, wrong: string, mis: string][] = [
  ['し', 'shicu', 'chi', 'romaji-consonant-mix'],
  ['ち', 'chits', 'shi', 'romaji-consonant-mix'],
  ['つ', 'tsuco', 'su', 'romaji-consonant-mix'],
  ['ふ', 'fuho', 'ho', 'romaji-consonant-mix'],
  ['じ', 'jizus', 'zu', 'romaji-vowel-mix'],
  ['しゃ', 'shayi', 'shiya', 'romaji-yoon-split'],
  ['ちゅ', 'chuyi', 'chiyu', 'romaji-yoon-split'],
  ['じょ', 'joyiz', 'jiyo', 'romaji-yoon-split'],
  ['きょ', 'kyoiu', 'kiyo', 'romaji-yoon-split'],
  ['ぴゃ', 'pyaib', 'piya', 'romaji-yoon-split'],
];

function tableWriteItem([kana, letters, wrong, mis]: (typeof TABLE_WRITE)[number]): BuildItem {
  const ro = canonical(kana);
  const yoon = kana.length > 1;
  return {
    engine: 'build',
    id: `table:write:${kana}`,
    objective: 'table',
    level: 0,
    prompt: `「${kana}」の音《おと》を、1字《じ》ずつならべてローマ字《じ》で書《か》こう。`,
    tiles: [...letters],
    answer: { kind: 'romaji', kana },
    wrongAnswers: [{ value: wrong, misconception: mis }],
    hints: [
      yoon
        ? '小《ちい》さい「ゃ・ゅ・ょ」がつく音《おと》は、2つのかなで1つの音《おと》だよ。'
        : 'この音《おと》は、子音《しいん》が2字《じ》か1字《じ》で、とくべつな書《か》き方《かた》をするよ。',
      yoon ? WRITE_FEAT.yoon : WRITE_FEAT.kunrei,
      `はじめの字《じ》は ${ro[0]} だよ。`,
    ],
    explain: `「${kana}」は ${ro} と書《か》きます。${yoon ? NOTE.yoon : NOTE.kunrei}`,
    identity: `table:write:${kana}`,
    alt: true,
  };
}

// ---- 2〜5. 語 ----
/** ふつうの語（読む・書く） */
// prettier-ignore
const PLAIN = [
  'さかな', 'つくえ', 'ふね', 'はなび', 'ちず', 'くじら', 'たぬき', 'ひまわり', 'かぶとむし',
  'めだか', 'からす', 'いちご', 'たまご', 'すいか', 'トマト', 'えのぐ', 'にわとり', 'おにぎり',
  'さくら', 'もみじ', 'かえる', 'はさみ', 'けむし', 'ゆびわ', 'ねずみ', 'うさぎ', 'ひよこ',
  'きつね', 'ほたる', 'てがみ', 'ごはん', 'たいこ', 'パンダ', 'ピアノ', 'やかん', 'でんわ',
];
/** 別例: 1字ずつ ならべて書く語 */
const LETTER_WORDS = ['ねこ', 'いぬ', 'あめ', 'そら', 'ふく', 'みち'];
/** 長音・促音・撥音・拗音の語 */
// prettier-ignore
const SPECIAL = [
  // 長音
  'おかあさん', 'おねえさん', 'くうき', 'ゆうき', 'ぼうし', 'ぶどう', 'ぞう', 'こおり',
  'ケーキ', 'ノート', 'ボール', 'スープ',
  // 促音
  'きって', 'らっぱ', 'はっぱ', 'しっぽ', 'きっぷ', 'ざっし', 'マッチ', 'コップ', 'ベッド',
  'サッカー', 'がっこう',
  // 撥音（b・m・p の前）
  'しんぶん', 'えんぴつ', 'さんぽ', 'とんぼ', 'てんぷら', 'かんばん', 'たんぽぽ', 'せんぷうき',
  // 拗音
  'きんぎょ', 'じてんしゃ', 'ちゃわん', 'きゅうり', 'しゃしん', 'おもちゃ', 'びょういん',
  'ひゃく', 'ぎゅうにゅう', 'でんしゃ', 'じゃがいも', 'ちょうちょ',
];
/** 別例: 長音などの語を読む */
const SPECIAL_READ = [
  'おかあさん',
  'ノート',
  'きって',
  'サッカー',
  'しんぶん',
  'とんぼ',
  'きんぎょ',
  'びょういん',
];
/** 地名・人名（語頭を大文字）。人名は よくある名前だけ */
// prettier-ignore
const NAMES: [kana: string, kind: '地名' | '名前'][] = [
  ['おおさか', '地名'], ['きょうと', '地名'], ['ほっかいどう', '地名'], ['おきなわ', '地名'],
  ['ながの', '地名'], ['とっとり', '地名'], ['ぐんま', '地名'], ['しずおか', '地名'],
  ['ふくおか', '地名'], ['さっぽろ', '地名'],
  ['たろう', '名前'], ['はなこ', '名前'], ['けんた', '名前'], ['ゆい', '名前'],
  ['しょうた', '名前'], ['みさき', '名前'],
];

/** 読む問題の、誤りの かな */
function readWrongs(word: string): Wrong[] {
  const syls = syllables(word);
  const w = [...word];
  const out: Wrong[] = [];
  const add = (k: string | null, m: string) => {
    if (k && k !== word && !out.some(([l]) => l === k)) out.push([k, m]);
  };
  const replaceAt = (i: number, s: string | null) =>
    s === null ? null : [...w.slice(0, i), s, ...w.slice(i + 1)].join('');
  const sok = syls.find((s) => s.sok);
  if (sok) add(replaceAt(sok.at, ''), 'romaji-sokuon-missing');
  const lg = syls.find((s) => s.long);
  if (lg) add(replaceAt(lg.at, ''), 'romaji-long-vowel-missing');
  const yo = syls.find((s) => s.yoon);
  if (yo) {
    const i = yo.at + [...yo.kana].length - 1;
    const small = toHira(w[i]!);
    add(replaceAt(i, sameScript(w[i]!, BIG[small]!)), 'romaji-yoon-split');
  }
  const bases = syls.filter((s) => s.base);
  const last = bases[bases.length - 1];
  if (last) add(replaceAt(last.at, vowelMix(w[last.at]!)), 'romaji-vowel-mix');
  const first = bases[0];
  if (first) add(replaceAt(first.at, consonantMix(w[first.at]!)), 'romaji-consonant-mix');
  if (out.length < 3 && first && first !== last)
    add(replaceAt(first.at, vowelMix(w[first.at]!)), 'romaji-vowel-mix');
  return out.slice(0, 3);
}

function readItem(word: string, objective: 'read' | 'special', alt: boolean): ChoiceItem {
  const syls = syllables(word);
  const f = featsOf(syls);
  const ro = canonical(word);
  return {
    engine: 'choice',
    id: `word:read:${word}`,
    objective,
    level: objective === 'read' ? 1 : 3,
    prompt: 'ローマ字《じ》で書《か》いたことばを読《よ》もう。どれかな。',
    figure: { kind: 'text', text: ro, size: 'xl' },
    options: opts(word, readWrongs(word)),
    hints: [
      'ローマ字《じ》を、1つの音《おと》ずつ区切《くぎ》って読《よ》もう。',
      READ_FEAT[f[0]!],
      `はじめの音《おと》は「${syls[0]!.kana}」だよ。`,
    ],
    explain: `「${ro}」は「${word}」と読《よ》みます。${f.map((x) => NOTE[x]).join('')}`,
    identity: `word:read:${word}`,
    ...(alt ? { alt: true } : {}),
  };
}

/** 書く問題のタイルと、よくある誤り */
function writeParts(word: string, capital: boolean) {
  const syls = syllables(word);
  const tiles = syls.map((s) => s.ro);
  const extras: string[] = [];
  const wrongs: { value: string; misconception: string }[] = [];
  const join = (ts: string[]) => {
    const s = ts.join('');
    return capital ? cap(s) : s;
  };
  const sokI = syls.findIndex((s) => s.sok);
  if (sokI >= 0) {
    const t = tiles.slice();
    t[sokI] = t[sokI]!.slice(1);
    extras.push(t[sokI]!);
    wrongs.push({ value: join(t), misconception: 'romaji-sokuon-missing' });
  }
  const lgI = syls.findIndex((s) => s.long);
  if (lgI >= 0)
    wrongs.push({
      value: join(tiles.filter((_, i) => i !== lgI)),
      misconception: 'romaji-long-vowel-missing',
    });
  const yoI = syls.findIndex((s) => s.yoon);
  if (yoI >= 0) {
    const y = syls[yoI]!;
    const head = KANA.get(toHira([...y.kana].slice(-2)[0]!))!.ro;
    const tail = 'y' + y.ro.slice(-1);
    const t = tiles.slice();
    t[yoI] = (y.sok ? head[0] : '') + head + tail;
    extras.push(head, tail);
    wrongs.push({ value: join(t), misconception: 'romaji-yoon-split' });
  }
  const nbI = syls.findIndex((s) => s.nb);
  if (nbI >= 0) {
    const t = tiles.slice();
    t[nbI] = 'm';
    extras.push('m');
    wrongs.push({ value: join(t), misconception: 'romaji-n-as-m' });
  }
  const kI = syls.findIndex((s) => KUNREI[s.ro]);
  if (kI >= 0) extras.push(KUNREI[syls[kI]!.ro]!);
  if (wrongs.length === 0) {
    // 母音を取りちがえた形が作れる音を、うしろから さがす（「わ」などは作れない）
    const bases = syls.map((s, i) => ({ s, i })).filter(({ s }) => s.base && vowelMix(s.kana));
    const pick = bases[bases.length - 1];
    const mixed = pick ? vowelMix(pick.s.kana) : null;
    if (pick && mixed) {
      const ro = KANA.get(toHira(mixed))!.ro;
      const t = tiles.slice();
      t[pick.i] = ro;
      extras.push(ro);
      wrongs.push({ value: join(t), misconception: 'romaji-vowel-mix' });
    }
  }
  const all = [...tiles];
  if (capital) all[0] = cap(all[0]!);
  // 大文字の語は、小文字の はじめの タイルも まぎらわしい タイルに置く（エンジンが「おおもじで」と案内する）
  if (capital) all.push(tiles[0]!);
  for (const e of extras) if (all.length < 12) all.push(e);
  return { syls, tiles: all, wrongs };
}

function writeItem(word: string, objective: 'write' | 'special'): BuildItem {
  const { syls, tiles, wrongs } = writeParts(word, false);
  const f = featsOf(syls);
  const ro = canonical(word);
  const head = syls.length >= 3 ? syls.slice(0, 2) : syls.slice(0, 1);
  return {
    engine: 'build',
    id: `word:write:${word}`,
    objective,
    level: objective === 'write' ? 2 : 3,
    prompt: `「${word}」をローマ字《じ》で書《か》こう。`,
    tiles,
    answer: { kind: 'romaji', kana: word },
    wrongAnswers: wrongs,
    hints: [
      `「${word}」を1つずつの音《おと》に分《わ》けてみよう。`,
      WRITE_FEAT[f[0]!],
      `はじめは ${head.map((s) => s.ro).join('')} ではじまるよ。`,
    ],
    explain: `「${word}」は ${ro} と書《か》きます。${f.map((x) => NOTE[x]).join('')}`,
    identity: `word:write:${word}`,
  };
}

function letterItem(word: string): BuildItem {
  const syls = syllables(word);
  const ro = canonical(word);
  const last = syls[syls.length - 1]!;
  const mixed = vowelMix(last.kana)!;
  const mixedRo = KANA.get(mixed)!.ro;
  const wrong = ro.slice(0, ro.length - last.ro.length) + mixedRo;
  const letters = [...ro];
  // 誤答の つづりが タイルで 作れるように、足りない 字を 足す（みち→mitsu の s・u）
  for (const c of mixedRo) if (!letters.includes(c)) letters.push(c);
  letters.push(ro.includes('k') ? 't' : 'k');
  return {
    engine: 'build',
    id: `word:letters:${word}`,
    objective: 'write',
    level: 2,
    prompt: `「${word}」を、1字《じ》ずつならべてローマ字《じ》で書《か》こう。`,
    tiles: letters,
    answer: { kind: 'romaji', kana: word },
    wrongAnswers: [{ value: wrong, misconception: 'romaji-vowel-mix' }],
    hints: [
      `「${word}」は ${syls.length}つの音《おと》だよ。1つの音《おと》は子音《しいん》と母音《ぼいん》でできているよ。`,
      featsOf(syls).includes('kunrei') ? WRITE_FEAT.kunrei : WRITE_FEAT.plain,
      `はじめの音《おと》は ${syls[0]!.ro} だよ。`,
    ],
    explain: `「${word}」は ${ro} と書《か》きます。${syls.map((s) => `${s.kana}＝${s.ro}`).join('、')}。`,
    identity: `word:letters:${word}`,
    alt: true,
  };
}

function capitalItem([word, kind]: (typeof NAMES)[number]): BuildItem {
  const { syls, tiles, wrongs } = writeParts(word, true);
  const f = featsOf(syls).filter((x) => x !== 'plain');
  const ro = cap(canonical(word));
  const what = kind === '地名' ? '地名《ちめい》' : '人《ひと》の名前《なまえ》';
  return {
    engine: 'build',
    id: `cap:write:${word}`,
    objective: 'capital',
    level: 4,
    prompt: `${what}の「${word}」をローマ字《じ》で書《か》こう。`,
    tiles,
    answer: { kind: 'romaji', kana: word, capital: true },
    wrongAnswers: wrongs,
    hints: [
      `「${word}」を1つずつの音《おと》に分《わ》けてみよう。`,
      `地名《ちめい》や人《ひと》の名前《なまえ》は、はじめの字《じ》を大文字《おおもじ》で書《か》くよ。${f.length ? WRITE_FEAT[f[0]!] : ''}`,
      `はじめは ${cap(syls[0]!.ro)} ではじまるよ。`,
    ],
    explain: `「${word}」は ${ro} と書《か》きます。${what}なので、はじめの字《じ》は大文字《おおもじ》です。${f.map((x) => NOTE[x]).join('')}`,
    identity: `cap:write:${word}`,
  };
}

/** 別例: 名前の つづりを えらぶ（[かな, 正しい, 誤り…]） */
const CAP_CHOOSE: [kana: string, ok: string, wrongs: Wrong[]][] = [
  [
    'おおさか',
    'Ōsaka',
    [
      ['ōsaka', 'romaji-capital'],
      ['Osaka', 'romaji-long-vowel-missing'],
    ],
  ],
  [
    'きょうと',
    'Kyōto',
    [
      ['kyōto', 'romaji-capital'],
      ['Kiyōto', 'romaji-yoon-split'],
      ['Kyoto', 'romaji-long-vowel-missing'],
    ],
  ],
  [
    'とっとり',
    'Tottori',
    [
      ['tottori', 'romaji-capital'],
      ['Totori', 'romaji-sokuon-missing'],
    ],
  ],
  [
    'ぐんま',
    'Gunma',
    [
      ['gunma', 'romaji-capital'],
      ['Gumma', 'romaji-n-as-m'],
    ],
  ],
  [
    'しょうた',
    'Shōta',
    [
      ['shōta', 'romaji-capital'],
      ['Shiyōta', 'romaji-yoon-split'],
      ['Shota', 'romaji-long-vowel-missing'],
    ],
  ],
];

function capChooseItem([kana, ok, wrongs]: (typeof CAP_CHOOSE)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `cap:choose:${kana}`,
    objective: 'capital',
    level: 4,
    prompt: `「${kana}」をローマ字《じ》で書《か》いた名前《なまえ》のカードを作《つく》ります。正《ただ》しい書《か》き方《かた》はどれかな。`,
    options: opts(ok, wrongs),
    hints: [
      '地名《ちめい》や人《ひと》の名前《なまえ》の、はじめの字《じ》を見《み》よう。',
      'のばす音《おと》・小《ちい》さい「っ」・小《ちい》さい「ゃ・ゅ・ょ」・「ん」の書《か》き方《かた》もたしかめよう。',
      'はじめの字《じ》が大文字《おおもじ》のものの中《なか》からえらぼう。',
    ],
    explain: `「${kana}」は ${ok} と書《か》きます。名前《なまえ》なので、はじめの字《じ》は大文字《おおもじ》です。`,
    identity: `cap:choose:${kana}`,
    alt: true,
  };
}

/** 別例: 2語の句を読む（語の中 → 句の中） */
const PHRASES: [ro: string, ok: string, wrongs: Wrong[]][] = [
  [
    'ōkii inu',
    'おおきい いぬ',
    [
      ['おきい いぬ', 'romaji-long-vowel-missing'],
      ['おおきい いね', 'romaji-vowel-mix'],
      ['おおけい いぬ', 'romaji-vowel-mix'],
    ],
  ],
  [
    'chiisana kuruma',
    'ちいさな くるま',
    [
      ['しいさな くるま', 'romaji-consonant-mix'],
      ['ちいさな くろま', 'romaji-vowel-mix'],
      ['ちさな くるま', 'romaji-consonant-mix'],
    ],
  ],
  [
    'kitto dekiru',
    'きっと できる',
    [
      ['きと できる', 'romaji-sokuon-missing'],
      ['きっと でくる', 'romaji-vowel-mix'],
      ['きっと てきる', 'romaji-dakuon-mix'],
    ],
  ],
  [
    'kyō no tenki',
    'きょうの てんき',
    [
      ['きようの てんき', 'romaji-yoon-split'],
      ['きょの てんき', 'romaji-long-vowel-missing'],
      ['きょうの てんこ', 'romaji-vowel-mix'],
    ],
  ],
  [
    'shiroi kumo',
    'しろい くも',
    [
      ['ちろい くも', 'romaji-consonant-mix'],
      ['しろい くま', 'romaji-vowel-mix'],
      ['しるい くも', 'romaji-vowel-mix'],
    ],
  ],
];

function phraseItem([ro, ok, wrongs]: (typeof PHRASES)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `phrase:read:${ro}`,
    objective: 'read',
    level: 1,
    prompt: 'ローマ字《じ》で書《か》いたことばを読《よ》もう。2つのことばがあるよ。',
    figure: { kind: 'text', text: ro, size: 'l' },
    options: opts(ok, wrongs),
    hints: [
      'あいているところで、ことばが分《わ》かれているよ。1つずつ読《よ》もう。',
      'のばす音《おと》（ō）や、同《おな》じ字《じ》がならぶところ（tt）にも気《き》をつけよう。',
      `はじめのことばは「${ok.split(' ')[0]!.slice(0, 2)}」ではじまるよ。`,
    ],
    explain: `「${ro}」は「${ok}」と読《よ》みます。`,
    identity: `phrase:read:${ro}`,
    alt: true,
  };
}

const ITEMS: Item[] = [
  ...SOUNDS.map(tableReadItem),
  N_ITEM,
  ...TABLE_WRITE.map(tableWriteItem),
  ...PLAIN.map((w) => readItem(w, 'read', false)),
  ...PHRASES.map(phraseItem),
  ...PLAIN.map((w) => writeItem(w, 'write')),
  ...LETTER_WORDS.map(letterItem),
  ...SPECIAL.map((w) => writeItem(w, 'special')),
  ...SPECIAL_READ.map((w) => readItem(w, 'special', true)),
  ...NAMES.map(capitalItem),
  ...CAP_CHOOSE.map(capChooseItem),
];

export const romaji: UnitSpec = {
  id: 'g3.ja.romaji',
  title: 'ローマ字《じ》の読《よ》み書《か》き',
  stage: 'g3',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: ['g1.ja.special-kana'],
  objectives: [
    {
      id: 'table',
      title:
        '1つの音《おと》のローマ字《じ》を読《よ》み書《か》きする（音《おと》の表《ひょう》）',
    },
    { id: 'read', title: 'ローマ字《じ》で書《か》いたことばを読《よ》む' },
    { id: 'write', title: 'ことばをローマ字《じ》で書《か》く' },
    {
      id: 'special',
      title:
        'のばす音《おと》・小《ちい》さい「っ」・「ん」・小《ちい》さい「ゃ・ゅ・ょ」を書《か》く',
    },
    {
      id: 'capital',
      title: '地名《ちめい》や名前《なまえ》ははじめの字《じ》を大文字《おおもじ》で書《か》く',
    },
  ],
  misconceptions: [
    {
      id: 'romaji-vowel-mix',
      explain:
        'さいごの母音《ぼいん》（a・i・u・e・o）をちがう音《おと》とかんがえたのかな。子音《しいん》のあとの母音《ぼいん》をよく見《み》よう。',
    },
    {
      id: 'romaji-consonant-mix',
      explain:
        'はじめの子音《しいん》をちがう行《ぎょう》の音《おと》とかんがえたのかな。k はか行《ぎょう》、s・sh はさ行《ぎょう》、t・ch・ts はた行《ぎょう》のように、行《ぎょう》をたしかめよう。',
    },
    {
      id: 'romaji-dakuon-mix',
      explain:
        'にごる音《おと》とにごらない音《おと》をまちがえたのかな。g・z・d・b はにごる音《おと》、p は「ぱ・ぴ・ぷ」の音《おと》だよ。',
    },
    {
      id: 'romaji-sokuon-missing',
      explain:
        '小《ちい》さい「っ」をわすれたのかな。「っ」は、つぎの音《おと》のはじめの字《じ》を2つかさねて書《か》くよ（きって → kitte）。',
    },
    {
      id: 'romaji-long-vowel-missing',
      explain:
        'のばす音《おと》を書《か》かなかったのかな。のばす音《おと》はōのように上《うえ》に「ー」をつけるか、ou・aa のように書《か》くよ。',
    },
    {
      id: 'romaji-yoon-split',
      explain:
        '小《ちい》さい「ゃ・ゅ・ょ」を大《おお》きい「や・ゆ・よ」とかんがえたのかな。「きょ」は kyo のようにまとめて書《か》くよ。kiyo は「きよ」になるよ。',
    },
    {
      id: 'romaji-n-as-m',
      explain:
        '「ん」を m と書《か》いたのかな。あたらしい書《か》き方《かた》では、b・m・p の前《まえ》でも「ん」は n と書《か》くよ（しんぶん → shinbun）。',
    },
    {
      id: 'romaji-n-alone',
      explain:
        'n のあとに母音《ぼいん》があるとかんがえたのかな。n だけで母音《ぼいん》がないときは「ん」だよ。',
    },
    {
      id: 'romaji-capital',
      explain:
        'はじめの字《じ》を小文字《こもじ》で書《か》いたのかな。地名《ちめい》や人《ひと》の名前《なまえ》は、はじめの字《じ》を大文字《おおもじ》で書《か》くよ。',
    },
  ],
  levels: [
    { label: '音の表（1つの音）', chance: 0.05 },
    { label: 'ことばを読む', chance: 0.05 },
    { label: 'ことばを書く', chance: 0.02 },
    { label: 'のばす音・っ・ん・ゃゅょ', chance: 0.02 },
    { label: '地名・名前（大文字）', chance: 0.02 },
  ],
  intro: [
    {
      text: 'これは国語《こくご》のローマ字《じ》の読《よ》み書《か》きの学習《がくしゅう》です。パソコンで字《じ》を打《う》つローマ字《じ》にゅうりょく（タイピング）とはべつの学習《がくしゅう》だよ。',
    },
    {
      text: 'ローマ字《じ》の1つの音《おと》は、子音《しいん》（k・s・t など）と母音《ぼいん》（a・i・u・e・o）でできているよ。k と a で ka（か）。',
      figure: {
        kind: 'table',
        header: ['', 'a', 'i', 'u', 'e', 'o'],
        rows: [
          ['', 'a あ', 'i い', 'u う', 'e え', 'o お'],
          ['k', 'ka か', 'ki き', 'ku く', 'ke け', 'ko こ'],
          ['s', 'sa さ', 'shi し', 'su す', 'se せ', 'so そ'],
          ['t', 'ta た', 'chi ち', 'tsu つ', 'te て', 'to と'],
        ],
      },
    },
    {
      text: '「し」は shi、「ち」は chi、「つ」は tsu、「ふ」は fu、「じ」は ji と書《か》くよ（あたらしい書《か》き方《かた》）。si・ti のように書《か》くと「もう一度《いちど》」になるよ。',
    },
    {
      text: 'のばす音《おと》はō（ou）、小《ちい》さい「っ」はつぎの字《じ》をかさねる（kitte）、「ん」はいつも n（shinbun）、小《ちい》さい「ゃ・ゅ・ょ」は kya・sho のようにまとめて書《か》くよ。地名《ちめい》や名前《なまえ》は、はじめの字《じ》を大文字《おおもじ》にするよ（Ōsaka）。',
    },
  ],
  source: { kind: 'items', items: ITEMS },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第3学年及び第4学年 知識及び技能(1)ウ（第3学年: 日常使われている簡単な単語について、ローマ字で表記されたものを読み、ローマ字で書くこと）。つづりは令和7年内閣告示「ローマ字のつづり方」（ヘボン式に準ずる。長音は ō のほか ou・oo を許容、訓令式は「もう一度」と案内）',
  revised: REVISED,
};
