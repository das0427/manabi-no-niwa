import type { PackContent } from '../../curriculum/types';
import { alphabetLower } from './alphabet-lower';
import { alphabetUpper } from './alphabet-upper';
import { directions } from './directions';
import { greetings } from './greetings';
import { likes } from './likes';
import { numbersColors } from './numbers-colors';
import { timeDays } from './time-days';
import { want } from './want';

const pack: PackContent = {
  packId: 'en-g34',
  units: [
    greetings,
    numbersColors,
    alphabetUpper,
    alphabetLower,
    timeDays,
    likes,
    want,
    directions,
  ],
};

export default pack;
