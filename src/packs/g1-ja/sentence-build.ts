/**
 * g1.ja.sentence-build ぶんを つくろう（だれが・どうする。curriculum-matrix 3.4）。
 *
 * 到達項目:
 *   two   … 「だれが」＋「どうする」の 2まいで ぶんを つくる（build）。別例: 「〜が」に つづく ことばを えらぶ
 *   three … 「だれが」＋「なにを」＋「どうする」の 3まいで ぶんを つくる（build）。別例: ただしい ぶんを えらぶ
 *   pick  … えに あう ぶんを えらぶ（choice）。別例: ぶんに なって いる ものを えらぶ
 * 同一性キー: ぶん（だれが・なにを・どうする の くみ）。
 */
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import type { BuildItem } from '../../engines/build/build';
import { opts, REVISED } from './util';

/** だれが（ことば・絵）, どうする, あわない うごき */
interface Two {
  who: string;
  illust: string;
  verb: string;
  unfit: string;
}

const TWOS: Two[] = [
  { who: 'いぬ', illust: 'dog', verb: 'ほえる', unfit: 'さく' },
  { who: 'とり', illust: 'bird', verb: 'とぶ', unfit: 'ほえる' },
  { who: 'かえる', illust: 'frog', verb: 'はねる', unfit: 'ほえる' },
  { who: 'ねこ', illust: 'cat', verb: 'ねる', unfit: 'ふる' },
  { who: 'たこ', illust: 'octopus', verb: 'およぐ', unfit: 'はしる' },
  { who: 'ぞう', illust: 'elephant', verb: 'あるく', unfit: 'ふる' },
  { who: 'さる', illust: 'monkey', verb: 'のぼる', unfit: 'さく' },
  { who: 'きつね', illust: 'fox', verb: 'はしる', unfit: 'ひかる' },
  { who: 'ひよこ', illust: 'chick', verb: 'なく', unfit: 'ふる' },
  { who: 'くま', illust: 'bear', verb: 'ねむる', unfit: 'さく' },
  { who: 'うさぎ', illust: 'rabbit', verb: 'はねる', unfit: 'ひかる' },
  { who: 'かめ', illust: 'turtle', verb: 'およぐ', unfit: 'ふる' },
  { who: 'うし', illust: 'cow', verb: 'なく', unfit: 'ひかる' },
];

function twoBuild(t: Two): BuildItem {
  return {
    engine: 'build',
    id: `two:${t.who}`,
    objective: 'two',
    level: 0,
    prompt: 'えを みて、「だれが」と 「どうする」の カードで ぶんを つくろう。',
    figure: { kind: 'illust', id: t.illust },
    tiles: [`${t.who}が`, t.verb, `${t.who}を`, t.unfit],
    joiner: ' ',
    answer: { kind: 'text', values: [`${t.who}が ${t.verb}`] },
    wrongAnswers: [
      { value: `${t.verb} ${t.who}が`, misconception: 'order-reverse' },
      { value: `${t.who}を ${t.verb}`, misconception: 'ga-missing' },
      { value: `${t.who}が ${t.unfit}`, misconception: 'not-fit' },
    ],
    hints: [
      'さいしょに 「だれが」の カードを おこう。',
      '「だれが」の カードは 「が」で おわるよ。',
      `「${t.who}が」の あとに、${t.who}が する ことを おこう。`,
    ],
    explain: `「${t.who}が」（だれが）＋「${t.verb}」（どうする）で、「${t.who}が ${t.verb}。」 だよ。`,
    identity: `two:${t.who}-${t.verb}`,
  };
}

/** 別例: 「〜が」に つづく ことば */
function twoAlt(t: Two): ChoiceItem {
  return {
    engine: 'choice',
    id: `two-alt:${t.who}`,
    objective: 'two',
    level: 0,
    alt: true,
    prompt: `「${t.who}が」の あとに つづけて、ぶんに なる ことばは どれ？`,
    options: opts(t.verb, [
      [t.unfit, 'not-fit'],
      ['くさ', 'no-predicate'],
    ]),
    hints: [
      'ぶんの さいごには 「どうする」が くるよ。',
      `${t.who}は なにを するかな。`,
      '「くさ」は うごきを あらわす ことばかな。',
    ],
    explain: `「${t.who}が ${t.verb}。」で ぶんに なるよ。`,
    identity: `two-alt:${t.who}-${t.verb}`,
  };
}

/** だれが, なにを, どうする */
interface Three {
  who: string;
  what: string;
  verb: string;
  illust?: string;
}

const THREES: Three[] = [
  { who: 'ねこ', what: 'さかな', verb: 'たべる', illust: 'cat' },
  { who: 'うさぎ', what: 'にんじん', verb: 'たべる', illust: 'rabbit' },
  { who: 'さる', what: 'バナナ', verb: 'たべる', illust: 'monkey' },
  { who: 'いぬ', what: 'ボール', verb: 'おいかける', illust: 'dog' },
  { who: 'かえる', what: 'むし', verb: 'たべる', illust: 'frog' },
  { who: 'ぞう', what: 'みず', verb: 'のむ', illust: 'elephant' },
  { who: 'わたし', what: 'え', verb: 'かく' },
  { who: 'ともだち', what: 'ほん', verb: 'よむ' },
  { who: 'おとうさん', what: 'ごはん', verb: 'つくる' },
  { who: 'こども', what: 'ボール', verb: 'なげる' },
  { who: 'おかあさん', what: 'くるま', verb: 'あらう' },
  { who: 'ぼく', what: 'はな', verb: 'そだてる' },
  { who: 'くま', what: 'はちみつ', verb: 'なめる', illust: 'bear' },
];

function threeBuild(t: Three): BuildItem {
  const ans = `${t.who}が ${t.what}を ${t.verb}`;
  return {
    engine: 'build',
    id: `three:${t.who}`,
    objective: 'three',
    level: 1,
    prompt: '「だれが」「なにを」「どうする」の カードで ぶんを つくろう。',
    figure: t.illust ? { kind: 'illust', id: t.illust } : undefined,
    tiles: [`${t.who}が`, `${t.what}を`, t.verb, `${t.what}が`, `${t.who}を`],
    joiner: ' ',
    // 「なにを」を さきに おいても ただしい ぶん
    answer: { kind: 'text', values: [ans, `${t.what}を ${t.who}が ${t.verb}`] },
    wrongAnswers: [
      { value: `${t.what}が ${t.who}を ${t.verb}`, misconception: 'role-swap' },
      { value: `${t.verb} ${t.who}が ${t.what}を`, misconception: 'order-reverse' },
      { value: `${t.who}を ${t.what}を ${t.verb}`, misconception: 'ga-missing' },
    ],
    hints: [
      `${t.verb}のは だれかな。`,
      '「だれが」の カードは 「が」、「なにを」の カードは 「を」で おわるよ。',
      `「${t.who}が」から はじめて、さいごに 「どうする」を おこう。`,
    ],
    explain: `「${ans}。」 ${t.who}が（だれが）、${t.what}を（なにを）、${t.verb}（どうする） だよ。`,
    identity: `three:${t.who}-${t.what}-${t.verb}`,
  };
}

function threeAlt(t: Three): ChoiceItem {
  return {
    engine: 'choice',
    id: `three-alt:${t.who}`,
    objective: 'three',
    level: 1,
    alt: true,
    prompt: 'ただしい ぶんは どれ？',
    layout: 'column',
    options: opts(`${t.who}が ${t.what}を ${t.verb}。`, [
      [`${t.what}が ${t.who}を ${t.verb}。`, 'role-swap'],
      [`${t.verb} ${t.who}が ${t.what}を。`, 'order-reverse'],
    ]),
    hints: [
      `${t.verb}のは だれかな。`,
      '「だれが」には 「が」が つくよ。',
      '「どうする」は ぶんの さいごに くるよ。',
    ],
    explain: `${t.verb}のは ${t.who}。「${t.who}が ${t.what}を ${t.verb}。」 だよ。`,
    identity: `three-alt:${t.who}-${t.what}-${t.verb}`,
  };
}

/** えに あう ぶん（pick）。ちがう どうぶつは えで みわける */
function pickItem(t: Two, other: Two): ChoiceItem {
  return {
    engine: 'choice',
    id: `pick:${t.who}`,
    objective: 'pick',
    level: 2,
    prompt: 'えに あう ぶんは どれ？',
    figure: { kind: 'illust', id: t.illust },
    layout: 'column',
    options: opts(`${t.who}が ${t.verb}。`, [
      [`${other.who}が ${t.verb}。`, 'not-fit'],
      [`${t.who}を ${t.verb}。`, 'ga-missing'],
      [`${t.verb}が ${t.who}。`, 'order-reverse'],
    ]),
    hints: [
      'えに いるのは だれかな。',
      '「だれが」の ことばには 「が」が つくよ。',
      `えに いるのは ${t.who}。あとは 「が」と じゅんばんを たしかめよう。`,
    ],
    explain: `えに いるのは ${t.who}。「${t.who}が ${t.verb}。」 だよ。`,
    identity: `pick:${t.who}-${t.verb}`,
  };
}

/** 別例: ぶんに なって いる ものを えらぶ（えなし） */
function pickAlt(t: Two): ChoiceItem {
  return {
    engine: 'choice',
    id: `pick-alt:${t.who}`,
    objective: 'pick',
    level: 2,
    alt: true,
    prompt: '「だれが」と 「どうする」が そろった ぶんは どれ？',
    layout: 'column',
    options: opts(`${t.who}が ${t.verb}。`, [
      [`${t.who}が。`, 'no-predicate'],
      [`${t.verb}。`, 'no-predicate'],
      [`${t.who}を ${t.verb}。`, 'ga-missing'],
    ]),
    hints: [
      'ぶんには 「だれが」と 「どうする」が いるよ。',
      '「だれが」の ことばには 「が」が つくよ。',
      '「どうする」が ない ぶん、「だれが」が ない ぶんを のぞこう。',
    ],
    explain: `「${t.who}が」（だれが）と 「${t.verb}」（どうする）が そろって いるね。`,
    identity: `pick-alt:${t.who}-${t.verb}`,
  };
}

const PICK_IDX = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const PICK_ALT_IDX = [9, 10, 11, 12];

const items: Item[] = [
  ...TWOS.slice(0, 10).map(twoBuild),
  ...TWOS.slice(10).concat(TWOS.slice(0, 1)).map(twoAlt),
  ...THREES.slice(0, 10).map(threeBuild),
  ...THREES.slice(10).map(threeAlt),
  ...PICK_IDX.map((i) => pickItem(TWOS[i]!, TWOS[(i + 1) % TWOS.length]!)),
  ...PICK_ALT_IDX.map((i) => pickAlt(TWOS[i]!)),
];

export const sentenceBuild: UnitSpec = {
  id: 'g1.ja.sentence-build',
  title: 'ぶんを つくろう',
  stage: 'g1',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: ['g1.ja.particles'],
  objectives: [
    { id: 'two', title: '「だれが」「どうする」で ぶんを つくる' },
    { id: 'three', title: '「だれが」「なにを」「どうする」で ぶんを つくる' },
    { id: 'pick', title: 'えに あう ぶんを えらぶ' },
  ],
  misconceptions: [
    {
      id: 'order-reverse',
      explain:
        '「どうする」を さきに おいたのかな。にほんごの ぶんは 「だれが」から はじめて、「どうする」で おわるよ。',
    },
    {
      id: 'ga-missing',
      explain:
        '「だれが」の ところに 「を」を つかったのかな。する ひと・ものには 「が」を つけるよ。',
    },
    {
      id: 'role-swap',
      explain:
        '「だれが」と 「なにを」が いれかわったのかな。うごいて いるのは だれか、えや おはなしで たしかめよう。',
    },
    {
      id: 'not-fit',
      explain:
        'えや 「だれが」に あわない ことばを えらんだのかな。その どうぶつが ほんとうに する ことか かんがえよう。',
    },
    {
      id: 'no-predicate',
      explain:
        '「どうする」（うごきの ことば）が たりないのかな。ぶんには 「だれが」と 「どうする」が いるよ。',
    },
  ],
  levels: [
    { label: '2まいで ぶん', chance: 0.05 },
    { label: '3まいで ぶん', chance: 0.05 },
    { label: 'えに あう ぶん', chance: 0.1 },
  ],
  intro: [
    { text: 'えを みよう。いぬが ほえて いるね。', figure: { kind: 'illust', id: 'dog' } },
    {
      text: '「だれが」の カードは 「いぬが」、「どうする」の カードは 「ほえる」。',
      figure: { kind: 'text', text: 'いぬが ＋ ほえる', size: 'l' },
    },
    {
      text: 'じゅんに ならべると、「いぬが ほえる。」 という ぶんに なるよ。',
      figure: { kind: 'text', text: 'いぬが ほえる。', size: 'xl' },
    },
  ],
  source: { kind: 'items', items },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕(1)カ（文の中における主語と述語との関係に気付くこと）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
