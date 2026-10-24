import type { PackContent } from '../../curriculum/types';
import { alphabetLower } from './alphabet-lower';
import { alphabetUpper } from './alphabet-upper';
import { greetings } from './greetings';
import { numbersColors } from './numbers-colors';
import { timeDays } from './time-days';

const pack: PackContent = {
  packId: 'en-g34',
  units: [greetings, numbersColors, alphabetUpper, alphabetLower, timeDays],
};

export default pack;
