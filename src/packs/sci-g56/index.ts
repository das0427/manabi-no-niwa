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
  ],
};
export default pack;
