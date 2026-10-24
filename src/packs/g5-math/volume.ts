/**
 * g5.math.volume 体積（cm³・m³、直方体・立方体、組み合わせた形、容積）（curriculum-matrix 3.8）。
 * 1cm³ の いくつ分 → 公式 → 組み合わせた形 → 容積（内のり）→ 単位の関係（1m³ ＝ 1000000cm³、1L ＝ 1000cm³）。
 *
 * matrix は「計+概 生80」。生成で 100 以上の異なる問題が作れるので、種別は計算（基準 100）で数える。
 * 同一性キー: 問う形 × 長さ（たて・横・高さの 入れかえは同じ）× 表し方。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { decAns, dec, expr, finishUnit, opts, pick, pickObj, REVISED, STROKE, svg, svgText, wrongList } from './util';

type Obj = 'cuboid' | 'cube' | 'compound' | 'capacity' | 'units';

/** 見取図（直方体: 横 a、おく行き b、高さ c）。ラベルは 数字と 単位だけ */
function boxFig(a: number, b: number, c: number, unit: string, cubes = false): Figure {
  const m = Math.max(a, b, c);
  const k = Math.max(8, Math.min(26, Math.floor(160 / m)));
  const ox = b * k * 0.5;
  const oy = b * k * 0.4;
  const x0 = 30;
  const y0 = 14 + oy;
  const P = (x: number, y: number, z: number): [number, number] => [x0 + x * k + y * 0.5 * k, y0 + (c - z) * k - y * 0.4 * k];
  const L = (p: [number, number], q: [number, number], dash = false) =>
    `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" ${STROKE}${dash ? ' stroke-dasharray="5 5"' : ''}/>`;
  let body = '';
  // 正面
  body += `<polygon points="${[P(0, 0, 0), P(a, 0, 0), P(a, 0, c), P(0, 0, c)].map((p) => p.join(',')).join(' ')}" fill="var(--sky)" fill-opacity="0.35" ${STROKE}/>`;
  // 上の面・右の面
  body += `<polygon points="${[P(0, 0, c), P(a, 0, c), P(a, b, c), P(0, b, c)].map((p) => p.join(',')).join(' ')}" fill="var(--sky)" fill-opacity="0.2" ${STROKE}/>`;
  body += `<polygon points="${[P(a, 0, 0), P(a, b, 0), P(a, b, c), P(a, 0, c)].map((p) => p.join(',')).join(' ')}" fill="var(--sky)" fill-opacity="0.5" ${STROKE}/>`;
  // 見えない 辺
  body += L(P(0, b, 0), P(a, b, 0), true) + L(P(0, b, 0), P(0, 0, 0), true) + L(P(0, b, 0), P(0, b, c), true);
  if (cubes) {
    // 1cm³ の ます目（正面と 上と 右）
    for (let i = 1; i < a; i++) body += `<line x1="${P(i, 0, 0)[0]}" y1="${P(i, 0, 0)[1]}" x2="${P(i, 0, c)[0]}" y2="${P(i, 0, c)[1]}" stroke="var(--ink)" stroke-opacity="0.4" stroke-width="1"/>`;
    for (let i = 1; i < c; i++) body += `<line x1="${P(0, 0, i)[0]}" y1="${P(0, 0, i)[1]}" x2="${P(a, 0, i)[0]}" y2="${P(a, 0, i)[1]}" stroke="var(--ink)" stroke-opacity="0.4" stroke-width="1"/>`;
    for (let i = 1; i < b; i++) body += `<line x1="${P(0, i, c)[0]}" y1="${P(0, i, c)[1]}" x2="${P(a, i, c)[0]}" y2="${P(a, i, c)[1]}" stroke="var(--ink)" stroke-opacity="0.4" stroke-width="1"/>`;
    for (let i = 1; i < a; i++) body += `<line x1="${P(i, 0, c)[0]}" y1="${P(i, 0, c)[1]}" x2="${P(i, b, c)[0]}" y2="${P(i, b, c)[1]}" stroke="var(--ink)" stroke-opacity="0.4" stroke-width="1"/>`;
    for (let i = 1; i < b; i++) body += `<line x1="${P(a, i, 0)[0]}" y1="${P(a, i, 0)[1]}" x2="${P(a, i, c)[0]}" y2="${P(a, i, c)[1]}" stroke="var(--ink)" stroke-opacity="0.4" stroke-width="1"/>`;
    for (let i = 1; i < c; i++) body += `<line x1="${P(a, 0, i)[0]}" y1="${P(a, 0, i)[1]}" x2="${P(a, b, i)[0]}" y2="${P(a, b, i)[1]}" stroke="var(--ink)" stroke-opacity="0.4" stroke-width="1"/>`;
  } else {
    const fa = P(a / 2, 0, 0);
    body += svgText(fa[0], fa[1] + 16, `${a}${unit}`, 13);
    const fb = P(a, b / 2, 0);
    body += svgText(fb[0] + 26, fb[1] + 4, `${b}${unit}`, 13);
    const fc = P(0, 0, c / 2);
    body += svgText(fc[0] - 18, fc[1], `${c}${unit}`, 13, 'end');
  }
  const W = a * k + ox + x0 + 60;
  const H = c * k + oy + 40;
  return svg(W, H, body, cubes ? '1cm³の 立方体を つみかさねた 直方体' : '直方体の 見取図');
}

/** L字の 立体（正面の L字を おく行き d だけ のばした 形）。正面: 横 W・高さ H から 右上の w×h を 切りとる */
function lFig(W: number, H: number, w: number, h: number, d: number): Figure {
  const k = Math.max(8, Math.min(18, Math.floor(160 / Math.max(W, H, d))));
  const x0 = 34;
  const y0 = 14 + d * 0.4 * k;
  const P = (x: number, y: number, z: number): [number, number] => [x0 + x * k + y * 0.5 * k, y0 + (H - z) * k - y * 0.4 * k];
  const front: [number, number][] = [
    [0, 0],
    [W, 0],
    [W, H - h],
    [W - w, H - h],
    [W - w, H],
    [0, H],
  ];
  const poly = (y: number) => front.map(([x, z]) => P(x, y, z).join(',')).join(' ');
  let body = `<polygon points="${poly(d)}" fill="var(--sky)" fill-opacity="0.15" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  for (const [x, z] of front) {
    const p = P(x, 0, z);
    const q = P(x, d, z);
    body += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="var(--ink)" stroke-width="1.5"/>`;
  }
  body += `<polygon points="${poly(0)}" fill="var(--sky)" fill-opacity="0.45" ${STROKE}/>`;
  const t = (x: number, y: number, z: number, s: string, dx = 0, dy = 0) => {
    const p = P(x, y, z);
    return svgText(p[0] + dx, p[1] + dy, s, 13);
  };
  body += t(W / 2, 0, 0, `${W}cm`, 0, 16);
  body += t(0, 0, H / 2, `${H}cm`, -24, 0);
  body += t(W - w / 2, 0, H - h, `${w}cm`, 0, 14);
  body += t(W, 0, (H - h) / 2, `${H - h}cm`, 26, 6);
  body += t(W, d / 2, 0, `${d}cm`, 28, 4);
  return svg(W * k + d * 0.5 * k + x0 + 70, H * k + d * 0.4 * k + 40, body, '2つの 直方体を 組み合わせた 形');
}

const sortKey = (...v: number[]) => [...v].sort((x, y) => x - y).join('x');

/** 直方体（alt: 1cm³の 立方体を 数える図・見取図） */
function cuboid(level: number, rng: Rng, alt: boolean): NumberItem {
  const form = alt ? rng.int(1, 2) : 0; // 1 = 1cm³の つみき, 2 = 見取図
  const max = form === 1 ? 6 : 15;
  let a: number;
  let b: number;
  let c: number;
  do {
    a = rng.int(2, max);
    b = rng.int(2, form === 1 ? 5 : 12);
    c = rng.int(2, form === 1 ? 5 : 12);
  } while (a === b && b === c);
  const V = a * b * c;
  const answers = [{ kind: 'int' as const, value: V }];
  const key = `${form}:${sortKey(a, b, c)}`;
  return {
    engine: 'number',
    id: `cuboid${form ? `-alt${form}` : ''}:${key}`,
    objective: 'cuboid',
    level,
    prompt:
      form === 1
        ? '1辺が 1cmの 立方体（1cm³）を つみかさねた 直方体です。体積は 何cm³ですか。'
        : form === 2
          ? 'この 直方体の 体積は 何cm³ですか。'
          : `たて ${b}cm、横 ${a}cm、高さ ${c}cmの 直方体の 体積は 何cm³ですか。`,
    figure: form === 1 ? boxFig(a, b, c, 'cm', true) : form === 2 ? boxFig(a, b, c, 'cm') : undefined,
    hints: [
      '直方体の 体積 ＝ たて × 横 × 高さ',
      form === 1
        ? `1だんめに 1cm³の 立方体が ${b} × ${a}こ。それが ${c}だん あるよ。`
        : `1だんめに 1cm³の 立方体が ${b} × ${a}こ ならぶよ。`,
      `${b} × ${a} × ${c}を 計算しよう。`,
    ],
    explain: `1cm³の 立方体が ${b} × ${a} × ${c} ＝ ${V}こ 分なので、体積は ${V}cm³です。`,
    identity: `cuboid${form ? `-alt${form}` : ''}:${key}`,
    alt: form !== 0,
    fields: [{ label: 'cm³', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [a + b + c, 'add-dims'],
      [a * b, 'area-only'],
      [b * c, 'area-only'],
      [2 * (a * b + b * c + c * a), 'surface'],
    ]),
  };
}

/** 立方体（alt: 見取図） */
function cube(level: number, rng: Rng, alt: boolean): NumberItem {
  const unit = level >= 2 && rng.next() < 0.3 ? 'm' : 'cm';
  const a = rng.int(2, unit === 'm' ? 9 : 20);
  const V = a * a * a;
  const answers = [{ kind: 'int' as const, value: V }];
  return {
    engine: 'number',
    id: `cube${alt ? '-alt' : ''}:${a}${unit}`,
    objective: 'cube',
    level,
    prompt: alt ? `この 立方体の 体積は 何${unit}³ですか。` : `1辺が ${a}${unit}の 立方体の 体積は 何${unit}³ですか。`,
    figure: alt ? boxFig(a, a, a, unit) : undefined,
    hints: [
      '立方体の 体積 ＝ 1辺 × 1辺 × 1辺',
      `${a}を 3回 かけるよ。${a} × ${a} ＝ ${a * a}。`,
      `${a * a} × ${a}を 計算しよう。`,
    ],
    explain: `${a} × ${a} × ${a} ＝ ${V}。体積は ${V}${unit}³です。`,
    identity: `cube${alt ? '-alt' : ''}:${a}${unit}`,
    alt,
    fields: [{ label: `${unit}³`, answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [a * a, 'area-only'],
      [a * 3, 'add-dims'],
      [6 * a * a, 'surface'],
    ]),
  };
}

/** 組み合わせた形（L字の 立体。alt: 大きい 直方体から 小さい 直方体を ぬいた 形を ことばで） */
function compound(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    let A: number, B: number, C: number, a: number, b: number, c: number;
    do {
      A = rng.int(6, 15);
      B = rng.int(5, 12);
      C = rng.int(4, 10);
      a = rng.int(2, A - 2);
      b = rng.int(2, B - 2);
      c = rng.int(2, C - 1);
    } while (A * B * C - a * b * c <= 0);
    const V = A * B * C - a * b * c;
    const answers = [{ kind: 'int' as const, value: V }];
    const key = `${A}x${B}x${C}-${a}x${b}x${c}`;
    return {
      engine: 'number',
      id: `compound-alt:${key}`,
      objective: 'compound',
      level,
      prompt: `たて ${B}cm、横 ${A}cm、高さ ${C}cmの 直方体の 木から、たて ${b}cm、横 ${a}cm、高さ ${c}cmの 直方体を 切りとりました。のこりの 体積は 何cm³ですか。`,
      hints: [
        '大きい 直方体の 体積から、切りとった 直方体の 体積を ひこう。',
        `大きい 直方体は ${B} × ${A} × ${C}、切りとった 直方体は ${b} × ${a} × ${c}。`,
        `${A * B * C} − ${a * b * c}を 計算しよう。`,
      ],
      explain: `${B} × ${A} × ${C} − ${b} × ${a} × ${c} ＝ ${A * B * C} − ${a * b * c} ＝ ${V}。のこりの 体積は ${V}cm³です。`,
      identity: `compound-alt:${key}`,
      alt: true,
      fields: [{ label: 'cm³', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [A * B * C, 'compound-whole'],
        [A * B * C + a * b * c, 'compound-whole'],
      ]),
    };
  }
  const W = rng.int(5, 12);
  const H = rng.int(5, 10);
  const w = rng.int(2, W - 2);
  const h = rng.int(2, H - 2);
  const d = rng.int(3, 10);
  const V = (W * H - w * h) * d;
  const answers = [{ kind: 'int' as const, value: V }];
  const key = `${W}x${H}-${w}x${h}:${d}`;
  return {
    engine: 'number',
    id: `compound:${key}`,
    objective: 'compound',
    level,
    prompt: 'この 形の 体積は 何cm³ですか。',
    figure: lFig(W, H, w, h, d),
    hints: [
      '2つの 直方体に 分けるか、大きい 直方体から 欠けた 部分を ひこう。',
      `大きい 直方体は ${W} × ${d} × ${H}。欠けた 部分は ${w} × ${d} × ${h}。`,
      `${W * d * H} − ${w * d * h}を 計算しよう。`,
    ],
    explain: `${W} × ${d} × ${H} − ${w} × ${d} × ${h} ＝ ${W * d * H} − ${w * d * h} ＝ ${V}。（2つに 分けて ${(W - w) * d * H} ＋ ${w * d * (H - h)} と しても よい）体積は ${V}cm³です。`,
    identity: `compound:${key}`,
    alt: false,
    fields: [{ label: 'cm³', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [W * H * d, 'compound-whole'],
      [(W - w) * H * d + W * (H - h) * d, 'compound-overlap'],
      [W * H - w * h, 'area-only'],
    ]),
  };
}

/** 容積（内のり）。alt: 外のりと 板の あつさから */
function capacity(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const t = 1;
    let a: number, b: number, c: number;
    do {
      a = rng.int(6, 22);
      b = rng.int(6, 22);
      c = rng.int(4, 16);
    } while (a === b);
    const ia = a - 2 * t;
    const ib = b - 2 * t;
    const ic = c - t;
    const V = ia * ib * ic;
    const answers = [{ kind: 'int' as const, value: V }];
    const key = `${sortKey(a, b)}x${c}`;
    return {
      engine: 'number',
      id: `capacity-alt:${key}`,
      objective: 'capacity',
      level,
      prompt: `あつさ ${t}cmの 板で、ふたの ない 箱を 作りました。外のりは たて ${b}cm、横 ${a}cm、高さ ${c}cmです。この 箱の 容積は 何cm³ですか。`,
      hints: [
        '容積は 入れ物の 内のりで 求めるよ。',
        `内のりの たてと 横は、両がわの 板の あつさを ひいて ${b} − 2、${a} − 2。深さは 底の 板の 分だけ ひいて ${c} − 1。`,
        `${ib} × ${ia} × ${ic}を 計算しよう。`,
      ],
      explain: `内のりは たて ${ib}cm、横 ${ia}cm、深さ ${ic}cm。${ib} × ${ia} × ${ic} ＝ ${V}。容積は ${V}cm³です。`,
      identity: `capacity-alt:${key}`,
      alt: true,
      fields: [{ label: 'cm³', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [a * b * c, 'inner-thick'],
        [(a - 1) * (b - 1) * (c - 1), 'inner-thick'],
        [(a - 2) * (b - 2) * (c - 2), 'inner-thick'],
      ]),
    };
  }
  // 内のり（cm）→ 容積を L で（1000cm³ で わりきれる）
  for (;;) {
    const a = rng.int(1, 6) * 10;
    const b = rng.int(1, 6) * 10;
    const c = rng.int(1, 4) * 5;
    const V = a * b * c;
    if (V % 100 !== 0) continue;
    const L = V / 1000; // 小数 1けたまで
    const answers = [decAns(V / 100, 1)];
    const key = `${sortKey(a, b)}x${c}`;
    return {
      engine: 'number',
      id: `capacity:${key}`,
      objective: 'capacity',
      level,
      prompt: `内のりが たて ${b}cm、横 ${a}cm、深さ ${c}cmの 水そうが あります。この 水そうの 容積は 何Lですか。`,
      hints: [
        'まず 容積を cm³で 求めよう（内のりの たて × 横 × 深さ）。',
        `${b} × ${a} × ${c} ＝ ${V}cm³。1L ＝ 1000cm³だよ。`,
        `${V}cm³は 1000cm³の いくつ分かな。${V} ÷ 1000を 計算しよう。`,
      ],
      explain: `${b} × ${a} × ${c} ＝ ${V}cm³。1L ＝ 1000cm³なので、${V} ÷ 1000 ＝ ${dec(V / 100, 1)}。容積は ${dec(V / 100, 1)}Lです。`,
      identity: `capacity:${key}`,
      alt: false,
      fields: [{ label: 'L', answer: answers[0]! }],
      keys: ['decimal'],
      wrongAnswers: wrongList(answers, [
        [V, 'unit-convert'],
        [L * 10, 'unit-100'],
        [dec(V, 2), 'unit-100'],
      ]),
    };
  }
}

const CONV = [
  { from: 'm³', to: 'cm³', f: 1000000, wrong: [100, 10000, 1000] },
  { from: 'L', to: 'cm³', f: 1000, wrong: [100, 10] },
  { from: 'm³', to: 'L', f: 1000, wrong: [100, 10] },
  { from: 'L', to: 'mL', f: 1000, wrong: [100, 10] },
  { from: 'dL', to: 'cm³', f: 100, wrong: [10, 1000] },
] as const;

/** 単位の関係（alt: 1m³が 何cm³かを 図で考えて 選ぶ・m と cm が まじった 体積） */
function units(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    if (rng.next() < 0.5) {
      // たて・横 m、高さ cm の 直方体を m³ で
      for (;;) {
        const a = rng.int(1, 6);
        const b = rng.int(1, 6);
        const ccm = pick(rng, [10, 20, 30, 40, 50, 60, 70, 80, 90]);
        const v10 = a * b * (ccm / 10); // 0.1m³ の いくつ分
        if (a === b) continue;
        const answers = [decAns(v10, 1)];
        const key = `${sortKey(a, b)}x${ccm}`;
        const item: NumberItem = {
          engine: 'number',
          id: `units-mix:${key}`,
          objective: 'units',
          level,
          prompt: `たて ${a}m、横 ${b}m、高さ ${ccm}cmの 直方体の 体積は 何m³ですか。`,
          hints: [
            '長さの 単位を そろえてから かけよう。',
            `${ccm}cm ＝ ${dec(ccm, 2)}m だよ。`,
            `${a} × ${b} × ${dec(ccm, 2)}を 計算しよう。`,
          ],
          explain: `${ccm}cm ＝ ${dec(ccm, 2)}m。${a} × ${b} × ${dec(ccm, 2)} ＝ ${dec(v10, 1)}。体積は ${dec(v10, 1)}m³です。`,
          identity: `units-mix:${key}`,
          alt: true,
          fields: [{ label: 'm³', answer: answers[0]! }],
          keys: ['decimal'],
          wrongAnswers: wrongList(answers, [
            [a * b * ccm, 'unit-mix'],
            [dec(v10, 2), 'unit-mix'],
          ]),
        };
        return item;
      }
    }
    const c = pick(rng, CONV);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `units-pick:${c.from}-${c.to}`,
      objective: 'units',
      level,
      prompt: `1${c.from}は 何${c.to}？`,
      figure:
        c.from === 'm³' && c.to === 'cm³'
          ? boxFig(1, 1, 1, 'm')
          : undefined,
      hints: [
        c.from === 'm³' ? '1m³は 1辺が 1mの 立方体の 体積だよ。' : c.from === 'dL' ? '1L ＝ 10dL、1L ＝ 1000cm³だよ。' : '1Lは 1辺が 10cmの 立方体の 体積だよ。',
        c.from === 'm³' && c.to === 'cm³'
          ? '1m ＝ 100cm。たて・横・高さが みんな 100cmだね。'
          : c.from === 'm³'
            ? '1m³の 中に、1辺 10cmの 立方体（1L）が たてに 10こ、横に 10こ、高さに 10こ 入るよ。'
            : c.from === 'dL'
              ? '1000cm³を 10こに 分けた 1つ分だよ。'
              : c.to === 'mL'
                ? '1mLは 1cm³と 同じ かさ。1L ＝ 10cm × 10cm × 10cmだね。'
                : '10 × 10 × 10を 考えよう。',
        c.from === 'm³' && c.to === 'cm³' ? '100 × 100 × 100を 計算しよう。' : '何こ 分かを かけ算で 求めよう。',
      ],
      explain: `1${c.from} ＝ ${c.f}${c.to}です。`,
      identity: `units-pick:${c.from}-${c.to}`,
      alt: true,
      options: opts(
        `${c.f}${c.to}`,
        c.wrong.map((w) => [`${w}${c.to}`, 'unit-100'] as [string, string]),
      ),
    };
    return item;
  }
  const c = pick(rng, CONV);
  const up = rng.next() < 0.6;
  const n = rng.int(2, 9) * (rng.next() < 0.3 ? 10 : 1);
  const ans = up ? n * c.f : n;
  const given = up ? n : n * c.f;
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `units:${c.from}-${c.to}:${n}:${up ? 'd' : 'u'}`,
    objective: 'units',
    level,
    prompt: up ? `${given}${c.from}は 何${c.to}ですか。` : `${given}${c.to}は 何${c.from}ですか。`,
    hints: [
      `1${c.from} ＝ ${c.f}${c.to}だよ。`,
      c.from === 'm³' && c.to === 'cm³'
        ? '1m ＝ 100cmなので、1m³は 100 × 100 × 100cm³。'
        : c.from === 'L' && c.to === 'cm³'
          ? '1Lは 1辺 10cmの 立方体なので 10 × 10 × 10cm³。'
          : `${c.to}の 数は ${c.from}の 数の ${c.f}倍に なるよ。`,
      up ? `${n} × ${c.f}を 計算しよう。` : `${given} ÷ ${c.f}を 計算しよう。`,
    ],
    explain: `1${c.from} ＝ ${c.f}${c.to}なので、${up ? `${n}${c.from} ＝ ${ans}${c.to}` : `${given}${c.to} ＝ ${ans}${c.from}`}です。`,
    identity: `units:${c.from}-${c.to}:${n}:${up ? 'd' : 'u'}`,
    alt: false,
    fields: [{ label: up ? c.to : c.from, answer: answers[0]! }],
    wrongAnswers: wrongList(
      answers,
      c.wrong.map((w) => [up ? n * w : given % w === 0 ? given / w : null, 'unit-100'] as [number | null, string]),
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['cuboid', 'cube'] },
  { objs: ['compound', 'cuboid', 'cube'] },
  { objs: ['capacity', 'units'] },
  { objs: ['cuboid', 'cube', 'compound', 'capacity', 'units'] },
];

export function generateVolume(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'cuboid':
      return cuboid(level, rng, alt);
    case 'cube':
      return cube(level, rng, alt);
    case 'compound':
      return compound(level, rng, alt);
    case 'capacity':
      return capacity(level, rng, alt);
    case 'units':
      return units(level, rng, alt);
  }
}

export const volume: UnitSpec = finishUnit(
  {
    id: 'g5.math.volume',
    title: '体積',
    stage: 'g5',
    subject: 'math',
    domain: 'C-measure',
    kind: 'calc',
    priority: 'P1',
    status: 'ready',
    icon: 'g1m-box',
    prereq: ['g4.math.cuboid', 'g4.math.area'],
    objectives: [
      { id: 'cuboid', title: '直方体の 体積（1cm³の いくつ分・公式）' },
      { id: 'cube', title: '立方体の 体積' },
      { id: 'compound', title: '組み合わせた 形の 体積' },
      { id: 'capacity', title: '容積（内のり）' },
      { id: 'units', title: '体積の 単位の 関係（cm³・m³・L）' },
    ],
    misconceptions: [
      {
        id: 'add-dims',
        explain: '長さを たしたのかな。体積は 1cm³の 立方体が いくつ分かなので、たて × 横 × 高さの かけ算だよ。',
      },
      {
        id: 'area-only',
        explain: '2つの 長さしか かけて いないのかな。それは 面の 広さ（面積）だよ。高さも かけて、だんの 数だけ 重ねよう。',
      },
      {
        id: 'surface',
        explain: 'まわりの 面の 面積を たしたのかな。体積は 中に ある 1cm³の 立方体の 数だよ。',
      },
      {
        id: 'compound-whole',
        explain: '欠けた 部分（切りとった 部分）を ひきわすれたのかな。大きい 直方体から、ない 部分を ひこう。',
      },
      {
        id: 'compound-overlap',
        explain: '同じ ところを 2回 数えたのかな。重ならないように 2つの 直方体に 分けよう。',
      },
      {
        id: 'inner-thick',
        explain:
          '板の あつさの ひき方が ちがうのかな。たてと 横は 両がわの 板（2まい分）を、深さは 底の 板（ふたが なければ 1まい分）を ひくよ。',
      },
      {
        id: 'unit-100',
        explain:
          '1m ＝ 100cmだけど、1m³ ＝ 100cm³では ないよ。たて・横・高さが みんな 100倍なので、1m³ ＝ 100 × 100 × 100 ＝ 1000000cm³。1L ＝ 1000cm³、1L ＝ 1000mLも 思い出そう。',
      },
      {
        id: 'unit-convert',
        explain: 'cm³の まま 答えたのかな。1L ＝ 1000cm³なので、Lに なおそう。',
      },
      {
        id: 'unit-mix',
        explain: '長さの 単位を そろえずに かけたのかな。先に 同じ 単位（m）に そろえてから かけよう。',
      },
    ],
    levels: [
      { label: '直方体・立方体', chance: 0.02 },
      { label: '組み合わせた 形', chance: 0.02 },
      { label: '容積・単位', chance: 0.02 },
      { label: 'まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: 'かさの ことを 体積と いいます。1辺が 1cmの 立方体の 体積を 1立方センチメートルと いい、1cm³と 書きます。',
        figure: boxFig(1, 1, 1, 'cm', true),
      },
      {
        text: 'この 直方体は 1cm³の 立方体が 1だんに 3 × 4 ＝ 12こ、それが 2だんで 24こ。体積は 24cm³です。',
        figure: boxFig(4, 3, 2, 'cm', true),
      },
      {
        text: '直方体の 体積 ＝ たて × 横 × 高さ、立方体の 体積 ＝ 1辺 × 1辺 × 1辺。',
        figure: expr('4 × 3 × 2 ＝ 24'),
      },
      {
        text: '大きい ものは m³を 使います。1m³ ＝ 100 × 100 × 100 ＝ 1000000cm³。1L ＝ 1000cm³（1辺 10cmの 立方体）です。',
        figure: boxFig(1, 1, 1, 'm'),
      },
      {
        text: '入れ物の 内がわの 長さを 内のりと いい、内のりで 求めた 体積を 容積と いいます。',
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateVolume(level, rng, index),
    },
    review: 'type',
    basis: '小学校学習指導要領（平成29年告示）算数 第5学年 B(4) 立体図形の体積（cm³・m³、直方体・立方体の求積）',
    revised: REVISED,
  },
  '重《かさ》ね 底《そこ》 木《き》 板《いた》 外《そと》のり 内《うち》がわ 深《ふか》さ 水《すい》そう 欠《か》けた 思《おも》い出《だ》そう 切《き》りとった 切《き》りとりました 切《き》りとる',
);
