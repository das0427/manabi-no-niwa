/**
 * g5.math.decimal-shift 10倍・100倍・1000倍、1/10・1/100・1/1000（小数点の移動）（curriculum-matrix 3.8）。
 *
 * 数は「整数 v と 小数のけた数 p」で持つ（x = v ÷ 10^p。浮動小数点で計算しない）。
 * 同一性キー: もとの数 × 倍（10倍と 1/10 は別）。表し方を変えた問題（位の表・文章題・何倍かを選ぶ）は別のキー。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { decAns, expr, finishUnit, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'up' | 'down' | 'factor';

/** v × 10^s ÷ 10^p を、整数 m と けた数 q（m ÷ 10^q）にする（末尾の0をのぞく） */
function norm(v: number, q: number): [number, number] {
  while (q > 0 && v % 10 === 0) {
    v /= 10;
    q--;
  }
  while (q < 0) {
    v *= 10;
    q++;
  }
  return [v, q];
}
/** x ＝ v ÷ 10^p を 10^s 倍した数 */
const shifted = (v: number, p: number, s: number) => norm(v, p - s);
const show = ([v, q]: [number, number]) => {
  const s = String(v).padStart(q + 1, '0');
  return q > 0 ? `${s.slice(0, s.length - q)}.${s.slice(s.length - q)}` : s;
};

const POW = ['', '10', '100', '1000'];
const FRAC = ['', '[[1/10]]', '[[1/100]]', '[[1/1000]]'];

/** 位の表（百の位 〜 1/1000の位）に数字を入れた図 */
function placeTable(rows: [string, [number, number]][]): Figure {
  const header = [
    '',
    '百の位',
    '十の位',
    '一の位',
    '[[1/10]]の位',
    '[[1/100]]の位',
    '[[1/1000]]の位',
  ];
  return {
    kind: 'table',
    header,
    rows: rows.map(([label, [v, q]]) => {
      const cells = ['', '', '', '', '', ''];
      const s = String(v);
      for (let i = 0; i < s.length; i++) {
        // 右から i 番目の数字は 10^(i−q) の位。一の位は 列 2
        const col = 2 - (s.length - 1 - i - q);
        if (col >= 0 && col < 6) cells[col] = s[i]!;
      }
      // 一の位から 数字の ある 位までの 空いた 位に 0 を書く（0.045 の 0）
      const filled = cells.flatMap((c, i) => (c ? [i] : []));
      const lo = Math.min(2, ...filled);
      const hi = Math.max(2, ...filled);
      for (let i = lo; i <= hi; i++) if (!cells[i]) cells[i] = '0';
      return [label, ...cells];
    }),
  };
}

/** もとの数（定義域から均等に）: けた数 p は 0〜3、v は 0 で終わらない */
function pickNumber(rng: Rng, e: number, dir: 'up' | 'down'): [number, number] {
  for (;;) {
    const p = dir === 'up' ? rng.int(1, 3) : rng.int(0, 2);
    const digits = rng.int(1, 3);
    const v = rng.int(digits === 1 ? 1 : 10 ** (digits - 1), 10 ** digits - 1);
    if (v % 10 === 0) continue;
    const r = dir === 'up' ? shifted(v, p, e) : shifted(v, p, -e);
    // 答えの けた数は 3 まで、大きさは 10000 未満
    if (r[1] > 3 || r[0] / 10 ** r[1] >= 1000) continue;
    return [v, p];
  }
}

function wrongs(v: number, p: number, s: number, ans: [number, number]) {
  const dir = s > 0 ? 1 : -1;
  const e = Math.abs(s);
  return wrongList(
    [decAns(ans[0], ans[1])],
    [
      [show(shifted(v, p, s - dir)), 'shift-count'],
      [show(shifted(v, p, s + dir)), 'shift-count'],
      [show(shifted(v, p, -s)), 'shift-dir'],
      [show(norm(v, p)), 'no-shift'],
      [e > 1 ? show(shifted(v, p, dir)) : null, 'shift-count'],
    ],
  );
}

const SCENES_UP = [
  {
    id: 'paper',
    text: (x: string, k: string) => `1まい ${x}gの 紙が ${k}まい あります。全部で 何gですか。`,
    unit: 'g',
  },
  {
    id: 'juice',
    text: (x: string, k: string) => `1本 ${x}Lの ジュースが ${k}本 あります。全部で 何Lですか。`,
    unit: 'L',
  },
  {
    id: 'tape',
    text: (x: string, k: string) =>
      `1本 ${x}mの テープを ${k}本 つなぎます（重ならない）。全部で 何mですか。`,
    unit: 'm',
  },
  {
    id: 'coin',
    text: (x: string, k: string) => `1まい ${x}gの メダルが ${k}まい あります。全部で 何gですか。`,
    unit: 'g',
  },
];
const SCENES_DOWN = [
  {
    id: 'water',
    text: (x: string, k: string) => `${x}Lの 水を ${k}人で 同じ量ずつ 分けます。1人 何Lですか。`,
    unit: 'L',
  },
  {
    id: 'rope',
    text: (x: string, k: string) =>
      `${x}mの ロープを ${k}本に 同じ長さで 切ります。1本 何mですか。`,
    unit: 'm',
  },
  {
    id: 'sand',
    text: (x: string, k: string) =>
      `${x}kgの すなを ${k}ふくろに 同じ重さずつ 入れます。1ふくろ 何kgですか。`,
    unit: 'kg',
  },
  {
    id: 'sheet',
    text: (x: string, k: string) =>
      `${k}まい 重ねた 紙の あつさが ${x}cmでした。1まいの あつさは 何cmですか。`,
    unit: 'cm',
  },
];

function shiftItem(obj: 'up' | 'down', level: number, rng: Rng, alt: boolean): NumberItem {
  const e = level === 0 ? 1 : rng.int(1, 3);
  const [v, p] = pickNumber(rng, e, obj);
  const s = obj === 'up' ? e : -e;
  const xs = show(norm(v, p));
  const ans = shifted(v, p, s);
  const as = show(ans);
  const answers = [decAns(ans[0], ans[1])];
  const opText = obj === 'up' ? `${POW[e]}倍` : FRAC[e];
  const dirWord = obj === 'up' ? '右' : '左';
  // 表し方: 0 = 式、1 = 位の表、2 = 文章題
  const form = alt ? rng.int(1, 2) : 0;
  const sc = form === 2 ? pick(rng, obj === 'up' ? SCENES_UP : SCENES_DOWN) : null;
  const prompt =
    form === 0
      ? `${xs}を ${opText}${obj === 'up' ? 'した' : 'に した'} 数は いくつ？`
      : form === 1
        ? `位の 表を 見て 考えよう。${xs}を ${opText}${obj === 'up' ? 'した' : 'に した'} 数は いくつ？`
        : sc!.text(xs, POW[e]!);
  const figure: Figure | undefined =
    form === 0
      ? expr(obj === 'up' ? `${xs} × ${POW[e]} ＝ {{}}` : `${xs} ÷ ${POW[e]} ＝ {{}}`)
      : form === 1
        ? placeTable([[xs, norm(v, p)]])
        : undefined;
  const key = `${obj}:${xs}:${e}`;
  return {
    engine: 'number',
    id: `${obj}${form ? `-alt${form}` : ''}:${sc ? `${sc.id}:` : ''}${xs}:${e}`,
    objective: obj,
    level,
    prompt,
    figure,
    hints: [
      obj === 'up'
        ? '10倍すると、どの 数字も 位が 1つ 上がるよ。'
        : '[[1/10]]に すると、どの 数字も 位が 1つ 下がるよ。',
      `${opText}${obj === 'up' ? '' : 'に'}すると、小数点は ${dirWord}へ ${e}けた うつるよ。`,
      `${xs}の 小数点を ${dirWord}へ ${e}けた うつそう。けたが たりない ところには 0を 書くよ。`,
    ],
    explain: `${xs}を ${opText}${obj === 'up' ? '' : 'に'}すると、小数点が ${dirWord}へ ${e}けた うつって ${as}。（${xs} ${obj === 'up' ? '×' : '÷'} ${POW[e]} ＝ ${as}）`,
    explainFigure: placeTable([
      [xs, norm(v, p)],
      [as, ans],
    ]),
    identity: form === 0 ? key : `${key}:${form === 1 ? 'tbl' : `story:${sc!.id}`}`,
    alt: form !== 0,
    fields: [{ ...(sc ? { label: sc.unit } : {}), answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongs(v, p, s, ans),
  };
}

/** 何倍・何分の一か（alt: 選択肢で 何分の一かを 選ぶ） */
function factorItem(level: number, rng: Rng, alt: boolean): Item {
  const e = rng.int(1, 3);
  const [v, p] = pickNumber(rng, e, 'up');
  const small = show(norm(v, p));
  const big = show(shifted(v, p, e));
  if (alt) {
    const item: ChoiceItem = {
      engine: 'choice',
      id: `factor-alt:${big}:${e}`,
      objective: 'factor',
      level,
      prompt: `${small}は ${big}の 何分の一ですか。`,
      figure: placeTable([
        [big, shifted(v, p, e)],
        [small, norm(v, p)],
      ]),
      hints: [
        '同じ 数字の 位が いくつ 下がって いるかを 見よう。',
        '位が 1つ 下がると [[1/10]]、2つ 下がると [[1/100]]。',
        `${big}の 小数点を 左へ 何けた うつすと ${small}に なるかな。`,
      ],
      explain: `${big}の 小数点を 左へ ${e}けた うつすと ${small}。だから ${small}は ${big}の ${FRAC[e]}です。`,
      identity: `factor-frac:${big}:${e}`,
      alt: true,
      fixedOrder: true,
      options: [1, 2, 3]
        .map((k) =>
          k === e
            ? { label: FRAC[k]!, correct: true }
            : { label: FRAC[k]!, misconception: 'shift-count' },
        )
        .concat([{ label: `${POW[e]}倍`, misconception: 'shift-dir' }]),
    };
    return item;
  }
  const answers = [{ kind: 'int' as const, value: 10 ** e }];
  const item: NumberItem = {
    engine: 'number',
    id: `factor:${small}:${e}`,
    objective: 'factor',
    level,
    prompt: `${big}は ${small}の 何倍ですか。`,
    figure: expr(`${small} × {{}} ＝ ${big}`),
    hints: [
      '小数点が どちらへ 何けた うつって いるかを 見よう。',
      '小数点が 右へ 1けた うつると 10倍、2けた うつると 100倍だよ。',
      `${small}の 小数点を 右へ 何けた うつすと ${big}に なるかな。`,
    ],
    explain: `${small}の 小数点を 右へ ${e}けた うつすと ${big}。だから ${big}は ${small}の ${POW[e]}倍です。`,
    identity: `factor:${big}:${e}`,
    alt: false,
    fields: [{ label: '倍', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [e > 1 ? 10 ** (e - 1) : null, 'shift-count'],
      [e < 3 ? 10 ** (e + 1) : null, 'shift-count'],
      [e, 'shift-count'],
    ]),
  };
  return item;
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['up', 'down'] },
  { objs: ['up', 'down', 'factor'] },
  { objs: ['factor', 'up', 'down'] },
];

export function generateDecimalShift(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  if (obj === 'factor') return factorItem(level, rng, alt);
  return shiftItem(obj, level, rng, alt);
}

export const decimalShift: UnitSpec = finishUnit({
  id: 'g5.math.decimal-shift',
  title: '10倍・100倍と [[1/10]]・[[1/100]]（小数点の いどう）',
  stage: 'g5',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g4.math.decimal-add-sub'],
  objectives: [
    { id: 'up', title: '10倍・100倍・1000倍した 数' },
    { id: 'down', title: '[[1/10]]・[[1/100]]・[[1/1000]]に した 数' },
    { id: 'factor', title: '何倍か・何分の一かを 考える' },
  ],
  misconceptions: [
    {
      id: 'shift-count',
      explain:
        '小数点を うつす けたの 数が ちがったのかな。10倍は 1けた、100倍は 2けた、1000倍は 3けた。0の 数と 同じだけ うつそう。',
    },
    {
      id: 'shift-dir',
      explain:
        '小数点を 反対の 向きに うつしたのかな。10倍・100倍は 数が 大きく なるので 右へ、[[1/10]]・[[1/100]]は 小さく なるので 左へ うつすよ。',
    },
    {
      id: 'no-shift',
      explain:
        '0を つけたしただけで、小数点が うごいて いないのかな。小数の 後ろに 0を つけても 大きさは 変わらないよ。小数点の 位置を うつそう。',
    },
  ],
  levels: [
    { label: '10倍・[[1/10]]', chance: 0.02 },
    { label: '100倍・1000倍、[[1/100]]・[[1/1000]]', chance: 0.02 },
    { label: '何倍か・まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '2.35を 10倍すると、どの 数字も 位が 1つ 上がって 23.5に なります。小数点は 右へ 1けた うつります。',
      figure: placeTable([
        ['2.35', [235, 2]],
        ['23.5', [235, 1]],
      ]),
    },
    {
      text: '100倍すると 右へ 2けた、1000倍すると 右へ 3けた うつります。2.35 × 100 ＝ 235、2.35 × 1000 ＝ 2350（けたが たりない ところは 0を 書く）。',
      figure: expr('2.35 × 1000 ＝ 2350'),
    },
    {
      text: '[[1/10]]に すると、位が 1つ 下がって、小数点は 左へ 1けた うつります。[[1/100]]なら 左へ 2けた。4.6 ÷ 100 ＝ 0.046。',
      figure: placeTable([
        ['4.6', [46, 1]],
        ['0.046', [46, 3]],
      ]),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateDecimalShift(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第5学年 A(1) 整数・小数の記数法（10倍・100倍、1/10・1/100 などの大きさの数）',
  revised: REVISED,
});
