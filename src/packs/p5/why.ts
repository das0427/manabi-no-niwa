/**
 * p5.think.why どうしてかな（curriculum-matrix 3.3・docs/expansion/p2-design/p5.md 3章）。
 * reason: 絵を見て わけを選ぶ（choice。練習は「どうして？」、別例は「どう する？」）。
 * tell: つづきを絵に描く・わけを選んで おはなしする（explain。採点しない）。
 * 同一性キー: id と同じ。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { ExplainItem } from '../../engines/explain/explain';
import { choiceItem, ill } from './lib';

/** [文, 絵, 誤概念] */
type Opt = [label: string, illust?: string, misconception?: string];

const toOpt = ([label, illust, misconception]: Opt, correct = false): ChoiceOption => ({
  label,
  ...(illust ? { figure: ill(illust) } : {}),
  ...(correct ? { correct: true } : {}),
  ...(misconception ? { misconception } : {}),
});

interface Why {
  id: string;
  figure?: string;
  prompt: string;
  right: Opt;
  wrong: Opt[];
  h2: string;
  explain: string;
  /** 別例（どう する？） */
  alt?: boolean;
  level: 0 | 1;
}

const H1_PRACTICE = 'えを よく みよう。なにが おきて いるかな。';
const H1_ALT = 'えを よく みよう。いまは どんな ときかな。';

const WHYS: Why[] = [
  // 練習 level 0（2択）
  {
    id: 'why:umbrella',
    level: 0,
    figure: 'umbrella',
    prompt: 'どうして かさを さして いるのかな？',
    right: ['あめが ふって いる', 'p5-rain'],
    wrong: [['よるに なった', 'p5-moon', 'not-related']],
    h2: 'そらから なにか ふって きて いるかな。',
    explain: 'あめが ふって いるから、ぬれないように かさを さすんだね。',
  },
  {
    id: 'why:gloves',
    level: 0,
    figure: 'life-snowman',
    prompt: 'ゆきの ひに てぶくろを するのは どうしてかな？',
    right: ['さむいから', 'eng34-face-cold'],
    wrong: [['あついから', 'eng34-face-hot', 'opposite']],
    h2: 'ゆきに さわると、どんな かんじかな。',
    explain: 'ゆきの ひは さむいから、てが つめたく ならないように てぶくろを するんだね。',
  },
  {
    id: 'why:drink',
    level: 0,
    figure: 'dog',
    prompt: 'いぬが みずを たくさん のんで いるよ。どうしてかな？',
    right: ['のどが かわいた', 'eng34-face-thirsty'],
    wrong: [['ねむく なった', 'eng34-face-sleepy', 'not-related']],
    h2: 'みずを のみたく なるのは どんな ときかな。',
    explain: 'のどが かわいたから、みずを たくさん のんで いるんだね。',
  },
  {
    id: 'why:icecream',
    level: 0,
    figure: 'p5-icecream',
    prompt: 'アイスが とけちゃった。どうしてかな？',
    right: ['あつい ひ だった', 'p5-sun'],
    wrong: [['ゆきが ふった', 'life-snowflake', 'opposite']],
    h2: 'アイスは どんな ところで とけるかな。',
    explain: 'あつい ひ だったから、アイスが とけたんだね。',
  },
  {
    id: 'why:bed',
    level: 0,
    figure: 'bear',
    prompt: 'くまさんが ふとんに はいったよ。どうしてかな？',
    right: ['ねむく なった', 'eng34-face-sleepy'],
    wrong: [['おなかが すいた', 'eng34-face-hungry', 'not-related']],
    h2: 'ふとんに はいって なにを するのかな。',
    explain: 'ねむく なったから、ふとんに はいったんだね。',
  },
  {
    id: 'why:watering',
    level: 0,
    figure: 'life-watering-can',
    prompt: 'はなに みずを あげるのは どうしてかな？',
    right: ['げんきに そだつ', 'life-sprout'],
    wrong: [['あめが ふって いる', 'p5-rain', 'opposite']],
    h2: 'みずが ないと、はなは どう なるかな。',
    explain: 'はなが げんきに そだつように、みずを あげるんだね。',
  },
  // 練習 level 1（3択）
  {
    id: 'why:handwash',
    level: 1,
    figure: 'p23-soap',
    prompt: 'ごはんの まえに てを あらうのは どうしてかな？',
    right: ['ばいきんを おとす'],
    wrong: [
      ['てを あたためる', undefined, 'not-related'],
      ['ごはんを たべた', undefined, 'after'],
    ],
    h2: 'てに ついた よごれは、どう なると いいかな。',
    explain: 'てに ついた ばいきんを おとして、きれいな てで たべるためだね。',
  },
  {
    id: 'why:teeth',
    level: 1,
    figure: 'p23-toothbrush',
    prompt: 'ねる まえに はを みがくのは どうしてかな？',
    right: ['むしばに ならない'],
    wrong: [
      ['ねむく なる', undefined, 'not-related'],
      ['おなかが すく', undefined, 'not-related'],
    ],
    h2: 'はに たべかすが のこると、どう なるかな。',
    explain: 'たべかすを とって、むしばに ならないように みがくんだね。',
  },
  {
    id: 'why:frog',
    level: 1,
    figure: 'frog',
    prompt: 'かえるが うれしそう。どうしてかな？',
    right: ['あめが ふって きた', 'p5-rain'],
    wrong: [
      ['ゆきが ふって きた', 'life-snowflake', 'opposite'],
      ['よるに なった', 'p5-moon', 'not-related'],
    ],
    h2: 'かえるは どんな ひに げんきかな。',
    explain: 'かえるは しめった ところが すき。あめが ふると げんきに なるよ。',
  },
  {
    id: 'why:balloon',
    level: 1,
    figure: 'p5-balloon',
    prompt: 'ふうせんが そらへ とんで いったよ。どうしてかな？',
    right: ['てを はなした'],
    wrong: [
      ['ひもを もって いた', undefined, 'opposite'],
      ['あめが ふった', undefined, 'not-related'],
    ],
    h2: 'ふうせんの ひもは、どう なって いたかな。',
    explain: 'ひもから てを はなしたから、ふうせんが とんで いったんだね。',
  },
  {
    id: 'why:autumn',
    level: 1,
    figure: 'life-redleaf',
    prompt: 'はっぱの いろが かわったよ。どうしてかな？',
    right: ['あきに なった'],
    wrong: [
      ['なつに なった', undefined, 'opposite'],
      ['みずを あげた', undefined, 'not-related'],
    ],
    h2: 'すずしく なるのは どの きせつかな。',
    explain: 'あきに なって すずしく なると、はっぱの いろが かわるよ。',
  },
  {
    id: 'why:smile',
    level: 1,
    figure: 'rabbit',
    prompt: 'うさぎが にこにこ して いるよ。どうしてかな？',
    right: ['にんじんを もらった'],
    wrong: [
      ['ころんで いたい', undefined, 'opposite'],
      ['ねむく なった', undefined, 'not-related'],
    ],
    h2: 'うれしく なるのは、どんな ときかな。',
    explain: 'すきな にんじんを もらって、うれしいんだね。',
  },
  // 別例（どう する？）
  {
    id: 'act:rain',
    level: 0,
    alt: true,
    figure: 'p5-rain',
    prompt: 'あめが ふって きたよ。どう するかな？',
    right: ['かさを さす', 'umbrella'],
    wrong: [['アイスを たべる', 'p5-icecream', 'not-related']],
    h2: 'ぬれないように するには？',
    explain: 'あめに ぬれないように、かさを さそうね。',
  },
  {
    id: 'act:dirty',
    level: 0,
    alt: true,
    prompt: 'どろあそびで てが よごれたよ。どう するかな？',
    right: ['てを あらう', 'p23-soap'],
    wrong: [['ふとんで ねる', 'p23-pillow', 'not-related']],
    h2: 'よごれを おとすには？',
    explain: 'よごれた ては、せっけんで あらおうね。',
  },
  {
    id: 'act:cold',
    level: 1,
    alt: true,
    figure: 'eng34-face-cold',
    prompt: 'さむく なって きたよ。どう するかな？',
    right: ['うわぎを きる'],
    wrong: [
      ['みずを あびる', undefined, 'opposite'],
      ['うちわで あおぐ', undefined, 'opposite'],
    ],
    h2: 'からだを あたたかく するには？',
    explain: 'うわぎを きて、からだを あたたかく しようね。',
  },
  {
    id: 'act:sleepy',
    level: 1,
    alt: true,
    figure: 'eng34-face-sleepy',
    prompt: 'ねむく なって きたよ。どう するかな？',
    right: ['ふとんで ねる'],
    wrong: [
      ['はしって あそぶ', undefined, 'opposite'],
      ['ごはんを つくる', undefined, 'not-related'],
    ],
    h2: 'からだを やすめるには？',
    explain: 'ねむい ときは、ふとんで ゆっくり ねようね。',
  },
];

function reasonItem(w: Why): Item {
  const all = [w.right, ...w.wrong];
  const allFig = all.every((o) => o[1] !== undefined);
  return choiceItem({
    id: w.id,
    objective: 'reason',
    level: w.level,
    ...(w.alt ? { alt: true } : {}),
    prompt: w.prompt,
    ...(w.figure ? { figure: ill(w.figure) } : {}),
    hints: [w.alt ? H1_ALT : H1_PRACTICE, w.h2],
    explain: w.explain,
    identity: w.id,
    layout: allFig ? 'row' : 'column',
    correct: toOpt(w.right),
    wrong: w.wrong.map((o) => toOpt(o)),
  });
}

const TELL_H2 = 'かいたら、どうして そう おもったか、おうちの ひとに おはなし しよう。';
const TELL_REASON_H2 = 'えらんだら、どうして そう おもったか、おうちの ひとに おはなし しよう。';

/** つづきを かく（練習） */
const DRAWS: [id: string, figure: string, prompt: string][] = [
  ['draw:rain-stop', 'p5-rain', 'あめが やんだよ。この あと どう なる？ えに かこう。'],
  ['draw:snowman', 'life-snowman', 'ゆきだるまに おひさまが あたるよ。この あと どう なる？'],
  ['draw:seed', 'life-seed', 'たねを まいて みずを あげたよ。この あと どう なる？'],
  ['draw:icecream', 'p5-icecream', 'あつい ひに アイスを そとに おいたよ。この あと どう なる？'],
  ['draw:balloon', 'p5-balloon', 'ふうせんに いきを どんどん いれると、どう なる？'],
  ['draw:frog', 'frog', 'かえるが いけに とびこんだよ。この あと どう なる？'],
];
/** わけを えらんで おはなし（別例） */
const TELLS: [id: string, figure: string, prompt: string, reasons: string[]][] = [
  [
    'tell:sad',
    'eng34-face-sad',
    'かなしそうな かお。どうして だと おもう？',
    ['ころんだ', 'おもちゃが こわれた', 'ともだちと けんか した'],
  ],
  [
    'tell:happy',
    'eng34-face-happy',
    'うれしそうな かお。どうして だと おもう？',
    ['ほめられた', 'おいしい ものを たべた', 'ともだちと あそんだ'],
  ],
  [
    'tell:tired',
    'eng34-face-tired',
    'つかれた かお。どうして だと おもう？',
    ['たくさん はしった', 'おそくまで おきて いた', 'おもい ものを はこんだ'],
  ],
];

function drawItem([id, figure, prompt]: (typeof DRAWS)[number]): ExplainItem {
  return {
    engine: 'explain',
    id,
    objective: 'tell',
    level: 2,
    prompt,
    figure: ill(figure),
    canvas: { aspect: 4 / 3 },
    hints: ['えを よく みて、つぎに おきる ことを かんがえよう。', TELL_H2],
    explain: 'かけたね。どうして そう おもったのか、おうちの ひとに おはなし してね。',
    identity: id,
  };
}

function tellItem([id, figure, prompt, reasons]: (typeof TELLS)[number]): ExplainItem {
  return {
    engine: 'explain',
    id,
    objective: 'tell',
    level: 2,
    alt: true,
    prompt,
    figure: ill(figure),
    reasons: [...reasons, 'ほかの わけ'].map((label) => ({ label })),
    require: { reason: true, drawing: false },
    hints: ['かおを よく みて、どんな きもちか かんがえよう。', TELL_REASON_H2],
    explain: 'わけは いろいろ あるね。じぶんの かんがえを おうちの ひとに おはなし しよう。',
    identity: id,
  };
}

export const thinkWhy: UnitSpec = {
  id: 'p5.think.why',
  title: 'どうしてかな',
  stage: 'p5',
  subject: 'think',
  domain: 'play',
  kind: 'record',
  priority: 'P2',
  status: 'ready',
  icon: 'p5-rain',
  prereq: [],
  objectives: [
    { id: 'reason', title: 'えを みて、わけを えらぶ' },
    { id: 'tell', title: 'つぎを かんがえて えに かく・わけを おはなし する' },
  ],
  misconceptions: [
    {
      id: 'opposite',
      explain:
        'はんたいの ときの わけだと かんがえたのかな。えを よく みて、いまは どんな ときか たしかめよう。',
    },
    {
      id: 'not-related',
      explain:
        'えと かんけいの ない ことが わけだと かんがえたのかな。えの なかに わけが かくれて いるよ。',
    },
    {
      id: 'after',
      explain:
        'あとで する ことが わけだと かんがえたのかな。てを あらうのは たべる まえ。どうして まえに あらうのか かんがえよう。',
    },
  ],
  levels: [
    { label: '2つから えらぶ', chance: 0.5 },
    { label: '3つから えらぶ', chance: 1 / 3 },
    { label: 'えで かんがえる', chance: 0.1 },
  ],
  intro: [
    {
      text: 'えを よく みて、「どうしてかな？」と かんがえよう。',
      figure: ill('umbrella'),
    },
    {
      text: 'かんがえた ことは、おうちの ひとに おはなし してね。',
      figure: ill('house'),
    },
  ],
  source: {
    kind: 'items',
    items: [...WHYS.map(reasonItem), ...DRAWS.map(drawItem), ...TELLS.map(tellItem)],
  },
  review: 'none',
  basis:
    '幼稚園教育要領（幼児期の終わりまでに育ってほしい姿: 思考力の芽生え・言葉による伝え合い）、EC 2.4（理由は選択か絵で。言葉で言うのは画面外の親子の会話に任せる）、curriculum-matrix 3.3・4.4',
  gradeIsAppProposal: true,
  revised: '2026-10-30',
};
