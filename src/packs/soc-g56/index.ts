import type { PackContent } from '../../curriculum/types';
import type { Allow } from './util';
import { land, landAllow } from './land';
import { food, foodAllow } from './food';
import { industry, industryAllow } from './industry';
import { politics, politicsAllow } from './politics';
import { history1, history1Allow } from './history-1';
import { history2, history2Allow } from './history-2';
import { history3, history3Allow } from './history-3';
import { world, worldAllow } from './world';

const pack: PackContent = {
  packId: 'soc-g56',
  units: [land, food, industry, politics, history1, history2, history3, world],
};

/** 単元ごとの、学年より上の字を使ってよい理由（テストの許可リスト） */
export const ALLOW: Readonly<Record<string, Allow>> = {
  'g5.soc.land': landAllow,
  'g5.soc.food': foodAllow,
  'g5.soc.industry': industryAllow,
  'g6.soc.politics': politicsAllow,
  'g6.soc.history-1': history1Allow,
  'g6.soc.history-2': history2Allow,
  'g6.soc.history-3': history3Allow,
  'g6.soc.world': worldAllow,
};

export default pack;
