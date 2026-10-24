import type { IllustGroup } from '../types';
import { balloon, crown, musicNote, ribbon, sparkle, star } from './decor';
import { book, clock, hat, shoe } from './life';
import { cloud, moon, mountain, mushroom, rainbow, sun } from './nature';
import { rocket, truck } from './vehicle';

/** はんこ用に新しく描いた絵（既存の教材イラストに無い物） */
export const stampIllust: IllustGroup = {
  sun,
  cloud,
  rainbow,
  moon,
  mushroom,
  mountain,
  star,
  ribbon,
  crown,
  'music-note': musicNote,
  balloon,
  sparkle,
  rocket,
  truck,
  hat,
  shoe,
  book,
  clock,
};
