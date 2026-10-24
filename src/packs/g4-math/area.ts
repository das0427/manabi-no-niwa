/**
 * g4.math.area 面積（cm²・m²・km²、a・ha）（curriculum-matrix 3.7）。
 * 1cm² の いくつ分 → 公式（長方形・正方形）→ 辺の長さを求める → L字などの複合図形 → 単位の関係。
 *
 * 種別は「概+計」。生成で到達項目ごとに作る（量の基準は概念の 60）。
 * 同一性キー: 問う形 × 図形の大きさ（× 単位）。長方形の たて・横の 入れかえは同じ。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { finishUnit, opts, pick, pickObj, REVISED, STROKE, svg, svgText, wrongList } from './util';

type Obj = 'count' | 'formula' | 'inverse' | 'compound' | 'units' | 'large';

const C = 24;

/** 方がんの 上の ます目（セルの集合）を ぬった 図 */
function cellsFig(cells: [number, number][], w: number, h: number): Figure {
  let body = '';
  for (const [x, y] of cells)
    body += `<rect x="${8 + x * C}" y="${8 + y * C}" width="${C}" height="${C}" fill="var(--sky)"/>`;
  for (let x = 0; x <= w; x++)
    body += `<line x1="${8 + x * C}" y1="8" x2="${8 + x * C}" y2="${8 + h * C}" stroke="var(--ink)" stroke-opacity="0.3" stroke-width="1"/>`;
  for (let y = 0; y <= h; y++)
    body += `<line x1="8" y1="${8 + y * C}" x2="${8 + w * C}" y2="${8 + y * C}" stroke="var(--ink)" stroke-opacity="0.3" stroke-width="1"/>`;
  return svg(w * C + 16, h * C + 16, body, '1ますが 1cm²の 方がん');
}

/** L字の 図形（外の 長方形 W×H から 右上の w×h を 切り取った 形） */
function lFig(W: number, H: number, w: number, h: number, unit: string): Figure {
  const k = Math.min(22, Math.floor(220 / Math.max(W, H)));
  const X = (x: number) => 40 + x * k;
  const Y = (y: number) => 20 + y * k;
  const pts = [
    [0, 0],
    [W - w, 0],
    [W - w, h],
    [W, h],
    [W, H],
    [0, H],
  ].map(([x, y]) => `${X(x!)},${Y(y!)}`);
  let body = `<polygon points="${pts.join(' ')}" fill="var(--sky)" fill-opacity="0.4" ${STROKE}/>`;
  body += svgText(X(W / 2), Y(H) + 16, `${W}${unit}`, 13);
  body += svgText(X(0) - 22, Y(H / 2), `${H}${unit}`, 13);
  body += svgText(X((W - w) / 2), Y(0) - 8, `${W - w}${unit}`, 13);
  body += svgText(X(W) + 24, Y(h + (H - h) / 2), `${H - h}${unit}`, 13);
  return svg(X(W) + 50, Y(H) + 28, body, 'L字の 形');
}

/** 長方形の 図（たて・横の 長さ つき） */
function rectFig(a: number, b: number, unit: string): Figure {
  const k = Math.min(24, Math.floor(200 / Math.max(a, b)));
  let body = `<rect x="40" y="16" width="${b * k}" height="${a * k}" fill="var(--sky)" fill-opacity="0.4" ${STROKE}/>`;
  body += svgText(40 + (b * k) / 2, 16 + a * k + 16, `${b}${unit}`, 13);
  body += svgText(20, 16 + (a * k) / 2, `${a}${unit}`, 13);
  return svg(b * k + 60, a * k + 36, body, '長方形');
}

const sq = (u: string) => `${u}²`;

/** 1cm² の いくつ分（alt: 2つの 形の 広さくらべ） */
function count(level: number, rng: Rng, alt: boolean): Item {
  const make = (): [number, number][] => {
    // 長方形 2つを 組み合わせた 形
    const a: [number, number, number, number] = [0, 0, rng.int(2, 5), rng.int(2, 4)];
    const b: [number, number, number, number] = [rng.int(0, 2), a[3], rng.int(1, 4), rng.int(1, 2)];
    const set = new Map<string, [number, number]>();
    for (const [x0, y0, w, h] of [a, b])
      for (let x = x0; x < x0 + w; x++)
        for (let y = y0; y < y0 + h; y++) set.set(`${x},${y}`, [x, y]);
    return [...set.values()];
  };
  if (alt) {
    let s1 = make();
    let s2 = make();
    while (s1.length === s2.length) s2 = make();
    if (rng.next() < 0.5) [s1, s2] = [s2, s1];
    const shift = 7;
    const both = [...s1, ...s2.map(([x, y]) => [x + shift, y] as [number, number])];
    const big = s1.length > s2.length ? 'ア' : 'イ';
    const item: ChoiceItem = {
      engine: 'choice',
      id: `count-alt:${JSON.stringify(s1)}|${JSON.stringify(s2)}`,
      objective: 'count',
      level,
      prompt: '左の 形が ア、右の 形が イです。広いのは どちら？（1ますは 1cm²）',
      figure: cellsFig(both, 13, 7),
      hints: [
        '形が ちがうと、見た目では くらべにくいね。',
        '1cm²の ますが いくつ分かを 数えよう。',
        `アは ${s1.length}ます。イは いくつかな。`,
      ],
      explain: `アは ${s1.length}cm²、イは ${s2.length}cm²。${big}の ほうが 広いです。`,
      identity: `count-cmp:${JSON.stringify(s1)}|${JSON.stringify(s2)}`,
      alt: true,
      fixedOrder: true,
      options: [
        { label: 'ア', ...(big === 'ア' ? { correct: true } : { misconception: 'looks-big' }) },
        { label: 'イ', ...(big === 'イ' ? { correct: true } : { misconception: 'looks-big' }) },
        { label: '同じ', misconception: 'looks-big' },
      ],
    };
    return item;
  }
  const cells = make();
  const n = cells.length;
  const answers = [{ kind: 'int' as const, value: n }];
  // まわりの 長さ（ますの 辺の 数）
  const key = new Set(cells.map((c) => c.join(',')));
  let per = 0;
  for (const [x, y] of cells)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      if (!key.has(`${x + dx},${y + dy}`)) per++;
  const item: NumberItem = {
    engine: 'number',
    id: `count:${JSON.stringify(cells)}`,
    objective: 'count',
    level,
    prompt: '1ますは 1辺が 1cmの 正方形（1cm²）です。色の ついた 形の 面積は 何cm²ですか。',
    figure: cellsFig(cells, 7, 7),
    hints: [
      '面積は、1cm²の 正方形が いくつ分かで 表すよ。',
      '長方形の 部分に 分けて 数えると 数えやすいよ。',
      '1だんずつ 数えて たそう。',
    ],
    explain: `1cm²の 正方形が ${n}こ 分なので、面積は ${n}cm²です。`,
    identity: `count:${JSON.stringify([...cells].sort())}`,
    alt: false,
    fields: [{ label: 'cm²', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [[per, 'perimeter']]),
  };
  return item;
}

const UNITS = ['cm', 'm', 'km'] as const;

/** 公式（alt: 図の 長さから） */
function formula(level: number, rng: Rng, alt: boolean): NumberItem {
  const u = level === 0 ? 'cm' : pick(rng, UNITS);
  const square = rng.next() < 0.3;
  const a = rng.int(2, u === 'km' ? 9 : 15);
  const b = square ? a : rng.int(2, u === 'km' ? 9 : 15);
  const S = a * b;
  const name = square ? '正方形' : '長方形';
  const answers = [{ kind: 'int' as const, value: S }];
  return {
    engine: 'number',
    id: `formula${alt ? '-alt' : ''}:${Math.min(a, b)}x${Math.max(a, b)}${u}`,
    objective: 'formula',
    level,
    prompt: alt
      ? `この ${name}の 面積は 何${sq(u)}ですか。`
      : square
        ? `1辺が ${a}${u}の 正方形の 面積は 何${sq(u)}ですか。`
        : `たて ${a}${u}、横 ${b}${u}の 長方形の 面積は 何${sq(u)}ですか。`,
    figure: alt ? rectFig(a, b, u) : undefined,
    hints: [
      square ? '正方形の 面積 ＝ 1辺 × 1辺' : '長方形の 面積 ＝ たて × 横',
      `1${sq(u)}の 正方形が、たてに ${a}こ、横に ${b}こ ならぶね。`,
      `${a} × ${b}を 計算しよう。`,
    ],
    explain: `${a} × ${b} ＝ ${S}。面積は ${S}${sq(u)}です。`,
    identity: `formula:${Math.min(a, b)}x${Math.max(a, b)}${u}${alt ? ':fig' : ''}`,
    alt,
    fields: [{ label: sq(u), answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [2 * (a + b), 'perimeter'],
      [a + b, 'add-sides'],
    ]),
  };
}

/** 面積から 辺の 長さ（alt: 正方形の 1辺） */
function inverse(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const a = rng.int(2, 12);
    const answers = [{ kind: 'int' as const, value: a }];
    return {
      engine: 'number',
      id: `inverse-alt:${a}`,
      objective: 'inverse',
      level,
      prompt: `面積が ${a * a}cm²の 正方形が あります。1辺の 長さは 何cmですか。`,
      hints: [
        '正方形の 面積 ＝ 1辺 × 1辺',
        `□ × □ ＝ ${a * a}に なる □を さがそう。`,
        `九九や かけ算で、同じ数を 2回 かけて ${a * a}に なる 数は？`,
      ],
      explain: `${a} × ${a} ＝ ${a * a}なので、1辺は ${a}cmです。`,
      identity: `inverse-sq:${a}`,
      alt: true,
      fields: [{ label: 'cm', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [(a * a) / 2, 'half-area'],
        [(a * a) / 4, 'perimeter'],
      ]),
    };
  }
  const a = rng.int(2, 12);
  const b = rng.int(2, 15);
  const S = a * b;
  const answers = [{ kind: 'int' as const, value: b }];
  return {
    engine: 'number',
    id: `inverse:${S}:${a}`,
    objective: 'inverse',
    level,
    prompt: `面積が ${S}cm²で、たてが ${a}cmの 長方形が あります。横の 長さは 何cmですか。`,
    hints: ['長方形の 面積 ＝ たて × 横', `${a} × □ ＝ ${S}`, `${S} ÷ ${a}を 計算しよう。`],
    explain: `${a} × □ ＝ ${S} なので、□ ＝ ${S} ÷ ${a} ＝ ${b}。横は ${b}cmです。`,
    identity: `inverse:${S}:${a}`,
    alt: false,
    fields: [{ label: 'cm', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [S * a, 'mult-instead'],
      [S - a, 'mult-instead'],
      [S / 2 - a, 'perimeter'],
    ]),
  };
}

/** L字の 形（alt: 長方形から 長方形を ぬいた 形） */
function compound(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const W = rng.int(6, 14);
    const H = rng.int(5, 10);
    const r = rng.int(1, 2);
    const S = W * H - (W - 2 * r) * (H - 2 * r);
    const answers = [{ kind: 'int' as const, value: S }];
    const k = Math.min(18, Math.floor(220 / W));
    let body = `<rect x="30" y="20" width="${W * k}" height="${H * k}" fill="var(--sky)" fill-opacity="0.5" ${STROKE}/>`;
    body += `<rect x="${30 + r * k}" y="${20 + r * k}" width="${(W - 2 * r) * k}" height="${(H - 2 * r) * k}" fill="var(--white)" ${STROKE}/>`;
    body += svgText(30 + (W * k) / 2, 20 + H * k + 16, `${W}m`, 13);
    body += svgText(14, 20 + (H * k) / 2, `${H}m`, 13);
    body += svgText(30 + r * k + 4, 20 + (r * k) / 2 + 2, `${r}m`, 11, 'start');
    return {
      engine: 'number',
      id: `compound-alt:${W}x${H}:${r}`,
      objective: 'compound',
      level,
      prompt: `たて ${H}m、横 ${W}mの 花だんの まわりに、はば ${r}mの 道が あります（色の 部分）。道の 面積は 何m²ですか。`,
      figure: svg(W * k + 50, H * k + 40, body, '花だんと まわりの 道'),
      hints: [
        '大きい 長方形から、中の 長方形を ひくと 求められるよ。',
        `中の 長方形の たては ${H} − ${r} × 2、横は ${W} − ${r} × 2。`,
        `${W} × ${H} − ${W - 2 * r} × ${H - 2 * r}を 計算しよう。`,
      ],
      explain: `${W} × ${H} − ${W - 2 * r} × ${H - 2 * r} ＝ ${W * H} − ${(W - 2 * r) * (H - 2 * r)} ＝ ${S}。道の 面積は ${S}m²です。`,
      identity: `compound-frame:${W}x${H}:${r}`,
      alt: true,
      fields: [{ label: 'm²', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [W * H - (W - r) * (H - r), 'frame-width'],
        [W * H, 'compound-whole'],
        [2 * (W + H) * r, 'compound-overlap'],
      ]),
    };
  }
  const W = rng.int(5, 12);
  const H = rng.int(5, 10);
  const w = rng.int(1, W - 2);
  const h = rng.int(1, H - 2);
  const S = W * H - w * h;
  const answers = [{ kind: 'int' as const, value: S }];
  return {
    engine: 'number',
    id: `compound:${W}x${H}:${w}x${h}`,
    objective: 'compound',
    level,
    prompt: 'この 形の 面積は 何cm²ですか。',
    figure: lFig(W, H, w, h, 'cm'),
    hints: [
      '2つの 長方形に 分けるか、大きい 長方形から 欠けた 部分を ひこう。',
      `大きい 長方形は ${W} × ${H}。欠けた 部分の たては ${H} − ${H - h}、横は ${W} − ${W - w}。`,
      `${W} × ${H} − ${w} × ${h}を 計算しよう。`,
    ],
    explain: `${W} × ${H} − ${w} × ${h} ＝ ${W * H} − ${w * h} ＝ ${S}。（2つの 長方形に 分けて ${(W - w) * H} ＋ ${w * (H - h)} ＝ ${S}と しても よい）面積は ${S}cm²です。`,
    identity: `compound:${W}x${H}:${w}x${h}`,
    alt: false,
    fields: [{ label: 'cm²', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [W * H, 'compound-whole'],
      [(W - w) * H + W * (H - h), 'compound-overlap'],
      [2 * (W + H), 'perimeter'],
    ]),
  };
}

const CONV = [
  { from: 'm²', to: 'cm²', f: 10000, w: [100, 'unit-100'] as const },
  { from: 'a', to: 'm²', f: 100, w: [10, 'unit-100'] as const },
  { from: 'ha', to: 'm²', f: 10000, w: [100, 'unit-100'] as const },
  { from: 'km²', to: 'm²', f: 1000000, w: [1000, 'unit-100'] as const },
  { from: 'ha', to: 'a', f: 100, w: [10, 'unit-100'] as const },
  { from: 'km²', to: 'ha', f: 100, w: [10, 'unit-100'] as const },
];

/** 単位の 換算（alt: 広さに 合う 単位を 選ぶ） */
function units(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const things = [
      { t: 'ノートの 表紙の 広さ', u: 'cm²' },
      { t: '教室の ゆかの 広さ', u: 'm²' },
      { t: '市や 町の 広さ', u: 'km²' },
      { t: 'はがきの 広さ', u: 'cm²' },
      { t: '学校の 体育館の ゆかの 広さ', u: 'm²' },
      { t: '県の 広さ', u: 'km²' },
      { t: '田や 畑の 広さ（100m²の いくつ分）', u: 'a' },
      { t: '大きな 公園の 広さ（10000m²の いくつ分）', u: 'ha' },
    ];
    const th = pick(rng, things);
    const all = ['cm²', 'm²', 'a', 'ha', 'km²'].filter((x) => x !== th.u);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `units-alt:${th.t}`,
      objective: 'units',
      level,
      prompt: `${th.t}を 表すのに ちょうど よい 単位は どれ？`,
      hints: [
        '1cm²は 指先くらい、1m²は 新聞紙を 2まい ならべたくらいの 広さだよ。',
        '1aは 1辺 10mの 正方形、1haは 1辺 100mの 正方形の 広さ。',
        '1km²は 1辺 1kmの 正方形の 広さだよ。',
      ],
      explain: `${th.t}は ${th.u}で 表すと ちょうど よいです。`,
      identity: `units-pick:${th.t}`,
      alt: true,
      options: opts(
        th.u,
        rng.sample(all, 3).map((x) => [x, 'unit-scale']),
      ),
    };
    return item;
  }
  const c = pick(rng, CONV);
  const big = rng.next() < 0.6;
  const n = rng.int(2, 9) * (rng.next() < 0.3 ? 10 : 1);
  const ans = big ? n * c.f : n;
  const given = big ? n : n * c.f;
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `units:${c.from}-${c.to}:${n}:${big ? 'd' : 'u'}`,
    objective: 'units',
    level,
    prompt: big ? `${given}${c.from}は 何${c.to}ですか。` : `${given}${c.to}は 何${c.from}ですか。`,
    hints: [
      `1${c.from} ＝ ${c.f}${c.to}だよ。`,
      c.from === 'm²'
        ? '1m ＝ 100cmなので、1m²は 100 × 100。'
        : c.from === 'km²'
          ? '1km ＝ 1000mなので、1km²は 1000 × 1000。'
          : `${c.from === 'a' ? '1aは 1辺 10mの 正方形' : c.from === 'ha' ? '1haは 1辺 100mの 正方形' : '1km²は 1辺 1kmの 正方形'}の 面積だよ。`,
      big ? `${n} × ${c.f}を 計算しよう。` : `${given} ÷ ${c.f}を 計算しよう。`,
    ],
    explain: `1${c.from} ＝ ${c.f}${c.to}なので、${big ? `${n}${c.from} ＝ ${ans}${c.to}` : `${given}${c.to} ＝ ${ans}${c.from}`}です。`,
    identity: `units:${c.from}-${c.to}:${n}:${big ? 'd' : 'u'}`,
    alt: false,
    fields: [{ label: big ? c.to : c.from, answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [big ? n * c.w[0] : given / c.w[0], c.w[1]],
      [big ? n * c.f * 10 : given / (c.f * 10), 'unit-100'],
    ]),
  };
}

/** 大きな 面積（単位を そろえる・a・ha で 答える）。alt: たてと 横の 単位が ちがう */
function large(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const am = rng.int(2, 6);
    const bcm = rng.int(2, 9) * 10;
    const S = am * 100 * bcm;
    const answers = [{ kind: 'int' as const, value: S }];
    return {
      engine: 'number',
      id: `large-alt:${am}m:${bcm}cm`,
      objective: 'large',
      level,
      prompt: `たて ${am}m、横 ${bcm}cmの 長方形の 面積は 何cm²ですか。`,
      hints: [
        '長さの 単位を そろえてから かけよう。',
        `${am}m ＝ ${am * 100}cm`,
        `${am * 100} × ${bcm}を 計算しよう。`,
      ],
      explain: `${am}m ＝ ${am * 100}cm。${am * 100} × ${bcm} ＝ ${S}。面積は ${S}cm²です。`,
      identity: `large-mix:${am}m:${bcm}cm`,
      alt: true,
      fields: [{ label: 'cm²', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [am * bcm, 'unit-mix'],
        [am * 10 * bcm, 'unit-mix'],
      ]),
    };
  }
  const kind = pick(rng, ['a', 'ha', 'km'] as const);
  if (kind === 'km') {
    const a = rng.int(2, 9);
    const b = rng.int(2, 9);
    const answers = [{ kind: 'int' as const, value: a * b }];
    return {
      engine: 'number',
      id: `large:km:${Math.min(a, b)}x${Math.max(a, b)}`,
      objective: 'large',
      level,
      prompt: `たて ${a}km、横 ${b}kmの 長方形の 土地の 面積は 何km²ですか。`,
      hints: [
        '長方形の 面積 ＝ たて × 横',
        '単位が kmなら、面積の 単位は km²。',
        `${a} × ${b}を 計算しよう。`,
      ],
      explain: `${a} × ${b} ＝ ${a * b}。面積は ${a * b}km²です。`,
      identity: `large:km:${Math.min(a, b)}x${Math.max(a, b)}`,
      alt: false,
      fields: [{ label: 'km²', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [2 * (a + b), 'perimeter'],
        [a * b * 1000000, 'unit-convert'],
      ]),
    };
  }
  const step = kind === 'a' ? 10 : 100;
  const a = rng.int(1, 9) * step;
  const b = rng.int(1, 9) * step;
  const m2 = a * b;
  const ans = kind === 'a' ? m2 / 100 : m2 / 10000;
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `large:${kind}:${Math.min(a, b)}x${Math.max(a, b)}`,
    objective: 'large',
    level,
    prompt: `たて ${a}m、横 ${b}mの ${kind === 'a' ? '畑' : '土地'}の 面積は 何${kind}ですか。`,
    hints: [
      `まず m²で 求めよう。${a} × ${b}。`,
      kind === 'a' ? '1a ＝ 100m²（1辺 10mの 正方形）' : '1ha ＝ 10000m²（1辺 100mの 正方形）',
      `${m2}m²は ${kind === 'a' ? '100' : '10000'}m²の いくつ分かな。`,
    ],
    explain: `${a} × ${b} ＝ ${m2}m²。1${kind} ＝ ${kind === 'a' ? 100 : 10000}m²なので、${ans}${kind}です。`,
    identity: `large:${kind}:${Math.min(a, b)}x${Math.max(a, b)}`,
    alt: false,
    fields: [{ label: kind, answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [m2, 'unit-convert'],
      [kind === 'a' ? m2 / 10 : m2 / 100, 'unit-100'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['count', 'formula'] },
  { objs: ['formula', 'inverse', 'compound'] },
  { objs: ['units', 'large', 'compound'] },
  { objs: ['count', 'formula', 'inverse', 'compound', 'units', 'large'] },
];

export function generateArea(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < (obj === 'units' ? 0.15 : 0.3);
  switch (obj) {
    case 'count':
      return count(level, rng, alt);
    case 'formula':
      return formula(level, rng, alt);
    case 'inverse':
      return inverse(level, rng, alt);
    case 'compound':
      return compound(level, rng, alt);
    case 'units':
      return units(level, rng, alt);
    case 'large':
      return large(level, rng, alt);
  }
}

export const area: UnitSpec = finishUnit({
  id: 'g4.math.area',
  title: '面積',
  stage: 'g4',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: ['g4.math.order-ops'],
  objectives: [
    { id: 'count', title: '1cm²の いくつ分' },
    { id: 'formula', title: '長方形・正方形の 面積の 公式' },
    { id: 'inverse', title: '面積から 辺の 長さを 求める' },
    { id: 'compound', title: 'くふうして 求める 面積（L字・道）' },
    { id: 'units', title: '面積の 単位の 関係' },
    { id: 'large', title: '大きな 面積（m²・a・ha・km²）' },
  ],
  misconceptions: [
    {
      id: 'perimeter',
      explain:
        'まわりの 長さを 求めたのかな。面積は 広さ（1cm²の 正方形が いくつ分か）だよ。たて × 横で 求めよう。',
    },
    {
      id: 'add-sides',
      explain: 'たてと 横を たしたのかな。面積は たて × 横の かけ算だよ。',
    },
    {
      id: 'mult-instead',
      explain:
        '面積から 横の 長さを 求める ときは、面積 ÷ たて だよ。たて × □ ＝ 面積 の □を 考えよう。',
    },
    {
      id: 'half-area',
      explain:
        '面積を 2で わったのかな。正方形は 1辺 × 1辺 なので、同じ数を 2回 かけて 面積に なる 数を さがそう。',
    },
    {
      id: 'compound-whole',
      explain: '欠けて いる 部分を ひきわすれたのかな。大きい 長方形から、ない 部分を ひこう。',
    },
    {
      id: 'compound-overlap',
      explain: '同じ ところを 2回 数えたのかな。重なる 部分が ないように 分けよう。',
    },
    {
      id: 'frame-width',
      explain: '道は 両がわに あるよ。中の 長方形の たてと 横は、道の はばの 2つ分 短く なるね。',
    },
    {
      id: 'unit-100',
      explain:
        '1m ＝ 100cmだけど、1m² ＝ 100cm²では ないよ。たても 横も 100倍なので、1m² ＝ 100 × 100 ＝ 10000cm²。',
    },
    {
      id: 'unit-convert',
      explain: 'もとめた 面積の 単位を かえわすれたのかな。1a ＝ 100m²、1ha ＝ 10000m²だよ。',
    },
    {
      id: 'unit-mix',
      explain: 'たてと 横の 長さの 単位を そろえずに かけたのかな。先に 同じ 単位に そろえよう。',
    },
    {
      id: 'unit-scale',
      explain:
        '広さの 大きさに 合わない 単位かも。1cm²は 指先、1m²は 新聞紙 2まい、1km²は 町の 一部くらいの 広さだよ。',
    },
    {
      id: 'looks-big',
      explain: '見た目の 大きさで えらんだのかな。1cm²の ますが いくつ分かを 数えて くらべよう。',
    },
  ],
  levels: [
    { label: '1cm²の いくつ分・公式', chance: 0.05 },
    { label: '辺の 長さ・くふうした 求め方', chance: 0.02 },
    { label: '単位・大きな 面積', chance: 0.02 },
    { label: 'まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '広さの ことを 面積と いいます。1辺が 1cmの 正方形の 面積を 1平方センチメートルと いい、1cm²と 書きます。',
      figure: cellsFig([[0, 0]], 1, 1),
    },
    {
      text: '1cm²の 正方形が いくつ分かで、面積を 表します。この 長方形は 1cm²が 3 × 4 ＝ 12こ分で 12cm²。',
      figure: cellsFig(
        Array.from({ length: 12 }, (_, i) => [i % 4, Math.floor(i / 4)] as [number, number]),
        4,
        3,
      ),
    },
    {
      text: '長方形の 面積 ＝ たて × 横、正方形の 面積 ＝ 1辺 × 1辺。',
      figure: rectFig(3, 4, 'cm'),
    },
    {
      text: '広い ところの 面積は m²・km²を 使います。1m² ＝ 10000cm²、1a ＝ 100m²、1ha ＝ 10000m²、1km² ＝ 1000000m²。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateArea(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第4学年 B(4) 面積（cm²・m²・km²、a・ha、長方形・正方形の求積）',
  revised: REVISED,
});
