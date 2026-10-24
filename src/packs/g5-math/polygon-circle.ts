/**
 * g5.math.polygon-circle 正多角形、円周と円周率（3.14）（curriculum-matrix 3.8）。
 * 円を使って正多角形（中心の角）→ 直径と円周の関係（円周率）→ 円周の長さ → 円周から直径・半径。
 *
 * 種別は「概+計」（量の基準は概念の 60）。円周率は 3.14。長さは「0.01 が何こ」の整数で計算する。
 * 同一性キー: 問う形 × 数（直径・半径・頂点の数）。図つき・文章題は別のキー。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  dec,
  decAns,
  expr,
  finishUnit,
  opts,
  pick,
  pickObj,
  r1,
  REVISED,
  STROKE,
  svg,
  svgText,
  wrongList,
} from './util';

type Obj = 'regular' | 'pi' | 'circum' | 'diam';

const NAME: Record<number, string> = {
  3: '正三角形',
  4: '正方形',
  5: '正五角形',
  6: '正六角形',
  8: '正八角形',
  9: '正九角形',
  7: '正七角形',
  10: '正十角形',
  12: '正十二角形',
};

/** 円と、中心から 頂点へ 線を ひいた 正多角形 */
function regFig(n: number, mark: string): Figure {
  const R = 80;
  const cx = 110;
  const cy = 100;
  const pts = Array.from({ length: n }, (_, i) => {
    const t = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [r1(cx + R * Math.cos(t)), r1(cy + R * Math.sin(t))];
  });
  let body = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--ink)" stroke-opacity="0.45" stroke-width="2"/>`;
  body += `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="var(--sky)" fill-opacity="0.35" ${STROKE}/>`;
  for (const p of pts)
    body += `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  const t = -Math.PI / 2 + Math.PI / n;
  body += svgText(r1(cx + 24 * Math.cos(t)), r1(cy + 24 * Math.sin(t)), mark, 14);
  return svg(220, 200, body, `円の 中に かいた ${NAME[n] ?? '正多角形'}`);
}

/** 円の図（直径か半径の 線と 長さ） */
function circleFig(len: string, kind: 'd' | 'r'): Figure {
  const cx = 100;
  const cy = 90;
  const R = 70;
  let body = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="var(--sky)" fill-opacity="0.3" ${STROKE}/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="3" fill="var(--ink)"/>`;
  body +=
    kind === 'd'
      ? `<line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}" ${STROKE}/>`
      : `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" ${STROKE}/>`;
  body += svgText(kind === 'd' ? cx : cx + R / 2, cy - 14, len, 15);
  return svg(200, 180, body, kind === 'd' ? '直径を かいた 円' : '半径を かいた 円');
}

/** 円周（直径 d の 3.14 倍）を 0.01 の いくつ分で */
const circ = (d: number) => d * 314;

/** 正多角形: 中心の 角（alt: 正多角形を 選ぶ） */
function regular(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const n = pick(rng, [5, 6, 7, 8, 9, 10, 12]);
    const R = 34;
    const shape = (pts: [number, number][], label: string): Figure =>
      svg(
        90,
        90,
        `<polygon points="${pts.map((p) => p.map(r1).join(',')).join(' ')}" fill="var(--sky)" fill-opacity="0.35" ${STROKE}/>`,
        label,
      );
    const ring = (k: (i: number) => number) =>
      Array.from({ length: n }, (_, i) => {
        const t = -Math.PI / 2 + (2 * Math.PI * i) / n;
        return [45 + R * k(i) * Math.cos(t), 45 + R * k(i) * Math.sin(t)] as [number, number];
      });
    const reg = ring(() => 1);
    // 角が 等しくない（頂点を 中心から 近く・遠く した）形。n が 偶数なら 辺は 等しい
    const bumpy = ring((i) => (i % 2 === 0 ? 1.1 : 0.72));
    // 角は 等しいが 辺が 等しくない 形（長方形）
    const rect: [number, number][] = [
      [10, 25],
      [80, 25],
      [80, 65],
      [10, 65],
    ];
    // ひし形（辺は 等しいが 角が 等しくない）
    const rh: [number, number][] = [
      [45, 8],
      [72, 45],
      [45, 82],
      [18, 45],
    ];
    const item: ChoiceItem = {
      engine: 'choice',
      id: `regular-alt:${n}`,
      objective: 'regular',
      level,
      prompt: '正多角形は どれ？',
      hints: [
        '正多角形は、どんな きまりの ある 形だったかな。',
        '辺の 長さが みんな 等しくて、角の 大きさも みんな 等しい 形だよ。',
        '辺だけ、または 角だけ 等しい 形は 正多角形では ないよ。',
      ],
      explain: `${NAME[n]}は、辺の 長さも 角の 大きさも みんな 等しいので 正多角形です。長方形は 辺が、ひし形は 角が 等しく ありません。`,
      identity: `regular-pick:${n}`,
      alt: true,
      layout: 'grid',
      options: [
        { figure: shape(reg, 'かたち'), correct: true },
        { figure: shape(bumpy, 'かたち'), misconception: 'reg-looks' },
        { figure: shape(rect, 'かたち'), misconception: 'reg-angles-only' },
        { figure: shape(rh, 'かたち'), misconception: 'reg-sides-only' },
      ],
    };
    return item;
  }
  const t = pick(rng, ['center', 'count', 'hex'] as const);
  if (t === 'hex') {
    const r = rng.int(2, 12);
    const answers = [{ kind: 'int' as const, value: r }];
    const item: NumberItem = {
      engine: 'number',
      id: `regular:hex:${r}`,
      objective: 'regular',
      level,
      prompt: `半径 ${r}cmの 円の まわりを、半径と 同じ 長さで 区切って 正六角形を かきました。正六角形の 1辺の 長さは 何cmですか。`,
      figure: regFig(6, '60°'),
      hints: [
        '中心と 頂点を 結ぶと、三角形が 6つ できるね。',
        '中心の 角は 60°。その 三角形は、半径が 2辺の 二等辺三角形で、角が みんな 60°の 正三角形だよ。',
        '正三角形は 3つの 辺の 長さが 等しいね。',
      ],
      explain: `中心の まわりに できる 6つの 三角形は 正三角形なので、正六角形の 1辺は 半径と 同じ ${r}cmです。`,
      identity: `regular:hex:${r}`,
      alt: false,
      fields: [{ label: 'cm', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [[2 * r, 'r-d-swap']]),
    };
    return item;
  }
  const n = pick(rng, [3, 4, 5, 6, 8, 9, 10, 12]);
  const ans = 360 / n;
  if (t === 'count') {
    const answers = [{ kind: 'int' as const, value: n }];
    const item: NumberItem = {
      engine: 'number',
      id: `regular:count:${n}`,
      objective: 'regular',
      level,
      prompt: `円の 中心の まわりの 角を ${ans}°ずつに 分けて、半径と 円が 交わる 点を 結び、正多角形を かきます。何角形が できますか。`,
      hints: [
        '円の 中心の まわりの 角は 全部で 360°だよ。',
        `360°の 中に ${ans}°が いくつ 入るかを 考えよう。`,
        `360 ÷ ${ans}を 計算しよう。`,
      ],
      explain: `360 ÷ ${ans} ＝ ${n}なので、中心の まわりが ${n}こに 分かれて、${NAME[n]}が できます。`,
      identity: `regular:count:${n}`,
      alt: false,
      fields: [{ label: '角形', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [Number.isInteger(180 / ans) ? 180 / ans : null, 'use-180'],
      ]),
    };
    return item;
  }
  const answers = [{ kind: 'int' as const, value: ans }];
  const item: NumberItem = {
    engine: 'number',
    id: `regular:${n}`,
    objective: 'regular',
    level,
    prompt: `円の 中心の まわりを 等しく 分けて、${NAME[n]}を かきます。図の アの 角（中心の 角）は 何度に すれば よいですか。`,
    figure: regFig(n, 'ア'),
    hints: [
      '円の 中心の まわりの 角は 全部で 何度かな。',
      `中心の まわりの 360°を ${n}こに 等しく 分けるよ。`,
      `360 ÷ ${n}を 計算しよう。`,
    ],
    explain: `中心の まわりの 角 360°を ${n}等分するので、360 ÷ ${n} ＝ ${ans}°です。`,
    identity: `regular:${n}`,
    alt: false,
    fields: [{ label: '度', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [180 / n, 'use-180'],
      [((n - 2) * 180) / n, 'inner-angle'],
    ]),
  };
  return item;
}
/** 円周率の 意味（円周は 直径の 約何倍か）。alt: 正六角形と くらべる */
function pi(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (alt) {
    const which = pick(rng, ['hex', 'square', 'ratio'] as const);
    if (which === 'ratio') {
      return {
        engine: 'choice',
        id: 'pi-alt:ratio',
        objective: 'pi',
        level,
        prompt: '大きさの ちがう 円で、「円周 ÷ 直径」を 調べました。どんな ことが 言えますか。',
        hints: [
          '円周率の 意味を 思い出そう。',
          '円周が 直径の 何倍に なって いるかを 表す 数だよ。',
          '円の 大きさが 変わると、円周も 直径も 同じように 変わるね。',
        ],
        explain:
          'どんな 大きさの 円でも、円周 ÷ 直径は 同じ 数（約3.14）に なります。この 数を 円周率と いいます。',
        identity: 'pi-ratio',
        alt: true,
        options: [
          { label: 'どの 円でも 約3.14に なる', correct: true },
          { label: '大きい 円ほど 大きく なる', misconception: 'pi-varies' },
          { label: 'どの 円でも 約2に なる', misconception: 'pi-two' },
          { label: '小さい 円ほど 大きく なる', misconception: 'pi-varies' },
        ],
      };
    }
    const hex = which === 'hex';
    return {
      engine: 'choice',
      id: `pi-alt:${which}`,
      objective: 'pi',
      level,
      prompt: hex
        ? '直径 2cmの 円の 中に、ぴったり 入る 正六角形を かきました。正六角形の まわりの 長さは 6cmです。円周に ついて 正しいのは どれ？'
        : '直径 2cmの 円が、1辺 2cmの 正方形の 中に ぴったり 入って います。正方形の まわりの 長さは 8cmです。円周に ついて 正しいのは どれ？',
      figure: hex ? regFig(6, '') : squareCircleFig(),
      hints: [
        hex
          ? '円周は、中の 正六角形の まわりより 長いね。'
          : '円周は、外の 正方形の まわりより 短いね。',
        hex ? '正六角形の まわりは 直径の 3倍。' : '正方形の まわりは 直径の 4倍。',
        '円周は 直径の 3倍と 4倍の 間に なるよ。',
      ],
      explain: hex
        ? '円周は 正六角形の まわり（直径の 3倍）より 長く、直径の 約3.14倍です。'
        : '円周は 正方形の まわり（直径の 4倍）より 短く、直径の 約3.14倍です。',
      identity: `pi-${which}`,
      alt: true,
      options: hex
        ? [
            { label: '6cmより 長い', correct: true },
            { label: '6cmより 短い', misconception: 'pi-two' },
            { label: 'ちょうど 6cm', misconception: 'pi-two' },
          ]
        : [
            { label: '8cmより 短い', correct: true },
            { label: '8cmより 長い', misconception: 'pi-four' },
            { label: 'ちょうど 8cm', misconception: 'pi-four' },
          ],
    };
  }
  // 実際に はかった（例の）長さ: 直径 d、円周は 3.14 × d を 1/10 の位に 四捨五入
  const d = rng.int(3, 20);
  const c10 = Math.round((d * 314) / 10); // 0.1 の いくつ分
  const c = dec(c10, 1);
  return {
    engine: 'choice',
    id: `pi:${d}`,
    objective: 'pi',
    level,
    prompt: `直径 ${d}cmの 円の まわりに ひもを まいて はかったら、円周は 約${c}cmでした。円周は 直径の 約何倍ですか。`,
    hints: [
      '何倍かを 求めるには、わり算を 使うよ。',
      `円周 ÷ 直径 ＝ ${c} ÷ ${d}。`,
      'どの 円でも、だいたい 同じ 数に なるよ。',
    ],
    explain: `${c} ÷ ${d}は 約3.14。円周は 直径の 約3.14倍です。この 数を 円周率と いいます。`,
    identity: `pi:${d}`,
    alt: false,
    options: opts('約3.14倍', [
      ['約2倍', 'pi-two'],
      ['約6.28倍', 'r-d-swap'],
      ['約1.57倍', 'r-d-swap'],
    ]),
  };
}

function squareCircleFig(): Figure {
  const body = `<rect x="30" y="20" width="140" height="140" fill="none" ${STROKE}/><circle cx="100" cy="90" r="70" fill="var(--sky)" fill-opacity="0.3" ${STROKE}/>`;
  return svg(200, 180, body, '正方形の 中に 入った 円');
}

/** 円周の 長さ（直径・半径から）。alt: 図・タイヤが 1回転で 進む 長さ */
function circum(level: number, rng: Rng, alt: boolean): NumberItem {
  const useR = level > 0 && rng.next() < 0.5;
  const v = useR ? rng.int(1, 15) : rng.int(1, 30);
  const d = useR ? 2 * v : v;
  const ans = circ(d);
  const answers = [decAns(ans, 2)];
  const form = alt ? pick(rng, ['fig', 'story'] as const) : 'text';
  const given = `${useR ? '半径' : '直径'} ${v}cm`;
  const prompt =
    form === 'text'
      ? `${given}の 円の 円周の 長さは 何cmですか。`
      : form === 'fig'
        ? 'この 円の 円周の 長さは 何cmですか。'
        : `${useR ? '半径' : '直径'}が ${v}cmの 車りんが 1回転すると、何cm 進みますか。`;
  return {
    engine: 'number',
    id: `circum${alt ? `-${form}` : ''}:${useR ? 'r' : 'd'}${v}`,
    objective: 'circum',
    level,
    prompt,
    figure: form === 'fig' ? circleFig(`${v}cm`, useR ? 'r' : 'd') : undefined,
    hints: [
      form === 'story'
        ? '1回転で 進む 長さは、車りんの 円周と 同じだよ。'
        : '円周 ＝ 直径 × 3.14（円周率）',
      useR ? `直径は 半径の 2倍。${v} × 2 ＝ ${d}cm。` : `直径は ${d}cm。`,
      `${d} × 3.14を 計算しよう。`,
    ],
    explain: `${useR ? `直径は ${v} × 2 ＝ ${d}cm。` : ''}円周 ＝ 直径 × 3.14 ＝ ${d} × 3.14 ＝ ${dec(ans, 2)}。${form === 'story' ? `1回転で ${dec(ans, 2)}cm 進みます。` : `円周は ${dec(ans, 2)}cmです。`}`,
    identity: `circum${alt ? `-${form}` : ''}:${useR ? 'r' : 'd'}${v}`,
    alt,
    fields: [{ label: 'cm', answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [useR ? dec(circ(v), 2) : dec(circ(2 * v), 2), 'r-d-swap'],
      [dec(d * 300, 2), 'pi-three'],
      [dec(d * 100 + 314, 2), 'add-pi'],
      [dec(ans, 3), 'point-place'],
      [dec(ans, 1), 'point-place'],
    ]),
  };
}

/** 円周から 直径（alt: 半径） */
function diam(level: number, rng: Rng, alt: boolean): NumberItem {
  const d = alt ? 2 * rng.int(1, 15) : rng.int(1, 30);
  const C = dec(circ(d), 2);
  const ans = alt ? d / 2 : d;
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `diam${alt ? '-alt' : ''}:${d}`,
    objective: 'diam',
    level,
    prompt: alt
      ? `円周の 長さが ${C}cmの 円が あります。この 円の 半径は 何cmですか。`
      : `円周の 長さが ${C}cmの 円が あります。この 円の 直径は 何cmですか。`,
    figure: expr(alt ? `□ × 2 × 3.14 ＝ ${C}` : `□ × 3.14 ＝ ${C}`),
    hints: [
      '円周 ＝ 直径 × 3.14 の 式に あてはめよう。',
      alt
        ? `半径を □と すると、直径は □ × 2。□ × 2 × 3.14 ＝ ${C}。`
        : `直径を □として、□ × 3.14 ＝ ${C}。`,
      alt ? `${C} ÷ 3.14で 直径を 出してから、半径を 考えよう。` : `${C} ÷ 3.14を 計算しよう。`,
    ],
    explain: alt
      ? `直径は ${C} ÷ 3.14 ＝ ${d}cm。半径は 直径の 半分なので ${d} ÷ 2 ＝ ${ans}cmです。`
      : `□ × 3.14 ＝ ${C} なので、□ ＝ ${C} ÷ 3.14 ＝ ${d}。直径は ${d}cmです。`,
    identity: `diam${alt ? '-r' : ''}:${d}`,
    alt,
    fields: [{ label: 'cm', answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [alt ? d : d / 2, 'r-d-swap'],
      [dec(circ(d) * 314, 4), 'mult-instead'],
      [d * 10, 'point-place'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['regular', 'pi'] },
  { objs: ['circum', 'pi', 'regular'] },
  { objs: ['diam', 'circum', 'regular', 'pi'] },
];

export function generatePolygonCircle(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < (obj === 'pi' ? 0.15 : 0.3);
  switch (obj) {
    case 'regular':
      return regular(level, rng, alt);
    case 'pi':
      return pi(level, rng, alt);
    case 'circum':
      return circum(level, rng, alt);
    case 'diam':
      return diam(level, rng, alt);
  }
}

export const polygonCircle: UnitSpec = finishUnit(
  {
    id: 'g5.math.polygon-circle',
    title: '正多角形と 円周',
    stage: 'g5',
    subject: 'math',
    domain: 'B-shape',
    kind: 'concept',
    priority: 'P1',
    status: 'ready',
    icon: 'mode-shapes',
    prereq: ['g3.math.circle-sphere', 'g5.math.angle-sum'],
    objectives: [
      { id: 'regular', title: '正多角形（円を 使って かく）' },
      { id: 'pi', title: '円周率の 意味' },
      { id: 'circum', title: '円周の 長さを 求める' },
      { id: 'diam', title: '円周から 直径・半径を 求める' },
    ],
    misconceptions: [
      {
        id: 'use-180',
        explain: '180°を 分けたのかな。円の 中心の まわりの 角は 1回転で 360°だよ。',
      },
      {
        id: 'inner-angle',
        explain:
          '正多角形の 1つの 角を 求めたのかな。中心の 角は、360°を 頂点の 数で 等しく 分けた 角だよ。',
      },
      {
        id: 'reg-sides-only',
        explain:
          '辺の 長さだけを 見たのかな。正多角形は、辺の 長さも 角の 大きさも みんな 等しい 形だよ。',
      },
      {
        id: 'reg-looks',
        explain:
          '見た目が にて いる 形を 選んだのかな。正多角形は、辺の 長さも 角の 大きさも みんな 等しい 形だよ。',
      },
      {
        id: 'reg-angles-only',
        explain:
          '角だけを 見たのかな。長方形は 角は 等しいけれど、辺の 長さが 等しく ないので 正多角形では ないよ。',
      },
      {
        id: 'pi-varies',
        explain:
          '円の 大きさで 変わると 考えたのかな。円周 ÷ 直径は、どんな 大きさの 円でも 約3.14だよ。',
      },
      {
        id: 'pi-two',
        explain:
          '円周は 直径の 3倍より 長いよ。円の 中の 正六角形の まわりが 直径の 3倍なので、円周は それより 長く なるね。',
      },
      {
        id: 'pi-four',
        explain:
          '円周は 直径の 4倍より 短いよ。円が ぴったり 入る 正方形の まわりが 直径の 4倍なので、円周は それより 短く なるね。',
      },
      {
        id: 'r-d-swap',
        explain:
          '半径と 直径を 取りちがえたのかな。円周 ＝ 直径 × 3.14。半径が わかって いる ときは、2倍して 直径に してから かけよう。',
      },
      { id: 'pi-three', explain: '3を かけたのかな。円周率は 3.14を 使うよ。' },
      { id: 'add-pi', explain: '3.14を たしたのかな。円周は 直径の 3.14倍なので、かけ算だよ。' },
      {
        id: 'point-place',
        explain:
          '小数点の 位置が ずれたのかな。3.14は [[1/100]]の位まで あるので、積の 小数点は 右から 2けたの ところだよ。',
      },
      {
        id: 'mult-instead',
        explain: '3.14を かけたのかな。円周から 直径を 求める ときは、円周 ÷ 3.14 だよ。',
      },
    ],
    levels: [
      { label: '正多角形・円周率', chance: 0.02 },
      { label: '円周の 長さ', chance: 0.02 },
      { label: '直径・半径を 求める・まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: '辺の 長さが みんな 等しく、角の 大きさも みんな 等しい 多角形を 正多角形と いいます。円の 中心の まわりの 角を 等しく 分けると、正多角形が かけます。',
        figure: regFig(6, '60°'),
      },
      {
        text: 'どんな 大きさの 円でも、円周 ÷ 直径は 約3.14に なります。この 数を 円周率と いいます。',
        figure: circleFig('10cm', 'd'),
      },
      {
        text: '円周 ＝ 直径 × 3.14。直径 10cmの 円の 円周は 10 × 3.14 ＝ 31.4cm。半径 5cmなら、直径は 10cmなので 同じく 31.4cm です。',
        figure: expr('10 × 3.14 ＝ 31.4'),
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generatePolygonCircle(level, rng, index),
    },
    review: 'objective',
    basis:
      '小学校学習指導要領（平成29年告示）算数 第5学年 B(1) 正多角形、円周率（円周率は 3.14 を用いる）',
    revised: REVISED,
  },
  '何角形《なんかくけい》 角形《かくけい》 ひし形《がた》 正七角形《せいななかくけい》 入《はい》 短《みじか》 区切《くぎ》 結《むす》 交《まじ》わる 出《だ》 間《あいだ》 度《ど》 正六角形《せいろっかくけい》 正五角形《せいごかくけい》 正八角形《せいはっかくけい》 正九角形《せいきゅうかくけい》 正十角形《せいじっかくけい》 正十二角形《せいじゅうにかくけい》 十二角形《じゅうにかくけい》 車《しゃ》りん 回転《かいてん》 等分《とうぶん》 意味《いみ》 言《い》え 言《い》う 実際《じっさい》 正《せい》',
);
