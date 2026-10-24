/**
 * g5.math.congruence 合同な図形（対応する頂点・辺・角、合同な三角形のかき方）（curriculum-matrix 3.8）。
 * 重ね合わせ（導入）→ 対応する頂点・辺・角を答える → 対応する辺の長さ・角の大きさ → 合同な形をかく（geometry の draw）
 * → 三角形が1つに決まる条件（3辺／2辺とその間の角／1辺とその両はしの角）。
 *
 * matrix は「手30」だが、三角形 × 動かし方（回す・うら返す）× 頂点の名前のつけ方 × 問う所 で生成する（量の基準は概念の 60）。
 * 同一性キー: 問う形 × 元の三角形 × 動かし方 × 名前のつけ方 × 問う所。回転・うら返しは この単元の学習内容なので別の問題。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { GeometryItem } from '../../engines/geometry/geometry';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  dec,
  decAns,
  finishUnit,
  pick,
  pickObj,
  r1,
  REVISED,
  STROKE,
  svg,
  svgText,
  wrongList,
} from './util';

type Obj = 'corr' | 'measure' | 'draw' | 'cond';
type P = [number, number];

/** 元の三角形（方眼の座標。3辺の長さが みな ちがう） */
const TRIS: P[][] = [
  [
    [0, 0],
    [5, 0],
    [1, 2],
  ],
  [
    [0, 0],
    [4, 0],
    [3, 3],
  ],
  [
    [0, 0],
    [6, 0],
    [2, 2],
  ],
  [
    [0, 0],
    [5, 0],
    [4, 2],
  ],
  [
    [0, 0],
    [3, 0],
    [0, 4],
  ],
  [
    [0, 0],
    [6, 0],
    [5, 3],
  ],
];

/** 動かし方（ずらす・回す・うら返す） */
const MOVES: { id: string; flip: boolean; f: (p: P) => P }[] = [
  { id: 'shift', flip: false, f: ([x, y]) => [x, y] },
  { id: 'rot90', flip: false, f: ([x, y]) => [-y, x] },
  { id: 'rot180', flip: false, f: ([x, y]) => [-x, -y] },
  { id: 'rot270', flip: false, f: ([x, y]) => [y, -x] },
  { id: 'flip', flip: true, f: ([x, y]) => [-x, y] },
  { id: 'flip90', flip: true, f: ([x, y]) => [y, x] },
  { id: 'flip180', flip: true, f: ([x, y]) => [x, -y] },
];

const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
const L1 = ['A', 'B', 'C'];
const L2 = ['D', 'E', 'F'];

/** 0〜1 に のばした 座標（位置の くらべ用） */
function unit(ps: P[]): P[] {
  const xs = ps.map((p) => p[0]);
  const ys = ps.map((p) => p[1]);
  const mx = Math.min(...xs);
  const my = Math.min(...ys);
  const w = Math.max(...xs) - mx || 1;
  const h = Math.max(...ys) - my || 1;
  return ps.map(([x, y]) => [(x - mx) / w, (y - my) / h]);
}

interface Pair {
  t: number;
  m: number;
  perm: number[];
  a: P[];
  b: P[];
  /** 頂点 i（A,B,C）に 対応する 右の 頂点の 名前 */
  name: string[];
}

function makePair(rng: Rng): Pair {
  const t = rng.int(0, TRIS.length - 1);
  const m = rng.int(0, MOVES.length - 1);
  const perm = pick(rng, PERMS);
  const a = TRIS[t]!;
  const b = a.map(MOVES[m]!.f);
  return { t, m, perm, a, b, name: perm.map((k) => L2[k]!) };
}

/** 左に 三角形ABC、右に 三角形DEF（同じ 縮尺）。sideLab: 辺 i（i→i+1）の 文字、angLab: 角 i の 文字 */
function pairFig(pr: Pair, sideLab: string[] = [], angLab: string[] = [], other?: P[]): Figure {
  const K = 22;
  const draw = (ps: P[], names: string[], ox: number, sl: string[], al: string[]) => {
    const xs = ps.map((p) => p[0]);
    const ys = ps.map((p) => p[1]);
    const mx = Math.min(...xs);
    // 数学の 向き（y 上向き）で かく
    const maxY = Math.max(...ys);
    const sp = ps.map(([x, y]) => [r1(ox + (x - mx) * K), r1(24 + (maxY - y) * K)] as P);
    const cx = sp.reduce((s, p) => s + p[0], 0) / 3;
    const cy = sp.reduce((s, p) => s + p[1], 0) / 3;
    // 方がん（1ます 1cm。問題文・ヒントで ますを 数えるため）
    const gw = Math.max(...xs) - mx;
    const gh = maxY - Math.min(...ys);
    let s = '';
    for (let g = 0; g <= gw; g++)
      s += `<line x1="${ox + g * K}" y1="24" x2="${ox + g * K}" y2="${24 + gh * K}" stroke="var(--ink)" stroke-opacity="0.2" stroke-width="1"/>`;
    for (let g = 0; g <= gh; g++)
      s += `<line x1="${ox}" y1="${24 + g * K}" x2="${ox + gw * K}" y2="${24 + g * K}" stroke="var(--ink)" stroke-opacity="0.2" stroke-width="1"/>`;
    s += `<polygon points="${sp.map((p) => p.join(',')).join(' ')}" fill="var(--sky)" fill-opacity="0.35" ${STROKE}/>`;
    sp.forEach(([x, y], i) => {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy) || 1;
      s += svgText(r1(x + (dx / d) * 14), r1(y + (dy / d) * 14), names[i]!, 15);
      if (al[i]) s += svgText(r1(x - (dx / d) * 24), r1(y - (dy / d) * 24), al[i]!, 12);
    });
    for (let i = 0; i < 3; i++) {
      if (!sl[i]) continue;
      const p = sp[i]!;
      const q = sp[(i + 1) % 3]!;
      const mx2 = (p[0] + q[0]) / 2;
      const my2 = (p[1] + q[1]) / 2;
      const dx = mx2 - cx;
      const dy = my2 - cy;
      const d = Math.hypot(dx, dy) || 1;
      s += svgText(r1(mx2 + (dx / d) * 16), r1(my2 + (dy / d) * 16), sl[i]!, 12);
    }
    return s;
  };
  const right = other ?? pr.b;
  const rightNames = [0, 1, 2].map((i) => pr.name[i]!);
  const body = draw(pr.a, L1, 30, sideLab, angLab) + draw(right, rightNames, 210, [], []);
  return svg(380, 190, body, '2つの 三角形');
}

/** 右の 三角形で、左の 頂点 i と 同じ 位置（形の 中の 見た目の 場所）に ある 頂点 */
function samePlace(pr: Pair, i: number): number {
  const ua = unit(pr.a);
  const ub = unit(pr.b);
  let best = 0;
  let bd = Infinity;
  ub.forEach((p, j) => {
    const d = (p[0] - ua[i]![0]) ** 2 + (p[1] - ua[i]![1]) ** 2;
    if (d < bd) {
      bd = d;
      best = j;
    }
  });
  return best;
}

/** 右の 頂点 j（形の 番号）の 名前 */
const nameAt = (pr: Pair, j: number) => pr.name[j]!;

/** 誤りの 名前に 付ける 誤概念: 位置で 決めた／名前の 順で 決めた／その他 */
function misOfVertex(pr: Pair, i: number, label: string): string {
  if (label === nameAt(pr, samePlace(pr, i))) return 'by-position';
  if (label === L2[i]) return 'name-order';
  return 'corr-check';
}

const key = (pr: Pair) => `${pr.t}:${MOVES[pr.m]!.id}:${pr.perm.join('')}`;

/** 対応する 頂点・辺・角（alt: 2つの 三角形が 合同か） */
function corr(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const pr = makePair(rng);
  if (alt) {
    const cong = rng.next() < 0.6;
    // 合同で ない 形: 1つの 頂点を 1ます ずらす
    let other = pr.b;
    if (!cong) {
      const l2s = (ps: P[]) =>
        [0, 1, 2]
          .map(
            (i) => (ps[i]![0] - ps[(i + 1) % 3]![0]) ** 2 + (ps[i]![1] - ps[(i + 1) % 3]![1]) ** 2,
          )
          .sort((x, y) => x - y)
          .join('-');
      for (;;) {
        const j = rng.int(0, 2);
        const [dx, dy] = pick(rng, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as P[]);
        const cand = pr.b.map((p, k) => (k === j ? ([p[0] + dx, p[1] + dy] as P) : p));
        const [p, q, r] = cand as [P, P, P];
        const area2 = Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
        if (area2 >= 2 && l2s(cand) !== l2s(pr.b)) {
          other = cand;
          break;
        }
      }
    }
    const flip = MOVES[pr.m]!.flip;
    return {
      engine: 'choice',
      id: `corr-alt:${key(pr)}:${cong ? 'y' : 'n'}`,
      objective: 'corr',
      level,
      prompt: '2つの 三角形は 合同ですか。（1ますは 1cm）',
      figure: pairFig(pr, [], [], other),
      hints: [
        'ぴったり 重ねられる 2つの 図形を 合同と いうよ。',
        'うら返したり 回したり しても、ぴったり 重なれば 合同だよ。',
        '3つの 辺の 長さを、方がんの ますで くらべよう。',
      ],
      explain: cong
        ? `右の 三角形は、左の 三角形を ${flip ? 'うら返して' : MOVES[pr.m]!.id === 'shift' ? 'ずらして' : '回して'} ぴったり 重なるので 合同です。`
        : '右の 三角形は、左の 三角形と 辺の 長さが ちがう ところが あるので、ぴったり 重なりません。合同では ありません。',
      identity: `same:${key(pr)}:${cong ? 'y' : 'n'}`,
      alt: true,
      fixedOrder: true,
      options: cong
        ? [
            { label: '合同', correct: true },
            { label: '合同では ない', misconception: flip ? 'flip-not' : 'turn-not' },
          ]
        : [
            { label: '合同', misconception: 'looks-same' },
            { label: '合同では ない', correct: true },
          ],
    };
  }
  const q = pick(rng, ['vertex', 'side', 'angle'] as const);
  const i = rng.int(0, 2);
  const base = {
    engine: 'choice' as const,
    objective: 'corr',
    level,
    figure: pairFig(pr),
    alt: false,
    hints: [
      '2つの 三角形は 合同です。右の 三角形を 回したり うら返したり して、左に 重ねて 考えよう。',
      '辺の 長さや 角の 大きさが 同じ ところが 対応するよ。方がんの ますで くらべよう。',
      `${L1[i]}の 頂点に あつまる 2つの 辺の 長さを 見て、同じ 長さの 2つの 辺が あつまる 頂点を 右で さがそう。`,
    ],
  };
  if (q === 'vertex' || q === 'angle') {
    const pre = q === 'vertex' ? '頂点' : '角';
    const ans = pr.name[i]!;
    return {
      ...base,
      id: `corr:${key(pr)}:${q}${i}`,
      prompt: `2つの 三角形は 合同です。${pre}${L1[i]}に 対応する ${pre}は どれ？`,
      explain: `右の 三角形を 動かして 重ねると、${L1[i]}と ${ans}が 重なります。${pre}${L1[i]}に 対応するのは ${pre}${ans}です。${q === 'angle' ? '対応する 角の 大きさは 等しいです。' : ''}`,
      identity: `corr:${key(pr)}:${q}${i}`,
      options: L2.map((l) =>
        l === ans
          ? { label: `${pre}${l}`, correct: true }
          : { label: `${pre}${l}`, misconception: misOfVertex(pr, i, l) },
      ),
    };
  }
  // 辺: i → i+1
  const j = (i + 1) % 3;
  const ans = `辺${pr.name[i]}${pr.name[j]}`;
  // 選択肢は どれも 同じ 作り方（右の 頂点の 順）。正答だけ 名前の 並びが ちがうと 手がかりに なるため
  const sides = [0, 1, 2].map((s) => ({ s, label: `辺${pr.name[s]!}${pr.name[(s + 1) % 3]!}` }));
  const pos = [samePlace(pr, i), samePlace(pr, j)].sort().join('');
  return {
    ...base,
    id: `corr:${key(pr)}:side${i}`,
    prompt: `2つの 三角形は 合同です。辺${L1[i]}${L1[j]}に 対応する 辺は どれ？`,
    hints: [
      base.hints[0]!,
      base.hints[1]!,
      `辺${L1[i]}${L1[j]}と 同じ 長さの 辺を 右で さがそう。`,
    ],
    explain: `頂点${L1[i]}に ${pr.name[i]}、頂点${L1[j]}に ${pr.name[j]}が 対応するので、辺${L1[i]}${L1[j]}に 対応するのは ${ans}です。対応する 辺の 長さは 等しいです。`,
    identity: `corr:${key(pr)}:side${i}`,
    options: sides.map(({ s, label }) => {
      if (s === i) return { label, correct: true };
      const ends = [s, (s + 1) % 3].sort().join('');
      const nameSide = [L2[i]!, L2[j]!].sort().join('');
      const lab = [...label.slice(1)].sort().join('');
      const m = ends === pos ? 'by-position' : lab === nameSide ? 'name-order' : 'corr-check';
      return { label, misconception: m };
    }),
  };
}

const len = (p: P, q: P) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** 三角形の 角（度。整数に まるめ、和を 180 に そろえる） */
function anglesOf(ps: P[]): number[] {
  const raw = [0, 1, 2].map((i) => {
    const a = ps[i]!;
    const b = ps[(i + 1) % 3]!;
    const c = ps[(i + 2) % 3]!;
    const v1 = [b[0] - a[0], b[1] - a[1]];
    const v2 = [c[0] - a[0], c[1] - a[1]];
    const cos =
      (v1[0]! * v2[0]! + v1[1]! * v2[1]!) /
      (Math.hypot(v1[0]!, v1[1]!) * Math.hypot(v2[0]!, v2[1]!));
    return (Math.acos(cos) * 180) / Math.PI;
  });
  const r = raw.map((x) => Math.round(x));
  const diff = 180 - r.reduce((s, x) => s + x, 0);
  const big = r.indexOf(Math.max(...r));
  r[big] = r[big]! + diff;
  return r;
}

/** 対応する 辺の 長さ（alt: 角の 大きさ） */
function measure(level: number, rng: Rng, alt: boolean): NumberItem {
  const pr = makePair(rng);
  if (alt) {
    const ang = anglesOf(pr.a);
    const k = rng.int(0, 2);
    // 右の 頂点の 名前 pr.name[k] の 角を 問う
    const target = pr.name[k]!;
    const answers = [{ kind: 'int' as const, value: ang[k]! }];
    return {
      engine: 'number',
      id: `measure-alt:${key(pr)}:${k}`,
      objective: 'measure',
      level,
      prompt: `2つの 三角形は 合同です。角${target}の 大きさは 何度ですか。`,
      figure: pairFig(
        pr,
        [],
        ang.map((x) => `${x}°`),
      ),
      hints: [
        '合同な 図形では、対応する 角の 大きさが 等しいよ。',
        `角${target}に 対応する 左の 角を さがそう。`,
        `頂点${target}に 重なるのは、左の どの 頂点かな。`,
      ],
      explain: `角${target}に 対応するのは 角${L1[k]}なので、${ang[k]}°です。`,
      identity: `measure-ang:${key(pr)}:${k}`,
      alt: true,
      fields: [{ label: '度', answer: answers[0]! }],
      wrongAnswers: wrongList(
        answers,
        [0, 1, 2]
          .filter((x) => x !== k)
          .map(
            (x) =>
              [
                ang[x]!,
                samePlace(pr, x) === k
                  ? 'by-position'
                  : x === L2.indexOf(target)
                    ? 'name-order'
                    : 'corr-check',
              ] as [number, string],
          ),
      ),
    };
  }
  const L = [0, 1, 2].map((s) => Math.round(len(pr.a[s]!, pr.a[(s + 1) % 3]!) * 10));
  const s = rng.int(0, 2);
  const a = pr.name[s]!;
  const b = pr.name[(s + 1) % 3]!;
  const side = [a, b].sort().join('');
  const answers = [decAns(L[s]!, 1)];
  return {
    engine: 'number',
    id: `measure:${key(pr)}:${s}`,
    objective: 'measure',
    level,
    prompt: `2つの 三角形は 合同です。辺${side}の 長さは 何cmですか。`,
    figure: pairFig(
      pr,
      L.map((v) => `${dec(v, 1)}cm`),
    ),
    hints: [
      '合同な 図形では、対応する 辺の 長さが 等しいよ。',
      `頂点${a}と 頂点${b}に 対応する 左の 頂点を さがそう。`,
      `辺${side}に 対応する 左の 辺の 長さを 読もう。`,
    ],
    explain: `頂点${a}に ${L1[s]}、頂点${b}に ${L1[(s + 1) % 3]}が 対応するので、辺${side}は 辺${L1[s]}${L1[(s + 1) % 3]}と 同じ ${dec(L[s]!, 1)}cmです。`,
    identity: `measure:${key(pr)}:${s}`,
    alt: false,
    fields: [{ label: 'cm', answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(
      answers,
      [0, 1, 2]
        .filter((x) => x !== s)
        .map((x) => {
          const place = [samePlace(pr, x), samePlace(pr, (x + 1) % 3)].sort().join('');
          const byName = [L2.indexOf(a), L2.indexOf(b)].sort().join('');
          const mine = [x, (x + 1) % 3].sort().join('');
          const m =
            place === [s, (s + 1) % 3].sort().join('')
              ? 'by-position'
              : mine === byName
                ? 'name-order'
                : 'corr-check';
          return [dec(L[x]!, 1), m] as [string, string];
        }),
    ),
  };
}

/** 合同な 三角形を かく（alt: 四角形） */
const QUADS: P[][] = [
  [
    [0, 1],
    [3, 0],
    [4, 3],
    [1, 4],
  ],
  [
    [0, 0],
    [4, 0],
    [3, 3],
    [1, 3],
  ],
  [
    [0, 0],
    [3, 0],
    [4, 3],
    [0, 2],
  ],
  [
    [1, 0],
    [4, 1],
    [3, 4],
    [0, 2],
  ],
  [
    [0, 0],
    [4, 1],
    [4, 4],
    [1, 3],
  ],
];

function draw(level: number, rng: Rng, alt: boolean): GeometryItem {
  let pts: P[];
  let id: string;
  if (alt) {
    const q = rng.int(0, QUADS.length - 1);
    pts = QUADS[q]!;
    id = `q${q}`;
  } else {
    for (;;) {
      pts = [0, 1, 2].map(() => [rng.int(0, 4), rng.int(0, 5)] as P);
      const [p, q, r] = pts as [P, P, P];
      const area2 = Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
      if (area2 >= 4) break;
    }
    // 同じ 形（合同）は 同じ 問題: 3辺の 長さの 2乗の 組
    const l2 = [0, 1, 2]
      .map(
        (i) => (pts[i]![0] - pts[(i + 1) % 3]![0]) ** 2 + (pts[i]![1] - pts[(i + 1) % 3]![1]) ** 2,
      )
      .sort((x, y) => x - y);
    id = l2.join('-');
  }
  const name = alt ? '四角形' : '三角形';
  return {
    engine: 'geometry',
    id: `draw${alt ? '-alt' : ''}:${id}`,
    objective: 'draw',
    level,
    prompt: `左の ${name}と 合同な ${name}を、右の あいて いる ところに かこう。`,
    hints: [
      alt
        ? '四角形は、対角線で 2つの 三角形に 分けて 考えると かけるよ。'
        : '合同な 三角形は、3つの 辺の 長さが 同じに なるように かけば よいよ。',
      '1つの 辺を 同じ 長さで かいてから、のこりの 頂点を 決めよう。',
      'ますの 数を 横と たてで 数えて、頂点を 1つずつ うつそう。',
    ],
    explain: `${alt ? '辺の 長さと 角の 大きさが' : '3つの 辺の 長さが'} もとの 形と 同じに なるように かくと、合同な ${name}に なります。回したり うら返したり した 向きでも かまいません。`,
    identity: `draw${alt ? '-q' : ''}:${id}`,
    alt,
    task: {
      kind: 'draw',
      grid: { w: 12, h: 6 },
      given: [{ points: pts }],
      target: { kind: 'congruent', points: pts, allowFlip: true },
    },
  };
}

/**
 * 1つの 三角形ABCの 辺 BC＝a・CA＝b・AB＝c（cm）と 角 B・C（度。辺の 長さから 求めて 整数に まるめ、3つの 角の 和を 180 に そろえる）。
 * 1問の 中で 辺と 角を いくつも 見せるので、同じ 三角形の 値に する（でたらめな 組だと、そんな 三角形が ない）。
 */
function condValues(rng: Rng): [number, number, number, number, number] {
  const deg = (opp: number, p: number, q: number) =>
    (Math.acos((p * p + q * q - opp * opp) / (2 * p * q)) * 180) / Math.PI;
  for (;;) {
    const a = rng.int(3, 9);
    const b = rng.int(3, 9);
    const c = rng.int(3, 9);
    if (!(a + b > c && b + c > a && c + a > b) || new Set([a, b, c]).size !== 3) continue;
    const r = [deg(a, b, c), deg(b, c, a), deg(c, a, b)].map((x) => Math.round(x));
    const big = r.indexOf(Math.max(...r));
    r[big] = r[big]! + 180 - r.reduce((s, x) => s + x, 0);
    const [A, B, C] = r as [number, number, number];
    if (Math.min(A, B, C) < 20) continue;
    // 辺AB・辺BC・角C で 形が 1つに 決まらない（2通り かける）ように: BC × sinC < AB < BC
    const amb = a * Math.sin((C * Math.PI) / 180) < c - 0.2 && c < a;
    if (amb) return [a, b, c, B, C];
  }
}

/** 三角形が 1つに 決まる 条件（alt: 2つの 三角形が 合同と いえるか） */
function cond(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const [a, b, c, Bv, Cv] = condValues(rng);
  const Av = 180 - Bv - Cv;
  if (alt) {
    const kind = pick(rng, ['sss', 'sas', 'asa', 'ssa', 'aaa'] as const);
    const data =
      kind === 'sss'
        ? `AB＝DE＝${c}cm、BC＝EF＝${a}cm、CA＝FD＝${b}cm`
        : kind === 'sas'
          ? `AB＝DE＝${c}cm、BC＝EF＝${a}cm、角B＝角E＝${Bv}°`
          : kind === 'asa'
            ? `BC＝EF＝${a}cm、角B＝角E＝${Bv}°、角C＝角F＝${Cv}°`
            : kind === 'ssa'
              ? `AB＝DE＝${c}cm、BC＝EF＝${a}cm、角C＝角F＝${Cv}°`
              : `角A＝角D＝${Av}°、角B＝角E＝${Bv}°、角C＝角F＝${Cv}°`;
    const yes = kind === 'sss' || kind === 'sas' || kind === 'asa';
    const wrongMis = kind === 'ssa' ? 'not-included' : 'angles-only';
    return {
      engine: 'choice',
      id: `cond-alt:${kind}:${a}-${b}-${c}:${Bv}-${Cv}`,
      objective: 'cond',
      level,
      prompt: `三角形ABCと 三角形DEFで、${data}です。2つの 三角形は 必ず 合同と いえますか。`,
      hints: [
        '三角形が 1つに 決まる 3つの 場合を 思い出そう。',
        '3つの 辺／2つの 辺と その 間の 角／1つの 辺と その 両はしの 角。',
        kind === 'ssa'
          ? '角Cは、辺ABと 辺BCの 間の 角かな。'
          : kind === 'aaa'
            ? '角だけで、辺の 長さは 決まるかな。'
            : 'どの 場合に あてはまるかを 見よう。',
      ],
      explain: yes
        ? `${kind === 'sss' ? '3つの 辺の 長さ' : kind === 'sas' ? '2つの 辺と その 間の 角' : '1つの 辺と その 両はしの 角'}が 等しいので、合同と いえます。`
        : kind === 'ssa'
          ? '角Cは 辺ABと 辺BCの 間の 角では ないので、形が 1つに 決まりません。合同とは かぎりません。'
          : '角が 等しくても、大きさの ちがう 三角形が かけます。合同とは かぎりません。',
      identity: `cond-judge:${kind}:${a}-${b}-${c}:${Bv}-${Cv}`,
      alt: true,
      fixedOrder: true,
      options: yes
        ? [
            { label: '合同と いえる', correct: true },
            { label: '合同とは かぎらない', misconception: 'cond-forget' },
          ]
        : [
            { label: '合同と いえる', misconception: wrongMis },
            { label: '合同とは かぎらない', correct: true },
          ],
    };
  }
  const kind = pick(rng, ['sss', 'sas', 'asa'] as const);
  const right =
    kind === 'sss'
      ? `辺AB ${c}cm、辺BC ${a}cm、辺CA ${b}cm`
      : kind === 'sas'
        ? `辺AB ${c}cm、辺BC ${a}cm、角B ${Bv}°`
        : `辺BC ${a}cm、角B ${Bv}°、角C ${Cv}°`;
  return {
    engine: 'choice',
    id: `cond:${kind}:${a}-${b}-${c}:${Bv}-${Cv}`,
    objective: 'cond',
    level,
    prompt:
      '三角形ABCと 合同な 三角形を かきます。どれが わかれば、形が 1つに 決まって かけますか。',
    hints: [
      '三角形は、3つの ことが わかれば かける 場合が あるよ。でも 何が わかっても よいわけでは ないよ。',
      '3つの 辺／2つの 辺と その 間の 角／1つの 辺と その 両はしの 角 の どれかだよ。',
      '角は、どの 辺と どの 辺の 間の 角かを たしかめよう。',
    ],
    explain: `${right}が わかれば、${kind === 'sss' ? '3つの 辺の 長さ' : kind === 'sas' ? '2つの 辺と その 間の 角' : '1つの 辺と その 両はしの 角'}なので、三角形が 1つに 決まります。`,
    identity: `cond:${kind}:${a}-${b}-${c}:${Bv}-${Cv}`,
    alt: false,
    options: [
      { label: right, correct: true },
      { label: `角A ${Av}°、角B ${Bv}°、角C ${Cv}°`, misconception: 'angles-only' },
      { label: `辺AB ${c}cm、辺BC ${a}cm、角C ${Cv}°`, misconception: 'not-included' },
      { label: `辺AB ${c}cm、辺BC ${a}cm`, misconception: 'too-few' },
    ],
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['corr', 'measure'] },
  { objs: ['draw', 'corr', 'measure'] },
  { objs: ['cond', 'draw', 'corr', 'measure'] },
];

export function generateCongruence(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'corr':
      return corr(level, rng, alt);
    case 'measure':
      return measure(level, rng, alt);
    case 'draw':
      return draw(level, rng, alt);
    case 'cond':
      return cond(level, rng, alt);
  }
}

const introPair: Pair = {
  t: 1,
  m: 4,
  perm: [0, 1, 2],
  a: TRIS[1]!,
  b: TRIS[1]!.map(MOVES[4]!.f),
  name: ['D', 'E', 'F'],
};

export const congruence: UnitSpec = finishUnit(
  {
    id: 'g5.math.congruence',
    title: '合同な 図形',
    stage: 'g5',
    subject: 'math',
    domain: 'B-shape',
    kind: 'concept',
    priority: 'P1',
    status: 'ready',
    icon: 'mode-shapes',
    prereq: ['g4.math.quadrilaterals'],
    objectives: [
      { id: 'corr', title: '対応する 頂点・辺・角' },
      { id: 'measure', title: '対応する 辺の 長さ・角の 大きさ' },
      { id: 'draw', title: '合同な 図形を かく' },
      { id: 'cond', title: '三角形が 1つに 決まる 条件' },
    ],
    misconceptions: [
      {
        id: 'by-position',
        explain:
          '見た目の 同じ 場所に ある ものを 選んだのかな。向きが 変わって いるので、辺の 長さや 角の 大きさで 対応を 見つけよう。',
      },
      {
        id: 'name-order',
        explain:
          'A→D、B→E のように 名前の 順で 決めたのかな。名前の 順と 対応は 同じとは かぎらないよ。重ねて 考えよう。',
      },
      {
        id: 'corr-check',
        explain:
          '対応する ところを 取りちがえたのかな。同じ 長さの 辺、同じ 大きさの 角が 重なるように 考えよう。',
      },
      {
        id: 'flip-not',
        explain:
          'うら返した 形は 合同では ないと 考えたのかな。うら返して ぴったり 重なれば 合同だよ。',
      },
      {
        id: 'turn-not',
        explain:
          '向きが ちがうと 合同では ないと 考えたのかな。回したり ずらしたり して ぴったり 重なれば 合同だよ。',
      },
      {
        id: 'looks-same',
        explain:
          '形が にて いるので 合同と 考えたのかな。辺の 長さを ますで 数えて、ぴったり 重なるか たしかめよう。',
      },
      {
        id: 'angles-only',
        explain:
          '3つの 角が わかれば かけると 考えたのかな。角が 同じでも、大きさの ちがう 三角形が かけるよ。',
      },
      {
        id: 'not-included',
        explain:
          '2つの 辺と、その 間では ない 角を 選んだのかな。角は、2つの 辺の 間の 角で ないと 形が 1つに 決まらないよ。',
      },
      {
        id: 'too-few',
        explain:
          '2つの 辺だけでは、間の 角を 変えると いろいろな 三角形が できるよ。もう1つ 何が 必要かな。',
      },
      {
        id: 'cond-forget',
        explain:
          '三角形が 1つに 決まる 場合を 思い出そう。3つの 辺、2つの 辺と その 間の 角、1つの 辺と その 両はしの 角が 等しければ 合同だよ。',
      },
    ],
    levels: [
      { label: '対応する ところ', chance: 0.05 },
      { label: '合同な 図形を かく', chance: 0.02 },
      { label: '三角形が 決まる 条件・まとめ', chance: 0.05 },
    ],
    intro: [
      {
        text: 'ぴったり 重ね合わせる ことの できる 2つの 図形を、合同と いいます。うら返して 重なる ときも 合同です。',
        figure: pairFig(introPair),
      },
      {
        text: '重ね合わせた とき、重なる 頂点・辺・角を、対応する 頂点・辺・角と いいます。合同な 図形では、対応する 辺の 長さも、対応する 角の 大きさも 等しいです。',
        figure: pairFig(introPair, ['4cm', '3.2cm', '4.2cm']),
      },
      {
        text: '合同な 三角形は、「3つの 辺の 長さ」「2つの 辺の 長さと その 間の 角」「1つの 辺の 長さと その 両はしの 角」の どれかが わかれば かけます。',
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateCongruence(level, rng, index),
    },
    review: 'objective',
    basis:
      '小学校学習指導要領（平成29年告示）算数 第5学年 B(1) 平面図形の性質（図形の合同、合同な図形のかき方）',
    revised: REVISED,
  },
  '決《き》 等《ひと》し 出《だ》 間《あいだ》 度《ど》 条件《じょうけん》 必《かなら》ず 必要《ひつよう》 重《かさ》ね合《あ》わせる 重《かさ》ね合《あ》わせた 重《かさ》 うら返《がえ》して うら返《がえ》した うら返《がえ》す うら返《がえ》し 回《まわ》したり 回《まわ》して 回《まわ》す 動《うご》かして 動《うご》かし 方《ほう》がん 両《りょう》はし 言《い》える 言《い》えます 場合《ばあい》 決《き》まって 決《き》まります 決《き》まらない 決《き》まる 決《き》めた 名前《なまえ》 一《ひと》つ',
);
