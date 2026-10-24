import { VOICE_CATALOG, type VoiceSeq } from '../voice/catalog/index';
import { voiceText } from '../voice/types';

/** 音声の列から、画面に出す文を作る（読めなくても困らない補助の文字。DESINGN.md 4章） */
export function textOf(seq: VoiceSeq): string {
  const keys =
    typeof seq === 'string' ? [seq] : seq.filter((k): k is string => typeof k === 'string');
  return keys
    .map((k) => {
      const e = VOICE_CATALOG[k];
      return e ? voiceText(e) : '';
    })
    .filter(Boolean)
    .join(' ');
}
