import type { PackContent } from '../../curriculum/types';
import { honorifics } from './honorifics';
import { wordStructure } from './word-structure';
import { sentenceRelations } from './sentence-relations';
import { figurative } from './figurative';
import { readGist } from './read-gist';
import { readRelations } from './read-relations';
import { textFigure } from './text-figure';
import { writeFactOpinion } from './write-fact-opinion';
import { spokenWritten } from './spoken-written';
import { classics } from './classics';

const pack: PackContent = {
  packId: 'g5-ja',
  units: [
    honorifics,
    wordStructure,
    sentenceRelations,
    figurative,
    readGist,
    readRelations,
    textFigure,
    writeFactOpinion,
    spokenWritten,
    classics,
  ],
};

export default pack;
