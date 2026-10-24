/**
 * g3.math.add-sub-column 3・4位数の加減の筆算（curriculum-matrix 3.6）。
 * 繰り上がり1回 → 2回以上・4けた → 0をまたぐ繰り下がり → 文章題。
 *
 * 筆算は number の複数欄（答えの位ごとに1欄。大きい位から）で代用する（2.6 の筆算レイアウトの代わり）。
 * 位ごとの入力から、繰り上がりの足し忘れ・大きい数から小さい数をひく・くり下げた位を減らし忘れる・
 * 0 をまたぐくり下がりで 0 を 9 にし忘れる を誤概念に結ぶ。
 *
 * 同一性キー: たし算は交換しただけの式を同じ（小さい数+大きい数。交換法則はこの単元の学習内容でない）。
 *   ひき算は 'a-b'。文章題は「場面 × 式」。別例（横書きの式）は同じキーで alt。
 * 定義域: 3・4けたの数の組。数千通り。
 */
import type { Rng } from '../../core/util/rng';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { columnFigure, digits, fromDigits, pickObj, placeFields, placeName, toFields, wrongList } from './util';

type Obj = 'add1' | 'addm' | 'sub1' | 'subz' | 'bunshou';

// ---- 計算の手順 ----
function carries(a: number, b: number): number {
  const da = digits(a);
  const db = digits(b);
  let c = 0;
  let n = 0;
  for (let i = 0; i < Math.max(da.length, db.length); i++) {
    const s = (da[i] ?? 0) + (db[i] ?? 0) + c;
    c = s >= 10 ? 1 : 0;
    n += c;
  }
  return n;
}

/** ひき算の くり下がりの回数と、0 をまたいだか */
function borrows(a: number, b: number): { n: number; zero: boolean } {
  const da = digits(a);
  const db = digits(b);
  let bin = 0;
  let n = 0;
  let zero = false;
  for (let i = 0; i < da.length; i++) {
    if (bin && da[i] === 0) zero = true;
    const top = da[i]! - bin;
    const bout = top < (db[i] ?? 0) ? 1 : 0;
    n += bout;
    bin = bout;
  }
  return { n, zero };
}

/** 繰り上がりを足し忘れた答え */
function addNoCarry(a: number, b: number): number {
  const da = digits(a);
  const db = digits(b);
  const out: number[] = [];
  for (let i = 0; i < Math.max(da.length, db.length); i++) out.push(((da[i] ?? 0) + (db[i] ?? 0)) % 10);
  return fromDigits(out);
}
/** 位ごとに大きい方から小さい方をひいた答え */
function subSmallFromBig(a: number, b: number): number {
  const da = digits(a);
  const db = digits(b);
  return fromDigits(da.map((x, i) => Math.abs(x - (db[i] ?? 0))));
}
/** 10 かりたのに、かした位を 1 減らし忘れた答え */
function subNoReduce(a: number, b: number): number {
  const da = digits(a);
  const db = digits(b);
  return fromDigits(da.map((x, i) => (x - (db[i] ?? 0) + 10) % 10));
}
/** 0 の位をまたいで かりたとき、0 を 9 でなく 10 にした答え（その位の数字が 10 以上になるなら null） */
function subZeroAsTen(a: number, b: number): number | null {
  const da = digits(a);
  const db = digits(b);
  let bin = 0;
  const out: number[] = [];
  for (let i = 0; i < da.length; i++) {
    const y = db[i] ?? 0;
    let top: number;
    let bout: number;
    if (bin && da[i] === 0) {
      top = 10;
      bout = 1;
    } else {
      top = da[i]! - bin;
      bout = top < y ? 1 : 0;
      top += bout * 10;
    }
    const d = top - y;
    if (d > 9) return null;
    out.push(d);
    bin = bout;
  }
  return fromDigits(out);
}

function addSteps(a: number, b: number): string[] {
  const da = digits(a);
  const db = digits(b);
  const out: string[] = [];
  let c = 0;
  for (let i = 0; i < Math.max(da.length, db.length); i++) {
    const s = (da[i] ?? 0) + (db[i] ?? 0) + c;
    out.push(
      `${placeName(i)}: ${da[i] ?? 0} ＋ ${db[i] ?? 0}${c ? ' ＋ 1' : ''} ＝ ${s}${s >= 10 ? `（${s % 10}を 書《か》いて 1 くり上《あ》げる）` : ''}`,
    );
    c = s >= 10 ? 1 : 0;
  }
  if (c) out.push(`くり上《あ》げた 1が ${placeName(out.length)}に なる`);
  return out;
}

function subSteps(a: number, b: number): string[] {
  const da = digits(a);
  const db = digits(b);
  const out: string[] = [];
  let bin = 0;
  for (let i = 0; i < da.length; i++) {
    const y = db[i] ?? 0;
    const x = da[i]!;
    const top0 = x - bin;
    const bout = top0 < y ? 1 : 0;
    const top = top0 + bout * 10;
    const notes: string[] = [];
    if (bin && x === 0) notes.push('0なので、となりから 10 かりて 10。1 かしたので 9');
    else if (bin) notes.push(`1 かしたので ${x}は ${x - 1}`);
    if (bout && !(bin && x === 0)) notes.push(`となりから 10 かりて ${top}`);
    const d = top - y;
    if (i === da.length - 1 && d === 0 && i > 0) {
      out.push(`${placeName(i)}: ${notes.join('、')}${notes.length ? '。' : ''}0に なるので 書《か》かない`);
    } else {
      out.push(`${placeName(i)}: ${notes.join('、')}${notes.length ? '。' : ''}${top} − ${y} ＝ ${d}`);
    }
    bin = bout;
  }
  return out;
}

// ---- 式を選ぶ（定義域から均等に） ----
function pickAdd(rng: Rng, kind: 'add1' | 'addm'): [number, number] {
  for (;;) {
    if (kind === 'add1') {
      const a = rng.int(100, 999);
      const b = rng.int(100, 999);
      if (carries(a, b) === 1 && a + b < 1000) return [a, b];
    } else if (rng.next() < 0.5) {
      const a = rng.int(100, 999);
      const b = rng.int(100, 999);
      if (carries(a, b) >= 2) return [a, b];
    } else {
      const a = rng.int(1000, 9999);
      const b = rng.int(100, 9999);
      if (carries(a, b) >= 1 && a + b < 10000) return rng.next() < 0.5 || b < 1000 ? [a, b] : [b, a];
    }
  }
}

function pickSub(rng: Rng, kind: 'sub1' | 'subz'): [number, number] {
  for (;;) {
    const four = rng.next() < 0.4;
    const a = four ? rng.int(1000, 9999) : rng.int(100, 999);
    const b = rng.int(10, a - 1);
    const br = borrows(a, b);
    if (kind === 'sub1' && br.n >= 1 && !br.zero && !digits(a).slice(1).includes(0)) return [a, b];
    if (kind === 'subz' && br.zero) return [a, b];
  }
}

const addKey = (a: number, b: number) => `${Math.min(a, b)}+${Math.max(a, b)}`;

function addWrongs(a: number, b: number, n: number): NumberItem['wrongAnswers'] {
  const s = a + b;
  const f = (v: number | null) => (v === null ? null : n === 1 ? String(v) : toFields(v, n));
  return wrongList(n === 1 ? String(s) : toFields(s, n)!, n, [
    [f(addNoCarry(a, b)), 'no-carry'],
    [f(Math.abs(a - b)), 'wrong-op'],
  ]);
}

function subWrongs(a: number, b: number, n: number): NumberItem['wrongAnswers'] {
  const d = a - b;
  const f = (v: number | null) => (v === null ? null : n === 1 ? String(v) : toFields(v, n));
  return wrongList(n === 1 ? String(d) : toFields(d, n)!, n, [
    [f(subZeroAsTen(a, b)), 'zero-borrow'],
    [f(subSmallFromBig(a, b)), 'small-from-big'],
    [f(subNoReduce(a, b)), 'no-reduce'],
    [f(a + b), 'wrong-op'],
  ]);
}

function calcItem(obj: Obj, level: number, a: number, b: number, op: '＋' | '−', alt: boolean): NumberItem {
  const ans = op === '＋' ? a + b : a - b;
  const steps = op === '＋' ? addSteps(a, b) : subSteps(a, b);
  const key = op === '＋' ? addKey(a, b) : `${a}-${b}`;
  const hints = [
    'くらいを たてに そろえて、一《いち》のくらいから 計算《けいさん》しよう。',
    `${steps[0]!.replace(/ ＝ .*$/, ' を 計算《けいさん》')}。`,
    op === '＋'
      ? 'くり上《あ》げた 1を わすれずに たしながら、上《うえ》の くらいへ すすもう。'
      : 'かりた ときは、かした くらいを 1 へらすのを わすれずに。0の くらいから かりる ときは、もう 1つ 上《うえ》から かりよう。',
  ];
  const explain = `${steps.join('。')}。答《こた》えは ${ans}です。${op === '−' ? `たしかめ: ${ans} ＋ ${b} ＝ ${a}。` : ''}`;
  if (alt) {
    return {
      engine: 'number',
      id: `${obj}-alt:${a}${op}${b}`,
      objective: obj,
      level,
      prompt: '横《よこ》書《が》きの 式《しき》を 筆算《ひっさん》に なおして 計算《けいさん》しよう。',
      figure: { kind: 'text', text: `${a} ${op} ${b} ＝ {{}}`, size: 'xl' },
      hints,
      explain,
      explainFigure: columnFigure(a, b, op, String(ans).length),
      identity: key,
      alt: true,
      fields: [{ answer: { kind: 'int', value: ans } }],
      wrongAnswers: op === '＋' ? addWrongs(a, b, 1) : subWrongs(a, b, 1),
    };
  }
  const fields = placeFields(ans);
  return {
    engine: 'number',
    id: `${obj}:${a}${op}${b}`,
    objective: obj,
    level,
    prompt: '筆算《ひっさん》で 計算《けいさん》しよう。答《こた》えを くらいごとに 書《か》こう。',
    figure: columnFigure(a, b, op, fields.length),
    hints,
    explain,
    identity: key,
    alt: false,
    fields,
    wrongAnswers: op === '＋' ? addWrongs(a, b, fields.length) : subWrongs(a, b, fields.length),
  };
}

interface Scene {
  id: string;
  op: '＋' | '−';
  type: string;
  unit: string;
  text: (a: number, b: number) => string;
}

/** 文章題の場面（合併2・増加2・求残2・求差2） */
const SCENES: Scene[] = [
  {
    id: 'library',
    op: '＋',
    type: 'あわせる',
    unit: 'さつ',
    text: (a, b) =>
      `図書室《としょしつ》に 物語《ものがたり》の 本《ほん》が ${a}さつ、そのほかの 本《ほん》が ${b}さつ あります。あわせて 何《なん》さつ ありますか。`,
  },
  {
    id: 'orchard',
    op: '＋',
    type: 'あわせる',
    unit: 'こ',
    text: (a, b) =>
      `くだもの畑《ばたけ》で、りんごを ${a}こ、なしを ${b}こ とりました。全部《ぜんぶ》で 何《なん》こ とりましたか。`,
  },
  {
    id: 'savings',
    op: '＋',
    type: 'ふえる',
    unit: '円《えん》',
    text: (a, b) =>
      `ちょ金《きん》が ${a}円《えん》 あります。${b}円《えん》 入《い》れると、何《なん》円《えん》に なりますか。`,
  },
  {
    id: 'train',
    op: '＋',
    type: 'ふえる',
    unit: '人《にん》',
    text: (a, b) =>
      `電車《でんしゃ》に ${a}人《にん》 乗《の》って います。駅《えき》で ${b}人《にん》 乗《の》って きました。何《なん》人《にん》に なりましたか。`,
  },
  {
    id: 'paper',
    op: '−',
    type: 'のこり',
    unit: 'まい',
    text: (a, b) =>
      `色紙《いろがみ》が ${a}まい あります。${b}まい 使《つか》いました。のこりは 何《なん》まいですか。`,
  },
  {
    id: 'shop',
    op: '−',
    type: 'のこり',
    unit: '円《えん》',
    text: (a, b) =>
      `${a}円《えん》 持《も》って います。${b}円《えん》の 本《ほん》を 買《か》うと、のこりは 何《なん》円《えん》ですか。`,
  },
  {
    id: 'mountain',
    op: '−',
    type: 'ちがい',
    unit: 'm',
    text: (a, b) =>
      `あおば山《やま》の 高《たか》さは ${a}m、みどり山《やま》の 高《たか》さは ${b}m です。高《たか》さの ちがいは 何《なん》m ですか。`,
  },
  {
    id: 'steps',
    op: '−',
    type: 'ちがい',
    unit: '歩《ほ》',
    text: (a, b) =>
      `きのうは ${a}歩《ほ》、きょうは ${b}歩《ほ》 歩《ある》きました。きのうは きょうより 何《なん》歩《ほ》 多《おお》く 歩《ある》きましたか。`,
  },
];

function wordItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
  const [a, b] =
    sc.op === '＋'
      ? (() => {
          const [x, y] = pickAdd(rng, rng.next() < 0.5 ? 'add1' : 'addm');
          return x >= y ? [x, y] : [y, x];
        })()
      : pickSub(rng, rng.next() < 0.5 ? 'sub1' : 'subz');
  const ans = sc.op === '＋' ? a + b : a - b;
  const key = sc.op === '＋' ? addKey(a, b) : `${a}-${b}`;
  return {
    engine: 'number',
    id: `bunshou${alt ? '-alt' : ''}:${sc.id}:${a}${sc.op}${b}`,
    objective: 'bunshou',
    level,
    prompt: sc.text(a, b),
    figure: alt
      ? sc.op === '＋'
        ? {
            kind: 'tape',
            parts: [
              { length: a, label: String(a), tone: 'a' },
              { length: b, label: String(b), tone: 'b' },
            ],
            total: '？',
          }
        : {
            kind: 'tape',
            parts: [
              { length: b, label: String(b), tone: 'a' },
              { length: a - b, label: '？', tone: 'b' },
            ],
            total: String(a),
          }
      : undefined,
    hints: [
      sc.op === '＋'
        ? `「${sc.type}」場面《ばめん》だね。たし算《ざん》かな、ひき算《ざん》かな。`
        : `「${sc.type}」を もとめる 場面《ばめん》だね。たし算《ざん》かな、ひき算《ざん》かな。`,
      `式《しき》は ${a} ${sc.op} ${b}。筆算《ひっさん》で 計算《けいさん》しよう。`,
      (sc.op === '＋' ? addSteps(a, b) : subSteps(a, b))[0]!.replace(/ ＝ .*$/, ' から はじめよう。'),
    ],
    explain: `式《しき》は ${a} ${sc.op} ${b} ＝ ${ans}。答《こた》えは ${ans}${sc.unit}です。`,
    explainFigure: columnFigure(a, b, sc.op, String(ans).length),
    identity: `${sc.id}:${key}`,
    alt,
    fields: [{ label: sc.unit, answer: { kind: 'int', value: ans } }],
    wrongAnswers: sc.op === '＋' ? addWrongs(a, b, 1) : subWrongs(a, b, 1),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['add1', 'sub1'] },
  { objs: ['add1', 'addm', 'sub1'] },
  { objs: ['addm', 'sub1', 'subz'] },
  { objs: ['addm', 'subz', 'bunshou'] },
];

export function generateAddSubColumn(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'add1':
    case 'addm': {
      const [a, b] = pickAdd(rng, obj);
      return calcItem(obj, level, a, b, '＋', alt);
    }
    case 'sub1':
    case 'subz': {
      const [a, b] = pickSub(rng, obj);
      return calcItem(obj, level, a, b, '−', alt);
    }
    case 'bunshou':
      return wordItem(level, rng, alt);
  }
}

export const addSubColumn: UnitSpec = {
  id: 'g3.math.add-sub-column',
  title: 'たし算《ざん》と ひき算《ざん》の 筆算《ひっさん》',
  stage: 'g3',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g2.math.add-sub-3digit'],
  objectives: [
    { id: 'add1', title: 'くり上《あ》がり 1回《かい》の たし算《ざん》' },
    { id: 'addm', title: 'くり上《あ》がり 2回《かい》いじょう・4けたの たし算《ざん》' },
    { id: 'sub1', title: 'くり下《さ》がりの ある ひき算《ざん》' },
    { id: 'subz', title: '0の くらいを こえる くり下《さ》がり' },
    { id: 'bunshou', title: '文章題《ぶんしょうだい》（あわせる・ふえる・のこり・ちがい）' },
  ],
  misconceptions: [
    {
      id: 'no-carry',
      explain:
        'くり上《あ》げた 1を たすのを わすれたのかな。くらいの 答《こた》えが 10より 大《おお》きく なったら、1つ 上《うえ》の くらいに 1 たそう。',
    },
    {
      id: 'small-from-big',
      explain:
        'くらいごとに 大《おお》きい 数《かず》から 小《ちい》さい 数《かず》を ひいたのかな。上《うえ》の 数《かず》から ひけない ときは、となりの くらいから 10 かりよう。',
      figure: { kind: 'text', text: '52 − 37: 2から 7は ひけない → 12 − 7', size: 'm' },
    },
    {
      id: 'no-reduce',
      explain:
        '10 かりた あと、かした くらいを 1 へらすのを わすれたのかな。かした くらいの 数《かず》は 1 小《ちい》さく なるよ。',
    },
    {
      id: 'zero-borrow',
      explain:
        '0の くらいから かりる ところで まちがえたのかな。0からは かせないので、もう 1つ 上《うえ》から 10 かりて、1 かすと 9に なるよ。',
      figure: { kind: 'text', text: '1004 − 268: 1004 → 9 9 14 と かりる', size: 'm' },
    },
    {
      id: 'wrong-op',
      explain:
        'たし算《ざん》と ひき算《ざん》を とりちがえたのかな。「あわせて」「ふえると」は たし算《ざん》、「のこり」「ちがい」は ひき算《ざん》だよ。',
    },
  ],
  levels: [
    { label: 'くり上がり・くり下がり 1回', chance: 0.01 },
    { label: 'くり上がり 2回いじょう', chance: 0.01 },
    { label: '0をこえる くり下がり', chance: 0.01 },
    { label: '文章題', chance: 0.01 },
  ],
  intro: [
    {
      text: '365 ＋ 278 を 筆算《ひっさん》で します。くらいを たてに そろえて 書《か》きます。',
      figure: columnFigure(365, 278, '＋', 3),
    },
    {
      text: '一《いち》のくらい 5 ＋ 8 ＝ 13。3を 書《か》いて 1 くり上《あ》げ。十《じゅう》のくらい 1 ＋ 6 ＋ 7 ＝ 14。4を 書《か》いて 1 くり上《あ》げ。百《ひゃく》のくらい 1 ＋ 3 ＋ 2 ＝ 6。答《こた》えは 643。',
      figure: { kind: 'text', text: '365 ＋ 278 ＝ 643', size: 'xl' },
    },
    {
      text: '403 − 158 は、一《いち》のくらいの 3から 8が ひけません。十《じゅう》のくらいは 0なので、百《ひゃく》のくらいから かります。4 → 3、0 → 10 → 9、3 → 13。',
      figure: columnFigure(403, 158, '−', 3),
    },
    {
      text: '13 − 8 ＝ 5、9 − 5 ＝ 4、3 − 1 ＝ 2。答《こた》えは 245。たしかめ: 245 ＋ 158 ＝ 403。',
      figure: { kind: 'text', text: '403 − 158 ＝ 245', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateAddSubColumn(level, rng, index),
  },
  review: 'type',
  basis: '小学校学習指導要領（平成29年告示）算数 第3学年 A(2) 加法・減法（3位数や4位数の加法・減法の筆算）',
  revised: '2026-10-24',
};
