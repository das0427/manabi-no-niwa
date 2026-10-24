/**
 * 理科のパックで共有する小さな部品（パックの中だけで使う。他のパックは import しない）。
 * sci-g34 と sci-g56 に同じものを置く（パックどうしの import をしないため）。
 *
 * 理科の単元はすべて「探究」（curriculum-matrix 1.3: 場面6以上・設問24以上）。
 * 観察・実験は本物でするもので、この単元は予想・条件の整理・結果の読み取り・考察の補助（0.4）。
 * 結果の数値は「れい」（例示）と書く。火・薬品・コンセントを使う手順は書かない。
 */
import type {
  ChoiceItem,
  ExperimentItem,
  OrderItem,
  RichText,
  SortItem,
  UnitSpec,
} from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';

export const REVISED = '2026-10-24';

/** 誤りの選択肢: [文, 誤概念ID] */
export type Wrong = readonly [label: RichText, misconception: string];
export type Hints = [RichText, RichText, RichText];

interface Common {
  id: string;
  obj: string;
  level: number;
  prompt: RichText;
  figure?: Figure;
  hints: Hints;
  explain: RichText;
  explainFigure?: Figure;
  alt?: boolean;
}

function common(s: Common) {
  return {
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    ...(s.figure ? { figure: s.figure } : {}),
    hints: s.hints,
    explain: s.explain,
    ...(s.explainFigure ? { explainFigure: s.explainFigure } : {}),
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

export interface ChoiceSpec extends Common {
  right: RichText;
  rightFigure?: Figure;
  wrongs: readonly Wrong[];
  wrongFigures?: (Figure | undefined)[];
  layout?: 'row' | 'grid' | 'column';
  fixedOrder?: boolean;
}

/** 1つ選ぶ（正解は1つ。誤りの選択肢には必ず誤概念） */
export function choice(s: ChoiceSpec): ChoiceItem {
  return {
    engine: 'choice',
    ...common(s),
    options: [
      { label: s.right, ...(s.rightFigure ? { figure: s.rightFigure } : {}), correct: true },
      ...s.wrongs.map(([label, m], i) => ({
        label,
        ...(s.wrongFigures?.[i] ? { figure: s.wrongFigures[i] } : {}),
        misconception: m,
      })),
    ],
    layout: s.layout ?? 'column',
    ...(s.fixedOrder ? { fixedOrder: true } : {}),
  };
}

export interface MultiSpec extends Common {
  /** [文, 正解か, 誤りのときの誤概念] */
  options: readonly [label: RichText, correct: boolean, misconception?: string][];
}

/** すべて選ぶ */
export function multi(s: MultiSpec): ChoiceItem {
  return {
    engine: 'choice',
    ...common(s),
    multi: true,
    options: s.options.map(([label, correct, m]) => ({
      label,
      ...(correct ? { correct: true } : m ? { misconception: m } : {}),
    })),
    layout: 'column',
  };
}

export interface SortSpec extends Common {
  boxes: RichText[];
  /** [カードの文, 正しい箱の番号] */
  cards: [label: RichText, box: number][];
  /** 箱を取り違えたときの誤概念（箱ごとに変えるときは misByBox） */
  mis: string;
  /** 正しい箱 → その箱のカードを入れ違えたときの誤概念（省略時 mis） */
  misByBox?: Record<number, string>;
}

export function sort(s: SortSpec): SortItem {
  return {
    engine: 'sort',
    ...common(s),
    boxes: s.boxes.map((label) => ({ label })),
    cards: s.cards.map(([label, box]) => ({
      label,
      box,
      wrongBoxes: s.boxes.flatMap((_, b) =>
        b === box ? [] : [{ box: b, misconception: s.misByBox?.[box] ?? s.mis }],
      ),
    })),
  };
}

export interface OrderSpec extends Common {
  /** 正しい順 */
  cards: RichText[];
  ends?: [RichText, RichText];
  mis: string;
  layout?: 'row' | 'column';
}

export function order(s: OrderSpec): OrderItem {
  return {
    engine: 'order',
    ...common(s),
    cards: s.cards.map((label) => ({ label })),
    ...(s.ends ? { ends: s.ends } : {}),
    layout: s.layout ?? (s.cards.length <= 4 ? 'column' : 'row'),
    reverseMisconception: s.mis,
  };
}

export interface ExpSpec extends Common {
  setup: ExperimentItem['setup'];
  task: ExperimentItem['task'];
  initial?: ExperimentItem['initial'];
  misconceptions?: ExperimentItem['misconceptions'];
  wrongConditions?: ExperimentItem['wrongConditions'];
}

export function exp(s: ExpSpec): ExperimentItem {
  return {
    engine: 'experiment',
    ...common(s),
    setup: s.setup,
    task: s.task,
    ...(s.initial ? { initial: s.initial } : {}),
    ...(s.misconceptions ? { misconceptions: s.misconceptions } : {}),
    ...(s.wrongConditions ? { wrongConditions: s.wrongConditions } : {}),
  };
}

/** consider の選択肢（正解は先頭） */
export function considerOpts(
  right: RichText,
  wrongs: readonly Wrong[],
): { kind: 'consider'; options: ChoiceItem['options']; minTrials?: number } {
  return {
    kind: 'consider',
    options: [
      { label: right, correct: true },
      ...wrongs.map(([label, m]) => ({ label, misconception: m })),
    ],
  };
}

// ---- 図 ----
export const illust = (id: string, count?: number): Figure => ({
  kind: 'illust',
  id,
  ...(count ? { count } : {}),
});
export const text = (t: RichText, size: 'm' | 'l' | 'xl' = 'm'): Figure => ({
  kind: 'text',
  text: t,
  size,
});
export const table = (header: RichText[], rows: RichText[][]): Figure => ({
  kind: 'table',
  header,
  rows,
});
export const row = (...items: Figure[]): Figure => ({ kind: 'row', items, gap: 8 });
/** SVG の図（色は var(--ink) などのトークンだけ。文字は描かない） */
export const svg = (markup: string, label: RichText): Figure => ({ kind: 'svg', markup, label });

/** 単元の共通の項目 */
export function baseSci(
  id: string,
  stage: 'g3' | 'g4' | 'g5' | 'g6',
  domain: 'A-matter' | 'B-life',
): Pick<
  UnitSpec,
  'id' | 'stage' | 'subject' | 'domain' | 'priority' | 'status' | 'icon' | 'review' | 'revised' | 'kind'
> {
  return {
    id,
    stage,
    subject: 'sci',
    domain,
    kind: 'inquiry',
    priority: 'P1',
    status: 'ready',
    icon: 'subj-rika',
    review: 'objective',
    revised: REVISED,
  };
}

/** 3段（導入・基礎・応用）の段階 */
export const LEVELS3: UnitSpec['levels'] = [
  { label: 'みる・よそうする', chance: 0.25 },
  { label: 'しらべる・きろくする', chance: 0.25 },
  { label: 'かんがえる・つかう', chance: 0.25 },
];
