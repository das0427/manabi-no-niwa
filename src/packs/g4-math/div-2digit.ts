/**
 * g4.math.div-2digit わり算の筆算（÷2けた）とわり算のきまり（curriculum-matrix 3.7）。
 * 何十でわる → 仮の商の修正 → 商が2けた → わり算のきまり → たしかめ・文章題。
 *
 * 仮の商: わる数の一の位をかくして（24 → 2）、わられる数の上の位でわって見当をつける方法で作り、
 * 見当が大きすぎて 1〜2 小さくする問題を「仮の商の修正」の問題とする（定義域から選ぶ）。
 * 同一性キー: わられる数 ÷ わる数（文章題は 場面 × 式、きまり・たしかめは 形 × 式）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { longDivFigure, qrFields, qrWrongs, stepTexts } from './div-1digit';
import { expr, finishUnit, opts, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'tens' | 'kari' | 'twoq' | 'rule' | 'check' | 'story';

const QR = (q: number, r: number) => [
  { kind: 'int' as const, value: q },
  { kind: 'int' as const, value: r },
];

/** 仮の商（わる数の一の位をかくして見当をつける）。9 をこえない */
export const kariOf = (a: number, d: number) => Math.min(9, Math.floor(Math.floor(a / 10) / Math.floor(d / 10)));

/** 何十で わる（alt: 10円玉で 買う 場面） */
function tens(level: number, rng: Rng, alt: boolean): NumberItem {
  const m = rng.int(2, 9);
  const k = rng.int(m, alt ? 30 : 99);
  const a = k * 10;
  const d = m * 10;
  const q = Math.floor(k / m);
  const r = (k % m) * 10;
  return {
    engine: 'number',
    id: `tens${alt ? '-alt' : ''}:${a}÷${d}`,
    objective: 'tens',
    level,
    prompt: alt
      ? `10円玉が ${k}まい（${a}円）あります。1こ ${d}円の ガムは 何こ 買えて、何円 あまりますか。`
      : 'わり算を しよう。商と あまりを 書こう（あまりが ないときは 0）。',
    figure: alt ? { kind: 'blocks', tens: k, ones: 0 } : expr(`${a} ÷ ${d}`),
    hints: [
      '10の まとまりで 考えよう。',
      `${a}は 10が ${k}こ、${d}は 10が ${m}こ。${k} ÷ ${m}を 考えるよ。`,
      `${k} ÷ ${m} ＝ ${q} あまり ${k % m}。あまりは 10が いくつ分かな。`,
    ],
    explain: `10の まとまりで ${k} ÷ ${m} ＝ ${q} あまり ${k % m}。あまりは 10が ${k % m}こなので ${r}。${a} ÷ ${d} ＝ ${q}${r ? ` あまり ${r}` : ''}です。`,
    identity: `${a}÷${d}${alt ? ':coin' : ''}`,
    alt,
    fields: alt
      ? [
          { label: 'ガム', answer: { kind: 'int', value: q } },
          { label: 'あまり', answer: { kind: 'int', value: r } },
        ]
      : qrFields(q, r),
    wrongAnswers: wrongList(QR(q, r), [
      [r > 0 ? `${q}|${k % m}` : null, 'remainder-tens'],
      [r > 0 ? `${q}|0` : null, 'forget-remainder'],
      [q >= 1 ? `${q - 1}|${r + d}` : null, 'remainder-big'],
    ]),
  };
}

/** 仮の商の修正が いる組（商は 1けた） */
function kariPair(rng: Rng): [number, number] {
  for (;;) {
    let d = rng.int(12, 98);
    if (d % 10 === 0) d += 1;
    const a = rng.int(d + 1, Math.min(999, d * 10 - 1));
    const q = Math.floor(a / d);
    if (q >= 1 && q <= 9 && kariOf(a, d) > q) return [a, d];
  }
}

function kari(level: number, rng: Rng, alt: boolean): Item {
  const [a, d] = kariPair(rng);
  const q = Math.floor(a / d);
  const r = a % d;
  const t = kariOf(a, d);
  const top = Math.floor(a / 10);
  const dt = Math.floor(d / 10);
  if (alt) {
    const item: ChoiceItem = {
      engine: 'choice',
      id: `kari-alt:${a}÷${d}`,
      objective: 'kari',
      level,
      prompt: `${a} ÷ ${d} の 筆算で、${d}を ${dt * 10}と みて 商に ${t}を たてました。${d} × ${t} ＝ ${d * t}で、${a}より 大きく なりました。つぎに どう する？`,
      hints: [
        `${d * t}は ${a}より 大きいので ひけないね。`,
        '商が 大きすぎる ときは、商を 小さく するよ。',
        `${d} × ${t - 1} ＝ ${d * (t - 1)}。これなら ひけるかな。`,
      ],
      explain: `${d} × ${t}が 大きすぎるので、商を 1 小さく して ためします。${a} ÷ ${d} ＝ ${q}${r ? ` あまり ${r}` : ''}です。`,
      identity: `kari-next:${a}÷${d}`,
      alt: true,
      options: opts('商を 1 小さく して、もう一度 かけて ためす', [
        ['商を 1 大きく する', 'kari-direction'],
        [`${d * t} − ${a}を して、あまりに する`, 'kari-big'],
        ['商を 0に する', 'kari-zero'],
      ]),
    };
    return item;
  }
  const item: NumberItem = {
    engine: 'number',
    id: `kari:${a}÷${d}`,
    objective: 'kari',
    level,
    prompt: 'わり算を しよう。商と あまりを 書こう（あまりが ないときは 0）。',
    figure: expr(`${a} ÷ ${d}`),
    hints: [
      `${d}を ${dt * 10}と みて、${top} ÷ ${dt}で 商の 見当を つけよう。`,
      `見当は ${t}。でも ${d} × ${t} ＝ ${d * t}で、${a}より 大きいね。`,
      `商を 小さく して ためそう。${d} × ${t - 1} ＝ ${d * (t - 1)}。`,
    ],
    explain: `見当の 商 ${t}は 大きすぎたので 小さく して、${d} × ${q} ＝ ${d * q}。${a} − ${d * q} ＝ ${r}。${a} ÷ ${d} ＝ ${q}${r ? ` あまり ${r}` : ''}です。`,
    identity: `${a}÷${d}`,
    alt: false,
    fields: qrFields(q, r),
    wrongAnswers: wrongList(QR(q, r), [
      [`${t}|${d * t - a}`, 'kari-big'],
      [t - 1 > q ? `${t - 1}|${d * (t - 1) - a}` : null, 'kari-big'],
      [q >= 1 ? `${q - 1}|${r + d}` : null, 'remainder-big'],
      [r > 0 ? `${q}|0` : null, 'forget-remainder'],
    ]),
  };
  return item;
}

/** 商が 2けた（alt: 筆算の形） */
function twoq(level: number, rng: Rng, alt: boolean): NumberItem {
  let d = rng.int(11, 49);
  if (d % 10 === 0) d += 1;
  const q = rng.int(10, Math.floor(999 / d));
  const r = rng.int(0, d - 1);
  let a = d * q + r;
  if (a > 999) a = d * q;
  const qq = Math.floor(a / d);
  const rr = a % d;
  const steps = stepTexts(a, d);
  return {
    engine: 'number',
    id: `twoq${alt ? '-alt' : ''}:${a}÷${d}`,
    objective: 'twoq',
    level,
    prompt: alt
      ? '筆算で わり算を しよう。商と あまりを 書こう（あまりが ないときは 0）。'
      : 'わり算を しよう。商と あまりを 書こう（あまりが ないときは 0）。',
    figure: alt ? longDivFigure(a, d) : expr(`${a} ÷ ${d}`),
    hints: [
      `上から 2けたの ${String(a).slice(0, 2)}が ${d}で われるか 見よう。商は 十の位から たつよ。`,
      steps[0]!,
      `${steps.slice(0, -1).join('。')}。のこりの 位も 同じように。`,
    ],
    explain: `${steps.join('。')}。${a} ÷ ${d} ＝ ${qq}${rr ? ` あまり ${rr}` : '（わりきれる）'}。たしかめ: ${d} × ${qq}${rr ? ` ＋ ${rr}` : ''} ＝ ${a}`,
    explainFigure: alt ? undefined : longDivFigure(a, d),
    identity: `${a}÷${d}`,
    alt,
    fields: qrFields(qq, rr),
    wrongAnswers: qrWrongs(a, d),
  };
}

/** わり算の きまり（0を 消して 計算。alt: 商が 同じ 式を 選ぶ） */
function rule(level: number, rng: Rng, alt: boolean): Item {
  const D = rng.int(2, 9);
  const z = rng.int(1, 2);
  const q = rng.int(1, 9);
  const rr = alt ? 0 : rng.int(0, D - 1);
  const A = D * q + rr;
  const a = A * 10 ** z;
  const d = D * 10 ** z;
  if (alt) {
    const item: ChoiceItem = {
      engine: 'choice',
      id: `rule-alt:${a}÷${d}`,
      objective: 'rule',
      level,
      prompt: `${a} ÷ ${d}と 商が 同じに なる 式は どれ？`,
      hints: [
        'わられる数と わる数に 同じ数を かけても、同じ数で わっても、商は 変わらないよ。',
        `${a}と ${d}を どちらも ${10 ** z}で わって みよう。`,
        `${a} ÷ ${10 ** z} ＝ ${A}。わる数の ほうは？`,
      ],
      explain: `どちらも ${10 ** z}で わると ${A} ÷ ${D}。商は ${q}で 同じです。`,
      identity: `rule-pick:${a}÷${d}`,
      alt: true,
      options: opts(`${A} ÷ ${D}`, [
        [`${A} ÷ ${d}`, 'rule-one-side'],
        [`${a} ÷ ${D}`, 'rule-one-side'],
        [`${A * 10} ÷ ${D}`, 'rule-one-side'],
      ]),
    };
    return item;
  }
  const r = rr * 10 ** z;
  const zeros = '0'.repeat(z);
  const item: NumberItem = {
    engine: 'number',
    id: `rule:${a}÷${d}`,
    objective: 'rule',
    level,
    prompt: '0を 消す くふうで わり算を しよう。商と あまりを 書こう（あまりが ないときは 0）。',
    figure: expr(`${a} ÷ ${d}`),
    hints: [
      `わられる数と わる数の 0を ${z}こずつ 消して、${A} ÷ ${D}で 考えよう。`,
      `${A} ÷ ${D} ＝ ${q}${rr ? ` あまり ${rr}` : ''}。`,
      rr ? `あまりは、消した 0を もどして 考えるよ。${rr}の 後ろに 0を ${z}こ。` : 'わりきれたね。商は そのまま。',
    ],
    explain: `${A} ÷ ${D} ＝ ${q}${rr ? ` あまり ${rr}` : ''}。${rr ? `あまりは ${zeros.length === 1 ? '10' : '100'}の まとまりが ${rr}こなので ${r}。` : ''}${a} ÷ ${d} ＝ ${q}${r ? ` あまり ${r}` : ''}。（たしかめ: ${d} × ${q}${r ? ` ＋ ${r}` : ''} ＝ ${a}）`,
    identity: `rule:${a}÷${d}`,
    alt: false,
    fields: qrFields(q, r),
    wrongAnswers: wrongList(QR(q, r), [
      [r > 0 ? `${q}|${rr}` : null, 'rule-remainder'],
      [r > 0 ? `${q}|0` : null, 'forget-remainder'],
      [`${q * 10}|${r}`, 'rule-one-side'],
    ]),
  };
  return item;
}

/** たしかめ（alt: 答えが 正しいかを 選ぶ） */
function check(level: number, rng: Rng, alt: boolean): Item {
  let d = rng.int(12, 49);
  if (d % 10 === 0) d += 1;
  const q = rng.int(2, Math.floor(950 / d));
  const r = rng.int(1, d - 1);
  const a = d * q + r;
  if (alt) {
    // 示された答えの正誤を、たしかめの式で判断する
    const wrongShown = rng.next() < 0.5;
    const sq = wrongShown ? q - 1 : q;
    const sr = wrongShown ? r + d : r;
    const item: ChoiceItem = {
      engine: 'choice',
      id: `check-alt:${a}÷${d}:${wrongShown ? 'x' : 'o'}`,
      objective: 'check',
      level,
      prompt: `${a} ÷ ${d}の 答えを「${sq} あまり ${sr}」と しました。この 答えは 正しい？`,
      fixedOrder: true,
      hints: [
        'あまりは わる数より 小さいかな。',
        `たしかめの 式: ${d} × ${sq} ＋ ${sr}`,
        `${d} × ${sq} ＝ ${d * sq}。あまりと わる数も くらべよう。`,
      ],
      explain: wrongShown
        ? `${d} × ${sq} ＋ ${sr} ＝ ${a}に なりますが、あまり ${sr}が わる数 ${d}より 大きいので 正しく ありません。正しい 答えは ${q} あまり ${r}です。`
        : `${d} × ${q} ＋ ${r} ＝ ${a}で、あまり ${r}は わる数 ${d}より 小さいので 正しい 答えです。`,
      identity: `check-judge:${a}÷${d}:${wrongShown ? 'x' : 'o'}`,
      alt: true,
      options: wrongShown
        ? [
            { label: '正しい', misconception: 'remainder-big' },
            { label: '正しくない（あまりが 大きすぎる）', correct: true },
            { label: '正しくない（たしかめの 式が 合わない）', misconception: 'check-forget-r' },
          ]
        : [
            { label: '正しい', correct: true },
            { label: '正しくない（あまりが 大きすぎる）', misconception: 'remainder-big' },
            { label: '正しくない（たしかめの 式が 合わない）', misconception: 'check-forget-r' },
          ],
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
    ]),
  };
  return item;
}

interface Scene {
  id: string;
  type: 'tobun' | 'hogan' | 'up' | 'down';
  text: (a: number, d: number) => string;
  labels: [string, string];
  unit: string;
}
const SCENES: Scene[] = [
  { id: 'paper', type: 'tobun', text: (a, d) => `色紙が ${a}まい あります。${d}人で 同じ数ずつ 分けると、1人 何まいに なって、何まい あまりますか。`, labels: ['1人', 'あまり'], unit: 'まい' },
  { id: 'juice', type: 'hogan', text: (a, d) => `ジュースが ${a}dL あります。${d}dLずつ びんに 入れると、何本 できて、何dL あまりますか。`, labels: ['本数', 'あまり'], unit: '本' },
  { id: 'rope', type: 'hogan', text: (a, d) => `ロープが ${a}cm あります。${d}cmずつ 切ると、何本 とれて、何cm あまりますか。`, labels: ['本数', 'あまり'], unit: '本' },
  { id: 'stamp', type: 'tobun', text: (a, d) => `シールが ${a}まい あります。${d}人に 同じ数ずつ 配ると、1人 何まいで、何まい あまりますか。`, labels: ['1人', 'あまり'], unit: 'まい' },
  { id: 'bus', type: 'up', text: (a, d) => `${a}人が バスで 出かけます。1台に ${d}人まで 乗れます。全員が 乗るには、バスは 何台 いりますか。`, labels: ['', ''], unit: '台' },
  { id: 'chair', type: 'up', text: (a, d) => `いすが ${a}きゃく あります。1回に ${d}きゃくずつ 運ぶと、全部 運ぶのに 何回 かかりますか。`, labels: ['', ''], unit: '回' },
  { id: 'egg', type: 'down', text: (a, d) => `たまごが ${a}こ あります。${d}こ入りの パックに つめると、${d}こ入りの パックは 何パック できますか。`, labels: ['', ''], unit: 'パック' },
  { id: 'page', type: 'down', text: (a, d) => `${a}ページの 本を 毎日 ${d}ページずつ 読みます。${d}ページ 読める 日は 何日 ありますか。`, labels: ['', ''], unit: '日' },
];

function story(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  let d = rng.int(12, 45);
  if (d % 10 === 0) d += 2;
  let a = rng.int(d * 2, Math.min(999, d * 30));
  if ((sc.type === 'up' || sc.type === 'down') && a % d === 0) a += 1;
  const q = Math.floor(a / d);
  const r = a % d;
  const fig: Figure | undefined = alt
    ? {
        kind: 'tape',
        parts: [
          { length: 3, label: sc.type === 'tobun' ? '？' : String(d), tone: 'a' },
          { length: 3, label: sc.type === 'tobun' ? '？' : String(d), tone: 'a' },
          { length: 4, label: '…' },
          { length: 2, label: 'あまり', tone: 'muted' },
        ],
        total: String(a),
      }
    : undefined;
  const base = {
    engine: 'number' as const,
    id: `story${alt ? '-alt' : ''}:${sc.id}:${a}÷${d}`,
    objective: 'story',
    level,
    prompt: sc.text(a, d),
    figure: fig,
    identity: `story:${sc.id}:${a}÷${d}`,
    alt,
  };
  const h1 =
    sc.type === 'tobun'
      ? '同じ数ずつ 分けるので、1つ分を 求める わり算だね。'
      : sc.type === 'hogan'
        ? `${d}ずつ いくつ 取れるかを 求める わり算だね。`
        : sc.type === 'up'
          ? 'あまりの 分も わすれずに 考えよう。'
          : `${d}に たりない 分は 数えないよ。`;
  if (sc.type === 'tobun' || sc.type === 'hogan')
    return {
      ...base,
      hints: [h1, `式は ${a} ÷ ${d}。`, `${stepTexts(a, d)[0]}。のこりの 位も わろう。`],
      explain: `${a} ÷ ${d} ＝ ${q} あまり ${r}。${sc.labels[0]} ${q}、あまり ${r}です。`,
      fields: [
        { label: sc.labels[0], answer: { kind: 'int', value: q } },
        { label: sc.labels[1], answer: { kind: 'int', value: r } },
      ],
      wrongAnswers: qrWrongs(a, d),
    };
  const ans = sc.type === 'up' ? q + 1 : q;
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    ...base,
    hints: [h1, `式は ${a} ÷ ${d} ＝ ${q} あまり ${r}。`, sc.type === 'up' ? `あまりの ${r}の 分にも もう1つ いるね。` : `あまりの ${r}では ${d}に たりないね。`],
    explain:
      sc.type === 'up'
        ? `${a} ÷ ${d} ＝ ${q} あまり ${r}。あまりの 分にも もう1つ いるので ${ans}${sc.unit}です。`
        : `${a} ÷ ${d} ＝ ${q} あまり ${r}。あまりは 数えないので ${ans}${sc.unit}です。`,
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [sc.type === 'up' ? q : q + 1, 'remainder-meaning'],
      [r, 'remainder-meaning'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['tens', 'rule'] },
  { objs: ['kari', 'check', 'tens'] },
  { objs: ['twoq', 'kari', 'rule'] },
  { objs: ['story', 'twoq', 'kari', 'check'] },
];

export function generateDiv2(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'tens':
      return tens(level, rng, alt);
    case 'kari':
      return kari(level, rng, alt);
    case 'twoq':
      return twoq(level, rng, alt);
    case 'rule':
      return rule(level, rng, alt);
    case 'check':
      return check(level, rng, alt);
    case 'story':
      return story(level, rng, alt);
  }
}

export const div2digit: UnitSpec = finishUnit({
  id: 'g4.math.div-2digit',
  title: 'わり算の 筆算（2けたで わる）',
  stage: 'g4',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-math',
  prereq: ['g4.math.div-1digit'],
  objectives: [
    { id: 'tens', title: '何十で わる' },
    { id: 'kari', title: '仮の 商を なおす' },
    { id: 'twoq', title: '商が 2けたに なる 筆算' },
    { id: 'rule', title: 'わり算の きまり（0を 消す くふう）' },
    { id: 'check', title: '答えの たしかめ' },
    { id: 'story', title: '文章題' },
  ],
  misconceptions: [
    {
      id: 'remainder-tens',
      explain: 'あまりも 10の まとまりの 数だよ。10の まとまりが 2こ あまったら、あまりは 20だね。',
    },
    {
      id: 'kari-big',
      explain:
        '見当で たてた 商が 大きすぎて、ひけなく なったのかな。わる数 × 商 が わられる数より 大きい ときは、商を 1 小さく して ためそう。',
    },
    {
      id: 'kari-direction',
      explain: 'かけた 答えが 大きすぎる ときは、商を 大きく するのでは なく、小さく するよ。',
    },
    {
      id: 'kari-zero',
      explain: '商を 0に すると、わられる数が ぜんぶ あまりに なって しまうね。1つずつ 小さく して ためそう。',
    },
    {
      id: 'remainder-big',
      explain: 'あまりが わる数と 同じか 大きく なって いないかな。あまりは わる数より 小さく なるように、商を 1 大きく しよう。',
    },
    {
      id: 'forget-remainder',
      explain: 'あまりを 書きわすれたのかな。さいごに ひいた のこりが あまりだよ。',
    },
    {
      id: 'zero-skip',
      explain: '商に 0を たてるのを わすれたのかな。われない 位にも 0を 書かないと、位が ずれるよ。',
    },
    {
      id: 'place-start',
      explain: '商を たてる 位が ずれたのかな。上から 何けたで われるかを 見て、商の たつ 位を きめよう。',
    },
    {
      id: 'rule-remainder',
      explain:
        '0を 消して 計算した ときの あまりは、消した 0の 分だけ もとに もどすよ。100の まとまりが 2こ あまったら 200だね。',
    },
    {
      id: 'rule-one-side',
      explain: 'わられる数と わる数の 両方に、同じ ことを しないと 商は 同じに ならないよ。0を 消す ときは 同じ数ずつ 消そう。',
    },
    {
      id: 'check-forget-r',
      explain: 'あまりを たしわすれたのかな。わる数 × 商 ＋ あまり ＝ わられる数 だよ。',
    },
    {
      id: 'check-sub',
      explain: 'あまりを ひいたのかな。わられる数は「わる数 × 商」より あまりの 分だけ 大きいよ。',
    },
    {
      id: 'remainder-meaning',
      explain:
        'あまりを どう するか 場面で 考えよう。全部を 運ぶ（乗せる）には あまりの 分も もう1つ いる。まとまりの 数を 聞かれたら あまりは 数えないよ。',
    },
  ],
  levels: [
    { label: '何十で わる・きまり', chance: 0.02 },
    { label: '仮の 商・たしかめ', chance: 0.02 },
    { label: '商が 2けた', chance: 0.02 },
    { label: '文章題・まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '80 ÷ 20は、10の まとまりで 考えると 8 ÷ 2 ＝ 4。',
      figure: { kind: 'blocks', tens: 8, ones: 0 },
    },
    {
      text: '156 ÷ 24: 24を 20と みて、15 ÷ 2で 見当を つけると 7。24 × 7 ＝ 168は 156より 大きいので、商を 1 小さく して 6。',
      figure: expr('24 × 6 ＝ 144　156 − 144 ＝ 12'),
    },
    {
      text: '答えは 6 あまり 12。たしかめ: 24 × 6 ＋ 12 ＝ 156。',
      figure: longDivFigure(156, 24),
    },
    {
      text: 'わられる数と わる数を 同じ数で わっても 商は 同じ。1200 ÷ 300 ＝ 12 ÷ 3 ＝ 4。',
      figure: expr('1200 ÷ 300 ＝ 12 ÷ 3'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateDiv2(level, rng, index),
  },
  review: 'type',
  basis: '小学校学習指導要領（平成29年告示）算数 第4学年 A(3) 整数の除法（除数が2位数の場合の筆算、除法に関して成り立つ性質、確かめ）',
  revised: REVISED,
});
