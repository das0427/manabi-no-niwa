import type { VoiceEntries } from '../../voice/types';
import { K2_PICTURES, K3_PICTURES, K4_PICTURES, K5_PICTURES } from './content';
import { SHAPES, SHAPE_LABEL, type ShapeId } from './geometry';

/** ヒント1: その形の特徴（数や形の言葉で言う。答えの場所は言わない） */
const FEATURE: Record<ShapeId, string> = {
  circle: 'まるい かたちだよ。かどは ないね',
  square: 'かどが よっつ。ながさは みんな おなじ',
  rect: 'かどが よっつ。ながい ところが あるよ',
  triangle: 'かどが みっつ あるよ',
  rtriangle: 'かどが みっつ。しかくい かどが ある',
  semicircle: 'はんぶんの まる。まっすぐな ところ',
  star: 'とがった かどが いつつ あるよ',
  heart: 'したが とがって いるよ。うえは まるい',
};

const names: VoiceEntries = {};
const features: VoiceEntries = {};
for (const id of SHAPES) {
  names[`shape.name.${id}`] = SHAPE_LABEL[id];
  features[`shape.feat.${id}`] = FEATURE[id];
}

const made: VoiceEntries = {};
for (const pic of [...K2_PICTURES, ...K3_PICTURES, ...K4_PICTURES, ...K5_PICTURES]) {
  made[`shape.made.${pic.id}`] = `${pic.name}が できたね`;
}

/** かたち・パズルの音声台本（接頭辞 shape.） */
export const voice = {
  ...names,
  ...features,
  ...made,
  'shape.q-same': 'おなじ かたちは どれかな',
  'shape.q-make': 'かたちを いれて えを つくろう',
  'shape.q-sample': 'みほんと おなじ えを つくろう',
  'shape.how': 'かたちを おして、いれたい ところを おしてね',
  'shape.how-turn': 'まわすを おすと、かたちの むきが かわるよ',
  'shape.how-sample': 'みほんを みて、おなじに なるように いれてね',
  'shape.pick-first': 'さきに かたちを えらんでね',
  'shape.try-turn': 'むきを かえて みよう',
  'shape.here': 'ここに いれて みよう',
  'shape.here-find': 'ここに はいる かたちを さがそう',
  'shape.here-turn': 'むきを かえて ここに いれよう',
  'shape.rotated': 'むきを かえたら はいったね',
  'shape.fit': 'ぴったり はいったね',
  'shape.answer': 'こたえは これだよ',
} satisfies VoiceEntries;
