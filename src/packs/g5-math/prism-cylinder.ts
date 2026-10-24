/**
 * g5.math.prism-cylinder 角柱・円柱（底面・側面・展開図）（curriculum-matrix 3.8）。
 * 立体の名前 → 底面・側面（形・関係）→ 面・辺・頂点の数 → 展開図（円柱の側面の横の長さ ＝ 底面の円周）。
 *
 * matrix は「手30」だが、立体 × 問う所で生成する（量の基準は概念の 60）。
 * 同一性キー: 問う形 × 立体（底面の頂点の数）× 問う所。図の高さの違い（ずらし）は別の問題に数える。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { dec, decAns, finishUnit, opts, pick, pickObj, r1, REVISED, STROKE, svg, wrongList } from './util';

type Obj = 'name' | 'parts' | 'count' | 'net';
type P = [number, number];

const KAKU: Record<number, string> = {
  3: '三角',
  4: '四角',
  5: '五角',
  6: '六角',
  7: '七角',
  8: '八角',
  9: '九角',
  10: '十角',
};
const prismName = (n: number) => `${KAKU[n]}柱`;
const polyName = (n: number) => `${KAKU[n]}形`;

/** 角柱の 見取図（shade: 色を ぬる 面） */
function prismFig(n: number, tall: boolean, shade: 'top' | 'side' | null = null): Figure {
  const R = 60;
  const cx = 100;
  const H = tall ? 120 : 70;
  const by = 40 + H + 0.38 * R;
  const off = Math.PI / n / (n % 2 === 0 ? 1 : 2);
  const th = Array.from({ length: n }, (_, i) => off + (2 * Math.PI * i) / n);
  const bot = th.map((t) => [r1(cx + R * Math.cos(t)), r1(by + 0.38 * R * Math.sin(t))] as P);
  const top = bot.map(([x, y]) => [x, r1(y - H)] as P);
  const front = (i: number) => Math.sin(th[i]! + Math.PI / n) > 1e-6;
  let body = '';
  // 後ろの 辺（点線）
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (!front(i))
      body += `<line x1="${bot[i]![0]}" y1="${bot[i]![1]}" x2="${bot[j]![0]}" y2="${bot[j]![1]}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    const prev = (i - 1 + n) % n;
    if (!front(i) && !front(prev))
      body += `<line x1="${bot[i]![0]}" y1="${bot[i]![1]}" x2="${top[i]![0]}" y2="${top[i]![1]}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  }
  // 前の 側面
  let shaded = false;
  for (let i = 0; i < n; i++) {
    if (!front(i)) continue;
    const j = (i + 1) % n;
    const fill = shade === 'side' && !shaded ? 'fill="var(--sky)" fill-opacity="0.8"' : 'fill="var(--sky)" fill-opacity="0.2"';
    if (shade === 'side') shaded = true;
    body += `<polygon points="${[bot[i]!, bot[j]!, top[j]!, top[i]!].map((p) => p.join(',')).join(' ')}" ${fill} ${STROKE}/>`;
  }
  const topFill = shade === 'top' ? 'fill="var(--sky)" fill-opacity="0.8"' : 'fill="var(--sky)" fill-opacity="0.2"';
  body += `<polygon points="${top.map((p) => p.join(',')).join(' ')}" ${topFill} ${STROKE}/>`;
  return svg(200, r1(by + 0.38 * R + 16), body, `${prismName(n)}の 見取図`);
}

function cylFig(tall: boolean, shade: 'top' | 'side' | null = null): Figure {
  const R = 60;
  const ry = 22;
  const cx = 100;
  const H = tall ? 120 : 70;
  const ty = 40;
  const by = ty + H;
  const sideFill = shade === 'side' ? '0.8' : '0.2';
  const topFill = shade === 'top' ? '0.8' : '0.2';
  let body = `<path d="M${cx - R} ${ty} L${cx - R} ${by} A${R} ${ry} 0 0 0 ${cx + R} ${by} L${cx + R} ${ty} Z" fill="var(--sky)" fill-opacity="${sideFill}" ${STROKE}/>`;
  body += `<path d="M${cx - R} ${by} A${R} ${ry} 0 0 1 ${cx + R} ${by}" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  body += `<ellipse cx="${cx}" cy="${ty}" rx="${R}" ry="${ry}" fill="var(--sky)" fill-opacity="${topFill}" ${STROKE}/>`;
  return svg(200, by + ry + 16, body, '円柱の 見取図');
}

/** 正多角形を 辺 PQ の 外がわ（進む 向きの 左＝画面で 上がわ）に つける */
function polyOn(p: P, q: P, n: number): P[] {
  const s = Math.hypot(q[0] - p[0], q[1] - p[1]);
  let dir = Math.atan2(q[1] - p[1], q[0] - p[0]);
  const ext = (2 * Math.PI) / n;
  const pts: P[] = [p, q];
  for (let i = 1; i < n - 1; i++) {
    dir -= ext;
    const last = pts[pts.length - 1]!;
    pts.push([last[0] + s * Math.cos(dir), last[1] + s * Math.sin(dir)]);
  }
  return pts;
}

/** 角柱の 展開図。kind: ok（正しい）/ same（底面が 2つとも 上）/ fewer・more（側面の 数が ちがう） */
function prismNet(n: number, kind: 'ok' | 'same' | 'fewer' | 'more'): Figure {
  const m = kind === 'fewer' ? n - 1 : kind === 'more' ? n + 1 : n;
  const s = Math.min(34, 200 / (m + 1));
  const h = 46;
  const polys: P[][] = [];
  const rects: P[][] = [];
  for (let i = 0; i < m; i++)
    rects.push([
      [i * s, 0],
      [(i + 1) * s, 0],
      [(i + 1) * s, h],
      [i * s, h],
    ]);
  polys.push(polyOn([0, 0], [s, 0], n));
  if (kind === 'same') polys.push(polyOn([s, 0], [2 * s, 0], n));
  else {
    const k = Math.min(m - 1, 1);
    polys.push(polyOn([(k + 1) * s, h], [k * s, h], n));
  }
  const all = [...rects, ...polys].flat();
  const minX = Math.min(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const T = (p: P) => `${r1(p[0] - minX + 8)},${r1(p[1] - minY + 8)}`;
  let body = '';
  for (const r of rects) body += `<polygon points="${r.map(T).join(' ')}" fill="var(--sky)" fill-opacity="0.25" stroke="var(--ink)" stroke-width="2"/>`;
  for (const pg of polys) body += `<polygon points="${pg.map(T).join(' ')}" fill="var(--sky)" fill-opacity="0.6" stroke="var(--ink)" stroke-width="2"/>`;
  return svg(r1(maxX - minX + 16), r1(maxY - minY + 16), body, '展開図');
}

/** 円柱の 展開図。kind: ok / short（横が 直径と 同じ）/ same（円が 2つとも 上） */
function cylNet(kind: 'ok' | 'short' | 'same'): Figure {
  const r = 18;
  const w = kind === 'short' ? 2 * r : r1(2 * r * 3.14);
  const h = 50;
  const top = 2 * r + 8;
  let body = `<rect x="8" y="${top}" width="${w}" height="${h}" fill="var(--sky)" fill-opacity="0.25" stroke="var(--ink)" stroke-width="2"/>`;
  const circle = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--sky)" fill-opacity="0.6" stroke="var(--ink)" stroke-width="2"/>`;
  body += circle(8 + r, top - r);
  body += kind === 'same' ? circle(8 + 3 * r, top - r) : circle(r1(8 + w - r), top + h + r);
  return svg(r1(Math.max(w, 4 * r) + 16), top + h + 2 * r + 8, body, '展開図');
}

/** 立体の 名前（alt: 説明の 文から） */
function nameItem(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const n = pick(rng, [0, 3, 4, 5, 6, 7, 8]);
  const tall = rng.next() < 0.5;
  const correct = n === 0 ? '円柱' : prismName(n);
  const wrongs: [string, string][] =
    n === 0
      ? [
          ['角柱', 'prism-cyl'],
          ['円', 'solid-plane'],
          ['六角柱', 'prism-cyl'],
        ]
      : [
          [prismName(n + 1 > 10 ? n - 1 : n + 1), 'count-faces'],
          [n + 2 <= 10 ? prismName(n + 2) : prismName(n - 2), 'count-faces'],
          ['円柱', 'prism-cyl'],
          [polyName(n), 'solid-plane'],
        ];
  if (alt) {
    const text =
      n === 0
        ? '2つの 底面が 合同な 円で、側面が 曲面に なって いる 立体'
        : `2つの 底面が 合同な ${polyName(n)}で、側面が ${n}つの 長方形に なって いる 立体`;
    return {
      engine: 'choice',
      id: `name-alt:${n}`,
      objective: 'name',
      level,
      prompt: `「${text}」の 名前は 何ですか。`,
      hints: [
        '底面の 形を 見よう。',
        '角柱の 名前は、底面の 形で 決まるよ。底面が 円なら 円柱。',
        n === 0 ? '底面が 円だね。' : `底面が ${polyName(n)}だね。`,
      ],
      explain: n === 0 ? '底面が 円の 立体は 円柱です。' : `底面が ${polyName(n)}の 角柱なので ${correct}です。`,
      identity: `name-text:${n}`,
      alt: true,
      options: opts(correct, wrongs),
    };
  }
  return {
    engine: 'choice',
    id: `name:${n}:${tall ? 't' : 's'}`,
    objective: 'name',
    level,
    prompt: 'この 立体の 名前は 何ですか。',
    figure: n === 0 ? cylFig(tall) : prismFig(n, tall),
    hints: [
      '上と 下に ある、向かい合った 2つの 面（底面）を 見よう。',
      n === 0 ? '底面は 円かな、多角形かな。' : '底面の 頂点の 数を 数えよう。',
      '角柱は「底面の 形 ＋ 柱」で 名前を つけるよ。',
    ],
    explain: n === 0 ? '底面が 円なので 円柱です。' : `底面が ${polyName(n)}なので ${correct}です。側面の 数は ${n}つです。`,
    identity: `name:${n}:${tall ? 't' : 's'}`,
    alt: false,
    options: opts(correct, wrongs),
  };
}

type PartQ = 'base' | 'side' | 'cylside' | 'rel' | 'perp';
/** 定義域（問う所 × 立体）。円柱の 問いは 1つ */
const PARTS_DOMAIN: [PartQ, number][] = [
  ...(['base', 'side', 'rel', 'perp'] as const).flatMap((q) => [3, 4, 5, 6, 8].map((n) => [q, n] as [PartQ, number])),
  ['cylside', 0],
];

/** 底面・側面（形・関係）。alt: 色の ついた 面は 底面か 側面か */
function parts(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (alt) {
    const n = pick(rng, [0, 3, 4, 5, 6, 8]);
    const which = rng.next() < 0.5 ? 'top' : 'side';
    const tall = rng.next() < 0.5;
    return {
      engine: 'choice',
      id: `parts-alt:${n}:${which}:${tall ? 't' : 's'}`,
      objective: 'parts',
      level,
      prompt: '色の こい 面は、底面ですか、側面ですか。',
      figure: n === 0 ? cylFig(tall, which) : prismFig(n, tall, which),
      hints: [
        '角柱・円柱で、向かい合った 2つの 面を 底面と いうよ。',
        'まわりの 面が 側面だよ。上に ある 面も 底面だね。',
        '色の こい 面と 向かい合う 面は あるかな。',
      ],
      explain:
        which === 'top'
          ? '上の 面は、下の 面と 向かい合った 合同な 面なので 底面です。'
          : `まわりの 面なので 側面です。${n === 0 ? '円柱の 側面は 曲面です。' : '角柱の 側面は 長方形（または 正方形）です。'}`,
      identity: `parts-fig:${n}:${which}:${tall ? 't' : 's'}`,
      alt: true,
      fixedOrder: true,
      options:
        which === 'top'
          ? [
              { label: '底面', correct: true },
              { label: '側面', misconception: 'base-side' },
            ]
          : [
              { label: '底面', misconception: 'base-side' },
              { label: '側面', correct: true },
            ],
    };
  }
  const [q, n] = pick(rng, PARTS_DOMAIN);
  const nm = prismName(n);
  const base = { engine: 'choice' as const, objective: 'parts', level, alt: false };
  switch (q) {
    case 'base':
      return {
        ...base,
        id: `parts:base:${n}`,
        prompt: `${nm}の 底面は どんな 形ですか。`,
        hints: ['角柱の 名前は、底面の 形から つけるよ。', `${nm}の「${KAKU[n]}」が ヒントだよ。`, '側面ではなく、向かい合った 2つの 面の 形を 考えよう。'],
        explain: `${nm}の 底面は ${polyName(n)}です。側面は 長方形です。`,
        identity: `parts:base:${n}`,
        options: opts(polyName(n), [
          ['長方形', 'base-side'],
          [polyName(n === 8 ? 6 : n + 1), 'count-faces'],
          ['円', 'prism-cyl'],
        ]),
      };
    case 'side':
      return {
        ...base,
        id: `parts:side:${n}`,
        prompt: `${nm}の 側面は どんな 形ですか。`,
        hints: ['側面は、2つの 底面の 間の まわりの 面だよ。', '底面と 底面を まっすぐ つなぐ 面を 思いうかべよう。', '側面の 角は みな 直角だよ。'],
        explain: `角柱の 側面は 長方形（または 正方形）です。${nm}には 側面が ${n}つ あります。`,
        identity: `parts:side:${n}`,
        options: opts('長方形', [
          [polyName(n === 4 ? 5 : n), 'base-side'],
          ['円', 'prism-cyl'],
          ['ひし形', 'side-shape'],
        ]),
      };
    case 'cylside':
      return {
        ...base,
        id: 'parts:cylside',
        prompt: '円柱の 側面は どんな 面ですか。',
        hints: ['円柱の まわりを さわると どうなって いるかな。', '平らな 面か、曲がった 面か を 考えよう。', '曲がった 面を 曲面と いうよ。'],
        explain: '円柱の 側面は 曲がった 面（曲面）です。2つの 底面は 合同な 円です。',
        identity: 'parts:cylside',
        options: opts('曲面', [
          ['平面', 'flat-side'],
          ['円', 'base-side'],
        ]),
      };
    case 'rel':
      return {
        ...base,
        id: `parts:rel:${n}`,
        prompt: `${nm}の 2つの 底面は、どんな 関係に ありますか。`,
        hints: ['2つの 底面は、向かい合って いるね。', '形と 大きさは 同じかな。', '向かい合った 2つの 面は、平行かな、垂直かな。'],
        explain: '角柱の 2つの 底面は、平行で 合同です。',
        identity: `parts:rel:${n}`,
        options: opts('平行で、合同', [
          ['垂直で、合同', 'base-rel'],
          ['平行だが、大きさが ちがう', 'base-rel'],
          ['垂直で、大きさが ちがう', 'base-rel'],
        ]),
      };
    case 'perp':
      return {
        ...base,
        id: `parts:perp:${n}`,
        prompt: `${nm}の 底面と 側面は、どんな 関係に ありますか。`,
        hints: ['底面と 側面が 交わる ところの 角を 考えよう。', '側面は 底面に まっすぐ 立って いるね。', '直角に 交わる 2つの 面は どんな 関係かな。'],
        explain: '角柱の 側面は 底面に 垂直です。',
        identity: `parts:perp:${n}`,
        options: opts('垂直', [
          ['平行', 'base-rel'],
          ['合同', 'base-side'],
        ]),
      };
  }
}

/** 面・辺・頂点の 数（alt: 見取図を 見て） */
function count(level: number, rng: Rng, alt: boolean): NumberItem {
  const n = alt ? pick(rng, [3, 4, 5, 6, 8]) : rng.int(3, 10);
  const what = pick(rng, ['side', 'face', 'edge', 'vertex'] as const);
  const tall = rng.next() < 0.5;
  const nm = prismName(n);
  const ans = what === 'side' ? n : what === 'face' ? n + 2 : what === 'edge' ? 3 * n : 2 * n;
  const word = what === 'side' ? '側面' : what === 'face' ? '面' : what === 'edge' ? '辺' : '頂点';
  const answers = [{ kind: 'int' as const, value: ans }];
  const cands: [number, string][] =
    what === 'side'
      ? [[n + 2, 'base-side']]
      : what === 'face'
        ? [
            [n, 'forget-base'],
            [n + 1, 'forget-base'],
          ]
        : what === 'edge'
          ? [
              [2 * n, 'edge-count'],
              [n, 'edge-count'],
              [4 * n, 'edge-count'],
            ]
          : [
              [n, 'vertex-count'],
              [3 * n, 'vertex-count'],
            ];
  return {
    engine: 'number',
    id: `count${alt ? '-alt' : ''}:${n}:${what}${alt ? `:${tall ? 't' : 's'}` : ''}`,
    objective: 'count',
    level,
    prompt: alt ? `この ${nm}の ${word}の 数は いくつですか。` : `${nm}の ${word}の 数は いくつですか。`,
    figure: alt ? prismFig(n, tall) : undefined,
    hints: [
      `${nm}の 底面は ${polyName(n)}で、2つ あるよ。`,
      what === 'side'
        ? '側面は、底面の 辺 1つに 1つずつ あるよ。'
        : what === 'face'
          ? `側面は ${n}つ。底面も 数えよう。`
          : what === 'edge'
            ? `上の 底面の 辺、下の 底面の 辺、それに たての 辺が あるよ。`
            : '頂点は、上の 底面と 下の 底面に あるよ。',
      what === 'side'
        ? `底面の 辺の 数は ${n}。`
        : what === 'face'
          ? `${n} ＋ 2を 計算しよう。`
          : what === 'edge'
            ? `${n}本が 3組 あるね。`
            : `${n}こが 2組 あるね。`,
    ],
    explain:
      what === 'side'
        ? `${nm}の 側面は、底面の 辺の 数と 同じ ${n}つです。`
        : what === 'face'
          ? `側面 ${n}つと 底面 2つで、面の 数は ${n} ＋ 2 ＝ ${ans}です。`
          : what === 'edge'
            ? `上の 底面の 辺 ${n}本、下の 底面の 辺 ${n}本、たての 辺 ${n}本で、${n} × 3 ＝ ${ans}本です。`
            : `上の 底面に ${n}こ、下の 底面に ${n}こで、${n} × 2 ＝ ${ans}こです。`,
    identity: `count${alt ? '-fig' : ''}:${n}:${what}${alt ? `:${tall ? 't' : 's'}` : ''}`,
    alt,
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(answers, cands),
  };
}

/** 展開図: 円柱の 側面の 横の 長さ（alt: 正しい 展開図を 選ぶ） */
function net(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const n = pick(rng, [0, 3, 4, 5, 6]);
    if (n === 0) {
      const item: ChoiceItem = {
        engine: 'choice',
        id: 'net-alt:cyl',
        objective: 'net',
        level,
        prompt: '円柱の 展開図として 正しいのは どれ？',
        hints: [
          '組み立てると、2つの 円が 上と 下の 底面に なるよ。',
          '側面の 長方形の 横の 長さは、底面の 円の まわりに ぴったり まきつく 長さだよ。',
          '円周は 直径の 約3.14倍。長方形の 横は 円の 直径より ずっと 長いね。',
        ],
        explain: '円柱の 展開図は、側面の 長方形の 横の 長さが 底面の 円周と 等しく、2つの 円が 長方形の 上と 下に つきます。',
        identity: 'net-pick:cyl',
        alt: true,
        layout: 'grid',
        options: [
          { figure: cylNet('ok'), correct: true },
          { figure: cylNet('short'), misconception: 'diam-width' },
          { figure: cylNet('same'), misconception: 'net-overlap' },
        ],
      };
      return item;
    }
    const item: ChoiceItem = {
      engine: 'choice',
      id: `net-alt:${n}`,
      objective: 'net',
      level,
      prompt: `${prismName(n)}の 展開図として 正しいのは どれ？`,
      hints: [
        `${prismName(n)}は、底面が 2つ、側面が ${n}つ あるよ。`,
        '側面の 長方形の 数を 数えよう。',
        '組み立てた とき、2つの 底面が 上と 下に 分かれるかな。',
      ],
      explain: `${prismName(n)}の 展開図は、側面の 長方形が ${n}つ ならび、${polyName(n)}の 底面が 上と 下に 1つずつ つきます。`,
      identity: `net-pick:${n}`,
      alt: true,
      layout: 'grid',
      options: [
        { figure: prismNet(n, 'ok'), correct: true },
        { figure: prismNet(n, 'same'), misconception: 'net-overlap' },
        { figure: prismNet(n, 'fewer'), misconception: 'count-faces' },
        { figure: prismNet(n, 'more'), misconception: 'count-faces' },
      ],
    };
    return item;
  }
  const d = rng.int(1, 20);
  const h = rng.int(2, 15);
  const ans = d * 314;
  const answers = [decAns(ans, 2)];
  return {
    engine: 'number',
    id: `net:${d}:${h}`,
    objective: 'net',
    level,
    prompt: `底面の 直径が ${d}cm、高さが ${h}cmの 円柱の 展開図を かきます。側面の 長方形の 横の 長さは 何cmですか。`,
    figure: cylNet('ok'),
    hints: [
      '側面の 長方形を 丸めると、底面の 円の まわりに ぴったり まきつくよ。',
      '長方形の 横の 長さは、底面の 円周と 同じ。たての 長さが 高さだね。',
      `円周 ＝ 直径 × 3.14。${d} × 3.14を 計算しよう。`,
    ],
    explain: `側面の 横の 長さは 底面の 円周と 等しいので、${d} × 3.14 ＝ ${dec(ans, 2)}cmです。（たての 長さは 高さの ${h}cm）`,
    identity: `net:${d}:${h}`,
    alt: false,
    fields: [{ label: 'cm', answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [d, 'diam-width'],
      [h, 'diam-width'],
      [dec(2 * d * 314, 2), 'r-d-swap'],
      [dec((d * 314) / 2, 2), 'r-d-swap'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['name', 'parts'] },
  { objs: ['count', 'name', 'parts'] },
  { objs: ['net', 'count', 'parts', 'name'] },
];

export function generatePrismCylinder(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'name':
      return nameItem(level, rng, alt);
    case 'parts':
      return parts(level, rng, alt);
    case 'count':
      return count(level, rng, alt);
    case 'net':
      return net(level, rng, alt);
  }
}

export const prismCylinder: UnitSpec = finishUnit(
  {
    id: 'g5.math.prism-cylinder',
    title: '角柱と 円柱',
    stage: 'g5',
    subject: 'math',
    domain: 'B-shape',
    kind: 'concept',
    priority: 'P1',
    status: 'ready',
    icon: 'g1m-box',
    prereq: ['g4.math.cuboid'],
    objectives: [
      { id: 'name', title: '角柱・円柱の 名前' },
      { id: 'parts', title: '底面と 側面' },
      { id: 'count', title: '面・辺・頂点の 数' },
      { id: 'net', title: '展開図' },
    ],
    misconceptions: [
      { id: 'count-faces', explain: '側面の 数や 底面の 頂点の 数を 数えまちがえたのかな。角柱の 名前は 底面の 形で 決まり、側面の 数は 底面の 辺の 数と 同じだよ。' },
      { id: 'prism-cyl', explain: '角柱と 円柱を 取りちがえたのかな。底面が 多角形なら 角柱、円なら 円柱だよ。' },
      { id: 'solid-plane', explain: '平面の 図形の 名前を 選んだのかな。立体の 名前は「〜柱」だよ。' },
      { id: 'base-side', explain: '底面と 側面を 取りちがえたのかな。向かい合った 2つの 合同な 面が 底面、まわりの 面が 側面だよ。' },
      { id: 'side-shape', explain: '角柱の 側面の 角は みんな 直角だよ。だから 側面は 長方形（または 正方形）だね。' },
      { id: 'flat-side', explain: '円柱の 側面は 平らでは なく、曲がって いるよ。曲がった 面を 曲面と いうよ。' },
      { id: 'base-rel', explain: '面と 面の 関係を 取りちがえたのかな。2つの 底面は 平行で 合同、底面と 側面は 垂直だよ。' },
      { id: 'forget-base', explain: '底面を 数えわすれたのかな。側面の ほかに、上と 下の 底面が 2つ あるよ。' },
      { id: 'edge-count', explain: '辺の 数え方を 見直そう。上の 底面の 辺、下の 底面の 辺、たての 辺の 3組 あるよ。' },
      { id: 'vertex-count', explain: '頂点は、上の 底面と 下の 底面に 同じ 数ずつ あるよ。底面の 頂点の 数の 2倍だね。' },
      { id: 'diam-width', explain: '側面の 長方形の 横の 長さは、底面の 円の まわりの 長さ（円周）と 同じだよ。直径 × 3.14 で 求めよう。' },
      { id: 'r-d-swap', explain: '半径と 直径を 取りちがえたのかな。円周 ＝ 直径 × 3.14 だよ。' },
      { id: 'net-overlap', explain: '組み立てると、2つの 底面が 同じ がわに 重なって しまうよ。底面は 上と 下に 1つずつ つけよう。' },
    ],
    levels: [
      { label: '名前・底面と 側面', chance: 0.05 },
      { label: '面・辺・頂点の 数', chance: 0.02 },
      { label: '展開図・まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: 'このような 立体を 角柱と いいます。向かい合った 2つの 合同な 面を 底面、まわりの 長方形の 面を 側面と いいます。底面が 三角形なら 三角柱、五角形なら 五角柱です。',
        figure: prismFig(5, true),
      },
      {
        text: '底面が 円の 立体を 円柱と いいます。円柱の 側面は 曲がった 面（曲面）です。',
        figure: cylFig(true),
      },
      {
        text: '角柱の 展開図は、側面の 長方形が ならび、底面が 上と 下に 1つずつ つきます。円柱の 側面の 長方形の 横の 長さは、底面の 円周と 同じです。',
        figure: prismNet(5, 'ok'),
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generatePrismCylinder(level, rng, index),
    },
    review: 'objective',
    basis: '小学校学習指導要領（平成29年告示）算数 第5学年 B(2) 立体図形の性質（角柱・円柱、見取図・展開図）',
    revised: REVISED,
  },
  '向《む》かい合《あ》って 向《む》かい合《あ》う 向《む》かい合《あ》った 七角柱《ななかくちゅう》 九角柱《きゅうかくちゅう》 十角柱《じっかくちゅう》 曲面《きょくめん》 曲《ま》がった 曲《ま》がって 平《たい》ら 丸《まる》める 柱《ちゅう》 間《あいだ》 組《く》み立《た》てる 組《く》み立《た》てた 組《く》み立《た》てると 色《いろ》の こい 立《た》って 交《まじ》わる 名前《なまえ》 平行《へいこう》 垂直《すいちょく》 本《ほん》 組《くみ》',
);
