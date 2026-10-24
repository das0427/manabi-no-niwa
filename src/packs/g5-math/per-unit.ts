/**
 * g5.math.per-unit 単位量あたりの大きさ（こみぐあい・1あたり量・人口密度・ねだんくらべ）（curriculum-matrix 3.8）。
 *
 * 数は整数で持ち、答えが有限小数（2けたまで）に なる組だけを使う（浮動小数点で計算しない）。
 * 人口密度の数は「れいの データ」（本アプリが作った 架空の 町）。
 * 同一性キー: 到達項目 × 場面 × 数（2つを くらべる問題は、A・B の 入れかえを 同じとみる）。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceItem, ChoiceOption, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  dec,
  decAns,
  divText,
  doubleLine,
  finishUnit,
  pick,
  pickObj,
  REVISED,
  wrongList,
} from './util';

type Obj = 'crowd' | 'per1' | 'density' | 'price' | 'story';

const midAt = (part: number, whole: number) => Math.min(0.85, Math.max(0.12, part / whole));

// ---- 1あたり量（per1）と 1あたり量から（story）の場面 ----
interface PerScene {
  id: string;
  /** b ÷ a が 1あたり量 */
  text: (a: number, b: string) => string;
  aUnit: string; // svg 用（英字・数字だけ。無ければ空）
  bUnit: string; // 答えの欄
  aWord: string; // 「シートの まい数」
  bWord: string; // 「人数」
  aMax: number;
  qMax: number; // 1あたり量の 上限（10分の1 の いくつ分）
}
const PER_SCENES: PerScene[] = [
  {
    id: 'sheet',
    text: (a, b) => `シート ${a}まいに ${b}人 すわって います。シート 1まいあたり 何人ですか。`,
    aUnit: '',
    bUnit: '人',
    aWord: 'シートの まい数',
    bWord: '人数',
    aMax: 12,
    qMax: 60,
  },
  {
    id: 'car',
    text: (a, b) =>
      `ガソリン ${a}Lで ${b}km 走る 車が あります。ガソリン 1Lあたり 何km 走りますか。`,
    aUnit: 'L',
    bUnit: 'km',
    aWord: 'ガソリンの 量',
    bWord: '走る 道のり',
    aMax: 40,
    qMax: 250,
  },
  {
    id: 'field',
    text: (a, b) => `${a}aの 畑から ${b}kgの じゃがいもが とれました。1aあたり 何kgですか。`,
    aUnit: 'a',
    bUnit: 'kg',
    aWord: '畑の 広さ',
    bWord: 'とれた 重さ',
    aMax: 20,
    qMax: 400,
  },
  {
    id: 'wire',
    text: (a, b) => `${a}mで ${b}gの はり金が あります。この はり金 1mあたりの 重さは 何gですか。`,
    aUnit: 'm',
    bUnit: 'g',
    aWord: 'はり金の 長さ',
    bWord: '重さ',
    aMax: 15,
    qMax: 300,
  },
  {
    id: 'copy',
    text: (a, b) =>
      `${a}分《ふん》間で ${b}まい 印《いん》さつ できる 機《き》械《かい》が あります。1分《ふん》間あたり 何まいですか。`,
    aUnit: '',
    bUnit: 'まい',
    aWord: '時間',
    bWord: 'まい数',
    aMax: 12,
    qMax: 600,
  },
  {
    id: 'water',
    text: (a, b) =>
      `じゃ口から ${a}分《ふん》間に ${b}Lの 水が 出ました。1分《ふん》間あたり 何Lですか。`,
    aUnit: '',
    bUnit: 'L',
    aWord: '時間',
    bWord: '水の 量',
    aMax: 15,
    qMax: 200,
  },
];

/** 1あたり量 q（10分の1 の いくつ分）と いくつ分 a。b = a × q ÷ 10 が 整数に なる組から 均等に */
function pickPer(rng: Rng, aMax: number, qMax: number): { a: number; qv: number; b: number } {
  for (;;) {
    const a = rng.int(2, aMax);
    const qv = rng.int(11, qMax);
    if ((a * qv) % 10 !== 0) continue;
    return { a, qv, b: (a * qv) / 10 };
  }
}

function per1(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, PER_SCENES);
  const { a, qv, b } = pickPer(rng, sc.aMax, sc.qMax);
  const q = dec(qv, 1);
  const answers = [decAns(qv, 1)];
  const fig = alt
    ? doubleLine(
        [
          { at: 0, text: '0' },
          { at: midAt(1, a), text: '?' },
          { at: 1, text: String(b) },
        ],
        [
          { at: 0, text: '0' },
          { at: midAt(1, a), text: '1' },
          { at: 1, text: String(a) },
        ],
        `上が ${sc.bWord}、下が ${sc.aWord}の 数直線`,
        /^[A-Za-z]+$/.test(sc.bUnit) ? sc.bUnit : '',
        sc.aUnit,
      )
    : undefined;
  return {
    engine: 'number',
    id: `per1${alt ? '-alt' : ''}:${sc.id}:${a}:${b}`,
    objective: 'per1',
    level,
    prompt: alt
      ? `${sc.text(a, String(b))}（上が ${sc.bWord}、下が ${sc.aWord}の 数直線で 考えよう）`
      : sc.text(a, String(b)),
    figure: fig,
    hints: [
      `「1あたり」は、${sc.aWord}を 1に した ときの ${sc.bWord}だよ。`,
      `${sc.aWord}が ${a}から 1に なるので、${sc.bWord}も ${a}で わるよ。`,
      `式は ${b} ÷ ${a}。わりきれるまで 計算しよう。`,
    ],
    explain: `${b} ÷ ${a} ＝ ${q}。1あたり ${q}${sc.bUnit}です。（1あたり量 ＝ ${sc.bWord} ÷ ${sc.aWord}）`,
    explainFigure: doubleLine(
      [
        { at: 0, text: '0' },
        { at: midAt(1, a), text: q },
        { at: 1, text: String(b) },
      ],
      [
        { at: 0, text: '0' },
        { at: midAt(1, a), text: '1' },
        { at: 1, text: String(a) },
      ],
      `上が ${sc.bWord}、下が ${sc.aWord}の 数直線`,
    ),
    identity: `per1:${sc.id}:${a}:${b}${alt ? ':line' : ''}`,
    alt,
    fields: [{ label: sc.bUnit, answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [divText(a, b), 'div-swap'],
      [a * b, 'mul-instead'],
      [b - a, 'mul-instead'],
    ]),
  };
}

// ---- こみぐあい（crowd） ----
interface CrowdScene {
  id: string;
  name: (k: 'A' | 'B') => string;
  text: string;
  area: string; // 広さの 言い方（「まい数」「m²」）
  unitA: string; // 「まい」「m²」
  who: string; // 「人」「ひき」
  whoWord: string; // 「人数」「数」
  aRange: [number, number];
  pRange: [number, number];
}
const CROWD: CrowdScene[] = [
  {
    id: 'mat',
    name: (k) => `${k}の 部屋《へや》`,
    text: 'マットを しいた 2つの 部屋《へや》で 遊んで います。',
    area: 'マット',
    unitA: 'まい',
    who: '人',
    whoWord: '人数',
    aRange: [4, 16],
    pRange: [8, 40],
  },
  {
    id: 'rabbit',
    name: (k) => `${k}の 小屋《ごや》`,
    text: 'うさぎ小屋《ごや》が 2つ あります。',
    area: '広さ',
    unitA: 'm²',
    who: 'ひき',
    whoWord: 'うさぎの 数',
    aRange: [2, 10],
    pRange: [4, 24],
  },
  {
    id: 'pool',
    name: (k) => `${k}の プール`,
    text: '2つの プールで 泳《およ》いで いる 人が います。',
    area: '広さ',
    unitA: 'm²',
    who: '人',
    whoWord: '人数',
    aRange: [50, 200],
    pRange: [10, 60],
  },
  {
    id: 'garden',
    name: (k) => `${k}の 花だん`,
    text: '2つの 花だんに 花の なえを 植《う》えました。',
    area: '広さ',
    unitA: 'm²',
    who: '本',
    whoWord: 'なえの 数',
    aRange: [3, 12],
    pRange: [12, 60],
  },
];

/** 2つの 量の 組（密度が 有限小数 2けたまで・ちがう・広さも 数も ちがう） */
function pickTwo(
  rng: Rng,
  aRange: [number, number],
  pRange: [number, number],
): [[number, number], [number, number]] {
  for (;;) {
    const a1 = rng.int(...aRange);
    const a2 = rng.int(...aRange);
    const p1 = rng.int(...pRange);
    const p2 = rng.int(...pRange);
    if (a1 === a2 || p1 === p2) continue;
    if ((p1 * 100) % a1 !== 0 || (p2 * 100) % a2 !== 0) continue;
    if (p1 * a2 === p2 * a1) continue;
    return [
      [a1, p1],
      [a2, p2],
    ];
  }
}

/** A・B の 2択（正解は 1あたりの 量が 大きい／小さい ほう）。誤りの ほうに 誤概念を 付ける */
function twoOptions(
  correctIsA: boolean,
  wrongHasMoreTotal: boolean,
  names: [string, string],
): ChoiceOption[] {
  const wrongMis = wrongHasMoreTotal ? 'total-compare' : 'dir-swap';
  return [
    correctIsA ? { label: names[0], correct: true } : { label: names[0], misconception: wrongMis },
    correctIsA ? { label: names[1], misconception: wrongMis } : { label: names[1], correct: true },
  ];
}

function crowd(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const sc = pick(rng, CROWD);
  const [[a1, p1], [a2, p2]] = pickTwo(rng, sc.aRange, sc.pRange);
  const d1 = dec((p1 * 100) / a1, 2);
  const d2 = dec((p2 * 100) / a2, 2);
  const aIsMore = p1 * a2 > p2 * a1;
  const names: [string, string] = [sc.name('A'), sc.name('B')];
  const wrongHasMore = aIsMore ? p2 > p1 : p1 > p2;
  const key = [`${a1}/${p1}`, `${a2}/${p2}`].sort().join('|');
  const prompt = alt
    ? `${sc.text}表を 見て、こんで いるのは どちらか 考えよう。`
    : `${sc.text}${names[0]}は ${sc.area} ${a1}${sc.unitA}に ${p1}${sc.who}、${names[1]}は ${a2}${sc.unitA}に ${p2}${sc.who}です。こんで いるのは どちら？`;
  return {
    engine: 'choice',
    id: `crowd${alt ? '-alt' : ''}:${sc.id}:${a1}/${p1}|${a2}/${p2}`,
    objective: 'crowd',
    level,
    prompt,
    figure: alt
      ? {
          kind: 'table',
          header: ['', `${sc.area}（${sc.unitA}）`, sc.whoWord],
          rows: [
            [names[0], String(a1), String(p1)],
            [names[1], String(a2), String(p2)],
          ],
        }
      : undefined,
    hints: [
      `広さも ${sc.whoWord}も ちがうので、どちらか 一方だけでは くらべられないね。`,
      `1${sc.unitA}あたりの ${sc.whoWord}を 求めよう。${names[0]}は ${p1} ÷ ${a1}、${names[1]}は ${p2} ÷ ${a2}。`,
      `${names[0]}は 1${sc.unitA}あたり ${d1}${sc.who}。${names[1]}も 計算して、多い ほうが こんで いるよ。`,
    ],
    explain: `1${sc.unitA}あたりの ${sc.whoWord}は、${names[0]}が ${p1} ÷ ${a1} ＝ ${d1}、${names[1]}が ${p2} ÷ ${a2} ＝ ${d2}。1${sc.unitA}あたりの 数が 多い ${aIsMore ? names[0] : names[1]}の ほうが こんで います。`,
    identity: `crowd:${sc.id}:${key}${alt ? ':table' : ''}`,
    alt,
    fixedOrder: true,
    options: twoOptions(aIsMore, wrongHasMore, names),
  };
}

// ---- 人口密度（density。れいの データ） ----
const TOWNS = ['ア町《ちょう》', 'イ町《ちょう》', 'ウ町《ちょう》'];

function density(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    // 3つの 町の 人口密度を くらべる（人口が いちばん 多い 町は いちばん こんで いない）
    for (;;) {
      const areas = [rng.int(4, 60), rng.int(4, 60), rng.int(4, 60)];
      const dens = [rng.int(10, 120) * 10, rng.int(10, 120) * 10, rng.int(10, 120) * 10];
      const pops = areas.map((a, i) => a * dens[i]!);
      if (new Set(dens).size < 3 || new Set(pops).size < 3) continue;
      const top = dens.indexOf(Math.max(...dens));
      const bigPop = pops.indexOf(Math.max(...pops));
      if (top === bigPop) continue;
      // のこりの 1つは 人口密度が いちばん 低い 町（それを 選ぶのは「向きを 反対に」くらべた 誤り）
      const low = dens.indexOf(Math.min(...dens));
      if (low === top || low === bigPop) continue;
      const options: ChoiceOption[] = TOWNS.map((t, i) =>
        i === top
          ? { label: t, correct: true }
          : { label: t, misconception: i === bigPop ? 'total-compare' : 'dir-swap' },
      );
      const item: ChoiceItem = {
        engine: 'choice',
        id: `density-alt:${areas.join('-')}:${dens.join('-')}`,
        objective: 'density',
        level,
        prompt: '表は れいの データです。人口密度が いちばん 高い（こんで いる）町は どれ？',
        figure: {
          kind: 'table',
          header: ['町', '人口（人）', '面積（km²）'],
          rows: TOWNS.map((t, i) => [t, String(pops[i]), String(areas[i])]),
        },
        hints: [
          '人口の 多さだけでは くらべられないよ。面積も ちがうね。',
          '人口密度 ＝ 人口 ÷ 面積（1km²あたりの 人口）。',
          `${TOWNS[0]}は ${pops[0]} ÷ ${areas[0]}。のこりの 町も 計算して くらべよう。`,
        ],
        explain: `人口密度は ${TOWNS.map((t, i) => `${t} ${pops[i]} ÷ ${areas[i]} ＝ ${dens[i]}人`).join('、')}。いちばん 高いのは ${TOWNS[top]}です。`,
        identity: `density-cmp:${areas.join('-')}:${dens.join('-')}`,
        alt: true,
        fixedOrder: true,
        options,
      };
      return item;
    }
  }
  const area = rng.int(3, 80);
  const d = rng.int(30, 600) * 5;
  const pop = area * d;
  const town = pick(rng, TOWNS);
  const answers = [{ kind: 'int' as const, value: d }];
  return {
    engine: 'number',
    id: `density:${area}:${d}`,
    objective: 'density',
    level,
    prompt: `れいの データです。${town}は 人口 ${pop}人、面積 ${area}km²です。${town}の 人口密度（1km²あたりの 人口）を 求めよう。`,
    hints: [
      '人口密度は、1km²あたりに 何人 住んで いるかだよ。',
      '人口密度 ＝ 人口 ÷ 面積',
      `${pop} ÷ ${area}を 計算しよう。`,
    ],
    explain: `${pop} ÷ ${area} ＝ ${d}。人口密度は 1km²あたり ${d}人です。`,
    identity: `density:${area}:${d}`,
    alt: false,
    fields: [{ label: '人', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [divText(area, pop), 'div-swap'],
      [pop * area, 'mul-instead'],
      [pop - area, 'mul-instead'],
    ]),
  };
}

// ---- ねだんくらべ（price） ----
const GOODS = [
  { id: 'ribbon', name: 'リボン', u: 'm' },
  { id: 'rope', name: 'ロープ', u: 'm' },
  { id: 'rice', name: 'お米', u: 'kg' },
  { id: 'paint', name: 'ペンキ', u: 'L' },
];

function price(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const g = pick(rng, GOODS);
  const [a1, a2, u1, u2] = ((): [number, number, number, number] => {
    for (;;) {
      const x1 = rng.int(2, 9);
      const x2 = rng.int(2, 9);
      const y1 = rng.int(8, 60) * 10;
      const y2 = rng.int(8, 60) * 10;
      if (x1 === x2 || y1 === y2 || x1 * y1 === x2 * y2) continue;
      return [x1, x2, y1, y2];
    }
  })();
  const c1 = a1 * u1;
  const c2 = a2 * u2;
  const aCheap = u1 < u2;
  // 誤り: 高い ほうを 選んだ。代金の 合計が 安い ほうなら「合計で くらべた」
  const wrongTotalCheaper = aCheap ? c2 < c1 : c1 < c2;
  const names: [string, string] = [`Aの ${g.name}`, `Bの ${g.name}`];
  const options: ChoiceOption[] = twoOptions(aCheap, wrongTotalCheaper, names);
  const key = [`${a1}/${c1}`, `${a2}/${c2}`].sort().join('|');
  return {
    engine: 'choice',
    id: `price${alt ? '-alt' : ''}:${g.id}:${a1}/${c1}|${a2}/${c2}`,
    objective: 'price',
    level,
    prompt: alt
      ? `表を 見て、1${g.u}あたりの ねだんが 安いのは どちらか 選ぼう。`
      : `${g.name}を 売って います。Aは ${a1}${g.u}で ${c1}円、Bは ${a2}${g.u}で ${c2}円です。1${g.u}あたりの ねだんが 安いのは どちら？`,
    figure: alt
      ? {
          kind: 'table',
          header: ['', `量（${g.u}）`, '代金（円）'],
          rows: [
            [names[0], String(a1), String(c1)],
            [names[1], String(a2), String(c2)],
          ],
        }
      : undefined,
    hints: [
      '量が ちがうので、代金だけでは くらべられないよ。',
      `1${g.u}あたりの ねだんを 求めよう。Aは ${c1} ÷ ${a1}、Bは ${c2} ÷ ${a2}。`,
      `Aは 1${g.u}あたり ${u1}円。Bも 計算して、少ない ほうが 安いよ。`,
    ],
    explain: `1${g.u}あたりの ねだんは、Aが ${c1} ÷ ${a1} ＝ ${u1}円、Bが ${c2} ÷ ${a2} ＝ ${u2}円。${aCheap ? 'A' : 'B'}の ほうが 安いです。`,
    identity: `price:${g.id}:${key}${alt ? ':table' : ''}`,
    alt,
    fixedOrder: true,
    options,
  };
}

// ---- 1あたり量から 全体・いくつ分（story） ----
interface UseScene {
  id: string;
  op: 'mul' | 'div';
  text: (r: string, n: number) => string;
  unit: string;
  rUnit: string;
}
const USE_SCENES: UseScene[] = [
  {
    id: 'rice',
    op: 'mul',
    text: (r, n) =>
      `1aあたり ${r}kgの お米が とれる 田んぼが ${n}a あります。全部で 何kg とれますか。`,
    unit: 'kg',
    rUnit: 'kg',
  },
  {
    id: 'car',
    op: 'mul',
    text: (r, n) => `ガソリン 1Lあたり ${r}km 走る 車が あります。${n}Lでは 何km 走りますか。`,
    unit: 'km',
    rUnit: 'km',
  },
  {
    id: 'wire',
    op: 'mul',
    text: (r, n) => `1mあたりの 重さが ${r}gの はり金が ${n}m あります。全部の 重さは 何gですか。`,
    unit: 'g',
    rUnit: 'g',
  },
  {
    id: 'tap',
    op: 'div',
    text: (r, n) =>
      `1分《ふん》間あたり ${r}Lの 水が 出る じゃ口で、${n}Lの 水を ためます。何分《ふん》 かかりますか。`,
    unit: '分《ふん》',
    rUnit: 'L',
  },
  {
    id: 'paper',
    op: 'div',
    text: (r, n) =>
      `1まいあたり ${r}gの 紙が あります。紙の 重さが 全部で ${n}gの とき、紙は 何まい ありますか。`,
    unit: 'まい',
    rUnit: 'g',
  },
  {
    id: 'farm',
    op: 'div',
    text: (r, n) =>
      `1aあたり ${r}kgの いもが とれる 畑で、${n}kgの いもを とるには 何aの 畑が いりますか。`,
    unit: 'a',
    rUnit: 'kg',
  },
];

function story(level: number, rng: Rng, alt: boolean): NumberItem {
  // alt: わり算（いくつ分を 求める）、ふだん: かけ算（全体を 求める）
  const sc = pick(
    rng,
    USE_SCENES.filter((s) => (alt ? s.op === 'div' : s.op === 'mul')),
  );
  // 1あたり量 rv（10分の1 の いくつ分）と いくつ分 n
  const [rv, n] = ((): [number, number] => {
    for (;;) {
      const x = rng.int(11, 300);
      const y = rng.int(2, 30);
      if ((x * y) % 10 === 0) return [x, y];
    }
  })();
  const r = dec(rv, 1);
  const total = (rv * n) / 10;
  const given = sc.op === 'mul' ? n : total;
  const ans = sc.op === 'mul' ? total : n;
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `story${alt ? '-alt' : ''}:${sc.id}:${r}:${given}`,
    objective: 'story',
    level,
    prompt: sc.text(r, given),
    figure: doubleLine(
      [
        { at: 0, text: '0' },
        { at: midAt(1, n), text: r },
        { at: 1, text: sc.op === 'mul' ? '?' : String(total) },
      ],
      [
        { at: 0, text: '0' },
        { at: midAt(1, n), text: '1' },
        { at: 1, text: sc.op === 'mul' ? String(n) : '?' },
      ],
      '上が 量、下が いくつ分の 数直線',
    ),
    hints: [
      sc.op === 'mul'
        ? '1あたりの 量が 分かって いて、全体の 量を 求めるよ。'
        : '1あたりの 量が 分かって いて、いくつ分かを 求めるよ。',
      sc.op === 'mul' ? '全体 ＝ 1あたり量 × いくつ分' : 'いくつ分 ＝ 全体 ÷ 1あたり量',
      sc.op === 'mul' ? `${r} × ${n}を 計算しよう。` : `${total} ÷ ${r}を 計算しよう。`,
    ],
    explain:
      sc.op === 'mul'
        ? `${r} × ${n} ＝ ${total}。答えは ${total}${sc.unit}です。`
        : `${total} ÷ ${r} ＝ ${n}。答えは ${n}${sc.unit}です。`,
    identity: `story:${sc.id}:${r}:${given}`,
    alt,
    fields: [{ label: sc.unit, answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(
      answers,
      sc.op === 'mul'
        ? [
            [divText(n * 10, rv), 'mul-instead'],
            [divText(rv, n * 10), 'div-swap'],
          ]
        : [
            [divText(total * 10 * rv, 100), 'mul-instead'],
            [divText(rv, total * 10), 'div-swap'],
          ],
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['crowd', 'per1'] },
  { objs: ['per1', 'price', 'story'] },
  { objs: ['density', 'crowd', 'price', 'story'] },
];

export function generatePerUnit(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'crowd':
      return crowd(level, rng, alt);
    case 'per1':
      return per1(level, rng, alt);
    case 'density':
      return density(level, rng, alt);
    case 'price':
      return price(level, rng, alt);
    case 'story':
      return story(level, rng, alt);
  }
}

export const perUnit: UnitSpec = finishUnit(
  {
    id: 'g5.math.per-unit',
    title: '単位量あたりの 大きさ',
    stage: 'g5',
    subject: 'math',
    domain: 'C-measure',
    kind: 'calc',
    priority: 'P1',
    status: 'ready',
    icon: 'mode-compare',
    prereq: ['g5.math.decimal-div'],
    objectives: [
      { id: 'crowd', title: 'こみぐあいを くらべる' },
      { id: 'per1', title: '1あたりの 量を 求める' },
      { id: 'density', title: '人口密度（れいの データ）' },
      { id: 'price', title: '1あたりの ねだんで くらべる' },
      { id: 'story', title: '1あたり量から 全体・いくつ分を 求める' },
    ],
    misconceptions: [
      {
        id: 'div-swap',
        explain:
          'わる 数と わられる 数が 反対に なったのかな。「1まいあたりの 人数」なら 人数 ÷ まい数。「〜あたり」の 〜で わるよ。',
      },
      {
        id: 'dir-swap',
        explain:
          'くらべる 向きを 反対に 考えたのかな。1まい（1m²）あたりの 人数は 多い ほうが こんで いるよ。1人あたりの 広さで くらべるなら、少ない ほうが こんで いるよ。ねだんは 1mあたりが 少ない ほうが 安いね。',
      },
      {
        id: 'total-compare',
        explain:
          '全体の 数（人数・代金・人口）だけで くらべたのかな。広さや 量が ちがう ときは、1あたりの 大きさに そろえて くらべよう。',
      },
      {
        id: 'mul-instead',
        explain:
          'かけ算と わり算を 取りちがえたのかな。1あたり量 ＝ 全体 ÷ いくつ分、全体 ＝ 1あたり量 × いくつ分。数直線に かいて 考えよう。',
      },
    ],
    levels: [
      { label: 'こみぐあい・1あたり量', chance: 0.05 },
      { label: 'ねだん・全体を 求める', chance: 0.05 },
      { label: '人口密度・まとめ', chance: 0.05 },
    ],
    intro: [
      {
        text: 'Aの 部屋《へや》は マット 6まいに 15人、Bの 部屋《へや》は 8まいに 18人。広さも 人数も ちがうので、そのままでは くらべられません。',
        figure: {
          kind: 'table',
          header: ['', 'マット（まい）', '人数'],
          rows: [
            ['Aの 部屋《へや》', '6', '15'],
            ['Bの 部屋《へや》', '8', '18'],
          ],
        },
      },
      {
        text: 'マット 1まいあたりの 人数に そろえます。A: 15 ÷ 6 ＝ 2.5人、B: 18 ÷ 8 ＝ 2.25人。1まいあたりの 人数が 多い Aの ほうが こんで います。',
        figure: doubleLine(
          [
            { at: 0, text: '0' },
            { at: 1 / 6, text: '2.5' },
            { at: 1, text: '15' },
          ],
          [
            { at: 0, text: '0' },
            { at: 1 / 6, text: '1' },
            { at: 1, text: '6' },
          ],
          '上が 人数、下が マットの まい数の 数直線',
        ),
      },
      {
        text: '1km²あたりの 人口を 人口密度と いいます。人口密度 ＝ 人口 ÷ 面積。このように、1あたりの 大きさで くらべる 考え方を「単位量あたりの 大きさ」と いいます。',
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generatePerUnit(level, rng, index),
    },
    review: 'type',
    basis:
      '小学校学習指導要領（平成29年告示）算数 第5学年 C(2) 単位量当たりの大きさ（こみぐあい、人口密度）',
    revised: REVISED,
  },
  '部屋《へや》 小屋《ごや》 町《ちょう》 住《す》んで 植《う》えました 泳《およ》いで 布《ぬの》 田《た》んぼ 遊《あそ》んで 売《う》って 安《やす》い 間《かん》 金《がね》 口《ぐち》 車《くるま》 出《で》 畑《はたけ》',
);
