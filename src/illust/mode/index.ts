import type { IllustGroup } from '../types';
import { shopping } from './shopping';
import { modeHiragana } from './mode-hiragana';
import { modeSorting } from './mode-sorting';
import { modeShapes } from './mode-shapes';
import { modeMemory } from './mode-memory';
import { modeCompare } from './mode-compare';
import { modeRoad } from './mode-road';
import { modeTrace } from './mode-trace';
import { modeMath } from './mode-math';
import { roadFree } from './road-free';
import { traceLines } from './trace-lines';
import { traceMaze } from './trace-maze';
import { traceLetters } from './trace-letters';
import { mathAdd } from './math-add';
import { mathSub } from './math-sub';
import { mathSplit } from './math-split';
import { mathFormulaAdd } from './math-formula-add';
import { mathFormulaSub } from './math-formula-sub';

export const modeIllust: IllustGroup = {
  'mode-shopping': shopping,
  'mode-hiragana': modeHiragana,
  'mode-sorting': modeSorting,
  'mode-shapes': modeShapes,
  'mode-memory': modeMemory,
  'mode-compare': modeCompare,
  'mode-road': modeRoad,
  'mode-trace': modeTrace,
  'mode-math': modeMath,
  'road-free': roadFree,
  'trace-lines': traceLines,
  'trace-maze': traceMaze,
  'trace-letters': traceLetters,
  'math-add': mathAdd,
  'math-sub': mathSub,
  'math-split': mathSplit,
  'math-formula-add': mathFormulaAdd,
  'math-formula-sub': mathFormulaSub,
};
