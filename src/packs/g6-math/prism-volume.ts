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

/** 角柱の見取図（底面の多角形を上下に描き、高さの辺でつなぐ）。base は 0〜1 の座標の底面 */
function prismFig(
  base: [number, number][],
  labels: string[],
  hLabel: string,
  label: string,
  topLabel?: string,
): Figure {
  const W = 150;
  const D = 60; // 奥行きの つぶし
  const H = 110;
  const P = (p: [number, number], top: boolean) =>
    [20 + p[0] * W, (top ? 0 : H) + 20 + D - p[1] * D] as const;
  const bot = base.map((p) => P(p, false));
  const top = base.map((p) => P(p, true));
  let body = `<polygon points="${top.map((p) => p.join(',')).join(' ')}" fill="var(--sky)" ${STROKE}/>`;
  // 下の底面: 手前の辺は実線、奥の辺は点線（y が 小さい=奥）
  bot.forEach((p, i) => {
    const q = bot[(i + 1) % bot.length]!;
    const back = base[i]![1] > 0.01 && base[(i + 1) % base.length]![1] > 0.01;
    body += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" ${back ? HID : STROKE}/>`;
  });
  base.forEach((b, i) => {
    const back = b[1] > 0.01 && base.some((o) => o[1] < b[1] - 0.01) && b[0] > 0.01 && b[0] < 0.99;
    body += `<line x1="${top[i]![0]}" y1="${top[i]![1]}" x2="${bot[i]![0]}" y2="${bot[i]![1]}" ${back ? HID : STROKE}/>`;
  });
  labels.forEach((l, i) => {
    if (!l) return;
    const a = bot[i]!;
    const b = bot[(i + 1) % bot.length]!;
    body += svgText((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 14, l, 14);
  });
  if (topLabel)
    body += svgText(
      top.reduce((s, p) => s + p[0], 0) / top.length,
      top.reduce((s, p) => s + p[1], 0) / top.length,
      topLabel,
      14,
    );
  const right = Math.max(...bot.map((p) => p[0]));
  body += svgText(right + 26, 20 + D + H / 2, hLabel, 14);
  return svg(230, 230, body, label);
}

function cylFig(rLabel: string, hLabel: string, label: string, topLabel?: string): Figure {
  const body =
    `<path d="M30 50 L30 170 A70 22 0 0 0 170 170 L170 50" fill="var(--sky)" ${STROKE}/>` +
    `<ellipse cx="100" cy="50" rx="70" ry="22" fill="var(--sky)" ${STROKE}/>` +
    `<path d="M30 170 A70 22 0 0 1 170 170" ${HID}/>` +
    (rLabel
      ? `<line x1="100" y1="50" x2="170" y2="50" ${STROKE}/>` + svgText(135, 38, rLabel, 14)
      : '') +
    svgText(196, 110, hLabel, 14) +
    (topLabel ? svgText(100, 50, topLabel, 14) : '');
  return svg(230, 210, body, label);
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
    fields: [{ label: 'cm³', answer }],
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
