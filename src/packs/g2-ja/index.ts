import type { PackContent } from '../../curriculum/types';
import { katakanaWords } from './katakana-words';
import { subjectPredicate } from './subject-predicate';
import { polite } from './polite';
import { vocabMeaning } from './vocab-meaning';
import { orthography } from './orthography';
import { readStory } from './read-story';
import { readInfo } from './read-info';
import { writeStructure } from './write-structure';

const pack: PackContent = {
  packId: 'g2-ja',
  units: [
    katakanaWords,
    subjectPredicate,
    polite,
    vocabMeaning,
    orthography,
    readStory,
    readInfo,
    writeStructure,
  ],
};

export default pack;
