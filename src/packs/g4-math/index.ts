import type { PackContent } from '../../curriculum/types';
import { okuCho } from './oku-cho';
import { rounding } from './rounding';
import { div1digit } from './div-1digit';
import { div2digit } from './div-2digit';
import { decimalAddSub } from './decimal-add-sub';
import { decimalInt } from './decimal-int';
import { fractionKinds } from './fraction-kinds';
import { fractionSame } from './fraction-same';
import { orderOps } from './order-ops';
import { parallelPerp } from './parallel-perp';
import { quadrilaterals } from './quadrilaterals';
import { cuboid } from './cuboid';
import { area } from './area';
import { angle } from './angle';
import { changeRelations } from './change-relations';
import { ratioIntro } from './ratio-intro';
import { lineGraph } from './line-graph';
import { twoWayTable } from './two-way-table';

const pack: PackContent = {
  packId: 'g4-math',
  units: [okuCho, rounding, div1digit, div2digit, decimalAddSub, decimalInt, fractionKinds, fractionSame, orderOps, parallelPerp, quadrilaterals, cuboid, area, angle, changeRelations, ratioIntro, lineGraph, twoWayTable],
};

export default pack;
