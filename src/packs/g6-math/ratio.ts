/**
 * g6.math.ratio 比（比の値・等しい比・比を簡単にする・比の利用）（curriculum-matrix 3.9）。
 *
 * 比の値は約分した分数（整数になるときは整数）で答える（mustReduce）。比を簡単にする問題は「□:□」の2欄。
 * 同一性キー: 比と問いの組（a:b の入れかえは別の問題: 比は順序に意味がある）。文章題は 場面 × 数。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  dec,
  expr,
  finishUnit,
  fr,
  fracAns,
  gcd,
  opts,
  pick,
  pickObj,
  q,
  qText,
  REVISED,
  wrongList,
} from './util';

type Obj = 'value' | 'equal' | 'simplify' | 'use';

/** 互いに素の組 [a, b]（1〜9、a ≠ b） */
const COPRIME: [number, number][] = [];
for (let a = 1; a <= 9; a++)
  for (let b = 1; b <= 9; b++) if (a !== b && gcd(a, b) === 1) COPRIME.push([a, b]);

// ---- 比の値 ----
function valueItem(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const dk = rng.next() < 0.5;
    if (dk) {
      // 小数の比（0.a : 0.b、1.2 : 0.8 など）
      const [a, b] = pick(rng, COPRIME);
      const k = pick(rng, [1, 2, 3]);
      const x = a * k;
      const y = b * k;
      const ans = q(x, y);
      const answer = fracAns(ans);
      return {
        engine: 'number',
        id: `value-alt:${dec(x, 1)}:${dec(y, 1)}`,
        objective: 'value',
        level,
        prompt: `${dec(x, 1)} : ${dec(y, 1)} の 比の 値を 求めよう。分数で 答えよう。`,
        figure: expr(`${dec(x, 1)} : ${dec(y, 1)}`),
        hints: [
          '比の 値は、前の 数 ÷ 後ろの 数。',
          `${dec(x, 1)} ÷ ${dec(y, 1)}。両方を 10倍しても 値は 変わらないよ。`,
          `${x} ÷ ${y}を 分数で 表して、約分できるか 調べよう。`,
        ],
        explain: `${dec(x, 1)} ÷ ${dec(y, 1)} ＝ ${x} ÷ ${y} ＝ ${qText(ans)}。`,
        identity: `value:${dec(x, 1)}:${dec(y, 1)}`,
        alt: true,
        fields: [{ answer }],
        keys: ['fraction'],
        wrongAnswers: wrongList([answer], [[`${y}/${x}`, 'value-reverse']]),
      };
    }
    // 分数の比
    const [p, r] = pick(rng, [
      [1, 2],
      [1, 3],
      [2, 3],
      [1, 4],
      [3, 4],
      [2, 5],
      [3, 5],
      [5, 6],
    ] as const);
    const [s, t] = pick(rng, [
      [1, 2],
      [1, 3],
      [2, 3],
      [1, 4],
      [3, 4],
      [1, 6],
      [5, 6],
    ] as const);
    if (p * t === s * r) return valueItem(level, rng, false);
    const ans = q(p * t, r * s);
    const answer = fracAns(ans);
    return {
      engine: 'number',
      id: `value-alt:${p}/${r}:${s}/${t}`,
      objective: 'value',
      level,
      prompt: `${fr(p, r)} : ${fr(s, t)} の 比の 値を 求めよう。`,
      figure: expr(`${fr(p, r)} : ${fr(s, t)}`),
      hints: [
        '比の 値は、前の 数 ÷ 後ろの 数。',
        `${fr(p, r)} ÷ ${fr(s, t)} ＝ ${fr(p, r)} × ${fr(t, s)}`,
        '分子どうし・分母どうしを かけて、約分しよう。',
      ],
      explain: `${fr(p, r)} ÷ ${fr(s, t)} ＝ ${fr(p, r)} × ${fr(t, s)} ＝ ${qText(ans)}。`,
      identity: `value:${p}/${r}:${s}/${t}`,
      alt: true,
      fields: [{ answer }],
      keys: ['fraction'],
      wrongAnswers: wrongList(
        [answer],
        [
          [`${r * s}/${p * t}`, 'value-reverse'],
          [`${p}/${s}`, 'frac-num'],
        ],
      ),
    };
  }
  const a = rng.int(1, 20);
  let b = rng.int(1, 20);
  if (a === b) b = a === 20 ? 19 : a + 1;
  const ans = q(a, b);
  const answer = fracAns(ans);
  return {
    engine: 'number',
    id: `value:${a}:${b}`,
    objective: 'value',
    level,
    prompt: `${a} : ${b} の 比の 値を 求めよう。`,
    figure: expr(`${a} : ${b}`),
    hints: [
      '比の 値は、前の 数 ÷ 後ろの 数 だよ。',
      'わり算の 商は 分数で 表せるよ。たとえば 3 ÷ 25 ＝ [[3/25]]。',
      `${a} ÷ ${b}を 分数で 表して、約分できるか 調べよう。`,
    ],
    explain: `${a} : ${b} の 比の 値は ${a} ÷ ${b} ＝ ${qText(ans)}です。`,
    identity: `value:${a}:${b}`,
    alt: false,
    fields: [{ answer }],
    keys: ['fraction'],
    wrongAnswers: wrongList([answer], [[`${b}/${a}`, 'value-reverse']]),
  };
}

// ---- 等しい 比 ----
function equalItem(level: number, rng: Rng, alt: boolean): Item {
  const [a, b] = pick(rng, COPRIME);
  const k = rng.int(2, 9);
  if (alt) {
    const d = rng.int(1, 5);
    const wrongs: [string, string][] = [
      [`${a + d} : ${b + d}`, 'diff-same'],
      [`${b * k} : ${a * k}`, 'value-reverse'],
      [`${a * k} : ${b}`, 'one-side'],
    ];
    const it: ChoiceItem = {
      engine: 'choice',
      id: `equal-alt:${a}:${b}:${k}:${d}`,
      objective: 'equal',
      level,
      prompt: `${a} : ${b} と 等しい 比は どれですか。`,
      hints: [
        '等しい 比は、前と 後ろに 同じ 数を かけたり、同じ 数で わったり して 作るよ。',
        '比の 値が 同じか 調べても よいよ。',
        `${a}と ${b}の 両方に 同じ 数を かけた 比を さがそう。`,
      ],
      explain: `${a} : ${b} の 両方に ${k}を かけると ${a * k} : ${b * k}。比の 値は どちらも ${qText(q(a, b))}です。`,
      identity: `equal:pick:${a}:${b}:${k}`,
      alt: true,
      options: opts(`${a * k} : ${b * k}`, wrongs),
    };
    return it;
  }
  const form = rng.int(0, 3);
  // 0: a:b = ka:□   1: a:b = □:kb   2: ka:kb = a:□   3: ka:kb = □:b
  const [L, R, ans, wrongDiff, wrongRev] =
    form === 0
      ? [`${a} : ${b}`, `${a * k} : {{}}`, b * k, b + (a * k - a), a * k]
      : form === 1
        ? [`${a} : ${b}`, `{{}} : ${b * k}`, a * k, a + (b * k - b), b * k]
        : form === 2
          ? [`${a * k} : ${b * k}`, `${a} : {{}}`, b, b * k - (a * k - a), a]
          : [`${a * k} : ${b * k}`, `{{}} : ${b}`, a, a * k - (b * k - b), b];
  const answer = { kind: 'int' as const, value: ans };
  const mult = form < 2;
  return {
    engine: 'number',
    id: `equal:${form}:${a}:${b}:${k}`,
    objective: 'equal',
    level,
    prompt: '□に あてはまる 数を 求めよう。',
    figure: expr(`${L} ＝ ${R}`),
    hints: [
      mult
        ? 'わかって いる 方の 数が 何倍に なったか 見よう。'
        : 'わかって いる 方の 数が 何分の1に なったか 見よう。',
      mult
        ? `${form === 0 ? `${a} → ${a * k}` : `${b} → ${b * k}`} なので、${k}倍に なって いるね。`
        : `${form === 2 ? `${a * k} → ${a}` : `${b * k} → ${b}`} なので、${k}で わって いるね。`,
      mult ? `もう 一方の 数も ${k}倍に しよう。` : `もう 一方の 数も ${k}で わろう。`,
    ],
    explain: `${L} の 両方を ${mult ? `${k}倍` : `${k}で わる`}と ${R.replace('{{}}', String(ans))}。だから □は ${ans}です。`,
    identity: `equal:${form}:${a}:${b}:${k}`,
    alt: false,
    fields: [{ answer }],
    wrongAnswers: wrongList(
      [answer],
      [
        [wrongDiff, 'diff-same'],
        [wrongRev, 'value-reverse'],
      ],
    ),
  };
}

// ---- 比を 簡単に する ----
function simplifyItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const [a, b] = pick(rng, COPRIME);
  let shown: string;
  let key: string;
  let cands: [string | null, string][];
  let hints: [string, string, string];
  let explain: string;
  if (!alt) {
    const k = pick(rng, [2, 3, 4, 5, 6, 8, 9, 10, 12]);
    const x = a * k;
    const y = b * k;
    shown = `${x} : ${y}`;
    key = `int:${x}:${y}`;
    const part = [2, 3, 4, 5, 6].find((p) => k % p === 0 && p < k);
    cands = [
      part ? [`${x / part}|${y / part}`, 'not-simplest'] : null,
      [`${b}|${a}`, 'value-reverse'],
    ].filter((c): c is [string, string] => c !== null);
    hints = [
      '前と 後ろを、同じ 数で わろう。',
      `${x}と ${y}の 最大公約数《さいだいこうやくすう》で わると 一度で できるよ。`,
      `${x}と ${y}は どちらも ${k}で わり切れるね。`,
    ];
    explain = `${x}と ${y}を ${k}で わって ${a} : ${b}。これ以上 同じ 数で われない 比に します。`;
  } else if (rng.next() < 0.5) {
    const k = pick(rng, [1, 2, 3]);
    const x = a * k;
    const y = b * k;
    shown = `${dec(x, 1)} : ${dec(y, 1)}`;
    key = `dec:${x}:${y}`;
    cands = [k > 1 ? [`${x}|${y}`, 'not-simplest'] : null, [`${b}|${a}`, 'value-reverse']].filter(
      (c): c is [string, string] => c !== null,
    );
    hints = [
      '小数の 比は、まず 10倍して 整数の 比に しよう。',
      `${dec(x, 1)}と ${dec(y, 1)}を それぞれ 10倍しよう。`,
      k > 1
        ? `10倍すると ${x} : ${y}。${x}と ${y}を ${k}で わろう。`
        : '10倍した 整数の 比が、これ以上 同じ 数で われないか たしかめよう。',
    ];
    explain = `10倍して ${x} : ${y}${k > 1 ? `、${k}で わって ${a} : ${b}` : ''}。`;
  } else {
    const [p, r, s, t] = pick(rng, [
      [1, 2, 1, 3],
      [2, 3, 1, 2],
      [3, 4, 1, 2],
      [1, 4, 1, 6],
      [2, 5, 1, 2],
      [5, 6, 2, 3],
      [3, 4, 2, 3],
      [1, 3, 1, 4],
      [3, 5, 1, 2],
      [5, 8, 3, 4],
    ] as const);
    const L = (r * t) / gcd(r, t);
    const x = (p * L) / r;
    const y = (s * L) / t;
    const g = gcd(x, y);
    shown = `${fr(p, r)} : ${fr(s, t)}`;
    key = `frac:${p}/${r}:${s}/${t}`;
    cands = [
      [`${p}|${s}`, 'frac-num'],
      [`${y / g}|${x / g}`, 'value-reverse'],
    ];
    hints = [
      '分数の 比は、分母の 公倍数《こうばいすう》を かけて 整数の 比に しよう。',
      `${r}と ${t}の 最小公倍数《さいしょうこうばいすう》は ${L}。両方に ${L}を かけよう。`,
      `${fr(p, r)} × ${L}と ${fr(s, t)} × ${L}を 計算して、さらに 同じ 数で われないか たしかめよう。`,
    ];
    explain = `両方に ${L}を かけて ${x} : ${y}${g > 1 ? `、${g}で わって ${x / g} : ${y / g}` : ''}。`;
    const answer0 = { kind: 'int' as const, value: x / g };
    const answer1 = { kind: 'int' as const, value: y / g };
    return {
      engine: 'number',
      id: `simplify-alt:${key}`,
      objective: 'simplify',
      level,
      prompt: `${shown} を、いちばん 小さい 整数の 比に しよう。`,
      figure: expr(`${shown} ＝ {{}} : {{}}`),
      hints,
      explain,
      identity: `simplify:${key}`,
      alt: true,
      fields: [{ answer: answer0 }, { answer: answer1 }],
      wrongAnswers: wrongList([answer0, answer1], cands),
    };
  }
  const answer0 = { kind: 'int' as const, value: a };
  const answer1 = { kind: 'int' as const, value: b };
  return {
    engine: 'number',
    id: `simplify${alt ? '-alt' : ''}:${key}`,
    objective: 'simplify',
    level,
    prompt: `${shown} を、いちばん 小さい 整数の 比に しよう。`,
    figure: expr(`${shown} ＝ {{}} : {{}}`),
    hints,
    explain,
    identity: `simplify:${key}`,
    alt,
    fields: [{ answer: answer0 }, { answer: answer1 }],
    wrongAnswers: wrongList([answer0, answer1], cands),
  };
}

// ---- 比の 利用（場面 8） ----
interface Scene {
  id: string;
  /** whole: 全体から 一方を求める。part: 一方から 他方を求める */
  type: 'whole' | 'part';
  names: [string, string];
  unit: string;
  /** a:b、全体（または 分かっている 方の 量）v */
  text: (a: number, b: number, v: number) => string;
}
const SCENES: Scene[] = [
  {
    id: 'ribbon',
    type: 'whole',
    names: ['姉', '妹'],
    unit: 'cm',
    text: (a, b, v) =>
      `長さ ${v}cmの リボンを、姉と 妹の 長さの 比が ${a} : ${b}に なるように 分けます。姉の リボンは 何cmですか。`,
  },
  {
    id: 'class',
    type: 'whole',
    names: ['男子', '女子'],
    unit: '人',
    text: (a, b, v) =>
      `${v}人の 学年で、男子と 女子の 人数の 比は ${a} : ${b}です。男子は 何人ですか。`,
  },
  {
    id: 'money',
    type: 'whole',
    names: ['兄', '弟'],
    unit: '円',
    text: (a, b, v) =>
      `${v}円を、兄と 弟で ${a} : ${b}に なるように 分けます。兄は 何円に なりますか。`,
  },
  {
    id: 'beads',
    type: 'whole',
    names: ['赤', '白'],
    unit: 'こ',
    text: (a, b, v) =>
      `赤と 白の ビーズが 合わせて ${v}こ あり、赤と 白の こ数の 比は ${a} : ${b}です。赤は 何こですか。`,
  },
  {
    id: 'juice',
    type: 'part',
    names: ['ジュース', '水'],
    unit: 'mL',
    text: (a, b, v) =>
      `ジュースと 水を ${a} : ${b}の 比で まぜて 飲み物を 作ります。水を ${v}mL 使うと、ジュースは 何mL いりますか。`,
  },
  {
    id: 'rect',
    type: 'part',
    names: ['縦', '横'],
    unit: 'cm',
    text: (a, b, v) =>
      `縦《たて》と 横の 長さの 比が ${a} : ${b}の 長方形が あります。横が ${v}cmの とき、縦《たて》は 何cmですか。`,
  },
  {
    id: 'flour',
    type: 'part',
    names: ['砂糖', '小麦粉'],
    unit: 'g',
    text: (a, b, v) =>
      `クッキーを 作るのに、砂糖と 小麦粉を ${a} : ${b}の 比で 使います。小麦粉を ${v}g 使う とき、砂糖は 何g いりますか。`,
  },
  {
    id: 'shadow',
    type: 'part',
    names: ['高さ', 'かげ'],
    unit: 'm',
    text: (a, b, v) =>
      `同じ 時こくに、ものの 高さと かげの 長さの 比が どれも ${a} : ${b}でした。木の かげの 長さが ${v}mの とき、木の 高さは 何mですか。`,
  },
];

function applyItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const [a, b] = pick(
    rng,
    COPRIME.filter(([x, y]) => x + y <= 12),
  );
  const m =
    sc.id === 'money'
      ? rng.int(2, 9) * 100
      : sc.id === 'juice' || sc.id === 'flour'
        ? rng.int(2, 12) * 10
        : rng.int(2, 12);
  const v = sc.type === 'whole' ? (a + b) * m : b * m;
  const ans = a * m;
  const answer = { kind: 'int' as const, value: ans };
  const fig: Figure | undefined = alt
    ? sc.type === 'whole'
      ? {
          kind: 'tape',
          parts: [
            { length: a, label: `${sc.names[0]} ？`, tone: 'focus' },
            { length: b, label: sc.names[1], tone: 'b' },
          ],
          total: `${v}${sc.unit}`,
        }
      : {
          kind: 'table',
          header: ['', sc.names[0], sc.names[1]],
          rows: [
            ['比', String(a), String(b)],
            [`量（${sc.unit}）`, '？', String(v)],
          ],
        }
    : undefined;
  return {
    engine: 'number',
    id: `use${alt ? '-alt' : ''}:${sc.id}:${a}:${b}:${v}`,
    objective: 'use',
    level,
    prompt: `${sc.text(a, b, v)}${alt ? '図を 見て 考えよう。' : ''}`,
    figure: fig,
    hints:
      sc.type === 'whole'
        ? [
            `全体を ${a} ＋ ${b} ＝ ${a + b}と 見よう。`,
            `${sc.names[0]}は 全体の [[${a}/${a + b}]]。`,
            `${v} × [[${a}/${a + b}]]を 計算しよう。`,
          ]
        : [
            `${sc.names[1]}が ${b}の とき ${v}${sc.unit}。${b}が 何倍に なったか 考えよう。`,
            `${v} ÷ ${b} ＝ ${m}で、${m}倍。`,
            `${sc.names[0]}も ${a}の ${m}倍に しよう。`,
          ],
    explain:
      sc.type === 'whole'
        ? `${sc.names[0]}は 全体の [[${a}/${a + b}]]なので、${v} × [[${a}/${a + b}]] ＝ ${ans}（${sc.unit}）。`
        : `${a} : ${b} ＝ □ : ${v}。${b} × ${m} ＝ ${v}なので、□ ＝ ${a} × ${m} ＝ ${ans}（${sc.unit}）。`,
    identity: `use:${sc.id}:${a}:${b}:${v}${alt ? ':fig' : ''}`,
    alt,
    fields: [{ label: sc.unit, answer }],
    wrongAnswers: wrongList(
      [answer],
      sc.type === 'whole'
        ? [
            [(v * a) % b === 0 ? (v * a) / b : null, 'part-whole'],
            [v - ans === ans ? null : v - ans, 'value-reverse'],
            [v / (a + b), 'part-whole'],
          ]
        : [
            [v + (a - b) > 0 ? v + (a - b) : null, 'diff-same'],
            [(v * b) % a === 0 ? (v * b) / a : null, 'value-reverse'],
          ],
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['value', 'equal'] },
  { objs: ['simplify', 'equal', 'value'] },
  { objs: ['use', 'simplify'] },
  { objs: ['use', 'simplify', 'equal', 'value'] },
];

export function generateRatio(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'value':
      return valueItem(level, rng, alt);
    case 'equal':
      return equalItem(level, rng, alt);
    case 'simplify':
      return simplifyItem(level, rng, alt);
    case 'use':
      return applyItem(level, rng, alt);
  }
}

export const ratio: UnitSpec = finishUnit({
  id: 'g6.math.ratio',
  title: '比',
  stage: 'g6',
  subject: 'math',
  domain: 'C-measure',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-compare',
  prereq: ['g5.math.fraction-equiv'],
  objectives: [
    { id: 'value', title: '比の 値' },
    { id: 'equal', title: '等しい 比' },
    { id: 'simplify', title: '比を 簡単に する' },
    { id: 'use', title: '比の 利用（文章題）' },
  ],
  misconceptions: [
    {
      id: 'diff-same',
      explain:
        '前と 後ろの 数の「差」が 同じに なるように したのかな。等しい 比は、両方に 同じ 数を かけたり、同じ 数で わったり して 作るよ。',
    },
    {
      id: 'value-reverse',
      explain:
        '前と 後ろを 反対に したのかな。比の 値は「前の 数 ÷ 後ろの 数」。何と 何の 比か、順番を たしかめよう。',
    },
    {
      id: 'one-side',
      explain:
        '片方だけに かけたのかな。等しい 比を 作る ときは、前と 後ろの 両方に 同じ 数を かけるよ。',
    },
    {
      id: 'not-simplest',
      explain:
        'まだ 同じ 数で われるよ。前と 後ろの 数が どちらも わり切れる 数が ない ところまで 簡単に しよう。',
    },
    {
      id: 'frac-num',
      explain:
        '分子だけを 比べたのかな。分母が ちがう 分数は そのままでは 比べられないね。分母の 公倍数《こうばいすう》を かけて 整数に しよう。',
    },
    {
      id: 'part-whole',
      explain:
        '全体の 量を 一方の 量と 取りちがえたのかな。a : bに 分ける とき、全体は a ＋ bに あたるよ。テープ図に かいて たしかめよう。',
    },
  ],
  levels: [
    { label: '比の 値・等しい 比', chance: 0.02 },
    { label: '比を 簡単に する', chance: 0.02 },
    { label: '比の 利用', chance: 0.02 },
    { label: 'まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: 'ジュース 2はいと 水 3ばいを まぜる とき、量の 割合を 2 : 3（二 対 三）と 表します。これを 比と いいます。',
      figure: {
        kind: 'tape',
        parts: [
          { length: 2, label: 'ジュース 2', tone: 'a' },
          { length: 3, label: '水 3', tone: 'b' },
        ],
      },
    },
    {
      text: 'a : bの 比の 値は a ÷ b。2 : 3の 比の 値は [[2/3]]です。',
      figure: expr('2 : 3 → [[2/3]]'),
    },
    {
      text: '比の 値が 等しい 比を 等しい 比と いい、＝で 結びます。前と 後ろに 同じ 数を かけても、同じ 数で わっても 等しい 比に なります。',
      figure: expr('2 : 3 ＝ 4 : 6 ＝ 8 : 12'),
    },
    {
      text: '比を 簡単に するとは、等しい 比の うち できるだけ 小さい 整数の 比に すること。12 : 18 ＝ 2 : 3。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateRatio(level, rng, index),
  },
  review: 'type',
  basis: '小学校学習指導要領（平成29年告示）算数 第6学年 C(1) 比（比の値、等しい比、比の利用）',
  revised: REVISED,
});
