import type { PackContent } from '../../curriculum/types';
import { addColumn } from './add-column';
import { addSub3digit } from './add-sub-3digit';
import { addSubRelations } from './add-sub-relations';
import { numbers1000 } from './numbers-1000';
import { numbers10000 } from './numbers-10000';
import { multBeyond } from './mult-beyond';
import { multMeaning } from './mult-meaning';
import { box } from './box';
import { fractionSimple } from './fraction-simple';
import { length } from './length';
import { tablesGraphs } from './tables-graphs';
import { trianglesQuads } from './triangles-quads';
import { subColumn } from './sub-column';
import { time } from './time';
import { timesTables } from './times-tables';
import { volume } from './volume';

const pack: PackContent = {
  packId: 'g2-math',
  units: [
    numbers1000,
    numbers10000,
    addColumn,
    subColumn,
    addSub3digit,
    addSubRelations,
    multMeaning,
    timesTables,
    multBeyond,
    length,
    volume,
    time,
    fractionSimple,
    trianglesQuads,
    box,
    tablesGraphs,
  ],
};

export default pack;
