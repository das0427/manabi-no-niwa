import type { PackContent } from '../../curriculum/types';
import { pendulum } from './pendulum';
import { dissolve } from './dissolve';
import { germination } from './germination';
import { weatherChange } from './weather-change';
import { lever } from './lever';
import { combustion } from './combustion';
import { moonSun } from './moon-sun';
import { electricityUse } from './electricity-use';
<<<<<<< HEAD
import { electromagnet } from './electromagnet';
import { birth } from './birth';
import { flowingWater } from './flowing-water';
=======
import { solutions } from './solutions';
import { humanBody } from './body';
import { plantWater } from './plant-water';
import { ecosystem } from './ecosystem';
import { strata } from './strata';
>>>>>>> p3/p2-sci-g6

const pack: PackContent = {
  packId: 'sci-g56',
  units: [
    pendulum,
    dissolve,
    germination,
    weatherChange,
    lever,
    combustion,
    moonSun,
    electricityUse,
<<<<<<< HEAD
    electromagnet,
    birth,
    flowingWater,
=======
    solutions,
    humanBody,
    plantWater,
    ecosystem,
    strata,
>>>>>>> p3/p2-sci-g6
  ],
};
export default pack;
