import type { IllustDef, IllustGroup } from './types';
import { foodIllust } from './food/index';
import { animalIllust } from './animal/index';
import { vehicleIllust } from './vehicle/index';
import { thingIllust } from './thing/index';
import { iconIllust } from './icon/index';
import { modeIllust } from './mode/index';
import { subjectIllust } from './subject/index';

const groups: Record<string, IllustGroup> = {
  food: foodIllust,
  animal: animalIllust,
  vehicle: vehicleIllust,
  thing: thingIllust,
  icon: iconIllust,
  mode: modeIllust,
  subject: subjectIllust,
};

/**
 * 教材パックの担当が描いた絵（src/illust/content/<packId>.tsx が IllustGroup を export）。
 * 自動で読み込む（担当ごとに登録表を編集しない）。Node のスクリプト（tsx）では import.meta.glob が無いので読まない。
 */
// Vite はこの呼び出しを静的に書き換える。Node（tsx）では呼び出しが失敗するので空にする
function loadContent(): Record<string, Record<string, unknown>> {
  try {
    return import.meta.glob<Record<string, unknown>>('./content/*.tsx', { eager: true });
  } catch {
    return {};
  }
}
const contentModules = loadContent();
for (const [path, mod] of Object.entries(contentModules)) {
  const name = /content\/(.+)\.tsx$/.exec(path)?.[1] ?? path;
  for (const [exp, value] of Object.entries(mod)) {
    if (value && typeof value === 'object') groups[`content:${name}:${exp}`] = value as IllustGroup;
  }
}

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
