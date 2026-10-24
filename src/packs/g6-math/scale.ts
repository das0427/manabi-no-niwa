/**
 * g6.math.scale 拡大図・縮図、縮尺（curriculum-matrix 3.9）。
 * 方眼にかく → 対応する辺の長さ・角の大きさ → 何倍の拡大図か → 縮尺で実際の長さ。
 *
 * 同一性キー: 作図は 形 × 倍率、辺・角は 三角形 × 倍率 × 問う所、縮尺は 縮尺 × 長さ × 向き（地図→実際／実際→地図）。
 * 縮尺の答えは整数になる数だけを選ぶ（計算が重くならないように）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { GeometryItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  finishUnit,
  fracAns,
  pick,
  pickObj,
  q,
  qText,
  r1,
  REVISED,
  STROKE,
  svg,
  svgText,
  wrongList,
} from './util';
import { ptsKey, randomPoly } from './symmetry';

type Obj = 'draw' | 'side' | 'ratio' | 'real';
type Pt = [number, number];

// ---- 方眼に かく ----
function drawItem(level: number, rng: Rng, alt: boolean): GeometryItem {
  // 拡大（2倍）、別例は 縮図（[[1/2]]）。縮図の元は 頂点が 偶数の 格子点
  const pts: Pt[] = alt
    ? randomPoly(rng, [0, 3], [0, 4]).map(([x, y]) => [x * 2, y * 2] as Pt)
    : randomPoly(rng, [0, 4], [0, 4]);
  const ratio = alt ? 0.5 : 2;
  return {
    engine: 'geometry',
    id: `draw${alt ? '-alt' : ''}:${ptsKey(pts)}`,
    objective: 'draw',
    level,
    prompt: alt
      ? 'かいて ある 形の [[1/2]]の 縮図を、方眼の あいて いる ところに かこう。'
      : 'かいて ある 形の 2倍の 拡大図を、方眼の あいて いる ところに かこう。',
    hints: [
      '対応する 辺の 長さを、どれも 同じ 倍に しよう。角の 大きさは 変えないよ。',
      alt
        ? '横に 2ます 進む 辺は 1ます、縦《たて》に 4ます 進む 辺は 2ますに なるよ。'
        : '横に 1ます 進む 辺は 2ます、縦《たて》に 3ます 進む 辺は 6ますに なるよ。',
      '1つの 頂点を 決めたら、そこから 横と 縦《たて》の ます目を 数えて 次の 頂点を 打とう。',
    ],
    explain: alt
      ? '縮図では、対応する 辺の 長さが どれも [[1/2]]に なり、対応する 角の 大きさは 等しく なります。'
      : '拡大図では、対応する 辺の 長さが どれも 2倍に なり、対応する 角の 大きさは 等しく なります。',
    identity: `draw:${ratio}:${ptsKey(pts)}`,
    alt,
    task: {
      kind: 'draw',
      grid: { w: 15, h: 10 },
      given: [{ points: pts }],
      target: { kind: 'similar', points: pts, ratio },
    },
    misconceptions: { sameSize: 'same-size' },
  };
}

// ---- 対応する 辺・角 ----
/** 三角形 ABC（辺 BC ＝ a、CA ＝ b、AB ＝ c）を描く座標（B が原点、C が右） */
function triCoords(a: number, b: number, c: number): [Pt, Pt, Pt] {
  const ax = (c * c + a * a - b * b) / (2 * a);
  const ay = Math.sqrt(Math.max(c * c - ax * ax, 0.01));
  return [
    [ax, -ay],
    [0, 0],
    [a, 0],
  ];
}

function twoTriFig(
  t: [Pt, Pt, Pt],
  k: number,
  labels1: { ab?: string; bc?: string; ca?: string; angB?: string; angC?: string },
  labels2: { de?: string; ef?: string; fd?: string; angE?: string },
): Figure {
  const xs = t.map((p) => p[0]);
  const ys = t.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const big = Math.max(k, 1);
  const U = Math.min(170 / (w * big), 120 / (h * big), 40);
  const u1 = k >= 1 ? U : U / k;
  const u2 = k >= 1 ? U * k : U;
  let body = '';
  let ox = 30;
  const tri = (
    u: number,
    names: string[],
    lab: (string | undefined)[],
    ang: (string | undefined)[],
  ) => {
    const P = (p: Pt) =>
      [r1(ox + (p[0] - Math.min(...xs)) * u), r1(30 + (p[1] - Math.min(...ys)) * u)] as const;
    const ps = t.map(P);
    body += `<polygon points="${ps.map((p) => p.join(',')).join(' ')}" fill="var(--sky)" ${STROKE}/>`;
    const cx = (ps[0]![0] + ps[1]![0] + ps[2]![0]) / 3;
    const cy = (ps[0]![1] + ps[1]![1] + ps[2]![1]) / 3;
    ps.forEach((p, i) => {
      const dx = p[0] - cx;
      const dy = p[1] - cy;
      const l = Math.hypot(dx, dy) || 1;
      body += svgText(p[0] + (dx / l) * 16, p[1] + (dy / l) * 16, names[i]!, 16);
      if (ang[i]) body += svgText(p[0] - (dx / l) * 26, p[1] - (dy / l) * 22, ang[i]!, 13);
    });
    // 辺の 長さ（AB・BC・CA の 順）
    [
      [0, 1],
      [1, 2],
      [2, 0],
    ].forEach(([i, j], s) => {
      if (!lab[s]) return;
      const mx = (ps[i!]![0] + ps[j!]![0]) / 2;
      const my = (ps[i!]![1] + ps[j!]![1]) / 2;
      const dx = mx - cx;
      const dy = my - cy;
      const l = Math.hypot(dx, dy) || 1;
      body += svgText(mx + (dx / l) * 18, my + (dy / l) * 16, lab[s]!, 14);
    });
    ox += w * u + 50;
  };
  tri(
    u1,
    ['A', 'B', 'C'],
    [labels1.ab, labels1.bc, labels1.ca],
    [undefined, labels1.angB, labels1.angC],
  );
  tri(
    u2,
    ['D', 'E', 'F'],
    [labels2.de, labels2.ef, labels2.fd],
    [undefined, labels2.angE, undefined],
  );
  const W = r1(ox - 20);
  const H = r1(h * Math.max(u1, u2) + 70);
  return svg(W, H, body, `三角形ABCと、その ${k >= 1 ? '拡大図' : '縮図'}の 三角形DEF`);
}

interface Tri {
  a: number;
  b: number;
  c: number;
}
const TRIS: Tri[] = [];
for (let a = 3; a <= 7; a++)
  for (let b = 3; b <= 7; b++)
    for (let c = 2; c <= 6; c++)
      if (b < a + c - 1 && b > Math.abs(a - c) + 1 && !(a === b && b === c)) TRIS.push({ a, b, c });
const KS = [2, 3, 0.5];
const kText = (k: number) => (k >= 1 ? `${k}倍の 拡大図` : `${qText(q(1, 1 / k))}の 縮図`);
const mul = (x: number, k: number) => Math.round(x * k * 10) / 10;

function sideItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const tr = pick(rng, TRIS);
  const k = pick(rng, KS);
  // 縮図のときは 辺の 長さを 偶数に（答えが 整数）
  const t = k < 1 ? { a: tr.a * 2, b: tr.b * 2, c: tr.c * 2 } : tr;
  const co = triCoords(t.a, t.b, t.c);
  if (alt) {
    // 角の 大きさ: 角Bの 大きさ（三角形の 形から 計算して 整数に）
    const B = Math.round(
      (Math.acos((t.a * t.a + t.c * t.c - t.b * t.b) / (2 * t.a * t.c)) * 180) / Math.PI,
    );
    const answer = { kind: 'int' as const, value: B };
    return {
      engine: 'number',
      id: `side-alt:${t.a},${t.b},${t.c}:${k}`,
      objective: 'side',
      level,
      prompt: `三角形DEFは 三角形ABCの ${kText(k)}です。角Eの 大きさは 何度ですか。`,
      figure: twoTriFig(
        co,
        k,
        { ab: `${t.c}cm`, bc: `${t.a}cm`, angB: `${B}°` },
        { de: `${mul(t.c, k)}cm` },
      ),
      hints: [
        '角Eに 対応する 角は どれか 考えよう。',
        '拡大図・縮図では、対応する 角の 大きさは どう なるかな。',
        '角Eに 対応するのは 角Bだね。',
      ],
      explain: `拡大図や 縮図では、対応する 角の 大きさは 等しく なります。角Eは 角Bと 同じ ${B}度です。`,
      identity: `side:angle:${t.a},${t.b},${t.c}:${k}`,
      alt: true,
      fields: [{ label: '度', answer }],
      wrongAnswers: wrongList(
        [answer],
        [
          [k >= 1 ? B * k : B / 2, 'angle-scale'],
          [180 - B, 'angle-scale'],
        ],
      ),
    };
  }
  const which = pick(rng, ['ef', 'fd'] as const);
  const known = which === 'ef' ? t.a : t.b;
  const ans = mul(known, k);
  const answer = { kind: 'int' as const, value: ans };
  const diff = mul(t.c, k) - t.c;
  return {
    engine: 'number',
    id: `side:${t.a},${t.b},${t.c}:${k}:${which}`,
    objective: 'side',
    level,
    prompt: `三角形DEFは 三角形ABCの ${kText(k)}です。辺${which === 'ef' ? 'EF' : 'FD'}の 長さは 何cmですか。`,
    figure: twoTriFig(
      co,
      k,
      { ab: `${t.c}cm`, bc: `${t.a}cm`, ca: `${t.b}cm` },
      { de: `${mul(t.c, k)}cm`, ...(which === 'ef' ? { ef: '?' } : { fd: '?' }) },
    ),
    hints: [
      `辺${which === 'ef' ? 'EF' : 'FD'}に 対応する 辺は どれか 考えよう。`,
      `対応するのは 辺${which === 'ef' ? 'BC' : 'CA'}（${known}cm）。辺ABが ${t.c}cm、辺DEが ${mul(t.c, k)}cmだね。`,
      k >= 1 ? `${known}cmを ${k}倍に しよう。` : `${known}cmを [[1/${1 / k}]]に しよう。`,
    ],
    explain: `辺${which === 'ef' ? 'EF' : 'FD'}に 対応する 辺は 辺${which === 'ef' ? 'BC' : 'CA'}です。${kText(k)}なので、${known} × ${k >= 1 ? k : qText(q(1, 1 / k))} ＝ ${ans}（cm）です。`,
    identity: `side:${t.a},${t.b},${t.c}:${k}:${which}`,
    alt: false,
    fields: [{ label: 'cm', answer }],
    wrongAnswers: wrongList(
      [answer],
      [
        [known + diff, 'add-not-mult'],
        // 拡大を 縮小と 取りちがえた 答え（わり切れる ときだけ。割り切れない 小数は 入力されない）
        [k >= 1 ? (known % k === 0 ? known / k : null) : known * 2, 'inverse-ratio'],
        [known, 'same-size'],
      ],
    ),
  };
}

// ---- 何倍の 拡大図か ----
function ratioItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const big = rng.next() < 0.6;
  const k = rng.int(2, 4);
  if (alt) {
    // 方眼の 長方形（ます目を 数える）
    const w = rng.int(1, 3);
    const h = rng.int(1, 3);
    const [w1, h1, w2, h2] = big ? [w, h, w * k, h * k] : [w * k, h * k, w, h];
    const U = 18;
    let body = '';
    const gw = w1 + w2 + 3;
    const gh = Math.max(h1, h2) + 2;
    for (let x = 0; x <= gw; x++)
      body += `<line x1="${10 + x * U}" y1="10" x2="${10 + x * U}" y2="${10 + gh * U}" stroke="var(--ink)" stroke-width="0.6"/>`;
    for (let y = 0; y <= gh; y++)
      body += `<line x1="10" y1="${10 + y * U}" x2="${10 + gw * U}" y2="${10 + y * U}" stroke="var(--ink)" stroke-width="0.6"/>`;
    body += `<rect x="${10 + U}" y="${10 + U}" width="${w1 * U}" height="${h1 * U}" fill="var(--sky)" ${STROKE}/>`;
    body += `<rect x="${10 + (w1 + 2) * U}" y="${10 + U}" width="${w2 * U}" height="${h2 * U}" fill="var(--sun)" ${STROKE}/>`;
    body += svgText(10 + U + (w1 * U) / 2, 10 + U + (h1 * U) / 2, 'A', 15);
    body += svgText(10 + (w1 + 2) * U + (w2 * U) / 2, 10 + U + (h2 * U) / 2, 'B', 15);
    const ans = big ? q(k) : q(1, k);
    const answer = fracAns(ans);
    return {
      engine: 'number',
      id: `ratio-alt:${w1}x${h1}:${w2}x${h2}`,
      objective: 'ratio',
      level,
      prompt: big
        ? '長方形Bは 長方形Aの 何倍の 拡大図ですか。'
        : '長方形Bは 長方形Aの 何分の1の 縮図ですか。分数で 答えよう。',
      figure: svg(
        r1(gw * U + 20),
        r1(gh * U + 20),
        body,
        `方眼に かいた 長方形Aと 長方形B。Aは 横 ${w1}ます・縦 ${h1}ます、Bは 横 ${w2}ます・縦 ${h2}ます`,
      ),
      hints: [
        '対応する 辺の ます目を 数えて くらべよう。',
        `Aの 横は ${w1}ます、Bの 横は ${w2}ます。`,
        `Bの 横は Aの 横の 何倍かな。${w2} ÷ ${w1}を 計算しよう。`,
      ],
      explain: `Bの 辺の 長さは どれも Aの ${qText(ans)}倍なので、Bは Aの ${big ? `${k}倍の 拡大図` : `${qText(ans)}の 縮図`}です。`,
      identity: `ratio:grid:${w1}x${h1}:${w2}x${h2}`,
      alt: true,
      fields: [{ answer }],
      keys: ['fraction'],
      wrongAnswers: wrongList(
        [answer],
        [
          [big ? `1/${k}` : String(k), 'inverse-ratio'],
          [Math.abs(w2 - w1), 'add-not-mult'],
        ],
      ),
    };
  }
  const a = rng.int(2, 9);
  const b = a * k;
  const [ab, de] = big ? [a, b] : [b, a];
  const ans = big ? q(k) : q(1, k);
  const answer = fracAns(ans);
  return {
    engine: 'number',
    id: `ratio:${ab}:${de}`,
    objective: 'ratio',
    level,
    prompt: big
      ? `三角形ABCと 三角形DEFは 形が 同じで、辺ABが ${ab}cm、対応する 辺DEが ${de}cmです。三角形DEFは 三角形ABCの 何倍の 拡大図ですか。`
      : `三角形ABCと 三角形DEFは 形が 同じで、辺ABが ${ab}cm、対応する 辺DEが ${de}cmです。三角形DEFは 三角形ABCの 何分の1の 縮図ですか。分数で 答えよう。`,
    hints: [
      '対応する 辺の 長さを くらべよう。',
      `辺DEは 辺ABの 何倍かな。${de} ÷ ${ab}を 計算しよう。`,
      big ? `${de} ÷ ${ab} の 商が 答えだよ。` : `${de} ÷ ${ab} ＝ [[${de}/${ab}]]。約分しよう。`,
    ],
    explain: `${de} ÷ ${ab} ＝ ${qText(ans)}。三角形DEFは 三角形ABCの ${big ? `${k}倍の 拡大図` : `${qText(ans)}の 縮図`}です。`,
    identity: `ratio:${ab}:${de}`,
    alt: false,
    fields: [{ answer }],
    keys: ['fraction'],
    wrongAnswers: wrongList(
      [answer],
      [
        [big ? `1/${k}` : String(k), 'inverse-ratio'],
        [Math.abs(de - ab), 'add-not-mult'],
      ],
    ),
  };
}

// ---- 縮尺 ----
const SCALES = [1000, 2000, 5000, 10000, 20000, 25000, 50000];
function realItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const N = pick(rng, SCALES);
  const L = rng.int(1, 8);
  const meters = (L * N) / 100;
  const asFrac = rng.next() < 0.5;
  const scaleText = asFrac ? `[[1/${N}]]` : `1:${N}`;
  if (alt) {
    const answer = { kind: 'int' as const, value: L };
    return {
      engine: 'number',
      id: `real-alt:${N}:${meters}:${asFrac ? 'f' : 'r'}`,
      objective: 'real',
      level,
      prompt: `実際の 長さが ${meters}mの 道を、縮尺 ${scaleText}の 地図に かきます。地図の 上では 何cmに なりますか。`,
      hints: [
        `縮尺 ${scaleText}は、実際の 長さを [[1/${N}]]に 縮めた ことを 表すよ。`,
        `まず 単位を そろえよう。${meters}m ＝ ${meters * 100}cm。`,
        `${meters * 100}cmを ${N}で わろう。`,
      ],
      explain: `${meters}m ＝ ${meters * 100}cm。${meters * 100} ÷ ${N} ＝ ${L}なので、地図の 上では ${L}cmです。`,
      identity: `real:map:${N}:${meters}:${asFrac ? 'f' : 'r'}`,
      alt: true,
      fields: [{ label: 'cm', answer }],
      keys: ['decimal'],
      wrongAnswers: wrongList(
        [answer],
        [
          [String(meters / N), 'unit-conv'],
          [String((meters * 1000) / N), 'unit-conv'],
        ],
      ),
    };
  }
  const answer = { kind: 'int' as const, value: meters };
  return {
    engine: 'number',
    id: `real:${N}:${L}:${asFrac ? 'f' : 'r'}`,
    objective: 'real',
    level,
    prompt: `縮尺 ${scaleText}の 地図で、${L}cmの 長さは 実際には 何mですか。`,
    hints: [
      `縮尺 ${scaleText}は、地図の 1cmが 実際には ${N}cmと いう ことだよ。`,
      `${L}cmは 実際には ${L} × ${N} ＝ ${L * N}cm。`,
      `cmを mに なおそう。100cm ＝ 1m だね。`,
    ],
    explain: `${L} × ${N} ＝ ${L * N}（cm）。${L * N}cm ＝ ${meters}mです。`,
    identity: `real:${N}:${L}:${asFrac ? 'f' : 'r'}`,
    alt: false,
    fields: [{ label: 'm', answer }],
    wrongAnswers: wrongList(
      [answer],
      [
        [L * N, 'unit-conv'],
        [(L * N) / 1000, 'unit-conv'],
        [(L * N) / 10, 'unit-conv'],
      ],
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['draw', 'side'] },
  { objs: ['ratio', 'side', 'draw'] },
  { objs: ['real', 'ratio'] },
  { objs: ['real', 'side', 'ratio', 'draw'] },
];

export function generateScale(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'draw':
      return drawItem(level, rng, alt);
    case 'side':
      return sideItem(level, rng, alt);
    case 'ratio':
      return ratioItem(level, rng, alt);
    case 'real':
      return realItem(level, rng, alt);
  }
}

export const scale: UnitSpec = finishUnit({
  id: 'g6.math.scale',
  title: '拡大図と 縮図',
  stage: 'g6',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'look',
  prereq: ['g5.math.congruence'],
  objectives: [
    { id: 'draw', title: '方眼に 拡大図・縮図を かく' },
    { id: 'side', title: '対応する 辺の 長さ・角の 大きさ' },
    { id: 'ratio', title: '何倍の 拡大図・何分の1の 縮図か' },
    { id: 'real', title: '縮尺と 実際の 長さ' },
  ],
  misconceptions: [
    {
      id: 'add-not-mult',
      explain:
        '長さの 差を たしたり ひいたり したのかな。拡大図・縮図では、どの 辺も 同じ「倍」に なるよ。たし算では 形が 変わって しまうね。',
    },
    {
      id: 'same-size',
      explain:
        'もとの 形と 同じ 大きさに したのかな。拡大図は 大きく、縮図は 小さく、辺の 長さを 同じ 倍に しよう。',
    },
    {
      id: 'inverse-ratio',
      explain:
        '拡大と 縮小を 反対に したのかな。もとに する 形は どちらか、大きく なるのか 小さく なるのか たしかめよう。',
    },
    {
      id: 'angle-scale',
      explain:
        '角の 大きさも 変えたのかな。拡大図・縮図では、対応する 角の 大きさは 変わらないよ。',
    },
    {
      id: 'unit-conv',
      explain:
        '単位の なおし方を まちがえたのかな。縮尺の 計算は まず cmで 考えて、さいごに 100cm ＝ 1mで mに なおそう。',
    },
  ],
  levels: [
    { label: '方眼に かく・対応する 辺', chance: 0.05 },
    { label: '何倍か', chance: 0.05 },
    { label: '縮尺', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '形を 変えずに、対応する 辺の 長さを どれも 同じ 倍に のばした 図を 拡大図、縮めた 図を 縮図と いいます。',
      figure: twoTriFig(
        triCoords(4, 3, 3),
        2,
        { ab: '3cm', bc: '4cm', ca: '3cm' },
        { de: '6cm', ef: '8cm', fd: '6cm' },
      ),
    },
    { text: '拡大図・縮図では、対応する 角の 大きさは 等しく なります。' },
    {
      text: '実際の 長さを 縮めた 割合を 縮尺と いいます。縮尺 1:1000（[[1/1000]]）の 地図の 3cmは、実際には 3 × 1000 ＝ 3000cm ＝ 30mです。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateScale(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第6学年 B(1) 縮図や拡大図（縮尺を含む）',
  revised: REVISED,
});
