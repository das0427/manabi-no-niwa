import type { VoiceEntries } from '../../voice/types';

/** みちを つくろう の音声台本（road.variant.* は共通台本にある） */
export const voice = {
  // もんだい
  'road.intro': 'うさぎさんが にんじんの ところへ いくよ。みちを つくろう',
  'road.how1': 'みちを えらんで、あいている ますを タップしてね',
  'road.how2': 'おいた みちを タップすると、まわるよ',
  'road.how3': 'できたら しゅっぱつを おしてね',
  'road.prompt': 'みちを つなごう',
  'road.arrived': 'にんじんに ついたよ',
  'road.hint-start': 'いえから にんじんまで、みちを つなげて みよう',
  'road.hint1': 'うさぎが とまった ところから つづきを つくろう',
  'road.hint2': 'ここを つなぐと よさそうだよ',
  // みちのどうぐ
  'road.tool.straight': 'まっすぐ',
  'road.tool.corner': 'まがりかど',
  'road.tool.tee': 'わかれみち',
  'road.tool.erase': 'けす',
  // じゆうに つくる
  'road.free-intro': 'すきな みちを つくろう。できたら かざるを おしてね',
  'road.free-prompt': 'すきな みちを つくろう',
  'road.free-stopped': 'ここで とまったよ。つづきを つくって みよう',
  'road.decorated': 'みちを かざったよ',
} satisfies VoiceEntries;
