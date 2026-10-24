/**
 * 教材の文の音声キー（実行時に台本へ登録）。キー = `<packId>/<よみのハッシュ>`、音声は public/audio/<packId>/<hash>.mp3。
 * 生成済みの mp3 が無いときは、登録したよみで端末の日本語音声に読ませる（既存の予備: core/audio/engine.ts）。
 * 音声の生成（scripts/voice）は同じ関数でキーを作るので、表示の文と音声の対応がずれない。
 */
import { plainText } from '../text/rich';
import { speechYomi } from '../text/yomi';
import { VOICE_CATALOG } from './catalog/index';

/** よみの短いハッシュ（FNV-1a 32bit を36進） */
export function yomiHash(yomi: string): string {
  let h = 0x811c9dc5;
  for (const ch of yomi) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function richVoiceKey(packId: string, rich: string): string {
  return `${packId}/${yomiHash(speechYomi(rich))}`;
}

/** 文を台本に登録してキーを返す（同じ文は同じキー） */
export function registerRich(packId: string, rich: string): string {
  const yomi = speechYomi(rich);
  const key = `${packId}/${yomiHash(yomi)}`;
  if (!Object.prototype.hasOwnProperty.call(VOICE_CATALOG, key)) {
    VOICE_CATALOG[key] = { text: plainText(rich), yomi };
  }
  return key;
}
