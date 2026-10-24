import type { PackContent } from '../../curriculum/types';
import { sequence } from './sequence';
import { condition } from './condition';
import { repeat } from './repeat';
import { debug } from './debug';
import { conditionCombo } from './condition-combo';
import { decompose } from './decompose';
import { prefectureFinder } from './prefecture-finder';
import { drawShapes } from './draw-shapes';
import { polygon } from './polygon';
import { debugPlan } from './debug-plan';
import { sensor } from './sensor';
import { efficient } from './efficient';

const pack: PackContent = {
  packId: 'prog-g16',
  units: [sequence, condition, repeat, debug, conditionCombo, decompose, prefectureFinder, drawShapes, polygon, debugPlan, sensor, efficient],
};

export default pack;
