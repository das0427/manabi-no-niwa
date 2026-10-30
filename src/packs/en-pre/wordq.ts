/**
 * 「英語を聞いて絵を選ぶ」問題の組み立て（p23.en.words・p4.en.words・p5.en.phrases の1語の問題で共通）。
 * 誤りの選択肢は、同じなかま（なかまの手がかりが使える）か、ちがうなかま（使えない）から選び、すべて誤概念ID付き。
 */
import type { ListenItem, Misconception } from '../../curriculum/types';
import { HINTS, listen, mix, twice } from './lib';
import { itSound, sameJaHead, whereSound, wordOption, wordSound, type Word } from './vocab';

export type Form = 'hear' | 'it' | 'where';

/** 問題文（単元ごとに固定して、くり返しで覚える: 設計書 2.2） */
export const PROMPT_WORD = 'えいごを きいてね。どれかな？';

/** 赤（トマト）と緑（かえる）は同じ問題に並べない（DESINGN 3.1。設計書 11.1-8） */
const redGreenWord = (a: Word, b: Word): boolean =>
  (a.id === 'tomato' && b.id === 'frog') || (a.id === 'frog' && b.id === 'tomato');

/** からだの近い部分の組（body-near） */
const NEAR: Record<string, string> = { nose: 'mouth', mouth: 'nose', head: 'ears', ears: 'head' };

export const MIS_SAME_GROUP: Misconception = {
  id: 'same-group',
  explain: 'にている なかまの ことばだね。もういちど きいて みよう。',
};
export const MIS_SAME_START: Misconception = {
  id: 'same-start',
  explain: 'はじめの おとが にて いたね。さいごまで きいて みよう。',
};
export const MIS_OTHER_GROUP: Misconception = {
  id: 'other-group',
  explain: 'ちがう なかまの ことばだったね。もういちど きいて みよう。',
};
export const MIS_BODY_NEAR: Misconception = {
  id: 'body-near',
  explain: 'ちかくの ところだね。もういちど きいて みよう。',
};

export interface WordItemOpts {
  w: Word;
  level: number;
  form: Form;
  objective: string;
  /** 誤りの選択肢の候補 */
  pool: readonly Word[];
  /** 選択肢の数（正解を含む） */
  n: number;
  /** 誤りをちがうなかまから選ぶ（なかまの手がかりを使えなくする） */
  mixGroups?: boolean;
  /** はじめの音が同じ語を誤りに1つ入れる（あれば） */
  sameStart?: boolean;
  alt?: boolean;
}

/** 誤りの選択肢を選ぶ（決まった順。ちがうなかまは、なかまごとに1つずつ） */
function pickWrong(o: WordItemOpts, key: string): Word[] {
  const { w } = o;
  const cand = o.pool.filter((x) => x.id !== w.id && !sameJaHead(x, w) && !redGreenWord(x, w));
  const wrongPool = o.mixGroups
    ? cand.filter((x) => x.group !== w.group)
    : cand.filter((x) => x.group === w.group);
  const need = o.n - 1;
  const out: Word[] = [];
  // 近い部分（からだ）・はじめの音が同じ語を先に1つ
  const near = !o.mixGroups ? wrongPool.find((x) => x.id === NEAR[w.id]) : undefined;
  if (near) out.push(near);
  else if (o.sameStart && w.start) {
    const ss = mix(
      `${key}:ss`,
      wrongPool.filter((x) => x.start === w.start),
    )[0];
    if (ss) out.push(ss);
  }
  const rest = mix(
    `${key}:rest`,
    wrongPool.filter((x) => !out.includes(x)),
  );
  if (o.mixGroups) {
    // なかまごとに1つずつ（まだ使っていないなかまを先に）
    const seen = new Set(out.map((x) => x.group));
    for (const x of rest) {
      if (out.length >= need) break;
      if (!seen.has(x.group)) {
        out.push(x);
        seen.add(x.group);
      }
    }
  }
  for (const x of rest) {
    if (out.length >= need) break;
    if (!out.includes(x)) out.push(x);
  }
  return out.slice(0, need);
}

const misOf = (w: Word, x: Word, mixGroups: boolean): string => {
  if (NEAR[w.id] === x.id) return 'body-near';
  if (w.start && x.start === w.start) return 'same-start';
  return mixGroups ? 'other-group' : 'same-group';
};

export function wordItem(o: WordItemOpts): ListenItem {
  const { w, form } = o;
  const identity = `${form}:${w.id}`;
  const id = o.level === 0 ? identity : `${identity}:${o.level}`;
  const wrong = pickWrong(o, id);
  const audio =
    form === 'hear' ? twice(wordSound(w)) : form === 'it' ? [itSound(w)] : [whereSound(w)];
  return listen({
    id,
    objective: o.objective,
    level: o.level,
    prompt: PROMPT_WORD,
    audio,
    options: [
      wordOption(w, { correct: true }),
      ...wrong.map((x) => wordOption(x, { misconception: misOf(w, x, !!o.mixGroups) })),
    ],
    hints: HINTS,
    explain: `「${w.ja}」の ことだよ。`,
    identity,
    alt: o.alt,
    revealAudio: [wordSound(w)],
  });
}
