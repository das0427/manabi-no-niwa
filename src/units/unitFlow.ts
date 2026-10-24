/**
 * 単元の1回分の流れ（純粋な reducer）。画面（UnitRunner）は副作用（音・保存）だけを受け持つ。
 *
 *   intro → question ⇄（誤答・もう一度・ヒント）→ explain → question … → done
 *
 * 規則（ux-by-age 2.4〜2.5、curriculum-matrix 1.2）:
 * - 誤答: 誤概念の説明（無ければ汎用の声かけ）を出し、ヒントを1段進める。2回目の誤答で「つぎへ」も出す（v1 と同じ）。
 * - 「もう一度」（形の違い等）: 誤答に数えない（questionFlow.nudge）。3回目は誤答。
 * - ヒント: 幼児2段・小学生3段。押すたびに1段。最後の段を見たら「つぎへ」も出す。
 * - 正解・つぎへ の後は必ず解説を見せる（幼児は短く。soft のときは正誤を強調しない）。
 */
import {
  correct,
  hintButton,
  initialQuestion,
  nudge,
  skip,
  wrong,
  type QuestionState,
} from '../core/session/questionFlow';
import type { Outcome } from '../core/types';
import type { Item, RichText } from '../curriculum/types';
import type { Judgement } from '../engines/types';

export type Phase = 'intro' | 'question' | 'explain' | 'done';

export interface Message {
  kind: 'misconception' | 'generic-wrong' | 'retry';
  text: RichText;
}

export interface FlowState {
  items: Item[];
  index: number;
  phase: Phase;
  introStep: number;
  q: QuestionState;
  /** 見せたヒントの数（0〜hints.length） */
  hintsShown: number;
  message: Message | null;
  wrongMark: unknown;
  /** 確定した問題の結果（順に） */
  results: { item: Item; outcome: Outcome; misconception?: string; q: QuestionState }[];
  /** 今の問題で最後に出た誤概念 */
  lastMisconception?: string;
}

export type FlowAction =
  | { type: 'intro-next'; introLength: number }
  /** genericText: 誤概念の説明が無いときの声かけ（省略時 GENERIC_WRONG。2歳段階は「もういちど」） */
  | { type: 'judged'; j: Judgement; misconceptionText?: RichText; genericText?: RichText }
  | { type: 'hint' }
  | { type: 'skip' }
  | { type: 'next' };

export const GENERIC_WRONG: RichText = 'ちがったよ。もういちど かんがえて みよう。';

export function initialFlow(items: Item[], showIntro: boolean): FlowState {
  return {
    items,
    index: 0,
    phase: showIntro ? 'intro' : items.length ? 'question' : 'done',
    introStep: 0,
    q: initialQuestion(),
    hintsShown: 0,
    message: null,
    wrongMark: null,
    results: [],
  };
}

/** 中断データ（何問目まで終えたか・その結果）。問題は seed から作り直す */
export interface FlowDraft {
  done: { outcome: Outcome; misconception?: string; q: QuestionState }[];
}

export function draftOf(s: FlowState): FlowDraft {
  return {
    done: s.results.map((r) => ({ outcome: r.outcome, misconception: r.misconception, q: r.q })),
  };
}

/** 中断データから再開（終えた問題の次から。導入は出さない） */
export function restoreFlow(items: Item[], d: FlowDraft): FlowState {
  const n = Math.min(d.done.length, items.length);
  const base = initialFlow(items, false);
  return {
    ...base,
    index: n,
    phase: n >= items.length ? 'done' : 'question',
    results: d.done.slice(0, n).map((r, i) => ({ item: items[i]!, ...r })),
  };
}

export function currentItem(s: FlowState): Item | undefined {
  return s.items[s.index];
}

/** 「つぎへ」を出してよいか: 誤答2回、またはヒントを最後まで見た */
export function canSkip(s: FlowState): boolean {
  const it = currentItem(s);
  if (!it || s.phase !== 'question') return false;
  return s.q.canSkip || s.hintsShown >= it.hints.length;
}

function finishItem(s: FlowState, q: QuestionState): FlowState {
  const it = currentItem(s)!;
  return {
    ...s,
    q,
    phase: 'explain',
    message: null,
    results: [
      ...s.results,
      { item: it, outcome: q.outcome!, misconception: s.lastMisconception, q },
    ],
  };
}

export function flowReducer(s: FlowState, a: FlowAction): FlowState {
  switch (a.type) {
    case 'intro-next': {
      if (s.phase !== 'intro') return s;
      const step = s.introStep + 1;
      if (step < a.introLength) return { ...s, introStep: step };
      return { ...s, phase: s.items.length ? 'question' : 'done' };
    }
    case 'judged': {
      if (s.phase !== 'question') return s;
      const it = currentItem(s)!;
      const j = a.j;
      if (j.result === 'correct') return finishItem(s, correct(s.q));
      if (j.result === 'retry') {
        const r = nudge(s.q);
        if (!r.escalated) return { ...s, q: r.state, message: { kind: 'retry', text: j.message } };
        // もう一度が続いた: 誤答として扱う
        return {
          ...s,
          q: r.state,
          hintsShown: Math.min(it.hints.length, s.hintsShown + 1),
          message: { kind: 'generic-wrong', text: GENERIC_WRONG },
          wrongMark: null,
        };
      }
      const q = wrong(s.q);
      return {
        ...s,
        q,
        hintsShown: Math.min(it.hints.length, Math.max(s.hintsShown + 1, q.hintLevel)),
        message:
          j.misconception && a.misconceptionText
            ? { kind: 'misconception', text: a.misconceptionText }
            : { kind: 'generic-wrong', text: a.genericText ?? GENERIC_WRONG },
        wrongMark: j.mark ?? null,
        lastMisconception: j.misconception ?? s.lastMisconception,
      };
    }
    case 'hint': {
      if (s.phase !== 'question') return s;
      const it = currentItem(s)!;
      if (s.hintsShown >= it.hints.length) return s;
      return { ...s, q: hintButton(s.q), hintsShown: s.hintsShown + 1 };
    }
    case 'skip': {
      if (!canSkip(s)) return s;
      return finishItem(s, skip(s.q));
    }
    case 'next': {
      if (s.phase !== 'explain') return s;
      const index = s.index + 1;
      if (index >= s.items.length) return { ...s, phase: 'done' };
      return {
        ...s,
        index,
        phase: 'question',
        q: initialQuestion(),
        hintsShown: 0,
        message: null,
        wrongMark: null,
        lastMisconception: undefined,
      };
    }
  }
}
