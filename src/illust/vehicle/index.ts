import type { IllustGroup } from '../types';
import { carRed } from './car-red';
import { busYellow } from './bus-yellow';
import { train } from './train';
import { airplane } from './airplane';
import { ship } from './ship';
import { bicycle } from './bicycle';

export const vehicleIllust: IllustGroup = {
  'car-red': carRed,
  'bus-yellow': busYellow,
  train,
  airplane,
  ship,
  bicycle,
};
