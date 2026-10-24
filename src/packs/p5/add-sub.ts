/**
 * p5.math.add-sub たす・ひく（curriculum-matrix 3.3・4.4）: 絵と式（5まで → 10まで）→ 式だけ。
 * 既定で非表示（保護者が開く: 統括の判断7）。式は読みと見通しまで（判断9）。絵がいつも見られる段階から始める。
 * v1 の さんすう（add B1〜B3、sub C1〜C3、formula E1・E2。5まで）を 10まで広げた単元なので、進度は新しく始める（判断6）。
 * 同一性キー: add:a+b・sub:a-b（順あり。交換法則は学習内容ではないが、幼児は式の形ごとに数える）、
 *   別例 add-blocks・sub-blocks（ブロックの図）、式だけ shiki:a+b・shiki:a-b、別例 story:（絵のない おはなし）。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { ill, mix } from './lib';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const THINGS = [
  { id: 'apple', name: 'りんご' },
  { id: 'mikan', name: 'みかん' },
  { id: 'strawberry', name: 'いちご' },
  { id: 'peach', name: 'もも' },
];

type Op = '+' | '-';
type Task = { op: Op; a: number; b: number; rep: 'pic' | 'blocks' | 'shiki' | 'story' };

const pairs = (op: Op, max: number, zero: boolean): [number, number][] =>
  op === '+'
    ? range(zero ? 0 : 1, max)
        .flatMap((a) => range(zero ? 0 : 1, max - a).map((b) => [a, b] as [number, number]))
        .filter(([a, b]) => a + b > 0)
    : range(zero ? 0 : 1, max)
        .flatMap((a) => range(zero ? 0 : 1, a).map((b) => [a, b] as [number, number]))
        .filter(([a, b]) => a + b > 0);
const tasks = (max: number, reps: Task['rep'][], zero = false): Task[] =>
  reps.flatMap((rep) =>
    (['+', '-'] as Op[]).flatMap((op) => pairs(op, max, zero).map(([a, b]) => ({ op, a, b, rep }))),
  );

const LEVEL_T: Task[][] = [
  tasks(5, ['pic', 'blocks']),
  tasks(10, ['pic', 'blocks']).filter((t) => (t.op === '+' ? t.a + t.b : t.a) > 5),
  [...tasks(10, ['shiki'], true), ...tasks(10, ['story'])],
];

const ans = (t: Task) => (t.op === '+' ? t.a + t.b : t.a - t.b);
const sym = (op: Op) => (op === '+' ? '＋' : '−');

function opts(key: string, t: Task): ChoiceOption[] {
  const r = ans(t);
  const out: ChoiceOption[] = [{ label: String(r), correct: true }];
  const add = (v: number, mis: string) => {
    if (v >= 0 && v <= 10 && !out.some((o) => o.label === String(v)) && out.length < 4)
      out.push({ label: String(v), misconception: mis });
  };
  add(t.op === '+' ? Math.abs(t.a - t.b) : t.a + t.b, 'op-swap');
  add(r + 1, 'off-by-one');
  add(r - 1, 'off-by-one');
  add(t.op === '+' ? t.a : t.a, t.op === '+' ? 'one-part' : 'no-remove');
  add(r + 2, 'off-by-one');
  return mix(key, out);
}

function picture(t: Task, thing: string): Figure {
  const blocks = t.rep === 'blocks';
  const g = (n: number, muted = false): Figure =>
    blocks
      ? { kind: 'blocks', ones: n, ...(muted ? { tone: 'muted' as const } : {}) }
      : { kind: 'illust', id: thing, count: n, ...(muted ? { tone: 'muted' as const } : {}) };
  const row: Figure =
    t.op === '+'
      ? { kind: 'row', items: [g(t.a), { kind: 'text', text: '＋', size: 'l' }, g(t.b)], gap: 3 }
      : { kind: 'row', items: [...(t.a - t.b > 0 ? [g(t.a - t.b)] : []), g(t.b, true)], gap: 4 };
  return {
    kind: 'column',
    items: [row, { kind: 'text', text: `${t.a} ${sym(t.op)} ${t.b} ＝ ？`, size: 'l' }],
    gap: 2,
  };
}

function make(t: Task, level: number, rng: Rng): Item {
  const th = rng.pick(THINGS);
  const r = ans(t);
  const expr = `${t.a}${t.op}${t.b}`;
  const base = { engine: 'choice' as const, level };
  const explain =
    t.op === '+'
      ? `${t.a}と ${t.b}を あわせて ${r}。${t.a} ${sym(t.op)} ${t.b} ＝ ${r}。`
      : `${t.a}から ${t.b} とると ${r}。${t.a} ${sym(t.op)} ${t.b} ＝ ${r}。`;
  const hintPic =
    t.op === '+'
      ? ['ぜんぶを ひとつずつ かぞえよう。', `${t.a}の つぎから かぞえて みよう。`]
      : ['うすく なった ものは もう ないよ。', 'のこって いる ものを かぞえよう。'];
  switch (t.rep) {
    case 'pic':
    case 'blocks': {
      const id = `${t.op === '+' ? 'add' : 'sub'}${t.rep === 'blocks' ? '-blocks' : ''}:${expr}`;
      return {
        ...base,
        id: `${id}:${th.id}`,
        objective: t.op === '+' ? 'add' : 'sub',
        alt: t.rep === 'blocks',
        prompt: t.op === '+' ? 'あわせると いくつ？' : 'のこりは いくつ？',
        figure: picture(t, th.id),
        hints: hintPic,
        explain,
        identity: id,
        options: opts(id, t),
      };
    }
    case 'shiki': {
      const id = `shiki:${expr}`;
      return {
        ...base,
        id,
        objective: 'shiki',
        // ヒントは 文だけ（絵は 出ない）なので、「えを みよう」とは いわない
        prompt: 'けいさん しよう。こまったら ヒントを きこう。',
        figure: { kind: 'text', text: `${t.a} ${sym(t.op)} ${t.b} ＝ ？`, size: 'xl' },
        hints: [
          t.op === '+'
            ? `${t.a}こと ${t.b}こを あわせるよ。ゆびで やって みよう。`
            : `${t.a}こから ${t.b}こ とるよ。ゆびで やって みよう。`,
          t.op === '+'
            ? `${t.a}の つぎから ${t.b}つ かぞえよう。`
            : `${t.a}から ${t.b}つ もどって かぞえよう。`,
        ],
        explain,
        explainFigure: picture({ ...t, rep: 'blocks' }, th.id),
        identity: id,
        options: opts(id, t),
      };
    }
    case 'story': {
      const id = `story:${expr}`;
      return {
        ...base,
        id: `${id}:${th.id}`,
        objective: 'shiki',
        alt: true,
        prompt:
          t.op === '+'
            ? `${th.name}が ${t.a}こ あります。${t.b}こ もらいました。ぜんぶで いくつ？`
            : `${th.name}が ${t.a}こ あります。${t.b}こ たべました。のこりは いくつ？`,
        figure: { kind: 'text', text: `${t.a} ${sym(t.op)} ${t.b} ＝ ？`, size: 'l' },
        hints: [
          t.op === '+' ? '「もらう」と ふえるね。' : '「たべる」と へるね。',
          'ゆびを つかって かぞえて みよう。',
        ],
        explain,
        explainFigure: picture({ ...t, rep: 'pic' }, th.id),
        identity: id,
        options: opts(id, t),
      };
    }
  }
}

export function generateAddSub(level: number, rng: Rng): Item {
  const ts = LEVEL_T[Math.min(level, LEVEL_T.length - 1)]!;
  return make(ts[rng.int(0, ts.length - 1)]!, level, rng);
}

const DOMAIN = new Set(
  LEVEL_T.flat().map((t) => `${t.rep === 'blocks' ? 'b' : t.rep}:${t.op}:${t.a}:${t.b}`),
).size;

export const addSub: UnitSpec = {
  id: 'p5.math.add-sub',
  title: 'たす・ひく',
  stage: 'p5',
  subject: 'math',
  domain: 'play',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['p5.math.compose'],
  objectives: [
    { id: 'add', title: 'たす（えと しき）' },
    { id: 'sub', title: 'ひく（えと しき）' },
    { id: 'shiki', title: 'しきだけ（こたえの あとに えで たしかめる）' },
  ],
  misconceptions: [
    { id: 'op-swap', explain: '「たす」と「ひく」が いれかわったかな。しるしを よく みよう。' },
    { id: 'off-by-one', explain: 'ひとつ ずれたかな。ゆびを つかって ひとつずつ かぞえよう。' },
    { id: 'one-part', explain: 'はじめの かずだけ こたえたのかな。ふたつを あわせよう。' },
    { id: 'no-remove', explain: 'はじめの かずの ままに したのかな。とった ぶんは へるよ。' },
  ],
  levels: [
    { label: '5まで（えと しき）', chance: 0.25 },
    { label: '10まで（えと しき）', chance: 0.25 },
    { label: 'しきだけ（10まで）', chance: 0.25 },
  ],
  intro: [
    {
      text: 'りんごが 3こと 2こ。あわせると 5こ。',
      figure: { kind: 'row', items: [ill('apple', 3), ill('apple', 2)], gap: 6 },
    },
    {
      text: 'これを しきで かくと 3 ＋ 2 ＝ 5。「さん たす に は ご」と よむよ。',
      figure: { kind: 'text', text: '3 ＋ 2 ＝ 5', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng }) => generateAddSub(level, rng),
    domainSize: DOMAIN,
  },
  review: 'view',
  basis:
    '教材会社の目安（年長で加減: 教C4。公的資料に記述なし）、小学校学習指導要領 算数 第1学年 A(2) へ接続、curriculum-matrix 3.3・4.4',
  gradeIsAppProposal: true,
  hiddenByDefault: true,
  revised: '2026-10-24',
};
