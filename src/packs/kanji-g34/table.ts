/**
 * 字のデータ表（字・音・訓・語例・文）を読んで、問題の元になる形にする。
 * 表の書き方と選び方は data/rows-g1.ts と data/rows-g3.ts の先頭を参照。表の誤りはここで例外にする（教材の誤りは実行前に止める）。
 * kanji-g12 の table.ts を写して、3・4年まで広げた（パックは他のパックを import しない）。
 */
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, plainText, spokenReading, type Token } from '../../text/rich';
import { ROWS_G1 } from './data/rows-g1';
import { ROWS_G2A } from './data/rows-g2a';
import { ROWS_G2B } from './data/rows-g2b';
import { ROWS_G3 } from './data/rows-g3';
import { ROWS_G4 } from './data/rows-g4';

/**
 * 送り仮名として扱う、問う字の直後のかな（「大きい」の「きい」など）。
 * 「白くま」の「くま」のような複合語の一部は入れない。送り仮名の境目の誤答（おおき）を作る目印に使う。
 */
export const OKURIGANA: ReadonlySet<string> = new Set([
  'い',
  'き',
  'く',
  'ぐ',
  'ぶ',
  'さ',
  'し',
  'す',
  'る',
  'む',
  'み',
  'り',
  'う',
  'つ',
  'きい',
  'きな',
  'さい',
  'さな',
  'しい',
  'える',
  'れる',
  'ける',
  'まれる',
  'きる',
  'がる',
  'わす',
  'わせる',
  'かい',
  'かる',
  'らせる',
  'ない',
  'ろ',
  'てる',
  'じる',
  'める',
  'ねる',
  'ばす',
  'らす',
  'やす',
  'まる',
  'ける',
  'か',
  'かな',
  'たい',
  'らか',
  'やか',
  'ずか',
]);

export type ReadKind = 'on' | 'kun';

/** 語例または文（問う字が1つだけある） */
export interface Occurrence {
  /** RichText（問う字は 漢字《!よみ》） */
  rich: string;
  /** 問う字を太字にした RichText（問題の図に出す） */
  bold: string;
  /** 解説に出す、ふりがなを隠さない形 */
  shown: string;
  /** 漢字かな交じりの素の文 */
  plain: string;
  /** 語・文ぜんたいの読み（ひらがな） */
  whole: string;
  /** 問う字の読み */
  part: string;
  kind: ReadKind;
  /** 問う字のすぐ後ろの送り仮名（無ければ空） */
  okuri: string;
  /** ヒント用: 語・文ぜんたいの読みで、問う字の読みを ○ に置き換えたもの（例: か○○） */
  masked: string;
  /** 書き問題の手がかり: ほかの漢字をかなにして、問う字の読みを太字にした文 */
  kana: string;
}

export type KanjiGradeNo = 1 | 2 | 3 | 4;

export interface KanjiEntry {
  ch: string;
  grade: KanjiGradeNo;
  on: string[];
  kun: string[];
  words: Occurrence[];
  sentence: Occurrence;
}

/** 読みを1拍ずつに分ける（きゃ・しょ のような小さい「ゃゅょ」は前の字につける。「っ」「ん」は1拍） */
export function moras(reading: string): string[] {
  return reading.match(/[^ゃゅょ][ゃゅょ]?/gu) ?? [];
}

const HIRA = /^[ぁ-ゖー]+$/;
const KANJI = /[一-鿿㐀-䶿々]/;
const STOP = /[\s。、！？「」…]/;

function tokensKana(tokens: Token[], mark: (t: Extract<Token, { t: 'ruby' }>) => string): string {
  return tokens
    .map((t) => {
      if (t.t === 'text') return t.s;
      if (t.t === 'ruby') return t.hide ? mark(t) : t.reading;
      throw new Error('語例・文に使えない記法');
    })
    .join('');
}

function occurrence(
  rich: string,
  ch: string,
  grade: number,
  on: ReadonlySet<string>,
  kun: ReadonlySet<string>,
  isSentence: boolean,
): Occurrence {
  const where = `「${ch}」${rich}`;
  const tokens = parseRich(rich);
  const hidden = tokens.flatMap((t, i) => (t.t === 'ruby' && t.hide ? [i] : []));
  if (hidden.length !== 1) throw new Error(`問う字（《!よみ》）が1つではない: ${where}`);
  const idx = hidden[0]!;
  const target = tokens[idx] as Extract<Token, { t: 'ruby' }>;
  if (target.base !== ch) throw new Error(`問う字が表の字と違う: ${where}`);
  if (!HIRA.test(target.reading)) throw new Error(`読みがひらがなでない: ${where}`);
  const isOn = on.has(target.reading);
  const isKun = kun.has(target.reading);
  if (isOn === isKun) throw new Error(`問う字の読みが音訓の欄に無い（または両方にある）: ${where}`);
  // 文・語の中の漢字は、必ずよみ付きで、その学年までの配当字
  for (const t of tokens) {
    if (t.t === 'text') {
      if (KANJI.test(t.s)) throw new Error(`よみの無い漢字: ${where}`);
    } else if (t.t === 'ruby') {
      for (const c of t.base) {
        const g = kanjiGrade(c);
        if (g > grade) throw new Error(`${grade}年より上の漢字「${c}」: ${where}`);
      }
      if (!HIRA.test(t.reading)) throw new Error(`読みがひらがなでない: ${where}`);
    }
  }
  const next = tokens[idx + 1];
  let okuri = '';
  if (next?.t === 'text') {
    let i = 0;
    while (i < next.s.length && !STOP.test(next.s[i]!)) i++;
    const lead = next.s.slice(0, i);
    if (!isSentence) {
      // 語: 問う字の後ろのかなが全部、送り仮名のときだけ
      if (OKURIGANA.has(lead)) okuri = lead;
    } else {
      // 文: 後ろに助詞などが続くので、いちばん長く合う送り仮名を探す（「休みだ」→「み」）
      for (let n = lead.length; n >= 1; n--) {
        if (OKURIGANA.has(lead.slice(0, n))) {
          okuri = lead.slice(0, n);
          break;
        }
      }
    }
  }
  return {
    rich,
    bold: rich.replace(/(.)《!([^》]*)》/, '**$1《!$2》**'),
    shown: rich.replace('《!', '《'),
    plain: plainText(rich),
    whole: spokenReading(rich.replace('《!', '《')),
    part: target.reading,
    kind: isOn ? 'on' : 'kun',
    okuri,
    masked: tokensKana(tokens, (t) => '○'.repeat(moras(t.reading).length)),
    kana: tokensKana(tokens, (t) => `**${t.reading}**`),
  };
}

const split = (s: string) => (s === '' ? [] : s.split(','));

/** 表の文字列を読む。grade = その表の学年。語例・文の「ほかの漢字」は grade までの配当字 */
export function parseRows(text: string, grade: KanjiGradeNo): KanjiEntry[] {
  const entries: KanjiEntry[] = [];
  const errors: string[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(parseRow(line, grade));
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  // 誤りは全部まとめて知らせる（1行ずつ直すと時間がかかるため）
  if (errors.length > 0)
    throw new Error(`字の表に誤りがある（${errors.length}件）\n${errors.join('\n')}`);
  return entries;
}

function parseRow(line: string, grade: KanjiGradeNo): KanjiEntry {
  const f = line.split(';');
  if (f.length !== 5) throw new Error(`欄の数が5でない: ${line}`);
  const [ch, onS, kunS, wordsS, sentence] = f as [string, string, string, string, string];
  if ([...ch].length !== 1) throw new Error(`字が1字でない: ${line}`);
  if (kanjiGrade(ch) !== grade) throw new Error(`「${ch}」は${grade}年の字ではない`);
  const on = split(onS);
  const kun = split(kunS);
  for (const r of [...on, ...kun])
    if (!HIRA.test(r)) throw new Error(`読みがひらがなでない: ${line}`);
  const onSet = new Set(on);
  const kunSet = new Set(kun);
  const words = wordsS.split('|').map((w) => occurrence(w, ch, grade, onSet, kunSet, false));
  if (words.length < 2) throw new Error(`語例が2つ未満: 「${ch}」`);
  const keys = words.map((w) => w.plain);
  if (new Set(keys).size !== keys.length) throw new Error(`語例が重複: 「${ch}」`);
  const sent = occurrence(sentence, ch, grade, onSet, kunSet, true);
  if (keys.includes(sent.plain)) throw new Error(`文が語例と同じ: 「${ch}」`);
  return { ch, grade, on, kun, words, sentence: sent };
}

export const ENTRIES_G1: KanjiEntry[] = parseRows(ROWS_G1, 1);
export const ENTRIES_G2: KanjiEntry[] = parseRows(ROWS_G2A + '\n' + ROWS_G2B, 2);
export const ENTRIES_G3: KanjiEntry[] = parseRows(ROWS_G3, 3);
export const ENTRIES_G4: KanjiEntry[] = parseRows(ROWS_G4, 4);
/** 1〜4年のすべての字 */
export const ENTRIES_ALL: KanjiEntry[] = [
  ...ENTRIES_G1,
  ...ENTRIES_G2,
  ...ENTRIES_G3,
  ...ENTRIES_G4,
];
export const ENTRY_OF: ReadonlyMap<string, KanjiEntry> = new Map(ENTRIES_ALL.map((e) => [e.ch, e]));

/** 同一性キー（curriculum-matrix 1.4）: 字 ＋ 読み ＋ 語例（または文） */
export const identityOf = (e: KanjiEntry, o: Occurrence): string => `${e.ch}|${o.part}|${o.plain}`;
