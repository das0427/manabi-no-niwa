/**
 * 英語の音声の発音の上書き（設計書 7.1・7.2・5.13）。試聴で直したものだけ書く（文字の名前 abc・find は音素で固定）。
 * key は台本の key（`en/` を除いたもの）。
 *   say      … 合成する綴りの言い換え（text は台本の表示用のまま。読み誤り対策）
 *   phonemes … IPA の音素列をそのまま合成（espeak-ng 風。say より優先。文字の名前 A〜Z など）
 *   speed    … 基準話速（0.85）に掛ける倍率。0.7 未満にしない（実効 0.6 未満は不自然）。文は 0.95 まで
 */
import { findPhonemes, LETTER_IPA, LETTERS } from './abc';

export interface Pronounce {
  say?: string;
  phonemes?: string;
  speed?: number;
}

export const PRONOUNCE: Record<string, Pronounce> = {
  // 例: 'en-pre.word.toes': { say: 'Toes.' },
};

// 文字の名前（p5.en.abc）と、別例の文「Find the letter B.」は音素で固定する（A が冠詞 /ə/ と読まれないように）
for (const L of LETTERS) {
  const l = L.toLowerCase();
  PRONOUNCE[`en-pre.abc.${l}`] = { phonemes: LETTER_IPA[L]! };
  PRONOUNCE[`en-pre.find.find-the-letter-${l}`] = { phonemes: findPhonemes(L) };
}
