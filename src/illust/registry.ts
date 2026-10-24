import type { IllustDef, IllustGroup } from './types';
import { foodIllust } from './food/index';
import { animalIllust } from './animal/index';
import { vehicleIllust } from './vehicle/index';
import { thingIllust } from './thing/index';
import { iconIllust } from './icon/index';
import { modeIllust } from './mode/index';

const groups: Record<string, IllustGroup> = {
  food: foodIllust,
  animal: animalIllust,
  vehicle: vehicleIllust,
  thing: thingIllust,
  icon: iconIllust,
  mode: modeIllust,
};

export const ILLUST: Record<string, IllustDef> = {};
for (const [g, defs] of Object.entries(groups)) {
  for (const [id, def] of Object.entries(defs)) {
    if (id in ILLUST) throw new Error(`illust id duplicated: ${id} (${g})`);
    if (def.id !== id) throw new Error(`illust id mismatch: ${id} vs ${def.id}`);
    ILLUST[id] = def;
  }
}

export const ILLUST_GROUPS = groups;

export function getIllust(id: string): IllustDef | undefined {
  return ILLUST[id];
}
