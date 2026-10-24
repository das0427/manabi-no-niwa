/** エンジンの登録（engine id → 定義）。エンジンを足したらここに加える（統括が管理） */
import type { EngineId, Item } from '../curriculum/types';
import { choiceEngine } from './choice/choice';
import { numberEngine } from './number/number';
import type { EngineDef } from './types';

export const ENGINES: { [K in EngineId]: EngineDef<Extract<Item, { engine: K }>, never> } = {
  choice: choiceEngine as EngineDef<Extract<Item, { engine: 'choice' }>, never>,
  number: numberEngine as EngineDef<Extract<Item, { engine: 'number' }>, never>,
};

export function engineOf(item: Item): EngineDef<Item, unknown> {
  return ENGINES[item.engine] as unknown as EngineDef<Item, unknown>;
}
