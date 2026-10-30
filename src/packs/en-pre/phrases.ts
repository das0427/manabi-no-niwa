/**
 * p5.en.phrases かずと いろと もの（設計書 5.9）: 2〜3語の句を聞いて、数・物・色が合う絵を選ぶ。
 * 段階0: 1語（4択・ちがうなかま）。段階1: 「Three apples.」（数 1〜10 × 物6）。段階2: 「Two blue balls.」（数 1〜5 × 8色）。
 * 単数は a ではなく one で数を明示する。複数の s を正しく。誤りは 数ちがい（±1）・物ちがい・両方ちがい。
 * 同一性キー: hear:<語>・np:<数>-<物>・cp:<数>-<色>（別例は see:・seec:）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import { en, HINTS, ill, intro, listen, mix, preUnit } from './lib';
import {
  ALL_WORDS,
  COLORS,
  COUNT_JA,
  COUNTABLES,
  colorPhrase,
  colorPhraseSound,
  nounPhrase,
  nounSound,
  redGreen,
  type ColorDef,
  type Countable,
} from './vocab';
import { MIS_OTHER_GROUP, MIS_SAME_START, PROMPT_WORD, wordItem } from './wordq';

const MIS_NEAR_NUMBER = {
  id: 'near-number',
  explain: 'ひとつ ちがいだね。いっしょに かぞえて みよう。',
};
const MIS_OTHER_NOUN = {
  id: 'other-noun',
  explain: 'かずは あって いたね。ものの なまえを きいて みよう。',
};
const MIS_OTHER_COLOR = {
  id: 'other-color',
  explain: 'かずは あって いたね。いろを きいて みよう。',
};
const MIS_BOTH = { id: 'both', explain: 'もういちど さいごまで きいて みよう。' };

const lowerFirst = (s: string) => s[0]!.toLowerCase() + s.slice(1);

/** 数ちがい（±1。範囲の外は逆向き） */
const nearNumber = (n: number, max: number, key: string): number => {
  const up = n + 1 <= max;
  const down = n - 1 >= 1;
  if (up && down) return mix(key, [n + 1, n - 1])[0]!;
  return up ? n + 1 : n - 1;
};
/** 両方ちがいの数（n と near 以外） */
const farNumber = (n: number, near: number, max: number, key: string): number => {
  const c = Array.from({ length: max }, (_, i) => i + 1).filter(
    (k) => k !== n && k !== near && Math.abs(k - n) >= 2,
  );
  return mix(key, c)[0]!;
};

// ---- 段階1: かず＋もの ----
const nounOpt = (
  k: number,
  c: Countable,
  extra: { correct?: true; misconception?: string },
): ChoiceOption => ({ figure: ill(c.illust, k), sound: nounSound(k, c), ...extra });

function nounItem(n: number, c: Countable, alt: boolean): Item {
  const identity = alt ? `see:${n}-${c.id}` : `np:${n}-${c.id}`;
  const near = nearNumber(n, 10, `${identity}:n`);
  const others = COUNTABLES.filter((x) => x.id !== c.id);
  const c2 = mix(`${identity}:c2`, others)[0]!;
  const c3 = mix(
    `${identity}:c3`,
    others.filter((x) => x !== c2),
  )[0]!;
  const far = farNumber(n, near, 10, `${identity}:f`);
  const phrase = nounPhrase(n, c);
  return listen({
    id: identity,
    objective: 'number-noun',
    level: 1,
    prompt: PROMPT_WORD,
    audio: [alt ? en('np', `I see ${lowerFirst(phrase)}`) : nounSound(n, c)],
    options: [
      nounOpt(n, c, { correct: true }),
      nounOpt(near, c, { misconception: 'near-number' }),
      nounOpt(n, c2, { misconception: 'other-noun' }),
      nounOpt(far, c3, { misconception: 'both' }),
    ],
    hints: HINTS,
    explain: `「${c.ja} ${COUNT_JA[n]}」の ことだよ。`,
    identity,
    alt,
    revealAudio: [nounSound(n, c)],
  });
}

// ---- 段階2: かず＋いろ＋ボール ----
const colorOpt = (
  k: number,
  c: ColorDef,
  extra: { correct?: true; misconception?: string },
): ChoiceOption => ({ figure: ill(c.ball, k), sound: colorPhraseSound(k, c), ...extra });

function colorItem(n: number, c: ColorDef, alt: boolean): Item {
  const identity = alt ? `seec:${n}-${c.id}` : `cp:${n}-${c.id}`;
  const near = nearNumber(n, 5, `${identity}:n`);
  // 赤と緑は同じ問題に並べない
  const colors = COLORS.filter((x) => x.id !== c.id && !redGreen(x, c));
  const c2 = mix(`${identity}:c2`, colors)[0]!;
  const c3 = mix(
    `${identity}:c3`,
    colors.filter((x) => x !== c2 && !redGreen(x, c2)),
  )[0]!;
  const far = farNumber(n, near, 5, `${identity}:f`);
  return listen({
    id: identity,
    objective: 'color-number',
    level: 2,
    prompt: PROMPT_WORD,
    audio: [alt ? en('np', `I see ${lowerFirst(colorPhrase(n, c))}`) : colorPhraseSound(n, c)],
    options: [
      colorOpt(n, c, { correct: true }),
      colorOpt(near, c, { misconception: 'near-number' }),
      colorOpt(n, c2, { misconception: 'other-color' }),
      colorOpt(far, c3, { misconception: 'both' }),
    ],
    hints: HINTS,
    explain: `「${c.jaBall} ${COUNT_JA[n]}」の ことだよ。`,
    identity,
    alt,
    revealAudio: [colorPhraseSound(n, c)],
  });
}

function items(): Item[] {
  const out: Item[] = [];
  // 段階0: 1語を2回・4択（ちがうなかま）。別例は It's a 〜. の形（なかまの中で1つおき）
  for (const w of ALL_WORDS)
    out.push(
      wordItem({
        w,
        level: 0,
        form: 'hear',
        objective: 'word',
        pool: ALL_WORDS,
        n: 4,
        mixGroups: true,
      }),
    );
  ALL_WORDS.filter((_, i) => i % 7 === 0).forEach((w) =>
    out.push(
      wordItem({
        w,
        level: 0,
        form: 'it',
        objective: 'word',
        pool: ALL_WORDS,
        n: 4,
        mixGroups: true,
        alt: true,
      }),
    ),
  );
  // 段階1: 数 1〜10 × 物6 = 60。別例（I see 〜.）は物ごとに1つ
  for (const c of COUNTABLES) for (let n = 1; n <= 10; n++) out.push(nounItem(n, c, false));
  COUNTABLES.forEach((c, i) => out.push(nounItem(((i * 3) % 10) + 1, c, true)));
  // 段階2: 数 1〜5 × 8色 = 40。別例は色ごとに1つ
  for (const c of COLORS) for (let n = 1; n <= 5; n++) out.push(colorItem(n, c, false));
  COLORS.forEach((c, i) => out.push(colorItem((i % 5) + 1, c, true)));
  return out;
}

export const p5Phrases: UnitSpec = preUnit({
  id: 'p5.en.phrases',
  title: 'かずと いろと もの',
  stage: 'p5',
  icon: 'apple',
  objectives: [
    { id: 'word', title: 'ことばを ひとつ きく' },
    { id: 'number-noun', title: 'かずと ものを きく' },
    { id: 'color-number', title: 'かずと いろと ボールを きく' },
  ],
  misconceptions: [
    MIS_OTHER_GROUP,
    MIS_SAME_START,
    MIS_NEAR_NUMBER,
    MIS_OTHER_NOUN,
    MIS_OTHER_COLOR,
    MIS_BOTH,
  ],
  levels: [
    { label: 'ことば ひとつ（4たく）', chance: 0.25 },
    { label: 'かずと もの（4たく）', chance: 0.25 },
    { label: 'かずと いろ（4たく）', chance: 0.25 },
  ],
  intro: intro(ill('apple')),
  source: { kind: 'items', items: items() },
  parentNote: '『Three apples（りんご3こ）』のように、数と物を組み合わせた言い方を聞く遊びです。',
});
