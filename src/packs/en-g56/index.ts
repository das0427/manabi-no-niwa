import type { PackContent } from '../../curriculum/types';
import { lettersWrite } from './letters-write';
import { listenSelf } from './listen-self';
import { future } from './future';
import { past } from './past';
import { places } from './places';
import { readWords } from './read-words';
import { sentenceWrite } from './sentence-write';
import { where } from './where';
import { wordOrder } from './word-order';

const pack: PackContent = {
  packId: 'en-g56',
  units: [
    lettersWrite,
    listenSelf,
    readWords,
    wordOrder,
    where,
    past,
    places,
    sentenceWrite,
    future,
  ],
};

export default pack;
