/**
 * g2.ja.katakana-words カタカナで かく ことば（curriculum-matrix 3.5）。
 * 種類: 外国から来た言葉・動物の鳴き声と物の音・外国の国や町や人の名前。長音「ー」と小さい「ッ」。
 *
 * 同一性キー: 語の選択は「正解の語」、なかま分けは「カードの組」、表記は「語」。
 * 人の名前は実在の人物ではない、よくある名前（トム・アンナ など）だけ。
 */
import type { ChoiceItem, FillItem, Item, SortItem, UnitSpec } from '../../curriculum/types';
import { opts, REVISED } from './util';

// ---- 1. カタカナで かく ことばを えらぶ ----
/** [ひらがなで書いた外来語, ひらがなで書く語1, 語2] */
const ERABU: [string, string, string][] = [
  ['てれび', 'つくえ', 'かばん'],
  ['ぱん', 'ごはん', 'おにぎり'],
  ['ばす', 'くるま', 'ふね'],
  ['こっぷ', 'おわん', 'はし'],
  ['ぴあの', 'たいこ', 'ふえ'],
  ['かめら', 'めがね', 'とけい'],
  ['とまと', 'なす', 'だいこん'],
  ['しゃつ', 'くつした', 'ぼうし'],
  ['ぼたん', 'はさみ', 'いと'],
  ['べっど', 'ふとん', 'まくら'],
];

function erabuItem([ok, w1, w2]: [string, string, string], i: number): ChoiceItem {
  return {
    engine: 'choice',
    id: `erabu:${ok}`,
    objective: 'erabu',
    level: 0,
    prompt: 'カタカナで かく ことばは どれ？',
    options: opts(ok, [
      [w1, 'native-as-kata'],
      [w2, 'native-as-kata'],
    ]),
    hints: [
      'ほかの くにから きた ことばは カタカナで かくよ。',
      'むかしから にほんで つかって いる ことばは ひらがなで かくよ。',
      i % 2 === 0
        ? 'ひとつだけ、ほかの くにの ことばの ような ひびきの ものが あるね。'
        : 'ほかの くにの ことばの ような おとの ものを さがそう。',
    ],
    explain: `「${ok}」は ほかの くにから きた ことばなので、カタカナで かきます。「${w1}」「${w2}」は ひらがなで かきます。`,
    identity: `erabu:${ok}`,
  };
}

/** 別例: 文の中から選ぶ。[文, 正解, 誤り1, 誤り2, 種類の説明] */
const ERABU_ALT: [string, string, string, string, string][] = [
  ['あさ、ぱんを たべた。', 'ぱん', 'あさ', 'たべた', 'ほかの くにから きた ことば'],
  ['こうえんで ぼーるを なげた。', 'ぼーる', 'こうえん', 'なげた', 'ほかの くにから きた ことば'],
  ['いぬが わんわんと ないた。', 'わんわん', 'いぬ', 'ないた', 'どうぶつの なきごえ'],
  ['ふらんすから てがみが きた。', 'ふらんす', 'てがみ', 'きた', 'がいこくの くにの なまえ'],
];

function erabuAlt([s, ok, w1, w2, kind]: (typeof ERABU_ALT)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `erabu-alt:${ok}`,
    objective: 'erabu',
    level: 1,
    alt: true,
    prompt: `つぎの ぶんの なかで、カタカナで かく ことばは どれ？\n「${s}」`,
    options: opts(ok, [
      [w1, 'native-as-kata'],
      [w2, 'native-as-kata'],
    ]),
    hints: [
      'ぶんを ことばに わけて、ひとつずつ みよう。',
      'カタカナで かくのは、ほかの くにの ことば・なきごえや おと・がいこくの なまえ だよ。',
      'ひらがなの ままで よい ことばを のぞいて いこう。',
    ],
    explain: `「${ok}」は ${kind}なので、カタカナで かきます。`,
    identity: `erabu-alt:${ok}`,
  };
}

// ---- 2. なかまに わける ----
const LOAN = [
  'パン',
  'ボール',
  'テレビ',
  'ノート',
  'バス',
  'ジュース',
  'ケーキ',
  'スプーン',
  'コップ',
  'ピアノ',
  'カメラ',
  'トマト',
  'バナナ',
  'シャツ',
  'ボタン',
  'ベッド',
];
const SOUND = [
  'ワンワン',
  'ニャーニャー',
  'モーモー',
  'コケコッコー',
  'ピヨピヨ',
  'ケロケロ',
  'メエメエ',
  'チュンチュン',
  'ガチャン',
  'ドカン',
  'トントン',
  'パチパチ',
  'バタン',
  'ザブン',
  'ガタン',
  'ドンドン',
];
const PLACE = [
  'アメリカ',
  'フランス',
  'イタリア',
  'ブラジル',
  'パリ',
  'ロンドン',
  'エジプト',
  'インド',
  'カナダ',
  'ドイツ',
  'スペイン',
  'ニューヨーク',
  'トム',
  'アンナ',
  'マリア',
  'ジョン',
];
const BOXES = [
  'ほかの くにから きた ことば',
  'なきごえ・ものの おと',
  'がいこくの くに・まち・ひとの なまえ',
];

function sortItem(i: number): SortItem {
  const two = (a: string[]) => [a[(2 * i) % a.length]!, a[(2 * i + 1) % a.length]!];
  const loans = two(LOAN);
  const sounds = two(SOUND);
  const places = two(PLACE);
  return {
    engine: 'sort',
    id: `shurui:${i}`,
    objective: 'shurui',
    level: 1,
    prompt: 'カタカナで かく ことばを、なかまに わけよう。',
    boxes: BOXES.map((label) => ({ label })),
    cards: [
      ...loans.map((label) => ({
        label,
        box: 0,
        wrongBoxes: [{ box: 2, misconception: 'loan-as-place' }],
      })),
      ...sounds.map((label) => ({
        label,
        box: 1,
        wrongBoxes: [{ box: 0, misconception: 'sound-as-loan' }],
      })),
      ...places.map((label) => ({
        label,
        box: 2,
        wrongBoxes: [{ box: 0, misconception: 'place-as-loan' }],
      })),
    ],
    hints: [
      'こえや おとを まねした ことばは どれかな。',
      'くにや まち、ひとの なまえは どれかな。',
      'のこりは、ほかの くにから きて、ものの なまえに なった ことばだよ。',
    ],
    explain: `${loans.join('・')}は ほかの くにから きた ことば、${sounds.join('・')}は なきごえや おと、${places.join('・')}は がいこくの なまえ です。`,
    identity: `shurui:${[...loans, ...sounds, ...places].join('-')}`,
  };
}

/** 別例: 1語の なかまを選ぶ。[語, 箱の番号] */
const SHURUI_ALT: [string, number][] = [
  ['ガチャン', 1],
  ['ロボット', 0],
  ['オーストラリア', 2],
  ['ヒヒーン', 1],
];
/** KIND_MIS[正しい箱][選んだ箱] = 誤概念 */
const KIND_MIS: Record<number, Record<number, string>> = {
  0: { 1: 'loan-as-sound', 2: 'loan-as-place' },
  1: { 0: 'sound-as-loan', 2: 'sound-as-place' },
  2: { 0: 'place-as-loan', 1: 'place-as-sound' },
};

function shuruiAlt([w, box]: [string, number]): ChoiceItem {
  const wrongs = BOXES.flatMap((b, k) => (k === box ? [] : [[b, KIND_MIS[box]![k]!] as const]));
  return {
    engine: 'choice',
    id: `shurui-alt:${w}`,
    objective: 'shurui',
    level: 2,
    alt: true,
    layout: 'column',
    prompt: `「${w}」は どの なかまの ことば？`,
    options: opts(BOXES[box]!, wrongs),
    hints: [
      'こえに だして よんで みよう。',
      'なにかの こえや おとを まねして いるかな。ものや ばしょの なまえかな。',
      box === 1
        ? 'どうぶつや ものが だす おとを おもいうかべよう。'
        : box === 2
          ? 'ちずに のって いる なまえかな。'
          : 'いえや がっこうに ある ものの なまえかな。',
    ],
    explain: `「${w}」は ${BOXES[box]} です。`,
    identity: `shurui-alt:${w}`,
  };
}

// ---- 3. のばす おと「ー」と ちいさい「ッ」 ----
/** [正しい, まちがい1, 誤概念1, まちがい2, 誤概念2] */
const NOBASU: [string, string, string, string, string][] = [
  ['ボール', 'ボオル', 'chouon-vowel', 'ボル', 'chouon-drop'],
  ['ケーキ', 'ケエキ', 'chouon-vowel', 'ケキ', 'chouon-drop'],
  ['ノート', 'ノオト', 'chouon-vowel', 'ノト', 'chouon-drop'],
  ['スプーン', 'スプウン', 'chouon-vowel', 'スプン', 'chouon-drop'],
  ['ジュース', 'ジュウス', 'chouon-vowel', 'ジュス', 'chouon-drop'],
  ['カレー', 'カレエ', 'chouon-vowel', 'カレ', 'chouon-drop'],
  ['プール', 'プウル', 'chouon-vowel', 'プル', 'chouon-drop'],
  ['ゲーム', 'ゲエム', 'chouon-vowel', 'ゲム', 'chouon-drop'],
  ['ヨーグルト', 'ヨオグルト', 'chouon-vowel', 'ヨグルト', 'chouon-drop'],
  ['ロボット', 'ロボト', 'sokuon-drop', 'ロボツト', 'small-large'],
  ['コップ', 'コプ', 'sokuon-drop', 'コツプ', 'small-large'],
  ['ベッド', 'ベド', 'sokuon-drop', 'ベツド', 'small-large'],
];

function nobasuItem([ok, w1, m1, w2, m2]: (typeof NOBASU)[number]): ChoiceItem {
  const sokuon = m1 === 'sokuon-drop';
  return {
    engine: 'choice',
    id: `nobasu:${ok}`,
    objective: 'nobasu',
    level: 2,
    prompt: 'ただしい かきかたは どれ？',
    options: opts(ok, [
      [w1, m1],
      [w2, m2],
    ]),
    hints: [
      'こえに だして、ゆっくり よんで みよう。',
      sokuon
        ? 'つまる おとが あるかな。つまる おとは ちいさい「ッ」で かくよ。'
        : 'のばす おとが あるかな。カタカナでは のばす おとを「ー」で かくよ。',
      sokuon
        ? 'ちいさく かく じと、おおきく かく じを くらべよう。'
        : '「オ」「ウ」「エ」で のばしを かかないよ。',
    ],
    explain: sokuon
      ? `「${ok}」は つまる おとを ちいさい「ッ」で かきます。`
      : `「${ok}」は のばす おとを「ー」で かきます。`,
    identity: `nobasu:${ok}`,
  };
}

/** 別例: 文の中の語の □ に入れる */
const NOBASU_ALT: {
  text: string;
  ok: string;
  options: string[];
  wrong: [string, string][];
  word: string;
}[] = [
  {
    text: 'ケ{{}}キを たべた。',
    ok: 'ー',
    options: ['ー', 'エ', 'イ'],
    wrong: [['エ', 'chouon-vowel']],
    word: 'ケーキ',
  },
  {
    text: 'ボ{{}}ルを なげた。',
    ok: 'ー',
    options: ['ー', 'オ', 'ウ'],
    wrong: [
      ['オ', 'chouon-vowel'],
      ['ウ', 'chouon-vowel'],
    ],
    word: 'ボール',
  },
  {
    text: 'ロボ{{}}トが うごいた。',
    ok: 'ッ',
    options: ['ッ', 'ツ', 'ー'],
    wrong: [['ツ', 'small-large']],
    word: 'ロボット',
  },
  {
    text: 'プ{{}}ルで およいだ。',
    ok: 'ー',
    options: ['ー', 'ウ', 'ッ'],
    wrong: [['ウ', 'chouon-vowel']],
    word: 'プール',
  },
];

function nobasuAlt(a: (typeof NOBASU_ALT)[number]): FillItem {
  const sokuon = a.ok === 'ッ';
  return {
    engine: 'fill',
    id: `nobasu-alt:${a.word}`,
    objective: 'nobasu',
    level: 2,
    alt: true,
    prompt: '{{}}に はいる じを えらぼう。',
    text: a.text,
    options: a.options,
    blanks: [
      {
        answers: [a.ok],
        wrong: a.wrong.map(([value, misconception]) => ({ value, misconception })),
      },
    ],
    hints: [
      `「${a.word.slice(0, 1)}」から こえに だして よもう。`,
      sokuon ? 'とちゅうで つまる おとが あるね。' : 'とちゅうで のばす おとが あるね。',
      sokuon ? 'つまる おとは ちいさく かく じ だよ。' : 'カタカナの のばす しるしを さがそう。',
    ],
    explain: sokuon
      ? `「${a.word}」の つまる おとは ちいさい「ッ」です。`
      : `「${a.word}」の のばす おとは「ー」で かきます。`,
    identity: `nobasu-alt:${a.word}`,
  };
}

const items: Item[] = [
  ...ERABU.map(erabuItem),
  ...ERABU_ALT.map(erabuAlt),
  ...Array.from({ length: 8 }, (_, i) => sortItem(i)),
  ...SHURUI_ALT.map(shuruiAlt),
  ...NOBASU.map(nobasuItem),
  ...NOBASU_ALT.map(nobasuAlt),
];

export const katakanaWords: UnitSpec = {
  id: 'g2.ja.katakana-words',
  title: 'カタカナで かく ことば',
  stage: 'g2',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: ['g1.ja.katakana'],
  objectives: [
    { id: 'erabu', title: 'カタカナで かく ことばを みつける' },
    { id: 'shurui', title: 'カタカナで かく ことばの なかま' },
    { id: 'nobasu', title: 'のばす おと「ー」と ちいさい「ッ」' },
  ],
  misconceptions: [
    {
      id: 'native-as-kata',
      explain:
        'にほんで むかしから つかって いる ことばも カタカナだと かんがえたのかな。カタカナで かくのは、ほかの くにから きた ことば・なきごえや おと・がいこくの なまえ だよ。',
    },
    {
      id: 'sound-as-loan',
      explain:
        'おとを まねした ことばを、ほかの くにから きた ことばと かんがえたのかな。こえや おとを まねした ことばは「なきごえ・ものの おと」の なかまだよ。',
    },
    {
      id: 'sound-as-place',
      explain:
        'おとの ことばを なまえと かんがえたのかな。こえに だすと、なにかの おとに きこえるね。',
    },
    {
      id: 'place-as-loan',
      explain:
        'くにや まち、ひとの なまえを、ものの なまえと かんがえたのかな。ちずに のる なまえや ひとの なまえは「がいこくの なまえ」の なかまだよ。',
    },
    {
      id: 'place-as-sound',
      explain: 'なまえを おとの ことばと かんがえたのかな。どこかの ばしょの なまえだよ。',
    },
    {
      id: 'loan-as-place',
      explain:
        'ものの なまえを、ばしょや ひとの なまえと かんがえたのかな。みの まわりに ある ものの なまえは「ほかの くにから きた ことば」だよ。',
    },
    {
      id: 'loan-as-sound',
      explain:
        'ものの なまえを、おとの ことばと かんがえたのかな。みの まわりに ある ものの なまえだよ。',
    },
    {
      id: 'chouon-vowel',
      explain:
        'のばす おとを「オ」「ウ」「エ」で かいたのかな。カタカナでは のばす おとを「ー」で かくよ。',
    },
    {
      id: 'chouon-drop',
      explain: 'のばす おとを かきわすれたのかな。こえに だして、のばす ところを さがそう。',
    },
    {
      id: 'sokuon-drop',
      explain: 'つまる おとを かきわすれたのかな。つまる ところには ちいさい「ッ」を かくよ。',
    },
    {
      id: 'small-large',
      explain: '「ッ」を おおきい「ツ」で かいたのかな。つまる おとは ちいさく かくよ。',
    },
  ],
  levels: [
    { label: 'カタカナで かく ことばを えらぶ', chance: 0.05 },
    { label: 'なかまに わける', chance: 0.05 },
    { label: 'のばす おと・つまる おと', chance: 0.05 },
  ],
  intro: [
    {
      text: 'カタカナで かく ことばには、なかまが あります。',
    },
    {
      text: 'ほかの くにから きた ことば（パン・テレビ）、どうぶつの なきごえや ものの おと（ワンワン・ガチャン）、がいこくの くにや まち、ひとの なまえ（アメリカ・パリ）。',
      figure: { kind: 'text', text: 'パン　ワンワン　アメリカ', size: 'l' },
    },
    {
      text: 'のばす おとは「ー」で かきます。ボール、ケーキ。',
      figure: { kind: 'text', text: 'ボール　ケーキ', size: 'xl' },
    },
  ],
  source: { kind: 'items', items },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕(1)ウ（片仮名で書く語の種類を知り、文や文章の中で使うこと）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
