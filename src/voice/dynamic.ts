/**
 * 教材の文の音声（実行時に台本へ登録）。部品の作り方は speech.ts。
 * 生成済みの mp3 が無いときは、登録したよみで端末の日本語音声に読ませる（既存の予備: core/audio/engine.ts）。
 */
import { VOICE_CATALOG, type VoiceSeq } from './catalog/index';
import { yomiHash } from './hash';
import { speechParts } from './speech';
import { speechYomi } from '../text/yomi';

export { yomiHash };

/** 文まるごとのキー（数字を含まない文の音声キー） */
export function richVoiceKey(packId: string, rich: string): string {
  return `${packId}/${yomiHash(speechYomi(rich))}`;
}

/** 文を部品に分けて台本に登録し、再生する列を返す */
export function registerRich(packId: string, rich: string): VoiceSeq {
  const parts = speechParts(packId, rich);
  for (const p of parts) {
    if (!Object.prototype.hasOwnProperty.call(VOICE_CATALOG, p.key)) {
      VOICE_CATALOG[p.key] = { text: p.text, yomi: p.yomi };
    }
  }
  return parts.map((p) => p.key);
}
