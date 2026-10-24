import type { VoiceEntries } from '../../voice/types';
import { ALL_VALUES, labelOf } from './logic';

const perValue: VoiceEntries = {};
for (const v of ALL_VALUES) {
  perValue[`sort.val.${v}`] = labelOf(v);
  perValue[`sort.is.${v}`] = `これは ${labelOf(v)} だね`;
}

/** なかまわけ の音声台本 */
export const voice = {
  ...perValue,
  'sort.how': 'えを ゆびで さわって、はこを おしてね',
  'sort.by-color': 'いろで わけよう',
  'sort.by-kind': 'なかまで わけよう',
  'sort.then-color': 'こんどは いろで わけなおそう',
  'sort.and': 'と',
  'sort.look-color': 'いろを みてね',
  'sort.look-kind': 'なかまを みてね',
  'sort.pick-first': 'さきに えを ゆびで さわってね',
} satisfies VoiceEntries;
