/**
 * g6.en.sentence-write おてほんを 参考《さんこう》に じぶんの ことを 書《か》く（curriculum-matrix 3.9。外56 書く）。
 *   段階0: ことばを えらぶ（fill: I want to be a {{}}. など）
 *   段階1: おてほんの 文の 一部を 入れかえる（build。joiner ' '）
 *   段階2: 書き写す（文字・語の タイルで おてほんと 同じに 書く）
 * 自由に書いた文は 採点しない（2.3）。ここでは 語を選ぶ・ならべる・書き写す だけを 自動で判定する。
 * 綴りの書き取りは求めない（書き写しは おてほんを 見ながら）。同一性キー: 形式 × 英文。
 */
import type { BuildItem, FillItem, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { enText, slugOf } from './lib';

interface Choose {
  text: string;
  answer: string;
  options: string[];
  ja: string;
}
const CHOOSE: Choose[] = [
  {
    text: 'I want to be a {{}}.',
    answer: 'doctor',
    options: ['doctor', 'teacher', 'baker'],
    ja: 'いしゃに なりたい',
  },
  {
    text: 'I want to be a {{}}.',
    answer: 'teacher',
    options: ['teacher', 'singer', 'pilot'],
    ja: 'せんせいに なりたい',
  },
  {
    text: 'I want to be a {{}}.',
    answer: 'vet',
    options: ['vet', 'cook', 'doctor'],
    ja: 'じゅういに なりたい',
  },
  {
    text: 'I want to be a {{}}.',
    answer: 'baker',
    options: ['baker', 'farmer', 'singer'],
    ja: 'パンやさんに なりたい',
  },
  {
    text: 'I want to go to {{}}.',
    answer: 'the sea',
    options: ['the sea', 'the mountains', 'the zoo'],
    ja: 'うみに いきたい',
  },
  {
    text: 'I want to go to {{}}.',
    answer: 'the mountains',
    options: ['the mountains', 'the river', 'the park'],
    ja: 'やまに いきたい',
  },
  {
    text: 'My best memory is the {{}}.',
    answer: 'school trip',
    options: ['school trip', 'sports day', 'music festival'],
    ja: 'いちばんの おもいでは しゅうがくりょこう',
  },
  {
    text: 'My best memory is the {{}}.',
    answer: 'sports day',
    options: ['sports day', 'school trip', 'drama festival'],
    ja: 'いちばんの おもいでは うんどうかい',
  },
  {
    text: 'I am good at {{}}.',
    answer: 'swimming',
    options: ['swimming', 'cooking', 'singing'],
    ja: 'すいえいが とくい',
  },
  {
    text: 'I am good at {{}}.',
    answer: 'drawing',
    options: ['drawing', 'running', 'dancing'],
    ja: 'えを かくのが とくい',
  },
  {
    text: 'I joined the {{}} club.',
    answer: 'tennis',
    options: ['tennis', 'soccer', 'music'],
    ja: 'テニスクラブに 入《はい》った',
  },
];

function chooseItems(): Item[] {
  const out: Item[] = [];
  for (const c of CHOOSE) {
    const item: FillItem = {
      engine: 'fill',
      id: `choose:${slugOf(c.text.replace('{{}}', c.answer))}`,
      objective: 'choose',
      level: 0,
      prompt: `「${c.ja}」と いう 文《ぶん》に なるように、ことばを えらぼう。`,
      text: c.text,
      options: c.options,
      blanks: [
        {
          answers: [c.answer],
          wrong: c.options
            .filter((o) => o !== c.answer)
            .map((value) => ({ value, misconception: 'word-mix' })),
        },
      ],
      hints: [
        'おてほんの 文《ぶん》の、かわる ところは 1つだけだよ。',
        'えらぶ ことばを、こえに だして 読《よ》んで みよう。',
        '聞《き》いた ことの ある ことばと、いみを むすびつけよう。',
      ],
      explain: `「${c.ja}」は、空《あ》いた ところに ${c.answer}を 入《い》れます。`,
      explainFigure: enText(c.text.replace('{{}}', c.answer)),
      identity: `choose:${c.text.replace('{{}}', c.answer)}`,
    };
    out.push(item);
  }
  // 別例: 文の 形に あう ことばを えらぶ（すぎた こと・be）
  const FORM: { text: string; answer: string; options: string[]; ja: string; mis: string }[] = [
    {
      text: 'I {{}} to the zoo last Sunday.',
      answer: 'went',
      options: ['went', 'go', 'goes'],
      ja: 'この まえの にちようびに どうぶつえんに いった',
      mis: 'tense-form',
    },
    {
      text: 'I {{}} a big fish.',
      answer: 'saw',
      options: ['saw', 'see', 'sees'],
      ja: 'おおきな さかなを 見《み》た',
      mis: 'tense-form',
    },
    {
      text: 'I want to {{}} a teacher.',
      answer: 'be',
      options: ['be', 'is', 'am'],
      ja: 'せんせいに なりたい',
      mis: 'be-form',
    },
    {
      text: 'I {{}} curry for lunch yesterday.',
      answer: 'ate',
      options: ['ate', 'eat', 'eats'],
      ja: 'きのう おひるに カレーを たべた',
      mis: 'tense-form',
    },
  ];
  for (const f of FORM) {
    out.push({
      engine: 'fill',
      id: `form:${slugOf(f.text.replace('{{}}', f.answer))}`,
      objective: 'choose',
      level: 0,
      prompt: `「${f.ja}」と いう 文《ぶん》に なるように、あう 形《かたち》の ことばを えらぼう。`,
      text: f.text,
      options: f.options,
      blanks: [
        {
          answers: [f.answer],
          wrong: f.options
            .filter((o) => o !== f.answer)
            .map((value) => ({ value, misconception: f.mis })),
        },
      ],
      hints: [
        'いつの ことかを たしかめよう。',
        f.mis === 'tense-form'
          ? 'すぎた ことは、ことばの 形《かたち》が かわるよ。'
          : '「〜に なりたい」の ときに つかう 形《かたち》が あるよ。',
        'えらぶ ことばを 入《い》れて、文《ぶん》を 読《よ》んで みよう。',
      ],
      explain: `「${f.ja}」なので、${f.answer}を 入《い》れます。`,
      explainFigure: enText(f.text.replace('{{}}', f.answer)),
      identity: `form:${f.text}`,
      alt: true,
    });
  }
  return out;
}

interface Swap {
  example: string;
  answer: string;
  from: string;
  to: string;
  /** おてほんの ことば（まぎらわしい タイル） */
  oldTile: string;
  il?: string;
}
const SWAPS: Swap[] = [
  {
    example: 'I went to the sea.',
    answer: 'I went to the mountains.',
    from: 'うみ',
    to: 'やま',
    oldTile: 'sea.',
    il: 'tree',
  },
  {
    example: 'I want to be a teacher.',
    answer: 'I want to be a doctor.',
    from: 'せんせい',
    to: 'いしゃ',
    oldTile: 'teacher.',
  },
  {
    example: 'I like soccer.',
    answer: 'I like tennis.',
    from: 'サッカー',
    to: 'テニス',
    oldTile: 'soccer.',
  },
  {
    example: 'I ate ice cream.',
    answer: 'I ate watermelon.',
    from: 'アイスクリーム',
    to: 'すいか',
    oldTile: 'ice cream.',
    il: 'watermelon',
  },
  {
    example: 'I can play the piano.',
    answer: 'I can play the guitar.',
    from: 'ピアノ',
    to: 'ギター',
    oldTile: 'piano.',
  },
  {
    example: 'My best memory is the school trip.',
    answer: 'My best memory is the sports day.',
    from: 'しゅうがくりょこう',
    to: 'うんどうかい',
    oldTile: 'school trip.',
  },
  {
    example: 'I saw a rainbow.',
    answer: 'I saw a big fish.',
    from: 'にじ',
    to: 'おおきな さかな',
    oldTile: 'rainbow.',
  },
  {
    example: 'I want to go to the zoo.',
    answer: 'I want to go to the aquarium.',
    from: 'どうぶつえん',
    to: 'すいぞくかん',
    oldTile: 'zoo.',
  },
  {
    example: 'I am good at cooking.',
    answer: 'I am good at singing.',
    from: 'りょうり',
    to: 'うた',
    oldTile: 'cooking.',
  },
  {
    example: 'I have a cat.',
    answer: 'I have a rabbit.',
    from: 'ねこ',
    to: 'うさぎ',
    oldTile: 'cat.',
    il: 'rabbit',
  },
];

/** 正答の 語を タイルに（2語の まとまり sports day・school trip は 1枚） */
function tilesOf(s: string): string[] {
  return s
    .replace('sports day', 'sports_day')
    .replace('school trip', 'school_trip')
    .replace('big fish', 'big_fish')
    .replace('ice cream', 'ice_cream')
    .split(' ')
    .map((t) => t.replace('_', ' '));
}

function swapItem(s: Swap, alt: boolean): BuildItem {
  const tiles = [...tilesOf(s.answer), s.oldTile];
  const fig: Figure =
    alt && s.il
      ? { kind: 'row', items: [enText(s.example, 'l'), { kind: 'illust', id: s.il }] }
      : enText(s.example, 'l');
  return {
    engine: 'build',
    id: `${alt ? 'swap-pic' : 'swap'}:${slugOf(s.answer)}`,
    objective: 'swap',
    level: 1,
    prompt: alt
      ? 'おてほんの 文《ぶん》を、えに あう 文《ぶん》に かえて 書《か》こう。'
      : `おてほんの 文《ぶん》の「${s.from}」の ところを「${s.to}」に かえて 書《か》こう。`,
    figure: fig,
    tiles,
    answer: { kind: 'text', values: [s.answer] },
    joiner: ' ',
    wrongAnswers: [{ value: s.example, misconception: 'copied-example' }],
    hints: [
      'おてほんと おなじ ところは そのまま、かわる ところだけ かえよう。',
      'かわるのは 文《ぶん》の さいごの ほうだよ。',
      'おてほんの ことばの タイルは つかわないよ。',
    ],
    explain: `おてほんの「${s.from}」を「${s.to}」に かえると、この 文《ぶん》に なります。`,
    explainFigure: enText(s.answer),
    identity: `${alt ? 'swap-pic' : 'swap'}:${s.answer}`,
    ...(alt ? { alt: true } : {}),
  };
}

function swapItems(): Item[] {
  return [
    ...SWAPS.map((s) => swapItem(s, false)),
    ...SWAPS.filter((s) => s.il).map((s) => swapItem(s, true)),
  ];
}

/** 書き写し: おてほんの ことばを 文字の タイルで 書く */
const COPY_WORDS = [
  'teacher',
  'doctor',
  'summer',
  'school',
  'friend',
  'family',
  'Japan',
  'music',
  'animal',
  'birthday',
];

function copyItems(): Item[] {
  const out: Item[] = COPY_WORDS.map(
    (w) =>
      ({
        engine: 'build',
        id: `copy:${slugOf(w)}`,
        objective: 'copy',
        level: 2,
        prompt:
          'おてほんを 見《み》ながら、おなじ ことばを 文字《もじ》の タイルで 書《か》きうつそう。',
        figure: enText(w, 'xl'),
        tiles: w.split(''),
        answer: { kind: 'text', values: [w] },
        hints: [
          'おてほんの 1文字《もじ》めから じゅんに 見《み》よう。',
          'おなじ 文字《もじ》が 2つ ある ことも あるよ。',
          '大文字《おおもじ》と 小文字《こもじ》の ちがいにも 気《き》を つけよう。',
        ],
        explain: 'おてほんと おなじに 書《か》けたかな。1文字《もじ》ずつ たしかめよう。',
        explainFigure: enText(w, 'xl'),
        identity: `copy:${w}`,
      }) satisfies BuildItem,
  );
  // 別例: 文を 書き写す（大文字・小文字の タイルが ある）
  const COPY_SENT: [string, string[], string][] = [
    ['I live in Japan.', ['i', 'japan.'], 'i live in japan.'],
    ['My name is Ken.', ['my', 'ken.'], 'my name is ken.'],
    ['I like music.', ['i', 'Music.'], 'i like music.'],
    ['We have a big park.', ['we', 'Park.'], 'we have a big park.'],
  ];
  for (const [s, extra, wrong] of COPY_SENT) {
    out.push({
      engine: 'build',
      id: `copy-sent:${slugOf(s)}`,
      objective: 'copy',
      level: 2,
      prompt:
        'おてほんの 文《ぶん》を、タイルで そのとおりに 書《か》きうつそう。大文字《おおもじ》に 気《き》を つけよう。',
      figure: enText(s, 'l'),
      tiles: [...s.split(' '), ...extra],
      answer: { kind: 'text', values: [s] },
      joiner: ' ',
      wrongAnswers: [{ value: wrong, misconception: 'no-capital' }],
      hints: [
        '文《ぶん》の はじめの 文字《もじ》は 大文字《おおもじ》だよ。',
        '人《ひと》や 国《くに》の なまえの はじめも 大文字《おおもじ》だよ。',
        'おわりの しるしも おてほんと おなじに しよう。',
      ],
      explain:
        '文《ぶん》の はじめと、人《ひと》・国《くに》の なまえの はじめは 大文字《おおもじ》で 書《か》きます。',
      explainFigure: enText(s),
      identity: `copy-sent:${s}`,
      alt: true,
    });
  }
  return out;
}

export const sentenceWrite: UnitSpec = {
  id: 'g6.en.sentence-write',
  title: 'じぶんの ことを 書《か》こう',
  stage: 'g6',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'pencil',
  prereq: ['g5.en.word-order'],
  objectives: [
    { id: 'choose', title: 'おてほんの 文《ぶん》に 入《い》る ことばを えらぶ' },
    { id: 'swap', title: 'おてほんの 文《ぶん》の 一部《いちぶ》を 入《い》れかえて 書《か》く' },
    { id: 'copy', title: 'おてほんを 見《み》て 書《か》きうつす' },
  ],
  misconceptions: [
    {
      id: 'word-mix',
      explain: 'いみの ちがう ことばを えらんだのかな。日本語《にほんご》の いみと くらべよう。',
    },
    { id: 'tense-form', explain: 'すぎた ことを いう ときは、ことばの 形《かたち》が かわるよ。' },
    {
      id: 'be-form',
      explain:
        '「〜に なりたい」は、わたしでも あなたでも 同《おな》じ 形《かたち》の ことばを つかうよ。',
    },
    {
      id: 'copied-example',
      explain: 'おてほんの ことばを そのまま つかったのかな。かえる ところを たしかめよう。',
    },
    {
      id: 'no-capital',
      explain:
        '文《ぶん》の はじめや、人《ひと》・国《くに》の なまえの はじめは 大文字《おおもじ》で 書《か》くよ。',
    },
  ],
  levels: [
    { label: 'ことばを えらぶ', chance: 0.05 },
    { label: '入《い》れかえて 書《か》く', chance: 0.02 },
    { label: '書《か》きうつす', chance: 0.02 },
  ],
  intro: [
    {
      text: 'おてほんの 文《ぶん》の 一部《いちぶ》を かえると、じぶんの ことを つたえる 文《ぶん》に なるよ。',
      figure: {
        kind: 'column',
        items: [enText('I want to be a teacher.', 'l'), enText('I want to be a doctor.', 'l')],
      },
    },
    {
      text: 'じぶんで じゆうに 書《か》いた 文《ぶん》は、ノートに 書《か》いて おうちの 人《ひと》に 見《み》て もらおう（この アプリでは まるつけ しないよ）。',
    },
  ],
  source: { kind: 'items', items: [...chooseItems(), ...swapItems(), ...copyItems()] },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）外国語 第5・6学年 書くこと（自分のことや身近で簡単な事柄について、例文を参考に、音声で十分に慣れ親しんだ語句や表現を用いて書く）',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
