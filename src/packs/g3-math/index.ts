import type { PackContent } from '../../curriculum/types';
import { addSubColumn } from './add-sub-column';
import { barGraph } from './bar-graph';
import { boxExpression } from './box-expression';
import { circleSphere } from './circle-sphere';
import { decimals } from './decimals';
import { divisionBasic } from './division-basic';
import { divisionRemainder } from './division-remainder';
import { fractions } from './fractions';
import { largeNumbers } from './large-numbers';
import { lengthKm } from './length-km';
import { mult1digit } from './mult-1digit';
import { mult2digit } from './mult-2digit';
import { multRules } from './mult-rules';
import { time } from './time';
import { triangles } from './triangles';
import { weight } from './weight';

const pack: PackContent = {
  packId: 'g3-math',
  units: [
    largeNumbers,
    addSubColumn,
    multRules,
    mult1digit,
    mult2digit,
    divisionBasic,
    divisionRemainder,
    decimals,
    fractions,
    boxExpression,
    circleSphere,
    triangles,
    lengthKm,
    weight,
    time,
    barGraph,
  ],
};

export default pack;
