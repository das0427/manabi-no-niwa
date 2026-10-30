import type { PackContent } from '../../curriculum/types';
import { kanjiUsage } from './kanji-usage';
import { readArgument } from './read-argument';
import { readLiterature } from './read-literature';
import { infoRelations } from './info-relations';
import { classicsRead } from './classics-read';
import { writeOpinion } from './write-opinion';
import { languageChange } from './language-change';

const pack: PackContent = {
  packId: 'g6-ja',
  units: [
    kanjiUsage,
    readArgument,
    readLiterature,
    infoRelations,
    classicsRead,
    writeOpinion,
    languageChange,
  ],
};

export default pack;
