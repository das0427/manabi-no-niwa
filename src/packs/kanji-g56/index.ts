import type { PackContent } from '../../curriculum/types';
import { kanjiReadG5 } from './kanji-read-g5';
import { kanjiReadG6 } from './kanji-read-g6';
import { kanjiWriteG5 } from './kanji-write-g5';
import { kanjiWriteG6 } from './kanji-write-g6';

const pack: PackContent = {
  packId: 'kanji-g56',
  units: [kanjiReadG5, kanjiWriteG5, kanjiReadG6, kanjiWriteG6],
};

export default pack;