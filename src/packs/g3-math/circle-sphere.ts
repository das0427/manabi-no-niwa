/**
 * g3.math.circle-sphere 円と球（中心・半径・直径）（curriculum-matrix 3.6）。
 * 中心から同じ長さの点 → 半径と直径 → 円や球を ならべた 長さ・球の直径。
 *
 * 作図（コンパス）は geometry エンジンに円の作図が無いため、「コンパスを □cm に ひらく」場面の数の問題で代える
 * （エンジンへの要望として報告）。円の向き（回転）は学習内容でないので同一性キーに含めない（1.4）。
 * 同一性キー: 問う形 × 数（'diam:7'、'box:r3:n4' など）。名前を選ぶ問題は「線の種類 × まぎらわしい線の組」。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, pickOne, wrongList } from './util';

type Obj = 'parts' | 'rd' | 'apply' | 'sphere';
type Seg = 'r' | 'd' | 'c30' | 'c50' | 'c65';

const R = 80;
/** 円と、太い線（半径・直径・中心を通らない線）。rot は回転（度。見た目だけ） */
function circleFig(seg: Seg, rot: number): Figure {
  const rad = (rot * Math.PI) / 180;
  const rp = (x: number, y: number) => {
    const X = x * Math.cos(rad) - y * Math.sin(rad) + 100;
    const Y = x * Math.sin(rad) + y * Math.cos(rad) + 100;
    return `${X.toFixed(1)} ${Y.toFixed(1)}`;
  };
  let a: string;
  let b: string;
  if (seg === 'r') [a, b] = [rp(0, 0), rp(R, 0)];
  else if (seg === 'd') [a, b] = [rp(-R, 0), rp(R, 0)];
  else {
    const h = Number(seg.slice(1));
    const w = Math.sqrt(R * R - h * h);
    [a, b] = [rp(-w, h), rp(w, h)];
  }
  const [x1, y1] = a.split(' ');
  const [x2, y2] = b.split(' ');
  return {
    kind: 'svg',
    label: '円《えん》と 線《せん》',
    markup: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="${R}" fill="var(--paper)" stroke="var(--ink)" stroke-width="3.5"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--berry)" stroke-width="7" stroke-linecap="round"/><circle cx="100" cy="100" r="5" fill="var(--ink)"/></svg>`,
  };
}

const SEG_NAME: Record<'r' | 'd', string> = { r: '半径《はんけい》', d: '直径《ちょっけい》' };

function parts(level: number, rng: Rng, alt: boolean): ChoiceItem | NumberItem {
  const rot = rng.int(0, 11) * 30;
  if (alt) {
    // 直径・半径を あらわす図を えらぶ（まぎらわしい線の組を かえる）
    const want = pickOne(rng, ['r', 'd'] as const);
    const chords = pickOne(rng, [
      ['c30', 'c50'],
      ['c30', 'c65'],
      ['c50', 'c65'],
    ] as const);
    return {
      engine: 'choice',
      id: `parts-alt:${want}:${chords.join('-')}`,
      objective: 'parts',
      level,
      prompt: `${SEG_NAME[want]}を あらわして いる 図《ず》は どれ？（太《ふと》い 線《せん》）`,
      hints: [
        '円《えん》の まん中《なか》の 点《てん》が 中心《ちゅうしん》だよ。',
        want === 'd'
          ? '直径《ちょっけい》は 中心《ちゅうしん》を とおって、円《えん》の まわりから まわりまで ひいた 線《せん》。'
          : '半径《はんけい》は 中心《ちゅうしん》から 円《えん》の まわりまで ひいた 線《せん》。',
        '中心《ちゅうしん》を とおって いるか、どこから どこまでかを 見《み》よう。',
      ],
      explain:
        want === 'd'
          ? '中心《ちゅうしん》を とおって、円《えん》の まわりから まわりまで ひいた 線《せん》が 直径《ちょっけい》です。直径《ちょっけい》は 半径《はんけい》の 2倍《ばい》。'
          : '中心《ちゅうしん》から 円《えん》の まわりまで ひいた 線《せん》が 半径《はんけい》です。',
      identity: `pick:${want}:${chords.join('-')}`,
      alt: true,
      layout: 'grid',
      options: [
        { figure: circleFig(want, rot), correct: true },
        { figure: circleFig(want === 'd' ? 'r' : 'd', rot), misconception: 'radius-diameter-swap' },
        { figure: circleFig(chords[0], rot + 60), misconception: 'chord-as-diameter' },
        { figure: circleFig(chords[1], rot + 120), misconception: 'chord-as-diameter' },
      ],
    };
  }
  if (rng.next() < 0.7) return sameRadius(level, rng);
  const seg = pickOne(rng, ['r', 'd', 'c30', 'c50', 'c65'] as const);
  const isRD = seg === 'r' || seg === 'd';
  const correct = isRD ? SEG_NAME[seg] : 'どちらでもない';
  const options = [
    {
      label: SEG_NAME.r,
      ...(seg === 'r'
        ? { correct: true }
        : { misconception: seg === 'd' ? 'radius-diameter-swap' : 'chord-as-diameter' }),
    },
    {
      label: SEG_NAME.d,
      ...(seg === 'd'
        ? { correct: true }
        : { misconception: seg === 'r' ? 'radius-diameter-swap' : 'chord-as-diameter' }),
    },
    { label: 'どちらでもない', ...(isRD ? { misconception: 'center-not' } : { correct: true }) },
  ];
  return {
    engine: 'choice',
    id: `parts:${seg}`,
    objective: 'parts',
    level,
    prompt: '太《ふと》い 線《せん》は 半径《はんけい》・直径《ちょっけい》の どれですか。',
    figure: circleFig(seg, rot),
    hints: [
      'まん中《なか》の 点《てん》（中心《ちゅうしん》）を 見《み》よう。',
      '線《せん》は 中心《ちゅうしん》を とおって いるかな。',
      '中心《ちゅうしん》から まわりまで → 半径《はんけい》、まわりから 中心《ちゅうしん》を とおって まわりまで → 直径《ちょっけい》。',
    ],
    explain: isRD
      ? `この 線《せん》は ${correct}です。${seg === 'r' ? '中心《ちゅうしん》から 円《えん》の まわりまで ひいて います。' : '中心《ちゅうしん》を とおって、まわりから まわりまで ひいて います。'}`
      : '中心《ちゅうしん》を とおって いないので、半径《はんけい》でも 直径《ちょっけい》でも ありません。直径《ちょっけい》は 円《えん》の 中《なか》で いちばん 長《なが》い 線《せん》です。',
    identity: `name:${seg}`,
    alt: false,
    fixedOrder: true,
    options,
  };
}

/** 半径は どれも 同じ長さ（中心から まわりの点までの長さ） */
function sameRadius(level: number, rng: Rng): NumberItem {
  const r = rng.int(2, 20);
  const ask = rng.next() < 0.5 ? 'r' : 'd';
  return {
    engine: 'number',
    id: `parts:same:${ask}:${r}`,
    objective: 'parts',
    level,
    prompt:
      ask === 'r'
        ? `円《えん》の 中心《ちゅうしん》から まわりの 点《てん》アまでの 長《なが》さは ${r}cmです。中心《ちゅうしん》から まわりの 点《てん》イまでの 長《なが》さは 何《なん》cmですか。`
        : `円《えん》の 中心《ちゅうしん》から まわりの 点《てん》アまでの 長《なが》さは ${r}cmです。点《てん》アから 中心《ちゅうしん》を とおって、反対《はんたい》がわの まわりまでの 長《なが》さは 何《なん》cmですか。`,
    figure: circleFig(ask === 'r' ? 'r' : 'd', rng.int(0, 11) * 30),
    hints: [
      '中心《ちゅうしん》から まわりまでの 線《せん》を 何《なん》と いうかな。',
      '1つの 円《えん》では、半径《はんけい》は みんな おなじ 長《なが》さ。',
      ask === 'r'
        ? `点《てん》イまでも 半径《はんけい》だね。`
        : `中心《ちゅうしん》を とおる 線《せん》は 直径《ちょっけい》。半径《はんけい》 2つ分《ぶん》。`,
    ],
    explain:
      ask === 'r'
        ? `中心《ちゅうしん》から まわりまでの 長《なが》さ（半径《はんけい》）は、どこでも おなじ ${r}cmです。`
        : `中心《ちゅうしん》を とおって まわりから まわりまでは 直径《ちょっけい》。半径《はんけい》の 2倍《ばい》で ${2 * r}cmです。`,
    identity: `same:${ask}:${r}`,
    alt: false,
    fields: [{ label: 'cm', answer: { kind: 'int', value: ask === 'r' ? r : 2 * r } }],
    wrongAnswers: wrongList(String(ask === 'r' ? r : 2 * r), 1, [
      [ask === 'r' ? 2 * r : r, 'radius-diameter-swap'],
      [ask === 'd' && r % 2 === 0 ? r / 2 : null, 'half-wrong-way'],
    ]),
  };
}

function rd(level: number, rng: Rng, alt: boolean): NumberItem {
  const toD = rng.next() < 0.5;
  const r = rng.int(1, 20);
  const d = 2 * r;
  if (alt)
    return {
      engine: 'number',
      id: `rd-alt:${r}`,
      objective: 'rd',
      level,
      prompt: `コンパスを ${r}cmに ひらいて 円《えん》を かきました。この 円《えん》の 直径《ちょっけい》は 何《なん》cmですか。`,
      hints: [
        'コンパスの はりと えんぴつの あいだの 長《なが》さは、円《えん》の 何《なに》に なるかな。',
        `コンパスを ひらいた 長《なが》さが 半径《はんけい》。半径《はんけい》は ${r}cm。`,
        '直径《ちょっけい》は 半径《はんけい》の 何倍《なんばい》かな。',
      ],
      explain: `コンパスを ひらいた 長《なが》さが 半径《はんけい》で ${r}cm。直径《ちょっけい》は 半径《はんけい》の 2倍《ばい》で ${d}cmです。`,
      identity: `compass:${r}`,
      alt: true,
      fields: [{ label: 'cm', answer: { kind: 'int', value: d } }],
      wrongAnswers: wrongList(String(d), 1, [
        [r, 'radius-diameter-swap'],
        [r % 2 === 0 ? r / 2 : null, 'half-wrong-way'],
      ]),
    };
  return toD
    ? {
        engine: 'number',
        id: `rd:d:${r}`,
        objective: 'rd',
        level,
        prompt: `半径《はんけい》が ${r}cmの 円《えん》の 直径《ちょっけい》は 何《なん》cmですか。`,
        hints: [
          '直径《ちょっけい》は 中心《ちゅうしん》を とおって まわりから まわりまで。',
          '直径《ちょっけい》の 中《なか》に 半径《はんけい》は いくつ 入《はい》るかな。',
          `${r}cmが 2つ分《ぶん》。`,
        ],
        explain: `直径《ちょっけい》は 半径《はんけい》の 2倍《ばい》。${r} × 2 ＝ ${d}で ${d}cmです。`,
        identity: `diam:${r}`,
        alt: false,
        fields: [{ label: 'cm', answer: { kind: 'int', value: d } }],
        wrongAnswers: wrongList(String(d), 1, [
          [r % 2 === 0 ? r / 2 : null, 'half-wrong-way'],
          [r, 'radius-diameter-swap'],
        ]),
      }
    : {
        engine: 'number',
        id: `rd:r:${d}`,
        objective: 'rd',
        level,
        prompt: `直径《ちょっけい》が ${d}cmの 円《えん》の 半径《はんけい》は 何《なん》cmですか。`,
        hints: [
          '半径《はんけい》は 中心《ちゅうしん》から まわりまで。',
          '直径《ちょっけい》の 半分《はんぶん》が 半径《はんけい》だよ。',
          `${d}cmの 半分《はんぶん》は？`,
        ],
        explain: `半径《はんけい》は 直径《ちょっけい》の 半分《はんぶん》。${d} ÷ 2 ＝ ${r}で ${r}cmです。`,
        identity: `rad:${d}`,
        alt: false,
        fields: [{ label: 'cm', answer: { kind: 'int', value: r } }],
        wrongAnswers: wrongList(String(r), 1, [
          [d * 2, 'half-wrong-way'],
          [d, 'radius-diameter-swap'],
        ]),
      };
}

/** ボール（球）・円を n こ ならべた 長さ */
function apply(level: number, rng: Rng, alt: boolean): NumberItem {
  const n = rng.int(2, 6);
  const r = rng.int(1, 9);
  const d = 2 * r;
  if (alt) {
    // 逆: 長さから 半径を もとめる
    return {
      engine: 'number',
      id: `apply-alt:${r}:${n}`,
      objective: 'apply',
      level,
      prompt: `同《おな》じ 大《おお》きさの ボールが ${n}こ、長《なが》さ ${d * n}cmの はこに ぴったり 一《いち》れつに 入《はい》って います。ボールの 半径《はんけい》は 何《なん》cmですか。`,
      figure: {
        kind: 'row',
        items: Array.from({ length: n }, () => ({ kind: 'shape', shape: 'circle' }) as Figure),
        gap: 0,
      },
      hints: [
        'はこの 長《なが》さは、ボールの 直径《ちょっけい》 いくつ分《ぶん》かな。',
        `${d * n} ÷ ${n} で ボール 1この 直径《ちょっけい》。`,
        `直径《ちょっけい》は ${d}cm。半径《はんけい》は その 半分《はんぶん》。`,
      ],
      explain: `${d * n} ÷ ${n} ＝ ${d}で、ボールの 直径《ちょっけい》は ${d}cm。半径《はんけい》は ${d} ÷ 2 ＝ ${r}で ${r}cmです。`,
      identity: `box-rev:${r}:${n}`,
      alt: true,
      fields: [{ label: 'cm', answer: { kind: 'int', value: r } }],
      wrongAnswers: wrongList(String(r), 1, [
        [d, 'radius-diameter-swap'],
        [d * n - n, 'use-radius'],
      ]),
    };
  }
  const givenR = rng.next() < 0.6;
  const thing = rng.next() < 0.5 ? 'ball' : 'circle';
  const text =
    thing === 'ball'
      ? `${givenR ? `半径《はんけい》${r}cm` : `直径《ちょっけい》${d}cm`}の ボールが ${n}こ、はこに ぴったり 一《いち》れつに 入《はい》って います。はこの 長《なが》さは 何《なん》cmですか。`
      : `${givenR ? `半径《はんけい》${r}cm` : `直径《ちょっけい》${d}cm`}の 円《えん》を ${n}こ、よこに ぴったり ならべました。はしから はしまでの 長《なが》さは 何《なん》cmですか。`;
  return {
    engine: 'number',
    id: `apply:${thing}:${givenR ? 'r' : 'd'}${givenR ? r : d}:${n}`,
    objective: 'apply',
    level,
    prompt: text,
    figure: {
      kind: 'row',
      items: Array.from({ length: n }, () => ({ kind: 'shape', shape: 'circle' }) as Figure),
      gap: 0,
    },
    hints: [
      '長《なが》さは、直径《ちょっけい》 いくつ分《ぶん》かな。',
      givenR
        ? `半径《はんけい》${r}cmなので、直径《ちょっけい》は ${r}cmの 2倍《ばい》。`
        : `直径《ちょっけい》は ${d}cm。`,
      `直径《ちょっけい》${d}cmが ${n}こ分《ぶん》。`,
    ],
    explain: `直径《ちょっけい》は ${d}cm。${d} × ${n} ＝ ${d * n}で ${d * n}cmです。`,
    identity: `${thing}:${givenR ? 'r' : 'd'}:${r}:${n}`,
    alt: false,
    fields: [{ label: 'cm', answer: { kind: 'int', value: d * n } }],
    wrongAnswers: wrongList(String(d * n), 1, [
      [givenR ? r * n : null, 'use-radius'],
      [givenR ? null : r * n, 'half-wrong-way'],
      [d + n, 'wrong-op'],
    ]),
  };
}

function sphere(level: number, rng: Rng, alt: boolean): NumberItem | ChoiceItem {
  if (alt) {
    const q = rng.int(0, 3);
    if (q === 0)
      return {
        engine: 'choice',
        id: 'sphere-alt:cut',
        objective: 'sphere',
        level,
        prompt:
          'ボール（球《きゅう》）を まっすぐ 切《き》ると、切《き》り口《くち》は どんな 形《かたち》ですか。',
        hints: [
          '球《きゅう》は、どこから 見《み》ても まるい 形《かたち》だね。',
          'みかんや ボールを 切《き》った ところを 思《おも》い出《だ》そう。',
          'どこで 切《き》っても 切《き》り口《くち》は おなじ 形《かたち》の なかま。',
        ],
        explain:
          '球《きゅう》は どこで 切《き》っても、切《き》り口《くち》は 円《えん》に なります。',
        identity: 'sphere:cut',
        alt: true,
        options: [
          { label: '円《えん》', correct: true },
          { label: '四角形《しかくけい》', misconception: 'sphere-section' },
          { label: '三角形《さんかくけい》', misconception: 'sphere-section' },
        ],
      };
    if (q === 1)
      return {
        engine: 'choice',
        id: 'sphere-alt:biggest',
        objective: 'sphere',
        level,
        prompt:
          '球《きゅう》を 切《き》った とき、切《き》り口《くち》の 円《えん》が いちばん 大《おお》きく なるのは どこで 切《き》った ときですか。',
        hints: [
          'はしの ほうを 切《き》ると、切《き》り口《くち》は 小《ちい》さいね。',
          'まん中《なか》に 近《ちか》いほど…',
          '球《きゅう》の 中心《ちゅうしん》を とおる ところ。',
        ],
        explain:
          '球《きゅう》の 中心《ちゅうしん》を とおるように 切《き》ると、切《き》り口《くち》が いちばん 大《おお》きい 円《えん》に なります。その 円《えん》の 半径《はんけい》・直径《ちょっけい》が 球《きゅう》の 半径《はんけい》・直径《ちょっけい》です。',
        identity: 'sphere:biggest',
        alt: true,
        options: [
          { label: '球《きゅう》の 中心《ちゅうしん》を とおる ところ', correct: true },
          { label: 'はしに 近《ちか》い ところ', misconception: 'sphere-section' },
          { label: 'どこで 切《き》っても おなじ', misconception: 'sphere-section' },
        ],
      };
    const d = rng.int(2, 15) * 2;
    return {
      engine: 'number',
      id: `sphere-alt:boards:${d}`,
      objective: 'sphere',
      level,
      prompt: `ボールを 2まいの 板《いた》で まっすぐ はさんで、板《いた》の あいだを はかったら ${d}cmでした。ボールの 半径《はんけい》は 何《なん》cmですか。`,
      hints: [
        '板《いた》の あいだの 長《なが》さは、ボールの 何《なに》かな。',
        '板《いた》の あいだは ボールの 直径《ちょっけい》。',
        `${d}cmの 半分《はんぶん》。`,
      ],
      explain: `板《いた》の あいだの 長《なが》さは 球《きゅう》の 直径《ちょっけい》で ${d}cm。半径《はんけい》は ${d / 2}cmです。`,
      identity: `sphere:boards:${d}`,
      alt: true,
      fields: [{ label: 'cm', answer: { kind: 'int', value: d / 2 } }],
      wrongAnswers: wrongList(String(d / 2), 1, [
        [d, 'radius-diameter-swap'],
        [d * 2, 'half-wrong-way'],
      ]),
    };
  }
  const r = rng.int(2, 15);
  const box = rng.next() < 0.5;
  return box
    ? {
        engine: 'number',
        id: `sphere:box:${r}`,
        objective: 'sphere',
        level,
        prompt: `半径《はんけい》${r}cmの ボールが ぴったり 入《はい》る、さいころの 形《かたち》の はこが あります。はこの 1つの 辺《へん》の 長《なが》さは 何《なん》cmですか。`,
        hints: [
          'はこの たても よこも 高《たか》さも、ボールに ぴったりだね。',
          'はこの 1辺《ぺん》は ボールの 直径《ちょっけい》と おなじ。',
          `直径《ちょっけい》は 半径《はんけい》${r}cmの 2倍《ばい》。`,
        ],
        explain: `はこの 1辺《ぺん》は ボールの 直径《ちょっけい》と おなじ。${r} × 2 ＝ ${2 * r}で ${2 * r}cmです。`,
        identity: `sphere:box:${r}`,
        alt: false,
        fields: [{ label: 'cm', answer: { kind: 'int', value: 2 * r } }],
        wrongAnswers: wrongList(String(2 * r), 1, [[r, 'use-radius']]),
      }
    : {
        engine: 'number',
        id: `sphere:rd:${r}`,
        objective: 'sphere',
        level,
        prompt: `直径《ちょっけい》が ${2 * r}cmの 球《きゅう》の 半径《はんけい》は 何《なん》cmですか。`,
        hints: [
          '球《きゅう》にも 中心《ちゅうしん》・半径《はんけい》・直径《ちょっけい》が あるよ。',
          '円《えん》と おなじで、直径《ちょっけい》は 半径《はんけい》の 2倍《ばい》。',
          `${2 * r}cmの 半分《はんぶん》は？`,
        ],
        explain: `球《きゅう》の 半径《はんけい》は 直径《ちょっけい》の 半分《はんぶん》。${2 * r} ÷ 2 ＝ ${r}で ${r}cmです。`,
        identity: `sphere:rd:${r}`,
        alt: false,
        fields: [{ label: 'cm', answer: { kind: 'int', value: r } }],
        wrongAnswers: wrongList(String(r), 1, [
          [2 * r, 'radius-diameter-swap'],
          [4 * r, 'half-wrong-way'],
        ]),
      };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['parts', 'rd'] },
  { objs: ['parts', 'rd', 'apply'] },
  { objs: ['apply', 'sphere', 'rd'] },
  { objs: ['parts', 'apply', 'sphere'] },
];

export function generateCircleSphere(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'parts':
      return parts(level, rng, alt);
    case 'rd':
      return rd(level, rng, alt);
    case 'apply':
      return apply(level, rng, alt);
    case 'sphere':
      return sphere(level, rng, alt);
  }
}

export const circleSphere: UnitSpec = {
  id: 'g3.math.circle-sphere',
  title: '円《えん》と 球《きゅう》',
  stage: 'g3',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: ['g2.math.triangles-quads'],
  objectives: [
    { id: 'parts', title: '中心《ちゅうしん》・半径《はんけい》・直径《ちょっけい》' },
    { id: 'rd', title: '半径《はんけい》と 直径《ちょっけい》の 長《なが》さ' },
    { id: 'apply', title: '円《えん》や ボールを ならべた 長《なが》さ' },
    { id: 'sphere', title: '球《きゅう》' },
  ],
  misconceptions: [
    {
      id: 'radius-diameter-swap',
      explain:
        '半径《はんけい》と 直径《ちょっけい》を とりちがえたのかな。中心《ちゅうしん》から まわりまでが 半径《はんけい》、中心《ちゅうしん》を とおって まわりから まわりまでが 直径《ちょっけい》だよ。',
      figure: circleFig('d', 0),
    },
    {
      id: 'half-wrong-way',
      explain:
        '2倍《ばい》と 半分《はんぶん》を 反対《はんたい》に したのかな。直径《ちょっけい》は 半径《はんけい》の 2倍《ばい》、半径《はんけい》は 直径《ちょっけい》の 半分《はんぶん》だよ。',
    },
    {
      id: 'chord-as-diameter',
      explain:
        '中心《ちゅうしん》を とおって いない 線《せん》を えらんだのかな。半径《はんけい》も 直径《ちょっけい》も 中心《ちゅうしん》を とおるよ。',
    },
    {
      id: 'center-not',
      explain:
        '線《せん》が 中心《ちゅうしん》を とおって いるか、もう一度《いちど》 見《み》よう。中心《ちゅうしん》を とおって いれば 半径《はんけい》か 直径《ちょっけい》だよ。',
    },
    {
      id: 'use-radius',
      explain:
        '半径《はんけい》で 長《なが》さを 数《かぞ》えたのかな。ボールや 円《えん》 1つ分《ぶん》の はばは 直径《ちょっけい》（半径《はんけい》の 2倍《ばい》）だよ。',
    },
    {
      id: 'sphere-section',
      explain:
        '球《きゅう》は どこで 切《き》っても 切《き》り口《くち》は 円《えん》。中心《ちゅうしん》を とおる ところで 切《き》ると、いちばん 大《おお》きい 円《えん》に なるよ。',
    },
    {
      id: 'wrong-op',
      explain:
        'たし算《ざん》を したのかな。おなじ 長《なが》さが いくつ分《ぶん》 あるかを 考《かんが》えて、かけ算《ざん》に しよう。',
    },
  ],
  levels: [
    { label: '中心・半径・直径', chance: 0.05 },
    { label: 'ならべた 長さ', chance: 0.05 },
    { label: '球', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '1つの 点《てん》から 同《おな》じ 長《なが》さの ところに 点《てん》を たくさん うつと、まるい 形《かたち》が できます。これを 円《えん》、まん中《なか》の 点《てん》を 中心《ちゅうしん》と いいます。',
      figure: circleFig('r', 0),
    },
    {
      text: '中心《ちゅうしん》から 円《えん》の まわりまで ひいた 線《せん》が 半径《はんけい》、中心《ちゅうしん》を とおって まわりから まわりまで ひいた 線《せん》が 直径《ちょっけい》。直径《ちょっけい》は 半径《はんけい》の 2倍《ばい》です。',
      figure: circleFig('d', 0),
    },
    {
      text: 'コンパスを ひらいた 長《なが》さが 半径《はんけい》に なります。ボールのように、どこから 見《み》ても 円《えん》に 見《み》える 形《かたち》を 球《きゅう》と いいます。',
      figure: { kind: 'illust', id: 'ball' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateCircleSphere(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第3学年 B(1) 円と球（中心・半径・直径、コンパスでの作図、球の直径）',
  revised: '2026-10-24',
};
