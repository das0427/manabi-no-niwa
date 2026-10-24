/**
 * g6.math.combinations 起こり得る場合（並べ方・組み合わせ）（curriculum-matrix 3.9）。
 * 図や表で落ちなく調べる → 並べ方 → 組み合わせ（順番を区別しない）。
 *
 * 答えは「場合の数」（整数）。同一性キー: 場面 × 数。落ちなく調べる問題は 書き出した一覧 × 足りないもの。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { finishUnit, opts, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'perm' | 'comb' | 'product' | 'list';

const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const P = (n: number, k: number) => fact(n) / fact(n - k);
const C = (n: number, k: number) => P(n, k) / fact(k);
const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const names = (n: number) => NAMES.slice(0, n).join('、');
const FLAG_COLORS = ['赤', '青', '黄', '白', '緑《みどり》'];

function numItem(
  obj: Obj,
  level: number,
  alt: boolean,
  key: string,
  prompt: string,
  figure: Figure | undefined,
  ans: number,
  hints: [string, string, string],
  explain: string,
  cands: [number | null, string][],
  unit = '通り',
): NumberItem {
  const answer = { kind: 'int' as const, value: ans };
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${key}`,
    objective: obj,
    level,
    prompt,
    figure,
    hints,
    explain,
    identity: `${obj}:${key}`,
    alt,
    fields: [{ label: unit, answer }],
    wrongAnswers: wrongList([answer], cands),
  };
}

// ---- 並べ方 ----
const LINE_CTX = [
  {
    id: 'people',
    text: (n: number) =>
      `${names(n)}の ${n}人が 1列に 並びます。並び方は 全部で 何通り ありますか。`,
  },
  {
    id: 'books',
    text: (n: number) =>
      `ちがう 本 ${n}冊を、本だなに 横 1列に 並べます。並べ方は 全部で 何通り ありますか。`,
  },
  // 使う 旗は n色 全部（5色から 選ぶ 問題に 読めないように、色を n色だけ 示す）
  {
    id: 'flags',
    text: (n: number) =>
      `${FLAG_COLORS.slice(0, n).join('・')}の ${n}色の 旗を 全部 使って、1列に 並べます。並べ方は 全部で 何通り ありますか。`,
  },
];
const PICK_CTX = [
  {
    id: 'leader',
    text: (n: number) =>
      `${names(n)}の ${n}人から、班長と 副班長《ふくはんちょう》を 1人ずつ 選びます。選び方は 全部で 何通り ありますか。`,
  },
  {
    id: 'medal',
    text: (n: number) =>
      `${n}人で かけっこを します。1位と 2位の 決まり方は 全部で 何通り ありますか（同じ 順位は ないと します）。`,
  },
  {
    id: 'relay',
    text: (n: number) =>
      `${n}人の 中から、リレーの 1番目と 2番目に 走る 人を 決めます。決め方は 全部で 何通り ありますか。`,
  },
];

function permItem(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    // 数字カードで 整数を 作る
    const m = rng.int(3, 5);
    const zero = rng.next() < 0.5;
    const others = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], zero ? m - 1 : m).sort((a, b) => a - b);
    const digits = zero ? [0, ...others] : others;
    const k = m >= 4 && rng.next() < 0.5 ? 3 : 2;
    const ans = zero ? (m - 1) * P(m - 1, k - 1) : P(m, k);
    return numItem(
      'perm',
      level,
      true,
      `cards:${digits.join('')}:${k}`,
      `${digits.join('、')}の ${m}まいの 数字カードから ${k}まい 選んで 並べ、${k}けたの 整数を 作ります。整数は 全部で 何通り できますか。`,
      undefined,
      ans,
      [
        zero
          ? 'いちばん 上の 位に 0は 使えないね。'
          : 'いちばん 上の 位から 順に、使える カードが 何まい あるか 考えよう。',
        zero
          ? `いちばん 上の 位は 0以外の ${m - 1}通り。`
          : `いちばん 上の 位は ${m}通り、次の 位は 残りの ${m - 1}通り。`,
        '樹形図《じゅけいず》を かくか、位ごとの 通りの 数を かけよう。',
      ],
      zero
        ? `いちばん 上の 位は 0以外の ${m - 1}通り、残りの 位は 残った カードから 選ぶので、${m - 1} × ${P(m - 1, k - 1)} ＝ ${ans}（通り）。`
        : `${Array.from({ length: k }, (_, i) => m - i).join(' × ')} ＝ ${ans}（通り）。`,
      [
        [zero ? P(m, k) : null, 'zero-lead'],
        [m ** k, 'reuse'],
        [zero ? null : C(m, k), 'order-ignored'],
      ],
    );
  }
  if (rng.next() < 0.5) {
    const ctx = pick(rng, LINE_CTX);
    const n = rng.int(3, 5);
    const ans = fact(n);
    return numItem(
      'perm',
      level,
      false,
      `${ctx.id}:${n}`,
      ctx.text(n),
      undefined,
      ans,
      [
        '1番目が 決まった とき、2番目は 何通りかな。樹形図《じゅけいず》を かいて みよう。',
        `1番目は ${n}通り、2番目は 残りの ${n - 1}通り…`,
        `${Array.from({ length: n }, (_, i) => n - i).join(' × ')}を 計算しよう。`,
      ],
      `1番目は ${n}通り、2番目は ${n - 1}通り…と 1つずつ 減るので、${Array.from({ length: n }, (_, i) => n - i).join(' × ')} ＝ ${ans}（通り）。`,
      [
        [n ** n, 'reuse'],
        [(n * (n + 1)) / 2, 'add-instead'],
      ],
    );
  }
  const ctx = pick(rng, PICK_CTX);
  const n = rng.int(3, 8);
  const ans = P(n, 2);
  return numItem(
    'perm',
    level,
    false,
    `${ctx.id}:${n}`,
    ctx.text(n),
    undefined,
    ans,
    [
      '1つめ（班長・1位・1番目）が 決まった とき、2つめは 何通りかな。',
      `1つめは ${n}通り、2つめは 残りの ${n - 1}通り。`,
      `${n} × ${n - 1}を 計算しよう。`,
    ],
    `1つめが ${n}通り、それぞれに 2つめが ${n - 1}通り あるので、${n} × ${n - 1} ＝ ${ans}（通り）。役わりが ちがうので、AとBの 入れかえは 別の 場合です。`,
    [
      [C(n, 2), 'order-ignored'],
      [n + n - 1, 'add-instead'],
      [n * n, 'reuse'],
    ],
  );
}

// ---- 組み合わせ ----
/** 組み合わせの 定義域（場面 × 数。均等に 選ぶ） */
const COMB_DOMAIN: { kind: 'league' | 'pick2' | 'pick3'; ctx: string; n: number }[] = [
  ...[3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ kind: 'league' as const, ctx: 'team', n })),
  ...['ice', 'hand', 'card'].flatMap((ctx) =>
    [3, 4, 5, 6, 7, 8, 9].map((n) => ({ kind: 'pick2' as const, ctx, n })),
  ),
  ...['fruit', 'color', 'member'].flatMap((ctx) =>
    [4, 5, 6, 7].map((n) => ({ kind: 'pick3' as const, ctx, n })),
  ),
];
function leagueFig(n: number): Figure {
  const ns = NAMES.slice(0, n);
  return {
    kind: 'table',
    header: ['', ...ns],
    rows: ns.map((r, i) => [r, ...ns.map((_, j) => (i === j ? '＼' : ''))]),
  };
}

function combItem(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const n = rng.int(3, 10);
    const ans = C(n, 2);
    return numItem(
      'comb',
      level,
      true,
      `table:${n}`,
      `${names(n)}の ${n}チームが、どの チームとも 1回ずつ 試合を します。表を 使って 調べよう。試合は 全部で 何試合 ありますか。`,
      leagueFig(n),
      ans,
      [
        '表の ます1つが 1つの 試合だよ。同じ チームどうしの ますは 使わないね。',
        'AとBの 試合と、BとAの 試合は 同じ 試合だよ。表の 半分だけ 数えよう。',
        `＼より 右上の ますを 数えよう。${Array.from({ length: n - 1 }, (_, i) => n - 1 - i).join(' ＋ ')}`,
      ],
      `＼より 右上の ますを 数えて ${Array.from({ length: n - 1 }, (_, i) => n - 1 - i).join(' ＋ ')} ＝ ${ans}（試合）。`,
      [
        [n * (n - 1), 'double-count'],
        [n * n, 'reuse'],
        [n - 1, 'add-instead'],
      ],
      '試合',
    );
  }
  const { kind, ctx, n } = pick(rng, COMB_DOMAIN);
  if (kind === 'pick3') {
    const ans = C(n, 3);
    return numItem(
      'comb',
      level,
      false,
      `pick3:${ctx}:${n}`,
      ctx === 'fruit'
        ? `${names(n)}の ${n}種類の くだものから、3種類を 選んで ジュースを 作ります。選び方は 全部で 何通り ありますか。`
        : ctx === 'color'
          ? `${n}色の 色えんぴつから 3色を 選んで、ポスターを ぬります。色の 選び方は 全部で 何通り ありますか。`
          : `${names(n)}の ${n}人から、3人の 係を 選びます（役わりの ちがいは ありません）。選び方は 全部で 何通り ありますか。`,
      undefined,
      ans,
      [
        '選ぶ 順番は 関係 ないね。{A、B、C} と {B、A、C} は 同じ 組み合わせだよ。',
        '選ばない ものに 注目すると 考えやすい ことも あるよ。',
        `並べ方 ${n} × ${n - 1} × ${n - 2}の 中に、同じ 組み合わせが 6通りずつ あるよ。`,
      ],
      `並べ方は ${P(n, 3)}通り。同じ 3つの 組み合わせが 3 × 2 × 1 ＝ 6通りずつ ふくまれるので、${P(n, 3)} ÷ 6 ＝ ${ans}（通り）。`,
      [
        [P(n, 3), 'double-count'],
        [n * 3, 'add-instead'],
      ],
    );
  }
  const ans = C(n, 2);
  const isLeague = kind === 'league';
  return numItem(
    'comb',
    level,
    false,
    `${kind}:${ctx}:${n}`,
    isLeague
      ? `${names(n)}の ${n}チームが、どの チームとも 1回ずつ 試合を します。試合は 全部で 何試合 ありますか。`
      : ctx === 'ice'
        ? `${n}種類の アイスから 2種類を 選びます。選び方は 全部で 何通り ありますか。`
        : ctx === 'hand'
          ? `${n}人が、どの 人とも 1回ずつ あく手を します。あく手の 組み合わせは 全部で 何通り ありますか。`
          : `${n}まいの ちがう カードから 2まいを 選びます。選び方は 全部で 何通り ありますか。`,
    undefined,
    ans,
    [
      isLeague ? 'AとBの 試合と、BとAの 試合は 同じだね。' : '選ぶ 順番は 関係 ないね。',
      isLeague
        ? `Aと 組む 相手は ${n - 1}通り、Bと 組む 相手で まだ 数えて いないのは ${n - 2}通り…`
        : `1つめと 組む 相手は ${n - 1}通り、2つめと 組む 相手で まだ 数えて いないのは ${n - 2}通り…`,
      `${Array.from({ length: n - 1 }, (_, i) => n - 1 - i).join(' ＋ ')}を 計算しよう。`,
    ],
    `${Array.from({ length: n - 1 }, (_, i) => n - 1 - i).join(' ＋ ')} ＝ ${ans}（${isLeague ? '試合' : '通り'}）。${n} × ${n - 1} ＝ ${n * (n - 1)}は、同じ 組を 2回ずつ 数えて います。`,
    [
      [n * (n - 1), 'double-count'],
      [n * n, 'reuse'],
      [n - 1, 'add-instead'],
    ],
    isLeague ? '試合' : '通り',
  );
}

// ---- かけ合わせ（コイン・メニュー） ----
function productItem(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt && rng.next() < 0.5) {
    // じゃんけん・2つの さいころ（1回ごとの 通りの 数が 2より 多い）
    const janken = rng.next() < 0.6;
    const k = janken ? rng.int(2, 3) : 2;
    const each = janken ? 3 : 6;
    const ans = each ** k;
    return numItem(
      'product',
      level,
      true,
      `${janken ? 'janken' : 'dice'}:${k}`,
      janken
        ? `${k}人で じゃんけんを 1回 します。グー・チョキ・パーの 出し方は、全部で 何通り ありますか（だれが 何を 出したかを 区別します）。`
        : '大小 2つの さいころを 同時に 投げます。目の 出方は 全部で 何通り ありますか。',
      undefined,
      ans,
      [
        janken
          ? '1人目の 出し方は 3通り。それぞれに 2人目の 出し方が 何通り あるかな。'
          : '大きい さいころの 目は 6通り。それぞれに 小さい さいころの 目が 何通り あるかな。',
        '表や 樹形図《じゅけいず》に かくと、かけ算で 求められると 分かるよ。',
        `${Array.from({ length: k }, () => String(each)).join(' × ')}を 計算しよう。`,
      ],
      `${Array.from({ length: k }, () => String(each)).join(' × ')} ＝ ${ans}（通り）。`,
      [
        [each * k, 'add-instead'],
        [janken ? null : 21, 'order-ignored'],
      ],
    );
  }
  if (alt) {
    const k = rng.int(2, 4);
    const ans = 2 ** k;
    return numItem(
      'product',
      level,
      true,
      `coin:${k}`,
      `1まいの コインを ${k}回 続けて 投げます。表《おもて》と 裏《うら》の 出方は 全部で 何通り ありますか。`,
      undefined,
      ans,
      [
        '1回目は 表《おもて》か 裏《うら》の 2通り。樹形図《じゅけいず》を かいて みよう。',
        '2回目も それぞれ 2通りに 分かれるね。',
        `2を ${k}回 かけよう。`,
      ],
      `1回ごとに 2通りずつ 分かれるので、${Array.from({ length: k }, () => '2').join(' × ')} ＝ ${ans}（通り）。`,
      [
        [2 * k, 'add-instead'],
        [k + 1, 'order-ignored'],
      ],
    );
  }
  const three = rng.next() < 0.5;
  const a = rng.int(2, three ? 4 : 5);
  const b = rng.int(2, three ? 4 : 6);
  const c = three ? rng.int(2, 3) : 1;
  const ans = a * b * c;
  return numItem(
    'product',
    level,
    false,
    `menu:${a}:${b}:${c}`,
    three
      ? `ランチで、主食《しゅしょく》を ${a}種類、おかずを ${b}種類、飲み物を ${c}種類の 中から 1つずつ 選びます。選び方は 全部で 何通り ありますか。`
      : `シャツが ${a}まい、ズボンが ${b}本 あります。シャツと ズボンを 1つずつ 選んで 着る 組み合わせは 何通り ありますか。`,
    undefined,
    ans,
    [
      '1つめを 決めた とき、2つめは 何通り あるかな。表や 樹形図《じゅけいず》に かいて みよう。',
      three
        ? `主食《しゅしょく》1つに つき、おかずは ${b}通り。`
        : `シャツ 1まいに つき、ズボンは ${b}通り。`,
      three ? `${a} × ${b} × ${c}を 計算しよう。` : `${a} × ${b}を 計算しよう。`,
    ],
    three ? `${a} × ${b} × ${c} ＝ ${ans}（通り）。` : `${a} × ${b} ＝ ${ans}（通り）。`,
    [
      [three ? a + b + c : a + b, 'add-instead'],
      [three ? a * b + c : null, 'add-instead'],
    ],
  );
}

// ---- 落ちなく 調べる ----
function listItem(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (!alt) {
    const n = rng.int(4, 5);
    const pairs: [number, number][] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
    const missIdx = rng.int(0, pairs.length - 1);
    const miss = pairs[missIdx]!;
    const listed = pairs.filter((_, i) => i !== missIdx);
    const pt = (p: [number, number]) => `${NAMES[p[0]]}と${NAMES[p[1]]}`;
    const dup = pick(rng, listed);
    const rev = pick(
      rng,
      listed.filter((p) => p !== dup),
    );
    return {
      engine: 'choice',
      id: `list:${n}:${pt(miss)}:${pt(dup)}:${pt(rev)}`,
      objective: 'list',
      level,
      prompt: `${names(n)}の ${n}人から 2人の 組を 作ります。組み合わせを 書き出しましたが、1つ 足りません。足りない 組は どれですか。`,
      figure: { kind: 'text', text: listed.map(pt).join('、 '), size: 'm' },
      hints: [
        'Aと 組む 人、Bと 組む 人…と 順に 調べよう。',
        'AとBと、BとAは 同じ 組だよ。',
        `Aを ふくむ 組は ${n - 1}つ、Bを ふくむ 組（Aとの 組を のぞく）は ${n - 2}つ…`,
      ],
      explain: `Aから 順に 調べると、${pt(miss)}が 書かれて いません。全部で ${pairs.length}組です。`,
      identity: `list:${n}:${pt(miss)}:${pt(dup)}:${pt(rev)}`,
      alt: false,
      options: opts(pt(miss), [
        [pt(dup), 'list-dup'],
        [`${NAMES[rev[1]]}と${NAMES[rev[0]]}`, 'double-count'],
      ]),
    };
  }
  // 並べ方を 書き出す（3人）
  const perms = ['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA'];
  const missIdx = rng.int(0, 5);
  const miss = perms[missIdx]!;
  const listed = perms.filter((_, i) => i !== missIdx);
  const dup = pick(rng, listed);
  const bad = pick(rng, ['AAB', 'ABB', 'BCC', 'CAA']);
  return {
    engine: 'choice',
    id: `list-alt:${miss}:${dup}:${bad}`,
    objective: 'list',
    level,
    prompt:
      'A、B、Cの 3人が 1列に 並ぶ 並び方を 書き出しましたが、1つ 足りません。足りない 並び方は どれですか。',
    figure: { kind: 'text', text: listed.join('、 '), size: 'l' },
    hints: [
      '先頭が Aの 並び方、Bの 並び方、Cの 並び方に 分けて 調べよう。',
      '先頭が 決まると、残りの 2人の 並び方は 2通りずつ あるよ。',
      '先頭ごとに 2つずつ あるか たしかめよう。',
    ],
    explain: `先頭ごとに 2通りずつ、全部で 6通り。${miss}が 書かれて いません。`,
    identity: `list:perm:${miss}:${dup}:${bad}`,
    alt: true,
    options: opts(miss, [
      [dup, 'list-dup'],
      [bad, 'reuse'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['list', 'product'] },
  { objs: ['perm', 'list', 'product'] },
  { objs: ['comb', 'perm'] },
  { objs: ['comb', 'perm', 'product', 'list'] },
];

export function generateCombinations(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'perm':
      return permItem(level, rng, alt);
    case 'comb':
      return combItem(level, rng, alt);
    case 'product':
      return productItem(level, rng, alt);
    case 'list':
      return listItem(level, rng, alt);
  }
}

export const combinations: UnitSpec = finishUnit({
  id: 'g6.math.combinations',
  title: '並べ方と 組み合わせ',
  stage: 'g6',
  subject: 'math',
  domain: 'D-data',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'g1m-dice',
  prereq: ['g4.math.two-way-table'],
  objectives: [
    { id: 'list', title: '落ちや 重なりが ないように 調べる' },
    { id: 'product', title: '選び方を かけ合わせる（樹形図）' },
    { id: 'perm', title: '並べ方' },
    { id: 'comb', title: '組み合わせ（順番を 区別しない）' },
  ],
  misconceptions: [
    {
      id: 'double-count',
      explain:
        '同じ 組を 2回 数えたのかな。組み合わせでは「AとB」と「BとA」は 同じ 1つの 組だよ。並べ方の 数を 重なりの 数で わろう。',
    },
    {
      id: 'order-ignored',
      explain:
        '順番の ちがいを 数えて いないのかな。班長と 副班長《ふくはんちょう》のように 役わりが ちがう ときは、AとBの 入れかえは 別の 場合だよ。',
    },
    {
      id: 'add-instead',
      explain:
        'たし算を したのかな。1つめの それぞれに 2つめが 何通りずつ あるので、かけ算で 考えよう。樹形図《じゅけいず》を かくと 分かるよ。',
    },
    {
      id: 'reuse',
      explain:
        '同じ ものを 2回 使ったのかな。1人（1まい）は 1回しか 使えないので、次は 残りの 数から 選ぶよ。',
    },
    {
      id: 'zero-lead',
      explain:
        'いちばん 上の 位に 0を 置いた 数も 数えたのかな。「012」は 3けたの 整数では ないね。',
    },
    {
      id: 'list-dup',
      explain:
        'もう 書いて ある ものを 選んだのかな。書き出す ときは、決まった 順番で 調べると 落ちや 重なりが なく なるよ。',
    },
  ],
  levels: [
    { label: '書き出す・かけ合わせる', chance: 0.1 },
    { label: '並べ方', chance: 0.05 },
    { label: '組み合わせ', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: 'A、B、Cの 3人が 1列に 並ぶ とき、先頭を 決めて 枝分かれの 図（樹形図《じゅけいず》）に かくと、落ちや 重なりが なく 調べられます。',
      figure: {
        kind: 'text',
        text: 'A ― B ― C　A ― C ― B　B ― A ― C　B ― C ― A　C ― A ― B　C ― B ― A',
        size: 'm',
      },
    },
    { text: '先頭は 3通り、2番目は 残りの 2通り、3番目は 1通り。3 × 2 × 1 ＝ 6通りです。' },
    {
      text: '4チームの 試合は、AとBの 試合と BとAの 試合が 同じなので、並べ方 4 × 3 ＝ 12を 2で わって 6試合。順番を 区別しない ものを 組み合わせと いいます。',
      figure: leagueFig(4),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateCombinations(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第6学年 D(2) 起こり得る場合（並べ方・組み合わせ）',
  revised: REVISED,
});
