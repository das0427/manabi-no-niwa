/**
 * g4.math.angle 角の大きさ（度、分度器、180°より大きい角）（curriculum-matrix 3.7）。
 * 回転の量 → 分度器で測る（geometry の angle。許容 ±2度）→ 180°より大きい角 → 三角じょうぎの角・角の計算。
 *
 * matrix の エンジン欄は measure（分度器）だが、分度器は geometry の angle で扱う（engines.md）。
 * 同一性キー: 問う形 × 角の大きさ（× 1つ目の辺の向き）。
 */
import type { Rng } from '../../core/util/rng';
import type { GeometryItem } from '../../engines/geometry/geometry';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  expr,
  finishUnit,
  opts,
  pick,
  pickObj,
  REVISED,
  STROKE,
  svg,
  svgText,
  wrongList,
} from './util';

type Obj = 'rotate' | 'measure' | 'reflex' | 'setsq' | 'calc';

/** 分度器で 測る（alt: 辺の 向きを かえた 角） */
function measure(level: number, rng: Rng, alt: boolean): GeometryItem {
  const deg = rng.int(2, 34) * 5;
  const base = alt ? pick(rng, [30, 60, 90, 120, 150, 180]) : 0;
  return {
    engine: 'geometry',
    id: `measure${alt ? '-alt' : ''}:${deg}:${base}`,
    objective: 'measure',
    level,
    prompt: '分度器で この 角の 大きさを はかろう。何度ですか。',
    hints: [
      '分度器の 中心を 角の 頂点に、0°の 線を 1つの 辺に 合わせるよ。',
      '0°から はじまる ほうの めもりを 読もう（内がわと 外がわ、どちらが 0°かな）。',
      deg < 90
        ? '直角（90°）より 小さい 角だね。'
        : deg > 90
          ? '直角（90°）より 大きい 角だね。'
          : '直角と 同じかな。',
    ],
    explain: `0°の 線から 読むと ${deg}°です。${deg < 90 ? '直角より 小さい 角です。' : deg > 90 ? '直角より 大きい 角です。' : '直角です。'}`,
    identity: `measure:${deg}:${base}`,
    alt,
    task: { kind: 'angle', degrees: deg, base, protractor: true },
    misconceptions: { otherScale: 'other-scale' },
  };
}

/** 180°より 大きい 角（alt: 計算で 求める） */
function reflex(level: number, rng: Rng, alt: boolean): Item {
  const deg = rng.int(38, 70) * 5;
  if (alt) {
    const inner = 360 - deg;
    const answers = [{ kind: 'int' as const, value: deg }];
    const item: NumberItem = {
      engine: 'number',
      id: `reflex-alt:${deg}`,
      objective: 'reflex',
      level,
      prompt: `2本の 辺で できる 小さい ほうの 角は ${inner}°です。大きい ほうの 角（あの 角）は 何度ですか。`,
      figure: angleFig(inner, 'あ', true),
      hints: [
        '1回転の 角は 360°だよ。',
        '大きい 角と 小さい 角を あわせると 1回転。',
        `360 − ${inner}を 計算しよう。`,
      ],
      explain: `360 − ${inner} ＝ ${deg}。あの 角は ${deg}°です。`,
      identity: `reflex-calc:${deg}`,
      alt: true,
      fields: [{ label: '度', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [inner, 'reflex-inner'],
        [180 + inner, 'reflex-180'],
        [180 - inner, 'line-180'],
      ]),
    };
    return item;
  }
  const item: GeometryItem = {
    engine: 'geometry',
    id: `reflex:${deg}`,
    objective: 'reflex',
    level,
    prompt:
      '色の ついた ほうの 角（180°より 大きい 角）の 大きさは 何度ですか。分度器で はかって 考えよう。',
    hints: [
      '180°より 大きい 角は、180°と のこりの 角に 分けるか、360°から 小さい ほうの 角を ひいて 求めるよ。',
      '小さい ほうの 角を 分度器で はかろう。',
      '360 − （小さい ほうの 角）を 計算しよう。',
    ],
    explain: `小さい ほうの 角は ${360 - deg}°。360 − ${360 - deg} ＝ ${deg}°です。`,
    identity: `reflex:${deg}`,
    alt: false,
    task: { kind: 'angle', degrees: deg, base: 0, protractor: true },
    misconceptions: { reflexComplement: 'reflex-inner' },
  };
  return item;
}

/** 2本の 辺と 角の しるしの 図（deg: 示す 角。big: 大きい ほう に しるし） */
function angleFig(deg: number, name: string, big = false): ReturnType<typeof svg> {
  const cx = 120;
  const cy = 110;
  const r = 90;
  const rad = (deg * Math.PI) / 180;
  const x2 = cx + r * Math.cos(rad);
  const y2 = cy - r * Math.sin(rad);
  let body = `<line x1="${cx}" y1="${cy}" x2="${cx + r}" y2="${cy}" ${STROKE}/><line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" ${STROKE}/>`;
  const ar = 26;
  const ax2 = cx + ar * Math.cos(rad);
  const ay2 = cy - ar * Math.sin(rad);
  body += big
    ? `<path d="M${cx + ar} ${cy} A${ar} ${ar} 0 1 1 ${ax2} ${ay2}" fill="none" stroke="var(--ink)" stroke-width="2"/>`
    : `<path d="M${cx + ar} ${cy} A${ar} ${ar} 0 0 0 ${ax2} ${ay2}" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
  const mid = big ? rad / 2 + Math.PI : rad / 2;
  body += svgText(cx + 44 * Math.cos(mid), cy - 44 * Math.sin(mid), name, 16);
  return svg(240, 220, body, '角');
}

/** 回転の 量（alt: 時計の はり） */
function rotate(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const min = pick(rng, [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    const ans = min * 6;
    const answers = [{ kind: 'int' as const, value: ans }];
    const item: NumberItem = {
      engine: 'number',
      id: `rotate-alt:${min}`,
      objective: 'rotate',
      level,
      prompt: `時計の 長い はりが ${min}分間に 回る 角の 大きさは 何度ですか。`,
      figure: { kind: 'clock', h: 12, m: min },
      hints: [
        '長い はりは 60分で 1回転（360°）するよ。',
        '5分では 360 ÷ 12 ＝ 30°。',
        `${min}分は 5分の ${min / 5}こ分。30 × ${min / 5}。`,
      ],
      explain: `5分で 30°なので、${min}分では 30 × ${min / 5} ＝ ${ans}°です。`,
      identity: `rotate-clock:${min}`,
      alt: true,
      fields: [{ label: '度', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [min, 'rotate-count'],
        [min * 30, 'rotate-count'],
      ]),
    };
    return item;
  }
  // 直角の 半分（45°）の いくつ分（1〜12）
  const h = rng.int(1, 12);
  const k = {
    v: 45 * h,
    t:
      h === 1
        ? '直角の 半分'
        : h % 2 === 0
          ? h === 4
            ? '半回転'
            : h === 8
              ? '1回転'
              : `直角 ${h / 2}つ分`
          : `直角 ${(h - 1) / 2}つ分と その 半分`,
  };
  const answers = [{ kind: 'int' as const, value: k.v }];
  const item: NumberItem = {
    engine: 'number',
    id: `rotate:${k.t}`,
    objective: 'rotate',
    level,
    prompt: `${k.t}の 角の 大きさは 何度ですか。`,
    hints: [
      '直角は 90°だよ。',
      '半回転は 直角 2つ分、1回転は 直角 4つ分。',
      `90°の いくつ分かを 考えよう。`,
    ],
    explain: `直角は 90°、半回転は 180°、1回転は 360°。${k.t}は ${k.v}°です。`,
    identity: `rotate:${k.v}:${k.t}`,
    alt: false,
    fields: [{ label: '度', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [(k.v / 90) * 100, 'rotate-count'],
      [k.v + 90, 'rotate-count'],
      [k.v - 90 > 0 ? k.v - 90 : null, 'rotate-count'],
    ]),
  };
  return item;
}

const SETSQ = [30, 45, 60, 90];

/** 三角じょうぎの 角の 組み合わせ（alt: できない 角を 選ぶ） */
function setsq(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const can = new Set<number>();
    for (const a of SETSQ)
      for (const b of SETSQ) {
        can.add(a + b);
        if (a > b) can.add(a - b);
      }
    const no = pick(
      rng,
      [20, 40, 50, 70, 80, 100, 110, 140, 160].filter((x) => !can.has(x)),
    );
    const yes = rng.sample(
      [...can].filter((x) => x < 180 && x !== 90 && !SETSQ.includes(x)),
      3,
    );
    const item: ChoiceItem = {
      engine: 'choice',
      id: `setsq-alt:${no}:${yes.sort((a, b) => a - b).join(',')}`,
      objective: 'setsq',
      level,
      prompt:
        '1組の 三角じょうぎの 角を 2つ 組み合わせて（たしたり ひいたり して）作れない 角は どれ？',
      hints: [
        '三角じょうぎの 角は 30°・45°・60°・90°だよ。',
        '2つを たすか、大きい ほうから 小さい ほうを ひいて 作れるか 調べよう。',
        `${yes[0]}°は 作れるかな。1つずつ たしかめよう。`,
      ],
      explain: `${no}°は 30°・45°・60°・90°の どの 2つを たしても ひいても 作れません。ほかの 角は 作れます。`,
      identity: `setsq-no:${no}:${yes.join(',')}`,
      alt: true,
      options: opts(
        `${no}°`,
        yes.map((x) => [`${x}°`, 'setsq-angle']),
      ),
    };
    return item;
  }
  // 2つの ちがう 角の 組（6通り）× たす・ひく を 均等に
  const pairs: [number, number][] = [];
  for (const x of SETSQ) for (const y of SETSQ) if (x < y) pairs.push([x, y]);
  const [a, b] =
    rng.next() < 0.5 ? pick(rng, pairs) : ([...pick(rng, pairs)].reverse() as [number, number]);
  const add = rng.next() < 0.5;
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const v = add ? a + b : big - small;
  const answers = [{ kind: 'int' as const, value: v }];
  const e = add ? `${a}° ＋ ${b}°` : `${big}° − ${small}°`;
  const item: NumberItem = {
    engine: 'number',
    id: `setsq:${add ? 'add' : 'sub'}:${small}-${big}`,
    objective: 'setsq',
    level,
    prompt: add
      ? `三角じょうぎの ${a}°の 角と ${b}°の 角を ならべて できる 角は 何度ですか。`
      : `三角じょうぎの ${big}°の 角に ${small}°の 角を 重ねたとき、はみ出した 角は 何度ですか。`,
    figure: expr(e),
    hints: [
      '1組の 三角じょうぎの 角は 30°・45°・60°・90°。',
      add
        ? 'ならべると、2つの 角を たした 大きさに なるよ。'
        : '重ねて はみ出した ところは、大きい 角から 小さい 角を ひいた 大きさ。',
      `${e} を 計算しよう。`,
    ],
    explain: `${e} ＝ ${v}°です。`,
    identity: `setsq:${add ? 'add' : 'sub'}:${small}-${big}`,
    alt: false,
    fields: [{ label: '度', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [[add ? big - small : a + b, 'setsq-angle']]),
  };
  return item;
}

/** 交わる 2本の 直線の 角（alt: 一直線と 1回転） */
function calc(level: number, rng: Rng, alt: boolean): NumberItem {
  const a = rng.int(5, 33) * 5;
  if (alt) {
    // 一直線の 上で 角が 3つ（あ ＝ 180 − a − b）
    const b = rng.int(2, Math.floor((175 - a) / 5)) * 5;
    const ans = 180 - a - b;
    const answers = [{ kind: 'int' as const, value: ans }];
    return {
      engine: 'number',
      id: `calc-alt:${a}+${b}`,
      objective: 'calc',
      level,
      prompt: `一直線の 上に、${a}°の 角と ${b}°の 角と あの 角が ならんで います。あの 角は 何度ですか。`,
      hints: [
        '一直線の 角は 180°だよ（半回転）。',
        `3つの 角を あわせると 180°。`,
        `180 − ${a} − ${b}を 計算しよう。`,
      ],
      explain: `180 − ${a} − ${b} ＝ ${ans}。あの 角は ${ans}°です。`,
      identity: `calc-line3:${Math.min(a, b)}+${Math.max(a, b)}`,
      alt: true,
      fields: [{ label: '度', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [360 - a - b, 'line-180'],
        [a + b, 'line-180'],
      ]),
    };
  }
  const ask = rng.int(0, 1); // 0: となり（180 − a）、1: 向かい合う（a）
  const ans = ask === 0 ? 180 - a : a;
  const rad = (a * Math.PI) / 180;
  const cx = 130;
  const cy = 100;
  const r = 90;
  let body = `<line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" ${STROKE}/>`;
  body += `<line x1="${cx - r * Math.cos(rad)}" y1="${cy + r * Math.sin(rad)}" x2="${cx + r * Math.cos(rad)}" y2="${cy - r * Math.sin(rad)}" ${STROKE}/>`;
  const lab = (ang: number, t: string) =>
    svgText(cx + 34 * Math.cos(ang), cy - 34 * Math.sin(ang), t, 15);
  body += lab(rad / 2, 'ア');
  body += lab(rad + (Math.PI - rad) / 2, 'イ');
  body += lab(Math.PI + rad / 2, 'ウ');
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `calc:${a}:${ask}`,
    objective: 'calc',
    level,
    prompt: `2本の 直線が 交わって います。アの 角が ${a}°の とき、${ask === 0 ? 'イ' : 'ウ'}の 角は 何度ですか。`,
    figure: svg(260, 200, body, '交わる 2本の 直線'),
    hints: [
      '一直線の 角は 180°だよ。',
      ask === 0 ? 'アと イを あわせると 一直線（180°）。' : 'アと イで 180°、イと ウで 180°。',
      ask === 0 ? `180 − ${a}を 計算しよう。` : `イは 180 − ${a}。ウは 180 − イ だね。`,
    ],
    explain:
      ask === 0
        ? `アと イで 180°なので、イ ＝ 180 − ${a} ＝ ${ans}°です。`
        : `イ ＝ 180 − ${a}、ウ ＝ 180 − イ ＝ ${a}°。向かい合う 角は 等しく なります。`,
    identity: `calc:${a}:${ask}`,
    alt: false,
    fields: [{ label: '度', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [ask === 0 ? a : 180 - a, 'opposite-angle'],
      [360 - a, 'line-180'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['rotate', 'measure', 'measure'] },
  { objs: ['measure', 'reflex', 'rotate'] },
  { objs: ['setsq', 'calc', 'reflex'] },
  { objs: ['rotate', 'measure', 'reflex', 'setsq', 'calc'] },
];

export function generateAngle(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'rotate':
      return rotate(level, rng, alt);
    case 'measure':
      return measure(level, rng, alt);
    case 'reflex':
      return reflex(level, rng, alt);
    case 'setsq':
      return setsq(level, rng, alt);
    case 'calc':
      return calc(level, rng, alt);
  }
}

export const angle: UnitSpec = finishUnit({
  id: 'g4.math.angle',
  title: '角の 大きさ',
  stage: 'g4',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: ['g3.math.triangles'],
  objectives: [
    { id: 'rotate', title: '回転の 大きさと 角' },
    { id: 'measure', title: '分度器で はかる' },
    { id: 'reflex', title: '180°より 大きい 角' },
    { id: 'setsq', title: '三角じょうぎの 角' },
    { id: 'calc', title: '計算で 角を 求める' },
  ],
  misconceptions: [
    {
      id: 'other-scale',
      explain:
        '分度器の 内がわと 外がわの めもりを 読みまちがえたのかな。辺を 合わせた ほうの 0°から 数える めもりを 読もう。直角より 大きいか 小さいかも 見てね。',
    },
    {
      id: 'reflex-inner',
      explain:
        '小さい ほうの 角を 答えたのかな。180°より 大きい 角は、360°から 小さい ほうの 角を ひいて 求めよう。',
    },
    {
      id: 'reflex-180',
      explain: '180°に たしたのかな。1回転は 360°なので、360°から 小さい ほうの 角を ひくよ。',
    },
    {
      id: 'rotate-count',
      explain:
        '回転の 大きさを たしかめよう。直角は 90°、半回転は 180°、1回転は 360°。時計の 長い はりは 5分で 30°だよ。',
    },
    {
      id: 'setsq-angle',
      explain:
        '三角じょうぎの 角は 30°・45°・60°・90°。ならべると たし算、重ねて はみ出た ところは ひき算だよ。',
    },
    {
      id: 'line-180',
      explain: '一直線の 角は 180°（半回転）だよ。360°は 1回転の 角だね。',
    },
    {
      id: 'opposite-angle',
      explain:
        'となりの 角と 向かい合う 角を とりちがえたのかな。となり合う 角は あわせて 180°、向かい合う 角は 等しいよ。',
    },
  ],
  levels: [
    { label: '回転・分度器', chance: 0.02 },
    { label: '180°より 大きい 角', chance: 0.02 },
    { label: '三角じょうぎ・計算', chance: 0.02 },
    { label: 'まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '角の 大きさは、辺の 開き方（回転の 大きさ）で きまります。直角を 90こに 分けた 1つ分を 1度と いい、1°と 書きます。',
      figure: angleFig(60, '60°'),
    },
    {
      text: '直角は 90°、半回転は 180°、1回転は 360°です。',
    },
    {
      text: '分度器の 中心を 頂点に、0°の 線を 1つの 辺に 合わせ、0°から はじまる めもりを 読みます。',
    },
    {
      text: '180°より 大きい 角は、360°から 小さい ほうの 角を ひいて 求められます。',
      figure: angleFig(80, 'あ', true),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateAngle(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第4学年 B(5) 角の大きさ（回転の大きさ、度、分度器、180°を超える角）',
  revised: REVISED,
});
