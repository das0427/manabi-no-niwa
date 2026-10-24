/** 4歳（p4）の教材パック（curriculum-matrix 3.2・4.1）。v1 のモードを使う単元（legacy）と新しい単元 */
import type { PackContent } from '../../curriculum/types';
import { compareUnit } from './compare';
import { countPictures } from './count-pictures';
import { firstSound } from './first-sound';
import { kanaRead } from './kana-read';
import { kanaTraceEarly } from './kana-trace-early';
import { linesUnit } from './lines';
import { memoryUnit } from './memory';
import { patternUnit } from './pattern';
import { roadUnit } from './road';
import { shapesUnit } from './shapes';
import { shopUnit } from './shop';
import { sortUnit } from './sort';
import { wordPlay } from './word-play';

const pack: PackContent = {
  packId: 'p4',
  units: [
    shopUnit,
    countPictures,
    shapesUnit,
    compareUnit,
    firstSound,
    kanaRead,
    wordPlay,
    sortUnit,
    patternUnit,
    memoryUnit,
    roadUnit,
    linesUnit,
    kanaTraceEarly,
  ],
};
export default pack;
