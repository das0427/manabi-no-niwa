/**
 * 社会のパックで共有する小さな部品（パックの中だけで使う。他のパックは import しない）。
 * soc-g34 と soc-g56 に同じ内容を置く（パックどうしは import しないため）。
 */
import type {
  ChoiceItem,
  ChoiceOption,
  ExplainItem,
  FillItem,
  GraphItem,
  MapItem,
  MatchItem,
  OrderItem,
  ReadingItem,
  SortItem,
  StageId,
  UnitSpec,
} from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';

export const REVISED = '2026-10-24';

/** 学年より上の字を使ってよい理由（字 → 理由）。テストの許可リストに入る */
export type Allow = Readonly<Record<string, string>>;

export type Hints = [string, string, string];

/** 誤りの選択肢: [文, 誤概念ID?] */
export type Wrong = readonly [label: string, misconception?: string];

export interface ChoiceSpec {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  figure?: Figure;
  right: string;
  rightFigure?: Figure;
  wrongs: readonly Wrong[];
  wrongFigures?: (Figure | undefined)[];
  hints: Hints;
  explain: string;
  explainFigure?: Figure;
  alt?: boolean;
  layout?: 'row' | 'grid' | 'column';
}

function opts(s: ChoiceSpec): ChoiceOption[] {
  return [
    { label: s.right, ...(s.rightFigure ? { figure: s.rightFigure } : {}), correct: true },
    ...s.wrongs.map(([label, m], i) => ({
      label,
      ...(s.wrongFigures?.[i] ? { figure: s.wrongFigures[i] } : {}),
      ...(m ? { misconception: m } : {}),
    })),
  ];
}

export function choiceItem(s: ChoiceSpec): ChoiceItem {
  return {
    engine: 'choice',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    ...(s.figure ? { figure: s.figure } : {}),
    options: opts(s),
    layout: s.layout ?? 'column',
    hints: s.hints,
    explain: s.explain,
    ...(s.explainFigure ? { explainFigure: s.explainFigure } : {}),
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

/** すべて選ぶ（multi）。rights は正解の文、wrongs は誤り */
export interface MultiSpec extends Omit<ChoiceSpec, 'right' | 'rightFigure'> {
  rights: string[];
}
export function multiItem(s: MultiSpec): ChoiceItem {
  return {
    engine: 'choice',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    ...(s.figure ? { figure: s.figure } : {}),
    options: [
      ...s.rights.map((label) => ({ label, correct: true })),
      ...s.wrongs.map(([label, m]) => ({ label, ...(m ? { misconception: m } : {}) })),
    ],
    multi: true,
    layout: s.layout ?? 'column',
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

export interface SortSpec {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  boxes: string[];
  /** [カードの文, 正しい箱の番号] */
  cards: [label: string, box: number][];
  mis: string;
  hints: Hints;
  explain: string;
  alt?: boolean;
}

export function sortItem(s: SortSpec): SortItem {
  return {
    engine: 'sort',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    boxes: s.boxes.map((label) => ({ label })),
    cards: s.cards.map(([label, box]) => ({
      label,
      box,
      wrongBoxes: s.boxes.flatMap((_, b) => (b === box ? [] : [{ box: b, misconception: s.mis }])),
    })),
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

export interface OrderSpec {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  figure?: Figure;
  /** 正しい順 */
  cards: string[];
  ends?: [string, string];
  /** 逆の順の誤概念 */
  mis: string;
  hints: Hints;
  explain: string;
  alt?: boolean;
  layout?: 'row' | 'column';
}

export function orderItem(s: OrderSpec): OrderItem {
  return {
    engine: 'order',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    ...(s.figure ? { figure: s.figure } : {}),
    cards: s.cards.map((label) => ({ label })),
    ...(s.ends ? { ends: s.ends } : {}),
    layout: s.layout ?? (s.cards.length <= 4 ? 'column' : 'row'),
    reverseMisconception: s.mis,
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

export interface MatchSpec {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  /** [左の文, 正しい右の文] */
  pairs: [left: string, right: string][];
  /** 組にならない右のカード */
  extras?: string[];
  mis: string;
  hints: Hints;
  explain: string;
  alt?: boolean;
}

export function matchItem(s: MatchSpec): MatchItem {
  return {
    engine: 'match',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    left: s.pairs.map(([label]) => ({ label })),
    right: [
      ...s.pairs.map(([, label]) => ({ label })),
      ...(s.extras ?? []).map((label) => ({ label })),
    ],
    pairs: s.pairs.map((_, i) => [i, i] as [number, number]),
    wrongPairs: [
      { pair: [0, 1], misconception: s.mis },
      { pair: [1, 0], misconception: s.mis },
    ],
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

export interface FillSpec {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  figure?: Figure;
  /** {{}} を含む文 */
  text: string;
  /** 空欄ごとの [正解, 誤りの例と誤概念[]] */
  blanks: [answer: string, wrong?: [value: string, misconception: string][]][];
  options: string[];
  useOnce?: boolean;
  hints: Hints;
  explain: string;
  alt?: boolean;
}

export function fillItem(s: FillSpec): FillItem {
  return {
    engine: 'fill',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    ...(s.figure ? { figure: s.figure } : {}),
    text: s.text,
    blanks: s.blanks.map(([a, w]) => ({
      answers: [a],
      ...(w ? { wrong: w.map(([value, misconception]) => ({ value, misconception })) } : {}),
    })),
    options: s.options,
    ...(s.useOnce ? { useOnce: true } : {}),
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

export interface ExplainSpec {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  canvas?: { aspect?: number; guide?: 'none' | 'cross' | 'lines'; colors?: boolean };
  reasons?: string[];
  multi?: boolean;
  figure?: Figure;
  hints: Hints;
  explain: string;
  alt?: boolean;
}

export function explainItem(s: ExplainSpec): ExplainItem {
  return {
    engine: 'explain',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    ...(s.figure ? { figure: s.figure } : {}),
    ...(s.canvas ? { canvas: s.canvas } : {}),
    ...(s.reasons ? { reasons: s.reasons.map((label) => ({ label })) } : {}),
    ...(s.multi ? { multiReasons: true } : {}),
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

/** 読み取りの設問（reading）。本文は ReadingItem['passage'] */
export interface ReadingSpec extends Omit<
  ChoiceSpec,
  'figure' | 'rightFigure' | 'wrongFigures' | 'explainFigure'
> {
  passage: ReadingItem['passage'];
  aspect: ReadingItem['aspect'];
  evidence?: ReadingItem['evidence'];
  hintFocus?: ReadingItem['hintFocus'];
}
export function readingItem(s: ReadingSpec): ReadingItem {
  return {
    engine: 'reading',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    passage: s.passage,
    aspect: s.aspect,
    options: opts(s),
    layout: s.layout ?? 'column',
    ...(s.evidence ? { evidence: s.evidence } : {}),
    ...(s.hintFocus ? { hintFocus: s.hintFocus } : {}),
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

/** 表・グラフを読んで選ぶ（graph の choice）。data は GraphItem['data'] */
export interface GraphChoiceSpec extends Omit<
  ChoiceSpec,
  'figure' | 'rightFigure' | 'wrongFigures' | 'explainFigure' | 'layout'
> {
  data: GraphItem['data'];
}
export function graphChoice(s: GraphChoiceSpec): GraphItem {
  return {
    engine: 'graph',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    data: s.data,
    task: { kind: 'choice', options: opts(s as ChoiceSpec) },
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

/** 地図の問題（map）。figure は付けない（エンジンが描く） */
export interface MapSpec {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  task: MapItem['task'];
  misconceptions?: MapItem['misconceptions'];
  wrongAnswers?: MapItem['wrongAnswers'];
  hints: Hints;
  explain: string;
  alt?: boolean;
}
export function mapItem(s: MapSpec): MapItem {
  return {
    engine: 'map',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    task: s.task,
    ...(s.misconceptions ? { misconceptions: s.misconceptions } : {}),
    ...(s.wrongAnswers ? { wrongAnswers: s.wrongAnswers } : {}),
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

/** 表の図 */
export const table = (header: string[], rows: string[][]): Figure => ({
  kind: 'table',
  header,
  rows,
});
/** 大きな文の図 */
export const textFig = (text: string, size: 'm' | 'l' | 'xl' = 'm'): Figure => ({
  kind: 'text',
  text,
  size,
});
/** SVG の図（色は var(--ink) などのトークンだけ。漢字を描き込まない） */
export const svg = (viewBox: string, body: string, label: string): Figure => ({
  kind: 'svg',
  markup: `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  label,
});

/** 単元の共通の項目 */
export function baseSoc(
  id: string,
  stage: StageId,
): Pick<
  UnitSpec,
  'id' | 'stage' | 'subject' | 'domain' | 'priority' | 'icon' | 'review' | 'revised'
> {
  return {
    id,
    stage,
    subject: 'soc',
    domain: 'soc',
    priority: 'P1',
    icon: 'subj-shakai',
    review: 'objective',
    revised: REVISED,
  };
}

/** 作業中の単元（子供画面に出さない。テストは planned を検査しない） */
export function stubUnit(id: string, title: string, stage: StageId): UnitSpec {
  return {
    ...baseSoc(id, stage),
    title,
    kind: 'inquiry',
    status: 'planned',
    prereq: [],
    objectives: [{ id: 'o', title }],
    misconceptions: [],
    levels: [{ label: 'きほん', chance: 0.05 }],
    intro: [],
    source: { kind: 'items', items: [] },
    basis: '',
  };
}
