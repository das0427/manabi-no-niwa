/**
 * g5.math.speed 速さ（速さ・道のり・時間、時速・分速・秒速）（curriculum-matrix 3.8。6年ではなく5年: EJM 4-1）。
 *
 * 速さ ＝ 道のり ÷ 時間、道のり ＝ 速さ × 時間、時間 ＝ 道のり ÷ 速さ。
 * 数は整数で持つ（答えは整数。誤答の例は 有限小数に なるときだけ）。
 * 同一性キー: 到達項目 × 場面 × 数（くらべる問題は A・B の 入れかえを 同じとみる）。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceItem, ChoiceOption, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { divText, doubleLine, finishUnit, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'speed' | 'dist' | 'time' | 'convert' | 'compare';

interface Scene {
  id: string;
  who: string; // 「自動車」
  verb: string; // 「走ります」
  dUnit: 'km' | 'm';
  tUnit: '時間' | '分' | '秒';
  sRange: [number, number];
  tRange: [number, number];
}
/** 場面（8つ）。時間の単位ごとに 速さの 呼び方が 決まる */
const SCENES: Scene[] = [
  { id: 'car', who: '自動車', verb: '走る', dUnit: 'km', tUnit: '時間', sRange: [30, 80], tRange: [2, 6] },
  { id: 'train', who: '電車', verb: '走る', dUnit: 'km', tUnit: '時間', sRange: [60, 150], tRange: [2, 5] },
  { id: 'bike', who: '自転車', verb: '走る', dUnit: 'km', tUnit: '時間', sRange: [10, 20], tRange: [2, 5] },
  { id: 'ship', who: '船', verb: '進む', dUnit: 'km', tUnit: '時間', sRange: [15, 40], tRange: [2, 8] },
  { id: 'walk', who: '人《ひと》', verb: '歩く', dUnit: 'm', tUnit: '分', sRange: [50, 90], tRange: [5, 30] },
  { id: 'bird', who: 'ハト', verb: '飛ぶ', dUnit: 'm', tUnit: '分', sRange: [60, 120], tRange: [2, 10] },
  { id: 'swim', who: '人《ひと》', verb: '泳ぐ', dUnit: 'm', tUnit: '分', sRange: [30, 70], tRange: [2, 20] },
  { id: 'run', who: '人《ひと》', verb: '走る', dUnit: 'm', tUnit: '秒', sRange: [3, 9], tRange: [10, 60] },
];

/** 時間の 単位の 書き方（分・秒は 読みを 決めて書く） */
const T = (u: Scene['tUnit']) => (u === '分' ? '分《ふん》' : u);
const SP = (u: Scene['tUnit']) => (u === '時間' ? '時速' : u === '分' ? '分速' : '秒速');
/** 鳥は 分速 何十m（ハトは 分速 1km くらい）。10 倍して 使う */
const sOf = (sc: Scene, rng: Rng) => rng.int(...sc.sRange) * (sc.id === 'bird' ? 10 : 1);

function base(sc: Scene, rng: Rng) {
  const s = sOf(sc, rng);
  const t = rng.int(...sc.tRange);
  return { s, t, d: s * t };
}

const lineFig = (sc: Scene, s: string, t: string, d: string) =>
  doubleLine(
    [
      { at: 0, text: '0' },
      { at: 0.2, text: s },
      { at: 1, text: d },
    ],
    [
      { at: 0, text: '0' },
      { at: 0.2, text: '1' },
      { at: 1, text: t },
    ],
    `上が 道のり（${sc.dUnit}）、下が 時間（${T(sc.tUnit)}）の 数直線`,
    sc.dUnit,
  );

/** 速さを 求める */
function speedItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const { s, t, d } = base(sc, rng);
  const answers = [{ kind: 'int' as const, value: s }];
  return {
    engine: 'number',
    id: `speed${alt ? '-alt' : ''}:${sc.id}:${d}:${t}`,
    objective: 'speed',
    level,
    prompt: `${sc.who}が ${d}${sc.dUnit}を ${t}${T(sc.tUnit)}で ${sc.verb.replace(/る$|ぶ$|ぐ$|む$|く$/, (m) => ({ る: 'り', ぶ: 'び', ぐ: 'ぎ', む: 'み', く: 'き' })[m]!)}ました。${SP(sc.tUnit)}は 何${sc.dUnit}ですか。`,
    figure: alt ? lineFig(sc, '?', String(t), String(d)) : undefined,
    hints: [
      `${SP(sc.tUnit)}は、1${T(sc.tUnit)}あたりに 進む 道のりだよ。`,
      '速さ ＝ 道のり ÷ 時間',
      `${d} ÷ ${t}を 計算しよう。`,
    ],
    explain: `${d} ÷ ${t} ＝ ${s}。${SP(sc.tUnit)} ${s}${sc.dUnit}です。`,
    explainFigure: lineFig(sc, String(s), String(t), String(d)),
    identity: `speed:${sc.id}:${d}:${t}${alt ? ':line' : ''}`,
    alt,
    fields: [{ label: sc.dUnit, answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [divText(t, d), 'div-swap'],
      [d * t, 'formula-swap'],
    ]),
  };
}

/** 道のりを 求める */
function distItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const { s, t, d } = base(sc, rng);
  const answers = [{ kind: 'int' as const, value: d }];
  return {
    engine: 'number',
    id: `dist${alt ? '-alt' : ''}:${sc.id}:${s}:${t}`,
    objective: 'dist',
    level,
    prompt: `${SP(sc.tUnit)} ${s}${sc.dUnit}で ${sc.verb} ${sc.who}が、${t}${T(sc.tUnit)} 進むと、道のりは 何${sc.dUnit}ですか。`,
    figure: alt ? lineFig(sc, String(s), String(t), '?') : undefined,
    hints: [
      `${SP(sc.tUnit)} ${s}${sc.dUnit}は、1${T(sc.tUnit)}に ${s}${sc.dUnit} 進む 速さだよ。`,
      '道のり ＝ 速さ × 時間',
      `${s} × ${t}を 計算しよう。`,
    ],
    explain: `${s} × ${t} ＝ ${d}。道のりは ${d}${sc.dUnit}です。`,
    explainFigure: lineFig(sc, String(s), String(t), String(d)),
    identity: `dist:${sc.id}:${s}:${t}${alt ? ':line' : ''}`,
    alt,
    fields: [{ label: sc.dUnit, answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [divText(s, t), 'formula-swap'],
      [divText(t, s), 'div-swap'],
      [s + t, 'formula-swap'],
    ]),
  };
}

/** 時間を 求める */
function timeItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const { s, t, d } = base(sc, rng);
  const answers = [{ kind: 'int' as const, value: t }];
  return {
    engine: 'number',
    id: `time${alt ? '-alt' : ''}:${sc.id}:${s}:${d}`,
    objective: 'time',
    level,
    prompt: `${SP(sc.tUnit)} ${s}${sc.dUnit}で ${sc.verb} ${sc.who}が、${d}${sc.dUnit} 進むのに かかる 時間は 何${T(sc.tUnit)}ですか。`,
    figure: alt ? lineFig(sc, String(s), '?', String(d)) : undefined,
    hints: [
      `1${T(sc.tUnit)}に ${s}${sc.dUnit} 進むね。${d}${sc.dUnit}は ${s}${sc.dUnit}の いくつ分かな。`,
      '時間 ＝ 道のり ÷ 速さ',
      `${d} ÷ ${s}を 計算しよう。`,
    ],
    explain: `${d} ÷ ${s} ＝ ${t}。${t}${T(sc.tUnit)} かかります。`,
    explainFigure: lineFig(sc, String(s), String(t), String(d)),
    identity: `time:${sc.id}:${s}:${d}${alt ? ':line' : ''}`,
    alt,
    fields: [{ label: T(sc.tUnit), answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [divText(s, d), 'div-swap'],
      [d * s, 'formula-swap'],
      [d - s, 'formula-swap'],
    ]),
  };
}

/** 時速・分速・秒速の 換算（alt: 同じ 速さを 選ぶ） */
type Conv = 'h2m' | 'm2s' | 's2m' | 'm2h';
function convItem(level: number, rng: Rng, alt: boolean): Item {
  const kind = pick(rng, ['h2m', 'm2s', 's2m', 'm2h'] as const satisfies readonly Conv[]);
  // 答えが 整数に なる 数だけを 使う
  let from: string;
  let to: string;
  let ans: number;
  let wrong: [string | number | null, string][];
  let explain: string;
  let hint2: string;
  let hint3: string;
  let key: string;
  if (kind === 'h2m') {
    const h = rng.int(1, 30) * 3; // 時速 km
    const m = (h * 1000) / 60;
    from = `時速 ${h}km`;
    to = '分速 何m';
    ans = m;
    wrong = [
      [h * 1000, 'unit-conv'],
      [divText(h, 60), 'unit-conv'],
      [h * 60, 'unit-conv'],
      [h * 10, 'unit-conv'],
    ];
    hint2 = `${h}km ＝ ${h * 1000}m。1時間 ＝ 60分《ふん》。`;
    hint3 = `${h * 1000} ÷ 60を 計算しよう。`;
    explain = `${h}km ＝ ${h * 1000}m。1時間（60分《ふん》）で ${h * 1000}m なので、1分《ふん》では ${h * 1000} ÷ 60 ＝ ${m}m。分速 ${m}mです。`;
    key = `h2m:${h}`;
  } else if (kind === 'm2s') {
    const sv = rng.int(1, 25);
    const m = sv * 60;
    from = `分速 ${m}m`;
    to = '秒速 何m';
    ans = sv;
    wrong = [
      [m * 60, 'unit-conv'],
      [divText(m, 100), 'unit-conv'],
      [divText(m, 10), 'unit-conv'],
    ];
    hint2 = '1分《ふん》 ＝ 60秒。';
    hint3 = `${m} ÷ 60を 計算しよう。`;
    explain = `1分《ふん》（60秒）で ${m}m なので、1秒では ${m} ÷ 60 ＝ ${sv}m。秒速 ${sv}mです。`;
    key = `m2s:${m}`;
  } else if (kind === 's2m') {
    const sv = rng.int(2, 30);
    from = `秒速 ${sv}m`;
    to = '分速 何m';
    ans = sv * 60;
    wrong = [
      [divText(sv, 60), 'unit-conv'],
      [sv * 100, 'unit-conv'],
      [sv * 3600, 'unit-conv'],
    ];
    hint2 = '1分《ふん》 ＝ 60秒。1分《ふん》間に 進む 道のりを 考えよう。';
    hint3 = `${sv} × 60を 計算しよう。`;
    explain = `1秒で ${sv}m なので、1分《ふん》（60秒）では ${sv} × 60 ＝ ${sv * 60}m。分速 ${sv * 60}mです。`;
    key = `s2m:${sv}`;
  } else {
    const k = rng.int(1, 30);
    const m = k * 50; // 分速 m
    const h = (m * 60) / 1000; // 時速 km
    from = `分速 ${m}m`;
    to = '時速 何km';
    ans = h;
    wrong = [
      [m * 60, 'unit-conv'],
      [divText(m, 1000), 'unit-conv'],
      [divText(m * 100, 1000), 'unit-conv'],
    ];
    hint2 = '1時間 ＝ 60分《ふん》。1時間に 進む 道のりを mで 求めてから kmに なおそう。';
    hint3 = `${m} × 60 ＝ ${m * 60}m。これは 何kmかな。`;
    explain = `${m} × 60 ＝ ${m * 60}m ＝ ${divText(m * 60, 1000)}km。時速 ${divText(m * 60, 1000)}kmです。`;
    key = `m2h:${m}`;
  }
  const ansText = divText(ans * 1, 1)!;
  if (alt) {
    // 同じ 速さを 選ぶ（誤りは 換算の 誤り）
    const unitTo = kind === 'm2h' ? 'km' : 'm';
    const sp = to.split(' ')[0]!;
    const cands = wrong
      .map(([v]) => (v === null ? null : String(v)))
      .filter((v): v is string => v !== null && v !== ansText)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 3);
    const options: ChoiceOption[] = [
      { label: `${sp} ${ansText}${unitTo}`, correct: true },
      ...cands.map((v) => ({ label: `${sp} ${v}${unitTo}`, misconception: 'unit-conv' })),
    ];
    const item: ChoiceItem = {
      engine: 'choice',
      id: `convert-alt:${key}`,
      objective: 'convert',
      level,
      prompt: `${from}と 同じ 速さは どれ？`,
      hints: ['時間の 単位と、道のりの 単位の 両方を そろえよう。', hint2, hint3],
      explain,
      identity: `convert-pick:${key}`,
      alt: true,
      options,
    };
    return item;
  }
  const answers = [{ kind: 'int' as const, value: ans }];
  const item: NumberItem = {
    engine: 'number',
    id: `convert:${key}`,
    objective: 'convert',
    level,
    prompt: `${from}は、${to}ですか。`,
    hints: ['時速は 1時間、分速は 1分《ふん》、秒速は 1秒あたりに 進む 道のりだよ。', hint2, hint3],
    explain,
    identity: `convert:${key}`,
    alt: false,
    fields: [{ label: kind === 'm2h' ? 'km' : 'm', answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, wrong),
  };
  return item;
}

/** どちらが 速いか（alt: 時速と 分速で くらべる） */
function compareItem(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (alt) {
    for (;;) {
      const h = rng.int(3, 30) * 3; // 時速 km
      const mOther = rng.int(10, 40) * 50; // 分速 m
      const mA = (h * 1000) / 60;
      if (mA === mOther) continue;
      const aFast = mA > mOther;
      const names: [string, string] = ['Aの 自動車', 'Bの 自動車'];
      return {
        engine: 'choice',
        id: `compare-alt:${h}:${mOther}`,
        objective: 'compare',
        level,
        prompt: `Aの 自動車は 時速 ${h}km、Bの 自動車は 分速 ${mOther}mで 走ります。速いのは どちら？`,
        hints: [
          '時速と 分速の ままでは くらべられないよ。どちらかに そろえよう。',
          `Aの 時速 ${h}kmを 分速に なおそう。${h}km ＝ ${h * 1000}m。`,
          `${h * 1000} ÷ 60を 計算して、${mOther}mと くらべよう。`,
        ],
        explain: `時速 ${h}km ＝ 分速 ${mA}m。Bは 分速 ${mOther}m。${aFast ? 'A' : 'B'}の ほうが 速いです。`,
        identity: `compare-mix:${h}:${mOther}`,
        alt: true,
        fixedOrder: true,
        options: [
          aFast ? { label: names[0], correct: true } : { label: names[0], misconception: 'unit-conv' },
          aFast ? { label: names[1], misconception: 'unit-conv' } : { label: names[1], correct: true },
        ],
      };
    }
  }
  const sc = pick(rng, SCENES);
  for (;;) {
    const a = base(sc, rng);
    const b = base(sc, rng);
    if (a.s === b.s || a.d === b.d || a.t === b.t) continue;
    const aFast = a.s > b.s;
    const wrongLonger = aFast ? b.d > a.d : a.d > b.d;
    const mis = wrongLonger ? 'dist-only' : 'div-swap';
    const names: [string, string] = sc.who === '人《ひと》' ? ['Aさん', 'Bさん'] : [`Aの ${sc.who}`, `Bの ${sc.who}`];
    const key = [`${a.d}/${a.t}`, `${b.d}/${b.t}`].sort().join('|');
    return {
      engine: 'choice',
      id: `compare:${sc.id}:${a.d}/${a.t}|${b.d}/${b.t}`,
      objective: 'compare',
      level,
      prompt: `${names[0]}は ${a.d}${sc.dUnit}を ${a.t}${T(sc.tUnit)}、${names[1]}は ${b.d}${sc.dUnit}を ${b.t}${T(sc.tUnit)}で 進みました。速いのは どちら？`,
      hints: [
        '道のりも 時間も ちがうので、道のりだけ・時間だけでは くらべられないよ。',
        `1${T(sc.tUnit)}あたりに 進む 道のり（速さ）を 求めよう。Aは ${a.d} ÷ ${a.t}。`,
        `Aは ${SP(sc.tUnit)} ${a.s}${sc.dUnit}。Bも 計算して くらべよう。`,
      ],
      explain: `Aは ${a.d} ÷ ${a.t} ＝ ${a.s}、Bは ${b.d} ÷ ${b.t} ＝ ${b.s}。${SP(sc.tUnit)}が 大きい ${aFast ? 'A' : 'B'}の ほうが 速いです。`,
      identity: `compare:${sc.id}:${key}`,
      alt: false,
      fixedOrder: true,
      options: [
        aFast ? { label: names[0], correct: true } : { label: names[0], misconception: mis },
        aFast ? { label: names[1], misconception: mis } : { label: names[1], correct: true },
      ],
    };
  }
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['compare', 'speed'] },
  { objs: ['speed', 'dist', 'time'] },
  { objs: ['convert', 'compare', 'dist', 'time', 'speed'] },
];

export function generateSpeed(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'speed':
      return speedItem(level, rng, alt);
    case 'dist':
      return distItem(level, rng, alt);
    case 'time':
      return timeItem(level, rng, alt);
    case 'convert':
      return convItem(level, rng, alt);
    case 'compare':
      return compareItem(level, rng, alt);
  }
}

export const speed: UnitSpec = finishUnit(
  {
    id: 'g5.math.speed',
    title: '速さ',
    stage: 'g5',
    subject: 'math',
    domain: 'C-measure',
    kind: 'calc',
    priority: 'P1',
    status: 'ready',
    icon: 'bus-yellow',
    prereq: ['g5.math.per-unit'],
    objectives: [
      { id: 'compare', title: 'どちらが 速いか くらべる' },
      { id: 'speed', title: '速さを 求める' },
      { id: 'dist', title: '道のりを 求める' },
      { id: 'time', title: '時間を 求める' },
      { id: 'convert', title: '時速・分速・秒速の 関係' },
    ],
    misconceptions: [
      {
        id: 'div-swap',
        explain:
          'わる 数と わられる 数が 反対に なったのかな。速さは 1時間（1分《ふん》）あたりに 進む 道のりなので、道のり ÷ 時間。時間は 道のり ÷ 速さだよ。',
      },
      {
        id: 'formula-swap',
        explain:
          'かけ算と わり算を 取りちがえたのかな。道のり ＝ 速さ × 時間、速さ ＝ 道のり ÷ 時間、時間 ＝ 道のり ÷ 速さ。数直線に かいて たしかめよう。',
      },
      {
        id: 'unit-conv',
        explain:
          '単位の なおし方が ちがったのかな。1時間 ＝ 60分《ふん》、1分《ふん》 ＝ 60秒（100では ないよ）。1km ＝ 1000m。時間と 道のりの 単位を 両方 そろえよう。',
      },
      {
        id: 'dist-only',
        explain:
          '道のりの 長さだけで くらべたのかな。かかった 時間も ちがうので、1時間（1分《ふん》）あたりに 進む 道のりで くらべよう。',
      },
    ],
    levels: [
      { label: '速さを くらべる・求める', chance: 0.05 },
      { label: '道のり・時間', chance: 0.05 },
      { label: '時速・分速・秒速、まとめ', chance: 0.05 },
    ],
    intro: [
      {
        text: 'Aの 自動車は 120kmを 2時間、Bの 自動車は 150kmを 3時間で 走りました。1時間あたりに 走る 道のりで くらべます。A: 120 ÷ 2 ＝ 60km、B: 150 ÷ 3 ＝ 50km。Aの ほうが 速い。',
        figure: doubleLine(
          [
            { at: 0, text: '0' },
            { at: 0.5, text: '60' },
            { at: 1, text: '120' },
          ],
          [
            { at: 0, text: '0' },
            { at: 0.5, text: '1' },
            { at: 1, text: '2' },
          ],
          '上が 道のり（km）、下が 時間の 数直線',
          'km',
        ),
      },
      {
        text: '速さは、単位時間あたりに 進む 道のりで 表します。速さ ＝ 道のり ÷ 時間。1時間あたりは 時速、1分《ふん》あたりは 分速、1秒あたりは 秒速。',
      },
      {
        text: '道のり ＝ 速さ × 時間、時間 ＝ 道のり ÷ 速さ。時速 60km ＝ 分速 1000m（60 × 1000 ÷ 60）。',
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateSpeed(level, rng, index),
    },
    review: 'type',
    basis: '小学校学習指導要領（平成29年告示）算数 第5学年 C(2) 単位量当たりの大きさ（速さ）。速さは現行要領で5年（EJM 4-1）',
    revised: REVISED,
  },
  '自動車《じどうしゃ》 電車《でんしゃ》 自転車《じてんしゃ》 船《ふね》 飛《と》 泳《およ》 歩《ある》 進《すす》 走《はし》 単位時間《たんいじかん》 間《かん》',
);
