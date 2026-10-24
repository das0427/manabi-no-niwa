import type { PackContent } from '../../curriculum/types';
import { livingThings } from './living-things';
import { sunGround } from './sun-ground';
import { magnets } from './magnets';
import { circuits } from './circuits';
import { airWater } from './air-water';
import { current } from './current';
import { weather } from './weather';
import { moonStars } from './moon-stars';

const pack: PackContent = {
  packId: 'sci-g34',
  units: [livingThings, sunGround, magnets, circuits, airWater, current, weather, moonStars],
};
export default pack;
