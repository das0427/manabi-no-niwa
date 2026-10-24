/** エンジンの登録（engine id → 定義）。エンジンを足したらここに加える（統括が管理） */
import type { EngineId, Item } from '../curriculum/types';
import { buildEngine } from './build/build';
import { choiceEngine } from './choice/choice';
import { fillEngine } from './fill/fill';
import { matchEngine } from './match/match';
import { numberEngine } from './number/number';
import { orderEngine } from './order/order';
import { sortEngine } from './sort/sort';
import { listenEngine } from './listen/listen';
import { readingEngine } from './reading/reading';
import { traceEngine } from './trace/trace';
import { explainEngine } from './explain/explain';
import { programEngine } from './program/program';
import type { EngineDef } from './types';

type Def<K extends EngineId> = EngineDef<Extract<Item, { engine: K }>, never>;

export const ENGINES: { [K in EngineId]: Def<K> } = {
  choice: choiceEngine as Def<'choice'>,
  number: numberEngine as Def<'number'>,
  order: orderEngine as unknown as Def<'order'>,
  sort: sortEngine as unknown as Def<'sort'>,
  match: matchEngine as unknown as Def<'match'>,
  fill: fillEngine as unknown as Def<'fill'>,
  build: buildEngine as unknown as Def<'build'>,
  listen: listenEngine as unknown as Def<'listen'>,
  reading: readingEngine as unknown as Def<'reading'>,
  trace: traceEngine as unknown as Def<'trace'>,
  explain: explainEngine as unknown as Def<'explain'>,
  program: programEngine as unknown as Def<'program'>,
};

export function engineOf(item: Item): EngineDef<Item, unknown> {
  return ENGINES[item.engine] as unknown as EngineDef<Item, unknown>;
}
