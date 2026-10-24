/**
 * g2.math.box 箱の形（面・辺・頂点）（curriculum-matrix 3.5）。
 * 開いた面を選ぶ → 辺・頂点の数 → ひごと粘土玉の数。
 *
 * matrix は「手30」。本単元は箱の大きさ（たて・よこ・たかさ 2〜6cm の組 35通り）から生成する。
 * 同一性キー: 問う形 × 箱の大きさ（× 問う面・辺）。向き（どれを たて と呼ぶか）は同じとみる。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, wrongList } from './util';

type Obj = 'faces' | 'edges' | 'net';
type Dims = [number, number, number];

/** 箱の大きさ（a ≤ b ≤ c、2〜6cm） */
const DIMS: Dims[] = [];
for (let a = 2; a <= 6; a++)
  for (let b = a; b <= 6; b++) for (let c = b; c <= 6; c++) DIMS.push([a, b, c]);

const S = 'stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"';

/** 箱の絵（見える面だけ。たて=おくゆき a、よこ b、たかさ c） */
function boxFig(d: Dims): Figure {
  const [a, b, c] = d;
  const k = 12;
  const ox = a * k * 0.6;
  const oy = a * k * 0.45;
  const W = b * k + ox + 8;
  const H = c * k + oy + 8;
  const x0 = 4;
  const y0 = 4 + oy;
  const front = `<rect x="${x0}" y="${y0}" width="${b * k}" height="${c * k}" fill="var(--wood)" ${S}/>`;
  const top = `<polygon points="${x0},${y0} ${x0 + ox},${y0 - oy} ${x0 + ox + b * k},${y0 - oy} ${x0 + b * k},${y0}" fill="var(--sun)" ${S}/>`;
  const side = `<polygon points="${x0 + b * k},${y0} ${x0 + b * k + ox},${y0 - oy} ${x0 + b * k + ox},${y0 - oy + c * k} ${x0 + b * k},${y0 + c * k}" fill="var(--wood-dark)" ${S}/>`;
  return {
    kind: 'row',
    items: [
      {
        kind: 'svg',
        label: 'はこ',
        markup: `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${front}${top}${side}</svg>`,
      },
      {
        kind: 'column',
        items: [
          { kind: 'text', text: `たて ${a}cm`, size: 'm' },
          { kind: 'text', text: `よこ ${b}cm`, size: 'm' },
          { kind: 'text', text: `たかさ ${c}cm`, size: 'm' },
        ],
      },
    ],
  };
}

/** 面（長方形）の絵 */
function faceFig(w: number, h: number): Figure {
  const k = 12;
  return {
    kind: 'svg',
    label: `${w}cmと ${h}cmの めん`,
    markup: `<svg viewBox="0 0 ${w * k + 8} ${h * k + 8}" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="${w * k}" height="${h * k}" fill="var(--sky)" ${S}/></svg>`,
  };
}

const dimText = (d: Dims) => `たて ${d[0]}cm、よこ ${d[1]}cm、たかさ ${d[2]}cm`;
const dkey = (d: Dims) => d.join('x');

/** ある大きさの面の数（2・4・6） */
function faceCount(d: Dims, p: number, q: number): number {
  const pairs: [number, number][] = [
    [d[0], d[1]],
    [d[0], d[2]],
    [d[1], d[2]],
  ];
  const same = (x: [number, number]) => (x[0] === p && x[1] === q) || (x[0] === q && x[1] === p);
  return pairs.filter(same).length * 2;
}

/** めんの数 */
function faces(level: number, rng: Rng, alt: boolean): NumberItem {
  const d = DIMS[rng.int(0, DIMS.length - 1)]!;
  const pairs: [number, number][] = [
    [d[0], d[1]],
    [d[0], d[2]],
    [d[1], d[2]],
  ];
  // 「めんは ぜんぶで いくつ」は箱の大きさによらず同じ問題（キーは1つ）。偏らないよう ときどき
  const all = rng.next() < 0.08;
  const [p, q] = pairs[rng.int(0, 2)]!;
  const n = all ? 6 : faceCount(d, p, q);
  const shape = p === q ? 'せいほうけい' : 'ちょうほうけい';
  return {
    engine: 'number',
    id: `faces${alt ? '-alt' : ''}:${dkey(d)}:${all ? 'all' : `${p}-${q}`}`,
    objective: 'faces',
    level,
    prompt: all
      ? `${alt ? `${dimText(d)}の はこが あります。` : ''}この はこの めんは ぜんぶで いくつ？`
      : `${alt ? `${dimText(d)}の はこが あります。` : ''}${p}cmと ${q}cmの へんで かこまれた ${shape}の めんは いくつ？`,
    figure: alt ? undefined : boxFig(d),
    fields: [{ answer: { kind: 'int', value: n } }],
    hints: [
      'みえない うらがわの めんも かんがえよう。',
      all
        ? 'うえと した、まえと うしろ、みぎと ひだり。'
        : 'むかいあう めんは おなじ かたち・おなじ おおきさ だよ。',
      all
        ? '2つずつ 3くみ…'
        : `${p}cmと ${q}cmの めんは、むかいあわせに 2まいずつ。ほかの くみにも おなじ めんが あるかな。`,
    ],
    explain: all
      ? 'はこの めんは うえ・した・まえ・うしろ・みぎ・ひだりの 6つ です。'
      : `${p}cmと ${q}cmの めんは ${n}つ です。むかいあう めんは おなじ かたち・おなじ おおきさ です。`,
    identity: all ? `faces:all${alt ? '-text' : ''}` : `faces:${dkey(d)}:${p}-${q}`,
    alt,
    wrongAnswers: wrongList(String(n), 1, [
      [all ? 3 : n / 2, 'faces-visible'],
      [all ? 4 : null, 'faces-visible'],
      [!all && n === 2 ? 1 : null, 'pair-faces'],
    ]),
  };
}

/** へん・ちょうてんの数（alt: ひごと ねんどだまで つくる） */
function edges(level: number, rng: Rng, alt: boolean): NumberItem {
  const d = DIMS[rng.int(0, DIMS.length - 1)]!;
  // 0: ある長さの へん、1: へん ぜんぶ、2: ちょうてん（1・2 は箱によらず同じ問題なので ときどき）
  const r = rng.next();
  const form = r < 0.08 ? 1 : r < 0.16 ? 2 : 0;
  const L = d[rng.int(0, 2)]!;
  const n = form === 2 ? 8 : form === 1 ? 12 : d.filter((x) => x === L).length * 4;
  const prompt = alt
    ? form === 2
      ? `ひごと ねんどだまで、${dimText(d)}の はこの かたちを つくります。ねんどだまは いくつ いりますか。`
      : form === 1
        ? `ひごと ねんどだまで、${dimText(d)}の はこの かたちを つくります。ひごは ぜんぶで なんぼん いりますか。`
        : `ひごと ねんどだまで、${dimText(d)}の はこの かたちを つくります。${L}cmの ひごは なんぼん いりますか。`
    : form === 2
      ? 'この はこの ちょうてんは いくつ？'
      : form === 1
        ? 'この はこの へんは ぜんぶで いくつ？'
        : `この はこで、${L}cmの へんは いくつ？`;
  return {
    engine: 'number',
    id: `edges${alt ? '-alt' : ''}:${dkey(d)}:${form}:${L}`,
    objective: 'edges',
    level,
    prompt,
    figure: alt ? undefined : boxFig(d),
    fields: [{ answer: { kind: 'int', value: n } }],
    hints: [
      alt
        ? form === 2
          ? 'ねんどだまは はこの かど（ちょうてん）に なるよ。'
          : 'ひごは はこの へんに なるよ。'
        : 'みえない うらがわの へんや ちょうてんも かんがえよう。',
      form === 2
        ? 'うえの めんの かどが 4つ、したの めんの かどが 4つ。'
        : form === 1
          ? 'おなじ ながさの へんは 4ほんずつ。たて・よこ・たかさの 3しゅるい。'
          : 'たて・よこ・たかさの へんは、それぞれ 4ほんずつ あるよ。',
      form === 2
        ? '4 ＋ 4 を けいさん しよう。'
        : form === 1
          ? '4ほんが 3くみ…'
          : `${L}cmの へんが どこに あるか、たて・よこ・たかさで しらべよう。`,
    ],
    explain:
      form === 2
        ? 'はこの ちょうてんは 8つ。ねんどだまも 8こ いります。'
        : form === 1
          ? 'はこの へんは 4ほんずつ 3くみで 12。ひごも 12ほん いります。'
          : `${L}cmの へんは ${n}ほん です（たて・よこ・たかさの へんは 4ほんずつ）。`,
    identity:
      form === 0
        ? `edges:${dkey(d)}:${L}`
        : `edges:${form === 1 ? 'all' : 'vertex'}${alt ? '-higo' : ''}`,
    alt,
    wrongAnswers: wrongList(String(n), 1, [
      [form === 2 ? 7 : form === 1 ? 9 : null, 'edge-visible'],
      [form === 2 ? 4 : form === 1 ? 6 : n / 2, 'edge-visible'],
      [form === 0 && n === 4 ? 1 : null, 'pair-faces'],
    ]),
  };
}

/** めんを選ぶ（うつしとれない形／たりない形） */
function net(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const d = DIMS[rng.int(0, DIMS.length - 1)]!;
  const [a, b, c] = d;
  const present: [number, number][] = [
    [a, b],
    [a, c],
    [b, c],
  ];
  const uniq = present.filter(
    (p, i) => present.findIndex((q) => q[0] === p[0] && q[1] === p[1]) === i,
  );
  // ない めん（大きさの違う長方形）
  const cands: [number, number][] = [];
  for (let x = 2; x <= 6; x++)
    for (let y = x; y <= 6; y++)
      if (!present.some((p) => p[0] === x && p[1] === y)) cands.push([x, y]);
  const fake = cands[rng.int(0, cands.length - 1)]!;
  if (alt) {
    // 5まいの めんを みせて、たりない 1まいを えらぶ
    const all6: [number, number][] = [...present, ...present];
    const missIdx = rng.int(0, 2);
    const shown = all6.filter((_, i) => i !== missIdx);
    const miss = present[missIdx]!;
    const opts = [miss, ...uniq.filter((p) => !(p[0] === miss[0] && p[1] === miss[1])), fake].slice(
      0,
      4,
    );
    return {
      engine: 'choice',
      id: `net-alt:${dkey(d)}:${missIdx}:${fake.join('x')}`,
      objective: 'net',
      level,
      prompt: `${dimText(d)}の はこを、めんを 6まい つかって つくります。いま 5まい あります。たりない めんは どれ？`,
      figure: { kind: 'row', gap: 2, items: shown.map(([w, h]) => faceFig(w, h)) },
      hints: [
        'むかいあう めんは おなじ かたち・おなじ おおきさ。2まいずつ あるよ。',
        'おなじ めんを 2まいずつ くみに しよう。',
        '1まいしか ない めんを さがそう。',
      ],
      explain: `${miss[0]}cmと ${miss[1]}cmの めんが 1まいしか ないので、もう 1まい いります。`,
      identity: `net-missing:${dkey(d)}:${miss.join('x')}`,
      alt: true,
      layout: 'row',
      options: opts.map(([w, h], i) =>
        i === 0
          ? { label: `${w}cmと ${h}cm`, figure: faceFig(w, h), correct: true }
          : {
              label: `${w}cmと ${h}cm`,
              figure: faceFig(w, h),
              misconception: w === fake[0] && h === fake[1] ? 'face-size' : 'pair-faces',
            },
      ),
    };
  }
  const opts = [fake, ...uniq].slice(0, 4);
  return {
    engine: 'choice',
    id: `net:${dkey(d)}:${fake.join('x')}`,
    objective: 'net',
    level,
    prompt: 'この はこの めんを かみに うつしとりました。うつしとれない かたちは どれ？',
    figure: boxFig(d),
    hints: [
      'はこの めんの へんの ながさは、たて・よこ・たかさの どれかと どれか だよ。',
      `めんは ${uniq.map((p) => `${p[0]}cmと ${p[1]}cm`).join('、')}の ${uniq.length}しゅるい。`,
      'この 3しゅるいに ない かたちを さがそう。',
    ],
    explain: `この はこの めんは ${uniq.map((p) => `${p[0]}cmと ${p[1]}cm`).join('、')}の かたち。${fake[0]}cmと ${fake[1]}cmの めんは ありません。`,
    identity: `net:${dkey(d)}:${fake.join('x')}`,
    alt: false,
    layout: 'row',
    options: opts.map(([w, h], i) =>
      i === 0
        ? { label: `${w}cmと ${h}cm`, figure: faceFig(w, h), correct: true }
        : { label: `${w}cmと ${h}cm`, figure: faceFig(w, h), misconception: 'face-missed' },
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [{ objs: ['faces', 'net'] }, { objs: ['faces', 'edges', 'net'] }];

export function generateBox(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'faces':
      return faces(level, rng, alt);
    case 'edges':
      return edges(level, rng, alt);
    case 'net':
      return net(level, rng, alt);
  }
}

export const box: UnitSpec = {
  id: 'g2.math.box',
  title: 'はこの 形《かたち》',
  stage: 'g2',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: ['g2.math.triangles-quads'],
  objectives: [
    { id: 'faces', title: 'めんの かずと かたち' },
    { id: 'edges', title: 'へん・ちょうてんの かず（ひごと ねんどだま）' },
    { id: 'net', title: 'はこの めんを えらぶ' },
  ],
  misconceptions: [
    {
      id: 'faces-visible',
      explain: 'みえる めんだけ かぞえたのかな。うら・した・うしろにも めんが あるよ。',
    },
    {
      id: 'pair-faces',
      explain:
        'むかいあう めんを わすれたのかな。むかいあう めんは おなじ かたちで 2まいずつ あるよ。',
    },
    {
      id: 'edge-visible',
      explain: 'みえる ところだけ かぞえたのかな。うしろや したの へん・かども かぞえよう。',
    },
    {
      id: 'face-missed',
      explain:
        'その かたちの めんも はこに あるよ。たて・よこ・たかさの 2つずつを くみあわせて みよう。',
    },
    {
      id: 'face-size',
      explain: 'その おおきさの めんは この はこには ないよ。へんの ながさを くらべよう。',
    },
  ],
  levels: [
    { label: 'めん', chance: 0.05 },
    { label: 'へん・ちょうてん', chance: 0.05 },
  ],
  intro: [
    {
      text: 'はこの たいらな ところを めん と いいます。めんは 6つ あります。',
      figure: boxFig([3, 4, 5]),
    },
    {
      text: 'むかいあう めんは、おなじ かたち・おなじ おおきさ です。',
      figure: { kind: 'row', items: [faceFig(4, 5), faceFig(4, 5)] },
    },
    {
      text: 'めんと めんの さかいの せんを へん（12）、かどを ちょうてん（8）と いいます。',
      figure: boxFig([3, 3, 3]),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateBox(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第2学年 B(1) 箱の形（面・辺・頂点）',
  revised: '2026-10-24',
};
