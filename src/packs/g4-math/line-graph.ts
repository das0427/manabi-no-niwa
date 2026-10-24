/**
 * g4.math.line-graph 折れ線グラフ（変化の読み取り、2本の折れ線）（curriculum-matrix 3.7）。
 * 点を打つ → 変化の大きさ → 2本の折れ線。データは本アプリの「れいの データ」（実際の観測ではない）。
 *
 * 2本の折れ線は graph エンジンが1本しか描けないので、SVG の図（線の種類と点の形で区別。色だけに頼らない）＋選択肢で出す。
 * 同一性キー: 問う形 × データの種類 × 値の列（× 問う所）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { GraphItem } from '../../engines/graph/graph';
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import { finishUnit, opts, pick, pickObj, REVISED, STROKE, svg, svgText, wrongList } from './util';

type Obj = 'read' | 'change' | 'trend' | 'make' | 'two';

interface DataSpec {
  id: string;
  title: string;
  labels: string[];
  unit: string;
  step: number;
  min: number;
  start: [number, number];
  delta: [number, number];
  /** 値の下限・上限（目もりの いくつ分） */
  lo: number;
  hi: number;
  time: string; // 「何時から 何時」の 言い方
}

const DATA: DataSpec[] = [
  {
    id: 'temp',
    title: 'ある 日の 気温（れいの データ）',
    labels: ['8時', '9時', '10時', '11時', '12時', '13時', '14時'],
    unit: '度', step: 2, min: 0, start: [6, 9], delta: [-1, 2], lo: 3, hi: 15, time: '時',
  },
  {
    id: 'plant',
    title: 'ヘチマの たけ（れいの データ）',
    labels: ['1週', '2週', '3週', '4週', '5週', '6週'],
    unit: 'cm', step: 10, min: 0, start: [10, 30], delta: [0, 4], lo: 0, hi: 20, time: '週',
  },
  {
    id: 'water',
    title: '水を あたためた ときの 温度（れいの データ）',
    labels: ['0分', '2分', '4分', '6分', '8分', '10分'],
    unit: '度', step: 10, min: 0, start: [2, 3], delta: [0, 3], lo: 1, hi: 10, time: '分',
  },
  {
    id: 'body',
    title: 'かぜを ひいた ときの 体温（れいの データ）',
    labels: ['6時', '9時', '12時', '15時', '18時', '21時'],
    unit: '度', step: 0.5, min: 35, start: [72, 76], delta: [-2, 2], lo: 71, hi: 78, time: '時',
  },
  {
    id: 'month',
    title: 'ある 町の 月ごとの 気温（れいの データ）',
    labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'],
    unit: '度', step: 2, min: 0, start: [2, 4], delta: [-1, 3], lo: 1, hi: 15, time: '月',
  },
  {
    id: 'puppy',
    title: '子犬の 体重（れいの データ）',
    labels: ['1か月', '2か月', '3か月', '4か月', '5か月', '6か月'],
    unit: 'kg', step: 1, min: 0, start: [1, 3], delta: [0, 3], lo: 1, hi: 20, time: 'か月',
  },
];

/** 値の列（目盛りの いくつ分の 整数で 作り、step を かける） */
function series(d: DataSpec, rng: Rng): number[] {
  for (;;) {
    let v = rng.int(d.start[0], d.start[1]);
    const out = [v];
    for (let i = 1; i < d.labels.length; i++) {
      v += rng.int(d.delta[0], d.delta[1]);
      out.push(v);
    }
    if (out.every((x) => x >= d.lo && x <= d.hi)) {
      // となりとの 差が 同じ 区間が いくつも あると「いちばん」が きまらないので、変化の 最大が 1つの ものに
      const diffs = out.slice(1).map((x, i) => x - out[i]!);
      const mx = Math.max(...diffs);
      if (diffs.filter((x) => x === mx).length === 1 && mx > 0) return out.map((x) => x * d.step);
    }
  }
}

const fmt = (x: number) => String(Math.round(x * 100) / 100);

function graphData(d: DataSpec, vals: number[]) {
  const top = Math.max(...vals);
  const max = Math.ceil((top + d.step) / d.step) * d.step;
  return {
    kind: 'line' as const,
    labels: d.labels,
    values: vals,
    scaleStep: d.step,
    labelEvery: d.step === 0.5 ? 2 : d.step >= 10 ? 1 : 2,
    max,
    min: d.min,
    unit: d.unit,
    title: d.title,
  };
}

/** 値を 読む（alt: 0から 始まらない 目盛り＝波線の グラフを 読む） */
function read(level: number, rng: Rng, alt: boolean): GraphItem {
  const d = alt ? pick(rng, DATA.filter((x) => x.min > 0)) : pick(rng, DATA.filter((x) => x.min === 0));
  const vals = series(d, rng);
  const i = rng.int(0, vals.length - 1);
  const ans = vals[i]!;
  const dec = d.step < 1;
  return {
    engine: 'graph',
    id: `read${alt ? '-alt' : ''}:${d.id}:${vals.join(',')}:${i}`,
    objective: 'read',
    level,
    prompt: `${d.labels[i]}の ${d.id === 'plant' ? 'たけ' : d.id === 'puppy' ? '体重' : '温度'}は 何${d.unit}ですか。`,
    hints: [
      alt ? `たての じくは ${d.min}${d.unit}から 始まって いるよ（とちゅうを 省いて いる しるしが あるね）。` : 'たての じくの 1めもりの 大きさを たしかめよう。',
      `1めもりは ${fmt(d.step)}${d.unit}。`,
      `${d.labels[i]}の 点から 左へ 横に たどって 目もりを 読もう。`,
    ],
    explain: `${d.labels[i]}の 点は ${fmt(ans)}${d.unit}の 高さです。`,
    identity: `read:${d.id}:${vals.join(',')}:${i}`,
    alt,
    data: graphData(d, vals),
    task: {
      kind: 'number',
      fields: [{ label: d.unit, answer: dec ? { kind: 'decimal', value: ans } : { kind: 'int', value: ans } }],
      keys: dec ? ['decimal'] : undefined,
      wrongAnswers: wrongList(
        [dec ? { kind: 'decimal', value: ans } : { kind: 'int', value: ans }],
        [
          [d.step !== 1 ? fmt((ans - d.min) / d.step + d.min) : null, 'scale-one'],
          [i + 1 < vals.length ? fmt(vals[i + 1]!) : null, 'next-point'],
          [i > 0 ? fmt(vals[i - 1]!) : null, 'next-point'],
        ],
      ).map((w) => ({ ...w, value: fmt(Number(w.value)) })),
    },
  };
}

/** 変化の 大きさ（alt: 上がり方の 大きさを 数で） */
function change(level: number, rng: Rng, alt: boolean): GraphItem {
  const d = pick(rng, DATA.filter((x) => x.min === 0));
  const vals = series(d, rng);
  const diffs = vals.slice(1).map((x, i) => x - vals[i]!);
  const k = diffs.indexOf(Math.max(...diffs));
  const span = (j: number) => `${d.labels[j]}から ${d.labels[j + 1]}`;
  if (alt) {
    return {
      engine: 'graph',
      id: `change-alt:${d.id}:${vals.join(',')}`,
      objective: 'change',
      level,
      prompt: `${span(k)}の 間に、何${d.unit} 上がりましたか（ふえましたか）。`,
      hints: ['2つの 点の 高さを それぞれ 読もう。', `${d.labels[k]}は ${fmt(vals[k]!)}${d.unit}。`, `${d.labels[k + 1]}の 数から ひこう。`],
      explain: `${fmt(vals[k + 1]!)} − ${fmt(vals[k]!)} ＝ ${fmt(diffs[k]!)}。${fmt(diffs[k]!)}${d.unit} 上がりました。`,
      identity: `change-amt:${d.id}:${vals.join(',')}`,
      alt: true,
      data: graphData(d, vals),
      task: {
        kind: 'number',
        fields: [{ label: d.unit, answer: { kind: 'int', value: diffs[k]! } }],
        wrongAnswers: wrongList(
          [{ kind: 'int', value: diffs[k]! }],
          [
            [vals[k + 1]!, 'value-not-change'],
            [diffs[k]! / d.step, 'scale-one'],
          ],
        ),
      },
    };
  }
  // いちばん 高い 値を ふくむ 区間（値の 大きさと 変化の 大きさの 混同）
  const top = vals.indexOf(Math.max(...vals));
  const highSpan = top > 0 ? top - 1 : 0;
  const minD = diffs.indexOf(Math.min(...diffs));
  const others = diffs.map((_, j) => j).filter((j) => j !== k && j !== highSpan && j !== minD);
  const wrongs: [string, string][] = [];
  if (highSpan !== k) wrongs.push([span(highSpan), 'value-not-change']);
  if (minD !== k && minD !== highSpan) wrongs.push([span(minD), 'down-vs-up']);
  for (const j of rng.shuffle(others)) wrongs.push([span(j), 'slope-read']);
  return {
    engine: 'graph',
    id: `change:${d.id}:${vals.join(',')}`,
    objective: 'change',
    level,
    prompt: `${d.id === 'plant' || d.id === 'puppy' ? 'ふえ方' : '上がり方'}が いちばん 大きいのは、どこから どこまでの 間ですか。`,
    hints: ['線の かたむきが 急な ところほど、変わり方が 大きいよ。', '右上がりで、いちばん 急な ところを さがそう。', 'となり どうしの 点の 高さの ちがいを くらべよう。'],
    explain: `${span(k)}の 間が ${fmt(diffs[k]!)}${d.unit}で、いちばん 大きく ${d.id === 'plant' || d.id === 'puppy' ? 'ふえて' : '上がって'} います。線の かたむきが いちばん 急です。`,
    identity: `change:${d.id}:${vals.join(',')}`,
    alt: false,
    data: graphData(d, vals),
    task: { kind: 'choice', options: opts(span(k), wrongs) },
  };
}

/** 変わり方（上がる・下がる・変わらない）。alt: 文で 表した 変わり方に 合う グラフの 区間 */
function trend(level: number, rng: Rng, alt: boolean): GraphItem {
  const d = pick(rng, DATA.filter((x) => x.min === 0 && x.id !== 'plant' && x.id !== 'puppy' && x.id !== 'water'));
  const vals = series(d, rng);
  const diffs = vals.slice(1).map((x, i) => x - vals[i]!);
  const j = rng.int(0, diffs.length - 1);
  const word = (x: number) => (x > 0 ? '上がって いる' : x < 0 ? '下がって いる' : '変わらない');
  const w = word(diffs[j]!);
  if (alt) {
    const target = diffs[j]! > 0 ? 'up' : diffs[j]! < 0 ? 'down' : 'flat';
    const cands = diffs.map((x, i) => ({ i, t: x > 0 ? 'up' : x < 0 ? 'down' : 'flat' }));
    const right = cands.filter((c) => c.t === target);
    const wrong = cands.filter((c) => c.t !== target);
    if (wrong.length === 0) return trend(level, rng, false);
    const pickR = pick(rng, right);
    const span = (i: number) => `${d.labels[i]}から ${d.labels[i + 1]}`;
    return {
      engine: 'graph',
      id: `trend-alt:${d.id}:${vals.join(',')}:${target}:${pickR.i}`,
      objective: 'trend',
      level,
      prompt: `温度が ${target === 'up' ? '上がって いる' : target === 'down' ? '下がって いる' : '変わらない'} 間は どれ？`,
      hints: ['線が 右上がりなら 上がる、右下がりなら 下がる、横に まっすぐなら 変わらない。', '選たくしの 間の 線の 向きを 1つずつ 見よう。', '点の 高さを 2つ くらべても わかるよ。'],
      explain: `${span(pickR.i)}の 間の 線は ${target === 'up' ? '右上がり' : target === 'down' ? '右下がり' : '横に まっすぐ'}です。`,
      identity: `trend-pick:${d.id}:${vals.join(',')}:${target}:${pickR.i}`,
      alt: true,
      data: graphData(d, vals),
      task: {
        kind: 'choice',
        options: opts(
          span(pickR.i),
          rng.sample(wrong, Math.min(3, wrong.length)).map((c) => [span(c.i), 'trend-read'] as [string, string]),
        ),
      },
    };
  }
  return {
    engine: 'graph',
    id: `trend:${d.id}:${vals.join(',')}:${j}`,
    objective: 'trend',
    level,
    prompt: `${d.labels[j]}から ${d.labels[j + 1]}までの 温度の 変わり方は どれ？`,
    hints: ['2つの 点を 結ぶ 線の 向きを 見よう。', '右上がりなら 上がる、右下がりなら 下がる、横なら 変わらない。', `${d.labels[j]}と ${d.labels[j + 1]}の 点の 高さを くらべよう。`],
    explain: `${d.labels[j]}は ${fmt(vals[j]!)}${d.unit}、${d.labels[j + 1]}は ${fmt(vals[j + 1]!)}${d.unit}。温度は ${w}。`,
    identity: `trend:${d.id}:${vals.join(',')}:${j}`,
    alt: false,
    data: graphData(d, vals),
    task: {
      kind: 'choice',
      options: (['上がって いる', '下がって いる', '変わらない'] as const).map((x) =>
        x === w ? { label: x, correct: true } : { label: x, misconception: 'trend-read' },
      ),
    },
  };
}

/** 点を 打って 折れ線グラフを かく（alt: まちがった 点を 1つ なおす） */
function make(level: number, rng: Rng, alt: boolean): GraphItem {
  const d = pick(rng, DATA.filter((x) => x.min === 0));
  const vals = series(d, rng);
  const gd = graphData(d, vals);
  let initial: (number | null)[] | undefined;
  if (alt) {
    const k = rng.int(0, vals.length - 1);
    initial = vals.map((v, i) => (i === k ? (v + d.step <= gd.max ? v + d.step : v - d.step) : v));
  }
  return {
    engine: 'graph',
    id: `make${alt ? '-alt' : ''}:${d.id}:${vals.join(',')}`,
    objective: 'make',
    level,
    prompt: alt
      ? '表を 見て かいた 折れ線グラフに、まちがいが 1つ あります。点を なおそう。'
      : '表の 数を 見て、点を 打って 折れ線グラフを かこう。',
    hints: [
      `たての じくの 1めもりは ${fmt(d.step)}${d.unit}だよ。`,
      alt ? '表の 数と 点の 高さを 1つずつ くらべよう。' : `${d.labels[0]}は ${fmt(vals[0]!)}${d.unit}。その 高さに 点を 打とう。`,
      alt ? 'ちがう 点を 正しい 高さに 動かそう。' : 'のこりも 表の 数の 高さに 点を 打とう。点は 自動で 線で 結ばれるよ。',
    ],
    explain: `${d.labels.map((l, i) => `${l} ${fmt(vals[i]!)}`).join('、')}の 高さに 点を 打って、線で 結びます。`,
    identity: `make:${d.id}:${vals.join(',')}${alt ? ':fix' : ''}`,
    alt,
    data: gd,
    task: { kind: 'make', showTable: true, ...(initial ? { initial } : {}) },
    misconceptions: { scaleAsOne: 'scale-one' },
  };
}

/** 2本の 折れ線（SVG） */
function twoFig(a: number[], b: number[], step: number, max: number): Figure {
  const W = 320;
  const H = 200;
  const L = 36;
  const T = 14;
  const gw = W - L - 14;
  const gh = H - T - 30;
  const X = (i: number) => L + (gw * i) / (a.length - 1);
  const Y = (v: number) => T + gh - (gh * v) / max;
  let body = '';
  for (let v = 0; v <= max; v += step) {
    body += `<line x1="${L}" y1="${Y(v)}" x2="${L + gw}" y2="${Y(v)}" stroke="var(--ink)" stroke-opacity="0.15" stroke-width="1"/>`;
    if ((v / step) % 2 === 0) body += svgText(L - 8, Y(v), String(v), 11, 'end');
  }
  body += `<line x1="${L}" y1="${T}" x2="${L}" y2="${T + gh}" ${STROKE}/><line x1="${L}" y1="${T + gh}" x2="${L + gw}" y2="${T + gh}" ${STROKE}/>`;
  a.forEach((_, i) => (body += svgText(X(i), T + gh + 16, String(i + 1), 12)));
  body += `<polyline points="${a.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}" fill="none" ${STROKE}/>`;
  body += `<polyline points="${b.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}" fill="none" ${STROKE} stroke-dasharray="7 5"/>`;
  a.forEach((v, i) => (body += `<circle cx="${X(i)}" cy="${Y(v)}" r="5" fill="var(--ink)"/>`));
  b.forEach((v, i) => (body += `<rect x="${X(i) - 5}" y="${Y(v) - 5}" width="10" height="10" fill="var(--white)" ${STROKE}/>`));
  return svg(W, H, body, '2本の 折れ線グラフ');
}

/** 2本の 折れ線（alt: 折れ線グラフに 合う データを 選ぶ） */
function two(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (alt) {
    const right = pick(rng, ['1日の 気温の 変わり方', '1年間の 月ごとの 気温の 変わり方', '自分の 身長の 毎年の 変わり方', 'ヘチマの たけの 週ごとの のび方', '水を あたためた ときの 温度の 変わり方']);
    const wrongPool = ['クラスで すきな くだものの 人数', '学年ごとの 図書館で かりた 本の 数', '町ごとの 小学生の 人数', 'すきな スポーツの 人数', '色ごとの 花の 本数'];
    const ws = rng.sample(wrongPool, 3);
    return {
      engine: 'choice',
      id: `two-alt:${right}:${ws.join(',')}`,
      objective: 'two',
      level,
      prompt: '折れ線グラフに 表すのに いちばん 合う ものは どれ？',
      hints: ['折れ線グラフは、時間と ともに 変わる ようすを 表すのに 向いて いるよ。', '同じ ものを 時間を おって 調べた データは どれかな。', 'しゅるいごとの 数を くらべる ときは ぼうグラフが 向いて いるよ。'],
      explain: `「${right}」は 時間と ともに 変わる ようすなので、折れ線グラフが 合います。しゅるいごとの 数は ぼうグラフが 合います。`,
      identity: `two-kind:${right}:${[...ws].sort().join(',')}`,
      alt: true,
      layout: 'column',
      options: opts(right, ws.map((x) => [x, 'graph-choice'])),
    };
  }
  for (;;) {
    const n = 6;
    const a = Array.from({ length: n }, () => rng.int(2, 13) * 2);
    const b = Array.from({ length: n }, () => rng.int(2, 13) * 2);
    const gap = a.map((x, i) => Math.abs(x - b[i]!));
    const mx = Math.max(...gap);
    if (gap.filter((g) => g === mx).length !== 1) continue;
    if (a.some((x, i) => x === b[i])) continue;
    const k = gap.indexOf(mx);
    const hiA = a.indexOf(Math.max(...a));
    const lo = gap.indexOf(Math.min(...gap));
    const others = [0, 1, 2, 3, 4, 5].filter((i) => i !== k && i !== hiA && i !== lo);
    const wrongs: [string, string][] = [];
    if (hiA !== k) wrongs.push([`${hiA + 1}月`, 'value-not-change']);
    if (lo !== k && lo !== hiA) wrongs.push([`${lo + 1}月`, 'two-gap']);
    for (const i of rng.shuffle(others)) wrongs.push([`${i + 1}月`, 'two-gap']);
    return {
      engine: 'choice',
      id: `two:${a.join(',')}:${b.join(',')}`,
      objective: 'two',
      level,
      prompt: 'ア市（●と 実線）と イ市（■と 点線）の 1月〜6月の 気温を 1つの グラフに しました（れいの データ）。2つの 市の 気温の ちがいが いちばん 大きいのは 何月？',
      figure: twoFig(a, b, 2, 28),
      hints: ['2本の 線の 間が いちばん はなれて いる 月を さがそう。', '同じ 月の ●と ■の 高さの ちがいを くらべよう。', '線が 交わる ところは ちがいが 小さいよ。'],
      explain: `${k + 1}月は ア市 ${a[k]}度、イ市 ${b[k]}度で、ちがいが ${mx}度。2本の 線の 間が いちばん 広いです。`,
      identity: `two:${a.join(',')}:${b.join(',')}`,
      alt: false,
      options: opts(`${k + 1}月`, wrongs),
    };
  }
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['read', 'trend', 'make'] },
  { objs: ['change', 'make', 'read'] },
  { objs: ['two', 'change', 'trend', 'read'] },
];

export function generateLineGraph(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'read':
      return read(level, rng, alt);
    case 'change':
      return change(level, rng, alt);
    case 'trend':
      return trend(level, rng, alt);
    case 'make':
      return make(level, rng, alt);
    case 'two':
      return two(level, rng, alt);
  }
}

export const lineGraph: UnitSpec = finishUnit({
  id: 'g4.math.line-graph',
  title: '折れ線グラフ',
  stage: 'g4',
  subject: 'math',
  domain: 'D-data',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-sorting',
  prereq: ['g3.math.bar-graph'],
  objectives: [
    { id: 'read', title: '目もりを 読む' },
    { id: 'change', title: '変わり方の 大きさ' },
    { id: 'trend', title: '上がる・下がる・変わらない' },
    { id: 'make', title: '折れ線グラフを かく' },
    { id: 'two', title: '2本の 折れ線・グラフの えらび方' },
  ],
  misconceptions: [
    {
      id: 'scale-one',
      explain: '1めもりを 1と 読んだのかな。たての じくの 数字を 見て、1めもりの 大きさを たしかめよう。',
    },
    {
      id: 'next-point',
      explain: 'となりの 点を 読んだのかな。横の じくの 目もりから まっすぐ 上に たどろう。',
    },
    {
      id: 'value-not-change',
      explain: '数が いちばん 大きい ところと、変わり方が いちばん 大きい ところは ちがうよ。線の かたむきで 見よう。',
    },
    {
      id: 'down-vs-up',
      explain: 'かたむきは 急でも、右下がりの 線は 下がって いるよ。上がり方を 聞かれたら 右上がりの 線を 見よう。',
    },
    {
      id: 'slope-read',
      explain: '線の かたむきを くらべよう。急な ほど、変わり方が 大きいよ。',
    },
    {
      id: 'trend-read',
      explain: '線の 向きを たしかめよう。右上がりは 上がる、右下がりは 下がる、横に まっすぐは 変わらないだよ。',
    },
    {
      id: 'two-gap',
      explain: '2本の 線の 間の 広さを 見よう。同じ 月の 2つの 点の 高さの ちがいが 大きい ほど、間が 広いよ。',
    },
    {
      id: 'graph-choice',
      explain: 'しゅるいごとの 数を くらべる ときは ぼうグラフ、時間と ともに 変わる ようすは 折れ線グラフが 向いて いるよ。',
    },
  ],
  levels: [
    { label: '読む・かく', chance: 0.05 },
    { label: '変わり方の 大きさ', chance: 0.05 },
    { label: '2本の 折れ線', chance: 0.05 },
  ],
  intro: [
    {
      text: '時間と ともに 変わる ようすは、折れ線グラフに 表すと わかりやすいです。',
      figure: { kind: 'line', labels: ['9時', '10時', '11時', '12時', '13時'], values: [14, 16, 20, 22, 21], scaleStep: 2, unit: '度' },
    },
    {
      text: '線の かたむきが 急な ほど、変わり方が 大きい。右上がりは 上がって いる、右下がりは 下がって いる、横は 変わらない ことを 表します。',
    },
    {
      text: 'たての じくの とちゅうを 省く ときは、波線の しるしを 使います。小さな 変化が 見やすく なります。',
    },
    {
      text: '2本の 折れ線を 1つの グラフに かくと、2つの ものの 変わり方を くらべられます。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateLineGraph(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第4学年 D(1) データの分類整理（折れ線グラフ、変化の様子の読み取り）',
  revised: REVISED,
});
