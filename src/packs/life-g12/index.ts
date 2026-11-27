import type { PackContent } from '../../curriculum/types';
import { schoolSafety } from './school-safety';
import { seasons } from './seasons';
import { plantDiary } from './plant-diary';
import { growth } from './growth';
import { town } from './town';
import { animals } from './animals';
import { publicUse } from './public';
import { home } from './home';
import { tell } from './tell';

const pack: PackContent = {
  packId: 'life-g12',
  units: [schoolSafety, seasons, plantDiary, growth, town, animals, publicUse, home, tell],
};

export default pack;
