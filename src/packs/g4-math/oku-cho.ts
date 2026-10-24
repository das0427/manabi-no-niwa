/**
 * g4.math.oku-cho 億・兆（大きな数のしくみ）（curriculum-matrix 3.7）。
 * 位の表を億・兆へ → 読む・書く → 10倍・100倍・10でわる。
 *
 * 同一性キー: 問う形 × 数（× 問う位・倍の種類）。読む（数字 → 漢数字）と書く（漢数字 → 数字）は別の問題。
 * 数は「上の位から 2〜4こ の数字が 0 でない」形を定義域から均等に作る（読み書きの学習に意味のある数）。
 * 数字の入力は 12けたまで（数字キーの欄の上限）なので、兆の位を含む数は「選ぶ」か「□兆□億」の欄で答える。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { NumberlineItem } from '../../engines/numberline/numberline';
import type { ChoiceItem, Item, NumberField, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, opts, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'read' | 'write' | 'place' | 'times';

const DIGIT_READ = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const DIGIT_KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const GROUP = ['', '万《まん》', '億《おく》', '兆《ちょう》'];

const dk = (d: number, r = DIGIT_READ[d]!) => `${DIGIT_KANJI[d]}《${r}》`;

/** 0〜9999 の1つの組を漢数字（1字ずつ《よみ》）に。groupIdx: 0 一, 1 万, 2 億, 3 兆 */
function groupKanji(g: number, groupIdx: number): string {
  const th = Math.floor(g / 1000);
  const h = Math.floor(g / 100) % 10;
  const t = Math.floor(g / 10) % 10;
  const o = g % 10;
  const cho = groupIdx === 3;
  let s = '';
  if (th) s += th === 1 ? '千《せん》' : th === 3 ? `${dk(3)}千《ぜん》` : th === 8 ? `${dk(8, 'はっ')}千《せん》` : `${dk(th)}千《せん》`;
  if (h)
    s +=
      h === 1
        ? '百《ひゃく》'
        : h === 3
          ? `${dk(3)}百《びゃく》`
          : h === 6
            ? `${dk(6, 'ろっ')}百《ぴゃく》`
            : h === 8
              ? `${dk(8, 'はっ')}百《ぴゃく》`
              : `${dk(h)}百《ひゃく》`;
  if (t) {
    const ten = cho && o === 0 ? '十《じゅっ》' : '十《じゅう》';
    s += t === 1 ? ten : `${dk(t)}${ten}`;
  }
  if (o) s += cho && (o === 1 || o === 8) ? dk(o, o === 1 ? 'いっ' : 'はっ') : dk(o);
  return s + GROUP[groupIdx]!;
}

/** 数を漢数字に（1兆未満は BigInt を使わずに足りる。1京未満） */
export function kanjiNumber(n: number): string {
  if (n === 0) return '〇《ゼロ》';
  const groups: number[] = [];
  let x = n;
  for (let i = 0; i < 4; i++) {
    groups.push(x % 10000);
    x = Math.floor(x / 10000);
  }
  let s = '';
  for (let i = 3; i >= 0; i--) if (groups[i]) s += groupKanji(groups[i]!, i);
  return s;
}

/** 位の名前（p: 0 = 一の位） */
const PLACE_NAME = [
  '一《いち》',
  '十《じゅう》',
  '百《ひゃく》',
  '千《せん》',
  '一万《いちまん》',
  '十万《じゅうまん》',
  '百万《ひゃくまん》',
  '千万《せんまん》',
  '一億《いちおく》',
  '十億《じゅうおく》',
  '百億《ひゃくおく》',
  '千億《せんおく》',
  '一兆《いっちょう》',
  '十兆《じゅうちょう》',
  '百兆《ひゃくちょう》',
  '千兆《せんちょう》',
];
const placeName = (p: number) => `${PLACE_NAME[p]}の 位《くらい》`;

/** 上の位から数字を置いた数（定義域から均等に）。digits: けた数 */
function sparseNumber(rng: Rng, digits: number): number {
  const top = rng.int(1, 9);
  let n = top * 10 ** (digits - 1);
  // 上から2〜8けた目のうち 1〜3か所に 0 でない数字（同じ位を2回選ばない）
  const pos = rng.sample([1, 2, 3, 4, 5, 6, 7].filter((k) => k < digits), rng.int(1, 3));
  for (const k of pos) n += rng.int(1, 9) * 10 ** (digits - 1 - k);
  return n;
}

const digitAt = (n: number, p: number) => Math.floor(n / 10 ** p) % 10;
const okNum = (n: number) => Number.isInteger(n) && n >= 1 && n < 1e15;

/** 位の表（4けたごとの区切りが見える）: 上の組から */
function placeTable(n: number): Figure {
  const s = String(n);
  const len = s.length;
  const header = s.split('').map((_, i) => PLACE_NAME[len - 1 - i]!);
  return { kind: 'table', header, rows: [s.split('')] };
}

/** 読む: 数字 → 漢数字を選ぶ（alt: 漢数字 → 数字を選ぶ） */
function read(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const digits = level === 0 ? rng.int(9, 12) : rng.int(13, 14);
  const n = sparseNumber(rng, digits);
  const wrongNums: [number, string][] = [
    [n / 10000, 'group-shift'],
    [n * 10, 'zero-count'],
    [n / 10, 'zero-count'],
    [n * 10000, 'group-shift'],
  ];
  const ws = wrongNums.filter(([v]) => okNum(v));
  const show = (v: number) => (alt ? String(v) : kanjiNumber(v));
  return {
    engine: 'choice',
    id: `read${alt ? '-alt' : ''}:${n}`,
    objective: 'read',
    level,
    prompt: alt
      ? 'この 数《かず》を 数字《すうじ》で 書《か》いた ものは どれ？'
      : 'この 数《かず》の 読《よ》み方《かた》は どれ？',
    figure: alt ? { kind: 'text', text: kanjiNumber(n), size: 'l' } : expr(String(n)),
    hints: [
      alt
        ? '「兆《ちょう》」「億《おく》」「万《まん》」の ところで 4けたずつ 区切《くぎ》って 考《かんが》えよう。'
        : '一《いち》の 位《くらい》から 4けたずつ 区切《くぎ》ろう。',
      alt
        ? `「億《おく》」の 下《した》には 8けた（万《まん》の 組《くみ》と 一《いち》の 組《くみ》）が つづくよ。`
        : `右《みぎ》から 4けたで 万《まん》、8けたで 億《おく》、12けたで 兆《ちょう》だよ。`,
      `この 数《かず》は ${String(n).length}けた。いちばん 上《うえ》の 位《くらい》は ${placeName(String(n).length - 1)}。`,
    ],
    explain: `${String(n)} は ${kanjiNumber(n)} と 読《よ》みます。4けたずつ 区切《くぎ》ると 読《よ》みやすく なります。`,
    explainFigure: placeTable(n),
    identity: `read${alt ? '-rev' : ''}:${n}`,
    alt,
    options: opts(
      show(n),
      ws.map(([v, m]) => [show(v), m]),
    ),
  };
}

/** 書く: 漢数字 → 数字を入れる（alt: 1億が□こと 1万が□こ） */
function write(level: number, rng: Rng, alt: boolean): NumberItem {
  // 数字キーの欄は12けたまで
  const digits = level === 0 ? rng.int(9, 11) : rng.int(10, 12);
  const n = sparseNumber(rng, digits);
  const ans = [{ kind: 'int' as const, value: n }];
  const oku = Math.floor(n / 1e8);
  const man = Math.floor((n % 1e8) / 1e4);
  const ichi = n % 1e4;
  const parts = [
    oku ? `1億《おく》を ${oku}こ` : '',
    man ? `1万《まん》を ${man}こ` : '',
    ichi ? `1を ${ichi}こ` : '',
  ].filter((x) => x);
  return {
    engine: 'number',
    id: `write${alt ? '-alt' : ''}:${n}`,
    objective: 'write',
    level,
    prompt: alt
      ? `${parts.join('、')} あわせた 数《かず》を 数字《すうじ》で 書《か》こう。`
      : 'この 数《かず》を 数字《すうじ》で 書《か》こう。',
    figure: alt ? undefined : { kind: 'text', text: kanjiNumber(n), size: 'l' },
    hints: [
      '億《おく》・万《まん》・一《いち》の 組《くみ》に 分《わ》けて 考《かんが》えよう。',
      '万《まん》の 組《くみ》と 一《いち》の 組《くみ》は、それぞれ 4けた。数字《すうじ》が ない 位《くらい》には 0 を 書《か》くよ。',
      `億《おく》の 組《くみ》は ${oku}。その 後《あと》に 4けた、さらに 4けた つづくよ。`,
    ],
    explain: `${kanjiNumber(n)} は ${n}。億《おく》の 下《した》に 8けた つづきます。`,
    explainFigure: placeTable(n),
    identity: `write${alt ? '-compose' : ''}:${n}`,
    alt,
    fields: [{ answer: ans[0]! }],
    wrongAnswers: wrongList(ans, [
      [n / 10, 'zero-count'],
      [n % 1e4 === 0 ? n / 1e4 : null, 'group-shift'],
      [n * 10 < 1e12 ? n * 10 : null, 'zero-count'],
      // 組の中の 0 を書かずに つめた（例 3億500万 → 35000000）
      [Number(`${oku}${man || ''}${String(ichi).padStart(4, '0')}`), 'zero-count'],
    ]),
  };
}

/** 位: その位の数字を答える（alt: 数直線の目盛りを読む） */
function place(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const lines = [
      { max: 10, minor: 1, u: '億《おく》', end: '10億《おく》' },
      { max: 100, minor: 10, u: '億《おく》', end: '100億《おく》' },
      { max: 10000, minor: 1000, u: '億《おく》', end: '1兆《ちょう》' },
      { max: 10, minor: 1, u: '兆《ちょう》', end: '10兆《ちょう》' },
    ];
    const L = pick(rng, lines);
    let k = rng.int(1, 9);
    if (k === 5) k = rng.int(6, 9);
    const at = k * L.minor;
    const item: NumberlineItem = {
      engine: 'numberline',
      id: `place-alt:${L.end}:${at}`,
      objective: 'place',
      level,
      prompt: `↓の めもりが あらわす 数《かず》は いくつ？（${L.u}の いくつ分《ぶん》で 答《こた》えよう）`,
      hints: [
        `0から ${L.end}までが 10こに 分《わ》けて あるよ。`,
        `1めもりは ${L.minor}${L.u}。`,
        `0から ${k}めもり 進《すす》んだ ところだよ。`,
      ],
      explain: `1めもりが ${L.minor}${L.u}なので、${k}めもりで ${at}${L.u}です。`,
      identity: `place-line:${L.end}:${at}`,
      alt: true,
      line: { min: 0, max: L.max, minor: L.minor, majorEvery: 5, labels: [] },
      marks: [
        { at: 0, label: '0' },
        { at: L.max, label: L.end },
      ],
      task: { kind: 'read', at, unit: L.u },
      misconceptions: L.minor === 1 ? {} : { minorAsOne: 'scale-one' },
    };
    return item;
  }
  const digits = level === 0 ? rng.int(9, 12) : rng.int(13, 15);
  // どの位も 0 でない数を使う（0 の位を問うと、まちがいの理由が分からない）
  let n = 0;
  for (let i = 0; i < digits; i++) n = n * 10 + rng.int(1, 9);
  const p = rng.int(Math.max(4, digits - 8), digits - 1);
  const ans = [{ kind: 'int' as const, value: digitAt(n, p) }];
  return {
    engine: 'number',
    id: `place:${n}:${p}`,
    objective: 'place',
    level,
    prompt: `${placeName(p)}の 数字《すうじ》は なに？`,
    figure: expr(String(n)),
    hints: [
      '一《いち》の 位《くらい》から 4けたずつ 区切《くぎ》ろう。',
      p >= 12
        ? '右《みぎ》から 13けた目《め》が 一兆《いっちょう》の 位《くらい》。'
        : p >= 8
          ? '右《みぎ》から 9けた目《め》が 一億《いちおく》の 位《くらい》。'
          : '右《みぎ》から 5けた目《め》が 一万《いちまん》の 位《くらい》。',
      `右《みぎ》から ${p + 1}けた目《め》の 数字《すうじ》だよ。`,
    ],
    explain: `${placeName(p)}は 右《みぎ》から ${p + 1}けた目《め》。数字《すうじ》は ${digitAt(n, p)} です。`,
    explainFigure: placeTable(n),
    identity: `place:${n}:${p}`,
    alt: false,
    fields: [{ answer: ans[0]! }],
    wrongAnswers: wrongList(ans, [
      [digitAt(n, p - 1), 'place-name'],
      [p + 1 < digits ? digitAt(n, p + 1) : null, 'place-name'],
      [digitAt(n, digits - 1 - p), 'place-from-left'],
    ]),
  };
}

const UNITS = [
  { small: '万《まん》', big: '億《おく》' },
  { small: '億《おく》', big: '兆《ちょう》' },
];

/** 値 r（small の単位で）を欄に。1万以上なら big と small の2欄 */
function unitFields(r: number, u: { small: string; big: string }): { fields: NumberField[]; text: string } {
  if (r >= 10000) {
    const b = Math.floor(r / 10000);
    const s = r % 10000;
    if (s === 0)
      return { fields: [{ label: u.big, answer: { kind: 'int', value: b } }], text: `${b}${u.big}` };
    return {
      fields: [
        { label: u.big, answer: { kind: 'int', value: b } },
        { label: u.small, answer: { kind: 'int', value: s } },
      ],
      text: `${b}${u.big}${s}${u.small}`,
    };
  }
  return { fields: [{ label: u.small, answer: { kind: 'int', value: r } }], text: `${r}${u.small}` };
}

/** 答えの欄の形に合わせた誤答の文字列 */
function asFields(c: number, nf: number, bigOnly: boolean): string | null {
  if (!Number.isInteger(c) || c <= 0) return null;
  if (nf === 1) return bigOnly ? (c % 10000 === 0 ? String(c / 10000) : null) : String(c);
  return `${Math.floor(c / 10000)}|${c % 10000}`;
}

/** 10倍・100倍・10でわる（alt: 10倍すると〇〇になる数） */
function times(level: number, rng: Rng, alt: boolean): NumberItem {
  const u = pick(rng, UNITS);
  const op = pick(rng, ['x10', 'x100', 'd10'] as const);
  // m: small の単位でいくつ（10でわるときは 10の倍数）
  let m = rng.int(1, 99) * (rng.next() < 0.5 ? 1 : 10) * (op === 'd10' ? 10 : 1);
  if (op === 'd10' && m > 9990) m = 9990;
  const r = op === 'x10' ? m * 10 : op === 'x100' ? m * 100 : m / 10;
  const opDid = op === 'x10' ? '10倍《ばい》した' : op === 'x100' ? '100倍《ばい》した' : '10で わった';
  const opDo = op === 'x10' ? '10倍《ばい》すると' : op === 'x100' ? '100倍《ばい》すると' : '10で わると';
  const shift = op === 'd10' ? '右《みぎ》に 1けた' : op === 'x10' ? '左《ひだり》に 1けた' : '左《ひだり》に 2けた';
  const back = op === 'd10' ? '左《ひだり》に 1けた' : op === 'x10' ? '右《みぎ》に 1けた' : '右《みぎ》に 2けた';
  const base = unitFields(m, u);
  const res = unitFields(r, u);
  // alt: 結果から元の数を求める（逆向き）
  const want = alt ? base : res;
  const given = alt ? res : base;
  const nf = want.fields.length;
  const bigOnly = nf === 1 && want.fields[0]!.label === u.big;
  const answers = want.fields.map((f) => f.answer);
  const cands: [string | null, string][] = alt
    ? [
        [asFields(op === 'd10' ? r / 10 : r * 10, nf, bigOnly), 'times-reverse'],
        [asFields(op === 'x10' ? r / 100 : op === 'x100' ? r / 10 : r * 100, nf, bigOnly), 'zero-count'],
      ]
    : [
        [asFields(op === 'd10' ? m * 10 : m / 10, nf, bigOnly), 'times-reverse'],
        [asFields(op === 'x10' ? m * 100 : op === 'x100' ? m * 10 : m / 100, nf, bigOnly), 'zero-count'],
      ];
  return {
    engine: 'number',
    id: `times${alt ? '-alt' : ''}:${u.small}:${op}:${m}`,
    objective: 'times',
    level,
    prompt: alt
      ? `ある 数《かず》を ${opDid}ら、${given.text}に なりました。ある 数《かず》は？`
      : `${given.text}を ${opDid} 数《かず》は？`,
    hints: [
      op === 'd10'
        ? '10で わると、位《くらい》が 1つ 下《さ》がるよ。'
        : `${opDo}、位《くらい》が ${op === 'x10' ? '1つ' : '2つ'} 上《あ》がるよ。`,
      alt
        ? '答《こた》えから もどす ときは、反対《はんたい》の 計算《けいさん》を しよう。'
        : '1万《まん》が 10000こで 1億《おく》、1億《おく》が 10000こで 1兆《ちょう》だよ。',
      `${given.text}の 数字《すうじ》を 位《くらい》の 表《ひょう》に 書《か》いて、${alt ? back : shift} ずらそう。`,
    ],
    explain: alt
      ? `${base.text}を ${opDo} ${res.text}。だから ある 数《かず》は ${base.text}です。`
      : `${base.text}を ${opDo} ${res.text}です。`,
    identity: `times${alt ? '-inv' : ''}:${u.small}:${op}:${m}`,
    alt,
    fields: want.fields,
    wrongAnswers: wrongList(
      answers,
      cands.map(([v, mm]) => [v, mm]),
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['read', 'write', 'place'] },
  { objs: ['read', 'write', 'place'] },
  { objs: ['times', 'read', 'write', 'place'] },
];

export function generateOkuCho(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  const lvForNum = level === 2 ? rng.int(0, 1) : level;
  switch (obj) {
    case 'read':
      return { ...read(lvForNum, rng, alt), level };
    case 'write':
      return { ...write(lvForNum, rng, alt), level };
    case 'place':
      return { ...place(lvForNum, rng, alt), level } as Item;
    case 'times':
      return times(level, rng, alt);
  }
}

export const okuCho: UnitSpec = {
  id: 'g4.math.oku-cho',
  title: '億《おく》と 兆《ちょう》（大《おお》きな 数《かず》）',
  stage: 'g4',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-sansu',
  prereq: ['g3.math.large-numbers'],
  objectives: [
    { id: 'read', title: '億《おく》・兆《ちょう》の 数《かず》を 読《よ》む' },
    { id: 'write', title: '数字《すうじ》で 書《か》く' },
    { id: 'place', title: '位《くらい》と めもり' },
    { id: 'times', title: '10倍《ばい》・100倍《ばい》・10で わった 数《かず》' },
  ],
  misconceptions: [
    {
      id: 'zero-count',
      explain:
        '0の 数《かず》が 1つ ずれたのかな。一《いち》の 位《くらい》から 4けたずつ 区切《くぎ》って、数字《すうじ》が ない 位《くらい》には 0 を 書《か》こう。',
    },
    {
      id: 'group-shift',
      explain:
        '万《まん》・億《おく》・兆《ちょう》の 区切《くぎ》りを 1つ まちがえたのかな。万《まん》の 10000倍《ばい》が 億《おく》、億《おく》の 10000倍《ばい》が 兆《ちょう》 だよ。',
    },
    {
      id: 'place-name',
      explain: 'となりの 位《くらい》を 見《み》たのかな。一《いち》の 位《くらい》から 指《ゆび》で 1つずつ 数《かぞ》えて みよう。',
    },
    {
      id: 'place-from-left',
      explain: '左《ひだり》から 数《かぞ》えたのかな。位《くらい》は 右《みぎ》の 一《いち》の 位《くらい》から 数《かぞ》えるよ。',
    },
    {
      id: 'times-reverse',
      explain:
        '10倍《ばい》と 10で わるを 反対《はんたい》に したのかな。10倍《ばい》すると 数《かず》は 大《おお》きく、10で わると 小《ちい》さく なるよ。',
    },
    {
      id: 'scale-one',
      explain: '1めもりを 1と 考《かんが》えたのかな。0から はしまでを いくつに 分《わ》けて いるか 見《み》て、1めもりの 大《おお》きさを 考《かんが》えよう。',
    },
  ],
  levels: [
    { label: '億《おく》まで', chance: 0.1 },
    { label: '兆《ちょう》まで', chance: 0.1 },
    { label: '10倍《ばい》・10で わる', chance: 0.1 },
  ],
  intro: [
    {
      text: '一万《いちまん》を 10000こ 集《あつ》めた 数《かず》を 一億《いちおく》と いい、100000000 と 書《か》きます。',
      figure: placeTable(100000000),
    },
    {
      text: '一億《いちおく》を 10000こ 集《あつ》めた 数《かず》が 一兆《いっちょう》です。0が 12こ つきます。',
      figure: expr('1000000000000'),
    },
    {
      text: '大《おお》きな 数《かず》は、一《いち》の 位《くらい》から 4けたずつ 区切《くぎ》ると 読《よ》みやすく なります。',
      figure: placeTable(350020000),
    },
    {
      text: '10倍《ばい》すると 位《くらい》が 1つ 上《あ》がり、10で わると 位《くらい》が 1つ 下《さ》がります。',
      figure: expr('3億《おく》 × 10 ＝ 30億《おく》'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateOkuCho(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第4学年 A(1) 整数の表し方（億・兆の単位、十進位取り記数法）',
  revised: REVISED,
};
