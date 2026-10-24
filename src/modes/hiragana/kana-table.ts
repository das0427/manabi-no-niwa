/**
 * ひらがなの表（清音46字＋濁音・半濁音25字）。仕様: docs/learning-design.md 2章, requirements M2-06。
 * 字を増やすときは、この表の included を true にして word（例語の絵）を足し、
 * voice.ts は表から台本を作るので、台本は自動で増える。
 *
 *  - included: 語頭の問題（H1〜H3）に出す字
 *  - tileOnly: 言葉づくり（H4・H5）のタイルとしてだけ出る字（語頭の問題には出ない）
 *  - word: 例語の絵（vocab の ID）。語頭がその字であること（テストで検査）
 *  - romaji: 音声キー kana.char.<romaji> に使う（キーに日本語は使えない）
 */
import type { VocabId } from '../../content/vocab';

export interface KanaEntry {
  char: string;
  row: string;
  romaji: string;
  included: boolean;
  word?: VocabId;
  tileOnly?: boolean;
}

type Row = readonly [char: string, romaji: string];

function rowOf(row: string, items: readonly Row[]): KanaEntry[] {
  return items.map(([char, romaji]) => ({ char, row, romaji, included: false }));
}

const SEION: KanaEntry[] = [
  ...rowOf('あ', [
    ['あ', 'a'],
    ['い', 'i'],
    ['う', 'u'],
    ['え', 'e'],
    ['お', 'o'],
  ]),
  ...rowOf('か', [
    ['か', 'ka'],
    ['き', 'ki'],
    ['く', 'ku'],
    ['け', 'ke'],
    ['こ', 'ko'],
  ]),
  ...rowOf('さ', [
    ['さ', 'sa'],
    ['し', 'si'],
    ['す', 'su'],
    ['せ', 'se'],
    ['そ', 'so'],
  ]),
  ...rowOf('た', [
    ['た', 'ta'],
    ['ち', 'ti'],
    ['つ', 'tu'],
    ['て', 'te'],
    ['と', 'to'],
  ]),
  ...rowOf('な', [
    ['な', 'na'],
    ['に', 'ni'],
    ['ぬ', 'nu'],
    ['ね', 'ne'],
    ['の', 'no'],
  ]),
  ...rowOf('は', [
    ['は', 'ha'],
    ['ひ', 'hi'],
    ['ふ', 'hu'],
    ['へ', 'he'],
    ['ほ', 'ho'],
  ]),
  ...rowOf('ま', [
    ['ま', 'ma'],
    ['み', 'mi'],
    ['む', 'mu'],
    ['め', 'me'],
    ['も', 'mo'],
  ]),
  ...rowOf('や', [
    ['や', 'ya'],
    ['ゆ', 'yu'],
    ['よ', 'yo'],
  ]),
  ...rowOf('ら', [
    ['ら', 'ra'],
    ['り', 'ri'],
    ['る', 'ru'],
    ['れ', 're'],
    ['ろ', 'ro'],
  ]),
  ...rowOf('わ', [
    ['わ', 'wa'],
    ['を', 'wo'],
    ['ん', 'n'],
  ]),
];

const DAKUON: KanaEntry[] = [
  ...rowOf('が', [
    ['が', 'ga'],
    ['ぎ', 'gi'],
    ['ぐ', 'gu'],
    ['げ', 'ge'],
    ['ご', 'go'],
  ]),
  ...rowOf('ざ', [
    ['ざ', 'za'],
    ['じ', 'zi'],
    ['ず', 'zu'],
    ['ぜ', 'ze'],
    ['ぞ', 'zo'],
  ]),
  ...rowOf('だ', [
    ['だ', 'da'],
    ['ぢ', 'di'],
    ['づ', 'du'],
    ['で', 'de'],
    ['ど', 'do'],
  ]),
  ...rowOf('ば', [
    ['ば', 'ba'],
    ['び', 'bi'],
    ['ぶ', 'bu'],
    ['べ', 'be'],
    ['ぼ', 'bo'],
  ]),
  ...rowOf('ぱ', [
    ['ぱ', 'pa'],
    ['ぴ', 'pi'],
    ['ぷ', 'pu'],
    ['ぺ', 'pe'],
    ['ぽ', 'po'],
  ]),
];

/** 収録する20字と例語（learning-design.md 2章の表） */
const INCLUDED: Record<string, VocabId> = {
  あ: 'ant',
  い: 'dog',
  う: 'cow',
  え: 'pencil',
  お: 'onigiri',
  か: 'turtle',
  き: 'fox',
  く: 'bear',
  さ: 'monkey',
  す: 'watermelon',
  た: 'octopus',
  と: 'bird',
  な: 'eggplant',
  ね: 'cat',
  は: 'scissors',
  ひ: 'chick',
  ふ: 'ship',
  み: 'mikan',
  も: 'peach',
  り: 'apple',
};

/** 言葉づくりのタイルとしてだけ登場する字 */
const TILE_ONLY = ['こ', 'し', 'ぬ', 'ま', 'め', 'よ', 'る', 'ん'];

export const KANA_TABLE: readonly KanaEntry[] = [...SEION, ...DAKUON].map((e) => {
  const word = INCLUDED[e.char];
  if (word) return { ...e, included: true, word };
  if (TILE_ONLY.includes(e.char)) return { ...e, tileOnly: true };
  return e;
});

const byChar = new Map(KANA_TABLE.map((e) => [e.char, e]));

export function kanaOf(char: string): KanaEntry {
  const e = byChar.get(char);
  if (!e) throw new Error(`unknown kana ${char}`);
  return e;
}

/** 語頭の問題（H1〜H3）に出す字 */
export const INCLUDED_KANA: readonly KanaEntry[] = KANA_TABLE.filter((e) => e.included);

/** 言葉づくりのタイル（ひっかけ）に使える字: 収録字＋タイル専用字 */
export const TILE_KANA: readonly string[] = KANA_TABLE.filter((e) => e.included || e.tileOnly).map(
  (e) => e.char,
);

/**
 * H1・H2 で同時に出さない「形の似た組」（learning-design.md 2章）。
 * 同じ字が複数の組に入ることがある（つ・き など）。
 */
export const SIMILAR_GROUPS: readonly (readonly string[])[] = [
  ['あ', 'お', 'め', 'ぬ'],
  ['い', 'り', 'こ'],
  ['う', 'ら', 'つ'],
  ['さ', 'ち', 'き'],
  ['は', 'ほ', 'け'],
  ['ね', 'ぬ', 'め', 'れ', 'わ'],
  ['る', 'ろ', 'ぬ'],
  ['し', 'つ', 'く'],
  ['た', 'な'],
  ['み', 'よ'],
  ['と', 'ど'],
];

export function areSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  return SIMILAR_GROUPS.some((g) => g.includes(a) && g.includes(b));
}

/** 言葉づくりの言葉（vocab の ID）。語は ID の label（ひらがな） */
export const WORDS_2: readonly VocabId[] = [
  'dog', // いぬ
  'cow', // うし
  'turtle', // かめ
  'bear', // くま
  'monkey', // さる
  'octopus', // たこ
  'bird', // とり
  'eggplant', // なす
  'cat', // ねこ
  'ship', // ふね
  'peach', // もも
  'ant', // あり
  'umbrella', // かさ
];
export const WORDS_3: readonly VocabId[] = [
  'watermelon', // すいか
  'mikan', // みかん
  'chick', // ひよこ
  'scissors', // はさみ
];
