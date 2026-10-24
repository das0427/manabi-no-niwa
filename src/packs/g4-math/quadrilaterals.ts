/**
 * g4.math.quadrilaterals 台形・平行四辺形・ひし形、対角線（curriculum-matrix 3.7）。
 * 仲間分け → 性質（向かい合う辺・角）→ 対角線で調べる → かく。
 *
 * 形は方眼の格子の点で作り、向き（90°回転・裏返し）を変えて出す（向きを変えても同じ仲間と分かるか）。
 * 台形と平行四辺形の包含関係は扱わない（台形の問題に平行四辺形を混ぜない）。長方形・正方形は平行四辺形の
 * 問題に混ぜない（正しい選択肢が2つになるため）。
 * 同一性キー: 問う形 × 形の頂点（向きを含む）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { GeometryItem, Pt } from '../../engines/geometry/geometry';
import type { ChoiceItem, Item, NumberItem, SortItem, UnitSpec } from '../../curriculum/types';
import {
  finishUnit,
  KATA,
  opts,
  pick,
  pickObj,
  REVISED,
  STROKE,
  svg,
  svgText,
  wrongList,
} from './util';

type Obj = 'classify' | 'props' | 'diag' | 'draw';
type Kind = 'trap' | 'para' | 'rhombus' | 'quad' | 'kite';

/** 形の頂点（格子の点） */
function shapeOf(kind: Kind, rng: Rng): Pt[] {
  switch (kind) {
    case 'trap': {
      const h = rng.int(2, 3);
      const top = rng.int(1, 3);
      const left = rng.int(0, 2);
      const bottom = top + left + rng.int(1, 2);
      return [
        [0, h],
        [left, 0],
        [left + top, 0],
        [bottom, h],
      ];
    }
    case 'para': {
      const h = rng.int(2, 3);
      const s = rng.int(1, 2);
      const w = rng.int(2, 4);
      return [
        [0, h],
        [s, 0],
        [s + w, 0],
        [w, h],
      ];
    }
    case 'rhombus': {
      const a = rng.int(1, 3);
      let b = rng.int(1, 3);
      if (b === a) b = a === 1 ? 2 : 1;
      // 縦横の 対角線を もつ ひし形（a≠b なので 正方形では ない）
      return [
        [0, b],
        [a, 0],
        [2 * a, b],
        [a, 2 * b],
      ];
    }
    case 'kite': {
      const a = rng.int(1, 2);
      const t = rng.int(1, 2);
      const bt = t + rng.int(1, 2);
      return [
        [0, t],
        [a, 0],
        [2 * a, t],
        [a, bt + t],
      ];
    }
    case 'quad':
      return pick(rng, [
        [
          [0, 3],
          [1, 0],
          [4, 1],
          [3, 3],
        ],
        [
          [0, 2],
          [2, 0],
          [4, 1],
          [3, 4],
        ],
        [
          [0, 0],
          [3, 1],
          [4, 3],
          [0, 2],
        ],
      ] as Pt[][]);
  }
}

/** 向きを変える（0〜7: 回転4×裏返し2） */
function orient(ps: Pt[], o: number): Pt[] {
  let q = ps.map(([x, y]) => [x, y] as Pt);
  for (let i = 0; i < o % 4; i++) q = q.map(([x, y]) => [-y, x] as Pt);
  if (o >= 4) q = q.map(([x, y]) => [-x, y] as Pt);
  const mx = Math.min(...q.map((p) => p[0]));
  const my = Math.min(...q.map((p) => p[1]));
  return q.map(([x, y]) => [x - mx, y - my] as Pt);
}

const NAME: Record<'trap' | 'para' | 'rhombus', string> = {
  trap: '台形',
  para: '平行四辺形',
  rhombus: 'ひし形',
};

const ptsKey = (ps: Pt[]) => ps.map((p) => p.join(',')).join(' ');

/** 形の 仲間を 見分ける（alt: なかま分け） */
function classify(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const kinds: Kind[] = ['trap', 'trap', 'para', 'para', 'rhombus', 'rhombus'];
    const shapes = kinds.map((k) => orient(shapeOf(k, rng), rng.int(0, 7)));
    const fig = (ps: Pt[]): Figure => {
      const mx = Math.max(...ps.map((p) => p[0]), 1);
      const my = Math.max(...ps.map((p) => p[1]), 1);
      const s = Math.max(mx, my);
      return {
        kind: 'shape',
        shape: 'polygon',
        points: ps.map(([x, y]) => [(x / s) * 100, (y / s) * 100]),
        w: 100,
        h: 100,
      };
    };
    const item: SortItem = {
      engine: 'sort',
      id: `classify-alt:${shapes.map(ptsKey).join('|')}`,
      objective: 'classify',
      level,
      prompt: '四角形を 台形・平行四辺形・ひし形に 分けよう。',
      boxes: [{ label: '台形' }, { label: '平行四辺形' }, { label: 'ひし形' }],
      cards: shapes.map((ps, i) => ({
        figure: fig(ps),
        name: `かたち ${KATA[i]}`,
        box: i < 2 ? 0 : i < 4 ? 1 : 2,
        wrongBoxes:
          i < 2
            ? [{ box: 1, misconception: 'trap-par' }]
            : i < 4
              ? [
                  { box: 0, misconception: 'trap-par' },
                  { box: 2, misconception: 'rhombus-sides' },
                ]
              : [{ box: 1, misconception: 'rhombus-sides' }],
      })),
      hints: [
        '向かい合う 辺が 平行か どうかを 調べよう。向きが かわっても 仲間は かわらないよ。',
        '平行な 辺が 1組なら 台形、2組なら 平行四辺形。',
        '4つの 辺の 長さが みんな 同じなら ひし形。',
      ],
      explain:
        '向かい合う 1組の 辺が 平行な 四角形が 台形、2組とも 平行な 四角形が 平行四辺形、4つの 辺の 長さが 等しい 四角形が ひし形です。',
      identity: `classify-sort:${shapes.map(ptsKey).join('|')}`,
      alt: true,
    };
    return item;
  }
  const target = pick(rng, ['trap', 'para', 'rhombus'] as const);
  const wrongKinds: [Kind, string][] =
    target === 'trap'
      ? [
          ['quad', 'no-parallel'],
          ['kite', 'no-parallel'],
        ]
      : target === 'para'
        ? [
            ['trap', 'trap-par'],
            ['quad', 'no-parallel'],
            ['kite', 'no-parallel'],
          ]
        : [
            ['para', 'rhombus-sides'],
            ['kite', 'rhombus-kite'],
            ['trap', 'trap-par'],
          ];
  const right = orient(shapeOf(target, rng), rng.int(0, 7));
  const wrongs = wrongKinds.map(([k, m]) => ({
    shape: { points: orient(shapeOf(k, rng), rng.int(0, 7)) },
    misconception: m,
  }));
  const item: GeometryItem = {
    engine: 'geometry',
    id: `classify:${target}:${ptsKey(right)}:${wrongs.map((w) => ptsKey(w.shape.points)).join('|')}`,
    objective: 'classify',
    level,
    prompt: `${NAME[target]}は どれ？`,
    hints: [
      '向かい合う 辺が 平行か どうか、方がんの ますで 調べよう。',
      target === 'trap'
        ? '向かい合う 辺の 1組が 平行な 四角形を さがそう。'
        : target === 'para'
          ? '向かい合う 辺が 2組とも 平行な 四角形を さがそう。'
          : '4つの 辺の 長さが みんな 等しい 四角形を さがそう。',
      '向きが かわっても、辺の 平行や 長さは かわらないよ。',
    ],
    explain: `${NAME[target]}は、${
      target === 'trap'
        ? '向かい合う 1組の 辺が 平行な 四角形'
        : target === 'para'
          ? '向かい合う 2組の 辺が それぞれ 平行な 四角形'
          : '4つの 辺の 長さが みんな 等しい 四角形'
    }です。`,
    identity: `classify:${target}:${ptsKey(right)}:${wrongs
      .map((w) => ptsKey(w.shape.points))
      .sort()
      .join('|')}`,
    alt: false,
    task: { kind: 'pick', options: [{ shape: { points: right }, correct: true }, ...wrongs] },
  };
  return item;
}

/** 平行四辺形・ひし形の 図（辺の長さ・角の大きさの 文字つき） */
function paraFig(
  a: number,
  b: number,
  deg: number,
  labels: { ab?: string; ad?: string; angA?: string },
): Figure {
  const k = 22;
  const th = (deg * Math.PI) / 180;
  const x0 = 30;
  const y0 = 30 + b * k * Math.sin(th);
  const A: [number, number] = [x0, y0];
  const B: [number, number] = [x0 + a * k, y0];
  const D: [number, number] = [x0 + b * k * Math.cos(th), y0 - b * k * Math.sin(th)];
  const Cc: [number, number] = [B[0] + D[0] - A[0], D[1]];
  const minX = Math.min(A[0], D[0]);
  const shift = minX < 20 ? 20 - minX : 0;
  const P = (p: [number, number]) => `${p[0] + shift},${p[1]}`;
  let body = `<polygon points="${[A, B, Cc, D].map(P).join(' ')}" fill="var(--sky)" fill-opacity="0.35" ${STROKE}/>`;
  body += svgText(A[0] + shift - 12, A[1] + 14, 'ア', 16);
  body += svgText(B[0] + shift + 12, B[1] + 14, 'イ', 16);
  body += svgText(Cc[0] + shift + 12, Cc[1] - 10, 'ウ', 16);
  body += svgText(D[0] + shift - 12, D[1] - 10, 'エ', 16);
  if (labels.ab) body += svgText((A[0] + B[0]) / 2 + shift, A[1] + 18, labels.ab, 14);
  if (labels.ad) body += svgText((A[0] + D[0]) / 2 + shift - 22, (A[1] + D[1]) / 2, labels.ad, 14);
  if (labels.angA) body += svgText(A[0] + shift + 30, A[1] - 10, labels.angA, 14);
  const W = Math.max(B[0], Cc[0]) + shift + 40;
  return svg(W, y0 + 34, body, '四角形 アイウエ');
}

/** 性質（辺・角）。alt: せいしつを 選ぶ */
function props(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const facts = [
      {
        shape: '平行四辺形',
        right: '向かい合う 辺の 長さは 等しい',
        wrong: [
          ['となり合う 辺の 長さは 等しい', 'opp-side'],
          ['4つの 角は みんな 直角', 'prop-confuse'],
          ['向かい合う 角の 大きさは ちがう', 'opp-angle'],
        ],
      },
      {
        shape: '平行四辺形',
        right: '向かい合う 角の 大きさは 等しい',
        wrong: [
          ['となり合う 角の 大きさは 等しい', 'opp-angle'],
          ['向かい合う 辺は 平行で ない', 'trap-par'],
          ['4つの 辺の 長さは みんな 等しい', 'rhombus-sides'],
        ],
      },
      {
        shape: 'ひし形',
        right: '4つの 辺の 長さが みんな 等しい',
        wrong: [
          ['4つの 角が みんな 直角', 'prop-confuse'],
          ['向かい合う 辺は 平行で ない', 'trap-par'],
          ['向かい合う 角の 大きさは ちがう', 'opp-angle'],
        ],
      },
      {
        shape: 'ひし形',
        right: '向かい合う 辺は 平行',
        wrong: [
          ['平行な 辺は 1組だけ', 'trap-par'],
          ['向かい合う 辺の 長さは ちがう', 'opp-side'],
          ['4つの 角が みんな 直角', 'prop-confuse'],
        ],
      },
      {
        shape: '台形',
        right: '向かい合う 1組の 辺が 平行',
        wrong: [
          ['向かい合う 2組の 辺が 平行', 'trap-par'],
          ['4つの 辺の 長さが みんな 等しい', 'rhombus-sides'],
          ['平行な 辺は ない', 'no-parallel'],
        ],
      },
      {
        shape: '平行四辺形',
        right: 'となり合う 角を たすと 180°',
        wrong: [
          ['となり合う 角を たすと 360°', 'opp-angle'],
          ['となり合う 角は 等しい', 'opp-angle'],
          ['向かい合う 角を たすと 90°', 'opp-angle'],
        ],
      },
    ];
    const f = pick(rng, facts);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `props-alt:${f.shape}:${f.right}`,
      objective: 'props',
      level,
      prompt: `${f.shape}の せいしつで 正しい ものは どれ？`,
      hints: [
        `${f.shape}を 1つ 思いうかべて、辺や 角を 調べよう。`,
        '向かい合う ものと、となり合う ものを 区別しよう。',
        '方がんに かいて たしかめても よいよ。',
      ],
      explain: `${f.shape}は「${f.right}」。`,
      identity: `props-fact:${f.shape}:${f.right}`,
      alt: true,
      options: opts(
        f.right,
        f.wrong.map(([l, m]) => [l, m]),
      ),
    };
    return item;
  }
  const rh = rng.next() < 0.35;
  const a = rng.int(3, 8);
  const others = [2, 3, 4, 5, 6, 7].filter((x) => x !== a);
  const bb = rh ? a : pick(rng, others);
  const deg = rng.int(10, 16) * 5;
  const ask = rng.int(0, 3);
  const name = rh ? 'ひし形' : '平行四辺形';
  let q: string;
  let ans: number;
  let wr: [number, string][];
  let unit: string;
  if (ask === 0) {
    q = '辺ウエの 長さは 何cmですか。';
    ans = a;
    unit = 'cm';
    wr = [[bb, 'opp-side']];
  } else if (ask === 1) {
    q = '辺イウの 長さは 何cmですか。';
    ans = bb;
    unit = 'cm';
    wr = rh ? [] : [[a, 'opp-side']];
  } else if (ask === 2) {
    q = '角ウは 何度ですか。';
    ans = deg;
    unit = '度';
    wr = [
      [180 - deg, 'opp-angle'],
      [360 - deg, 'opp-angle'],
    ];
  } else {
    q = '角イは 何度ですか。';
    ans = 180 - deg;
    unit = '度';
    wr = [
      [deg, 'opp-angle'],
      [90, 'opp-angle'],
    ];
  }
  const answers = [{ kind: 'int' as const, value: ans }];
  const item: NumberItem = {
    engine: 'number',
    id: `props:${name}:${a}-${bb}:${deg}:${ask}`,
    objective: 'props',
    level,
    prompt: `四角形アイウエは ${name}です。${q}`,
    figure: paraFig(a, bb, deg, { ab: `${a}cm`, ad: rh ? undefined : `${bb}cm`, angA: `${deg}°` }),
    hints: [
      ask <= 1
        ? rh
          ? 'ひし形は 4つの 辺の 長さが みんな 等しいよ。'
          : '平行四辺形の 向かい合う 辺の 長さは 等しいよ。'
        : '向かい合う 角の 大きさは 等しいよ。',
      ask <= 1
        ? `${ask === 0 ? '辺ウエ' : '辺イウ'}と 向かい合う 辺は どれかな。`
        : ask === 2
          ? '角ウと 向かい合う 角は 角アだね。'
          : 'となり合う 角を たすと 180°に なるよ。',
      ask === 3
        ? `180 − ${deg}を 計算しよう。`
        : ask === 2
          ? '角アの 大きさを 見よう。'
          : rh
            ? '辺アイの 長さを 見よう。'
            : `向かい合う 辺の 長さを 図から 読もう。`,
    ],
    explain:
      ask <= 1
        ? `${rh ? 'ひし形の 辺の 長さは みんな 等しい' : '平行四辺形の 向かい合う 辺の 長さは 等しい'}ので、${ans}cmです。`
        : ask === 2
          ? `向かい合う 角の 大きさは 等しいので、角ウは 角アと 同じ ${deg}°です。`
          : `となり合う 角を たすと 180°なので、角イは 180 − ${deg} ＝ ${ans}°です。`,
    identity: `props:${name}:${a}-${bb}:${deg}:${ask}`,
    alt: false,
    fields: [{ label: unit, answer: answers[0]! }],
    wrongAnswers: wrongList(answers, wr),
  };
  return item;
}

/** 対角線（alt: 対角線の せいしつで 四角形を 選ぶ） */
function diag(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const qs = [
      {
        q: '対角線が 垂直に 交わる 四角形は どれ？（正方形の ほかに）',
        right: 'ひし形',
        wrong: [
          ['長方形', 'diag-prop'],
          ['平行四辺形', 'diag-prop'],
          ['台形', 'diag-prop'],
        ],
      },
      {
        q: '対角線の 長さが 等しい 四角形は どれ？（正方形の ほかに）',
        right: '長方形',
        wrong: [
          ['ひし形', 'diag-prop'],
          ['平行四辺形', 'diag-prop'],
          ['台形', 'diag-prop'],
        ],
      },
      {
        q: '対角線が 垂直に 交わり、長さも 等しい 四角形は どれ？',
        right: '正方形',
        wrong: [
          ['ひし形', 'diag-prop'],
          ['長方形', 'diag-prop'],
          ['平行四辺形', 'diag-prop'],
        ],
      },
      {
        q: '対角線が それぞれの まん中で 交わらない 四角形は どれ？',
        right: '台形',
        wrong: [
          ['平行四辺形', 'diag-prop'],
          ['ひし形', 'diag-prop'],
          ['長方形', 'diag-prop'],
        ],
      },
      {
        q: '対角線で 2つに 切ると、合同な 三角形が 2つ できない ことが ある 四角形は どれ？',
        right: '台形',
        wrong: [
          ['平行四辺形', 'diag-prop'],
          ['ひし形', 'diag-prop'],
          ['長方形', 'diag-prop'],
        ],
      },
    ];
    const f = pick(rng, qs);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `diag-alt:${f.right}:${qs.indexOf(f)}`,
      objective: 'diag',
      level,
      prompt: f.q.replace('合同な', '同じ 形と 大きさの'),
      hints: [
        '向かい合う 頂点を 結んだ 直線が 対角線だよ。',
        'それぞれの 四角形に 対角線を かいて みよう。',
        'ひし形は 垂直に、長方形は 同じ 長さで、平行四辺形は まん中で 交わるよ。',
      ],
      explain: `答えは ${f.right}。平行四辺形の 対角線は まん中で 交わり、長方形は 長さが 等しく、ひし形は 垂直に 交わります。正方形は その すべてです。`,
      identity: `diag-pick:${qs.indexOf(f)}`,
      alt: true,
      options: opts(
        f.right,
        f.wrong.map(([l, m]) => [l, m]),
      ),
    };
    return item;
  }
  // 平行四辺形・ひし形の 対角線は まん中で 交わる（長さの 半分・2倍）
  const rh = rng.next() < 0.4;
  const half = rng.int(2, 9);
  const toWhole = rng.next() < 0.5;
  const ans = toWhole ? half * 2 : half;
  const name = rh ? 'ひし形' : '平行四辺形';
  const answers = [{ kind: 'int' as const, value: ans }];
  let body = '';
  const P: [number, number][] = rh
    ? [
        [20, 90],
        [130, 20],
        [240, 90],
        [130, 160],
      ]
    : [
        [20, 150],
        [180, 150],
        [240, 30],
        [80, 30],
      ];
  body += `<polygon points="${P.map((p) => p.join(',')).join(' ')}" fill="none" ${STROKE}/>`;
  body += `<line x1="${P[0]![0]}" y1="${P[0]![1]}" x2="${P[2]![0]}" y2="${P[2]![1]}" ${STROKE} stroke-dasharray="6 5"/>`;
  body += `<line x1="${P[1]![0]}" y1="${P[1]![1]}" x2="${P[3]![0]}" y2="${P[3]![1]}" ${STROKE} stroke-dasharray="6 5"/>`;
  const names = ['ア', 'イ', 'ウ', 'エ'];
  P.forEach(
    (p, i) =>
      (body += svgText(
        p[0] + (i === 0 ? -12 : i === 2 ? 12 : 0),
        p[1] + (p[1] > 90 ? 16 : -10),
        names[i]!,
        16,
      )),
  );
  const O: [number, number] = [(P[0]![0] + P[2]![0]) / 2, (P[0]![1] + P[2]![1]) / 2];
  body += svgText(O[0], O[1] + 16, 'オ', 16);
  return {
    engine: 'number',
    id: `diag:${name}:${half}:${toWhole ? 'w' : 'h'}`,
    objective: 'diag',
    level,
    prompt: toWhole
      ? `${name}アイウエの 対角線が 交わる 点を オと します。アオの 長さが ${half}cmの とき、対角線アウの 長さは 何cmですか。`
      : `${name}アイウエの 対角線アウの 長さは ${half * 2}cmです。対角線が 交わる 点を オと すると、アオの 長さは 何cmですか。`,
    figure: svg(270, 185, body, `${name}と 対角線`),
    hints: [
      `${name}の 対角線は、それぞれの まん中で 交わるよ。`,
      toWhole
        ? 'アオと オウの 長さは 等しいね。'
        : 'アオと オウの 長さは 等しいね。アウを 2つに 分けよう。',
      toWhole ? `${half} × 2を 計算しよう。` : `${half * 2} ÷ 2を 計算しよう。`,
    ],
    explain: `${name}の 対角線は まん中で 交わるので、アオ ＝ オウ。${toWhole ? `アウ ＝ ${half} × 2 ＝ ${ans}cm` : `アオ ＝ ${half * 2} ÷ 2 ＝ ${ans}cm`}です。`,
    identity: `diag:${name}:${half}:${toWhole ? 'w' : 'h'}`,
    alt: false,
    fields: [{ label: 'cm', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [[toWhole ? half : half * 2, 'diag-half']]),
  };
}

/** 3つの 頂点から 平行四辺形（alt: ひし形）を かんせいさせる */
function draw(level: number, rng: Rng, alt: boolean): GeometryItem {
  const g = { w: 8, h: 6 };
  for (;;) {
    const B: Pt = [rng.int(0, g.w), rng.int(0, g.h)];
    let u: Pt;
    let v: Pt;
    if (alt) {
      const a = rng.int(1, 3);
      const b = rng.int(0, 3);
      u = pick(rng, [
        [a, b],
        [-a, b],
        [a, -b],
        [-a, -b],
      ] as Pt[]);
      v = pick(rng, [
        [b, a],
        [-b, a],
        [b, -a],
        [-b, -a],
        [a, -b],
        [-a, b],
      ] as Pt[]);
    } else {
      u = [rng.int(-4, 4), rng.int(-3, 3)];
      v = [rng.int(-4, 4), rng.int(-3, 3)];
    }
    const cross = u[0] * v[1] - u[1] * v[0];
    const dot = u[0] * v[0] + u[1] * v[1];
    if (cross === 0 || dot === 0) continue; // 一直線・長方形（正方形）は 除く
    if (alt && u[0] * u[0] + u[1] * u[1] !== v[0] * v[0] + v[1] * v[1]) continue;
    if (!alt && u[0] * u[0] + u[1] * u[1] === v[0] * v[0] + v[1] * v[1]) continue;
    const A: Pt = [B[0] + u[0], B[1] + u[1]];
    const C: Pt = [B[0] + v[0], B[1] + v[1]];
    const D: Pt = [A[0] + v[0], A[1] + v[1]];
    const inG = (p: Pt) => p[0] >= 0 && p[0] <= g.w && p[1] >= 0 && p[1] <= g.h;
    if (![A, C, D].every(inG)) continue;
    const name = alt ? 'ひし形' : '平行四辺形';
    return {
      engine: 'geometry',
      id: `draw${alt ? '-alt' : ''}:${ptsKey([A, B, C])}`,
      objective: 'draw',
      level,
      prompt: `辺アイと 辺イウを 使って、${name}アイウエを かこう。（ア → イ → ウ → エの じゅんに タップして、さいごに アを タップ）`,
      hints: [
        `${name}は 向かい合う 辺が 平行で、長さも 等しいよ。`,
        '頂点エは、アから 辺イウと 同じ 向きに 同じ 長さだけ 進んだ ところ。',
        `イから ウへは 横に ${v[0]}、たてに ${v[1]}。アから 同じように 進もう。`,
      ],
      explain: `辺アエを 辺イウと 平行で 同じ 長さに すると、${name}に なります。`,
      identity: `draw:${ptsKey([A, B, C])}`,
      alt,
      task: {
        kind: 'draw',
        grid: g,
        given: [{ points: [A, B, C], closed: false, names: ['ア', 'イ', 'ウ'] }],
        target: { kind: 'exact', points: [A, B, C, D] },
      },
    };
  }
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['classify', 'props'] },
  { objs: ['props', 'diag', 'classify'] },
  { objs: ['draw', 'diag', 'props', 'classify'] },
];

export function generateQuadrilaterals(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  // 手作りの 別例（せいしつ・対角線の 文）は 数が 少ないので 出す 割合を 下げる（偏りの 検査）
  const alt = rng.next() < (obj === 'props' || obj === 'diag' ? 0.12 : 0.3);
  switch (obj) {
    case 'classify':
      return classify(level, rng, alt);
    case 'props':
      return props(level, rng, alt);
    case 'diag':
      return diag(level, rng, alt);
    case 'draw':
      return draw(level, rng, alt);
  }
}

export const quadrilaterals: UnitSpec = finishUnit({
  id: 'g4.math.quadrilaterals',
  title: 'いろいろな 四角形（台形・平行四辺形・ひし形）',
  stage: 'g4',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: ['g4.math.parallel-perp'],
  objectives: [
    { id: 'classify', title: '台形・平行四辺形・ひし形を 見分ける' },
    { id: 'props', title: '辺と 角の せいしつ' },
    { id: 'diag', title: '対角線' },
    { id: 'draw', title: '平行四辺形・ひし形を かく' },
  ],
  misconceptions: [
    {
      id: 'no-parallel',
      explain:
        '平行な 辺が あるか、方がんの ますで たしかめよう。向かい合う 辺が 1組も 平行で なければ 台形でも ないよ。',
    },
    {
      id: 'trap-par',
      explain: '平行な 辺の 組の 数を 数えよう。1組なら 台形、2組なら 平行四辺形だよ。',
    },
    {
      id: 'rhombus-sides',
      explain:
        'ひし形は 4つの 辺の 長さが みんな 等しいよ。向かい合う 辺だけ 等しいのは 平行四辺形だね。',
    },
    {
      id: 'rhombus-kite',
      explain:
        'ひし形に 見えても、辺の 長さが ちがうかも。4つの 辺が みんな 同じ 長さか たしかめよう。',
    },
    {
      id: 'opp-side',
      explain:
        '向かい合う 辺と、となり合う 辺を まちがえたのかな。平行四辺形で 長さが 等しいのは 向かい合う 辺だよ。',
    },
    {
      id: 'opp-angle',
      explain:
        '向かい合う 角と、となり合う 角を まちがえたのかな。平行四辺形の 向かい合う 角は 等しく、となり合う 角を たすと 180°だよ。',
    },
    {
      id: 'prop-confuse',
      explain:
        'ほかの 四角形の せいしつと まざったのかな。4つの 角が みんな 直角なのは 長方形と 正方形だよ。',
    },
    {
      id: 'diag-prop',
      explain: 'それぞれの 四角形に 対角線を かいて、長さや 交わり方を くらべよう。',
    },
    {
      id: 'diag-half',
      explain:
        '対角線の 全体と 半分を まちがえたのかな。対角線が 交わる 点は、対角線の まん中だよ。',
    },
  ],
  levels: [
    { label: '見分ける・せいしつ', chance: 0.05 },
    { label: '対角線', chance: 0.05 },
    { label: 'かく', chance: 0.02 },
  ],
  intro: [
    {
      text: '向かい合う 1組の 辺が 平行な 四角形を 台形と いいます。',
      figure: {
        kind: 'shape',
        shape: 'polygon',
        points: [
          [0, 80],
          [25, 10],
          [65, 10],
          [100, 80],
        ],
        w: 120,
        h: 80,
      },
    },
    {
      text: '向かい合う 2組の 辺が それぞれ 平行な 四角形を 平行四辺形と いいます。向かい合う 辺の 長さ、向かい合う 角の 大きさは 等しいです。',
      figure: paraFig(6, 4, 60, { ab: '6cm', ad: '4cm', angA: '60°' }),
    },
    {
      text: '4つの 辺の 長さが みんな 等しい 四角形を ひし形と いいます。向かい合う 辺は 平行です。',
      figure: {
        kind: 'shape',
        shape: 'polygon',
        points: [
          [0, 40],
          [35, 0],
          [70, 40],
          [35, 80],
        ],
        w: 70,
        h: 80,
      },
    },
    {
      text: '向かい合う 頂点を 結んだ 直線を 対角線と いいます。ひし形の 対角線は 垂直に 交わり、それぞれの まん中で 交わります。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateQuadrilaterals(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第4学年 B(1) 平面図形（平行四辺形・ひし形・台形、対角線）',
  revised: REVISED,
});
