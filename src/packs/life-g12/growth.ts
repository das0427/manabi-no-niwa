/**
 * g2.life.growth 自分の成長（できるようになったことの記録、前と比べる）（curriculum-matrix 3.5、生活 (9)）。
 *
 * すべて「かいてみよう」（explain）で、正解を決めない。まちがいと言わず、本人の考えを記録として残す。
 * 保護者画面でかいたものを見られる（保存は統括の仕組み）。
 *
 * 到達項目:
 *   then-now … 1年生のはじめとくらべて、できるようになったことを かく。別例 = 気持ちや理由を えらぶ
 *   thanks   … 支えてくれた人に伝えたいことを かく。別例 = 伝え方・相手を えらぶ
 * 同一性キー: 問題の id。
 */
import type { ExplainItem, Item, UnitSpec } from '../../curriculum/types';
import { baseLife, explainItem, illust } from './util';

const EXPLAIN =
  'じぶんの かんがえを かいたね。じぶんの せいちょうは、じぶんだけの たからものだよ。ほかの ひとと ちがって いても だいじょうぶ。';
const CHOOSE_EXPLAIN =
  'じぶんの きもちを えらんだね。どれを えらんでも だいじょうぶ。だれかに はなして みよう。';

interface Dr {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  guide?: 'none' | 'lines';
  hints: [string, string, string];
}
const DRAWS: Dr[] = [
  {
    id: 't1',
    obj: 'then-now',
    level: 0,
    prompt: '1年生《ねんせい》の はじめに できなかった ことで、いま できる ように なった ことを えに かこう。',
    hints: [
      '1年生《ねんせい》に なった ころを おもいだして みよう。',
      'いまは かんたんに できる ことは、なにかな。',
      'ひとつ えらんで、えに かこう。',
    ],
  },
  {
    id: 't2',
    obj: 'then-now',
    level: 0,
    prompt: 'できる ように なった ことを ひとつ えらんで、どうして できる ように なったか、ことばで かこう。',
    guide: 'lines',
    hints: [
      'できる ように なった ことを、ひとつ えらぼう。',
      'だれかに おしえて もらったかな。なんども やったかな。',
      'おもった ことを、ことばで かこう。',
    ],
  },
  {
    id: 't3',
    obj: 'then-now',
    level: 0,
    prompt: 'からだが かわった ところ（せが のびた、てが おおきく なった など）を えに かこう。',
    hints: [
      'せいくらべや、てや あしの おおきさを おもいだして みよう。',
      '1年生《ねんせい》の ころの ふくや くつと くらべても いいよ。',
      'かわった ところを ひとつ えらんで かこう。',
    ],
  },
  {
    id: 't4',
    obj: 'then-now',
    level: 1,
    prompt: '友《とも》だちと の ことで、1年生《ねんせい》の ころより なかよく なった ことを かこう。',
    hints: [
      'いま、いちばん なかよしの ともだちを おもいだして みよう。',
      'どんな ときに なかよく なれたかな。',
      'いっしょに した ことを えに かこう。',
    ],
  },
  {
    id: 't5',
    obj: 'then-now',
    level: 1,
    prompt: '1年生《ねんせい》の ころ むずかしかった ことは なにかな。いまは どうかな。かこう。',
    guide: 'lines',
    hints: [
      '1年生《ねんせい》の ころの ことを おもいだして みよう。',
      'いまは かんたんに なった ことも あるよ。',
      'まえと いまを、ことばで くらべて かこう。',
    ],
  },
  {
    id: 't6',
    obj: 'then-now',
    level: 1,
    prompt: 'いま、じぶんの すきな ことや じまんしたい ことを えに かこう。',
    hints: [
      'すきな ことは なにかな。',
      'じぶんが とくいな ことも おもいだして みよう。',
      'ひとつ えらんで、えに かこう。',
    ],
  },
  {
    id: 'k1',
    obj: 'thanks',
    level: 0,
    prompt: 'おうちの ひとに「ありがとう」を つたえたい ことを えに かこう。',
    hints: [
      'おうちの ひとが して くれた ことを おもいだして みよう。',
      'ごはん、せんたく、おむかえ など、いろいろ あるね。',
      'ひとつ えらんで、えに かこう。',
    ],
  },
  {
    id: 'k2',
    obj: 'thanks',
    level: 0,
    prompt: '学校《がっこう》で たすけて くれた ひと（先生《せんせい》や 友《とも》だち）を えに かこう。',
    hints: [
      '学校《がっこう》で こまった ときを おもいだして みよう。',
      'だれが たすけて くれたかな。',
      'そのひとの かおを えに かこう。',
    ],
  },
  {
    id: 'k3',
    obj: 'thanks',
    level: 0,
    prompt: 'やさしく して くれた ひとに、つたえたい ことばを かこう。',
    guide: 'lines',
    hints: [
      'やさしく して くれた ひとを おもいうかべよう。',
      'どんな ことが うれしかったかな。',
      '「ありがとう」の あとに、うれしかった わけも かいて みよう。',
    ],
  },
  {
    id: 'k4',
    obj: 'thanks',
    level: 1,
    prompt: 'じぶんが ひとを たすけて あげた ことを えに かこう。',
    hints: [
      'だれかを たすけた ことを おもいだして みよう。',
      'どんな ことを して あげたかな。',
      'そのとき、あいては どんな かおを して いたかな。',
    ],
  },
  {
    id: 'k5',
    obj: 'thanks',
    level: 1,
    prompt: 'こまった とき、たすけて くれた ひとは だれかな。えに かこう。',
    hints: [
      'こまった ときの ことを おもいだして みよう。',
      'そのとき、だれが そばに いたかな。',
      'そのひとを えに かこう。',
    ],
  },
  {
    id: 'k6',
    obj: 'thanks',
    level: 1,
    prompt: 'これから「ありがとう」を つたえたい ひとを えに かこう。',
    hints: [
      'いつも おせわに なって いる ひとを おもいだして みよう。',
      'まだ ありがとうを いって いない ひとは いるかな。',
      'ひとり えらんで、えに かこう。',
    ],
  },
];
const drawItems: ExplainItem[] = DRAWS.map((d) =>
  explainItem({
    id: d.id,
    obj: d.obj,
    level: d.level,
    prompt: d.prompt,
    canvas: { aspect: 4 / 3, guide: d.guide ?? 'none' },
    hints: d.hints,
    explain: EXPLAIN,
  }),
);

interface Ch {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  reasons: string[];
  multi?: boolean;
  hints: [string, string, string];
}
const CHOICES: Ch[] = [
  {
    id: 't-alt-a1',
    obj: 'then-now',
    level: 0,
    prompt: 'できる ように なった とき、どんな きもちに なったかな。（いくつでも えらべるよ）',
    reasons: ['うれしい', 'ほこらしい', 'もっと やりたい', 'ほっと した'],
    multi: true,
    hints: [
      'できる ように なった ときを おもいだして みよう。',
      'そのとき、むねが どうなったかな。',
      'いくつでも、えらんで いいよ。',
    ],
  },
  {
    id: 't-alt-a2',
    obj: 'then-now',
    level: 1,
    prompt: 'どうやって できる ように なったかな。（いくつでも えらべるよ）',
    reasons: ['なんども れんしゅうした', 'おしえて もらった', 'まねを して みた', 'あきらめなかった'],
    multi: true,
    hints: [
      'できる ように なる まで の ことを おもいだして みよう。',
      'だれかに たすけて もらったかな。じぶんで がんばったかな。',
      'あてはまる ものを、いくつでも えらぼう。',
    ],
  },
  {
    id: 't-alt-a3',
    obj: 'then-now',
    level: 1,
    prompt: 'これから したい ことは どれかな。ひとつ えらぼう。',
    reasons: ['もっと とくいに なる', 'あたらしい ことを して みる', '友《とも》だちを たすける'],
    hints: [
      'これから の じぶんを おもいうかべよう。',
      'いちばん したい ことは どれかな。',
      'どれを えらんでも だいじょうぶ。',
    ],
  },
  {
    id: 'k-alt-a1',
    obj: 'thanks',
    level: 0,
    prompt: '「ありがとう」を つたえる ほうほうを えらぼう。',
    reasons: ['ことばで いう', 'てがみに かく', 'えを かいて わたす'],
    hints: [
      'あいてが よろこぶ ほうほうは どれかな。',
      'はなして つたえる、かいて つたえる、えで つたえる の ちがいを かんがえよう。',
      'じぶんの すきな ほうほうを えらぼう。',
    ],
  },
  {
    id: 'k-alt-a2',
    obj: 'thanks',
    level: 1,
    prompt: 'だれに「ありがとう」を つたえたいかな。（いくつでも えらべるよ）',
    reasons: ['おうちの ひと', '先生《せんせい》', '友《とも》だち', 'ちかくの ひと'],
    multi: true,
    hints: [
      'おせわに なった ひとを おもいだして みよう。',
      'おうちの なかと そとで、たすけて くれた ひとが いるね。',
      'いくつでも、えらんで いいよ。',
    ],
  },
  {
    id: 'k-alt-a3',
    obj: 'thanks',
    level: 1,
    prompt: 'つたえたい ことば は どれかな。',
    reasons: ['たすけて くれて ありがとう', 'おしえて くれて ありがとう', 'いつも ありがとう'],
    hints: [
      'あいてに どんな ことを つたえたいかな。',
      'どんな ことが うれしかったかを おもいだして みよう。',
      'いちばん つたえたい ことばを えらぼう。',
    ],
  },
];
const choiceItems: ExplainItem[] = CHOICES.map((c) =>
  explainItem({
    id: c.id,
    obj: c.obj,
    level: c.level,
    alt: true,
    prompt: c.prompt,
    reasons: c.reasons,
    multi: c.multi,
    hints: c.hints,
    explain: CHOOSE_EXPLAIN,
  }),
);

const items: Item[] = [...drawItems, ...choiceItems];

export const growth: UnitSpec = {
  ...baseLife('g2.life.growth', 'g2'),
  title: 'じぶんの せいちょう',
  kind: 'record',
  prereq: [],
  objectives: [
    { id: 'then-now', title: '1年生《ねんせい》の はじめと くらべて、できるように なった ことを かく' },
    { id: 'thanks', title: 'たすけて くれた ひとに つたえたい ことを かく' },
  ],
  misconceptions: [
    {
      id: 'compare-others',
      explain:
        'ほかの ひとと くらべて しまったのかな。くらべる あいては、まえの じぶんだよ。じぶんの せいちょうを みつけよう。',
    },
    {
      id: 'no-thanks',
      explain:
        'たすけて くれた ひとを おもいだせなかったのかな。ちいさな ことでも、だれかに たすけて もらって いるよ。',
    },
  ],
  levels: [
    { label: 'おもいだして かく', chance: 0.1 },
    { label: 'くらべて かく', chance: 0.1 },
  ],
  intro: [
    {
      text: '1年生《ねんせい》の はじめと くらべて、できる ように なった ことを かこう。',
      figure: illust('life-sprout'),
    },
    {
      text: 'まちがいは ないよ。じぶんの かんがえを えや ことばで かいて みよう。かいた ものは、おうちの ひとも みられるよ。',
    },
    {
      text: 'たすけて くれた ひとに、つたえたい ことも かいて みよう。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）生活 (9)（自分の成長: できるようになったこと、支えてくれた人への感謝）。学年の割当は本アプリの案（生活は第1・2学年のまとまり）。採点しない記録（explain）',
  gradeIsAppProposal: true,
};
