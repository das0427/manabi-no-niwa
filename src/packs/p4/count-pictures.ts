/**
 * p4.math.count-pictures かずと え（curriculum-matrix 3.2・4.1）: 1〜5を数える、合わせる・へるを絵で（式なし）。
 * v1 の math A（絵を合わせる）に、新しく「絵で へる」を足した単元。新しい単元なので進度は新しく始める（統括の判断6）。
 * 同一性キー（1.4。絵柄は同じとみなす）:
 *   数える = count:n（ほかの物が まざる絵は count-mix:n:m）、合わせる = join:a+b（順あり）、へる = leave:t-k。
 *   別例（ブロックの図）は -blocks を付けた別のキー。
 * 定義域: 数える 5＋まざる 10＋ブロック 5、合わせる 10＋10、へる 10＋10 ＝ 60。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceItem, ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { ill, mix } from './lib';

const FRUITS: { id: string; name: string }[] = [
  { id: 'apple', name: 'りんご' },
  { id: 'mikan', name: 'みかん' },
  { id: 'strawberry', name: 'いちご' },
  { id: 'peach', name: 'もも' },
  { id: 'tomato', name: 'トマト' },
];
const ANIMALS: { id: string; name: string }[] = [
  { id: 'chick', name: 'ひよこ' },
  { id: 'rabbit', name: 'うさぎ' },
  { id: 'frog', name: 'かえる' },
];

type Task =
  | { kind: 'count'; n: number; blocks: boolean }
  | { kind: 'count-mix'; n: number; m: number }
  | { kind: 'join'; a: number; b: number; blocks: boolean }
  | { kind: 'leave'; t: number; k: number; blocks: boolean };

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const COUNT: Task[] = [
  ...range(1, 5).map((n) => ({ kind: 'count', n, blocks: false }) as Task),
  ...range(1, 5).flatMap((n) => [1, 2].map((m) => ({ kind: 'count-mix', n, m }) as Task)),
  ...range(1, 5).map((n) => ({ kind: 'count', n, blocks: true }) as Task),
];
const JOIN: Task[] = [false, true].flatMap((blocks) =>
  range(1, 4).flatMap((a) => range(1, 5 - a).map((b) => ({ kind: 'join', a, b, blocks }) as Task)),
);
const LEAVE: Task[] = [false, true].flatMap((blocks) =>
  range(2, 5).flatMap((t) => range(1, t - 1).map((k) => ({ kind: 'leave', t, k, blocks }) as Task)),
);

/** 段階ごとの出題の候補（前の段階の内容も少し混ぜる） */
const LEVEL_TASKS: Task[][] = [
  COUNT,
  [...JOIN, ...COUNT.filter((t) => t.kind === 'count')],
  [...LEAVE, ...JOIN.filter((t) => !('blocks' in t && t.blocks))],
];

/** 数の選択肢（正解と、となりの数。1〜5 の中） */
function numberOptions(
  id: string,
  ans: number,
  wrong: { v: number; mis: string }[],
): ChoiceOption[] {
  const out: ChoiceOption[] = [{ label: String(ans), correct: true }];
  for (const w of wrong) {
    if (w.v < 1 || w.v > 6 || w.v === ans || out.some((o) => o.label === String(w.v))) continue;
    if (out.length < 3) out.push({ label: String(w.v), misconception: w.mis });
  }
  // 足りないときは となりの数だけで補う（ans+2 を「ひとつ ずれ」と呼ぶのは誤り。足りなければ 2択で よい: 4歳は 2〜4）
  for (const v of [ans + 1, ans - 1]) {
    if (out.length >= 3) break;
    if (v >= 1 && v <= 6 && !out.some((o) => o.label === String(v)))
      out.push({ label: String(v), misconception: 'off-by-one' });
  }
  return mix(id, out);
}

const blocks = (n: number, tone?: 'muted'): Figure => ({
  kind: 'blocks',
  ones: n,
  ...(tone ? { tone } : {}),
});
const COUNT_HINT = 'ゆびで ひとつずつ さわりながら「いち、に…」と かぞえよう。';

function make(task: Task, level: number, rng: Rng): ChoiceItem {
  const f = rng.pick(FRUITS);
  switch (task.kind) {
    case 'count': {
      const id = `count${task.blocks ? '-blocks' : ''}:${task.n}`;
      return {
        engine: 'choice',
        id: `${id}:${f.id}`,
        objective: 'count',
        level,
        alt: task.blocks,
        prompt: task.blocks ? 'つみきは いくつ？' : `${f.name}は いくつ？`,
        figure: task.blocks ? blocks(task.n) : ill(f.id, task.n),
        hints: [COUNT_HINT, 'さいごに いった かずが、ぜんぶの かずだよ。'],
        explain: `${range(1, task.n).join('、')}。${task.n}こ だね。`,
        identity: id,
        options: numberOptions(id, task.n, [
          { v: task.n + 1, mis: 'off-by-one' },
          { v: task.n - 1, mis: 'skip-one' },
        ]),
      };
    }
    case 'count-mix': {
      const a = rng.pick(ANIMALS);
      const id = `count-mix:${task.n}:${task.m}`;
      return {
        engine: 'choice',
        id: `${id}:${a.id}`,
        objective: 'count',
        level,
        prompt: `${a.name}だけ かぞえよう。${a.name}は いくつ？`,
        figure: { kind: 'row', items: [ill(a.id, task.n), ill(f.id, task.m)], gap: 4 },
        hints: [`${a.name}だけを ゆびで さわろう。`, COUNT_HINT],
        explain: `${a.name}は ${task.n}こ。${f.name}は かぞえないよ。`,
        identity: id,
        options: numberOptions(id, task.n, [
          { v: task.n + task.m, mis: 'count-all' },
          { v: task.n + 1, mis: 'off-by-one' },
        ]),
      };
    }
    case 'join': {
      const { a, b } = task;
      const id = `join${task.blocks ? '-blocks' : ''}:${a}+${b}`;
      return {
        engine: 'choice',
        id: `${id}:${f.id}`,
        objective: 'join',
        level,
        alt: task.blocks,
        prompt: task.blocks
          ? `つみきが ${a}こ。${b}こ もって きたよ。ぜんぶで いくつ？`
          : `${f.name}が ${a}こ。${b}こ もらったよ。ぜんぶで いくつ？`,
        figure: {
          kind: 'row',
          items: task.blocks ? [blocks(a), blocks(b)] : [ill(f.id, a), ill(f.id, b)],
          gap: 6,
        },
        hints: [
          'ふたつを いっしょに して かぞえよう。',
          `はじめの ${a}こに ゆびを おいて、つづけて かぞえよう。`,
        ],
        explain: `${a}こと ${b}こで、ぜんぶで ${a + b}こ。`,
        explainFigure: task.blocks ? blocks(a + b) : ill(f.id, a + b),
        identity: id,
        options: numberOptions(id, a + b, [
          { v: Math.max(a, b), mis: 'one-part' },
          { v: a + b + 1, mis: 'off-by-one' },
          { v: a + b - 1, mis: 'off-by-one' },
        ]),
      };
    }
    case 'leave': {
      const { t, k } = task;
      const id = `leave${task.blocks ? '-blocks' : ''}:${t}-${k}`;
      return {
        engine: 'choice',
        id: `${id}:${f.id}`,
        objective: 'leave',
        level,
        alt: task.blocks,
        prompt: task.blocks
          ? `つみきが ${t}こ。${k}こ かたづけたよ。のこりは いくつ？`
          : `${f.name}が ${t}こ あったよ。${k}こ たべたよ。のこりは いくつ？`,
        figure: {
          kind: 'row',
          items: task.blocks
            ? [blocks(t - k), blocks(k, 'muted')]
            : [ill(f.id, t - k), { kind: 'illust', id: f.id, count: k, tone: 'muted' }],
          gap: 6,
        },
        hints: ['うすく なった ものは もう ないよ。', 'こい いろの ものだけ かぞえよう。'],
        explain: `${t}こから ${k}こ へって、のこりは ${t - k}こ。`,
        explainFigure: task.blocks ? blocks(t - k) : ill(f.id, t - k),
        identity: id,
        options: numberOptions(id, t - k, [
          { v: t, mis: 'no-remove' },
          { v: k, mis: 'taken-count' },
          { v: t - k + 1, mis: 'off-by-one' },
        ]),
      };
    }
  }
}

export function generateCountPictures(level: number, rng: Rng): Item {
  const tasks = LEVEL_TASKS[Math.min(level, LEVEL_TASKS.length - 1)]!;
  return make(tasks[rng.int(0, tasks.length - 1)]!, level, rng);
}

export const countPictures: UnitSpec = {
  id: 'p4.math.count-pictures',
  title: 'かずと え',
  stage: 'p4',
  subject: 'math',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'math-add',
  prereq: ['p4.math.shop'],
  objectives: [
    { id: 'count', title: '1〜5を かぞえる' },
    { id: 'join', title: 'あわせて ぜんぶで（えで）' },
    { id: 'leave', title: 'へって のこりは（えで）' },
  ],
  misconceptions: [
    {
      id: 'off-by-one',
      explain:
        'ひとつ おおく（すくなく）かぞえたのかも。ゆびで さわりながら、ひとつずつ かぞえよう。',
    },
    { id: 'skip-one', explain: 'ひとつ とばしたのかな。かぞえた ものに ゆびを おいて おこう。' },
    { id: 'count-all', explain: 'ほかの ものも かぞえたのかな。いわれた ものだけ かぞえよう。' },
    { id: 'one-part', explain: 'かたほうだけ かぞえたのかな。ふたつを あわせて かぞえよう。' },
    { id: 'no-remove', explain: 'はじめの かずの ままに したのかな。たべた ぶんは へるよ。' },
    {
      id: 'taken-count',
      explain: 'たべた かずを こたえたのかな。のこって いる ほうを かぞえよう。',
    },
  ],
  levels: [
    { label: '1〜5を かぞえる', chance: 1 / 3 },
    { label: 'あわせて ぜんぶで', chance: 1 / 3 },
    { label: 'へって のこりは', chance: 1 / 3 },
  ],
  intro: [
    { text: 'りんごを かぞえよう。いち、に、さん。', figure: ill('apple', 3) },
    { text: 'さいごに いった「さん」が、ぜんぶの かず。3こ だね。', figure: ill('apple', 3) },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng }) => generateCountPictures(level, rng),
    domainSize: 60,
  },
  review: 'view',
  basis: '研R8、幼稚園教育要領解説（確実に数えることを目指さない）、curriculum-matrix 3.2・4.1',
  revised: '2026-10-24',
};
