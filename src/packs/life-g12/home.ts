/**
 * g1.life.home おうちで できる こと（curriculum-matrix 3.4、生活 (2)）。設計: docs/expansion/p2-design/life-g12.md
 *
 * すべて「かいてみよう」（explain）で、正解を決めない。採点しない記録（保護者画面で見る）。
 * 家族の形と家の仕事は家庭ごとに違うので「おうちの ひと」と書く。火・はものを勧めない。
 *
 * 到達項目:
 *   my-role … おうちで じぶんが できる ことを かく。別例 = ことばを えらぶ
 *   family  … おうちの ひとが して くれて いる ことを かく。別例 = ことばを えらぶ
 * 同一性キー: 問題の id。
 */
import type { ExplainItem, Item, UnitSpec } from '../../curriculum/types';
import { baseLife, explainItem, illust } from './util';

const EXPLAIN =
  'じぶんの かんがえを かいたね。かいた ものを おうちの ひとに みせて、はなして みよう。';
const CHOOSE_EXPLAIN =
  'じぶんの かんがえを えらんだね。どれを えらんでも だいじょうぶ。おうちの ひとと はなして みよう。';

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
    id: 'r1',
    obj: 'my-role',
    level: 0,
    prompt: 'おうちで、じぶんで できる ことを えに かこう。',
    hints: [
      'あさ おきてから、よる ねるまでを おもいだして みよう。',
      'きがえ、はみがき、くつを そろえる など、いろいろ あるね。',
      'ひとつ えらんで、えに かこう。',
    ],
  },
  {
    id: 'r2',
    obj: 'my-role',
    level: 0,
    prompt: 'おうちの ひとの ために できる おてつだいを えに かこう。',
    hints: [
      'おうちの ひとが して いる ことを おもいだして みよう。',
      'はこぶ、ならべる、たたむ など、てつだえる ことが あるね。',
      'ひとつ えらんで、えに かこう。',
    ],
  },
  {
    id: 'r3',
    obj: 'my-role',
    level: 0,
    prompt: 'おてつだいを した とき、どんな きもちに なったかな。ことばで かこう。',
    guide: 'lines',
    hints: [
      'おてつだいを した ときを おもいだして みよう。',
      'おうちの ひとは、なんと いって くれたかな。',
      'その ときの きもちを、ことばで かこう。',
    ],
  },
  {
    id: 'r4',
    obj: 'my-role',
    level: 1,
    prompt: 'これから まいにち やって みたい おうちの しごとを、ひとつ えに かこう。',
    hints: [
      'じぶんに できそうな しごとを おもいうかべよう。',
      'まいにち つづけられる ことが いいね。',
      'ひとつ きめて、やって いる ところを えに かこう。',
    ],
  },
  {
    id: 'r5',
    obj: 'my-role',
    level: 1,
    prompt: 'おてつだいを する とき、きを つけた ことを ことばで かこう。',
    guide: 'lines',
    hints: [
      'おてつだいを した ときを おもいだして みよう。',
      'おとさない ように、こぼさない ように した ことは あるかな。',
      'きを つけた ことを ひとつ、ことばで かこう。',
    ],
  },
  {
    id: 'r6',
    obj: 'my-role',
    level: 1,
    prompt: 'じぶんの ものを、じぶんで かたづけて いる ところを えに かこう。',
    hints: [
      'じぶんの ものは、どこに しまって いるかな。',
      'おもちゃ、ふく、がっこうの どうぐ など、いろいろ あるね。',
      'かたづけて いる じぶんを えに かこう。',
    ],
  },
  {
    id: 'f1',
    obj: 'family',
    level: 0,
    prompt: 'おうちの ひとが、じぶんの ために して くれて いる ことを えに かこう。',
    hints: [
      'あさから よるまでの ことを おもいだして みよう。',
      'ごはん、せんたく、おくりむかえ など、いろいろ あるね。',
      'ひとつ えらんで、えに かこう。',
    ],
  },
  {
    id: 'f2',
    obj: 'family',
    level: 0,
    prompt: 'おうちの ひとが して いる しごとを、ひとつ えに かこう。',
    hints: [
      'おうちの なかで、だれが どんな ことを して いるかな。',
      'そうじ、かいもの、りょうり など、いろいろ あるね。',
      'ひとつ えらんで、えに かこう。',
    ],
  },
  {
    id: 'f3',
    obj: 'family',
    level: 0,
    prompt: 'おうちの ひとが して くれて、うれしかった ことを ことばで かこう。',
    guide: 'lines',
    hints: [
      'うれしかった ときを おもいだして みよう。',
      'どんな ことを して くれたかな。',
      'その ことと、うれしかった きもちを ことばで かこう。',
    ],
  },
  {
    id: 'f4',
    obj: 'family',
    level: 1,
    prompt: 'おうちの みんなで、いっしょに する ことを えに かこう。',
    hints: [
      'おうちの みんなが あつまる ときを おもいだして みよう。',
      'たべる、あそぶ、かたづける など、いろいろ あるね。',
      'いっしょに して いる ところを えに かこう。',
    ],
  },
  {
    id: 'f5',
    obj: 'family',
    level: 1,
    prompt: 'おうちの ひとが いそがしい とき、じぶんに できる ことを ことばで かこう。',
    guide: 'lines',
    hints: [
      'おうちの ひとが いそがしそうな ときを おもいだして みよう。',
      'じぶんの ことを じぶんで すると、たすけに なるね。',
      'できそうな ことを ひとつ、ことばで かこう。',
    ],
  },
  {
    id: 'f6',
    obj: 'family',
    level: 1,
    prompt: 'おうちの ひとと はなして、じぶんの しごとを きめよう。きめた ことを えに かこう。',
    hints: [
      'おうちの ひとに「どんな しごとが いいかな」と きいて みよう。',
      'じぶんに できて、みんなが たすかる ことが いいね。',
      'きめた しごとを して いる ところを えに かこう。',
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
    id: 'r-alt-a1',
    obj: 'my-role',
    level: 0,
    prompt: 'おうちで できる ことは どれかな。（いくつでも えらべるよ）',
    reasons: ['くつを そろえる', 'しょっきを はこぶ', 'せんたくものを たたむ'],
    multi: true,
    hints: [
      'おうちで した ことが ある ことを おもいだして みよう。',
      'まだ して いない ことでも、できそうなら えらんで いいよ。',
      'いくつでも、えらんで いいよ。',
    ],
  },
  {
    id: 'r-alt-a2',
    obj: 'my-role',
    level: 1,
    prompt: 'おてつだいを した あと、どんな きもちかな。（いくつでも えらべるよ）',
    reasons: ['うれしい', 'ほこらしい', 'また やりたい'],
    multi: true,
    hints: [
      'おてつだいを した あとの ことを おもいだして みよう。',
      'おうちの ひとの かおは、どうだったかな。',
      'いくつでも、えらんで いいよ。',
    ],
  },
  {
    id: 'r-alt-a3',
    obj: 'my-role',
    level: 1,
    prompt: 'おうちの しごとを つづける ために、どう するかな。ひとつ えらぼう。',
    reasons: ['する じかんを きめる', 'カードに しるしを つける', 'おうちの ひとと やくそくする'],
    hints: [
      'まいにち つづけるのは、むずかしい ことも あるね。',
      'わすれない ための くふうを かんがえよう。',
      'どれを えらんでも だいじょうぶ。',
    ],
  },
  {
    id: 'f-alt-a1',
    obj: 'family',
    level: 0,
    prompt: 'おうちの ひとは、どんな しごとを して いるかな。（いくつでも えらべるよ）',
    reasons: ['ごはんの したく', 'せんたく', 'そうじ'],
    multi: true,
    hints: [
      'おうちの なかの ようすを おもいだして みよう。',
      'まいにち して くれて いる ことが あるね。',
      'いくつでも、えらんで いいよ。',
    ],
  },
  {
    id: 'f-alt-a2',
    obj: 'family',
    level: 1,
    prompt: 'おうちの ひとが よろこぶのは、どんな ときかな。（いくつでも えらべるよ）',
    reasons: [
      'おてつだいを した とき',
      'げんきに あいさつした とき',
      'じぶんで したくを した とき',
    ],
    multi: true,
    hints: [
      'おうちの ひとが えがおに なった ときを おもいだして みよう。',
      'じぶんの ことを じぶんで した ときも、よろこんで くれるね。',
      'いくつでも、えらんで いいよ。',
    ],
  },
  {
    id: 'f-alt-a3',
    obj: 'family',
    level: 1,
    prompt:
      'おうちの みんなが きもちよく すごす ために、だいじな ことは どれかな。（いくつでも えらべるよ）',
    reasons: ['たすけあう', 'ありがとうを いう', 'やくそくを まもる'],
    multi: true,
    hints: [
      'おうちの みんなが にこにこ して いる ときを おもいだそう。',
      'おたがいに して いる ことを かんがえよう。',
      'いくつでも、えらんで いいよ。',
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

export const home: UnitSpec = {
  ...baseLife('g1.life.home', 'g1'),
  priority: 'P2',
  title: 'おうちで できる こと',
  kind: 'record',
  prereq: [],
  objectives: [
    { id: 'my-role', title: 'おうちで じぶんが できる こと' },
    { id: 'family', title: 'おうちの ひとが して くれて いる こと' },
  ],
  misconceptions: [
    {
      id: 'only-adults',
      explain:
        'おうちの しごとは、おとなだけが する ものと かんがえたのかな。こどもにも できる ことが あるよ。',
    },
    {
      id: 'alone-danger',
      explain:
        'あぶない しごとも、ひとりで して いいと かんがえたのかな。ひや はものを つかう ことは、おうちの ひとと いっしょに しよう。',
    },
  ],
  levels: [
    { label: 'おもいだして かく', chance: 0.1 },
    { label: 'これからを かんがえる', chance: 0.1 },
  ],
  intro: [
    {
      text: 'おうちで じぶんが できる ことを、えや ことばで かこう。',
      figure: illust('house'),
    },
    {
      text: 'まちがいは ないよ。おうちに よって、できる ことも、して いる ことも ちがうよ。かいた ものは、おうちの ひとも みられるよ。',
    },
    {
      text: 'ひや はものを つかう ような あぶない ことは、おうちの ひとと いっしょに しようね。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）生活 (2)（家庭と生活: 家庭における家族のことや自分でできることなどについて考え、家庭での生活は互いに支え合っていることが分かり、自分の役割を積極的に果たそうとする）。学年の割当は本アプリの案（生活は第1・2学年のまとまり）。採点しない記録（explain）。家族の形と家の仕事は家庭ごとに違うので、正解を置かず「おうちの ひと」と書く',
  gradeIsAppProposal: true,
};
