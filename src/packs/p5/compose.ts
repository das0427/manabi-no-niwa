/**
 * p5.math.compose いくつと いくつ（curriculum-matrix 3.3・4.1）: 2〜10 の合成と分解、「あと いくつで 10」。
 * v1 の「わける」（split: D1・D2。5まで）を 10まで広げた単元なので、進度は新しく始める（統括の判断6）。
 * D1（2つの皿に自由に分ける探索）は v1 の「さんすう」に残る。
 * 同一性キー: split:n:a（n を a と ? に分ける。順あり）、別例は blocks（10のわく）で split-frame:n:a、
 *   to10:a（あと いくつで 10）。定義域: 2〜10 の分け方 全45 ＋ 別例 45 ＋ あと いくつで10 9。
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
  { id: 'egg', name: 'たまご' },
];

type Task =
  { k: 'split'; n: number; a: number; frame: boolean } | { k: 'to10'; a: number; pic: boolean };
const SPLITS = (lo: number, hi: number, frame: boolean): Task[] =>
  range(lo, hi).flatMap((n) => range(1, n - 1).map((a) => ({ k: 'split', n, a, frame }) as Task));
const LEVEL_T: Task[][] = [
  [...SPLITS(2, 5, false), ...SPLITS(2, 5, true)],
  [...SPLITS(6, 10, false), ...SPLITS(6, 10, true)],
  [
    ...[false, true].flatMap((pic) => range(1, 9).map((a) => ({ k: 'to10', a, pic }) as Task)),
    ...SPLITS(10, 10, false),
  ],
];

function opts(key: string, ans: number, n: number, a: number): ChoiceOption[] {
  const out: ChoiceOption[] = [{ label: String(ans), correct: true }];
  const add = (v: number, mis: string) => {
    if (v >= 0 && v <= 10 && !out.some((o) => o.label === String(v)) && out.length < 4)
      out.push({ label: String(v), misconception: mis });
  };
  add(n, 'whole');
  add(a, 'same-part');
  add(ans + 1, 'off-by-one');
  add(ans - 1, 'off-by-one');
  return mix(key, out);
}

/** 見えている皿（a こ）と、ふせた皿 */
const plates = (thing: string, a: number, frame: boolean): Figure =>
  frame
    ? { kind: 'blocks', ones: a, frame: true }
    : { kind: 'row', items: [ill(thing, a), { kind: 'text', text: '？', size: 'xl' }], gap: 6 };

function make(t: Task, level: number, rng: Rng): Item {
  const th = rng.pick(THINGS);
  if (t.k === 'to10') {
    const id = `to10${t.pic ? '-pic' : ''}:${t.a}`;
    return {
      engine: 'choice',
      id,
      objective: 'to10',
      level,
      alt: t.pic,
      prompt: t.pic
        ? `${th.name}を 10こ あつめたい。いま ${t.a}こ。あと いくつ？`
        : `10の はこに ${t.a}こ はいって いるよ。あと いくつで 10？`,
      figure: t.pic ? ill(th.id, t.a) : { kind: 'blocks', ones: t.a, frame: true },
      hints: t.pic
        ? ['ゆびを 10ぽん だして みよう。', `${t.a}ほん おると、のこりの ゆびは いくつかな。`]
        : ['あいて いる ところを かぞえよう。', 'うえの だんと したの だんで 5こずつ だよ。'],
      explain: `${t.a}と ${10 - t.a}で 10。あと ${10 - t.a}こ。`,
      explainFigure: { kind: 'blocks', ones: 10, frame: true },
      identity: id,
      options: opts(id, 10 - t.a, 10, t.a),
    };
  }
  const { n, a, frame } = t;
  const b = n - a;
  const id = `split${frame ? '-frame' : ''}:${n}:${a}`;
  return {
    engine: 'choice',
    id: `${id}:${th.id}`,
    objective: n <= 5 ? 'within5' : 'within10',
    level,
    alt: frame,
    prompt: frame
      ? `つみきは ぜんぶで ${n}こ。みえて いるのは ${a}こ。かくれて いるのは いくつ？`
      : `${th.name}は ぜんぶで ${n}こ。こっちの おさらに ${a}こ。あっちの おさらは いくつ？`,
    figure: plates(th.id, a, frame),
    hints: [
      `ぜんぶで ${n}こ だよ。ゆびを ${n}ぽん だして みよう。`,
      `${a}ほん おると、のこりの ゆびは いくつかな。`,
    ],
    explain: `${n}は ${a}と ${b}。`,
    explainFigure: frame
      ? { kind: 'blocks', ones: n, frame: true }
      : { kind: 'row', items: [ill(th.id, a), ill(th.id, b)], gap: 6 },
    identity: id,
    options: opts(id, b, n, a),
  };
}

export function generateCompose(level: number, rng: Rng): Item {
  const ts = LEVEL_T[Math.min(level, LEVEL_T.length - 1)]!;
  return make(ts[rng.int(0, ts.length - 1)]!, level, rng);
}

export const composeUnit: UnitSpec = {
  id: 'p5.math.compose',
  title: 'いくつと いくつ',
  stage: 'p5',
  subject: 'math',
  domain: 'play',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'math-split',
  prereq: ['p5.math.numbers-10'],
  objectives: [
    { id: 'within5', title: '5までの いくつと いくつ' },
    { id: 'within10', title: '10までの いくつと いくつ' },
    { id: 'to10', title: 'あと いくつで 10' },
  ],
  misconceptions: [
    {
      id: 'whole',
      explain: 'ぜんぶの かずを こたえたのかな。かくれて いる ほうの かずを かんがえよう。',
    },
    { id: 'same-part', explain: 'みえて いる ほうの かずを こたえたのかな。のこりは いくつかな。' },
    { id: 'off-by-one', explain: 'ひとつ ちがったかな。ゆびを つかって たしかめよう。' },
  ],
  levels: [
    { label: '5までの いくつと いくつ', chance: 0.25 },
    { label: '10までの いくつと いくつ', chance: 0.25 },
    { label: 'あと いくつで 10', chance: 0.25 },
  ],
  intro: [
    {
      text: 'りんごが 5こ。2こと 3こに わけられるね。',
      figure: { kind: 'row', items: [ill('apple', 2), ill('apple', 3)], gap: 6 },
    },
    { text: '5は 2と 3。', figure: { kind: 'blocks', ones: 5, frame: true } },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng }) => generateCompose(level, rng),
    domainSize: 45 * 2 + 18,
  },
  review: 'view',
  basis:
    '教材会社の目安（合成・分解。公的資料に記述なし: 教C3）、小学校学習指導要領 算数 第1学年 A(1) へ接続、curriculum-matrix 3.3',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
