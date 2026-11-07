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

/**
 * 途中の問題の状態（見たヒント・誤答の数など）。再開で「自力」に戻らないように持つ
 * （v1 の useQuestion.restore と同じ考え。FX08）
 */
export interface DraftCurrent {
  /** 何問目か（終えた問題の数と同じときだけ使う） */
  index: number;
  q: QuestionState;
  /** 見せたヒントの数 */
  hintsShown: number;
  /** 今の問題で最後に出た誤概念 */
  lastMisconception?: string;
}

/** 中断データ（何問目まで終えたか・その結果）。問題は seed から作り直す */
export interface FlowDraft {
  done: { outcome: Outcome; misconception?: string; q: QuestionState }[];
  /** 途中の問題の状態。何も起きていない問題と、2.0 までの中断データには無い */
  current?: DraftCurrent;
}

/** 今の問題でヒント・誤答などが1つでも起きたか（何も無ければ中断データに入れない） */
function touched(q: QuestionState, hintsShown: number): boolean {
  return (
    hintsShown > 0 ||
    q.hintLevel > 0 ||
    q.hintsUsed > 0 ||
    q.wrongTries > 0 ||
    q.reviewsUsed > 0 ||
    (q.nudges ?? 0) > 0 ||
    q.operationIssue
  );
}

export function draftOf(s: FlowState): FlowDraft {
  const d: FlowDraft = {
    done: s.results.map((r) => ({ outcome: r.outcome, misconception: r.misconception, q: r.q })),
  };
  // 問題の途中（解説に入る前）だけ、今の問題の状態を持つ。解説の間は、その問題はもう結果に入っている
  if (s.phase === 'question' && s.index === s.results.length && touched(s.q, s.hintsShown)) {
    d.current = {
      index: s.index,
      q: { ...s.q, tapTimes: [] },
      hintsShown: s.hintsShown,
      ...(s.lastMisconception ? { lastMisconception: s.lastMisconception } : {}),
    };
  }
  return d;
}

const count = (v: unknown): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 99 ? v : 0;

/** 中断データの途中の問題の状態を、いまの問題に合わせて読み直す（壊れた値・合わない問題は使わない） */
function currentOf(
  c: unknown,
  index: number,
  item: Item,
): Pick<FlowState, 'q' | 'hintsShown' | 'lastMisconception'> | null {
  if (typeof c !== 'object' || c === null) return null;
  const cur = c as Partial<DraftCurrent>;
  if (cur.index !== index || typeof cur.q !== 'object' || cur.q === null) return null;
  const q = cur.q as Partial<QuestionState>;
  const nudges = count(q.nudges);
  return {
    // 確定（done・outcome）と連打の時刻は引き継がない。回数は引き継ぐ
    q: {
      ...initialQuestion(),
      wrongTries: count(q.wrongTries),
      hintLevel: q.hintLevel === 1 || q.hintLevel === 2 ? q.hintLevel : 0,
      hintsUsed: count(q.hintsUsed),
      reviewsUsed: count(q.reviewsUsed),
      operationIssue: q.operationIssue === true,
      canSkip: q.canSkip === true,
      ...(nudges > 0 ? { nudges } : {}),
    },
    hintsShown: Math.min(item.hints.length, count(cur.hintsShown)),
    ...(typeof cur.lastMisconception === 'string'
      ? { lastMisconception: cur.lastMisconception }
      : {}),
  };
}

/** 中断データから再開（終えた問題の次から。導入は出さない。途中の問題のヒント・誤答の数も戻す） */
export function restoreFlow(items: Item[], d: FlowDraft): FlowState {
  const n = Math.min(d.done.length, items.length);
  const base = initialFlow(items, false);
  const item = items[n];
  return {
    ...base,
    index: n,
    phase: n >= items.length ? 'done' : 'question',
    results: d.done.slice(0, n).map((r, i) => ({ item: items[i]!, ...r })),
    ...(item ? currentOf(d.current, n, item) : null),
  };
}

export function currentItem(s: FlowState): Item | undefined {
  return s.items[s.index];
}

/**
 * 解説の板が出てから「つぎへ」を受け付けない時間（ms）。ヒントを出しきったあとの「つぎへ」（＝こたえを みる）と
 * 解説の「つぎへ」は同じ位置の同じ札なので、すばやい2回押しだと解説を見ずに次の問題へ行ってしまう（FX01。
 * ux-by-age 3章「連打で二重遷移しない」）。見た目は変えず、この間は押しても何も起きない
 */
export const NEXT_LOCK_MS = 700;

/** 解説の板が出た時刻 explainAt（ms）から NEXT_LOCK_MS のあいだは true（時計が戻ったときは受け付ける） */
export function nextLocked(explainAt: number, now: number): boolean {
  const dt = now - explainAt;
  return dt >= 0 && dt < NEXT_LOCK_MS;
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

/**
 * 不正解の効果音を鳴らすか。2歳段階（softJudgement）と、穏やかな判定の単元（gentleJudgement。幼児の英語）では鳴らさない。
 * ○／？の印・誤概念の説明・記録は変えない。
 */
export const playsWrongSfx = (softJudgement: boolean, gentleJudgement?: boolean): boolean =>
  !softJudgement && gentleJudgement !== true;
