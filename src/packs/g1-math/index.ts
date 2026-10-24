import type { PackContent } from '../../curriculum/types';
import { addBasic } from './add-basic';
import { numbers10 } from './numbers-10';
import { composeTen } from './compose-10';
import { subBasic } from './sub-basic';
import { numbers20 } from './numbers-20';
import { addCarry } from './add-carry';
import { subBorrow } from './sub-borrow';
import { numbers120 } from './numbers-120';
import { addSub2digit } from './add-sub-2digit';
import { storyExpression } from './story-expression';
import { compareQuantity } from './compare-quantity';
import { clock } from './clock';
import { shapes } from './shapes';
import { position } from './position';
import { pictureGraph } from './picture-graph';
import { threeNumbers } from './three-numbers';

const pack: PackContent = {
  packId: 'g1-math',
  units: [
    numbers10,
    composeTen,
    addBasic,
    subBasic,
    numbers20,
    addCarry,
    subBorrow,
    numbers120,
    addSub2digit,
    storyExpression,
    compareQuantity,
    clock,
    shapes,
    position,
    pictureGraph,
    threeNumbers,
  ],
};

export default pack;
