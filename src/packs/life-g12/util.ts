/**
 * life-g12 の単元で共有する小さな部品（パックの中だけで使う。他のパックは import しない）。
 */
import type {
  ChoiceItem,
  ExplainItem,
  MatchItem,
  OrderItem,
  SortItem,
  UnitSpec,
} from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { plainText } from '../../text/rich';

export const REVISED = '2026-10-24';

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
  /** 誤りの選択肢にも絵を付ける（label と同じ順） */
  wrongFigures?: (Figure | undefined)[];
  hints: [string, string, string];
  explain: string;
  explainFigure?: Figure;
  alt?: boolean;
  layout?: 'row' | 'grid' | 'column';
}

// ---- 画面（100u × 56.25u の舞台）に入る選び方を決める ----
// 問題文の下の作業領域は、問題文が1〜2行で 23〜26u。選択肢のボタンは 1つ 10u 以上で、ラベルは折り返さない。
// そこで、長い選択肢は「1：…」と問題文の下に書き、ボタンは「1・2・3」にする（問題文が短いとき）。
// それも入らないときは、選択肢を 2つ（正解と最初の誤り）にする。
const STAGE_H = 56.25;
const BAND = 14;
const hashOf = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};
const lenOf = (s: string) => plainText(s).length;
const promptLinesOf = (p: string) =>
  p.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(lenOf(l) / 30)), 0);
function figHeight(f: Figure | undefined): number {
  if (!f) return 0;
  if (f.kind === 'svg') {
    const m = /height:calc\(var\(--u\) \* ([\d.]+)\)/.exec(f.markup);
    return m ? Number(m[1]) : 14;
  }
  if (f.kind === 'illust') return 9;
  return 9;
}
type Opt = { label: string; figure?: Figure };
function buttonsHeight(opts: Opt[], layout: 'row' | 'column'): number {
  const cells = opts.map((o) => {
    const n = lenOf(o.label);
    const w = Math.min(92, Math.max(14, n * 3.2 + 4.8));
    return { w, h: Math.max(10, 4.2 + 2.4) + (o.figure ? figHeight(o.figure) : 0) };
  });
  if (layout === 'column') return cells.reduce((a, c) => a + c.h, 0) + 2.4 * (cells.length - 1);
  let rowW = 0;
  let rowH = 0;
  let total = 0;
  for (const c of cells) {
    if (rowW > 0 && rowW + 2.4 + c.w > 92) {
      total += rowH + 2.4;
      rowW = 0;
      rowH = 0;
    }
    rowW += (rowW > 0 ? 2.4 : 0) + c.w;
    rowH = Math.max(rowH, c.h);
  }
  return total + rowH;
}
/** 作業領域のあふれ（u）。0 以下なら入る */
function overflow(
  prompt: string,
  figure: Figure | undefined,
  opts: Opt[],
  layout: 'row' | 'column',
): number {
  const lines = promptLinesOf(prompt);
  const promptBottom = 8 + Math.max(7, lines * 4.8);
  const avail = STAGE_H - BAND - Math.max(15, promptBottom + 1);
  const fig = figHeight(figure);
  return fig + (fig > 0 ? 2 : 0) + buttonsHeight(opts, layout) - avail;
}

interface Fit {
  prompt: string;
  options: ChoiceItem['options'];
  layout: 'row' | 'column';
  fixedOrder?: boolean;
}
function fitOptions(s: ChoiceSpec): Fit {
  const all: { label: string; figure?: Figure; mis?: string; ok: boolean }[] = [
    { label: s.right, ...(s.rightFigure ? { figure: s.rightFigure } : {}), ok: true },
    ...s.wrongs.map(([label, m], i) => ({
      label,
      ...(s.wrongFigures?.[i] ? { figure: s.wrongFigures[i] } : {}),
      ...(m ? { mis: m } : {}),
      ok: false,
    })),
  ];
  const toOptions = (xs: typeof all): ChoiceItem['options'] =>
    xs.map((e) => ({
      label: e.label,
      ...(e.figure ? { figure: e.figure } : {}),
      ...(e.ok ? { correct: true } : e.mis ? { misconception: e.mis } : {}),
    }));
  const hasOptFig = all.some((e) => e.figure);
  const maxLen = Math.max(...all.map((e) => lenOf(e.label)));
  const candidates: { fit: Fit; over: number }[] = [];
  const push = (fit: Fit) =>
    candidates.push({
      fit,
      over: overflow(
        fit.prompt,
        s.figure,
        (fit.options as Opt[]).map((o) => ({
          label: o.label,
          ...(o.figure ? { figure: o.figure } : {}),
        })),
        fit.layout,
      ),
    });
  const plain = (xs: typeof all, layout: 'row' | 'column'): Fit => ({
    prompt: s.prompt,
    options: toOptions(xs),
    layout,
  });
  // 1. ぜんぶのボタン（ラベルが短いとき、または 絵つきのとき）
  if (hasOptFig || maxLen <= 7) push(plain(all, s.layout === 'column' ? 'column' : 'row'));
  // 2. 番号つきの一覧（問題文の下に「1：…」）。絵つきの選択肢には使えない
  const listed = (xs: typeof all): Fit => {
    const at = hashOf(s.id) % xs.length;
    const rest = xs.slice(1);
    const placed = [...rest.slice(0, at), xs[0]!, ...rest.slice(at)];
    return {
      prompt: `${s.prompt}\n${placed.map((e, i) => `${i + 1}：${e.label}`).join('\n')}`,
      options: toOptions(placed.map((e) => ({ ...e, label: String(placed.indexOf(e) + 1) }))),
      layout: 'row',
      fixedOrder: true,
    };
  };
  if (!hasOptFig && maxLen <= 28) {
    if (all.length >= 3) push(listed(all.slice(0, 3)));
    push(listed(all.slice(0, 2)));
  }
  // 3. 2つのボタン
  const two = all.slice(0, 2);
  push(plain(two, maxLen <= 12 ? 'row' : 'column'));
  const ok = candidates.find((c) => c.over <= 2.5);
  return (ok ?? candidates.sort((a, b) => a.over - b.over)[0]!).fit;
}

export function choiceItem(s: ChoiceSpec): ChoiceItem {
  const fit = fitOptions(s);
  return {
    engine: 'choice',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: fit.prompt,
    ...(s.figure ? { figure: s.figure } : {}),
    options: fit.options,
    layout: fit.layout,
    ...(fit.fixedOrder ? { fixedOrder: true } : {}),
    hints: s.hints,
    explain: s.explain,
    ...(s.explainFigure ? { explainFigure: s.explainFigure } : {}),
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
  /** [カードの文, 正しい箱の番号, 絵（省略可）] */
  cards: [label: string, box: number, figure?: Figure][];
  /** 入れがちな誤りの箱の誤概念 */
  mis: string;
  hints: [string, string, string];
  explain: string;
  alt?: boolean;
}

/**
 * 画面の作業領域（箱 13u ＋ カードの段 7u ずつ）に入るよう、カードは 少なく（2つの箱なら 2枚ずつ）・
 * 文字の少ないものを えらんで出す（書いた順は保つ）。
 */
function fitSortCards(s: SortSpec): SortSpec['cards'] {
  const per = Math.max(1, Math.floor(4 / s.boxes.length));
  const keep = new Set<number>();
  s.boxes.forEach((_, b) => {
    s.cards
      .map((c, i) => ({ i, c }))
      .filter((x) => x.c[1] === b)
      .sort((a, z) => lenOf(a.c[0]) - lenOf(z.c[0]) || a.i - z.i)
      .slice(0, per)
      .forEach((x) => keep.add(x.i));
  });
  return s.cards.filter((_, i) => keep.has(i));
}

export function sortItem(s: SortSpec): SortItem {
  return {
    engine: 'sort',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    boxes: s.boxes.map((label) => ({ label })),
    cards: fitSortCards(s).map(([label, box, figure]) => ({
      label,
      ...(figure ? { figure } : {}),
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
  /** 正しい順 */
  cards: [label: string, figure?: Figure][];
  alsoAccept?: number[][];
  ends?: [string, string];
  mis: string;
  hints: [string, string, string];
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
    cards: s.cards.map(([label, figure]) => ({ label, ...(figure ? { figure } : {}) })),
    ...(s.alsoAccept ? { alsoAccept: s.alsoAccept } : {}),
    ...(s.ends ? { ends: s.ends } : {}),
    ...(s.layout ? { layout: s.layout } : {}),
    reverseMisconception: s.mis,
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
  /** 描く盤（省略すると描かない） */
  canvas?: { aspect?: number; guide?: 'none' | 'cross' | 'lines'; colors?: boolean };
  /** 理由・ことばの選択肢（採点しない） */
  reasons?: string[];
  multi?: boolean;
  figure?: Figure;
  hints: [string, string, string];
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
    ...(s.reasons ? { reasons: s.reasons.slice(0, 3).map((label) => ({ label })) } : {}),
    ...(s.multi ? { multiReasons: true } : {}),
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
  /** [左の絵, 左の名前, 正しい右の文] */
  pairs: [figure: Figure, name: string, right: string][];
  /** 組にならない右のカード */
  extras?: string[];
  mis: string;
  hints: [string, string, string];
  explain: string;
}

export function matchItem(s: MatchSpec): MatchItem {
  const right = [
    ...s.pairs.map((p) => ({ label: p[2] })),
    ...(s.extras ?? []).map((label) => ({ label })),
  ];
  return {
    engine: 'match',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    left: s.pairs.map(([figure, name]) => ({ figure, name })),
    right,
    pairs: s.pairs.map((_, i) => [i, i] as [number, number]),
    wrongPairs:
      s.pairs.length >= 2
        ? [
            { pair: [0, 1], misconception: s.mis },
            { pair: [1, 0], misconception: s.mis },
          ]
        : [],
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
  };
}

export const illust = (id: string, count?: number): Figure => ({
  kind: 'illust',
  id,
  ...(count ? { count } : {}),
});

export function baseLife(
  id: string,
  stage: 'g1' | 'g2',
): Pick<
  UnitSpec,
  'id' | 'stage' | 'subject' | 'domain' | 'priority' | 'status' | 'icon' | 'review' | 'revised'
> {
  return {
    id,
    stage,
    subject: 'life',
    domain: 'life',
    priority: 'P1',
    status: 'ready',
    icon: 'subj-seikatsu',
    review: 'objective',
    revised: REVISED,
  };
}
