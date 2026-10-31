/**
 * p4.en.move うごいて みよう（設計書 5.5。TPR: 全身反応教授法は示唆の段階）。
 * 英語の合図を聞いて動きの絵を選ぶ → 答えの後に「いっしょに やって みよう。」と合図をもう一度（親子で体を動かす）。
 * 体の動きは判定しない。同一性キー: cmd:<動き>・touch:<部分>（別例は lets:<動き>・letstouch:<部分>）。
 * 合図の表（WHOLE・TOUCH_MOVES）は vocab.ts。p23.en.move（move-p23.ts）も同じ表と音声を使う。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import { HINTS_MOVE, ill, intro, listen, mix, opt, preUnit, twice } from './lib';
import { isNearTouch, TOUCH_MOVES, WHOLE, type Move } from './vocab';

export const moveOpt = (m: Move, extra: { correct?: true; misconception?: string }): ChoiceOption =>
  opt({ label: m.ja, figure: ill(m.illust), sound: m.cmd }, extra);

/** 誤りの選択肢の誤概念（さわる部分: 近い部分の組は両向きで body-near） */
export const misOf = (m: Move, x: Move): string =>
  m.kind === 'touch'
    ? x.kind === 'touch' && isNearTouch(m.id, x.id)
      ? 'body-near'
      : 'other-move'
    : x.kind === 'whole' && m.near === x.id
      ? 'similar-move'
      : 'other-move';

/** 似た動き・近い部分（pool の中にあるもの） */
export const nearOf = (m: Move, pool: readonly Move[]): Move[] =>
  m.kind === 'touch'
    ? pool.filter((x) => x.kind === 'touch' && x.id !== m.id && isNearTouch(m.id, x.id))
    : pool.filter((x) => x.kind === 'whole' && x.id === m.near);

/**
 * 誤りの選択肢 n-1 個。似た動き・近い部分があれば1つを先に（近い部分が2つあるときは mix の順で1つ）、
 * あとは決まった順。withNear=false なら似た動き・近い部分を入れない（2歳段階の2択）
 */
export function pickWrongMoves(
  m: Move,
  pool: readonly Move[],
  n: number,
  key: string,
  withNear = true,
): Move[] {
  const others = pool.filter((x) => x.id !== m.id);
  const nears = nearOf(m, pool);
  const first = withNear && nears.length > 0 ? [mix(`${key}:n`, nears)[0]!] : [];
  const rest = mix(
    `${key}:w`,
    others.filter((x) => !first.includes(x) && (withNear || !nears.includes(x))),
  );
  return [...first, ...rest].slice(0, n - 1);
}

/** 答えのあと: 「いっしょに やって みよう。」＋合図を2回（子と大人が動く時間） */
export const moveReveal = (m: Move) => [{ text: 'いっしょに やって みよう。' }, ...twice(m.cmd)];

function moveItem(m: Move, level: number, n: number, pool: Move[], alt: boolean): Item {
  const base = m.kind === 'touch' ? 'touch' : 'cmd';
  const identity = alt
    ? m.kind === 'touch'
      ? `letstouch:${m.id}`
      : `lets:${m.id}`
    : `${base}:${m.id}`;
  const id =
    alt || level === 0 || (m.kind === 'touch' && level === 1) ? identity : `${identity}:${level}`;
  const wrong = pickWrongMoves(m, pool, n, id);
  return listen({
    id,
    objective: m.kind === 'touch' ? 'touch' : 'whole',
    level,
    prompt: 'えいごを きいてね。どの うごきかな？',
    audio: alt ? [m.lets] : twice(m.cmd),
    options: [
      moveOpt(m, { correct: true }),
      ...wrong.map((x) => moveOpt(x, { misconception: misOf(m, x) })),
    ],
    hints: HINTS_MOVE,
    explain: m.explain,
    identity,
    alt,
    revealAudio: moveReveal(m),
  });
}

function items(): Item[] {
  const all = [...WHOLE, ...TOUCH_MOVES];
  const out: Item[] = [];
  // 段階0 からだ全体の動き（3択）・別例 Let's 〜!
  for (const m of WHOLE) out.push(moveItem(m, 0, 3, WHOLE, false));
  for (const m of WHOLE) out.push(moveItem(m, 0, 3, WHOLE, true));
  // 段階1 からだを さわる 8（3択）・別例 Let's touch our 〜.
  for (const m of TOUCH_MOVES) out.push(moveItem(m, 1, 3, TOUCH_MOVES, false));
  for (const m of TOUCH_MOVES) out.push(moveItem(m, 1, 3, TOUCH_MOVES, true));
  // 段階2 まぜて（4択）
  for (const m of all) out.push(moveItem(m, 2, 4, all, false));
  return out;
}

export const p4Move: UnitSpec = preUnit({
  id: 'p4.en.move',
  title: 'うごいて みよう',
  stage: 'p4',
  icon: 'enpre-act-jump',
  objectives: [
    { id: 'whole', title: 'からだ ぜんたいの うごきの えいごを きく' },
    { id: 'touch', title: 'からだの ぶぶんを さわる えいごを きく' },
  ],
  misconceptions: [
    { id: 'other-move', explain: 'ちがう うごきだったね。もういちど きいて みよう。' },
    { id: 'similar-move', explain: 'にている うごきだね。もういちど きいて みよう。' },
    { id: 'body-near', explain: 'ちかくの ところだね。もういちど きいて みよう。' },
  ],
  levels: [
    { label: 'からだ ぜんたい（3たく）', chance: 1 / 3 },
    { label: 'からだを さわる（3たく）', chance: 1 / 3 },
    { label: 'まぜて（4たく）', chance: 0.25 },
  ],
  intro: intro(ill('enpre-act-jump')),
  source: { kind: 'items', items: items() },
  parentNote:
    '英語の合図に合わせて、いっしょに体を動かしてください。画面は答えを選ぶだけで、動きの判定はしません。',
});
