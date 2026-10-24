import type { PackContent } from '../../curriculum/types';
import { romaji } from './romaji';
import { modifiers } from './modifiers';
import { referenceConnectives } from './reference-connectives';
import { dictionary } from './dictionary';
import { kanjiParts } from './kanji-parts';
import { proverbs } from './proverbs';
import { readParagraphs } from './read-paragraphs';
import { readCharacter } from './read-character';
import { writeReasons } from './write-reasons';

const pack: PackContent = {
  packId: 'g3-ja',
  units: [
    romaji,
    modifiers,
    referenceConnectives,
    dictionary,
    kanjiParts,
    proverbs,
    readParagraphs,
    readCharacter,
    writeReasons,
  ],
};

export default pack;
