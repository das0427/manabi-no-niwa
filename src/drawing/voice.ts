/**
 * おえかきの音声台本（review-1 #27: 色札を押すと色名を短く読み上げる）。
 * src/voice/catalog/index.ts への登録と mp3 の生成（npm run voice:build）は統括が行う。
 * 登録されるまでは hasVoice() が false なので読み上げない（画面は動く）。
 */
import type { VoiceEntries } from '../voice/types';
import { COLORS_24, COLORS_8, COLORS_6 } from './tools';

const colors: VoiceEntries = {};
for (const c of [...COLORS_6, ...COLORS_8, ...COLORS_24]) colors[`draw.color.${c.id}`] = c.name;

export const voice: VoiceEntries = {
  ...colors,
  'draw.title': 'おえかき',
  'draw.gallery': 'さくひん',
  'draw.other-tab': 'べつの がめんで かいています',
};

export const colorVoiceKey = (id: string): string => `draw.color.${id}`;
