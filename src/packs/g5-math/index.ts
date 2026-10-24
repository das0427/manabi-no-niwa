import type { PackContent } from '../../curriculum/types';
import { multiplesDivisors } from './multiples-divisors';
import { decimalShift } from './decimal-shift';
import { decimalMult } from './decimal-mult';
import { decimalDiv } from './decimal-div';
import { fractionDecimal } from './fraction-decimal';
import { fractionEquiv } from './fraction-equiv';
import { fractionAddDiff } from './fraction-add-diff';
import { congruence } from './congruence';
import { angleSum } from './angle-sum';
import { polygonCircle } from './polygon-circle';
import { prismCylinder } from './prism-cylinder';
import { areaFormulas } from './area-formulas';
import { volume } from './volume';
import { proportionSimple } from './proportion-simple';
import { perUnit } from './per-unit';
import { speed } from './speed';
import { percent } from './percent';
import { pieBand } from './pie-band';
import { average } from './average';

const pack: PackContent = {
  packId: 'g5-math',
  units: [
    multiplesDivisors,
    decimalShift,
    decimalMult,
    decimalDiv,
    fractionDecimal,
    fractionEquiv,
    fractionAddDiff,
    congruence,
    angleSum,
    polygonCircle,
    prismCylinder,
    areaFormulas,
    volume,
    proportionSimple,
    perUnit,
    speed,
    percent,
    pieBand,
    average,
  ],
};

export default pack;
