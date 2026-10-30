import type { PackContent } from '../../curriculum/types';
import { pendulum } from './pendulum';
import { dissolve } from './dissolve';
import { germination } from './germination';
import { weatherChange } from './weather-change';
import { lever } from './lever';
import { combustion } from './combustion';
import { moonSun } from './moon-sun';
import { electricityUse } from './electricity-use';
import { electromagnet } from './electromagnet';
import { birth } from './birth';
import { flowingWater } from './flowing-water';
import { solutions } from './solutions';
import { humanBody } from './body';
import { plantWater } from './plant-water';
import { ecosystem } from './ecosystem';
import { strata } from './strata';

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
    electromagnet,
    birth,
    flowingWater,
    solutions,
    humanBody,
    plantWater,
    ecosystem,
    strata,
  ],
};
export default pack;
