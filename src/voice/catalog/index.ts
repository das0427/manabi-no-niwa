import { commonVoice } from './common';
import { voice as shopping } from '../../modes/shopping/voice';
import { voice as hiragana } from '../../modes/hiragana/voice';
import { voice as sorting } from '../../modes/sorting/voice';
import { voice as shapes } from '../../modes/shapes/voice';
import { voice as memory } from '../../modes/memory/voice';
import { voice as compare } from '../../modes/compare/voice';
import { voice as road } from '../../modes/road/voice';
import { voice as trace } from '../../modes/trace/voice';
import { voice as math } from '../../modes/math/voice';
import { voice as drawing } from '../../drawing/voice';
import type { VoiceEntries } from '../types';

/**
 * 全音声の台本。キーの接頭辞:
 * app/praise/title/item/num/count = 共通、shop/kana/sort/shape/mem/cmp/road/trace/math = 各モード
 */
const parts: Record<string, VoiceEntries> = {
  common: commonVoice,
  shopping,
  hiragana,
  sorting,
  shapes,
  memory,
  compare,
  road,
  trace,
  math,
  drawing,
};

function merge(): VoiceEntries {
  const out: VoiceEntries = {};
  for (const [name, entries] of Object.entries(parts)) {
    for (const [k, v] of Object.entries(entries)) {
      if (k in out) throw new Error(`voice key duplicated: ${k} (${name})`);
      if (!/^[a-z0-9._-]+$/.test(k)) throw new Error(`invalid voice key: ${k}`);
      out[k] = v;
    }
  }
  return out;
}

export const VOICE_CATALOG: VoiceEntries = merge();

/** 音声キー。実在の確認は実行時（開発時の警告）と単体テストで行う */
export type VoiceKey = string;

/** 再生する列。数値は無音の間（ミリ秒） */
export type VoiceSeq = VoiceKey | readonly (VoiceKey | number)[];

export function hasVoice(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(VOICE_CATALOG, key);
}
