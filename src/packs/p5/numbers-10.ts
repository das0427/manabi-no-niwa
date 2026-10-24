/**
 * p5.math.numbers-10 10までの かず（curriculum-matrix 3.3・4.4）: 数える・数字と数・なんばんめ。
 * 段階0: 6〜10を数える。段階1: 数字と数を むすぶ（match）。段階2: 「まえから 3ばんめ」と「3こ」。
 * 同一性キー（1.4。絵柄は同じ）: count:n、count-mix:n:m、count-frame:n（別例: 10のわく）、
 *   match:a-b-c（数の組）、match-blocks:a-b-c（別例）、ord:k:len（向き）、ord-vs:k（別例: 3ばんめ／3こ）。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import type { MatchItem } from '../../engines/match/match';
import { ill, mix } from './lib';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const THINGS = [
  { id: 'apple', name: 'りんご' },
  { id: 'strawberry', name: 'いちご' },
  { id: 'mikan', name: 'みかん' },
  { id: 'chick', name: 'ひよこ' },
  { id: 'flower', name: 'はな' },
];
const ANIMALS = [
  { id: 'dog', name: 'いぬ' },
  { id: 'cat', name: 'ねこ' },
  { id: 'rabbit', name: 'うさぎ' },
  { id: 'bear', name: 'くま' },
  { id: 'monkey', name: 'さる' },
  { id: 'frog', name: 'かえる' },
  { id: 'fox', name: 'きつね' },
];
const KAZU = ['', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ'];
const WORD = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう', 'じゅう'];

function numOpts(key: string, ans: number, wrong: { v: number; mis: string }[]): ChoiceOption[] {
  const out: ChoiceOption[] = [{ label: String(ans), correct: true }];
  for (const w of wrong)
    if (w.v >= 1 && w.v <= 12 && !out.some((o) => o.label === String(w.v)) && out.length < 4)
      out.push({ label: String(w.v), misconception: w.mis });
  return mix(key, out);
}

type Task =
  | { k: 'count'; n: number }
  | { k: 'mix'; n: number; m: number }
  | { k: 'frame'; n: number }
  | { k: 'match'; nums: number[]; blocks: boolean }
  | { k: 'ord'; pos: number; len: number }
  | { k: 'vs'; pos: number };

const COUNT_T: Task[] = [
  ...range(6, 10).map((n) => ({ k: 'count', n }) as Task),
  ...range(6, 10).flatMap((n) => [1, 2].map((m) => ({ k: 'mix', n, m }) as Task)),
  ...range(6, 10).map((n) => ({ k: 'frame', n }) as Task),
];
/** 数の組（1〜10 から3つ。となり合う数を1組は入れる） */
const TRIPLES: number[][] = [];
for (let a = 1; a <= 10; a++)
  for (let b = a + 1; b <= 10; b++)
    for (let c = b + 1; c <= 10; c++) if (b - a === 1 || c - b === 1) TRIPLES.push([a, b, c]);
const MATCH_T: Task[] = [false, true].flatMap((blocks) =>
  TRIPLES.map((nums) => ({ k: 'match', nums, blocks }) as Task),
);
const ORD_T: Task[] = [
  ...range(4, 6).flatMap((len) => range(1, len).map((pos) => ({ k: 'ord', pos, len }) as Task)),
  ...range(2, 5).map((pos) => ({ k: 'vs', pos }) as Task),
];
const LEVEL_T: Task[][] = [COUNT_T, MATCH_T, ORD_T];

const ST = 'stroke="var(--ink)" stroke-width="3"';
/** 5この まる。hl の番号を こく ぬる */
function dotsRow(len: number, hl: number[]): Figure {
  return {
    kind: 'svg',
    label: `まえから ${hl.join('、')}ばんめ`,
    markup: `<svg viewBox="0 0 ${len * 40 + 40} 44" xmlns="http://www.w3.org/2000/svg"><text x="16" y="28" font-size="14" text-anchor="middle" fill="var(--ink)">まえ</text>${range(
      1,
      len,
    )
      .map(
        (i) =>
          `<circle cx="${i * 40 + 18}" cy="22" r="15" fill="${hl.includes(i) ? 'var(--sun)' : 'var(--paper)'}" ${ST}/>`,
      )
      .join('')}</svg>`,
  };
}

function make(t: Task, level: number, rng: Rng): Item {
  const th = rng.pick(THINGS);
  switch (t.k) {
    case 'count': {
      const id = `count:${t.n}`;
      return {
        engine: 'choice',
        id: `${id}:${th.id}`,
        objective: 'count',
        level,
        prompt: `${th.name}は いくつ？`,
        figure: ill(th.id, t.n),
        hints: [
          'ゆびで おさえながら ひとつずつ かぞえよう。',
          '5こ まで かぞえたら、そこから「ろく、なな…」と つづけよう。',
        ],
        explain: `${range(1, t.n)
          .map((i) => WORD[i])
          .join('、')}。${t.n}こ だね。`,
        identity: id,
        options: numOpts(id, t.n, [
          { v: t.n + 1, mis: 'double-count' },
          { v: t.n - 1, mis: 'skip' },
          { v: t.n - 2, mis: 'skip' },
        ]),
      };
    }
    case 'mix': {
      const a = rng.pick(ANIMALS);
      const id = `count-mix:${t.n}:${t.m}`;
      return {
        engine: 'choice',
        id: `${id}:${a.id}:${th.id}`,
        objective: 'count',
        level,
        prompt: `${th.name}だけ かぞえよう。いくつ？`,
        figure: { kind: 'row', items: [ill(th.id, t.n), ill(a.id, t.m)], gap: 4 },
        hints: [`${th.name}だけに ゆびを おこう。`, '5こ まで かぞえたら、そこから つづけよう。'],
        explain: `${th.name}は ${t.n}こ。${a.name}は かぞえないよ。`,
        identity: id,
        options: numOpts(id, t.n, [
          { v: t.n + t.m, mis: 'count-all' },
          { v: t.n + 1, mis: 'double-count' },
          { v: t.n - 1, mis: 'skip' },
        ]),
      };
    }
    case 'frame': {
      const id = `count-frame:${t.n}`;
      return {
        engine: 'choice',
        id,
        objective: 'count',
        level,
        alt: true,
        prompt: '10の はこに いくつ はいって いるかな？',
        figure: { kind: 'blocks', ones: t.n, frame: true },
        hints: ['うえの だんは 5こ だよ。', `5と、したの だんの かずを あわせよう。`],
        explain: `5と ${t.n - 5}で ${t.n}。`,
        identity: id,
        options: numOpts(id, t.n, [
          { v: 10 - t.n, mis: 'empty-count' },
          { v: t.n + 1, mis: 'double-count' },
          { v: t.n - 1, mis: 'skip' },
        ]),
      };
    }
    case 'match': {
      const nums = t.nums;
      const id = `match${t.blocks ? '-blocks' : ''}:${nums.join('-')}`;
      const order = mix(id, range(0, nums.length - 1));
      const fig = (n: number): Figure =>
        t.blocks ? { kind: 'blocks', ones: n, frame: n > 5 } : ill(th.id, n);
      const right = order.map((i) => ({
        figure: fig(nums[i]!),
        name: `${t.blocks ? 'つみき' : th.name}の あつまり`,
      }));
      // name が同じだと読み上げで区別できないので、並びの番号を添える
      right.forEach((r, i) => (r.name = `${['ひだり', 'まんなか', 'みぎ'][i]}の ${r.name}`));
      const item: MatchItem = {
        engine: 'match',
        id: `${id}:${th.id}`,
        objective: 'numeral',
        level,
        alt: t.blocks,
        prompt: 'すうじと おなじ かずの えを せんで むすぼう。',
        left: nums.map((n) => ({ label: String(n) })),
        right,
        pairs: nums.map((_, i) => [i, order.indexOf(i)] as [number, number]),
        wrongPairs: nums.flatMap((n, i) =>
          nums.flatMap((m, j) =>
            Math.abs(n - m) === 1
              ? [{ pair: [i, order.indexOf(j)] as [number, number], misconception: 'near-number' }]
              : [],
          ),
        ),
        hints: [
          'えの かずを かぞえてから むすぼう。',
          'かずが ちかい ものは、ひとつずつ ていねいに かぞえよう。',
        ],
        explain: nums.map((n) => `${n}は ${n}こ`).join('、') + '。',
        identity: id,
      };
      return item;
    }
    case 'ord': {
      const as = mix(`${t.len}:${rng.int(0, 99)}`, ANIMALS).slice(0, t.len);
      const ans = as[t.pos - 1]!;
      const id = `ord:${t.pos}:${t.len}`;
      const back = t.len - t.pos + 1;
      const near = t.pos < t.len ? t.pos + 1 : t.pos - 1;
      const wrong: { a: (typeof ANIMALS)[number]; mis: string }[] = [];
      if (back !== t.pos) wrong.push({ a: as[back - 1]!, mis: 'from-back' });
      if (near !== back) wrong.push({ a: as[near - 1]!, mis: 'off-by-one-ord' });
      return {
        engine: 'choice',
        id: `${id}:${as.map((a) => a.id).join('-')}`,
        objective: 'ordinal',
        level,
        prompt: `まえから ${t.pos}ばんめの どうぶつは どれ？`,
        figure: {
          kind: 'row',
          items: [{ kind: 'text', text: 'まえ', size: 'm' }, ...as.map((a) => ill(a.id))],
          gap: 2,
        },
        hints: [
          '「まえ」と かいて ある ほうから かぞえよう。',
          `ゆびで さしながら「1ばんめ、2ばんめ…」と いおう。`,
        ],
        explain: `まえから かぞえて ${t.pos}ばんめは ${ans.name}。`,
        identity: id,
        options: mix(id + as.map((a) => a.id).join(), [
          { label: ans.name, figure: ill(ans.id), correct: true },
          ...wrong.map((w) => ({ label: w.a.name, figure: ill(w.a.id), misconception: w.mis })),
        ]),
      };
    }
    case 'vs': {
      const id = `ord-vs:${t.pos}`;
      const askCount = t.pos % 2 === 0;
      const asIs = askCount ? range(1, t.pos) : [t.pos];
      const other = askCount ? [t.pos] : range(1, t.pos);
      return {
        engine: 'choice',
        id,
        objective: 'ordinal',
        level,
        alt: true,
        prompt: askCount
          ? `まえから ${t.pos}こ ぬったのは どっち？`
          : `まえから ${t.pos}ばんめを ぬったのは どっち？`,
        hints: [
          '「〜こ」は かず ぜんぶ、「〜ばんめ」は ひとつだけ だよ。',
          'ぬって ある まるを かぞえよう。',
        ],
        explain: askCount
          ? `${t.pos}こ は まえから ${t.pos}つ ぜんぶ。`
          : `${t.pos}ばんめ は ${t.pos}つめの ひとつだけ。`,
        identity: id,
        options: mix(id, [
          { label: `きいろが ${KAZU[asIs.length]}`, figure: dotsRow(6, asIs), correct: true },
          {
            label: `きいろが ${KAZU[other.length]}`,
            figure: dotsRow(6, other),
            misconception: 'ord-vs-count',
          },
        ]),
        layout: 'column',
      };
    }
  }
}

export function generateNumbers10(level: number, rng: Rng): Item {
  const ts = LEVEL_T[Math.min(level, LEVEL_T.length - 1)]!;
  return make(ts[rng.int(0, ts.length - 1)]!, level, rng);
}

export const numbers10: UnitSpec = {
  id: 'p5.math.numbers-10',
  title: '10までの かず',
  stage: 'p5',
  subject: 'math',
  domain: 'play',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-math',
  prereq: ['p4.math.count-pictures'],
  objectives: [
    { id: 'count', title: '6〜10を かぞえる' },
    { id: 'numeral', title: 'すうじと かずを むすぶ' },
    { id: 'ordinal', title: 'なんばんめ' },
  ],
  misconceptions: [
    {
      id: 'double-count',
      explain: 'おなじ ものを 2かい かぞえたのかな。かぞえた ものに ゆびを おいて おこう。',
    },
    { id: 'skip', explain: 'とばした ものが あったかな。はしから じゅんに かぞえよう。' },
    { id: 'count-all', explain: 'ほかの ものも かぞえたのかな。いわれた ものだけ かぞえよう。' },
    {
      id: 'empty-count',
      explain: 'あいて いる ところを かぞえたのかな。はいって いる ほうを かぞえよう。',
    },
    {
      id: 'near-number',
      explain: 'ちかい かずと まちがえたかな。もういちど ひとつずつ かぞえよう。',
    },
    { id: 'from-back', explain: 'うしろから かぞえたのかな。「まえ」の ほうから かぞえよう。' },
    {
      id: 'off-by-one-ord',
      explain: 'ひとつ ずれたかな。ゆびで さしながら「1ばんめ、2ばんめ」と かぞえよう。',
    },
    { id: 'ord-vs-count', explain: '「〜ばんめ」は ひとつだけ、「〜こ」は そこまで ぜんぶ だよ。' },
  ],
  levels: [
    { label: '6〜10を かぞえる', chance: 0.25 },
    { label: 'すうじと かず', chance: 1 / 6 },
    { label: 'なんばんめ', chance: 1 / 3 },
  ],
  intro: [
    {
      text: '5こ と、あと 3こ。ごの つぎから「ろく、なな、はち」。8こ だね。',
      figure: { kind: 'blocks', ones: 8, frame: true },
    },
    {
      text: 'まえから 3ばんめ は、ひとつだけ。3こ は、まえから 3つ ぜんぶ。',
      figure: dotsRow(5, [3]),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng }) => generateNumbers10(level, rng),
    domainSize: COUNT_T.length + MATCH_T.length + ORD_T.length,
  },
  review: 'view',
  basis:
    '幼稚園教育要領解説（5歳後半に必要を感じて数える）、小学校学習指導要領 算数 第1学年 A(1) へ接続、curriculum-matrix 3.3',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
