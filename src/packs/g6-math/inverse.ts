/**
 * g6.math.inverse 反比例（curriculum-matrix 3.9）。
 * 表（x × y が一定）→ 式 y ＝ 決まった数 ÷ x → 比例・反比例の見分け → 反比例を使った問題。
 *
 * 同一性キー: 場面 × 決まった数 × 問う所。見分ける問題は 場面（文）または 表の数。
 * 注意: 反比例のグラフ（曲線）は graph エンジンで描けないので扱わない（要望: 点をとって結ぶ関数のグラフ）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, finishUnit, opts, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'table' | 'formula' | 'judge' | 'use';

const divisors = (c: number) => Array.from({ length: c }, (_, i) => i + 1).filter((d) => c % d === 0);

interface Ctx {
  id: string;
  x: string;
  xu: string;
  y: string;
  yu: string;
  cs: number[];
  text: (c: number) => string;
}
const CTXS: Ctx[] = [
  { id: 'rect', x: '縦《たて》の 長さ', xu: 'cm', y: '横の 長さ', yu: 'cm', cs: [12, 18, 20, 24, 30, 36, 48], text: (c) => `面積が ${c}cm²の 長方形の 縦《たて》と 横の 長さを 調べます。` },
  { id: 'tank', x: '1分間に 入れる 水の 量', xu: 'L', y: 'かかる 時間', yu: '分', cs: [24, 30, 36, 40, 48, 60], text: (c) => `${c}Lの 水そうを 水で いっぱいに します。` },
  { id: 'trip', x: '時速', xu: 'km', y: 'かかる 時間', yu: '時間', cs: [12, 18, 24, 30, 36, 60], text: (c) => `${c}kmの 道のりを 進みます。` },
  { id: 'share', x: '人数', xu: '人', y: '1人分の 枚数《まいすう》', yu: '枚', cs: [24, 30, 36, 40, 48, 60, 72], text: (c) => `${c}枚の 色紙を 何人かで 同じ 数ずつ 分けます。` },
];
const head = (t: Ctx) => [`x ${t.x}（${t.xu}）`, `y ${t.y}（${t.yu}）`] as const;
function tableFig(t: Ctx, xs: number[], ys: (number | string)[]): Figure {
  const [hx, hy] = head(t);
  return { kind: 'table', header: [hx, ...xs.map(String)], rows: [[hy, ...ys.map(String)]] };
}

// ---- 表 ----
function tableItem(level: number, rng: Rng, alt: boolean): Item {
  const t = pick(rng, CTXS);
  const c = pick(rng, t.cs);
  const ds = divisors(c).filter((d) => d <= 12);
  if (alt) {
    const m = pick(rng, [2, 3, 4]);
    const it: ChoiceItem = {
      engine: 'choice',
      id: `table-alt:${t.id}:${c}:${m}`,
      objective: 'table',
      level,
      prompt: `${t.text(c)}${t.x}を x${t.xu}、${t.y}を y${t.yu}と します。x の 値が ${m}倍に なると、y の 値は どう なりますか。`,
      figure: tableFig(t, ds.slice(0, 5), ds.slice(0, 5).map((d) => c / d)),
      hints: ['表で、x が 2倍に なる ところを さがして、y が どう なるか 見よう。', `x × y は いつも ${c}だね。`, `x が ${m}倍に なっても x × y は ${c}の まま。y は どう なるかな。`],
      explain: `y は x に 反比例して いるので、x が ${m}倍に なると、y は [[1/${m}]]に なります。`,
      identity: `table:times:${t.id}:${c}:${m}`,
      alt: true,
      options: opts(`[[1/${m}]]に なる`, [
        [`${m}倍に なる`, 'as-proportion'],
        [`${m} へる`, 'sum-const'],
        ['変わらない', 'sum-const'],
      ]),
    };
    return it;
  }
  const picks = rng.next() < 0.5 ? ds.slice(0, 2) : [ds[0]!, ds[2] ?? ds[1]!];
  const rest = ds.filter((d) => !picks.includes(d));
  const ax = pick(rng, rest);
  const xs = [...picks, ax].sort((a, b) => a - b);
  const ans = c / ax;
  const answer = { kind: 'int' as const, value: ans };
  const [x1] = picks;
  const y1 = c / x1!;
  return {
    engine: 'number',
    id: `table:${t.id}:${c}:${picks.join(',')}:${ax}`,
    objective: 'table',
    level,
    prompt: `${t.text(c)}y は x に 反比例します。表の ？に あてはまる 数を 求めよう。`,
    figure: tableFig(t, xs, xs.map((x) => (x === ax ? '？' : c / x))),
    hints: [
      '反比例では、x が 2倍、3倍…に なると、y は [[1/2]]、[[1/3]]…に なるよ。',
      `x × y は いつも 同じ 数。${x1} × ${y1} ＝ ${c}。`,
      `x が ${ax}の とき、${ax} × y ＝ ${c}。`,
    ],
    explain: `x × y は いつも ${c}なので、y ＝ ${c} ÷ ${ax} ＝ ${ans}です。`,
    identity: `table:${t.id}:${c}:${picks.join(',')}:${ax}`,
    alt: false,
    fields: [{ label: t.yu, answer }],
    wrongAnswers: wrongList(
      [answer],
      [
        [(y1 * ax) % x1! === 0 ? (y1 * ax) / x1! : null, 'as-proportion'],
        [x1! + y1 - ax > 0 ? x1! + y1 - ax : null, 'sum-const'],
      ],
    ),
  };
}

// ---- 式 ----
function formulaItem(level: number, rng: Rng, alt: boolean): Item {
  const t = pick(rng, CTXS);
  const c = pick(rng, t.cs);
  const ds = divisors(c).filter((d) => d <= 12);
  if (alt) {
    const xs = rng.next() < 0.5 ? ds.slice(1, 4) : ds.slice(2, 5);
    const answer = { kind: 'int' as const, value: c };
    const it: NumberItem = {
      engine: 'number',
      id: `formula-alt:${t.id}:${c}:${xs.join(',')}`,
      objective: 'formula',
      level,
      prompt: '表の y は x に 反比例して います。y ＝ 決まった数 ÷ x の 式に 表す とき、決まった数は いくつですか。',
      figure: tableFig(t, xs, xs.map((x) => c / x)),
      hints: ['反比例では、x × y が いつも 同じ 数に なるよ。', `x が ${xs[0]}の とき y は ${c / xs[0]!}。`, `${xs[0]} × ${c / xs[0]!}を 計算しよう。`],
      explain: `x × y ＝ ${xs[0]} × ${c / xs[0]!} ＝ ${c}。式は y ＝ ${c} ÷ x です。`,
      identity: `formula:k:${t.id}:${c}:${xs.join(',')}`,
      alt: true,
      fields: [{ answer }],
      wrongAnswers: wrongList(
        [answer],
        [
          [xs[0]! + c / xs[0]!, 'sum-const'],
          [(c / xs[0]!) % xs[0]! === 0 ? c / xs[0]! / xs[0]! : null, 'formula-mult'],
        ],
      ),
    };
    return it;
  }
  const it: ChoiceItem = {
    engine: 'choice',
    id: `formula:${t.id}:${c}`,
    objective: 'formula',
    level,
    prompt: `${t.text(c)}${t.x}を x${t.xu}、${t.y}を y${t.yu}と して、x と y の 関係を 式に 表すと どれですか。`,
    figure: tableFig(t, ds.slice(0, 4), ds.slice(0, 4).map((d) => c / d)),
    hints: ['反比例の 式は、y ＝ 決まった数 ÷ x の 形だよ。', '決まった数は x × y で 求められるね。', `${ds[1]} × ${c / ds[1]!} ＝ ${c}。`],
    explain: `x × y は いつも ${c}なので、y ＝ ${c} ÷ x です。`,
    identity: `formula:${t.id}:${c}`,
    alt: false,
    options: opts(`y ＝ ${c} ÷ x`, [
      [`y ＝ ${c} × x`, 'formula-mult'],
      [`y ＝ ${c} − x`, 'sum-const'],
      [`y ＝ x ÷ ${c}`, 'formula-mult'],
    ]),
  };
  return it;
}

// ---- 比例か 反比例か ----
type Rel = '比例' | '反比例' | 'どちらでもない';
const SCENES: { id: string; text: string; rel: Rel; mis: Partial<Record<Rel, string>> }[] = [
  { id: 'oil', text: '1Lの ねだんが 決まって いる 油の、量 xLと 代金 y円', rel: '比例', mis: { 反比例: 'as-proportion', どちらでもない: 'sum-const' } },
  { id: 'speed', text: '24kmの 道のりを 進む ときの、時速 xkmと かかる 時間 y時間', rel: '反比例', mis: { 比例: 'as-proportion', どちらでもない: 'sum-const' } },
  { id: 'age', text: '同じ 人の、年れい x才と 身長 ycm', rel: 'どちらでもない', mis: { 比例: 'as-proportion', 反比例: 'as-proportion' } },
  { id: 'area', text: '面積が 36cm²の 長方形の、縦《たて》 xcmと 横 ycm', rel: '反比例', mis: { 比例: 'as-proportion', どちらでもない: 'sum-const' } },
  { id: 'candy', text: '1こ 50円の あめを 買う ときの、こ数 xこと 代金 y円', rel: '比例', mis: { 反比例: 'as-proportion', どちらでもない: 'sum-const' } },
  { id: 'perim', text: 'まわりの 長さが 20cmの 長方形の、縦《たて》 xcmと 横 ycm', rel: 'どちらでもない', mis: { 反比例: 'sum-const', 比例: 'as-proportion' } },
  { id: 'share', text: '60枚の 色紙を 同じ 数ずつ 分ける ときの、人数 x人と 1人分の 枚数《まいすう》 y枚', rel: '反比例', mis: { 比例: 'as-proportion', どちらでもない: 'sum-const' } },
  { id: 'sqperim', text: '正方形の、1辺の 長さ xcmと まわりの 長さ ycm', rel: '比例', mis: { 反比例: 'as-proportion', どちらでもない: 'sum-const' } },
  { id: 'book', text: '100ページの 本の、読んだ ページ数《すう》 xページと 残りの ページ数《すう》 yページ', rel: 'どちらでもない', mis: { 反比例: 'sum-const', 比例: 'as-proportion' } },
  { id: 'fill', text: '決まった 量の 水を 入れる ときの、1分間に 入れる 量 xLと かかる 時間 y分', rel: '反比例', mis: { 比例: 'as-proportion', どちらでもない: 'sum-const' } },
  { id: 'sqarea', text: '正方形の、1辺の 長さ xcmと 面積 ycm²', rel: 'どちらでもない', mis: { 比例: 'as-proportion', 反比例: 'as-proportion' } },
  { id: 'circ', text: '円の、直径 xcmと 円周の 長さ ycm', rel: '比例', mis: { 反比例: 'as-proportion', どちらでもない: 'sum-const' } },
  { id: 'para', text: '面積が 24cm²の 平行四辺形の、底辺 xcmと 高さ ycm', rel: '反比例', mis: { 比例: 'as-proportion', どちらでもない: 'sum-const' } },
  { id: 'day', text: '1日の、昼の 長さ x時間と 夜の 長さ y時間', rel: 'どちらでもない', mis: { 反比例: 'sum-const', 比例: 'as-proportion' } },
  { id: 'walk', text: '同じ 速さで 歩く ときの、歩いた 時間 x分と 道のり ym', rel: '比例', mis: { 反比例: 'as-proportion', どちらでもない: 'sum-const' } },
  { id: 'gear', text: '歯数《はかず》が 決まった 歯車《はぐるま》と かみ合う、歯車《はぐるま》の 歯数《はかず》 xと 回る 回数 y', rel: '反比例', mis: { 比例: 'as-proportion', どちらでもない: 'sum-const' } },
];
const RELS: Rel[] = ['比例', '反比例', 'どちらでもない'];

function judgeItem(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (!alt) {
    const s = pick(rng, SCENES);
    return {
      engine: 'choice',
      id: `judge:${s.id}`,
      objective: 'judge',
      level,
      prompt: `次の 2つの 量 x、y の 関係は どれですか。\n${s.text}`,
      hints: [
        'x が 2倍、3倍に なると、y は どう なるかな。',
        '比例なら y も 2倍、3倍。反比例なら y は [[1/2]]、[[1/3]]。',
        '「和が 一定」や「x が 増えると y も 増えるが 倍には ならない」場合は どちらでもないよ。',
      ],
      explain: `${s.text}は、${s.rel === '比例' ? 'y ÷ x が 一定なので 比例です' : s.rel === '反比例' ? 'x × y が 一定なので 反比例です' : '比例でも 反比例でも ありません'}。`,
      identity: `judge:${s.id}`,
      alt: false,
      fixedOrder: true,
      options: RELS.map((r) => (r === s.rel ? { label: r, correct: true } : { label: r, misconception: s.mis[r] })),
    };
  }
  // 表の 数から 見分ける
  const rel = pick(rng, RELS);
  const k = pick(rng, [2, 3, 4, 5, 6]);
  const c = pick(rng, [12, 24, 36, 48, 60]);
  const s0 = rng.int(8, 14);
  const xs = [1, 2, 3, 4, 6];
  const ys = rel === '比例' ? xs.map((x) => x * k) : rel === '反比例' ? xs.map((x) => c / x) : xs.map((x) => s0 - x);
  const key = rel === '比例' ? `p${k}` : rel === '反比例' ? `i${c}` : `s${s0}`;
  return {
    engine: 'choice',
    id: `judge-alt:${key}`,
    objective: 'judge',
    level,
    prompt: '表の x と y の 関係は どれですか。',
    figure: { kind: 'table', header: ['x', ...xs.map(String)], rows: [['y', ...ys.map(String)]] },
    hints: ['x が 1から 2、3に なると、y は どう 変わるかな。', 'y ÷ x が 一定なら 比例、x × y が 一定なら 反比例だよ。', `x ＝ 2の とき、y ÷ x ＝ ${ys[1]} ÷ 2、x × y ＝ 2 × ${ys[1]}。`],
    explain:
      rel === '比例'
        ? `y ÷ x が いつも ${k}なので、y は x に 比例します。`
        : rel === '反比例'
          ? `x × y が いつも ${c}なので、y は x に 反比例します。`
          : `x ＋ y が いつも ${s0}で、y ÷ x も x × y も 一定では ないので、比例でも 反比例でも ありません。`,
    identity: `judge:table:${key}`,
    alt: true,
    fixedOrder: true,
    options: RELS.map((r) =>
      r === rel
        ? { label: r, correct: true }
        : { label: r, misconception: rel === 'どちらでもない' && r === '反比例' ? 'sum-const' : 'as-proportion' },
    ),
  };
}

// ---- 反比例を 使って ----
function applyItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const kind = pick(rng, ['speed', 'tank', 'share', 'book', 'gear', 'rect'] as const);
  let x1: number;
  let y1: number;
  let x2: number;
  let text: string;
  let unit: string;
  const pickPair = (c: number) => {
    const ds = divisors(c).filter((d) => d > 1 && d < c);
    const a = pick(rng, ds);
    let b = pick(rng, ds);
    if (b === a) b = ds[(ds.indexOf(a) + 1) % ds.length]!;
    return [a, b] as const;
  };
  switch (kind) {
    case 'speed': {
      const c = pick(rng, [60, 120, 180, 240]);
      [x1, x2] = pickPair(c);
      y1 = c / x1;
      text = `ある 道のりを 時速 ${x1}kmで 進むと ${y1}時間 かかります。時速 ${x2}kmで 進むと 何時間 かかりますか。`;
      unit = '時間';
      break;
    }
    case 'tank': {
      const c = pick(rng, [36, 48, 60, 72]);
      [x1, x2] = pickPair(c);
      y1 = c / x1;
      text = `水そうに 1分間に ${x1}Lずつ 水を 入れると、${y1}分で いっぱいに なります。1分間に ${x2}Lずつ 入れると、何分で いっぱいに なりますか。`;
      unit = '分';
      break;
    }
    case 'share': {
      const c = pick(rng, [36, 48, 60, 72, 96]);
      [x1, x2] = pickPair(c);
      y1 = c / x1;
      text = `色紙を ${x1}人で 分けると、1人 ${y1}枚ずつに なりました。同じ 色紙を ${x2}人で 分けると、1人 何枚ずつに なりますか。`;
      unit = '枚';
      break;
    }
    case 'book': {
      const c = pick(rng, [120, 180, 240]);
      [x1, x2] = pickPair(c);
      y1 = c / x1;
      text = `本を 1日に ${x1}ページずつ 読むと、${y1}日で 読み終わります。1日に ${x2}ページずつ 読むと、何日で 読み終わりますか。`;
      unit = '日';
      break;
    }
    case 'gear': {
      const c = pick(rng, [120, 180, 240]);
      const ds = divisors(c).filter((d) => d >= 10 && d <= 60);
      x1 = pick(rng, ds);
      x2 = pick(rng, ds.filter((d) => d !== x1));
      y1 = c / x1;
      text = `歯数《はかず》が ${x1}の 歯車《はぐるま》Aと、歯数《はかず》が ${x2}の 歯車《はぐるま》Bが かみ合って います。Aが ${y1}回 回る とき、Bは 何回 回りますか。`;
      unit = '回';
      break;
    }
    case 'rect': {
      const c = pick(rng, [24, 36, 48, 60]);
      [x1, x2] = pickPair(c);
      y1 = c / x1;
      text = `縦《たて》 ${x1}cm、横 ${y1}cmの 長方形と 面積が 同じで、縦《たて》が ${x2}cmの 長方形を 作ります。横は 何cmですか。`;
      unit = 'cm';
      break;
    }
  }
  const c = x1 * y1;
  const ans = c / x2;
  const answer = { kind: 'int' as const, value: ans };
  return {
    engine: 'number',
    id: `use${alt ? '-alt' : ''}:${kind}:${x1}:${y1}:${x2}`,
    objective: 'use',
    level,
    prompt: text,
    figure: alt
      ? {
          kind: 'table',
          header: ['x', String(x1), String(x2)],
          rows: [['y', String(y1), '？']],
        }
      : undefined,
    hints: [
      '一方が 増えると 他方が 減る 関係かな。x × y が 一定か 考えよう。',
      `${x1} × ${y1} ＝ ${c}。`,
      `${x2} × □ ＝ ${c}。`,
    ],
    explain: `x × y が いつも ${c}なので（反比例）、${c} ÷ ${x2} ＝ ${ans}（${unit}）です。`,
    identity: `use:${kind}:${x1}:${y1}:${x2}${alt ? ':table' : ''}`,
    alt,
    fields: [{ label: unit, answer }],
    wrongAnswers: wrongList(
      [answer],
      [
        [(y1 * x2) % x1 === 0 ? (y1 * x2) / x1 : null, 'as-proportion'],
        [x1 + y1 - x2 > 0 ? x1 + y1 - x2 : null, 'sum-const'],
      ],
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['table', 'judge'] },
  { objs: ['formula', 'table', 'judge'] },
  { objs: ['use', 'formula'] },
  { objs: ['use', 'judge', 'formula', 'table'] },
];

export function generateInverse(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'table':
      return tableItem(level, rng, alt);
    case 'formula':
      return formulaItem(level, rng, alt);
    case 'judge':
      return judgeItem(level, rng, alt);
    case 'use':
      return applyItem(level, rng, alt);
  }
}

export const inverse: UnitSpec = finishUnit({
  id: 'g6.math.inverse',
  title: '反比例',
  stage: 'g6',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'picture',
  prereq: ['g6.math.proportion'],
  objectives: [
    { id: 'table', title: '表で 反比例の 性質を 使う' },
    { id: 'formula', title: '反比例の 式 y ＝ 決まった数 ÷ x' },
    { id: 'judge', title: '比例・反比例を 見分ける' },
    { id: 'use', title: '反比例を 使った 問題' },
  ],
  misconceptions: [
    {
      id: 'as-proportion',
      explain:
        '比例と 同じように 考えたのかな。反比例では、x が 2倍、3倍に なると y は [[1/2]]、[[1/3]]に なるよ。x × y が いつも 同じか たしかめよう。',
    },
    {
      id: 'sum-const',
      explain:
        '「x が 増えた 分だけ y が 減る」と 考えたのかな。それは 和が 一定の 関係で、反比例では ないよ。反比例は x × y が 一定だね。',
    },
    { id: 'formula-mult', explain: '式の 形を まちがえたのかな。反比例の 式は y ＝ 決まった数 ÷ x。決まった数は x × y で 求めるよ。' },
  ],
  levels: [
    { label: '表・見分ける', chance: 0.1 },
    { label: '式', chance: 0.05 },
    { label: '反比例を 使う', chance: 0.05 },
    { label: 'まとめ', chance: 0.1 },
  ],
  intro: [
    {
      text: '面積が 12cm²の 長方形の 縦《たて》 xcmと 横 ycm。x が 2倍、3倍に なると、y は [[1/2]]、[[1/3]]に なります。このとき、y は x に 反比例すると いいます。',
      figure: tableFig(CTXS[0]!, [1, 2, 3, 4, 6], [12, 6, 4, 3, 2]),
    },
    { text: 'x × y は いつも 12（決まった数）。だから 式は y ＝ 12 ÷ x と 表せます。', figure: expr('y ＝ 12 ÷ x') },
    { text: '比例は y ÷ x が 一定、反比例は x × y が 一定。和が 一定の 関係は どちらでも ありません。' },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateInverse(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第6学年 C(1) 反比例',
  revised: REVISED,
});
