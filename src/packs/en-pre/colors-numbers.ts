/**
 * p4.en.colors-numbers いろと かず（設計書 5.4）。
 * いろ: ボールの絵＋代表の物の絵の選択肢（色の名前の文字は出さない。赤と緑は同じ問題に並べない）。
 * かず: 1〜5 の数を聞いて、物の数の絵を選ぶ。誤りは ±1 の数（near-number）。
 * 同一性キー: color:<色>・num:<数>-<物>（別例は itis:<色>・np:<数>-<物>）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import { en, HINTS, ill, intro, listen, mix, opt, preUnit, twice } from './lib';
import {
  COLORS,
  COUNT_JA,
  COUNTABLES,
  colorSound,
  nounSound,
  numberSound,
  redGreen,
  type ColorDef,
  type Countable,
} from './vocab';
import { PROMPT_WORD } from './wordq';

const MIS_OTHER_COLOR = {
  id: 'other-color',
  explain: 'ちがう いろだね。もういちど きいて みよう。',
};
const MIS_NEAR_NUMBER = {
  id: 'near-number',
  explain: 'ひとつ ちがいだね。いっしょに かぞえて みよう。',
};
/** ±2 以上の数（3択の 1・5、4択では ±1 だけでは足りない）。「ひとつ ちがい」と言わない */
const MIS_OTHER_NUMBER = {
  id: 'other-number',
  explain: 'かずが ちがうね。いっしょに かぞえて みよう。',
};
const MIS_SAME_START = {
  id: 'same-start',
  explain: 'はじめの おとが にて いたね。さいごまで きいて みよう。',
};

// ---- いろ ----
const colorOpt = (c: ColorDef, extra: { correct?: true; misconception?: string }): ChoiceOption =>
  opt(
    {
      label: c.ja,
      figure: { kind: 'row', items: [ill(c.ball), ill(c.thing)], gap: 1.2 },
      sound: colorSound(c),
    },
    extra,
  );

/** 誤りの色 n 個（赤と緑は同じ問題に並べない。ピンクとむらさきは はじめの音が同じ） */
function wrongColors(c: ColorDef, n: number, key: string): ColorDef[] {
  const out: ColorDef[] = [];
  const ok = (x: ColorDef) => x.id !== c.id && !redGreen(x, c) && !out.some((y) => redGreen(x, y));
  // はじめの音が同じ色（あれば）を先に
  const same = COLORS.filter((x) => ok(x) && c.start && x.start === c.start);
  if (same[0]) out.push(same[0]);
  for (const x of mix(`${key}:c`, COLORS)) {
    if (out.length >= n) break;
    if (ok(x) && !out.includes(x)) out.push(x);
  }
  return out;
}
const misColor = (c: ColorDef, x: ColorDef) =>
  c.start && x.start === c.start ? 'same-start' : 'other-color';

function colorItem(c: ColorDef, level: number, n: number, alt: boolean): Item {
  const identity = alt ? `itis:${c.id}` : `color:${c.id}`;
  const id = level === 0 ? identity : `${identity}:${level}`;
  const wrong = wrongColors(c, n - 1, id);
  return listen({
    id,
    objective: 'color',
    level,
    prompt: PROMPT_WORD,
    audio: alt ? [en('itis', `It's ${c.id}.`)] : twice(colorSound(c)),
    options: [
      colorOpt(c, { correct: true }),
      ...wrong.map((x) => colorOpt(x, { misconception: misColor(c, x) })),
    ],
    hints: HINTS,
    explain: `「${c.ja}」の ことだよ。`,
    identity,
    alt,
    revealAudio: [colorSound(c)],
  });
}

// ---- かず ----
const OBJECTS = COUNTABLES.slice(0, 5);
const numOpt = (
  k: number,
  o: Countable,
  extra: { correct?: true; misconception?: string },
  phrase: boolean,
): ChoiceOption => ({
  figure: ill(o.illust, k),
  sound: phrase ? nounSound(k, o) : numberSound(k),
  ...extra,
});

/** 誤りの数 n 個（近い数から） */
function wrongNumbers(num: number, n: number): number[] {
  const order = [num - 1, num + 1, num - 2, num + 2, num - 3, num + 3].filter(
    (k) => k >= 1 && k <= 5,
  );
  return order.slice(0, n);
}

function numberItem(num: number, o: Countable, level: number, n: number, alt: boolean): Item {
  const identity = alt ? `np:${num}-${o.id}` : `num:${num}-${o.id}`;
  const id = level === 1 ? identity : `${identity}:${level}`;
  return listen({
    id,
    objective: 'number',
    level,
    prompt: PROMPT_WORD,
    audio: alt ? [nounSound(num, o)] : twice(numberSound(num)),
    options: [
      numOpt(num, o, { correct: true }, alt),
      ...wrongNumbers(num, n - 1).map((k) =>
        numOpt(
          k,
          o,
          { misconception: Math.abs(k - num) === 1 ? 'near-number' : 'other-number' },
          alt,
        ),
      ),
    ],
    hints: HINTS,
    explain: `「${COUNT_JA[num]}」の ことだよ。`,
    identity,
    alt,
    revealAudio: [alt ? nounSound(num, o) : numberSound(num)],
  });
}

function items(): Item[] {
  const out: Item[] = [];
  // 段階0 いろ（3択）
  for (const c of COLORS) out.push(colorItem(c, 0, 3, false));
  for (const c of COLORS) out.push(colorItem(c, 0, 3, true));
  // 段階1 かず（3択）: 数 1〜5 × 物3つ
  for (let num = 1; num <= 5; num++)
    for (let k = 0; k < 3; k++) out.push(numberItem(num, OBJECTS[(num - 1 + k) % 5]!, 1, 3, false));
  for (let num = 1; num <= 5; num++) out.push(numberItem(num, OBJECTS[(num + 1) % 5]!, 1, 3, true));
  // 段階2 まぜて（4択）: 1問の中ではいろかかずの どちらか
  for (const c of COLORS) out.push(colorItem(c, 2, 4, false));
  for (let num = 1; num <= 5; num++)
    out.push(numberItem(num, OBJECTS[(num - 1) % 5]!, 2, 4, false));
  return out;
}

export const p4ColorsNumbers: UnitSpec = preUnit({
  id: 'p4.en.colors-numbers',
  title: 'いろと かず',
  stage: 'p4',
  icon: 'enpre-ball-blue',
  objectives: [
    { id: 'color', title: 'いろの えいごを きく' },
    { id: 'number', title: 'かずの えいごを きく' },
  ],
  misconceptions: [MIS_OTHER_COLOR, MIS_NEAR_NUMBER, MIS_OTHER_NUMBER, MIS_SAME_START],
  levels: [
    { label: 'いろ（3たく）', chance: 1 / 3 },
    { label: 'かず 1〜5（3たく）', chance: 1 / 3 },
    { label: 'まぜて（4たく）', chance: 0.25 },
  ],
  intro: intro(ill('enpre-ball-blue')),
  source: { kind: 'items', items: items() },
  parentNote:
    '色や数を英語で言う遊びです。おやつのときに『One, two, three!』といっしょに数えるなど、生活の中でも使ってみてください。',
});
