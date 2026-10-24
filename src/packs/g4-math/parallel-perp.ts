/**
 * g4.math.parallel-perp 垂直・平行（curriculum-matrix 3.7）。
 * 見つける → 作図（点を通る垂直・平行な直線）→ 平行な直線の性質（はば・角）。
 *
 * matrix は「手30」。本単元は直線の向き（方がんの格子の向き 9 種）と位置から生成する。
 * 見つける問題は、交わっていない直線も「のばすと直角に交わる」なら垂直（誤概念 must-cross）。
 * 同一性キー: 問う形 × 基準の直線の向き × 選択肢の並び（・点の位置）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { GeometryItem, Pt } from '../../engines/geometry/geometry';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { finishUnit, pick, pickObj, REVISED, STROKE, svg, svgText, wrongList } from './util';

type Obj = 'findPerp' | 'findPar' | 'drawPerp' | 'drawPar' | 'prop';

const DIRS: Pt[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
  [2, 1],
  [1, 2],
  [2, -1],
  [1, -2],
  [3, 1],
];
const perpOf = (v: Pt): Pt => [-v[1], v[0]];
/** 直角に近いが直角でない向き */
const nearPerp = (v: Pt): Pt => {
  const p = perpOf(v);
  const c: Pt = [p[0] + (p[1] === 0 ? 0 : 1), p[1] + (p[1] === 0 ? 1 : 0)];
  return c;
};
/** 平行に近いが平行でない向き */
const nearPar = (v: Pt): Pt => [v[0] + (v[1] === 0 ? 0 : 1), v[1] + (v[1] === 0 ? 1 : 0)];

const C = 30; // 1ますの大きさ（px）

/** 直線の線分（中心 c、向き v、長さ len ます）を SVG に */
function seg(c: [number, number], v: Pt, len: number, name: string, dashed = false): string {
  const L = Math.hypot(v[0], v[1]);
  const ux = (v[0] / L) * (len / 2);
  const uy = (v[1] / L) * (len / 2);
  const x1 = (c[0] - ux) * C;
  const y1 = (c[1] - uy) * C;
  const x2 = (c[0] + ux) * C;
  const y2 = (c[1] + uy) * C;
  const tx = (y1 < y2 ? x1 : x2) + 10;
  const ty = Math.min(y1, y2) - 10;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${STROKE}${dashed ? ' stroke-dasharray="6 5"' : ''}/>${svgText(tx, Math.max(12, ty), name, 18)}`;
}

function gridLines(w: number, h: number): string {
  let s = '';
  for (let x = 0; x <= w; x++) s += `<line x1="${x * C}" y1="0" x2="${x * C}" y2="${h * C}" stroke="var(--ink)" stroke-opacity="0.15" stroke-width="1"/>`;
  for (let y = 0; y <= h; y++) s += `<line x1="0" y1="${y * C}" x2="${w * C}" y2="${y * C}" stroke="var(--ink)" stroke-opacity="0.15" stroke-width="1"/>`;
  return s;
}

const NAMES = ['イ', 'ウ', 'エ', 'オ'];

/** 直線アと、イ〜エの 直線の 図 */
function linesFig(base: Pt, cands: Pt[], grid: boolean, crossPerp: boolean): Figure {
  const w = 14;
  const h = 7;
  let body = grid ? gridLines(w, h) : '';
  // 直線どうしが 重ならないよう、1本ずつ 区切った 場所に かく
  body += seg([2, 3.5], base, 3.6, 'ア');
  cands.forEach((v, i) => {
    body += seg([5.6 + i * 3 + (crossPerp && i === 0 ? -0.5 : 0), 3.5], v, 2.8, NAMES[i]!);
  });
  return svg(w * C, h * C, body, '直線アと 直線イ・ウ・エ');
}

/** 見つける（垂直・平行）。alt: 方がんの 上で */
function find(obj: 'findPerp' | 'findPar', level: number, rng: Rng, alt: boolean): ChoiceItem {
  const base = pick(rng, DIRS);
  const perp = obj === 'findPerp';
  const right = perp ? perpOf(base) : base;
  const other = perp ? base : perpOf(base);
  const near = perp ? nearPerp(base) : nearPar(base);
  const order = rng.shuffle([0, 1, 2]);
  const dirs = [right, other, near];
  const cands = order.map((k) => dirs[k]!);
  const names = order.map((_, i) => NAMES[i]!);
  const ans = names[order.indexOf(0)]!;
  const word = perp ? '垂直' : '平行';
  return {
    engine: 'choice',
    id: `${obj}${alt ? '-alt' : ''}:${base.join(',')}:${order.join('')}`,
    objective: obj,
    level,
    prompt: `直線アに ${word}な 直線は どれ？${alt ? '（方がんの ますを 使って 考えよう）' : ''}`,
    figure: linesFig(base, cands, alt, false),
    hints: [
      perp
        ? '2本の 直線が 直角に 交わるとき、垂直と いうよ。交わって いなくても、のばして 直角に 交われば 垂直だよ。'
        : '1本の 直線に 垂直な 2本の 直線は 平行だよ。どこまで のばしても 交わらないね。',
      alt
        ? `直線アは 横に ${Math.abs(base[0])}ます 進むと、たてに ${Math.abs(base[1])}ます 進むよ。`
        : '三角じょうぎの 直角の かどを あてて たしかめよう。',
      perp ? 'アを 回して 直角に なる 向きの 直線を さがそう。' : 'アと 同じ かたむきの 直線を さがそう。',
    ],
    explain: `直線${ans}が アに ${word}です。${perp ? '交わって いなくても、のばすと 直角に 交わります。' : 'はばが どこも 同じで、のばしても 交わりません。'}`,
    identity: `${obj}:${base.join(',')}:${order.join('')}${alt ? ':grid' : ''}`,
    alt,
    fixedOrder: true,
    options: names.map((nm, i) =>
      nm === ans
        ? { label: `直線${nm}`, correct: true }
        : { label: `直線${nm}`, misconception: order[i] === 1 ? 'perp-par-swap' : perp ? 'looks-90' : 'looks-par' },
    ),
  };
}

/** 作図: 点を 通る 垂直・平行な 直線（alt: ななめの 直線） */
function draw(obj: 'drawPerp' | 'drawPar', level: number, rng: Rng, alt: boolean): GeometryItem {
  const g = { w: 8, h: 6 };
  for (;;) {
    const v = alt ? pick(rng, DIRS.slice(2, 8)) : pick(rng, DIRS.slice(0, 2));
    const p1: Pt = [rng.int(0, g.w), rng.int(0, g.h)];
    const p2: Pt = [p1[0] + v[0] * (alt ? 2 : 3), p1[1] + v[1] * (alt ? 2 : 3)];
    if (p2[0] < 0 || p2[0] > g.w || p2[1] < 0 || p2[1] > g.h) continue;
    const through: Pt = [rng.int(0, g.w), rng.int(0, g.h)];
    const cross = (p2[0] - p1[0]) * (through[1] - p1[1]) - (p2[1] - p1[1]) * (through[0] - p1[0]);
    if (obj === 'drawPar' && cross === 0) continue;
    // 答えの直線が 格子の中に 2点 とれる
    const d = obj === 'drawPerp' ? perpOf(v) : v;
    const q1: Pt = [through[0] + d[0], through[1] + d[1]];
    const q2: Pt = [through[0] - d[0], through[1] - d[1]];
    const inG = (q: Pt) => q[0] >= 0 && q[0] <= g.w && q[1] >= 0 && q[1] <= g.h;
    if (!inG(q1) && !inG(q2)) continue;
    const word = obj === 'drawPerp' ? '垂直' : '平行';
    return {
      engine: 'geometry',
      id: `${obj}${alt ? '-alt' : ''}:${p1.join(',')}-${p2.join(',')}:${through.join(',')}`,
      objective: obj,
      level,
      prompt: `●の 点を 通って、直線に ${word}な 直線を ひこう。（点を 2つ タップ）`,
      hints: [
        obj === 'drawPerp' ? '垂直な 直線は、もとの 直線と 直角に 交わるよ。' : '平行な 直線は、もとの 直線と 同じ かたむきだよ。',
        `もとの 直線は 横に ${v[0]}ます、たてに ${Math.abs(v[1])}ます${v[1] < 0 ? '（上へ）' : v[1] > 0 ? '（下へ）' : ''} 進む かたむき。`,
        obj === 'drawPerp'
          ? `●から、横に ${Math.abs(d[0])}ます、たてに ${Math.abs(d[1])}ます 進んだ 点と 結ぼう。向きに 気を つけてね。`
          : `●から、もとの 直線と 同じように 横に ${v[0]}ます、たてに ${Math.abs(v[1])}ます 進んだ 点と 結ぼう。`,
      ],
      explain:
        obj === 'drawPerp'
          ? `●を 通り、もとの 直線と 直角に 交わる 直線を ひきます。方がんでは、横と たての 進み方を 入れかえた 向きに なります。`
          : `●を 通り、もとの 直線と 同じ かたむきの 直線を ひきます。2本の 直線の はばは どこも 同じです。`,
      identity: `${obj}:${p1.join(',')}-${p2.join(',')}:${through.join(',')}`,
      alt,
      task: {
        kind: 'draw',
        grid: g,
        target: { kind: obj === 'drawPerp' ? 'perpendicular' : 'parallel', to: [p1, p2], through },
      },
      misconceptions: { swapPerpPar: 'perp-par-swap', notThrough: 'not-through' },
    };
  }
}

/** 平行な 直線の 性質（角・はば）。alt: はば */
function prop(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const wcm = rng.int(2, 9);
    const answers = [{ kind: 'int' as const, value: wcm }];
    const pos = rng.int(0, 2);
    let body = '';
    body += `<line x1="10" y1="40" x2="330" y2="40" ${STROKE}/>${svgText(345, 40, 'ア', 18)}`;
    body += `<line x1="10" y1="140" x2="330" y2="140" ${STROKE}/>${svgText(345, 140, 'イ', 18)}`;
    body += `<line x1="60" y1="40" x2="60" y2="140" ${STROKE} stroke-dasharray="6 5"/>${svgText(80, 90, `${wcm}cm`, 16, 'start')}`;
    const x2 = [180, 240, 300][pos]!;
    body += `<line x1="${x2}" y1="40" x2="${x2}" y2="140" ${STROKE} stroke-dasharray="6 5"/>${svgText(x2 + 14, 90, '？', 18, 'start')}`;
    return {
      engine: 'number',
      id: `prop-alt:width:${wcm}:${pos}`,
      objective: 'prop',
      level,
      prompt: '直線アと 直線イは 平行です。点線は どれも アと イに 垂直です。？の 長さは 何cmですか。',
      figure: svg(370, 180, body, '平行な 2本の 直線と はば'),
      hints: [
        '平行な 2本の 直線の はばは、どこで はかっても 同じだよ。',
        'はばは、2本の 直線に 垂直な 線の 長さで はかるよ。',
        `左の 点線の 長さは ${wcm}cm。`,
      ],
      explain: `平行な 直線の はばは どこも 同じなので ${wcm}cmです。`,
      identity: `prop:width:${wcm}:${pos}`,
      alt: true,
      fields: [{ label: 'cm', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [[wcm + 1, 'width-change'], [wcm * 2, 'width-change'], [wcm - 1, 'width-change']]),
    };
  }
  // 平行な 2本に 1本の 直線が 交わる。角ウを 示し、同じ位置の 角エ（等しい）か、となりの 角（180 − ウ）を 問う
  const deg = rng.int(6, 16) * 5;
  const ask = rng.int(0, 1); // 0: 同じ位置の 角（等しい）、1: 一直線の となりの 角
  const ans = ask === 0 ? deg : 180 - deg;
  const rad = (deg * Math.PI) / 180;
  // 横の 平行線 y=50, y=150。交わる直線は 角 deg で
  const cx1 = 150;
  const cx2 = cx1 - 100 / Math.tan(rad);
  const ext = 40;
  const dx = ext / Math.tan(rad);
  let body = '';
  body += `<line x1="10" y1="50" x2="330" y2="50" ${STROKE}/>${svgText(345, 50, 'ア', 18)}`;
  body += `<line x1="10" y1="150" x2="330" y2="150" ${STROKE}/>${svgText(345, 150, 'イ', 18)}`;
  body += `<line x1="${cx1 + dx}" y1="${50 - ext}" x2="${cx2 - dx}" y2="${150 + ext}" ${STROKE}/>`;
  // 角ウ: 上の交点の右上の角（直線アの右向きと 交わる直線の上向き）
  body += svgText(cx1 + 28, 38, 'ウ', 16);
  // 角エ: 下の交点の 右上（同じ位置）または 左上（となり）
  body += svgText(ask === 0 ? cx2 + 28 : cx2 - 26, 138, 'エ', 16);
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `prop:angle:${deg}:${ask}`,
    objective: 'prop',
    level,
    prompt: `直線アと 直線イは 平行です。角ウは ${deg}°です。角エは 何度ですか。`,
    figure: svg(370, 200, body, '平行な 2本の 直線に 交わる 直線'),
    hints: [
      '平行な 直線は、ほかの 直線と 同じ 角度で 交わるよ。',
      ask === 0 ? '角エは、下の 交わる 点で 角ウと 同じ 位置に あるね。' : '一直線の 角は 180°だよ。角エは 角ウと 同じ 位置の 角の となりに あるね。',
      ask === 0 ? `角ウと 同じ 位置の 角だから…` : `180 − ${deg}を 計算しよう。`,
    ],
    explain:
      ask === 0
        ? `平行な 直線は ほかの 直線と 同じ 角度で 交わるので、角エは 角ウと 同じ ${deg}°です。`
        : `下の 交わる 点で、角ウと 同じ 位置の 角は ${deg}°。一直線は 180°なので、角エは 180 − ${deg} ＝ ${ans}°です。`,
    identity: `prop:angle:${deg}:${ask}`,
    alt: false,
    fields: [{ label: '度', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [[ask === 0 ? 180 - deg : deg, 'angle-pos'], [90, 'angle-pos']]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['findPerp', 'findPar'] },
  { objs: ['drawPerp', 'drawPar', 'findPerp', 'findPar'] },
  { objs: ['prop', 'drawPerp', 'drawPar'] },
];

export function generateParallelPerp(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.35;
  switch (obj) {
    case 'findPerp':
    case 'findPar':
      return find(obj, level, rng, alt);
    case 'drawPerp':
    case 'drawPar':
      return draw(obj, level, rng, alt);
    case 'prop':
      return prop(level, rng, alt);
  }
}

export const parallelPerp: UnitSpec = finishUnit({
  id: 'g4.math.parallel-perp',
  title: '垂直と 平行',
  stage: 'g4',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: ['g3.math.triangles'],
  objectives: [
    { id: 'findPerp', title: '垂直な 直線を 見つける' },
    { id: 'findPar', title: '平行な 直線を 見つける' },
    { id: 'drawPerp', title: '垂直な 直線を ひく' },
    { id: 'drawPar', title: '平行な 直線を ひく' },
    { id: 'prop', title: '平行な 直線の せいしつ（はば・角）' },
  ],
  misconceptions: [
    {
      id: 'perp-par-swap',
      explain: '垂直と 平行を とりちがえたのかな。直角に 交わるのが 垂直、どこまで のばしても 交わらないのが 平行だよ。',
    },
    {
      id: 'looks-90',
      explain: '直角に 見えても、少し ずれて いるかも。三角じょうぎの 直角や 方がんの ますで たしかめよう。',
    },
    {
      id: 'looks-par',
      explain: '同じ 向きに 見えても、少し かたむきが ちがうかも。のばすと 交わって しまう 直線は 平行では ないよ。',
    },
    {
      id: 'not-through',
      explain: '向きは 合って いるけれど、●の 点を 通って いないよ。●から ひきはじめよう。',
    },
    {
      id: 'width-change',
      explain: '平行な 2本の 直線の はばは、どこで はかっても 同じだよ。',
    },
    {
      id: 'angle-pos',
      explain:
        '角の 位置を たしかめよう。平行な 直線に 交わる 直線が つくる 角は、同じ 位置なら 等しい。一直線の となりの 角とは あわせて 180°だよ。',
    },
  ],
  levels: [
    { label: '見つける', chance: 0.25 },
    { label: 'ひく', chance: 0.02 },
    { label: 'せいしつ', chance: 0.02 },
  ],
  intro: [
    {
      text: '2本の 直線が 直角に 交わるとき、この 2本の 直線は 垂直で あると いいます。',
      figure: svg(200, 160, `<line x1="20" y1="100" x2="180" y2="100" ${STROKE}/><line x1="100" y1="20" x2="100" y2="150" ${STROKE}/><rect x="100" y="86" width="14" height="14" fill="none" stroke="var(--ink)" stroke-width="2"/>`, '垂直な 2本の 直線'),
    },
    {
      text: '交わって いなくても、のばして 直角に 交われば 垂直です。',
    },
    {
      text: '1本の 直線に 垂直な 2本の 直線は 平行で あると いいます。平行な 直線は どこまで のばしても 交わらず、はばは どこも 同じです。',
      figure: svg(220, 140, `<line x1="10" y1="30" x2="210" y2="30" ${STROKE}/><line x1="10" y1="110" x2="210" y2="110" ${STROKE}/><line x1="60" y1="10" x2="60" y2="130" ${STROKE} stroke-dasharray="6 5"/><line x1="160" y1="10" x2="160" y2="130" ${STROKE} stroke-dasharray="6 5"/>`, '平行な 2本の 直線'),
    },
    {
      text: '方がんでは、横に 2ます・たてに 1ます 進む 直線に 垂直なのは、横に 1ます・たてに 2ます（向きは 反対）進む 直線です。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateParallelPerp(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第4学年 B(1) 平面図形（直線の平行や垂直の関係）',
  revised: REVISED,
});
