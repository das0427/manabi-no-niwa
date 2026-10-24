/**
 * p4.think.pattern きまり（curriculum-matrix 3.2・4.2）: くりかえしの つづきを えらぶ。
 * 段階0: AB の くりかえしの つぎ。段階1: AAB・ABB・AABB。段階2: ABC と、まんなかの ぬけ。
 * 別例: 音の きまり（「ぱん・ぽん・ぱん・ぽん・？」を 聞いて選ぶ）。
 * 形と色の両方が変わる（色だけで区別しない）。法則の発見（言葉での説明）は求めない。
 * 同一性キー（1.4。形の絵柄は同じとみなす）: きまりの型 × 並びの長さ × ぬけの位置。音は sound:型:長さ。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import type { ListenItem } from '../../engines/listen/listen';
import { mix } from './lib';

type Sh = 'circle' | 'triangle' | 'square' | 'star' | 'heart';
const SHAPES: Sh[] = ['circle', 'triangle', 'square', 'star', 'heart'];
const NAME: Record<Sh, string> = {
  circle: 'まる',
  triangle: 'さんかく',
  square: 'しかく',
  star: 'ほし',
  heart: 'ハート',
};
const FILL: Record<Sh, string> = {
  circle: 'var(--sky)',
  triangle: 'var(--leaf)',
  square: 'var(--wood)',
  star: 'var(--sun)',
  heart: 'var(--berry)',
};
const ST = 'stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round"';

function shapeSvg(s: Sh, x: number): string {
  const f = `fill="${FILL[s]}" ${ST}`;
  switch (s) {
    case 'circle':
      return `<circle cx="${x + 25}" cy="25" r="19" ${f}/>`;
    case 'triangle':
      return `<polygon points="${x + 25},5 ${x + 45},44 ${x + 5},44" ${f}/>`;
    case 'square':
      return `<rect x="${x + 7}" y="7" width="36" height="36" ${f}/>`;
    case 'star': {
      const p = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 ? 9 : 21;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        return `${(x + 25 + r * Math.cos(a)).toFixed(1)},${(26 + r * Math.sin(a)).toFixed(1)}`;
      }).join(' ');
      return `<polygon points="${p}" ${f}/>`;
    }
    case 'heart':
      return `<path d="M${x + 25} 44 C${x + 8} 32 ${x + 3} 22 ${x + 8} 13 C${x + 13} 5 ${x + 22} 7 ${x + 25} 14 C${x + 28} 7 ${x + 37} 5 ${x + 42} 13 C${x + 47} 22 ${x + 42} 32 ${x + 25} 44 Z" ${f}/>`;
  }
}
const blankSvg = (x: number) =>
  `<rect x="${x + 5}" y="5" width="40" height="40" rx="8" fill="var(--paper)" stroke="var(--ink)" stroke-width="3" stroke-dasharray="6 5"/><text x="${x + 25}" y="34" font-size="26" text-anchor="middle" fill="var(--ink)">？</text>`;

function seqFig(seq: (Sh | null)[]): Figure {
  return {
    kind: 'svg',
    label: seq.map((s) => (s ? NAME[s] : 'なに？')).join('、'),
    markup: `<svg viewBox="0 0 ${seq.length * 50} 50" xmlns="http://www.w3.org/2000/svg">${seq
      .map((s, i) => (s ? shapeSvg(s, i * 50) : blankSvg(i * 50)))
      .join('')}</svg>`,
  };
}
const oneFig = (s: Sh): Figure => ({
  kind: 'svg',
  label: NAME[s],
  markup: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">${shapeSvg(s, 0)}</svg>`,
});

const TYPES = { AB: 'AB', AAB: 'AAB', ABB: 'ABB', AABB: 'AABB', ABC: 'ABC' } as const;
type Type = keyof typeof TYPES;
const OBJ: Record<Type, string> = { AB: 'ab', AAB: 'aab', ABB: 'aab', AABB: 'aab', ABC: 'abc' };

interface Task {
  type: Type;
  len: number;
  blank: number;
  sound?: boolean;
}
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const unitLen = (t: Type) => t.length;
const ends = (types: Type[]): Task[] =>
  types.flatMap((type) =>
    range(Math.max(4, unitLen(type) + 2), 8).map((len) => ({ type, len, blank: len - 1 })),
  );
const middles = (types: Type[]): Task[] =>
  types.flatMap((type) =>
    range(Math.max(5, unitLen(type) + 3), 8).flatMap((len) =>
      range(unitLen(type), len - 2).map((blank) => ({ type, len, blank })),
    ),
  );
const sounds = (types: Type[]): Task[] =>
  types.flatMap((type) =>
    [unitLen(type) * 2 + 1, unitLen(type) * 2 + 2, unitLen(type) * 3 + 1].map((len) => ({
      type,
      len,
      blank: len - 1,
      sound: true,
    })),
  );

const LEVEL_TASKS: Task[][] = [
  [...ends(['AB']), ...sounds(['AB'])],
  [...ends(['AAB', 'ABB', 'AABB']), ...sounds(['AAB', 'ABB'])],
  [...ends(['ABC']), ...middles(['AB', 'ABC', 'AAB', 'ABB']), ...sounds(['ABC'])],
];

const SOUND = ['ぱん', 'ぽん', 'ぴん'];

function make(task: Task, level: number, rng: Rng): Item {
  const pat = TYPES[task.type];
  const els = rng.sample(SHAPES, 4) as Sh[];
  const at = (i: number) => els['ABC'.indexOf(pat[i % pat.length]!)]!;
  const seq = range(0, task.len - 1).map(at);
  const answer = seq[task.blank]!;
  const before = seq[task.blank - 1]!;
  const inPat = [...new Set(seq)];
  const key = `${task.sound ? 'sound:' : ''}${task.type}:${task.len}:${task.blank}`;
  const hints = [
    'はじめから ゆびで さしながら いって みよう。',
    `「${range(0, pat.length - 1)
      .map((i) => (task.sound ? SOUND['ABC'.indexOf(pat[i]!)] : NAME[at(i)]))
      .join('・')}」が くりかえして いるよ。`,
  ];
  if (task.sound) {
    const sym = (i: number) => SOUND['ABC'.indexOf(pat[i % pat.length]!)]!;
    const ans = sym(task.blank);
    const prev = sym(task.blank - 1);
    const opts: ChoiceOption[] = [{ label: ans, correct: true }];
    for (const s of SOUND.slice(0, Math.max(2, new Set(pat).size)))
      if (s !== ans)
        opts.push({ label: s, misconception: s === prev ? 'repeat-prev' : 'pattern-skip' });
    if (opts.length < 3) opts.push({ label: 'ぷん', misconception: 'not-in-pattern' });
    const item: ListenItem = {
      engine: 'listen',
      id: key,
      objective: OBJ[task.type],
      level,
      alt: true,
      prompt: 'おとの きまり。つぎの おとは どれ？',
      audio: range(0, task.len - 2).map((i) => ({ text: sym(i) })),
      gapMs: 450,
      hints,
      explain: `${range(0, task.len - 1)
        .map(sym)
        .join('・')}。つぎは「${ans}」だね。`,
      identity: key,
      options: mix(key, opts),
    };
    return item;
  }
  const opts: ChoiceOption[] = [{ label: NAME[answer], figure: oneFig(answer), correct: true }];
  for (const s of inPat)
    if (s !== answer)
      opts.push({
        label: NAME[s],
        figure: oneFig(s),
        misconception: s === before ? 'repeat-prev' : 'pattern-skip',
      });
  const extra = els.find((s) => !inPat.includes(s))!;
  if (opts.length < 3)
    opts.push({ label: NAME[extra], figure: oneFig(extra), misconception: 'not-in-pattern' });
  const shown = seq.map((s, i) => (i === task.blank ? null : s));
  return {
    engine: 'choice',
    id: `${key}:${els.join('-')}`,
    objective: OBJ[task.type],
    level,
    prompt:
      task.blank === task.len - 1
        ? 'きまりを みつけよう。つぎに くるのは どれ？'
        : 'きまりを みつけよう。？に はいるのは どれ？',
    figure: seqFig(task.blank === task.len - 1 ? shown.slice(0, task.len) : shown),
    hints,
    explain: `${range(0, pat.length - 1)
      .map((i) => NAME[at(i)])
      .join('・')}の くりかえし。？は ${NAME[answer]}。`,
    identity: key,
    options: mix(`${key}:${els.join('-')}`, opts.slice(0, 3)),
  };
}

export function generatePattern(level: number, rng: Rng): Item {
  const tasks = LEVEL_TASKS[Math.min(level, LEVEL_TASKS.length - 1)]!;
  return make(tasks[rng.int(0, tasks.length - 1)]!, level, rng);
}

export const DOMAIN = new Set(
  LEVEL_TASKS.flat().map((t) => `${t.sound ? 's' : ''}${t.type}:${t.len}:${t.blank}`),
).size;

export const patternUnit: UnitSpec = {
  id: 'p4.think.pattern',
  title: 'きまり',
  stage: 'p4',
  subject: 'think',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-sorting',
  prereq: ['p4.think.sort'],
  objectives: [
    { id: 'ab', title: 'ふたつの くりかえし（AB）' },
    { id: 'aab', title: 'かずの ちがう くりかえし（AAB・ABB・AABB）' },
    { id: 'abc', title: 'みっつの くりかえし（ABC）' },
  ],
  misconceptions: [
    {
      id: 'repeat-prev',
      explain:
        'すぐ まえと おなじに したのかな。はじめから ゆびで さして、くりかえしを たしかめよう。',
    },
    {
      id: 'pattern-skip',
      explain: 'くりかえしの じゅんばんが ずれたかな。はじめから いって みよう。',
    },
    { id: 'not-in-pattern', explain: 'ならびに ない ものだね。ならびの なかから えらぼう。' },
  ],
  levels: [
    { label: 'AB の くりかえし', chance: 1 / 3 },
    { label: 'AAB・ABB・AABB', chance: 1 / 3 },
    { label: 'ABC・まんなかの ぬけ', chance: 1 / 3 },
  ],
  intro: [
    {
      text: 'まる、さんかく、まる、さんかく。おなじ じゅんばんが くりかえして いるね。',
      figure: seqFig(['circle', 'triangle', 'circle', 'triangle']),
    },
    {
      text: 'だから つぎは まる。',
      figure: seqFig(['circle', 'triangle', 'circle', 'triangle', 'circle']),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng }) => generatePattern(level, rng),
    domainSize: DOMAIN,
  },
  review: 'view',
  basis: '幼稚園教育要領 環境（法則性に気付く。法則の発見は求めない）、curriculum-matrix 3.2・4.2',
  revised: '2026-10-24',
};
