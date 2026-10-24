/**
 * ひらがな（よむ）の問題生成と判定（純粋関数）。仕様: docs/learning-design.md 2章。
 * 段階: H1 音→文字2択 / H2 音→文字3択 / H3 絵＋語→語頭の文字2択 /
 *       H4 2文字の言葉を作る（タイル3） / H5 3文字の言葉を作る（タイル4）。
 */
import { vocab, type VocabId } from '../../content/vocab';
import type { VoiceSeq } from '../../voice/catalog/index';
import { textOf } from '../../app/voiceText';
import { balancedPositions, createRng, hashSeed, type Rng } from '../../core/util/rng';
import { areSimilar, INCLUDED_KANA, kanaOf, TILE_KANA, WORDS_2, WORDS_3 } from './kana-table';

export type HiraKind = 'pick' | 'first' | 'build';

export interface ChoiceQuestion {
  kind: 'pick' | 'first';
  /** 正解の字 */
  answer: string;
  choices: string[];
  answerIndex: number;
  /** pick: 正解の字の例語 / first: 画面に出す語 */
  word: VocabId;
  itemKey: string;
}

export interface BuildQuestion {
  kind: 'build';
  word: VocabId;
  /** 言葉の字（左から） */
  chars: string[];
  /** タイル（正解の字すべて＋ひっかけ1枚。並びは言葉の順にならない） */
  tiles: string[];
  itemKey: string;
}

export type KanaQuestion = ChoiceQuestion | BuildQuestion;

export const LEVEL_KINDS: readonly HiraKind[] = ['pick', 'pick', 'first', 'build', 'build'];
/** 段階ごとの選択肢（タイル）の数 */
export const CHOICE_COUNTS = [2, 3, 2, 3, 4] as const;

export function kindOf(level: number): HiraKind {
  return LEVEL_KINDS[Math.max(0, Math.min(LEVEL_KINDS.length - 1, level))]!;
}

export function wordText(id: VocabId): string {
  return vocab(id).label;
}

export function wordChars(id: VocabId): string[] {
  return [...wordText(id)];
}

/** 正解の字と似ていない字を、これまでの選択肢とも似ないように n 個選ぶ */
function pickDistractors(answer: string, n: number, pool: readonly string[], rng: Rng): string[] {
  const out: string[] = [];
  for (const c of rng.shuffle(pool)) {
    if (out.length >= n) break;
    if (areSimilar(c, answer) || out.some((o) => areSimilar(o, c))) continue;
    out.push(c);
  }
  if (out.length < n) throw new Error(`distractors: ${answer}`);
  return out;
}

function choiceQuestion(
  kind: 'pick' | 'first',
  answer: string,
  count: number,
  pos: number,
  rng: Rng,
): ChoiceQuestion {
  const pool = INCLUDED_KANA.map((e) => e.char);
  const others = pickDistractors(answer, count - 1, pool, rng);
  const choices = [...rng.shuffle(others)];
  choices.splice(pos, 0, answer);
  const word = kanaOf(answer).word!;
  return {
    kind,
    answer,
    choices,
    answerIndex: pos,
    word,
    itemKey: kind === 'pick' ? answer : wordText(word),
  };
}

function buildQuestion(word: VocabId, distractorPos: number, rng: Rng): BuildQuestion {
  const chars = wordChars(word);
  const pool = TILE_KANA.filter((c) => !chars.includes(c) && !chars.some((x) => areSimilar(x, c)));
  const extra = rng.pick(pool);
  // 正解の字の並びが言葉の順にならないようにする（全部同じ字のときは不可能なので許す）
  let order = rng.shuffle(chars);
  const allSame = chars.every((c) => c === chars[0]);
  for (let i = 0; i < 20 && !allSame && order.join('') === chars.join(''); i++) {
    order = rng.shuffle(chars);
  }
  const tiles = [...order];
  tiles.splice(distractorPos, 0, extra);
  return { kind: 'build', word, chars, tiles, itemKey: wordText(word) };
}

/** 1回分の問題。1回の中で同じ字・言葉は出さない（H5 は4語しかないので最大4題） */
export function generateRound(level: number, seed: number, size: number): KanaQuestion[] {
  const rng = createRng(hashSeed('hiragana', level, seed));
  const kind = kindOf(level);
  const count = CHOICE_COUNTS[Math.max(0, Math.min(4, level))]!;
  if (kind === 'build') {
    const words = level >= 4 ? WORDS_3 : WORDS_2;
    const n = Math.min(size, words.length);
    const picked = rng.sample(words, n);
    const positions = balancedPositions(n, count, rng);
    return picked.map((w, i) => buildQuestion(w, positions[i] ?? 0, rng));
  }
  const chars = rng.sample(
    INCLUDED_KANA.map((e) => e.char),
    size,
  );
  const positions = balancedPositions(size, count, rng);
  return chars.map((c, i) => choiceQuestion(kind, c, count, positions[i] ?? 0, rng));
}

// ---- 判定 ----

export function judgeChoice(q: ChoiceQuestion, index: number): boolean {
  return index === q.answerIndex;
}

/** filled 個が置かれているとき、次のマスに char を置いて正しいか */
export function judgePlace(q: BuildQuestion, filled: number, char: string): boolean {
  return q.chars[filled] === char;
}

// ---- 音声キー（台本は voice.ts が表から作る） ----

export const charKey = (c: string) => `kana.char.${kanaOf(c).romaji}`;
export const questionKey = (c: string) => `kana.q.${kanaOf(c).romaji}`;
export const exampleKey = (c: string) => `kana.ex.${kanaOf(c).romaji}`;
export const firstKey = (id: VocabId) => `kana.first.${id}`;
export const slowKey = (id: VocabId) => `kana.slow.${id}`;
export const splitKey = (id: VocabId) => `kana.split.${id}`;
export const makeKey = (id: VocabId) => `kana.make.${id}`;
export const nthKey = (n: number) => `kana.nth.${n}`;

/** 音声キーの列（数値は無音の間） */
export type Seq = (string | number)[];

/** 問題文 */
export function promptOf(q: KanaQuestion): Seq {
  if (q.kind === 'pick') return [questionKey(q.answer)];
  if (q.kind === 'first') return [`item.${q.word}`, 300, firstKey(q.word)];
  return [makeKey(q.word)];
}

/** 画面上部に出す文（H3 は名前を言い直さず、問いの文だけ） */
export function displayOf(q: KanaQuestion): Seq {
  return q.kind === 'first' ? [firstKey(q.word)] : promptOf(q);
}

/** 最初の問題だけに足す説明 */
export function introOf(kind: HiraKind): string {
  return kind === 'pick' ? 'kana.how-pick' : kind === 'first' ? 'kana.how-first' : 'kana.how-build';
}

/** 押した字を読み上げる誤答の声（「それは『お』だよ」） */
export function thatIsSeq(c: string): Seq {
  return ['kana.that-is', charKey(c), 'kana.dayo'];
}
export function thatIsText(c: string): string {
  return `それは 『${c}』だよ`;
}

/** ヒントの声。level 1 = 注目、2 = 具体 */
export function hintSeq(q: KanaQuestion, level: 1 | 2, filled = 0): Seq {
  if (q.kind === 'pick') {
    return level === 1 ? ['kana.listen-again', charKey(q.answer)] : [exampleKey(q.answer)];
  }
  if (q.kind !== 'build') {
    return level === 1 ? [slowKey(q.word)] : [splitKey(q.word)];
  }
  const c = q.chars[filled]!;
  const nth = [nthKey(filled + 1), charKey(c)];
  if (level === 1 || !kanaOf(c).word) return nth;
  return [...nth, 300, exampleKey(c)];
}

/** ヒントの吹き出しの文（音声と同じ。ただし選ぶ問題の1段目は答えの字を画面に出さない） */
export function hintText(q: KanaQuestion, level: 1 | 2, filled = 0): string {
  if (q.kind === 'pick' && level === 1) return 'もういちど きいてね';
  if (q.kind === 'build' && level === 2) {
    // 吹き出しは短く: 例語の文だけ（マスの音は声で言う）
    const c = q.chars[filled]!;
    if (kanaOf(c).word) return textOf(exampleKey(c));
  }
  return textOf(hintSeq(q, level, filled));
}

/** 完了画面で読み上げる列（取り組んだ字または言葉） */
export function recapSeq(questions: readonly KanaQuestion[]): VoiceSeq {
  const seq: (string | number)[] = [];
  questions.forEach((q, i) => {
    if (i > 0) seq.push(250);
    seq.push(q.kind === 'build' ? `item.${q.word}` : charKey(q.answer));
  });
  return seq;
}
