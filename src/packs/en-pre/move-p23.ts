/**
 * p23.en.move うごいて みよう（設計書 5.2。P2・3歳段階）。
 * p4.en.move と同じ合図の音声・同じ絵を使う（p23 だけの新しい英語の音声・絵は無い）。
 * 2歳段階は常に段階0（2択。似た動きを並べない）。段階1は3択で、からだを さわる（6部分）を足す。
 * 同一性キー: cmd:<動き>・lets:<動き>・touch:<部分>・letstouch:<部分>（段階1の合図は id に :1 を付ける）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { HINTS_MOVE, ill, intro, listen, preUnit, twice } from './lib';
import { misOf, moveOpt, moveReveal, pickWrongMoves } from './move';
import { P23_TOUCH_IDS, TOUCH_MOVES, WHOLE, type Move } from './vocab';

const P23_TOUCH: Move[] = P23_TOUCH_IDS.map((id) => TOUCH_MOVES.find((m) => m.id === id)!);

function item(m: Move, level: number, pool: Move[], alt: boolean): Item {
  const base = m.kind === 'touch' ? 'touch' : 'cmd';
  const identity = alt
    ? m.kind === 'touch'
      ? `letstouch:${m.id}`
      : `lets:${m.id}`
    : `${base}:${m.id}`;
  // 段階1の動きの合図は段階0と同じ同一性キー（id だけ :1 を付ける）。さわる部分は段階1だけ
  const id = !alt && level === 1 && m.kind === 'whole' ? `${identity}:1` : identity;
  const n = level === 0 ? 2 : 3;
  const wrong = pickWrongMoves(m, pool, n, id, level === 1);
  return listen({
    id,
    objective: m.kind === 'touch' ? 'touch' : 'move',
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
  const out: Item[] = [];
  // 段階0（2択）: 動き 8・別例 8。誤りは似ていない動き
  for (const m of WHOLE) out.push(item(m, 0, WHOLE, false));
  for (const m of WHOLE) out.push(item(m, 0, WHOLE, true));
  // 段階1（3択）: 動き 8（似た動きを1つ入れる）、からだを さわる 6・別例 6（誤りは さわる 6 から）
  for (const m of WHOLE) out.push(item(m, 1, WHOLE, false));
  for (const m of P23_TOUCH) out.push(item(m, 1, P23_TOUCH, false));
  for (const m of P23_TOUCH) out.push(item(m, 1, P23_TOUCH, true));
  return out;
}

export const p23Move: UnitSpec = preUnit({
  id: 'p23.en.move',
  title: 'うごいて みよう',
  stage: 'p23',
  icon: 'enpre-act-jump',
  priority: 'P2',
  prereq: ['p23.en.words'],
  objectives: [
    { id: 'move', title: 'うごきの えいごを きく' },
    { id: 'touch', title: 'からだを さわる えいごを きく' },
  ],
  misconceptions: [
    { id: 'other-move', explain: 'ちがう うごきだったね。もういちど きいて みよう。' },
    { id: 'similar-move', explain: 'にている うごきだね。もういちど きいて みよう。' },
    { id: 'body-near', explain: 'ちかくの ところだね。もういちど きいて みよう。' },
  ],
  levels: [
    { label: 'うごき（2たく）', chance: 0.5 },
    { label: 'うごき・からだ（3たく）', chance: 1 / 3 },
  ],
  intro: intro(
    ill('enpre-act-jump'),
    'えいごの あいずを きいて、うごきの えを えらぶ あそびだよ。',
  ),
  source: { kind: 'items', items: items() },
  parentNote:
    '英語の合図を聞いて、いっしょに体を動かしてみてください。大人がまねして見せると、子どもも動きやすくなります。',
});
