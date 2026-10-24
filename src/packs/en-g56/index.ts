import type { PackContent } from '../../curriculum/types';
import { lettersWrite } from './letters-write';
import { listenSelf } from './listen-self';
import { past } from './past';
import { places } from './places';
import { readWords } from './read-words';
import { sentenceWrite } from './sentence-write';
import { wordOrder } from './word-order';

const pack: PackContent = {
  packId: 'en-g56',
  units: [lettersWrite, listenSelf, readWords, wordOrder, past, places, sentenceWrite],
};

export default pack;
