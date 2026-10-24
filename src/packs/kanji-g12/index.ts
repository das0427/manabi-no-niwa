import type { PackContent } from '../../curriculum/types';
import { kanjiReadG1 } from './kanji-read-g1';
import { kanjiReadG2 } from './kanji-read-g2';
import { kanjiWriteG1 } from './kanji-write-g1';
import { kanjiWriteG2 } from './kanji-write-g2';

const pack: PackContent = {
  packId: 'kanji-g12',
  units: [kanjiReadG1, kanjiWriteG1, kanjiReadG2, kanjiWriteG2],
};

export default pack;
