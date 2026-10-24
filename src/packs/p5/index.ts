/** 5歳（p5）の教材パック（curriculum-matrix 3.3・4.4） */
import type { PackContent } from '../../curriculum/types';
import { addSub } from './add-sub';
import { clockUnit } from './clock';
import { composeUnit } from './compose';
import { kanaReadAll } from './kana-read-all';
import { kanaTrace } from './kana-trace';
import { katakanaRead } from './katakana-read';
import { katakanaTrace } from './katakana-trace';
import { measureCompare } from './measure-compare';
import { numbers10 } from './numbers-10';
import { patternUnit } from './pattern';
import { shapesUnit } from './shapes';
import { stepsUnit } from './steps';
import { storyListen } from './story-listen';
import { wordBuild } from './word-build';

const pack: PackContent = {
  packId: 'p5',
  units: [
    numbers10,
    composeUnit,
    addSub,
    clockUnit,
    shapesUnit,
    measureCompare,
    patternUnit,
    stepsUnit,
    kanaReadAll,
    wordBuild,
    katakanaRead,
    storyListen,
    kanaTrace,
    katakanaTrace,
  ],
};
export default pack;
