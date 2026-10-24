/**
 * g1.ja.punctuation 「。」「、」と かぎ（「」）。curriculum-matrix 3.4。
 *
 * 到達項目:
 *   maru … 文の終わりに「。」を打つ
 *   ten  … 文の中の切れ目に「、」を打つ
 *   kagi … 話した言葉に「」を付ける
 * 練習 = 文の□に記号を入れる（fill）。別例 = 記号の付け方が正しい文を選ぶ（choice）。
 * かぎの中の文末の「。」は、会話だけの文（「あそぼう。」）では付け、「〜と いいました」に続くときは付けない形にそろえた
 * （教科書・表記の基準で扱いが分かれるため、その点を問う問題は作らない）。
 * 同一性キー: 文ごと。
 */
import type { FillBlank, FillItem } from '../../engines/fill/fill';
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import { opts, REVISED, type Wrong } from './util';

type Obj = 'maru' | 'ten' | 'kagi';

const HINTS: Record<Obj, [string, string, string]> = {
  maru: [
    'ぶんが おわる ところは どこかな。',
    '「〜です」「〜ました」の ところで ぶんが おわるよ。',
    'ぶんが まだ つづく ところには「、」を つかうよ。おわる ところは どうかな。',
  ],
  ten: [
    'ぶんが まだ つづいて いる ところは どこかな。',
    '「ぼくは」「〜ので」の あとなど、いきを すう ところに つける しるしだよ。',
    'ぶんの おわりは「。」だね。とちゅうの くぎりは どうかな。',
  ],
  kagi: [
    'だれかが はなした ことばは どこかな。',
    'はなした ことばの まえと あとに、ひとつずつ つける しるしだよ。',
    '「と いいました」の まえまでが はなした ことば。はじめに つける しるしは どっちかな。',
  ],
};
const RULE: Record<Obj, string> = {
  maru: 'ぶんの おわりには「。」（まる）を つけるよ。',
  ten: 'ぶんの とちゅうの くぎりには「、」（てん）を つけるよ。',
  kagi: 'はなした ことばは「　」（かぎ）で かこむよ。はじめが「「」、おわりが「」」。',
};

function blankOf(ans: string): FillBlank {
  const wrong: Record<string, { value: string; misconception: string }[]> = {
    '。': [{ value: '、', misconception: 'maru-ten' }],
    '、': [{ value: '。', misconception: 'ten-maru' }],
    '「': [
      { value: '」', misconception: 'kagi-reverse' },
      { value: '。', misconception: 'kagi-other' },
      { value: '、', misconception: 'kagi-other' },
    ],
    '」': [
      { value: '「', misconception: 'kagi-reverse' },
      { value: '。', misconception: 'kagi-other' },
      { value: '、', misconception: 'kagi-other' },
    ],
  };
  return { answers: [ans], wrong: wrong[ans] ?? [] };
}

type F = [obj: Obj, id: string, text: string, answers: string[]];
const FILLS: F[] = [
  ['maru', 'hare', 'きょうは はれです{{}}', ['。']],
  ['maru', 'asa', 'あさ おきました{{}} かおを あらいました{{}}', ['。', '。']],
  ['maru', 'gohan', 'ぼくは{{}} ごはんを たべました{{}}', ['、', '。']],
  ['maru', 'neko', 'ねこが ねて います{{}}', ['。']],
  ['maru', 'soto', 'そとで あそびました{{}} たのしかったです{{}}', ['。', '。']],
  ['maru', 'ame', 'あめが ふって きたので{{}} いえに かえりました{{}}', ['、', '。']],
  ['maru', 'mizu', 'はなに みずを やりました{{}}', ['。']],
  ['maru', 'inu', 'いぬが ほえた{{}} ねこが にげた{{}}', ['。', '。']],
  ['ten', 'watashi', 'わたしは{{}} えを かきました。', ['、']],
  ['ten', 'kinou', 'きのう{{}} こうえんに いきました。', ['、']],
  ['ten', 'asa', 'あさに なったので{{}} おきました。', ['、']],
  ['ten', 'ringo', 'りんご{{}} みかん{{}} ももを かいました。', ['、', '、']],
  ['ten', 'tomodachi', 'ぼくは{{}} ともだちと あそびました{{}}', ['、', '。']],
  ['ten', 'yanda', 'あめが やんだので{{}} そとに でました{{}}', ['、', '。']],
  ['ten', 'hana', 'あかい はな{{}} しろい はなが さいて います。', ['、']],
  ['ten', 'inu-neko', 'いぬも{{}} ねこも すきです{{}}', ['、', '。']],
  ['kagi', 'ohayou', '{{}}おはよう{{}}と いいました。', ['「', '」']],
  ['kagi', 'asobou', '{{}}いっしょに あそぼう。{{}}', ['「', '」']],
  ['kagi', 'sensei', 'せんせいが{{}} {{}}すわりましょう{{}}と いいました。', ['、', '「', '」']],
  ['kagi', 'arigatou', 'ぼくは {{}}ありがとう{{}}と いった。', ['「', '」']],
  ['kagi', 'itadakimasu', '{{}}いただきます{{}}と みんなで いった。', ['「', '」']],
  ['kagi', 'okaeri', 'おかあさんが {{}}おかえり{{}}と いった。', ['「', '」']],
  ['kagi', 'mata', '{{}}あした また あそぼうね。{{}}', ['「', '」']],
  ['kagi', 'gomen', 'ともだちに {{}}ごめんね{{}}と いった。', ['「', '」']],
];

function fillItem([obj, id, text, answers]: F): FillItem {
  const filled = answers.reduce((t, a) => t.replace('{{}}', a), text);
  return {
    engine: 'fill',
    id: `fill:${obj}:${id}`,
    objective: obj,
    level: obj === 'maru' ? 0 : obj === 'ten' ? 1 : 2,
    prompt: '□に はいる しるしを えらぼう。',
    text,
    options: obj === 'kagi' ? ['「', '」', '。', '、'] : ['。', '、'],
    blanks: answers.map(blankOf),
    hints: HINTS[obj],
    explain: `${filled} ${RULE[obj]}`,
    identity: `fill:${obj}:${id}`,
  };
}

// ---- 別例: 記号の付け方が正しい文を選ぶ ----
type C = [obj: Obj, id: string, right: string, wrongs: Wrong[]];
const CHOICES: C[] = [
  [
    'maru',
    'asa',
    'あさ おきた。かおを あらった。',
    [
      ['あさ。おきた かおを あらった。', 'maru-mid'],
      ['あさ おきた かおを あらった', 'maru-missing'],
    ],
  ],
  [
    'maru',
    'neko',
    'ねこが ないた。いぬも ないた。',
    [
      ['ねこが。ないた いぬも ないた。', 'maru-mid'],
      ['ねこが ないた いぬも ないた', 'maru-missing'],
    ],
  ],
  [
    'maru',
    'hon',
    'ほんを よんだ。おもしろかった。',
    [
      ['ほんを。よんだ おもしろかった。', 'maru-mid'],
      ['ほんを よんだ おもしろかった', 'maru-missing'],
    ],
  ],
  [
    'ten',
    'boku',
    'ぼくは、いもうとと あそんだ。',
    [
      ['ぼ、くは いもうとと あそんだ。', 'ten-in-word'],
      ['ぼくは。いもうとと あそんだ。', 'ten-maru'],
    ],
  ],
  [
    'ten',
    'ame',
    'あめが ふったので、かさを さした。',
    [
      ['あめが ふった、ので かさを さした。', 'ten-in-word'],
      ['あめが ふったので。かさを さした。', 'ten-maru'],
    ],
  ],
  [
    'ten',
    'kyou',
    'きょう、えんそくに いきます。',
    [
      ['きょ、う えんそくに いきます。', 'ten-in-word'],
      ['きょう。えんそくに いきます。', 'ten-maru'],
    ],
  ],
  [
    'kagi',
    'ohayou',
    '「おはよう」と いいました。',
    [
      ['おはよう「と いいました。」', 'kagi-range'],
      ['」おはよう「と いいました。', 'kagi-reverse'],
    ],
  ],
  [
    'kagi',
    'sensei',
    'せんせいが「すわりましょう」と いいました。',
    [
      ['「せんせいが すわりましょう」と いいました。', 'kagi-range'],
      ['せんせいが」すわりましょう「と いいました。', 'kagi-reverse'],
    ],
  ],
  [
    'kagi',
    'arigatou',
    '「ありがとう」と おれいを いった。',
    [
      ['「ありがとうと おれいを いった。」', 'kagi-range'],
      ['」ありがとう「と おれいを いった。', 'kagi-reverse'],
    ],
  ],
  [
    'kagi',
    'matte',
    'いもうとが「まって」と よんだ。',
    [
      ['いもうとが まって「と よんだ。」', 'kagi-range'],
      ['「いもうとが」まって と よんだ。', 'kagi-range'],
    ],
  ],
];
const CHOICE_PROMPT: Record<Obj, string> = {
  maru: '「。」の つけかたが ただしい ぶんは どれ？',
  ten: '「、」の つけかたが ただしい ぶんは どれ？',
  kagi: 'かぎ（「　」）の つけかたが ただしい ぶんは どれ？',
};

function choiceItem([obj, id, right, wrongs]: C): ChoiceItem {
  return {
    engine: 'choice',
    id: `choice:${obj}:${id}`,
    objective: obj,
    level: obj === 'maru' ? 0 : obj === 'ten' ? 1 : 2,
    prompt: CHOICE_PROMPT[obj],
    options: opts(right, wrongs),
    layout: 'column',
    hints: HINTS[obj],
    explain: `「${right}」が ただしいよ。${RULE[obj]}`,
    identity: `choice:${obj}:${id}`,
    alt: true,
  };
}

const items: Item[] = [...FILLS.map(fillItem), ...CHOICES.map(choiceItem)];

export const punctuation: UnitSpec = {
  id: 'g1.ja.punctuation',
  title: '「。」「、」と かぎ',
  stage: 'g1',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'notebook',
  prereq: ['g1.ja.particles'],
  objectives: [
    { id: 'maru', title: 'ぶんの おわりの「。」' },
    { id: 'ten', title: 'ぶんの とちゅうの「、」' },
    { id: 'kagi', title: 'はなした ことばの「　」' },
  ],
  misconceptions: [
    {
      id: 'maru-ten',
      explain: 'ぶんが おわって いるのに「、」を つけたのかな。ぶんの おわりは「。」だよ。',
    },
    {
      id: 'ten-maru',
      explain:
        'ぶんが まだ つづいて いるのに「。」を つけたのかな。とちゅうの くぎりは「、」だよ。',
    },
    {
      id: 'maru-mid',
      explain:
        'ぶんの とちゅうに「。」を つけたのかな。「〜た」「〜です」で ぶんが おわる ところに つけよう。',
    },
    {
      id: 'maru-missing',
      explain: '「。」を つけわすれたのかな。ぶんが おわる たびに「。」を つけるよ。',
    },
    {
      id: 'ten-in-word',
      explain:
        'ことばの とちゅうに「、」を つけたのかな。「、」は ことばと ことばの あいだに つけるよ。',
    },
    {
      id: 'kagi-reverse',
      explain: 'かぎの むきが はんたいに なったのかな。はじめは「「」、おわりは「」」だよ。',
    },
    {
      id: 'kagi-range',
      explain: 'かこむ ところが ずれたのかな。かぎで かこむのは、はなした ことば だけだよ。',
    },
    {
      id: 'kagi-other',
      explain: 'はなした ことばの まえと あとには、「。」や「、」ではなく かぎを つけるよ。',
    },
  ],
  levels: [
    { label: '「。」', chance: 0.25 },
    { label: '「、」', chance: 0.25 },
    { label: 'かぎ', chance: 0.1 },
  ],
  intro: [
    {
      text: 'ぶんが おわったら「。」（まる）。',
      figure: { kind: 'text', text: 'きょうは はれです**。**', size: 'xl' },
    },
    {
      text: 'ぶんの とちゅうで いきを すう ところに「、」（てん）。',
      figure: { kind: 'text', text: 'ぼくは**、**いぬと あそんだ。', size: 'xl' },
    },
    {
      text: 'はなした ことばは「　」（かぎ）で かこむよ。',
      figure: { kind: 'text', text: '**「**おはよう**」**と いいました。', size: 'xl' },
    },
  ],
  source: { kind: 'items', items },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年 〔知識及び技能〕(1)ウ（句読点の打ち方、かぎ（「」）の使い方）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
