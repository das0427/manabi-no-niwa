/**
 * g2.ja.subject-predicate しゅごと じゅつご（curriculum-matrix 3.5）。
 * 主語（だれが・なにが）と述語（どうする・どんなだ・なんだ）を見つける。主語のない文に気づく。
 *
 * 同一性キー: 「文 × 問い（主語／述語／文の型／主語の有無）」。
 */
import type { ChoiceItem, FillItem, Item, UnitSpec } from '../../curriculum/types';
import { opts, REVISED, type Wrong } from './util';

type Type = 'dousuru' | 'donnada' | 'nanda';
interface Sent {
  w: string[];
  s: number;
  p: number;
  type: Type;
}
const S = (w: string[], s: number, p: number, type: Type): Sent => ({ w, s, p, type });
const text = (x: Sent) => `${x.w.join(' ')}。`;

const DOUSURU: Sent[] = [
  S(['とりが', 'そらを', 'とぶ'], 0, 2, 'dousuru'),
  S(['いぬが', 'にわで', 'はしる'], 0, 2, 'dousuru'),
  S(['ぼくは', 'ほんを', 'よむ'], 0, 2, 'dousuru'),
  S(['ねこが', 'まどの', 'そばで', 'ねる'], 0, 3, 'dousuru'),
  S(['いもうとが', 'うたを', 'うたう'], 0, 2, 'dousuru'),
  S(['さかなが', 'いけで', 'およぐ'], 0, 2, 'dousuru'),
  S(['わたしは', 'ごはんを', 'たべる'], 0, 2, 'dousuru'),
  S(['おとうとが', 'ボールを', 'なげる'], 0, 2, 'dousuru'),
  S(['かぜが', 'つよく', 'ふく'], 0, 2, 'dousuru'),
  S(['はなが', 'にわに', 'さく'], 0, 2, 'dousuru'),
  S(['せみが', '木《き》の', 'うえで', 'なく'], 0, 3, 'dousuru'),
  S(['きのう', 'ぼくは', 'こうえんへ', 'いった'], 1, 3, 'dousuru'),
  S(['あさ', 'すずめが', 'えだで', 'なく'], 1, 3, 'dousuru'),
  S(['ゆうがた', 'あねが', 'いえに', 'かえった'], 1, 3, 'dousuru'),
];
const DONNADA: Sent[] = [
  S(['はなが', 'とても', 'きれいだ'], 0, 2, 'donnada'),
  S(['この', 'りんごは', 'あかい'], 1, 2, 'donnada'),
  S(['きょうの', 'そらは', 'とても', 'あおい'], 1, 3, 'donnada'),
  S(['うさぎの', 'みみは', 'ながい'], 1, 2, 'donnada'),
  S(['へやの', 'なかは', 'しずかだ'], 1, 2, 'donnada'),
  S(['プールの', 'みずは', 'つめたい'], 1, 2, 'donnada'),
];
const NANDA: Sent[] = [
  S(['これは', 'ぼくの', 'ほんだ'], 0, 2, 'nanda'),
  S(['あの', 'どうぶつは', 'きりんだ'], 1, 2, 'nanda'),
  S(['わたしの', 'すきな', 'くだものは', 'いちごだ'], 2, 3, 'nanda'),
  S(['くじらは', 'うみの', 'いきものだ'], 0, 2, 'nanda'),
  S(['あの', '人《ひと》は', 'ぼくの', 'おじさんだ'], 1, 3, 'nanda'),
  S(['あしたは', 'たのしい', 'えんそくだ'], 0, 2, 'nanda'),
];

const others = (x: Sent) => x.w.filter((_, i) => i !== x.s && i !== x.p).slice(0, 2);
const TYPE_Q: Record<Type, string> = {
  dousuru: 'どうする',
  donnada: 'どんなだ',
  nanda: 'なんだ',
};

function predItem(x: Sent, obj: 'jutsugo' | 'donnada'): ChoiceItem {
  const pred = x.w[x.p]!;
  const wrongs: Wrong[] = [
    [x.w[x.s]!, 'subj-as-pred'],
    ...others(x).map((o): Wrong => [o, obj === 'jutsugo' ? 'other-as-pred' : 'modifier-as-pred']),
  ];
  return {
    engine: 'choice',
    id: `pred:${x.w.join('')}`,
    objective: obj,
    level: obj === 'jutsugo' ? 0 : 1,
    prompt: `「${text(x)}」\nこの ぶんの じゅつご（${TYPE_Q[x.type]}に あたる ことば）は どれ？`,
    options: opts(pred, wrongs),
    hints: [
      `じゅつごは「${TYPE_Q[x.type]}」に あたる ことばだよ。`,
      'じゅつごは、たいてい ぶんの おわりの ほうに あるよ。',
      `「${x.w[x.s]}」 どう なのかな、を あらわす ことばを さがそう。`,
    ],
    explain: `「${x.w[x.s]}」（だれが・なにが）に たいして、「${pred}」が ${TYPE_Q[x.type]}に あたる じゅつごです。`,
    identity: `pred:${x.w.join('')}`,
  };
}

function subjWrongMis(x: Sent, o: string): string {
  if (o.endsWith('を')) return 'object-as-subj';
  if (x.w.indexOf(o) === 0) return 'first-word-subj';
  return 'other-as-subj';
}

function subjItem(x: Sent): ChoiceItem {
  const subj = x.w[x.s]!;
  return {
    engine: 'choice',
    id: `subj:${x.w.join('')}`,
    objective: 'shugo',
    level: 0,
    prompt: `「${text(x)}」\nこの ぶんの しゅご（だれが・なにが に あたる ことば）は どれ？`,
    options: opts(subj, [
      [x.w[x.p]!, 'pred-as-subj'],
      ...others(x).map((o): Wrong => [o, subjWrongMis(x, o)]),
    ]),
    hints: [
      'まず じゅつご（どうする）を みつけよう。',
      `「${x.w[x.p]}」のは だれ（なに）かな、と かんがえよう。`,
      'しゅごは「〜が」「〜は」の かたちが おおいよ。',
    ],
    explain: `「${x.w[x.p]}」のは「${subj}」。だから しゅごは「${subj}」です。`,
    identity: `subj:${x.w.join('')}`,
  };
}

// ---- 別例 ----
/** じゅつごを入れる: [文（{{}}入り）, 正解, 合わない述語1, 合わない述語2, 主語] */
const PRED_FILL: [string, string, string, string, string][] = [
  ['さかなが いけで {{}}。', 'およぐ', 'とぶ', 'ほえる', 'さかなが'],
  ['あかちゃんが すやすや {{}}。', 'ねむる', 'はしる', 'なげる', 'あかちゃんが'],
  ['ひこうきが そらを {{}}。', 'とぶ', 'およぐ', 'たべる', 'ひこうきが'],
  ['かえるが いけに {{}}。', 'とびこむ', 'さく', 'ふく', 'かえるが'],
];

function predFill([t, ok, w1, w2, subj]: (typeof PRED_FILL)[number]): FillItem {
  return {
    engine: 'fill',
    id: `pred-fill:${ok}:${subj}`,
    objective: 'jutsugo',
    level: 1,
    alt: true,
    prompt: 'しゅごに あう じゅつごを いれよう。',
    text: t,
    options: [ok, w1, w2],
    blanks: [
      {
        answers: [ok],
        wrong: [
          { value: w1, misconception: 'pred-mismatch' },
          { value: w2, misconception: 'pred-mismatch' },
        ],
      },
    ],
    hints: [
      `しゅごは「${subj}」だね。`,
      `「${subj}」が する ことを かんがえよう。`,
      'じっさいに できる ことは どれかな。',
    ],
    explain: `「${subj} ${ok}」で、しゅごと じゅつごが あいます。`,
    identity: `pred-fill:${ok}:${subj}`,
  };
}

/** しゅごを入れる: [文, 正解, 「を」の形, 合わない主語] */
const SUBJ_FILL: [string, string, string, string][] = [
  ['{{}} にわで ほえる。', 'いぬが', 'いぬを', 'さかなが'],
  ['{{}} そらで ひかる。', 'ほしが', 'ほしを', 'ねこが'],
  ['{{}} ほんを よむ。', 'ぼくは', 'ぼくを', 'つくえが'],
];

function subjFill([t, ok, wo, mis]: (typeof SUBJ_FILL)[number]): FillItem {
  return {
    engine: 'fill',
    id: `subj-fill:${ok}`,
    objective: 'shugo',
    level: 1,
    alt: true,
    prompt: 'しゅご（だれが・なにが）を いれよう。',
    text: t,
    options: [ok, wo, mis],
    blanks: [
      {
        answers: [ok],
        wrong: [
          { value: wo, misconception: 'subj-wo' },
          { value: mis, misconception: 'pred-mismatch' },
        ],
      },
    ],
    hints: [
      'じゅつごを さきに みよう。',
      'その ことを する のは だれ（なに）かな。',
      'しゅごは「〜が」「〜は」の かたちだよ。',
    ],
    explain: `「${ok}」を いれると、だれが（なにが）する ことかが わかる ぶんに なります。`,
    identity: `subj-fill:${ok}`,
  };
}

/** 文の型を選ぶ（別例） */
function typeAlt(target: Type, i: number): ChoiceItem {
  const pick = (list: Sent[]) => list[(i * 2 + 1) % list.length]!;
  const pool: Record<Type, Sent> = {
    dousuru: pick(DOUSURU),
    donnada: pick(DONNADA),
    nanda: pick(NANDA),
  };
  const wrongs: Wrong[] = (Object.keys(pool) as Type[])
    .filter((t) => t !== target)
    .map((t) => [text(pool[t]), 'type-mix']);
  return {
    engine: 'choice',
    id: `type:${target}:${i}`,
    objective: 'donnada',
    level: 2,
    alt: true,
    layout: 'column',
    prompt: `「なにが ${TYPE_Q[target]}」の ぶんは どれ？`,
    options: opts(text(pool[target]), wrongs),
    hints: [
      'それぞれの ぶんの じゅつご（さいごの ことば）を みよう。',
      'うごきを あらわすのが「どうする」、ようすが「どんなだ」、なまえが「なんだ」だよ。',
      `じゅつごが「${TYPE_Q[target]}」に あたる ぶんを さがそう。`,
    ],
    explain: `「${text(pool[target])}」の じゅつご「${pool[target].w[pool[target].p]}」は ${TYPE_Q[target]}に あたります。`,
    identity: `type:${target}:${pool[target].w.join('')}`,
  };
}

// ---- しゅごの ない ぶん ----
const NO_SUBJ = [
  'きのう こうえんへ いった。',
  'おいしい ごはんを たべた。',
  'あさ はやく おきた。',
  'いっしょに あそぼう。',
  'しゅくだいを おわらせた。',
  'まどを あけた。',
];
const WITH_WA = ['ぼくは はしった。', 'あねは うたった。', 'ちちは わらった。'];
const WITH_GA = ['いぬが ほえた。', 'あめが ふった。', 'はなが さいた。'];

function nashiItem(i: number): ChoiceItem {
  return {
    engine: 'choice',
    id: `nashi:${i}`,
    objective: 'nashi',
    level: 2,
    layout: 'column',
    prompt: 'しゅご（だれが・なにが）が ない ぶんは どれ？',
    options: opts(NO_SUBJ[i]!, [
      [WITH_WA[i % 3]!, 'wa-subject'],
      [WITH_GA[i % 3]!, 'missed-ga-subj'],
    ]),
    hints: [
      'それぞれの ぶんで「だれが」「なにが」に あたる ことばを さがそう。',
      '「〜は」も しゅごに なるよ。',
      'だれが したのか、ぶんの なかに かいて いない ものは どれかな。',
    ],
    explain: `「${NO_SUBJ[i]}」には、だれが したのかを あらわす ことばが ありません。ほかの ぶんには「〜は」「〜が」の しゅごが あります。`,
    identity: `nashi:${NO_SUBJ[i]}`,
  };
}

/** 別例: 1つの文に主語があるかを問う。[文, 主語でない語1, 語2] */
const NASHI_ALT: [string, string, string][] = [
  ['きのう こうえんへ いった。', 'きのう', 'こうえんへ'],
  ['あさ はやく おきた。', 'あさ', 'はやく'],
  ['まどを あけた。', 'まどを', 'あけた'],
];

function nashiAlt([s, w1, w2]: [string, string, string]): ChoiceItem {
  return {
    engine: 'choice',
    id: `nashi-alt:${s}`,
    objective: 'nashi',
    level: 2,
    alt: true,
    prompt: `「${s}」\nこの ぶんの しゅご（だれが・なにが）は どれ？`,
    options: opts('この ぶんには ない', [
      [w1, w1.endsWith('を') ? 'object-as-subj' : 'first-word-subj'],
      [w2, w2.endsWith('た') ? 'pred-as-subj' : 'other-as-subj'],
    ]),
    hints: [
      'じゅつご（どうした）は どれか みつけよう。',
      'それを したのは だれか、ぶんに かいて あるかな。',
      '「〜が」「〜は」の ことばを さがして みよう。',
    ],
    explain: `「${s}」には、だれが したのかを あらわす ことばが ありません。はなしの ながれから わかる ときは、しゅごを はぶく ことが あります。`,
    identity: `nashi-alt:${s}`,
  };
}

const items: Item[] = [
  ...DOUSURU.slice(0, 10).map((x) => predItem(x, 'jutsugo')),
  ...PRED_FILL.map(predFill),
  ...[...DOUSURU.slice(0, 7), ...DOUSURU.slice(11)].map(subjItem),
  ...SUBJ_FILL.map(subjFill),
  ...[...DONNADA, ...NANDA].map((x) => predItem(x, 'donnada')),
  typeAlt('donnada', 0),
  typeAlt('nanda', 1),
  typeAlt('dousuru', 2),
  typeAlt('donnada', 2),
  ...NO_SUBJ.map((_, i) => nashiItem(i)),
  ...NASHI_ALT.map(nashiAlt),
];

export const subjectPredicate: UnitSpec = {
  id: 'g2.ja.subject-predicate',
  title: 'しゅごと じゅつご',
  stage: 'g2',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: ['g1.ja.sentence-build'],
  objectives: [
    { id: 'jutsugo', title: 'じゅつご（どうする）を みつける' },
    { id: 'shugo', title: 'しゅご（だれが・なにが）を みつける' },
    { id: 'donnada', title: '「どんなだ」「なんだ」の じゅつご' },
    { id: 'nashi', title: 'しゅごの ない ぶん' },
  ],
  misconceptions: [
    {
      id: 'subj-as-pred',
      explain:
        '「だれが・なにが」の ことばを えらんだのかな。じゅつごは「どうする・どんなだ・なんだ」に あたる ことばだよ。',
    },
    {
      id: 'other-as-pred',
      explain:
        'ばしょや ものを あらわす ことばを えらんだのかな。じゅつごは、たいてい ぶんの おわりに あるよ。',
    },
    {
      id: 'modifier-as-pred',
      explain:
        'くわしく する ことば（とても・この など）を えらんだのかな。じゅつごは ぶんの おわりの「どんなだ・なんだ」に あたる ことばだよ。',
    },
    {
      id: 'pred-as-subj',
      explain:
        '「どうする」に あたる ことばを えらんだのかな。しゅごは その ことを する「だれが・なにが」だよ。',
    },
    {
      id: 'object-as-subj',
      explain:
        '「〜を」の ことばを えらんだのかな。「〜を」は する ことの あいてで、しゅごでは ないよ。',
    },
    {
      id: 'first-word-subj',
      explain:
        'ぶんの はじめの ことばを しゅごと かんがえたのかな。「きのう」「あさ」は いつかを あらわす ことばだよ。',
    },
    {
      id: 'other-as-subj',
      explain:
        'ばしょや ようすの ことばを えらんだのかな。しゅごは「〜が」「〜は」の かたちが おおいよ。',
    },
    {
      id: 'pred-mismatch',
      explain:
        'しゅごと じゅつごが あって いるか たしかめよう。「だれが」と「どうする」を つなげて よんで みよう。',
    },
    {
      id: 'subj-wo',
      explain: '「〜を」を つけたのかな。しゅごには「〜が」や「〜は」を つけるよ。',
    },
    {
      id: 'type-mix',
      explain:
        'じゅつごの かたちを まちがえたのかな。うごき＝どうする、ようす＝どんなだ、なまえ＝なんだ だよ。',
    },
    {
      id: 'missed-ga-subj',
      explain: '「〜が」の しゅごを みおとしたのかな。「いぬが」の ような ことばが しゅごだよ。',
    },
    {
      id: 'wa-subject',
      explain:
        '「〜は」は しゅごでは ないと かんがえたのかな。「ぼくは」の ように「〜は」も しゅごに なるよ。',
    },
  ],
  levels: [
    { label: 'どうする の ぶん', chance: 0.05 },
    { label: 'しゅごと じゅつごを あわせる', chance: 0.05 },
    { label: 'どんなだ・なんだ・しゅごの ない ぶん', chance: 0.05 },
  ],
  intro: [
    {
      text: '「とりが そらを とぶ。」で、「だれが（なにが）」に あたる「とりが」を しゅごと いいます。',
      figure: { kind: 'text', text: '**とりが** そらを とぶ。', size: 'l' },
    },
    {
      text: '「どうする」に あたる「とぶ」を じゅつごと いいます。じゅつごは ぶんの おわりに ある ことが おおいです。',
      figure: { kind: 'text', text: 'とりが そらを **とぶ**。', size: 'l' },
    },
    {
      text: 'じゅつごには「どうする」の ほかに「どんなだ（はなが きれいだ）」「なんだ（これは ほんだ）」も あります。',
    },
  ],
  source: { kind: 'items', items },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕(1)カ（文の中における主語と述語との関係に気付くこと）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
