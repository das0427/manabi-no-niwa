/**
 * g1.math.story-expression ばめんと しき（式に表す・式を読む）（curriculum-matrix 3.4）。
 *
 * 到達項目: ばめん→しき（match で結ぶ）・しきを つくる（build のタイル）・しきを よむ（式に合う お話を選ぶ）・
 *   しきから おはなし（explain: かいてみよう。採点しない／別例は お話の文カードを並べる order）。
 * 意味の型: 合併・増加（たし算）、求残・求差（ひき算）。場面は 11（数だけ違う文章題は同じ場面: 1.4）。
 * 同一性キー: 問いの形 × 場面（の組）× 数。交換しただけの式は、ここでは場面に合わせて書くので別（3＋5 と 5＋3
 *   の どちらも正しいときは、正答の側に両方を持たせる）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { BuildItem } from '../../engines/build/build';
import type { ExplainItem } from '../../engines/explain/explain';
import type { FillItem } from '../../engines/fill/fill';
import type { MatchItem } from '../../engines/match/match';
import type { OrderItem } from '../../engines/order/order';
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import { REVISED } from './util';

type Kind = 'gappei' | 'zouka' | 'kyuzan' | 'kyusa';
type Obj = 'basho' | 'tsukuru' | 'yomu' | 'ohanashi';
type Op = '+' | '-';

interface Scene {
  id: string;
  kind: Kind;
  /** はじめの文（a を含む） */
  s1: (a: number) => string;
  /** つぎの文（b を含む） */
  s2: (b: number) => string;
  /** とい */
  q: string;
  /** こたえの文（c を含む） */
  end: (c: number) => string;
  /** 増加・求残の場面の動き（式に合う言葉を選ぶ問題）: [ふえる言葉, へる言葉] と b の助数詞 */
  verbs?: [plus: string, minus: string];
  unit: string;
}

const SCENES: Scene[] = [
  {
    id: 'fruit',
    kind: 'gappei',
    s1: (a) => `りんごが ${a}こ、`,
    s2: (b) => `みかんが ${b}こ あります。`,
    q: 'あわせて なんこ ですか。',
    end: (c) => `あわせて ${c}こ です。`,
    unit: 'こ',
  },
  {
    id: 'pets',
    kind: 'gappei',
    s1: (a) => `いぬが ${a}ひき、`,
    s2: (b) => `ねこが ${b}ひき います。`,
    q: 'みんなで なんびき ですか。',
    end: (c) => `みんなで ${c}ひき です。`,
    unit: 'ひき',
  },
  {
    id: 'kids',
    kind: 'gappei',
    s1: (a) => `すなばで ${a}にん、`,
    s2: (b) => `ブランコで ${b}にん あそんで います。`,
    q: 'あわせて なんにん ですか。',
    end: (c) => `あわせて ${c}にん です。`,
    unit: 'にん',
  },
  {
    id: 'birds',
    kind: 'zouka',
    s1: (a) => `とりが ${a}わ います。`,
    s2: (b) => `${b}わ とんで きました。`,
    q: 'ぜんぶで なんわ ですか。',
    end: (c) => `ぜんぶで ${c}わに なりました。`,
    verbs: ['とんで きました', 'とんで いきました'],
    unit: 'わ',
  },
  {
    id: 'cars',
    kind: 'zouka',
    s1: (a) => `ちゅうしゃじょうに くるまが ${a}だい とまって います。`,
    s2: (b) => `${b}だい はいって きました。`,
    q: 'くるまは なんだいに なりましたか。',
    end: (c) => `くるまは ${c}だいに なりました。`,
    verbs: ['はいって きました', 'でて いきました'],
    unit: 'だい',
  },
  {
    id: 'cookies',
    kind: 'kyuzan',
    s1: (a) => `クッキーが ${a}まい あります。`,
    s2: (b) => `${b}まい たべました。`,
    q: 'のこりは なんまい ですか。',
    end: (c) => `のこりは ${c}まいに なりました。`,
    verbs: ['もらいました', 'たべました'],
    unit: 'まい',
  },
  {
    id: 'balloons',
    kind: 'kyuzan',
    s1: (a) => `ふうせんが ${a}こ あります。`,
    s2: (b) => `${b}こ とんで いきました。`,
    q: 'のこりは なんこ ですか。',
    end: (c) => `のこりは ${c}こに なりました。`,
    verbs: ['ふくらませました', 'とんで いきました'],
    unit: 'こ',
  },
  {
    id: 'frogs',
    kind: 'kyuzan',
    s1: (a) => `かえるが ${a}ひき います。`,
    s2: (b) => `${b}ひき いけに とびこみました。`,
    q: 'いけの そとに いる かえるは なんびき ですか。',
    end: (c) => `いけの そとには ${c}ひきに なりました。`,
    verbs: ['いけから でて きました', 'いけに とびこみました'],
    unit: 'ひき',
  },
  {
    id: 'dogcat',
    kind: 'kyusa',
    s1: (a) => `いぬが ${a}ひき、`,
    s2: (b) => `ねこが ${b}ひき います。`,
    q: 'いぬは ねこより なんびき おおい ですか。',
    end: (c) => `いぬが ${c}ひき おおい です。`,
    unit: 'ひき',
  },
  {
    id: 'redwhite',
    kind: 'kyusa',
    s1: (a) => `あかい くるまが ${a}だい、`,
    s2: (b) => `しろい くるまが ${b}だい あります。`,
    q: 'ちがいは なんだい ですか。',
    end: (c) => `ちがいは ${c}だい です。`,
    unit: 'だい',
  },
  {
    id: 'stickers',
    kind: 'kyusa',
    s1: (a) => `あかい シールが ${a}まい、`,
    s2: (b) => `あおい シールが ${b}まい あります。`,
    q: 'どちらが なんまい おおい ですか。',
    end: (c) => `あかい シールが ${c}まい おおい です。`,
    unit: 'まい',
  },
];

const opOf = (k: Kind): Op => (k === 'gappei' || k === 'zouka' ? '+' : '-');
const sym = (op: Op) => (op === '+' ? '＋' : '−');
const calc = (op: Op, a: number, b: number) => (op === '+' ? a + b : a - b);
const exprText = (op: Op, a: number, b: number) => `${a} ${sym(op)} ${b}`;
const story = (s: Scene, a: number, b: number) => `${s.s1(a)}${s.s2(b)}${s.q}`;
const KIND_WORD: Record<Kind, string> = {
  gappei: 'あわせる',
  zouka: 'ふえる',
  kyuzan: 'のこりを もとめる',
  kyusa: 'ちがいを もとめる',
};

/** 段階ごとの数の組（定義域から均等に選ぶ） */
function domain(level: number, op: Op): [number, number][] {
  const out: [number, number][] = [];
  if (op === '+') {
    for (let a = 1; a <= 9; a++)
      for (let b = 1; b <= 9; b++) {
        const s = a + b;
        if (level === 0 ? s <= 10 : s >= 11) out.push([a, b]);
      }
  } else {
    for (let a = 2; a <= 18; a++)
      for (let b = 1; b < a; b++) {
        if (a - b > 9 || b > 9) continue;
        if (level === 0 ? a <= 10 : a >= 11) out.push([a, b]);
      }
  }
  return out;
}
const pickNums = (rng: Rng, level: number, op: Op) => rng.pick(domain(level, op));

const tape = (op: Op, a: number, b: number): Figure =>
  op === '+'
    ? {
        kind: 'tape',
        parts: [
          { length: a, label: String(a), tone: 'a' },
          { length: b, label: String(b), tone: 'b' },
        ],
        total: '？',
      }
    : {
        kind: 'tape',
        parts: [
          { length: a - b, label: '？', tone: 'a' },
          { length: b, label: String(b), tone: 'b' },
        ],
        total: String(a),
      };

const KINDS: Kind[] = ['gappei', 'zouka', 'kyuzan', 'kyusa'];

// ---- ばめん → しき（match） ----
function basho(level: number, rng: Rng, alt: boolean): MatchItem {
  const kinds = rng.sample(KINDS, 3);
  const used = new Set<string>();
  const rows = kinds.map((k) => {
    const op = opOf(k);
    for (;;) {
      const [a, b] = pickNums(rng, level, op);
      const e = exprText(op, a, b);
      // 交換した式・逆の演算の式と重ならないように
      if (used.has(e) || used.has(exprText(op, b, a))) continue;
      used.add(e);
      return { k, op, a, b, e, scene: rng.pick(SCENES.filter((s) => s.kind === k)) };
    }
  });
  const r0 = rows[0]!;
  let distract: { e: string; mis: string };
  if (r0.op === '+')
    distract =
      r0.a !== r0.b
        ? { e: exprText('-', Math.max(r0.a, r0.b), Math.min(r0.a, r0.b)), mis: 'op-swap' }
        : { e: exprText('+', r0.a, r0.b + 1), mis: 'num-wrong' };
  else
    distract =
      r0.k === 'kyusa' || rng.next() < 0.5
        ? { e: exprText('-', r0.b, r0.a), mis: 'small-big' }
        : { e: exprText('+', r0.a, r0.b), mis: 'op-swap' };
  if (rows.some((r) => r.e === distract.e))
    distract = { e: exprText(r0.op, r0.a + 1, r0.b), mis: 'num-wrong' };
  const right = [...rows.map((r) => ({ label: r.e })), { label: distract.e }];
  const key = alt
    ? `basho-alt:${rows
        .map((r) => `${r.op}${r.a},${r.b}`)
        .sort()
        .join('/')}`
    : `basho:${rows
        .map((r) => `${r.scene.id}${r.a},${r.b}`)
        .sort()
        .join('/')}`;
  const names = ['テープ あ', 'テープ い', 'テープ う'];
  return {
    engine: 'match',
    id: key,
    objective: 'basho',
    level,
    alt,
    prompt: alt
      ? 'テープの ずと、あう しきを せんで むすぼう。'
      : 'おはなしと、あう しきを せんで むすぼう。',
    left: alt
      ? rows.map((r, i) => ({ figure: tape(r.op, r.a, r.b), name: names[i]! }))
      : rows.map((r) => ({ label: story(r.scene, r.a, r.b) })),
    right,
    pairs: rows.map((_, i) => [i, i] as [number, number]),
    wrongPairs: [{ pair: [0, 3], misconception: distract.mis }],
    hints: [
      alt
        ? 'テープの ぜんぶが「？」なら あわせる、ぶぶんが「？」なら のこりや ちがいを もとめるよ。'
        : '「あわせて」「ふえる」は たしざん、「のこり」「ちがい」は ひきざん だよ。',
      'おはなしに でて くる かずを しきの かずと くらべよう。',
      `${alt ? names[0] : 'いちばん うえの おはなし'}は ${KIND_WORD[r0.k]} ばめん。しきの しるしは どちらかな。`,
    ],
    explain: rows
      .map((r) => `${KIND_WORD[r.k]} ばめんは ${r.e}`)
      .join('、')
      .concat('。'),
    identity: key,
  };
}

// ---- しきを つくる（build） ----
function tsukuru(level: number, rng: Rng, alt: boolean): BuildItem {
  const scene = rng.pick(alt ? SCENES.filter((s) => s.kind !== 'kyusa') : SCENES);
  const op = opOf(scene.kind);
  const [a, b] = pickNums(rng, level, op);
  const c = calc(op, a, b);
  const other = op === '+' ? Math.abs(a - b) : a + b;
  const tiles = [String(a), String(b), String(c), '＋', '−', '＝'];
  if (![a, b, c].includes(other)) tiles.push(String(other));
  const values = op === '+' ? [`${a}＋${b}＝${c}`, `${b}＋${a}＝${c}`] : [`${a}−${b}＝${c}`];
  const wrong: { value: string; misconception: string }[] = [];
  if (op === '-') {
    wrong.push({ value: `${a}＋${b}＝${c}`, misconception: 'op-swap' });
    wrong.push({ value: `${b}−${a}＝${c}`, misconception: 'small-big' });
    if (![a, b, c].includes(other))
      wrong.push({ value: `${a}＋${b}＝${other}`, misconception: 'op-swap' });
  } else {
    wrong.push({ value: `${a}−${b}＝${c}`, misconception: 'op-swap' });
    if (a > b && ![a, b, c].includes(other))
      wrong.push({ value: `${a}−${b}＝${other}`, misconception: 'op-swap' });
  }
  const key = alt ? `tsukuru-alt:${op}${a},${b}` : `tsukuru:${scene.id}:${a},${b}`;
  return {
    engine: 'build',
    id: key,
    objective: 'tsukuru',
    level,
    alt,
    prompt: alt
      ? 'テープの ずに あう しきを、カードを ならべて つくろう。'
      : `${story(scene, a, b)}\nしきを、カードを ならべて つくろう。`,
    figure: alt ? tape(op, a, b) : undefined,
    tiles,
    answer: { kind: 'text', values },
    wrongAnswers: wrong,
    hints: [
      alt
        ? '「？」が テープの ぜんぶか、ぶぶんかを みよう。'
        : scene.kind === 'kyusa'
          ? '「ちがい」や「どちらが おおい」は ひきざん だよ。'
          : `${KIND_WORD[scene.kind]} おはなしだね。たしざんかな、ひきざんかな。`,
      op === '+' ? `しきは ${a} ＋ … と つづくよ。` : `おおきい ほうの ${a}から ひくよ。${a} − …`,
      op === '+'
        ? `${a} ＋ ${b} ＝ の あとに こたえの かずを おこう。`
        : `${a} − ${b} ＝ の あとに こたえの かずを おこう。`,
    ],
    explain: `${KIND_WORD[scene.kind]} ばめんなので、しきは ${exprText(op, a, b)} ＝ ${c} です。`,
    identity: key,
  };
}

// ---- しきを よむ（choice・別例は fill） ----
function yomu(level: number, rng: Rng, alt: boolean): ChoiceItem | FillItem {
  if (alt) {
    const scene = rng.pick(SCENES.filter((s) => s.verbs));
    const op: Op = rng.next() < 0.5 ? '+' : '-';
    const [a, b] = pickNums(rng, level, op);
    const [plus, minus] = scene.verbs!;
    const ans = op === '+' ? plus : minus;
    const key = `yomu-alt:${scene.id}:${op}${a},${b}`;
    return {
      engine: 'fill',
      id: key,
      objective: 'yomu',
      level,
      alt: true,
      prompt: `しき ${exprText(op, a, b)} に あう おはなしに なるように、{{}}に はいる ことばを えらぼう。`,
      text: `${scene.s1(a)}${b}${scene.unit} {{}}。`,
      options: [plus, minus],
      blanks: [
        {
          answers: [ans],
          wrong: [{ value: op === '+' ? minus : plus, misconception: 'op-swap' }],
        },
      ],
      hints: [
        `しきの しるしは ${sym(op)} だね。`,
        op === '+' ? '＋ は かずが ふえる おはなし だよ。' : '− は かずが へる おはなし だよ。',
        op === '+'
          ? `${b}${scene.unit} ふえる ことばは どちらかな。`
          : `${b}${scene.unit} へる ことばは どちらかな。`,
      ],
      explain: `${exprText(op, a, b)} は ${op === '+' ? 'ふえる' : 'へる'} おはなし。「${ans}」が あうよ。`,
      identity: key,
    };
  }
  const op: Op = rng.next() < 0.5 ? '+' : '-';
  const [a, b] = pickNums(rng, level, op);
  const right = rng.pick(SCENES.filter((s) => opOf(s.kind) === op));
  const wrongOp = rng.pick(SCENES.filter((s) => opOf(s.kind) !== op));
  const sameOp = rng.pick(SCENES.filter((s) => opOf(s.kind) === op));
  const options: ChoiceItem['options'] = [{ label: story(right, a, b), correct: true }];
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (op === '-' || hi > lo)
    options.push({
      label: story(wrongOp, op === '-' ? a : hi, op === '-' ? b : lo),
      misconception: 'op-swap',
    });
  // 数の違う お話（同じ演算）
  const nb = op === '-' && b + 1 >= a ? b - 1 : b + 1;
  if (nb >= 1) options.push({ label: story(sameOp, a, nb), misconception: 'num-wrong' });
  if (options.length < 3)
    options.push({ label: story(sameOp, a + 1, b), misconception: 'num-wrong' });
  const dedup = options.filter((o, i) => options.findIndex((p) => p.label === o.label) === i);
  const key = `yomu:${op}${a},${b}:${right.id}`;
  return {
    engine: 'choice',
    id: key,
    objective: 'yomu',
    level,
    prompt: `${exprText(op, a, b)} の おはなしは どれ？`,
    layout: 'column',
    options: dedup,
    hints: [
      `しきの しるしは ${sym(op)}。${op === '+' ? 'あわせる か ふえる' : 'のこり か ちがい'} おはなしを さがそう。`,
      `おはなしに ${a}と ${b}が でて くるかも みよう。`,
      `${KIND_WORD[right.kind]} おはなしで、かずも あって いるのは…`,
    ],
    explain: `${exprText(op, a, b)} は ${KIND_WORD[right.kind]} おはなし。「${story(right, a, b)}」が あうよ。`,
    identity: key,
  };
}

// ---- しきから おはなし（explain・別例は order） ----
function ohanashi(level: number, rng: Rng, alt: boolean): ExplainItem | OrderItem {
  if (alt) {
    const scene = rng.pick(SCENES.filter((s) => s.kind === 'zouka' || s.kind === 'kyuzan'));
    const op = opOf(scene.kind);
    const [a, b] = pickNums(rng, level, op);
    const c = calc(op, a, b);
    const key = `ohanashi-alt:${scene.id}:${a},${b}`;
    return {
      engine: 'order',
      id: key,
      objective: 'ohanashi',
      level,
      alt: true,
      prompt: `${exprText(op, a, b)} ＝ ${c} の おはなしに なるように、ぶんを ならべよう。`,
      layout: 'column',
      cards: [{ label: scene.s1(a) }, { label: scene.s2(b) }, { label: scene.end(c) }],
      ends: ['はじめ', 'おわり'],
      reverseMisconception: 'story-order',
      wrongOrders: [{ order: [1, 0, 2], misconception: 'story-order' }],
      hints: [
        'しきの はじめの かず、つぎの かず、こたえの じゅんに おはなしが すすむよ。',
        `はじめに ${a}${scene.unit} あったね。`,
        `つぎに ${b}${scene.unit} ${op === '+' ? 'ふえて' : 'へって'}、さいごに ${c}${scene.unit}に なるよ。`,
      ],
      explain: `${scene.s1(a)} → ${scene.s2(b)} → ${scene.end(c)} の じゅんだよ。`,
      identity: key,
    };
  }
  const op: Op = rng.next() < 0.5 ? '+' : '-';
  const [a, b] = pickNums(rng, level, op);
  const sample = rng.pick(SCENES.filter((s) => opOf(s.kind) === op));
  const key = `ohanashi:${op}${a},${b}`;
  return {
    engine: 'explain',
    id: key,
    objective: 'ohanashi',
    level,
    prompt: `${exprText(op, a, b)} に なる おはなしを かんがえて、えに かこう。どんな おはなしかも えらんでね。`,
    canvas: { guide: 'none' },
    reasons:
      op === '+'
        ? [{ label: 'あわせる おはなし' }, { label: 'ふえる おはなし' }]
        : [{ label: 'のこりを もとめる おはなし' }, { label: 'ちがいを もとめる おはなし' }],
    hints: [
      `${op === '+' ? '＋ は あわせる おはなしや ふえる' : '− は のこりを もとめる おはなしや ちがいを もとめる'} おはなしに なるよ。`,
      `${a}こ の ものを かいて みよう。`,
      op === '+'
        ? `そこに ${b}こ ふえる ところを かこう。`
        : `そこから ${b}こ へる ところを かこう。`,
    ],
    explain: `たとえば「${story(sample, a, b)}」のような おはなしが ${exprText(op, a, b)} だよ。`,
    identity: key,
  };
}

const OBJS: Obj[] = ['basho', 'tsukuru', 'yomu', 'ohanashi'];

export function generateStoryExpression(level: number, rng: Rng, index: number): Item {
  const lv = Math.min(level, 1);
  const obj = OBJS[(index + rng.int(0, OBJS.length - 1)) % OBJS.length]!;
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'basho':
      return basho(lv, rng, alt);
    case 'tsukuru':
      return tsukuru(lv, rng, alt);
    case 'yomu':
      return yomu(lv, rng, alt);
    case 'ohanashi':
      return ohanashi(lv, rng, alt);
  }
}

export const storyExpression: UnitSpec = {
  id: 'g1.math.story-expression',
  title: 'ばめんと しき',
  stage: 'g1',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g1.math.sub-borrow'],
  objectives: [
    { id: 'basho', title: 'おはなしと しきを むすぶ' },
    { id: 'tsukuru', title: 'しきを つくる' },
    { id: 'yomu', title: 'しきに あう おはなしを えらぶ' },
    { id: 'ohanashi', title: 'しきから おはなしを つくる' },
  ],
  misconceptions: [
    {
      id: 'op-swap',
      explain:
        'たしざんと ひきざんを とりちがえたのかな。あわせる・ふえる ときは ＋、のこり・ちがいを もとめる ときは − だよ。',
    },
    {
      id: 'small-big',
      explain:
        'ちいさい かずから おおきい かずを ひいたのかな。ひきざんは おおきい ほうの かずから ひくよ。',
    },
    {
      id: 'num-wrong',
      explain:
        'しるしは あって いるけれど、かずが ちがうよ。おはなしの かずと しきの かずを 1つずつ くらべよう。',
    },
    {
      id: 'story-order',
      explain:
        'おはなしの じゅんばんが ちがうのかな。はじめに あった かず → かわった かず → こたえ の じゅんだよ。',
    },
  ],
  levels: [
    { label: '10までの かずで', chance: 0.1 },
    { label: '20までの かずで', chance: 0.1 },
  ],
  intro: [
    {
      text: 'とりが 3わ います。2わ とんで きました。とりは ふえたね。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'illust', id: 'bird', count: 3 },
          { kind: 'text', text: '＋', size: 'l' },
          { kind: 'illust', id: 'bird', count: 2 },
        ],
        gap: 3,
      },
    },
    {
      text: 'テープの ずに すると、3と 2を あわせた ぜんぶが「？」。',
      figure: tape('+', 3, 2),
    },
    {
      text: 'しきに かくと 3 ＋ 2 ＝ 5。のこりや ちがいを もとめる ときは − の しきに なるよ。',
      figure: { kind: 'text', text: '3 ＋ 2 ＝ 5', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateStoryExpression(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 A(2) 加法・減法（加法・減法が用いられる場面を式に表したり、式を読み取ったりすること）',
  revised: REVISED,
};
