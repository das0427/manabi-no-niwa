/**
 * p4.en.move うごいて みよう（設計書 5.5。TPR: 全身反応教授法は示唆の段階）。
 * 英語の合図を聞いて動きの絵を選ぶ → 答えの後に「いっしょに やって みよう。」と合図をもう一度（親子で体を動かす）。
 * 体の動きは判定しない。同一性キー: cmd:<動き>・touch:<部分>（別例は lets:<動き>・letstouch:<部分>）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import {
  en,
  HINTS_MOVE,
  ill,
  intro,
  listen,
  opt,
  pickN,
  preUnit,
  twice,
  type EnSound,
} from './lib';
import { WORD_BY_ID } from './vocab';

interface Move {
  id: string;
  kind: 'whole' | 'touch';
  ja: string;
  illust: string;
  /** 合図（cmd / touch の台本） */
  cmd: EnSound;
  /** 別例（Let's 〜!） */
  lets: EnSound;
  explain: string;
  /** 似た動き（similar-move / body-near） */
  near?: string;
}

const WHOLE: Move[] = [
  {
    id: 'jump',
    ja: 'ジャンプ',
    desc: '『ジャンプ』は ぴょんと とぶ',
    cmd: 'Jump!',
    lets: "Let's jump!",
    near: 'stomp',
  },
  {
    id: 'clap',
    ja: 'はくしゅ',
    desc: '『はくしゅ』は てを たたく',
    cmd: 'Clap your hands!',
    lets: "Let's clap!",
    near: 'wave',
  },
  {
    id: 'stand',
    ja: 'たつ',
    desc: '『たつ』は すくっと たちあがる',
    cmd: 'Stand up!',
    lets: "Let's stand up!",
    near: 'sit',
  },
  {
    id: 'sit',
    ja: 'すわる',
    desc: '『すわる』は ぺたんと こしを おろす',
    cmd: 'Sit down!',
    lets: "Let's sit down!",
    near: 'stand',
  },
  {
    id: 'turn',
    ja: 'まわる',
    desc: '『まわる』は くるっと まわる',
    cmd: 'Turn around!',
    lets: "Let's turn around!",
  },
  {
    id: 'stomp',
    ja: 'あしぶみ',
    desc: '『あしぶみ』は あしで どんどん ふむ',
    cmd: 'Stomp your feet!',
    lets: "Let's stomp!",
    near: 'jump',
  },
  {
    id: 'wave',
    ja: 'てを ふる',
    desc: '『てを ふる』は てを ふって あいさつ する',
    cmd: 'Wave your hand!',
    lets: "Let's wave!",
    near: 'clap',
  },
  {
    id: 'handsup',
    ja: 'ばんざい',
    desc: '『ばんざい』は てを うえに あげる',
    cmd: 'Hands up!',
    lets: "Let's put our hands up!",
  },
].map((m): Move => ({
  id: m.id,
  kind: 'whole',
  ja: m.ja,
  illust: `enpre-act-${m.id}`,
  cmd: en('cmd', m.cmd),
  lets: en('lets', m.lets),
  explain: `${m.desc} ことだよ。いっしょに やって みよう！`,
  ...(m.near ? { near: m.near } : {}),
}));

const TOUCH_IDS = ['nose', 'head', 'ears', 'mouth', 'toes'];
const NEAR_TOUCH: Record<string, string> = {
  nose: 'mouth',
  mouth: 'nose',
  head: 'ears',
  ears: 'head',
};
const TOUCH: Move[] = TOUCH_IDS.map((id): Move => {
  const b = WORD_BY_ID[id]!;
  return {
    id,
    kind: 'touch',
    ja: b.ja,
    illust: b.illust,
    cmd: en('touch', `Touch your ${id}.`),
    lets: en('lets', `Let's touch our ${id}.`),
    explain: `『${b.ja}』を さわる ことだよ。いっしょに やって みよう！`,
    ...(NEAR_TOUCH[id] ? { near: NEAR_TOUCH[id] } : {}),
  };
});

const ALL = [...WHOLE, ...TOUCH];

const moveOpt = (m: Move, extra: { correct?: true; misconception?: string }): ChoiceOption =>
  opt({ label: m.ja, figure: ill(m.illust), sound: m.cmd }, extra);

const misOf = (m: Move, x: Move): string =>
  m.near === x.id ? (m.kind === 'touch' ? 'body-near' : 'similar-move') : 'other-move';

function moveItem(m: Move, level: number, n: number, pool: Move[], alt: boolean): Item {
  const base = `${m.kind === 'touch' ? 'touch' : 'cmd'}:${m.id}`;
  const identity = alt ? (m.kind === 'touch' ? `letstouch:${m.id}` : `lets:${m.id}`) : base;
  const id =
    alt || level === 0 || (m.kind === 'touch' && level === 1) ? identity : `${identity}:${level}`;
  const others = pool.filter((x) => x.id !== m.id);
  // 似た動き（あれば）を先に、あとは決まった順
  const first = m.near ? others.filter((x) => x.id === m.near) : [];
  const rest = pickN(
    `${id}:w`,
    others.filter((x) => !first.includes(x)),
    n - 1 - first.length,
  );
  const wrong = [...first, ...rest].slice(0, n - 1);
  const audio = alt ? [m.lets] : twice(m.cmd);
  return listen({
    id,
    objective: m.kind === 'touch' ? 'touch' : 'whole',
    level,
    prompt: 'えいごを きいてね。どの うごきかな？',
    audio,
    options: [
      moveOpt(m, { correct: true }),
      ...wrong.map((x) => moveOpt(x, { misconception: misOf(m, x) })),
    ],
    hints: HINTS_MOVE,
    explain: m.explain,
    identity,
    alt,
    // 答えのあと: 「いっしょに やって みよう。」＋合図を2回（子と大人が動く時間）
    revealAudio: [{ text: 'いっしょに やって みよう。' }, ...twice(m.cmd)],
  });
}

function items(): Item[] {
  const out: Item[] = [];
  // 段階0 からだ全体の動き（3択）・別例 Let's 〜!
  for (const m of WHOLE) out.push(moveItem(m, 0, 3, WHOLE, false));
  for (const m of WHOLE) out.push(moveItem(m, 0, 3, WHOLE, true));
  // 段階1 からだを さわる（3択）
  for (const m of TOUCH) out.push(moveItem(m, 1, 3, TOUCH, false));
  for (const m of TOUCH) out.push(moveItem(m, 1, 3, TOUCH, true));
  // 段階2 まぜて（4択）
  for (const m of ALL) out.push(moveItem(m, 2, 4, ALL, false));
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
