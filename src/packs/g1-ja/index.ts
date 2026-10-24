import type { PackContent } from '../../curriculum/types';
import { hiraganaRead } from './hiragana-read';
import { hiraganaWrite } from './hiragana-write';
import { specialKana } from './special-kana';
import { particles } from './particles';
import { punctuation } from './punctuation';
import { katakana } from './katakana';
import { vocabGroups } from './vocab-groups';
import { sentenceBuild } from './sentence-build';
import { readStory } from './read-story';
import { readInfo } from './read-info';
import { listen } from './listen';
import { writeOrder } from './write-order';

const pack: PackContent = {
  packId: 'g1-ja',
  units: [
    hiraganaRead,
    hiraganaWrite,
    specialKana,
    particles,
    punctuation,
    katakana,
    vocabGroups,
    sentenceBuild,
    readStory,
    readInfo,
    listen,
    writeOrder,
  ],
};

export default pack;
