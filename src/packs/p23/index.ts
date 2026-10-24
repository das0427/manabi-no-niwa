/** 2〜3歳（p23）の教材パック（curriculum-matrix 3.1）。段階0 が 2歳段階（L2）、段階1以上が 3歳段階（L3） */
import type { PackContent } from '../../curriculum/types';
import { compareUnit } from './compare';
import { dailyLife } from './daily-life';
import { linesUnit } from './lines';
import { shapeMatch } from './shape-match';
import { shopUnit } from './shop';
import { sortUnit } from './sort';
import { soundPlay } from './sound-play';
import { wordListen } from './word-listen';

const pack: PackContent = {
  packId: 'p23',
  units: [shapeMatch, sortUnit, compareUnit, shopUnit, wordListen, soundPlay, dailyLife, linesUnit],
};
export default pack;
