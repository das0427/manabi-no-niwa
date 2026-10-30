import type { PackContent } from '../../curriculum/types';
import { livingThings } from './living-things';
import { sunGround } from './sun-ground';
import { magnets } from './magnets';
import { circuits } from './circuits';
import { airWater } from './air-water';
import { current } from './current';
import { weather } from './weather';
import { moonStars } from './moon-stars';
import { weight } from './weight';
import { windRubber } from './wind-rubber';
import { lightSound } from './light-sound';

const pack: PackContent = {
  packId: 'sci-g34',
  units: [
    livingThings,
    sunGround,
    magnets,
    circuits,
    airWater,
    current,
    weather,
    moonStars,
    weight,
    windRubber,
    lightSound,
  ],
};
export default pack;
