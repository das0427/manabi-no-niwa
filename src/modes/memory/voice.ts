import { vocab } from '../../content/vocab';
import type { VoiceEntries } from '../../voice/types';
import { POOL } from './logic';

const perItem: VoiceEntries = {};
for (const id of POOL) perItem[`mem.first.${id}`] = `さいしょは ${vocab(id).label} だったよ`;

/** おぼえてさがす の音声台本 */
export const voice = {
  ...perItem,
  'mem.look': 'よく みてね',
  'mem.press': 'おぼえたら おぼえたを おしてね',
  'mem.look-again': 'もういちど よく みてね',
  'mem.which': 'どれだったかな',
  'mem.which2': 'どれと どれだったかな',
  'mem.where': 'どこに あったかな',
  'mem.order': 'じゅんばんに ならべよう',
  'mem.hint-review': 'もういちど みても いいよ',
  'mem.hint-review2': 'もういちど みて みよう',
  'mem.answer': 'こたえは これだよ',
} satisfies VoiceEntries;
