/**
 * g4.math.rounding がい数（四捨五入・切り上げ・切り捨て、以上・以下・未満）と見積もり（curriculum-matrix 3.7）。
 * 数直線でどちらに近いか → 四捨五入 → 和や積の見積もり。
 *
 * 問題文には「何の位までの」「上から何けたの」「〇の位を四捨五入して」を必ず書き、四捨五入・切り上げ・切り捨てを区別する。
 * 同一性キー: 問う形 × 数 × がい数にする位（× 方法）。場面の文章題は 場面 × 数。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, finishUnit, opts, pick, pickObj, placeLabel, REVISED, wrongList } from './util';

type Obj = 'place' | 'digits' | 'method' | 'range' | 'estimate';
type Method = 'round' | 'up' | 'down';

const METHOD_NAME: Record<Method, string> = {
  round: '四捨五入《ししゃごにゅう》',
  up: '切《き》り上《あ》げ',
  down: '切《き》り捨《す》て',
};

export function roundTo(n: number, unit: number, m: Method = 'round'): number {
  if (m === 'up') return Math.ceil(n / unit) * unit;
  if (m === 'down') return Math.floor(n / unit) * unit;
  return Math.floor((n + unit / 2) / unit) * unit;
}

/** 位 p（10^p）で区切った がい数にする数。下の位が すべて0の数（すでにがい数）は使わない */
function numberWith(rng: Rng, digits: number, p: number): number {
  for (;;) {
    const n = rng.int(10 ** (digits - 1), 10 ** digits - 1);
    if (n % 10 ** p !== 0) return n;
  }
}

const digitAt = (n: number, p: number) => Math.floor(n / 10 ** p) % 10;
const len = (n: number) => String(n).length;

/** 「百の位までの」（look=false）／「十の位を四捨五入して」（look=true） */
function placePhrase(n: number, p: number, look: boolean): string {
  return look
    ? `${n}の ${placeLabel(p - 1)}を 四捨五入して、がい数に しよう。`
    : `${n}を 四捨五入して、${placeLabel(p)}までの がい数に しよう。`;
}

/** 位までの がい数（四捨五入）。alt: 数直線で どちらに 近いか */
function place(level: number, rng: Rng, alt: boolean): Item {
  const digits = level === 0 ? 4 : rng.int(4, 6);
  const p = rng.int(1, digits - 2); // 十〜（上から2けた目）の位まで
  const n = numberWith(rng, digits, p);
  const U = 10 ** p;
  const ans = roundTo(n, U);
  const lo = roundTo(n, U, 'down');
  const hi = lo + U;
  if (alt) {
    const item: ChoiceItem = {
      engine: 'choice',
      id: `place-alt:${n}:${p}`,
      objective: 'place',
      level,
      prompt: `${n}を ${placeLabel(p)}までの がい数《すう》に します。数直線《すうちょくせん》で ${lo}と ${hi}の どちらに 近《ちか》い？`,
      figure: {
        kind: 'numberline',
        min: lo,
        max: hi,
        step: U / 10,
        labelEvery: 5,
        marks: [{ at: n, label: String(n), tone: 'focus' }],
      },
      hints: [
        `${lo}と ${hi}の まん中《なか》は ${lo + U / 2}。`,
        `${n}は まん中より 大《おお》きいかな、小《ちい》さいかな。`,
        `${placeLabel(p - 1)}の 数字《すうじ》は ${digitAt(n, p - 1)}。5より 小さいか 考《かんが》えよう。`,
      ],
      explain: `${n}は ${ans === hi ? 'まん中《なか》か、まん中より 右《みぎ》' : 'まん中《なか》より 左《ひだり》'}に あるので ${ans}に 近《ちか》い。${placeLabel(p - 1)}が ${digitAt(n, p - 1)}なので、四捨五入《ししゃごにゅう》すると ${ans}です。`,
      identity: `place-line:${n}:${p}`,
      alt: true,
      options: opts(String(ans), [
        [String(ans === hi ? lo : hi), 'cut-only'],
        [String(roundTo(n, U / 10)), 'wrong-place'],
      ]),
    };
    return item;
  }
  const look = rng.next() < 0.4;
  const answers = [{ kind: 'int' as const, value: ans }];
  const item: NumberItem = {
    engine: 'number',
    id: `place:${n}:${p}:${look ? 'look' : 'to'}`,
    objective: 'place',
    level,
    prompt: placePhrase(n, p, look),
    figure: expr(String(n)),
    hints: [
      `${placeLabel(p)}までの がい数《すう》に するので、${placeLabel(p - 1)}の 数字《すうじ》を 見《み》るよ。`,
      `${placeLabel(p - 1)}の 数字は ${digitAt(n, p - 1)}。0〜4なら 切《き》り捨《す》て、5〜9なら 切り上《あ》げ。`,
      `${placeLabel(p)}より 下《した》の 位は ぜんぶ 0に するよ。${lo}か ${hi}の どちらかに なるね。`,
    ],
    explain: `${placeLabel(p - 1)}が ${digitAt(n, p - 1)}なので ${ans === hi ? '切《き》り上《あ》げて' : '切《き》り捨《す》てて'} ${ans}。（${lo} 〜 ${hi}の うち 近《ちか》い ほう）`,
    identity: `place:${n}:${p}`,
    alt: false,
    fields: [{ label: '約《やく》', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [ans === hi ? lo : hi, 'cut-only'],
      [roundTo(n, U * 10), 'wrong-place'],
      [roundTo(n, U / 10), 'wrong-place'],
      [ans / U, 'drop-zeros'],
    ]),
  };
  return item;
}

interface Scene {
  id: string;
  text: (n: number) => string;
  unit: string;
  ask: string;
}
const SCENES: Scene[] = [
  { id: 'town', text: (n) => `ある 町《まち》の 人口《じんこう》は ${n}人《にん》です。`, unit: '人《にん》', ask: '何人' },
  { id: 'zoo', text: (n) => `動物園《どうぶつえん》に 1年間《ねんかん》に 来《き》た 人《ひと》は ${n}人《にん》でした。`, unit: '人《にん》', ask: '何人' },
  { id: 'ball', text: (n) => `野球場《やきゅうじょう》に 来《き》た 人《ひと》は ${n}人《にん》でした。`, unit: '人《にん》', ask: '何人' },
  { id: 'library', text: (n) => `図書館《としょかん》に ある 本《ほん》は ${n}さつです。`, unit: 'さつ', ask: 'なんさつ' },
  { id: 'river', text: (n) => `ある 川《かわ》の 長《なが》さは ${n}mです。`, unit: 'm', ask: 'なんm' },
  { id: 'shop', text: (n) => `お店《みせ》の 1か月《げつ》の 売《う》り上《あ》げは ${n}円《えん》でした。`, unit: '円《えん》', ask: '何円' },
  { id: 'school', text: (n) => `ある 市《し》の 小学生《しょうがくせい》は ${n}人《にん》です。`, unit: '人《にん》', ask: '何人' },
  { id: 'bird', text: (n) => `池《いけ》に 来《き》た 鳥《とり》を 数《かぞ》えたら ${n}わ でした。`, unit: 'わ', ask: 'なんわ' },
];

/** 上から何けたの がい数（四捨五入）。alt: 場面の文 */
function digitsItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const digits = level === 0 ? rng.int(4, 5) : rng.int(5, 7);
  const d = rng.int(1, Math.min(3, digits - 2));
  const p = digits - d; // がい数にする位
  const n = numberWith(rng, digits, p);
  const U = 10 ** p;
  const ans = roundTo(n, U);
  const sc = alt ? pick(rng, SCENES) : null;
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `digits${alt ? `-alt:${sc!.id}` : ''}:${n}:${d}`,
    objective: 'digits',
    level,
    prompt: sc
      ? `${sc.text(n)} 四捨五入《ししゃごにゅう》して、上《うえ》から ${d}けたの がい数《すう》で 表《あらわ》すと 約《やく》 ${sc.ask}ですか。`
      : `${n}を 四捨五入《ししゃごにゅう》して、上《うえ》から ${d}けたの がい数《すう》に しよう。`,
    figure: sc ? undefined : expr(String(n)),
    hints: [
      `上《うえ》から ${d}けたの がい数《すう》に するので、上から ${d + 1}けた目《め》の 数字《すうじ》を 見《み》るよ。`,
      `上から ${d + 1}けた目は ${placeLabel(p - 1)}で、数字は ${digitAt(n, p - 1)}。`,
      `上から ${d}けたを のこして、その 下《した》は 0に するよ。${roundTo(n, U, 'down')}か ${roundTo(n, U, 'down') + U}の どちらかだね。`,
    ],
    explain: `上《うえ》から ${d + 1}けた目《め》（${placeLabel(p - 1)}）が ${digitAt(n, p - 1)}なので、四捨五入《ししゃごにゅう》して ${ans}${sc ? sc.unit : ''}です。`,
    identity: `digits${sc ? `:${sc.id}` : ''}:${n}:${d}`,
    alt,
    fields: [{ label: '約《やく》', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [roundTo(n, U, ans === roundTo(n, U, 'up') ? 'down' : 'up'), 'cut-only'],
      // 「上から dけた」を「下から（d けた目の位）」と考えた
      [roundTo(n, 10 ** d), 'from-bottom'],
      [roundTo(n, U * 10), 'wrong-place'],
      [roundTo(n, U / 10), 'wrong-place'],
      [ans / U, 'drop-zeros'],
    ]),
  };
}

interface MScene {
  id: string;
  text: string;
  method: Method;
}
const M_SCENES: MScene[] = [
  {
    id: 'bill',
    text: '3780円《えん》の 品物《しなもの》を 1000円さつ だけで はらいます。何円分の おさつを 出《だ》せば よいか 考《かんが》える とき',
    method: 'up',
  },
  {
    id: 'bundle',
    text: '紙《かみ》を 100まいずつ 束《たば》に します。2460まいで いくつの 束が できるか 考《かんが》える とき',
    method: 'down',
  },
  {
    id: 'box',
    text: 'みかんを 10こずつ 箱《はこ》に つめて 売《う》ります。375こで いくつの 箱が 売れるか 考《かんが》える とき',
    method: 'down',
  },
  {
    id: 'coin',
    text: '348円《えん》の ものを 10円玉だけで はらいます。たりるように 10円玉を 用意《ようい》する とき',
    method: 'up',
  },
  {
    id: 'graph',
    text: 'ぼうグラフに かくために、町《まち》の 人口《じんこう》を 千《せん》の 位《くらい》までの がい数《すう》に する とき',
    method: 'round',
  },
  {
    id: 'tape',
    text: '1m 25cmの テープから 10cmずつ 切《き》り分《わ》けます。10cmの テープが 何本 できるか 考《かんが》える とき',
    method: 'down',
  },
  {
    id: 'news',
    text: '新聞《しんぶん》で、お祭《まつ》りに 来《き》た 人《ひと》の 数《かず》を およその 数で 伝《つた》える とき',
    method: 'round',
  },
  {
    id: 'seat',
    text: '1つの 長《なが》いすに 10人《にん》 すわれます。134人が 全員《ぜんいん》 すわるのに いる 長いすの 数を 考《かんが》える とき',
    method: 'up',
  },
];

/** 切り上げ・切り捨て（alt: 場面に合う方法を選ぶ） */
function method(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const sc = pick(rng, M_SCENES);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `method-alt:${sc.id}`,
      objective: 'method',
      level,
      prompt: `${sc.text}、どの 方法《ほうほう》で がい数《すう》に するのが よい？`,
      hints: [
        '「たりなく なると こまる」のか、「ちょうどの まとまりだけ 数《かぞ》える」のか 考《かんが》えよう。',
        'たりないと こまる ときは 多《おお》めに、まとまりに ならない 分《ぶん》を 数えない ときは 少《すく》なめに するよ。',
        'およその 数を 知《し》らせる だけなら、近《ちか》い ほうに する 方法だね。',
      ],
      explain: `この 場面《ばめん》では ${METHOD_NAME[sc.method]}が よい。${
        sc.method === 'up'
          ? 'たりないと こまるので、下《した》の 位《くらい》が 0でなければ 上《うえ》の 位に 1 たします。'
          : sc.method === 'down'
            ? 'まとまりに ならない 分《ぶん》は 数《かぞ》えないので、下《した》の 位《くらい》を 0に します。'
            : 'およその 数を 伝《つた》えるので、近《ちか》い ほうに します。'
      }`,
      identity: `method-scene:${sc.id}`,
      alt: true,
      fixedOrder: true,
      options: (['round', 'up', 'down'] as Method[]).map((m) =>
        m === sc.method
          ? { label: METHOD_NAME[m], correct: true }
          : { label: METHOD_NAME[m], misconception: m === 'round' || sc.method === 'round' ? 'method-scene' : 'method-swap' },
      ),
    };
    return item;
  }
  const digits = rng.int(3, 5);
  const p = rng.int(1, digits - 1);
  const m: Method = rng.next() < 0.5 ? 'up' : 'down';
  const n = numberWith(rng, digits, p);
  const U = 10 ** p;
  const ans = roundTo(n, U, m);
  const answers = [{ kind: 'int' as const, value: ans }];
  const item: NumberItem = {
    engine: 'number',
    id: `method:${m}:${n}:${p}`,
    objective: 'method',
    level,
    prompt: `${n}を ${METHOD_NAME[m]}で ${placeLabel(p)}までの がい数《すう》に しよう。`,
    figure: expr(String(n)),
    hints: [
      m === 'up'
        ? '切《き》り上《あ》げは、下《した》の 位《くらい》が 0でなければ、がい数に する 位に 1 たす 方法《ほうほう》だよ。'
        : '切《き》り捨《す》ては、がい数に する 位《くらい》より 下《した》を ぜんぶ 0に する 方法《ほうほう》だよ。',
      `${placeLabel(p)}より 下《した》の 位は ${String(n).slice(-p)}。`,
      m === 'up'
        ? `${placeLabel(p)}の ${digitAt(n, p)}に 1 たして、下《した》の 位を 0に しよう。`
        : `${placeLabel(p)}より 下《した》を 0に すると…`,
    ],
    explain: `${METHOD_NAME[m]}で ${placeLabel(p)}までに すると ${ans}。${m === 'up' ? '下《した》の 位《くらい》に 0でない 数字《すうじ》が あるので、1 くり上《あ》げます。' : '下《した》の 位《くらい》は 見《み》ずに 0に します。'}`,
    identity: `method:${m}:${n}:${p}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [roundTo(n, U, m === 'up' ? 'down' : 'up'), 'method-swap'],
      [roundTo(n, U), 'method-swap'],
      [roundTo(n, U * 10, m), 'wrong-place'],
      [roundTo(n, U / 10, m), 'wrong-place'],
      [ans / U, 'drop-zeros'],
    ]),
  };
  return item;
}

/** 四捨五入して X になる整数の範囲（alt: X になる数を選ぶ） */
function range(level: number, rng: Rng, alt: boolean): Item {
  const p = rng.int(1, 3);
  const U = 10 ** p;
  const X = rng.int(2, 99) * U;
  const lo = X - U / 2;
  const hi = X + U / 2 - 1;
  if (alt) {
    const kind = rng.int(0, 2);
    const correct = kind === 0 ? lo : kind === 1 ? hi : rng.int(lo + 1, hi - 1);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `range-alt:${X}:${p}:${correct}`,
      objective: 'range',
      level,
      prompt: `四捨五入《ししゃごにゅう》して ${placeLabel(p)}までの がい数《すう》に すると ${X}に なる 数《かず》は どれ？`,
      figure: {
        kind: 'numberline',
        min: X - U,
        max: X + U,
        step: U / 10,
        labelEvery: 5,
        marks: [{ at: X, label: String(X), tone: 'focus' }],
      },
      hints: [
        `${placeLabel(p - 1)}を 四捨五入《ししゃごにゅう》するよ。`,
        `${X}より 小《ちい》さい ほうは、${placeLabel(p - 1)}が 5以上《いじょう》なら ${X}に なる。`,
        `${X}に なるのは ${lo}以上《いじょう》で、${X + U / 2}より 小さい 数だよ。`,
      ],
      explain: `${X}に なる 数は ${lo}以上《いじょう》 ${X + U / 2}未満《みまん》。${correct}は この はんいに 入《はい》ります。`,
      identity: `range-pick:${X}:${p}:${correct}`,
      alt: true,
      options: opts(String(correct), [
        [String(X + U / 2), 'boundary'],
        [String(lo - 1), 'boundary'],
        [String(X + U - 1), 'cut-only'],
      ]),
    };
    return item;
  }
  const answers = [
    { kind: 'int' as const, value: lo },
    { kind: 'int' as const, value: hi },
  ];
  const item: NumberItem = {
    engine: 'number',
    id: `range:${X}:${p}`,
    objective: 'range',
    level,
    prompt: `四捨五入《ししゃごにゅう》して ${placeLabel(p)}までの がい数《すう》に すると ${X}に なる 整数《せいすう》の うち、いちばん 小《ちい》さい 数と いちばん 大《おお》きい 数は？`,
    hints: [
      `${placeLabel(p - 1)}を 四捨五入《ししゃごにゅう》して ${X}に なる 数を 考《かんが》えよう。`,
      `${X - U}と ${X}の まん中《なか》は ${lo}。ここから 上《うえ》は ${X}に なるよ。`,
      `${X}と ${X + U}の まん中は ${X + U / 2}。この 数は ${X + U}に なるので、その 1つ 前《まえ》まで。`,
    ],
    explain: `${lo}以上《いじょう》 ${X + U / 2}未満《みまん》の 整数《せいすう》が ${X}に なります。いちばん 小さい 数は ${lo}、いちばん 大きい 数は ${hi}です。`,
    identity: `range:${X}:${p}`,
    alt: false,
    fields: [
      { label: 'いちばん 小《ちい》さい', answer: answers[0]! },
      { label: 'いちばん 大《おお》きい', answer: answers[1]! },
    ],
    wrongAnswers: wrongList(answers, [
      [`${lo}|${X + U / 2}`, 'boundary'],
      [`${lo + 1}|${hi}`, 'boundary'],
      [`${X}|${X + U - 1}`, 'cut-only'],
      [`${X - U + 1}|${X}`, 'cut-only'],
    ]),
  };
  return item;
}

interface EScene {
  id: string;
  op: 'mul' | 'add';
  text: (a: number, b: number, c: number) => string;
}
const E_SCENES: EScene[] = [
  { id: 'note', op: 'mul', text: (a, b) => `1さつ ${a}円《えん》の ノートを ${b}さつ 買《か》います。` },
  { id: 'trip', op: 'mul', text: (a, b) => `1人《にん》 ${a}円《えん》の 入館料《にゅうかんりょう》で、${b}人《にん》が 入《はい》ります。` },
  { id: 'flower', op: 'mul', text: (a, b) => `1たば ${a}円《えん》の 花《はな》を ${b}たば 買《か》います。` },
  { id: 'bus', op: 'mul', text: (a, b) => `1台《だい》 ${a}円《えん》の 道具《どうぐ》を ${b}台 そろえます。` },
  { id: 'lunch', op: 'add', text: (a, b, c) => `${a}円《えん》の べんとうと、${b}円の サラダと、${c}円の ジュースを 買《か》います。` },
  { id: 'stationery', op: 'add', text: (a, b, c) => `${a}円《えん》の 絵《え》の具《ぐ》と、${b}円の ふでと、${c}円の パレットを 買《か》います。` },
  { id: 'book', op: 'add', text: (a, b, c) => `${a}円《えん》の 本《ほん》と、${b}円の ノートと、${c}円の ペンを 買《か》います。` },
  { id: 'toy', op: 'add', text: (a, b, c) => `${a}円《えん》の ボールと、${b}円の なわとびと、${c}円の ぼうしを 買《か》います。` },
];

const top1 = (n: number) => roundTo(n, 10 ** (len(n) - 1));

/** 和・積の見積もり（alt: 場面で およその 代金を 選ぶ） */
function estimate(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const sc = pick(rng, E_SCENES);
    if (sc.op === 'mul') {
      const a = numberWith(rng, 3, 2);
      const b = numberWith(rng, 2, 1);
      const est = top1(a) * top1(b);
      const item: ChoiceItem = {
        engine: 'choice',
        id: `estimate-alt:${sc.id}:${a}x${b}`,
        objective: 'estimate',
        level,
        prompt: `${sc.text(a, b, 0)} 代金《だいきん》は 約《やく》 何円《なんえん》ですか。（それぞれ 上《うえ》から 1けたの がい数《すう》に して 見積《みつ》もろう）`,
        hints: [
          `${a}と ${b}を、それぞれ 上《うえ》から 1けたの がい数《すう》に しよう。`,
          `${a}は 約《やく》 ${top1(a)}、${b}は 約 ${top1(b)}。`,
          `${top1(a)} × ${top1(b)}を 計算《けいさん》しよう。`,
        ],
        explain: `${top1(a)} × ${top1(b)} ＝ ${est}。代金《だいきん》は 約《やく》 ${est}円《えん》です。見積《みつ》もりは くわしい 計算を しなくても、およその 大《おお》きさが わかります。`,
        identity: `estimate-scene:${sc.id}:${a}x${b}`,
        alt: true,
        options: opts(String(est), [
          [String(a * b), 'estimate-exact'],
          [String(roundTo(a, 100, 'down') * roundTo(b, 10, 'down')), 'cut-only'],
          [String(est * 10), 'wrong-place'],
        ]),
      };
      return item;
    }
    const xs = [numberWith(rng, 3, 2), numberWith(rng, 3, 2), numberWith(rng, 3, 2)];
    const est = xs.reduce((s, x) => s + roundTo(x, 100), 0);
    const exact = xs.reduce((s, x) => s + x, 0);
    const down = xs.reduce((s, x) => s + roundTo(x, 100, 'down'), 0);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `estimate-alt:${sc.id}:${xs.join('+')}`,
      objective: 'estimate',
      level,
      prompt: `${sc.text(xs[0]!, xs[1]!, xs[2]!)} 代金《だいきん》は 約《やく》 何円《なんえん》ですか。（それぞれ 百《ひゃく》の 位《くらい》までの がい数《すう》に して 見積《みつ》もろう）`,
      hints: [
        'それぞれの ねだんを 百《ひゃく》の 位《くらい》までの がい数《すう》に しよう。',
        `${xs[0]}は 約《やく》 ${roundTo(xs[0]!, 100)}。のこりも 同《おな》じように。`,
        `${xs.map((x) => roundTo(x, 100)).join(' ＋ ')}を 計算《けいさん》しよう。`,
      ],
      explain: `${xs.map((x) => roundTo(x, 100)).join(' ＋ ')} ＝ ${est}。代金《だいきん》は 約《やく》 ${est}円《えん》です。`,
      identity: `estimate-scene:${sc.id}:${xs.join('+')}`,
      alt: true,
      options: opts(String(est), [
        [String(exact), 'estimate-exact'],
        [String(down), 'cut-only'],
        [String(est + 1000), 'wrong-place'],
      ]),
    };
    return item;
  }
  const kind = pick(rng, ['add', 'sub', 'mul', 'div'] as const);
  let a: number;
  let b: number;
  let text: string;
  let est: number;
  let exact: number;
  let how: string;
  let ra: number;
  let rb: number;
  if (kind === 'add' || kind === 'sub') {
    a = numberWith(rng, 4, 2);
    b = numberWith(rng, rng.int(3, 4), 2);
    if (kind === 'sub' && b >= a) [a, b] = [b + 1000, a];
    ra = roundTo(a, 100);
    rb = roundTo(b, 100);
    est = kind === 'add' ? ra + rb : ra - rb;
    exact = kind === 'add' ? a + b : a - b;
    how = '百《ひゃく》の 位《くらい》までの がい数《すう》';
    text = `${a} ${kind === 'add' ? '＋' : '−'} ${b}`;
  } else if (kind === 'mul') {
    a = numberWith(rng, 3, 2);
    b = numberWith(rng, 2, 1);
    ra = top1(a);
    rb = top1(b);
    est = ra * rb;
    exact = a * b;
    how = '上《うえ》から 1けたの がい数《すう》';
    text = `${a} × ${b}`;
  } else {
    // わり算: わられる数を上から1けた、わる数を上から1けた（わりきれる組を選ぶ）
    for (;;) {
      rb = rng.int(2, 9) * 10;
      const q = rng.int(2, 9) * (rng.next() < 0.5 ? 10 : 100);
      ra = rb * q;
      if (len(ra) > 1 && top1(ra) === ra) break;
    }
    a = ra + rng.int(-(10 ** (len(ra) - 1)) / 2 + 1, 10 ** (len(ra) - 1) / 2 - 1);
    b = rb + rng.int(-4, 4);
    if (a % 10 ** (len(a) - 1) === 0) a += 7;
    if (b % 10 === 0) b += 1;
    ra = top1(a);
    rb = top1(b);
    est = ra / rb;
    exact = Math.floor(a / b);
    how = '上《うえ》から 1けたの がい数《すう》';
    text = `${a} ÷ ${b}`;
  }
  const answers = [{ kind: 'int' as const, value: est }];
  const sym = kind === 'add' ? '＋' : kind === 'sub' ? '−' : kind === 'mul' ? '×' : '÷';
  const item: NumberItem = {
    engine: 'number',
    id: `estimate:${text}`,
    objective: 'estimate',
    level,
    prompt: `それぞれの 数《かず》を 四捨五入《ししゃごにゅう》で ${how}に して、答《こた》えを 見積《みつ》もろう。`,
    figure: expr(text),
    hints: [
      `まず ${a}と ${b}を ${how}に しよう。`,
      `${a}は 約《やく》 ${ra}、${b}は 約 ${rb}。`,
      `${ra} ${sym} ${rb}を 計算《けいさん》しよう。`,
    ],
    explain: `${ra} ${sym} ${rb} ＝ ${est}。見積《みつ》もりは 約《やく》 ${est}です。`,
    identity: `estimate:${text}`,
    alt: false,
    fields: [{ label: '約《やく》', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [exact, 'estimate-exact'],
      [
        kind === 'add'
          ? roundTo(a, 100, 'down') + roundTo(b, 100, 'down')
          : kind === 'mul'
            ? roundTo(a, 10 ** (len(a) - 1), 'down') * roundTo(b, 10 ** (len(b) - 1), 'down')
            : null,
        'cut-only',
      ],
      [kind === 'mul' || kind === 'div' ? null : roundTo(a, 1000) + (kind === 'add' ? 1 : -1) * roundTo(b, 1000), 'wrong-place'],
    ]),
  };
  return item;
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['place', 'digits'] },
  { objs: ['place', 'digits', 'method'] },
  { objs: ['range', 'method', 'estimate'] },
  { objs: ['place', 'digits', 'method', 'range', 'estimate'] },
];

export function generateRounding(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'place':
      return place(level, rng, alt);
    case 'digits':
      return digitsItem(level, rng, alt);
    case 'method':
      return method(level, rng, alt);
    case 'range':
      return range(level, rng, alt);
    case 'estimate':
      return estimate(level, rng, alt);
  }
}

export const rounding: UnitSpec = finishUnit({
  id: 'g4.math.rounding',
  title: 'がい数《すう》と 見積《みつ》もり',
  stage: 'g4',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-sansu',
  prereq: ['g4.math.oku-cho'],
  objectives: [
    { id: 'place', title: '〇の 位《くらい》までの がい数《すう》（四捨五入《ししゃごにゅう》）' },
    { id: 'digits', title: '上《うえ》から 〇けたの がい数《すう》' },
    { id: 'method', title: '切《き》り上《あ》げ・切《き》り捨《す》て' },
    { id: 'range', title: '以上《いじょう》・未満《みまん》（がい数《すう》に なる はんい）' },
    { id: 'estimate', title: '和《わ》・差《さ》・積《せき》・商《しょう》の 見積《みつ》もり' },
  ],
  misconceptions: [
    {
      id: 'cut-only',
      explain:
        'いつも 切《き》り捨《す》てて（または 切り上《あ》げて）いないかな。四捨五入《ししゃごにゅう》は、見《み》る 位《くらい》が 0〜4なら 切り捨て、5〜9なら 切り上げるよ。',
    },
    {
      id: 'wrong-place',
      explain:
        '見《み》る 位《くらい》が 1つ ずれたのかな。「百《ひゃく》の 位までの がい数《すう》」なら、1つ 下《した》の 十《じゅう》の 位を 見て 四捨五入《ししゃごにゅう》するよ。',
    },
    {
      id: 'drop-zeros',
      explain: 'がい数《すう》に した 位《くらい》より 下《した》の 0を 書《か》きわすれたのかな。下の 位は 0に して、数の 大《おお》きさは そのままに するよ。',
    },
    {
      id: 'from-bottom',
      explain:
        '「上《うえ》から 〇けた」を 下《した》から 数《かぞ》えたのかな。いちばん 左《ひだり》の 数字《すうじ》から 数えて、〇けたを のこすよ。',
    },
    {
      id: 'boundary',
      explain:
        'はんいの はしを まちがえたのかな。「以上《いじょう》」は その 数を ふくみ、「未満《みまん》」は その 数を ふくまないよ。まん中《なか》の 数は 切《き》り上《あ》げに なるね。',
    },
    {
      id: 'method-swap',
      explain:
        '切《き》り上《あ》げと 切り捨《す》てを 反対《はんたい》に したのかな。切り上げは 大《おお》きい ほう、切り捨ては 小《ちい》さい ほうの がい数《すう》に なるよ。',
    },
    {
      id: 'method-scene',
      explain:
        '場面《ばめん》に 合《あ》う 方法《ほうほう》を もう 一度《いちど》 考《かんが》えよう。たりないと こまる ときは 切《き》り上《あ》げ、まとまりだけ 数《かぞ》える ときは 切り捨《す》て、およその 数を 伝《つた》える ときは 四捨五入《ししゃごにゅう》だよ。',
    },
    {
      id: 'estimate-exact',
      explain:
        'くわしく 計算《けいさん》したのかな。見積《みつ》もりは、先《さき》に がい数《すう》に してから 計算するので、かんたんに およその 答《こた》えが わかるよ。',
    },
  ],
  levels: [
    { label: '位《くらい》までの・上《うえ》からの がい数《すう》', chance: 0.05 },
    { label: '切《き》り上《あ》げ・切り捨《す》て', chance: 0.05 },
    { label: 'はんい・見積《みつ》もり', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '4682を 数直線《すうちょくせん》に おくと、4000より 5000に 近《ちか》い。だから 千《せん》の 位《くらい》までの がい数《すう》は 約《やく》 5000。',
      figure: {
        kind: 'numberline',
        min: 4000,
        max: 5000,
        step: 100,
        labelEvery: 5,
        marks: [{ at: 4682, label: '4682', tone: 'focus' }],
      },
    },
    {
      text: '四捨五入《ししゃごにゅう》: がい数《すう》に する 位《くらい》の 1つ 下《した》の 位を 見《み》て、0〜4なら 切《き》り捨《す》て、5〜9なら 切り上《あ》げ。',
      figure: expr('4682 → 百《ひゃく》の 位《くらい》までなら 4700'),
    },
    {
      text: '「上《うえ》から 2けたの がい数《すう》」は、上から 3けた目《め》を 四捨五入《ししゃごにゅう》します。4682 → 4700。',
    },
    {
      text: '切《き》り上《あ》げは 大《おお》きい ほう、切り捨《す》ては 小《ちい》さい ほうに します。場面《ばめん》で 使《つか》い分《わ》けます。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateRounding(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第4学年 A(2) 概数と四捨五入（目的に応じた概数、四捨五入・切り上げ・切り捨て、以上・以下・未満、和差積商の見積もり）',
  revised: REVISED,
});
