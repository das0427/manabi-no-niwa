import type { PackContent } from '../../curriculum/types';
import { kanjiReadG3 } from './kanji-read-g3';
import { kanjiReadG4 } from './kanji-read-g4';
import { kanjiWriteG3 } from './kanji-write-g3';
import { kanjiWriteG4 } from './kanji-write-g4';

const pack: PackContent = {
  packId: 'kanji-g34',
  units: [kanjiReadG3, kanjiWriteG3, kanjiReadG4, kanjiWriteG4],
};

export default pack;
