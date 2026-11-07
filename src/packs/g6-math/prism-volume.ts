/**
 * g6.math.prism-volume 角柱・円柱の体積（curriculum-matrix 3.9）。
 * 底面積 × 高さ → 角柱（三角柱・四角柱）→ 円柱。
 *
 * 円柱の体積は 100分の1 の整数で計算する。同一性キー: 立体 × 長さ。別例は見取図だけで示す問題（':fig'）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  dec,
  decAns,
  finishUnit,
  pick,
  pickObj,
  REVISED,
  STROKE,
  svg,
  svgText,
  wrongList,
} from './util';

type Obj = 'base' | 'tri' | 'quad' | 'cyl';

const HID = 'stroke="var(--ink)" stroke-width="2" stroke-dasharray="5 4" fill="none"';

/** 図の字の大きさ（viewBox の単位）。図の段の高さに入れるため、図を小さめに描いて字を大きくする（text-layout-fixes 第4回） */
const FS = 20;
/** 字の外接の幅（1字 ＝ 字の大きさの 0.62） */
const tw = (t: string) => t.length * FS * 0.62;

/** 角柱の見取図（底面の多角形を上下に描き、高さの辺でつなぐ）。base は 0〜1 の座標の底面 */
function prismFig(
  base: [number, number][],
  labels: string[],
  hLabel: string,
  label: string,
  topLabel?: string,
): Figure {
  const W = 130;
  const D = 70; // 奥行きの つぶし（上の面に 底面積の 字が 入る 高さ）
  const H = 80;
  const X0 = 8;
  const Y0 = 8;
  const P = (p: [number, number], top: boolean) =>
    [X0 + p[0] * W, (top ? 0 : H) + Y0 + D - p[1] * D] as const;
  const bot = base.map((p) => P(p, false));
  const top = base.map((p) => P(p, true));
  // 奥の（見えない）辺は 上の面の 下に かくす: 先に 辺を かき、上の面を 最後に かく
  let body = '';
  // 見えない 辺を 点線に する。側面（底面の 辺 i の 上の 面）は、外向きの 法線が 奥（base の y が 大きい 向き）を
  // 向くと 見えない。下の底面の 辺は その 側面が 見えないとき、たての 辺は 両どなりの 側面が 見えないとき 点線。
  // （以前は「両はしが 奥に ある 辺」だけを 点線に して いたので、三角柱・平行四辺形の 柱で 奥へ 向かう 底面の 辺が 実線に なって いた）
  const n = base.length;
  const area = base.reduce((s, p, i) => {
    const q = base[(i + 1) % n]!;
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
  const hiddenFace = base.map((p, i) => {
    const q = base[(i + 1) % n]!;
    // 反時計回りの とき 外向きの 法線は (dy, -dx)。その y 成分 ＝ -dx
    const ny = (area > 0 ? -1 : 1) * (q[0] - p[0]);
    return ny > 1e-6;
  });
  bot.forEach((p, i) => {
    const q = bot[(i + 1) % n]!;
    body += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" ${hiddenFace[i] ? HID : STROKE}/>`;
  });
  base.forEach((_, i) => {
    const back = hiddenFace[i]! && hiddenFace[(i - 1 + n) % n]!;
    body += `<line x1="${top[i]![0]}" y1="${top[i]![1]}" x2="${bot[i]![0]}" y2="${bot[i]![1]}" ${back ? HID : STROKE}/>`;
  });
  const topPoly = `<polygon points="${top.map((p) => p.join(',')).join(' ')}" fill="var(--sky)" ${STROKE}/>`;
  body += topPoly;
  // 字の外接を集めて、viewBox を 形と 字の 外接に 合わせる（字は 辺の 外側に 置く）
  let x0 = 0;
  let y0 = 0;
  let x1 = Math.max(...bot.map((p) => p[0])) + 4;
  let y1 = Math.max(...bot.map((p) => p[1])) + 4;
  const put = (x: number, y: number, t: string, anchor: 'start' | 'middle') => {
    body += svgText(x, y, t, FS, anchor);
    const l = anchor === 'start' ? x : x - tw(t) / 2;
    x0 = Math.min(x0, l - 2);
    x1 = Math.max(x1, l + tw(t) + 2);
    y0 = Math.min(y0, y - FS * 0.6);
    y1 = Math.max(y1, y + FS * 0.6);
  };
  const cx = bot.reduce((s, p) => s + p[0], 0) / bot.length;
  const cy = bot.reduce((s, p) => s + p[1], 0) / bot.length;
  labels.forEach((l, i) => {
    if (!l) return;
    const a = bot[i]!;
    const b = bot[(i + 1) % bot.length]!;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    // 辺の 垂線の 向きに、字の 箱が 辺に かからない だけ 離す
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const el = Math.hypot(ex, ey) || 1;
    let nx = -ey / el;
    let ny = ex / el;
    // 横の 辺は 下（外側）に、ななめの 辺は 底面の 中（内側）に 置く（外側に 置くと、手前の たての 辺に かかる）
    const out = (mx - cx) * nx + (my - cy) * ny >= 0;
    if (Math.abs(ny) > 0.7 ? !out : out) {
      nx = -nx;
      ny = -ny;
    }
    const dist = Math.abs(nx) * (tw(l) / 2) + Math.abs(ny) * FS * 0.55 + 5;
    put(mx + nx * dist, my + ny * dist, l, 'middle');
  });
  if (topLabel)
    put(
      top.reduce((s, p) => s + p[0], 0) / top.length,
      top.reduce((s, p) => s + p[1], 0) / top.length + D * 0.1,
      topLabel,
      'middle',
    );
  put(Math.max(...bot.map((p) => p[0])) + 8, Y0 + D + H / 2, hLabel, 'start');
  return svg(
    Math.ceil(x1 - x0),
    Math.ceil(y1 - y0),
    `<g transform="translate(${-x0} ${-y0})">${body}</g>`,
    label,
  );
}

function cylFig(rLabel: string, hLabel: string, label: string, topLabel?: string): Figure {
  // 上の楕円の中心 (80, 34)、横 62・縦 22、高さ 96。半径の字は 半径の線の右の端の外に置く
  const body =
    `<path d="M18 34 L18 130 A62 22 0 0 0 142 130 L142 34" fill="var(--sky)" ${STROKE}/>` +
    `<ellipse cx="80" cy="34" rx="62" ry="22" fill="var(--sky)" ${STROKE}/>` +
    `<path d="M18 130 A62 22 0 0 1 142 130" ${HID}/>` +
    (rLabel
      ? `<line x1="80" y1="34" x2="142" y2="34" ${STROKE}/>` +
        svgText(148, 34, rLabel, FS, 'start')
      : '') +
    svgText(150, 96, hLabel, FS, 'start') +
    (topLabel ? svgText(80, 34, topLabel, FS) : '');
  const w = 150 + Math.max(tw(hLabel), rLabel ? tw(rLabel) - 2 : 0) + 4;
  return svg(Math.ceil(w), 160, body, label);
}

function numItem(
  obj: Obj,
  level: number,
  alt: boolean,
  key: string,
  prompt: string,
  figure: Figure | undefined,
  ans: number,
  places: number,
  hints: [string, string, string],
  explain: string,
  wrongs: [number | null, string][],
): NumberItem {
  const answer = decAns(ans, places);
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${key}`,
    objective: obj,
    level,
    prompt,
    figure,
    hints,
    explain,
    identity: `${obj}:${key}${alt ? ':fig' : ''}`,
    alt,
    fields: [{ unit: 'cm³', answer }],
    keys: places > 0 ? ['decimal'] : undefined,
    wrongAnswers: wrongList(
      [answer],
      wrongs.map(([v, m]) => [v === null ? null : dec(v, places), m] as [string | null, string]),
    ),
  };
}

function baseItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const S = rng.int(4, 30);
  const h = rng.int(2, 12);
  const solid = pick(rng, ['三角柱', '四角柱', '五角柱', '円柱'] as const);
  return numItem(
    'base',
    level,
    alt,
    `${solid}:${S}:${h}`,
    alt
      ? `この ${solid}の 体積は 何cm³ですか。`
      : `底面積が ${S}cm²、高さが ${h}cmの ${solid}の 体積は 何cm³ですか。`,
    alt
      ? solid === '円柱'
        ? cylFig('', `${h}cm`, `底面積 ${S}cm²、高さ ${h}cmの 円柱`, `${S}cm²`)
        : prismFig(
            solid === '三角柱'
              ? [
                  [0, 0],
                  [1, 0],
                  [0.4, 1],
                ]
              : solid === '四角柱'
                ? [
                    [0, 0],
                    [0.8, 0],
                    [1, 1],
                    [0.2, 1],
                  ]
                : [
                    [0.1, 0],
                    [0.9, 0],
                    [1, 0.6],
                    [0.5, 1],
                    [0, 0.6],
                  ],
            [],
            `${h}cm`,
            `底面積 ${S}cm²、高さ ${h}cmの ${solid}`,
            `${S}cm²`,
          )
      : undefined,
    S * h,
    0,
    [
      '角柱・円柱の 体積は、底面積 × 高さ で 求められるよ。',
      `底面積は ${S}cm²、高さは ${h}cm。`,
      `${S} × ${h}を 計算しよう。`,
    ],
    `${S} × ${h} ＝ ${S * h}（cm³）。角柱・円柱の 体積は 底面積 × 高さです。${alt ? '（図の 上の 面に 書いて ある 数が 底面積）' : ''}`,
    [
      [S + h, 'add-instead'],
      [solid === '三角柱' && (S * h) % 2 === 0 ? (S * h) / 2 : null, 'extra-half'],
      [S * h * 2, 'extra-half'],
    ],
  );
}

function triItem(level: number, rng: Rng, alt: boolean): NumberItem {
  let a = rng.int(2, 10);
  const b = rng.int(2, 10);
  if ((a * b) % 2 === 1) a += 1;
  const h = rng.int(2, 12);
  const S = (a * b) / 2;
  return numItem(
    'tri',
    level,
    alt,
    `${a}:${b}:${h}`,
    alt
      ? 'この 三角柱の 体積は 何cm³ですか。底面は 直角三角形です。'
      : `底面が、直角を はさむ 2つの 辺が ${a}cmと ${b}cmの 直角三角形で、高さが ${h}cmの 三角柱が あります。体積は 何cm³ですか。`,
    alt
      ? prismFig(
          [
            [0, 0],
            [1, 0],
            // 奥の 頂点を 真上に 置くと、底面の 辺（b）が 手前の 高さの 辺と 重なって 高さと 見分けられないので ずらす
            [0.25, 1],
          ],
          [`${a}cm`, '', `${b}cm`],
          `${h}cm`,
          `底面が 直角三角形（直角を はさむ 辺 ${a}cmと ${b}cm）、高さ ${h}cmの 三角柱`,
        )
      : undefined,
    S * h,
    0,
    [
      'まず 底面の 三角形の 面積を 求めよう。',
      `底面積は ${a} × ${b} ÷ 2 ＝ ${S}cm²。`,
      `${S} × ${h}を 計算しよう。`,
    ],
    `底面積は ${a} × ${b} ÷ 2 ＝ ${S}（cm²）。体積は ${S} × ${h} ＝ ${S * h}（cm³）。`,
    [
      [a * b * h, 'no-half'],
      [S + h, 'add-instead'],
      [a * b + h, 'add-instead'],
    ],
  );
}

function quadItem(level: number, rng: Rng, alt: boolean): NumberItem {
  // 底面が 台形（上底 u、下底 d、高さ t）の 四角柱。別例は 平行四辺形・ひし形
  const h = rng.int(2, 10);
  if (!alt) {
    const u = rng.int(2, 6);
    const d = u + rng.int(1, 5);
    let t = rng.int(2, 8);
    if (((u + d) * t) % 2 === 1) t += 1;
    const S = ((u + d) * t) / 2;
    return numItem(
      'quad',
      level,
      false,
      `trap:${u}:${d}:${t}:${h}`,
      `底面が、上底 ${u}cm、下底 ${d}cm、高さ ${t}cmの 台形で、高さが ${h}cmの 四角柱が あります。体積は 何cm³ですか。`,
      undefined,
      S * h,
      0,
      [
        'まず 底面の 台形の 面積を 求めよう。',
        `台形の 面積は (上底 ＋ 下底) × 高さ ÷ 2。(${u} ＋ ${d}) × ${t} ÷ 2 ＝ ${S}cm²。`,
        `${S} × ${h}を 計算しよう。`,
      ],
      `底面積は (${u} ＋ ${d}) × ${t} ÷ 2 ＝ ${S}（cm²）。体積は ${S} × ${h} ＝ ${S * h}（cm³）。`,
      [
        [(u + d) * t * h, 'no-half'],
        [S + h, 'add-instead'],
      ],
    );
  }
  const para = rng.next() < 0.5;
  const p = rng.int(2, 9);
  let r = rng.int(2, 9);
  if (!para && (p * r) % 2 === 1) r += 1;
  const S = para ? p * r : (p * r) / 2;
  return numItem(
    'quad',
    level,
    true,
    `${para ? 'para' : 'rhom'}:${p}:${r}:${h}`,
    para
      ? `この 四角柱の 底面は、底辺 ${p}cm・高さ ${r}cmの 平行四辺形です。四角柱の 高さは ${h}cmです。体積は 何cm³ですか。`
      : `この 四角柱の 底面は、対角線が ${p}cmと ${r}cmの ひし形です。四角柱の 高さは ${h}cmです。体積は 何cm³ですか。`,
    prismFig(
      para
        ? [
            [0, 0],
            [0.75, 0],
            [1, 1],
            [0.25, 1],
          ]
        : [
            [0.5, 0],
            [1, 0.5],
            [0.5, 1],
            [0, 0.5],
          ],
      [],
      `${h}cm`,
      para ? `底面が 平行四辺形の 四角柱` : `底面が ひし形の 四角柱`,
    ),
    S * h,
    0,
    [
      para
        ? '平行四辺形の 面積は 底辺 × 高さ だね。'
        : 'ひし形の 面積は 対角線 × 対角線 ÷ 2 だね。',
      `底面積は ${para ? `${p} × ${r}` : `${p} × ${r} ÷ 2`} ＝ ${S}cm²。`,
      `${S} × ${h}を 計算しよう。`,
    ],
    `底面積は ${para ? `${p} × ${r}` : `${p} × ${r} ÷ 2`} ＝ ${S}（cm²）。体積は ${S} × ${h} ＝ ${S * h}（cm³）。`,
    [
      [para ? (p * r * h) / 2 : p * r * h, para ? 'extra-half' : 'no-half'],
      [S + h, 'add-instead'],
    ],
  );
}

function cylItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const r = rng.int(1, 10);
  const h = rng.int(2, 10);
  const S100 = r * r * 314;
  const V = S100 * h;
  const d = r * 2;
  return numItem(
    'cyl',
    level,
    alt,
    `${alt ? 'd' : 'r'}:${r}:${h}`,
    alt
      ? `底面の 直径が ${d}cm、高さが ${h}cmの 円柱の 体積は 何cm³ですか。円周率は 3.14と します。`
      : `この 円柱の 体積は 何cm³ですか。円周率は 3.14と します。`,
    alt ? undefined : cylFig(`${r}cm`, `${h}cm`, `底面の 半径 ${r}cm、高さ ${h}cmの 円柱`),
    V,
    2,
    [
      '底面は 円。まず 底面積を 求めよう。',
      alt
        ? `半径は ${d} ÷ 2 ＝ ${r}cm。底面積は ${r} × ${r} × 3.14 ＝ ${dec(S100, 2)}cm²。`
        : `底面積は ${r} × ${r} × 3.14 ＝ ${dec(S100, 2)}cm²。`,
      `${dec(S100, 2)} × ${h}を 計算しよう。`,
    ],
    `底面積は ${r} × ${r} × 3.14 ＝ ${dec(S100, 2)}（cm²）。体積は ${dec(S100, 2)} × ${h} ＝ ${dec(V, 2)}（cm³）。`,
    [
      [d * d * 314 * h, 'diam-sq'],
      [d * 314 * h, 'circumference'],
      [r * 314 * h, 'no-square'],
    ],
  );
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['base', 'tri'] },
  { objs: ['tri', 'quad', 'base'] },
  { objs: ['cyl', 'base'] },
  { objs: ['cyl', 'quad', 'tri'] },
];

export function generatePrismVolume(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'base':
      return baseItem(level, rng, alt);
    case 'tri':
      return triItem(level, rng, alt);
    case 'quad':
      return quadItem(level, rng, alt);
    case 'cyl':
      return cylItem(level, rng, alt);
  }
}

export const prismVolume: UnitSpec = finishUnit({
  id: 'g6.math.prism-volume',
  title: '角柱と 円柱の 体積',
  stage: 'g6',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'g1m-cyl',
  prereq: ['g5.math.volume', 'g6.math.circle-area'],
  objectives: [
    { id: 'base', title: '底面積 × 高さ' },
    { id: 'tri', title: '三角柱の 体積' },
    { id: 'quad', title: '四角柱の 体積（台形・平行四辺形・ひし形の 底面）' },
    { id: 'cyl', title: '円柱の 体積' },
  ],
  misconceptions: [
    {
      id: 'add-instead',
      explain:
        'たし算を したのかな。体積は 底面積 × 高さ。底面の 上に 同じ 形が 高さの 分だけ 積み重なって いると 考えよう。',
    },
    {
      id: 'no-half',
      explain:
        '底面積を 求める ときに ÷ 2を 忘れたのかな。三角形・台形・ひし形の 面積の 公式を たしかめよう。',
    },
    {
      id: 'extra-half',
      explain: 'いらない ÷ 2（× 2）を したのかな。体積は 底面積 × 高さ だけで 求められるよ。',
    },
    {
      id: 'diam-sq',
      explain: '直径を 半径の かわりに 使ったのかな。底面の 円の 面積は 半径 × 半径 × 3.14 だよ。',
    },
    {
      id: 'circumference',
      explain:
        '底面の 円周の 長さを 使ったのかな。底面積（半径 × 半径 × 3.14）に 高さを かけよう。',
    },
    {
      id: 'no-square',
      explain: '半径を 1回しか かけて いないのかな。底面積は 半径 × 半径 × 3.14 だよ。',
    },
  ],
  levels: [
    { label: '底面積 × 高さ・三角柱', chance: 0.05 },
    { label: '四角柱', chance: 0.05 },
    { label: '円柱', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '直方体の 体積は 縦《たて》 × 横 × 高さ。縦《たて》 × 横は 底面の 面積（底面積）なので、底面積 × 高さとも いえます。',
    },
    {
      text: '角柱・円柱は、底面と 同じ 形が 高さの 分だけ 重なった 立体です。体積 ＝ 底面積 × 高さ で 求められます。',
      figure: prismFig(
        [
          [0, 0],
          [1, 0],
          [0.4, 1],
        ],
        [],
        '5cm',
        '三角柱の 見取図',
      ),
    },
    {
      text: '円柱は、底面積（半径 × 半径 × 3.14）に 高さを かけます。半径 2cm、高さ 5cmなら 2 × 2 × 3.14 × 5 ＝ 62.8cm³。',
      figure: cylFig('2cm', '5cm', '半径 2cm、高さ 5cmの 円柱'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generatePrismVolume(level, rng, index),
  },
  review: 'type',
  basis: '小学校学習指導要領（平成29年告示）算数 第6学年 B(4) 角柱及び円柱の体積',
  revised: REVISED,
});
