/**
 * g5.en.word-order 語順《ごじゅん》を 意識《いしき》して 文《ぶん》を 組《く》み立《た》てる（curriculum-matrix 3.8。外56 書く）。
 *   段階0: 2〜3語（だれが＋どうする）
 *   段階1: 3〜5語（だれが＋どうする＋なにを）
 *   段階2: たずねる 文
 * build（タイル。joiner ' '）。文の はじめの 大文字と おわりの 符号は タイルに ついている（語順だけを 問う）。
 * 誤答の例: 日本語の 語順（I cats like.）、たずねる文の 語順（You can swim?）。
 * 同一性キー: 形式 × 英文。
 */
import type { BuildItem, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { enText, slugOf } from './lib';

interface Sent {
  /** 正しい文（タイルは空白で切る） */
  s: string;
  ja: string;
  /** まぎらわしい タイル（正答に 使わない） */
  extra?: string;
  wrong?: [string, string][];
  /** 別例の 絵 */
  il?: string;
}

function buildItem(
  o: Sent,
  obj: string,
  level: number,
  alt: boolean,
  prompt: string,
  figure?: Figure,
  hint3?: string,
): BuildItem {
  const tiles = o.s.split(' ');
  if (o.extra) tiles.push(o.extra);
  return {
    engine: 'build',
    id: `${alt ? 'alt-' : ''}${obj}:${slugOf(o.s)}`,
    objective: obj,
    level,
    prompt,
    ...(figure ? { figure } : {}),
    tiles,
    answer: { kind: 'text', values: [o.s] },
    joiner: ' ',
    ...(o.wrong
      ? { wrongAnswers: o.wrong.map(([value, misconception]) => ({ value, misconception })) }
      : {}),
    hints: [
      'えいごは「だれが」→「どうする」→「なにを」の じゅんに ならべるよ。',
      '大文字《おおもじ》で はじまる タイルが 文《ぶん》の はじめ、しるしの ついた タイルが 文《ぶん》の おわりだよ。',
      hint3 ?? 'はじめの タイルを きめたら、つぎは「どうする」に あたる タイルを さがそう。',
    ],
    explain: `「${o.ja}」は この じゅんに ならべます。`,
    explainFigure: enText(o.s),
    identity: `${alt ? 'alt-' : ''}${obj}:${o.s}`,
    ...(alt ? { alt: true } : {}),
  };
}

const TWO: Sent[] = [
  {
    s: 'I swim.',
    ja: 'わたしは およぎます',
    extra: 'can',
    wrong: [
      ['swim. I', 'ja-order'],
      ['I can swim.', 'word-choice'],
    ],
  },
  { s: 'I run.', ja: 'わたしは はしります', extra: 'you', wrong: [['run. I', 'ja-order']] },
  { s: 'I sing.', ja: 'わたしは うたいます', extra: 'like', wrong: [['sing. I', 'ja-order']] },
  { s: 'Stand up.', ja: 'たちましょう', extra: 'down.', wrong: [['Stand down.', 'word-choice']] },
  { s: 'Sit down.', ja: 'すわりましょう', extra: 'up.', wrong: [['Sit up.', 'word-choice']] },
  { s: 'Thank you.', ja: 'ありがとう', extra: 'me.', wrong: [['Thank me.', 'word-choice']] },
  { s: 'See you.', ja: 'またね', extra: 'I.' },
  { s: "I'm Ken.", ja: 'わたしは ケンです', extra: 'is', wrong: [["Ken. I'm", 'ja-order']] },
];

const THREE: Sent[] = [
  {
    s: 'I like cats.',
    ja: 'わたしは ねこが すきです',
    wrong: [['I cats. like', 'ja-order']],
    il: 'cat',
  },
  { s: 'I can swim.', ja: 'わたしは およげます', wrong: [['I swim. can', 'can-place']] },
  {
    s: 'I have a dog.',
    ja: 'わたしは いぬを かって います',
    wrong: [['I a dog. have', 'ja-order']],
    il: 'dog',
  },
  {
    s: 'I play soccer.',
    ja: 'わたしは サッカーを します',
    wrong: [['I soccer. play', 'ja-order']],
    il: 'ball',
  },
  { s: 'I want a pen.', ja: 'わたしは ペンが ほしいです', wrong: [['I a pen. want', 'ja-order']] },
  {
    s: 'My name is Emi.',
    ja: 'わたしの なまえは エミです',
    wrong: [['My name Emi. is', 'ja-order']],
  },
  {
    s: 'I eat bread.',
    ja: 'わたしは パンを たべます',
    wrong: [['I bread. eat', 'ja-order']],
    il: 'bread',
  },
  {
    s: 'I can play the piano.',
    ja: 'わたしは ピアノが ひけます',
    wrong: [['I play can the piano.', 'can-place']],
  },
  {
    s: 'I like red apples.',
    ja: 'わたしは あかい りんごが すきです',
    wrong: [['I like apples red.', 'adj-order']],
    il: 'apple',
  },
  {
    s: 'I have a big bag.',
    ja: 'わたしは おおきい かばんを もって います',
    wrong: [['I have a bag big.', 'adj-order']],
  },
  {
    s: 'I can ride a bicycle.',
    ja: 'わたしは じてんしゃに のれます',
    wrong: [['I can a bicycle ride.', 'ja-order']],
    il: 'bicycle',
  },
  {
    s: 'I like strawberries.',
    ja: 'わたしは いちごが すきです',
    wrong: [['I strawberries. like', 'ja-order']],
    il: 'strawberry',
  },
];

const QUESTIONS: Sent[] = [
  {
    s: 'Do you like cats?',
    ja: 'ねこは すきですか',
    wrong: [
      ['You do like cats?', 'q-order'],
      ['Do you cats like?', 'ja-order'],
    ],
  },
  { s: 'Can you swim?', ja: 'あなたは およげますか', wrong: [['You can swim?', 'q-order']] },
  {
    s: 'What do you like?',
    ja: 'なにが すきですか',
    wrong: [
      ['Do you like what?', 'wh-place'],
      ['What you do like?', 'q-order'],
    ],
  },
  {
    s: 'When is your birthday?',
    ja: 'たんじょう日《び》は いつですか',
    wrong: [['Your birthday is when?', 'wh-place']],
  },
  {
    s: 'What color do you like?',
    ja: 'なに色《いろ》が すきですか',
    wrong: [['What do you like color?', 'wh-place']],
  },
  {
    s: 'Do you have a pen?',
    ja: 'ペンを もって いますか',
    wrong: [['You have a pen do?', 'q-order']],
  },
  {
    s: 'Can you play tennis?',
    ja: 'テニスが できますか',
    wrong: [['You can play tennis?', 'q-order']],
  },
  { s: 'What do you want?', ja: 'なにが ほしいですか', wrong: [['Do you want what?', 'wh-place']] },
  {
    s: 'Where is my bag?',
    ja: 'わたしの かばんは どこですか',
    wrong: [['My bag is where?', 'wh-place']],
  },
];

function items(): Item[] {
  const out: Item[] = [];
  for (const o of TWO)
    out.push(
      buildItem(
        o,
        'two',
        0,
        false,
        `「${o.ja}」と いう 文《ぶん》に なるように、タイルを ならべよう。つかわない タイルも あるよ。`,
      ),
    );
  for (const o of THREE)
    out.push(
      buildItem(
        o,
        'three',
        1,
        false,
        `「${o.ja}」と いう 文《ぶん》に なるように、タイルを ならべよう。`,
      ),
    );
  for (const o of QUESTIONS)
    out.push(
      buildItem(
        o,
        'question',
        2,
        false,
        `「${o.ja}」と たずねる 文《ぶん》に なるように、タイルを ならべよう。`,
        undefined,
        'たずねる 文《ぶん》の はじめは、大文字《おおもじ》で はじまる タイルだよ。',
      ),
    );

  // 別例（2〜3語）: 日本語の 語順で 書いた カードを、えいごの 語順に なおす
  const TWO_ALT: [Sent, string][] = [
    [
      { s: 'I dance.', ja: 'わたしは おどります', wrong: [['dance. I', 'ja-order']] },
      'わたしは ／ おどります',
    ],
    [
      { s: 'I cook.', ja: 'わたしは りょうりを します', wrong: [['cook. I', 'ja-order']] },
      'わたしは ／ りょうりを します',
    ],
    [{ s: 'Good morning.', ja: 'おはよう', wrong: [['morning. Good', 'ja-order']] }, 'おはよう'],
    [
      { s: 'I walk.', ja: 'わたしは あるきます', wrong: [['walk. I', 'ja-order']] },
      'わたしは ／ あるきます',
    ],
  ];
  for (const [o, card] of TWO_ALT)
    out.push(
      buildItem(
        o,
        'two',
        0,
        true,
        'カードの いみに なるように、えいごの タイルを ならべよう。',
        { kind: 'text', text: card, size: 'l' },
        'はじめの タイルは 大文字《おおもじ》で はじまる タイルだよ。',
      ),
    );
  // 別例（3〜5語）: 絵を 見て「すき・もって いる」を つたえる
  for (const o of THREE.filter((x) => x.il)) {
    const verb = o.s.split(' ')[1]!;
    const ja =
      verb === 'like'
        ? 'すき'
        : verb === 'have'
          ? 'かって いる・もって いる'
          : verb === 'can'
            ? 'できる'
            : verb === 'eat'
              ? 'たべる'
              : 'する';
    out.push(
      buildItem(
        o,
        'three',
        1,
        true,
        `えの ものに ついて、「${ja}」と つたえる 文《ぶん》を つくろう。`,
        { kind: 'illust', id: o.il! },
        'えの ものを あらわす ことばは、文《ぶん》の さいごに くるよ。',
      ),
    );
  }
  // 別例（たずねる文）: ふつうの 文を、たずねる 文に かえる
  const Q_ALT: [string, Sent][] = [
    [
      'You can swim.',
      { s: 'Can you swim?', ja: 'およげますか', wrong: [['You can swim?', 'q-order']] },
    ],
    [
      'You like dogs.',
      {
        s: 'Do you like dogs?',
        ja: 'いぬは すきですか',
        extra: 'can',
        wrong: [['You do like dogs?', 'q-order']],
      },
    ],
    [
      'You can cook.',
      { s: 'Can you cook?', ja: 'りょうりが できますか', wrong: [['You can cook?', 'q-order']] },
    ],
    [
      'You have a cat.',
      {
        s: 'Do you have a cat?',
        ja: 'ねこを かって いますか',
        extra: 'can',
        wrong: [['You have a cat do?', 'q-order']],
      },
    ],
  ];
  for (const [base, o] of Q_ALT)
    out.push(
      buildItem(
        o,
        'question',
        2,
        true,
        `上《うえ》の 文《ぶん》を、「${o.ja}」と たずねる 文《ぶん》に かえよう。`,
        { kind: 'text', text: base, size: 'l' },
        'たずねる 文《ぶん》は、文《ぶん》の はじめの ことばが かわるよ。',
      ),
    );
  return out;
}

export const wordOrder: UnitSpec = {
  id: 'g5.en.word-order',
  title: 'ことばの じゅんばん',
  stage: 'g5',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-eigo',
  prereq: ['g5.en.read-words'],
  objectives: [
    { id: 'two', title: '2〜3語《ご》の 文《ぶん》を ならべる' },
    { id: 'three', title: '「だれが・どうする・なにを」の じゅんに ならべる' },
    { id: 'question', title: 'たずねる 文《ぶん》を ならべる' },
  ],
  misconceptions: [
    {
      id: 'ja-order',
      explain:
        'にほんごの じゅん（なにを → どうする）に ならべたのかな。えいごは「どうする」が「なにを」より まえに くるよ。',
    },
    {
      id: 'can-place',
      explain: '「できる」を あらわす ことばは、「どうする」の すぐ まえに おくよ。',
    },
    { id: 'adj-order', explain: 'ようすを あらわす ことばは、ものの なまえの まえに おくよ。' },
    {
      id: 'q-order',
      explain:
        'たずねる 文《ぶん》は、はじめの ことばが かわるよ。おわりの しるしだけでは たずねる 文《ぶん》に ならないよ。',
    },
    {
      id: 'wh-place',
      explain: '「なに・いつ・どこ」を たずねる ことばは、文《ぶん》の いちばん はじめに おくよ。',
    },
    { id: 'word-choice', explain: 'にている タイルと とりちがえたのかな。いみを たしかめよう。' },
  ],
  levels: [
    { label: '2〜3語《ご》', chance: 0.02 },
    { label: '3〜5語《ご》', chance: 0.02 },
    { label: 'たずねる 文《ぶん》', chance: 0.02 },
  ],
  intro: [
    {
      text: 'にほんごでは「わたしは ねこが すきです」。えいごでは「だれが → どうする → なにを」の じゅんに なるよ。',
      figure: {
        kind: 'column',
        items: [
          enText('I  /  like  /  cats.', 'xl'),
          { kind: 'text', text: 'わたしは ／ すき ／ ねこが', size: 'l' },
        ],
      },
    },
    {
      text: 'たずねる 文《ぶん》は、はじめの ことばが かわって、おわりに「?」が つくよ。',
      figure: enText('Do you like cats?', 'xl'),
    },
  ],
  source: { kind: 'items', items: items() },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）外国語 第5・6学年 書くこと（語順を意識しながら書き写す。例文を参考に書く）',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
