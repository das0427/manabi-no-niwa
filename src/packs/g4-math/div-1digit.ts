/**
 * g4.math.div-1digit わり算の筆算（÷1けた）（curriculum-matrix 3.7）。
 * 何十・何百 ÷ 1けた → 筆算（2けた・3けた ÷ 1けた）→ 商に 0 が たつ → 答えの たしかめ・文章題。
 *
 * 答えは「商」と「あまり」の2つの欄（わりきれるときは あまり 0）。筆算の位ごとの入力は number エンジンに無いので、
 * 答えの値で判定し、典型的な誤り（商に0をたてない・あまりがわる数以上・あまりの書きわすれ）を誤概念に結ぶ。
 * 同一性キー: わられる数 ÷ わる数（文章題は 場面 × 式、たしかめは 形 × 式）。横書きと筆算の形（alt）は別の表し方。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, finishUnit, opts, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'tens' | 'two' | 'three' | 'zero' | 'check' | 'story';

const PLACE = ['一', '十', '百', '千'];

/** 筆算の手順（上の位から）。各段: その位までの数・たてた商・あまり */
export function divSteps(a: number, d: number): { cur: number; q: number; r: number; place: number }[] {
  const s = String(a);
  const out: { cur: number; q: number; r: number; place: number }[] = [];
  let rem = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = rem * 10 + Number(s[i]);
    const q = Math.floor(cur / d);
    rem = cur - q * d;
    out.push({ cur, q, r: rem, place: s.length - 1 - i });
  }
  return out;
}

/** 商が たちはじめる段から後の手順の文 */
export function stepTexts(a: number, d: number): string[] {
  const st = divSteps(a, d);
  const first = st.findIndex((x) => x.q > 0);
  return st
    .slice(Math.max(first, 0))
    .map((x) => `${PLACE[x.place]}の位: ${x.cur} ÷ ${d} ＝ ${x.q} あまり ${x.r}`);
}

/** 筆算の形の図（わる数 ）わられる数。商の段は空ける） */
export function longDivFigure(a: number, d: number): Figure {
  const s = String(a);
  return {
    kind: 'table',
    header: ['', ...s.split('').map((_, i) => `${PLACE[s.length - 1 - i]}の位`)],
    rows: [
      ['商', ...s.split('').map(() => '')],
      [`${d} ）`, ...s.split('')],
    ],
  };
}

const QR = (q: number, r: number) => [
  { kind: 'int' as const, value: q },
  { kind: 'int' as const, value: r },
];

/** 商とあまりの典型的な誤り */
export function qrWrongs(a: number, d: number) {
  const q = Math.floor(a / d);
  const r = a % d;
  const qs = String(q);
  const st = divSteps(a, d);
  const firstQ = st.findIndex((x) => x.q > 0);
  return wrongList(QR(q, r), [
    // 商の途中・終わりの 0 を たてない（816 ÷ 4 → 24）
    [/0/.test(qs) ? `${Number(qs.replace(/0/g, '')) || 0}|${r}` : null, 'zero-skip'],
    // 仮の商が 1 小さいまま（あまりが わる数 以上）
    [q >= 1 ? `${q - 1}|${r + d}` : null, 'remainder-big'],
    // あまりを 書きわすれ
    [r > 0 ? `${q}|0` : null, 'forget-remainder'],
    // 商の たつ 位を まちがえて 1けた 多い（いちばん上の位で われないのに 0 でない数を たてた形）
    [firstQ > 0 ? `${q * 10}|${r}` : null, 'place-start'],
  ]);
}

/** 商とあまりの欄 */
export const qrFields = (q: number, r: number) => [
  { label: '商', answer: { kind: 'int' as const, value: q } },
  { label: 'あまり', answer: { kind: 'int' as const, value: r } },
];

/** 何十・何百 ÷ 1けた（alt: 10の たばの 図で 分ける） */
function tens(level: number, rng: Rng, alt: boolean): NumberItem {
  const d = rng.int(2, 9);
  const q = rng.int(1, alt ? Math.floor(20 / d) || 1 : 9);
  const scale = alt ? 10 : pick(rng, [10, 100]);
  const a = d * q * scale;
  const ans = q * scale;
  const unitName = scale === 10 ? '10' : '100';
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `tens${alt ? '-alt' : ''}:${a}÷${d}`,
    objective: 'tens',
    level,
    prompt: alt
      ? `10まいの たばが ${d * q}たば（${a}まい）あります。${d}人で 同じ数ずつ 分けると、1人 何まいに なりますか。`
      : 'わり算を しよう。',
    figure: alt ? { kind: 'blocks', tens: d * q, ones: 0 } : expr(`${a} ÷ ${d} ＝ {{}}`),
    hints: [
      `${a}は ${unitName}が ${d * q}こ 集まった数だね。`,
      `${unitName}の まとまりで 考えると、${d * q} ÷ ${d} ＝ ${q}。`,
      `${unitName}が ${q}こで いくつに なるかな。`,
    ],
    explain: `${a}は ${unitName}が ${d * q}こ。${d * q} ÷ ${d} ＝ ${q}なので、${unitName}が ${q}こで ${ans}。${a} ÷ ${d} ＝ ${ans}です。`,
    identity: `${a}÷${d}${alt ? ':bundle' : ''}`,
    alt,
    fields: [{ label: alt ? '1人' : undefined, answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [q, 'tens-drop-zero'],
      [ans * 10, 'tens-drop-zero'],
      [scale === 100 ? q * 10 : null, 'tens-drop-zero'],
    ]),
  };
}

/** 筆算（2けた・3けた ÷ 1けた）。alt: 筆算の形の図 */
function column(obj: 'two' | 'three' | 'zero', level: number, rng: Rng, alt: boolean): NumberItem {
  let a: number;
  let d: number;
  if (obj === 'zero') {
    // 商の 十の位 か 一の位 に 0 が たつ（例 816 ÷ 4 ＝ 204、 480 ÷ 6 ＝ 80）
    d = rng.int(2, 9);
    const kind = rng.int(0, 2);
    const qs: number[] = [];
    for (let x = 1; x <= 9; x++)
      for (let y = 1; y <= 9; y++) {
        const q = kind === 0 ? x * 100 + y : kind === 1 ? x * 100 + y * 10 : y * 10;
        if (d * q + d - 1 <= 999 && !qs.includes(q)) qs.push(q);
      }
    a = d * pick(rng, qs) + rng.int(0, d - 1);
  } else if (obj === 'two') {
    d = rng.int(2, 9);
    a = rng.int(10 * d, 99);
  } else {
    d = rng.int(2, 9);
    a = rng.int(100, 999);
  }
  const q = Math.floor(a / d);
  const r = a % d;
  const steps = stepTexts(a, d);
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${a}÷${d}`,
    objective: obj,
    level,
    prompt: alt
      ? '筆算で わり算を しよう。商と あまりを 書こう（あまりが ないときは 0）。'
      : 'わり算を しよう。商と あまりを 書こう（あまりが ないときは 0）。',
    figure: alt ? longDivFigure(a, d) : expr(`${a} ÷ ${d}`),
    hints: [
      String(a)[0]! < String(d)
        ? `いちばん上の位の ${String(a)[0]}は ${d}で われないね。上から 2けたの ${String(a).slice(0, 2)}から わろう。`
        : `上の位から じゅんに、「たてる → かける → ひく → おろす」を くりかえそう。`,
      steps[0]!,
      steps.length > 1
        ? `${steps.slice(0, -1).join('。')}。のこりの 位も 同じように。`
        : `${d} × □ が ${a}を こえない いちばん大きい□を 考えよう。`,
    ],
    explain: `${steps.join('。')}。${a} ÷ ${d} ＝ ${q}${r ? ` あまり ${r}` : '（わりきれる）'}。たしかめ: ${d} × ${q}${r ? ` ＋ ${r}` : ''} ＝ ${a}`,
    explainFigure: alt ? undefined : longDivFigure(a, d),
    identity: `${a}÷${d}`,
    alt,
    fields: qrFields(q, r),
    wrongAnswers: qrWrongs(a, d),
  };
}

/** 答えの たしかめ（alt: たしかめの 式を 選ぶ） */
function check(level: number, rng: Rng, alt: boolean): Item {
  const d = rng.int(2, 9);
  const q = rng.int(11, 99);
  const r = rng.int(1, d - 1);
  const a = d * q + r;
  if (alt) {
    const item: ChoiceItem = {
      engine: 'choice',
      id: `check-alt:${a}÷${d}`,
      objective: 'check',
      level,
      prompt: `${a} ÷ ${d} ＝ ${q} あまり ${r}。この 答えが 正しいか たしかめる 式は どれ？`,
      hints: [
        'わる数 × 商 に あまりを たすと、わられる数に もどるよ。',
        `わる数は ${d}、商は ${q}、あまりは ${r}。`,
        `${d} × ${q} に 何を たすかな。`,
      ],
      explain: `${d} × ${q} ＋ ${r} ＝ ${a}。わられる数に なるので、答えは 正しいです。`,
      identity: `check-pick:${a}÷${d}`,
      alt: true,
      options: opts(`${d} × ${q} ＋ ${r}`, [
        [`${d} × ${q}`, 'check-forget-r'],
        [`${d} × ${q} − ${r}`, 'check-sub'],
        [`${q} × ${r} ＋ ${d}`, 'check-swap'],
      ]),
    };
    return item;
  }
  const answers = [{ kind: 'int' as const, value: a }];
  const item: NumberItem = {
    engine: 'number',
    id: `check:${a}÷${d}`,
    objective: 'check',
    level,
    prompt: '□に あてはまる 数を 求めよう。',
    figure: expr(`□ ÷ ${d} ＝ ${q} あまり ${r}`),
    hints: [
      '答えの たしかめの 式を 使おう。',
      'わる数 × 商 ＋ あまり ＝ わられる数',
      `${d} × ${q} ＝ ${d * q}。これに あまりを たすと…`,
    ],
    explain: `${d} × ${q} ＋ ${r} ＝ ${a}。□は ${a}です。`,
    identity: `check:${a}÷${d}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [d * q, 'check-forget-r'],
      [d * q - r, 'check-sub'],
      [q * r + d, 'check-swap'],
    ]),
  };
  return item;
}

interface Scene {
  id: string;
  /** tobun: 1つ分を求める、hogan: いくつ分を求める、up: あまりの分も 1 たす、down: あまりは 数えない */
  type: 'tobun' | 'hogan' | 'up' | 'down';
  text: (a: number, d: number) => string;
  labels: [string, string];
}

const SCENES: Scene[] = [
  {
    id: 'card',
    type: 'tobun',
    text: (a, d) => `カードが ${a}まい あります。${d}人で 同じ数ずつ 分けると、1人 何まいに なって、何まい あまりますか。`,
    labels: ['1人', 'あまり'],
  },
  {
    id: 'bead',
    type: 'tobun',
    text: (a, d) => `ビーズが ${a}こ あります。${d}つの ふくろに 同じ数ずつ 入れると、1ふくろ 何こに なって、何こ あまりますか。`,
    labels: ['1ふくろ', 'あまり'],
  },
  {
    id: 'ribbon',
    type: 'hogan',
    text: (a, d) => `リボンが ${a}cm あります。${d}cmずつ 切ると、何本 できて、何cm あまりますか。`,
    labels: ['本数', 'あまり'],
  },
  {
    id: 'candy',
    type: 'hogan',
    text: (a, d) => `あめが ${a}こ あります。1人に ${d}こずつ 配ると、何人に 配れて、何こ あまりますか。`,
    labels: ['人数', 'あまり'],
  },
  {
    id: 'boat',
    type: 'up',
    text: (a, d) => `${a}人が ボートに 乗ります。1そうに ${d}人まで 乗れます。全員が 乗るには、ボートは 少なくとも 何そう いりますか。`,
    labels: ['', ''],
  },
  {
    id: 'shelf',
    type: 'up',
    text: (a, d) => `本が ${a}さつ あります。1だんに ${d}さつずつ 立てると、全部 立てるのに 何だん いりますか。`,
    labels: ['', ''],
  },
  {
    id: 'pack',
    type: 'down',
    text: (a, d) => `おかしが ${a}こ あります。${d}こずつ 箱に つめると、${d}こ入りの 箱は 何箱 できますか。`,
    labels: ['', ''],
  },
  {
    id: 'flower',
    type: 'down',
    text: (a, d) => `花が ${a}本 あります。${d}本ずつ たばに すると、${d}本の たばは 何たば できますか。`,
    labels: ['', ''],
  },
];

const UNIT_WORD: Record<string, string> = {
  boat: 'そう',
  shelf: 'だん',
  pack: '箱',
  flower: 'たば',
};

function story(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const d = rng.int(3, 9);
  let a = rng.int(d * 10, d < 5 ? 199 : 299);
  if ((sc.type === 'up' || sc.type === 'down') && a % d === 0) a += 1;
  const q = Math.floor(a / d);
  const r = a % d;
  const fig: Figure | undefined = alt
    ? {
        kind: 'tape',
        parts: [
          { length: 3, label: sc.type === 'tobun' ? '？' : `${d}`, tone: 'a' },
          { length: 3, label: sc.type === 'tobun' ? '？' : `${d}`, tone: 'a' },
          { length: 4, label: '…' },
          { length: 2, label: 'あまり', tone: 'muted' },
        ],
        total: String(a),
      }
    : undefined;
  const common = {
    engine: 'number' as const,
    id: `story${alt ? '-alt' : ''}:${sc.id}:${a}÷${d}`,
    objective: 'story',
    level,
    prompt: sc.text(a, d),
    figure: fig,
    identity: `story:${sc.id}:${a}÷${d}`,
    alt,
  };
  const hint1 =
    sc.type === 'tobun'
      ? '同じ数ずつ 分けるので、1つ分を 求める わり算だね。'
      : sc.type === 'hogan'
        ? `${d}ずつ いくつ 取れるかを 求める わり算だね。`
        : sc.type === 'up'
          ? 'わり算の あまりの 人や 物も わすれずに 考えよう。'
          : `${d}こ（本）そろわない 分は 数えないよ。`;
  if (sc.type === 'tobun' || sc.type === 'hogan') {
    return {
      ...common,
      hints: [hint1, `式は ${a} ÷ ${d}。`, `${stepTexts(a, d)[0]}。のこりの 位も わろう。`],
      explain: `${a} ÷ ${d} ＝ ${q} あまり ${r}。${sc.labels[0]} ${q}、あまり ${r}です。`,
      fields: [
        { label: sc.labels[0], answer: { kind: 'int', value: q } },
        { label: sc.labels[1], answer: { kind: 'int', value: r } },
      ],
      wrongAnswers: qrWrongs(a, d),
    };
  }
  const ans = sc.type === 'up' ? q + (r > 0 ? 1 : 0) : q;
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    ...common,
    hints: [hint1, `式は ${a} ÷ ${d} ＝ ${q} あまり ${r}。`, sc.type === 'up' ? `あまりの ${r}にも もう1つ いるね。` : `あまりの ${r}では ${d}に たりないね。`],
    explain:
      sc.type === 'up'
        ? `${a} ÷ ${d} ＝ ${q} あまり ${r}。あまりの ${r}の ためにも もう1つ いるので、${q} ＋ 1 ＝ ${ans}${UNIT_WORD[sc.id]}です。`
        : `${a} ÷ ${d} ＝ ${q} あまり ${r}。あまりの ${r}では たりないので、${ans}${UNIT_WORD[sc.id]}です。`,
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [sc.type === 'up' ? q : q + 1, 'remainder-meaning'],
      [r, 'remainder-meaning'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['tens', 'two'] },
  { objs: ['two', 'three'] },
  { objs: ['three', 'zero', 'check'] },
  { objs: ['story', 'zero', 'check', 'three'] },
];

export function generateDiv1(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'tens':
      return tens(level, rng, alt);
    case 'two':
    case 'three':
    case 'zero':
      return column(obj, level, rng, alt);
    case 'check':
      return check(level, rng, alt);
    case 'story':
      return story(level, rng, alt);
  }
}

export const div1digit: UnitSpec = finishUnit({
  id: 'g4.math.div-1digit',
  title: 'わり算の 筆算（1けたで わる）',
  stage: 'g4',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-math',
  prereq: ['g3.math.division-remainder'],
  objectives: [
    { id: 'tens', title: '何十・何百 ÷ 1けた' },
    { id: 'two', title: '2けた ÷ 1けたの 筆算' },
    { id: 'three', title: '3けた ÷ 1けたの 筆算' },
    { id: 'zero', title: '商に 0が たつ 筆算' },
    { id: 'check', title: '答えの たしかめ' },
    { id: 'story', title: '文章題（あまりの 考え方）' },
  ],
  misconceptions: [
    {
      id: 'zero-skip',
      explain:
        '商に 0を たてるのを わすれたのかな。わる数より 小さくて われない 位にも、商の 0を 書くよ。そうしないと 位が ずれるね。',
    },
    {
      id: 'remainder-big',
      explain: 'あまりが わる数と 同じか 大きく なって いないかな。あまりは いつも わる数より 小さく なるように 商を 1 大きく しよう。',
    },
    {
      id: 'forget-remainder',
      explain: 'あまりを 書きわすれたのかな。さいごに ひいた のこりが あまりだよ。',
    },
    {
      id: 'place-start',
      explain:
        '商を たてる 位が ずれたのかな。いちばん上の位が わる数より 小さい ときは、その 位には 商が たたないよ。上から 2けたで わろう。',
    },
    {
      id: 'tens-drop-zero',
      explain: '10や 100の まとまりで 考えた あと、0を つけわすれたのかな（または つけすぎたのかな）。まとまりが いくつ分かを 思い出そう。',
    },
    {
      id: 'check-forget-r',
      explain: 'あまりを たしわすれたのかな。わる数 × 商 に あまりを たすと、わられる数に なるよ。',
    },
    {
      id: 'check-sub',
      explain: 'あまりを ひいたのかな。わられる数は「わる数 × 商」より あまりの 分だけ 大きいよ。',
    },
    {
      id: 'check-swap',
      explain: 'かける数を とりちがえたのかな。かけるのは わる数と 商だよ。',
    },
    {
      id: 'remainder-meaning',
      explain:
        'あまりを どう するか 場面で 考えよう。全部を 入れる（乗せる）には あまりの 分も もう1つ いる。まとまりの 数を 聞かれたら あまりは 数えないよ。',
    },
  ],
  levels: [
    { label: '何十・何百 ÷ 1けた、2けた ÷ 1けた', chance: 0.02 },
    { label: '2けた・3けた ÷ 1けた', chance: 0.02 },
    { label: '商に 0・たしかめ', chance: 0.02 },
    { label: '文章題・まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '60まいの 紙を 3人で 分けます。10まいの たばで 考えると、6たば ÷ 3 ＝ 2たば。1人 20まいです。',
      figure: { kind: 'blocks', tens: 6, ones: 0 },
    },
    {
      text: '筆算は 上の位から「たてる → かける → ひく → おろす」を くりかえします。',
      figure: longDivFigure(72, 3),
    },
    {
      text: '72 ÷ 3: 十の位 7 ÷ 3 ＝ 2 あまり 1。1を 一の位に おろして 12 ÷ 3 ＝ 4。答えは 24。',
      figure: expr('72 ÷ 3 ＝ 24'),
    },
    {
      text: 'わる数 × 商 ＋ あまり ＝ わられる数 で、答えを たしかめられます。',
      figure: expr('3 × 24 ＝ 72'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateDiv1(level, rng, index),
  },
  review: 'type',
  basis: '小学校学習指導要領（平成29年告示）算数 第4学年 A(3) 整数の除法（除数が1位数の場合の筆算、商が0になる場合、確かめ）',
  revised: REVISED,
});
