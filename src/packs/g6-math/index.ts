import type { PackContent } from '../../curriculum/types';
import { fractionDiv } from './fraction-div';
import { fractionMult } from './fraction-mult';
import { letters } from './letters';
import { circleArea } from './circle-area';
import { combinations } from './combinations';
import { frequency } from './frequency';
import { representative } from './representative';
import { inverse } from './inverse';
import { prismVolume } from './prism-volume';
import { proportion } from './proportion';
import { ratio } from './ratio';
import { scale } from './scale';
import { symmetry } from './symmetry';

const pack: PackContent = {
  packId: 'g6-math',
  units: [
    fractionMult,
    fractionDiv,
    letters,
    symmetry,
    scale,
    circleArea,
    prismVolume,
    ratio,
    proportion,
    inverse,
    representative,
    frequency,
    combinations,
  ],
};

export default pack;
