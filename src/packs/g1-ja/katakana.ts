/**
 * g1.ja.katakana カタカナの よみかき、カタカナで かく ことば（curriculum-matrix 3.4）。
 *
 * 到達項目:
 *   read  … カタカナを よむ（カタカナ ⇔ ひらがな を むすぶ。46字を ぜんぶ おおう）。別例: 1字を えらぶ
 *   trace … かきじゅんで なぞる（46字）。別例: ひらがなに あう カタカナを えらぶ（かきわけ）
 *   which … カタカナで かく ことばを えらぶ。別例: なかまわけ（sort）
 *   spell … のばす おと「ー」・ちいさい「ッ」「ャ」を ただしく かいた ことばを えらぶ。別例: ぶんの なかで
 * 同一性キー: 字（read・trace）、ぎょう・くみ（match）、ことば（which・spell）、ことばの くみ（sort）。
 */
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import type { MatchItem } from '../../engines/match/match';
import type { SortItem } from '../../engines/sort/sort';
import type { TraceItem } from '../../engines/trace/trace';
import { opts, REVISED } from './util';

const KATA =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
const HIRA =
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const STROKES: Record<string, number> = {
  ア: 2,
  イ: 2,
  ウ: 3,
  エ: 3,
  オ: 3,
  カ: 2,
  キ: 3,
  ク: 2,
  ケ: 3,
  コ: 2,
  サ: 3,
  シ: 3,
  ス: 2,
  セ: 2,
  ソ: 2,
  タ: 3,
  チ: 3,
  ツ: 3,
  テ: 3,
  ト: 2,
  ナ: 2,
  ニ: 2,
  ヌ: 2,
  ネ: 4,
  ノ: 1,
  ハ: 2,
  ヒ: 2,
  フ: 1,
  ヘ: 1,
  ホ: 4,
  マ: 2,
  ミ: 3,
  ム: 2,
  メ: 2,
  モ: 3,
  ヤ: 2,
  ユ: 2,
  ヨ: 3,
  ラ: 2,
  リ: 2,
  ル: 2,
  レ: 1,
  ロ: 3,
  ワ: 2,
  ヲ: 3,
  ン: 2,
};
const hira = (k: string) => HIRA[KATA.indexOf(k)]!;

// ---- read: カタカナ ⇔ ひらがな（match） ----
interface MatchSet {
  id: string;
  kata: string;
  /** まぎらわしい ひらがな（下の段に たす）と、まちがえた ときの 組 */
  extra: string[];
  wrong: [kata: string, hira: string, mis: string][];
  hint1: string;
  alt?: boolean;
}

const ROWS: MatchSet[] = [
  {
    id: 'a',
    kata: 'アイウエオ',
    extra: ['ま'],
    wrong: [['ア', 'ま', 'shape-similar']],
    hint1: 'これは 「あ」の ぎょうの じ だよ。',
  },
  {
    id: 'ka',
    kata: 'カキクケコ',
    extra: ['わ'],
    wrong: [['ク', 'わ', 'shape-similar']],
    hint1: 'これは 「か」の ぎょうの じ だよ。',
  },
  {
    id: 'sa',
    kata: 'サシスセソ',
    extra: ['つ'],
    wrong: [['シ', 'つ', 'shi-tsu']],
    hint1: 'これは 「さ」の ぎょうの じ だよ。',
  },
  {
    id: 'ta',
    kata: 'タチツテト',
    extra: ['し'],
    wrong: [['ツ', 'し', 'shi-tsu']],
    hint1: 'これは 「た」の ぎょうの じ だよ。',
  },
  {
    id: 'na',
    kata: 'ナニヌネノ',
    extra: ['す'],
    wrong: [['ヌ', 'す', 'shape-similar']],
    hint1: 'これは 「な」の ぎょうの じ だよ。',
  },
  {
    id: 'ha',
    kata: 'ハヒフヘホ',
    extra: ['ら'],
    wrong: [['フ', 'ら', 'shape-similar']],
    hint1: 'これは 「は」の ぎょうの じ だよ。',
  },
  {
    id: 'ma',
    kata: 'マミムメモ',
    extra: ['あ'],
    wrong: [['マ', 'あ', 'shape-similar']],
    hint1: 'これは 「ま」の ぎょうの じ だよ。',
  },
  {
    id: 'ya',
    kata: 'ヤユヨ',
    extra: ['こ', 'ろ'],
    wrong: [
      ['ユ', 'こ', 'shape-similar'],
      ['ヨ', 'ろ', 'shape-similar'],
    ],
    hint1: 'これは 「や」の ぎょうの じ だよ。',
  },
  {
    id: 'ra',
    kata: 'ラリルレロ',
    extra: ['ふ'],
    wrong: [['ラ', 'ふ', 'shape-similar']],
    hint1: 'これは 「ら」の ぎょうの じ だよ。',
  },
  {
    id: 'wa',
    kata: 'ワヲン',
    extra: ['う', 'そ'],
    wrong: [
      ['ワ', 'う', 'shape-similar'],
      ['ン', 'そ', 'so-n'],
    ],
    hint1: 'これは 「わ」の ぎょうと 「ん」 だよ。',
  },
  // かたちの にた じを まぜた くみ
  {
    id: 'mix-shi',
    kata: 'シツソン',
    extra: [],
    wrong: [
      ['シ', 'つ', 'shi-tsu'],
      ['ソ', 'ん', 'so-n'],
    ],
    hint1: 'てんの むきと、さいごの せんの むきを よく みよう。',
  },
  {
    id: 'mix-ku',
    kata: 'クケタワウ',
    extra: [],
    wrong: [
      ['ク', 'わ', 'shape-similar'],
      ['ワ', 'う', 'shape-similar'],
    ],
    hint1: 'うえの ほうの かたちを よく くらべよう。',
  },
  {
    id: 'mix-ko',
    kata: 'コユヨロ',
    extra: [],
    wrong: [
      ['コ', 'ゆ', 'shape-similar'],
      ['ヨ', 'ろ', 'shape-similar'],
    ],
    hint1: 'よこの せんの かずを かぞえよう。',
  },
  {
    id: 'mix-nu',
    kata: 'ヌスフラヲ',
    extra: [],
    wrong: [
      ['ヌ', 'す', 'shape-similar'],
      ['フ', 'ら', 'shape-similar'],
    ],
    hint1: 'まんなかに てんや せんが あるか みよう。',
  },
  {
    id: 'mix-chi',
    kata: 'チテナメノ',
    extra: [],
    wrong: [
      ['チ', 'て', 'shape-similar'],
      ['ナ', 'め', 'shape-similar'],
    ],
    hint1: 'いちばん うえの せんの かたちを みよう。',
  },
  {
    id: 'mix-a',
    kata: 'アマヤムハ',
    extra: [],
    wrong: [
      ['ア', 'ま', 'shape-similar'],
      ['ム', 'は', 'shape-similar'],
    ],
    hint1: 'まがりかたの ちがいを よく みよう。',
  },
];

function matchItem(s: MatchSet): MatchItem {
  const ks = [...s.kata];
  const right = [...ks.map(hira), ...s.extra];
  const pairs = ks.map((_, i) => [i, i] as [number, number]);
  const shown = ks.slice(0, Math.max(1, ks.length - 2));
  return {
    engine: 'match',
    id: `read:${s.id}`,
    objective: 'read',
    level: 0,
    prompt: 'カタカナと ひらがなを せんで むすぼう。',
    left: ks.map((k) => ({ label: k })),
    right: right.map((h) => ({ label: h })),
    pairs,
    wrongPairs: s.wrong.map(([k, h, m]) => ({
      pair: [ks.indexOf(k), right.indexOf(h)] as [number, number],
      misconception: m,
    })),
    hints: [
      s.hint1,
      'カタカナと ひらがなは、かたちが すこし にて いる ものが あるよ。',
      `${shown.map((k) => `「${k}」は 「${hira(k)}」`).join('、')}。のこりも かんがえよう。`,
    ],
    explain: `${ks.map((k) => `${k}＝${hira(k)}`).join('、')} だよ。`,
    identity: `read:${s.id}`,
  };
}

/** 1字の よみを えらぶ（別例） */
const READ_ALT: [kata: string, wrongs: [string, string][]][] = [
  [
    'ツ',
    [
      ['し', 'shi-tsu'],
      ['そ', 'shape-similar'],
    ],
  ],
  [
    'シ',
    [
      ['つ', 'shi-tsu'],
      ['み', 'shape-similar'],
    ],
  ],
  [
    'ソ',
    [
      ['ん', 'so-n'],
      ['り', 'shape-similar'],
    ],
  ],
  [
    'ン',
    [
      ['そ', 'so-n'],
      ['し', 'shape-similar'],
    ],
  ],
  [
    'ワ',
    [
      ['う', 'shape-similar'],
      ['く', 'shape-similar'],
    ],
  ],
  [
    'ヌ',
    [
      ['す', 'shape-similar'],
      ['め', 'shape-similar'],
    ],
  ],
];

function readAlt([k, w]: (typeof READ_ALT)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `read-alt:${k}`,
    objective: 'read',
    level: 0,
    alt: true,
    prompt: `カタカナの 「${k}」は なんと よむ？`,
    options: opts(hira(k), w),
    hints: [
      'かたちの にた カタカナが あるよ。よく みよう。',
      'てんや せんの むき、まがりかたに めを つけよう。',
      `「${w[0]![0]}」と よむ カタカナは べつの かたち だよ。`,
    ],
    explain: `「${k}」は 「${hira(k)}」と よむよ。`,
    identity: `read-alt:${k}`,
  };
}

// ---- trace: かきじゅんで なぞる（46字） ----
function traceItem(k: string): TraceItem {
  const n = STROKES[k]!;
  return {
    engine: 'trace',
    id: `trace:${k}`,
    objective: 'trace',
    level: 1,
    prompt: `カタカナの 「${k}」を かきじゅんどおりに なぞろう。`,
    char: k,
    mode: 'trace',
    misconceptionIds: { order: 'stroke-order', direction: 'stroke-direction' },
    hints: [
      'みどりの まるから かきはじめよう。',
      'すうじの じゅんに、うえから したへ、ひだりから みぎへ なぞるよ。',
      `ぜんぶで ${n}かく。さいごの かくまで ていねいに なぞろう。`,
    ],
    explain: `「${k}」（${hira(k)}）は ${n}かくで かくよ。`,
    identity: `trace:${k}`,
  };
}

/** ひらがなに あう カタカナを えらぶ（かきわけ。別例） */
const TRACE_ALT: [kata: string, wrongs: [string, string][]][] = [
  [
    'シ',
    [
      ['ツ', 'shi-tsu'],
      ['ミ', 'shape-similar'],
    ],
  ],
  [
    'ツ',
    [
      ['シ', 'shi-tsu'],
      ['ソ', 'shape-similar'],
    ],
  ],
  [
    'ソ',
    [
      ['ン', 'so-n'],
      ['リ', 'shape-similar'],
    ],
  ],
  [
    'ン',
    [
      ['ソ', 'so-n'],
      ['シ', 'shape-similar'],
    ],
  ],
  [
    'ヌ',
    [
      ['ス', 'shape-similar'],
      ['メ', 'shape-similar'],
    ],
  ],
  [
    'ワ',
    [
      ['ク', 'shape-similar'],
      ['ウ', 'shape-similar'],
    ],
  ],
];

function traceAlt([k, w]: (typeof TRACE_ALT)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `trace-alt:${k}`,
    objective: 'trace',
    level: 1,
    alt: true,
    prompt: `ひらがなの 「${hira(k)}」を カタカナで かくと どれ？`,
    options: opts(k, w),
    hints: [
      'にた かたちの カタカナを くらべよう。',
      'てんや せんが どちらから どちらへ むいて いるか みよう。',
      `「${w[0]![0]}」は 「${hira(w[0]![0])}」と よむ カタカナ だよ。`,
    ],
    explain: `「${hira(k)}」は カタカナで 「${k}」と かくよ。`,
    identity: `trace-alt:${k}`,
  };
}

// ---- which: カタカナで かく ことば ----
/** がいこくから きた ことば（ひらがなで かいた かたち, カタカナ） */
const LOAN: [string, string][] = [
  ['ぱん', 'パン'],
  ['ばす', 'バス'],
  ['とまと', 'トマト'],
  ['ばなな', 'バナナ'],
  ['めろん', 'メロン'],
  ['ぴあの', 'ピアノ'],
  ['こっぷ', 'コップ'],
  ['てれび', 'テレビ'],
  ['かめら', 'カメラ'],
  ['くれよん', 'クレヨン'],
  ['ぼたん', 'ボタン'],
  ['たおる', 'タオル'],
  ['らいおん', 'ライオン'],
  ['ぺんぎん', 'ペンギン'],
  ['ぺん', 'ペン'],
  ['がむ', 'ガム'],
  ['じゃむ', 'ジャム'],
  ['ぴざ', 'ピザ'],
  ['ぱじゃま', 'パジャマ'],
  ['ばけつ', 'バケツ'],
  ['てんと', 'テント'],
  ['ろけっと', 'ロケット'],
  ['べっど', 'ベッド'],
  ['はんかち', 'ハンカチ'],
  ['えぷろん', 'エプロン'],
  ['ごりら', 'ゴリラ'],
];
const NATIVE = [
  'ごはん',
  'つくえ',
  'かばん',
  'くつ',
  'はさみ',
  'さかな',
  'りんご',
  'みかん',
  'いぬ',
  'ねこ',
  'かさ',
  'はし',
  'おにぎり',
  'ぼうし',
];

function whichItem(i: number): ChoiceItem {
  const [w, W] = LOAN[i]!;
  const d1 = NATIVE[i % NATIVE.length]!;
  const d2 = NATIVE[(i + 5) % NATIVE.length]!;
  return {
    engine: 'choice',
    id: `which:${w}`,
    objective: 'which',
    level: 2,
    prompt: 'カタカナで かく ことばは どれ？',
    options: opts(w, [
      [d1, 'native-as-kata'],
      [d2, 'native-as-kata'],
    ]),
    hints: [
      'がいこくから きた ことばは カタカナで かくよ。',
      'むかしから にほんで つかって いる ことばは ひらがなで かくよ。',
      `「${d1}」は ひらがなで かく ことば だよ。`,
    ],
    explain: `「${w}」は がいこくから きた ことば。カタカナで 「${W}」と かくよ。`,
    identity: `which:${w}`,
  };
}

const SORT_SETS: [loan: number[], native: number[]][] = [
  [
    [0, 3, 9],
    [0, 1, 6],
  ],
  [
    [1, 5, 12],
    [2, 3, 9],
  ],
  [
    [2, 6, 10],
    [4, 5, 11],
  ],
  [
    [4, 8, 13],
    [7, 10, 13],
  ],
];

function sortItem(k: number): SortItem {
  const [li, ni] = SORT_SETS[k]!;
  const loans = li.map((i) => LOAN[i]!);
  const natives = ni.map((i) => NATIVE[i]!);
  const cards: SortItem['cards'] = [];
  loans.forEach(([w], j) => {
    cards.push({ label: w, box: 0, wrongBoxes: [{ box: 1, misconception: 'kata-as-hira' }] });
    const n = natives[j]!;
    cards.push({ label: n, box: 1, wrongBoxes: [{ box: 0, misconception: 'native-as-kata' }] });
  });
  return {
    engine: 'sort',
    id: `which-alt:${k}`,
    objective: 'which',
    level: 2,
    alt: true,
    prompt: 'カタカナで かく ことばと、ひらがなで かく ことばに わけよう。',
    boxes: [{ label: 'カタカナで かく' }, { label: 'ひらがなで かく' }],
    cards,
    hints: [
      'がいこくから きた ことばは どれかな。',
      'がいこくから きた ことばは、カタカナの はこへ いれよう。',
      `「${loans[0]![0]}」は がいこくから きた ことば だよ。のこりも かんがえよう。`,
    ],
    explain: `${loans.map(([w, W]) => `「${w}」（${W}）`).join('・')}は カタカナ、${natives.map((n) => `「${n}」`).join('・')}は ひらがなで かくよ。`,
    identity: `which-alt:${li.join('-')}:${ni.join('-')}`,
  };
}

// ---- spell: のばす おと・ちいさい じ ----
interface Spell {
  word: string;
  wrongs: [string, string][];
  hint: string;
  illust?: string;
}

const SPELL: Spell[] = [
  {
    word: 'ケーキ',
    wrongs: [
      ['ケキ', 'long-drop'],
      ['ケエキ', 'long-vowel-kana'],
    ],
    hint: 'のばす おとが あるよ。',
  },
  {
    word: 'ボール',
    wrongs: [
      ['ボル', 'long-drop'],
      ['ボオル', 'long-vowel-kana'],
    ],
    hint: 'のばす おとが あるよ。',
    illust: 'ball',
  },
  {
    word: 'ノート',
    wrongs: [
      ['ノト', 'long-drop'],
      ['ノオト', 'long-vowel-kana'],
    ],
    hint: 'のばす おとが あるよ。',
    illust: 'notebook',
  },
  {
    word: 'プール',
    wrongs: [
      ['プル', 'long-drop'],
      ['プウル', 'long-vowel-kana'],
    ],
    hint: 'のばす おとが あるよ。',
  },
  {
    word: 'スプーン',
    wrongs: [
      ['スプン', 'long-drop'],
      ['スプウン', 'long-vowel-kana'],
    ],
    hint: 'のばす おとが あるよ。',
  },
  {
    word: 'ピーマン',
    wrongs: [
      ['ピマン', 'long-drop'],
      ['ピイマン', 'long-vowel-kana'],
    ],
    hint: 'のばす おとが あるよ。',
    illust: 'green-pepper',
  },
  {
    word: 'カレー',
    wrongs: [
      ['カレ', 'long-drop'],
      ['カレエ', 'long-vowel-kana'],
    ],
    hint: 'さいごを のばして いうね。',
  },
  {
    word: 'ジュース',
    wrongs: [
      ['ジュス', 'long-drop'],
      ['ジユース', 'small-big'],
    ],
    hint: 'のばす おとと、ちいさい じが あるよ。',
  },
  {
    word: 'ロボット',
    wrongs: [
      ['ロボト', 'tsu-drop'],
      ['ロボツト', 'small-big'],
    ],
    hint: 'つまる おとが あるよ。',
  },
  {
    word: 'コップ',
    wrongs: [
      ['コプ', 'tsu-drop'],
      ['コツプ', 'small-big'],
    ],
    hint: 'つまる おとが あるよ。',
  },
  {
    word: 'トラック',
    wrongs: [
      ['トラク', 'tsu-drop'],
      ['トラツク', 'small-big'],
    ],
    hint: 'つまる おとが あるよ。',
  },
  {
    word: 'サッカー',
    wrongs: [
      ['サカー', 'tsu-drop'],
      ['サッカ', 'long-drop'],
    ],
    hint: 'つまる おとと、のばす おとが あるよ。',
    illust: 'ball',
  },
  {
    word: 'シャツ',
    wrongs: [
      ['シヤツ', 'small-big'],
      ['シャシ', 'shi-tsu'],
    ],
    hint: 'ちいさい じが あるよ。さいごの じの かたちも みよう。',
  },
  {
    word: 'メロン',
    wrongs: [
      ['メロソ', 'so-n'],
      ['メロ', 'n-drop'],
    ],
    hint: 'さいごの じの かたちを よく みよう。',
  },
  {
    word: 'テレビ',
    wrongs: [
      ['テレヒ', 'dakuten-missing'],
      ['テレ', 'n-drop'],
    ],
    hint: 'てんてんが つく じが あるよ。',
  },
];

function spellHints(s: Spell): string[] {
  return [
    `こえに だして ゆっくり いって みよう。${s.hint}`,
    'のばす おとは 「ー」、つまる おとは ちいさい 「ッ」で かくよ。',
    `「${s.wrongs[0]![0]}」と どこが ちがうか、1じずつ くらべよう。`,
  ];
}

function spellItem(s: Spell): ChoiceItem {
  return {
    engine: 'choice',
    id: `spell:${s.word}`,
    objective: 'spell',
    level: 2,
    prompt: 'カタカナで ただしく かいて あるのは どれ？',
    figure: s.illust ? { kind: 'illust', id: s.illust } : undefined,
    options: opts(s.word, s.wrongs),
    hints: spellHints(s),
    explain: `ただしくは 「${s.word}」。${s.hint}`,
    identity: `spell:${s.word}`,
  };
}

/** ぶんの なかで（別例） */
const SPELL_ALT: [word: string, tail: string, wrongs: [string, string][]][] = [
  [
    'ジュース',
    'を のむ。',
    [
      ['ジュス', 'long-drop'],
      ['ジユース', 'small-big'],
    ],
  ],
  [
    'ノート',
    'に かく。',
    [
      ['ノト', 'long-drop'],
      ['ノオト', 'long-vowel-kana'],
    ],
  ],
  [
    'プール',
    'で およぐ。',
    [
      ['プル', 'long-drop'],
      ['プウル', 'long-vowel-kana'],
    ],
  ],
  [
    'シャツ',
    'を きる。',
    [
      ['シヤツ', 'small-big'],
      ['シャシ', 'shi-tsu'],
    ],
  ],
  [
    'ロボット',
    'で あそぶ。',
    [
      ['ロボト', 'tsu-drop'],
      ['ロボツト', 'small-big'],
    ],
  ],
];

function spellAlt([w, tail, ws]: (typeof SPELL_ALT)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `spell-alt:${w}`,
    objective: 'spell',
    level: 2,
    alt: true,
    prompt: 'カタカナが ただしく かいて ある ぶんは どれ？',
    options: opts(
      `${w}${tail}`,
      ws.map(([x, m]) => [`${x}${tail}`, m] as const),
    ),
    layout: 'column',
    hints: [
      'ぶんを こえに だして よもう。',
      'のばす おとは 「ー」、ちいさい じは ちいさく かくよ。',
      `「${ws[0]![0]}」の ところを よく みよう。`,
    ],
    explain: `ただしくは 「${w}${tail}」 だよ。`,
    identity: `spell-alt:${w}`,
  };
}

const items: Item[] = [
  ...ROWS.map(matchItem),
  ...READ_ALT.map(readAlt),
  ...[...KATA].map(traceItem),
  ...TRACE_ALT.map(traceAlt),
  ...LOAN.map((_, i) => whichItem(i)),
  ...SORT_SETS.map((_, k) => sortItem(k)),
  ...SPELL.map(spellItem),
  ...SPELL_ALT.map(spellAlt),
];

export const katakana: UnitSpec = {
  id: 'g1.ja.katakana',
  title: 'カタカナ',
  stage: 'g1',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'trace-letters',
  prereq: ['p5.ja.katakana-read'],
  objectives: [
    { id: 'read', title: 'カタカナを よむ' },
    { id: 'trace', title: 'カタカナを かきじゅんどおりに かく' },
    { id: 'which', title: 'カタカナで かく ことばを しる' },
    { id: 'spell', title: 'のばす おと・ちいさい じを カタカナで かく' },
  ],
  misconceptions: [
    {
      id: 'shi-tsu',
      explain:
        '「シ」と 「ツ」を とりちがえたのかな。「シ」の てんは よこに ならび、さいごは したから うえへ。「ツ」の てんは うえに ならび、さいごは うえから したへ かくよ。',
    },
    {
      id: 'so-n',
      explain:
        '「ソ」と 「ン」を とりちがえたのかな。「ソ」の てんは うえから、「ン」の てんは ひだりから かくよ。',
    },
    {
      id: 'shape-similar',
      explain:
        'かたちの にた じと まちがえたのかな。てんや せんの かず、むきを ゆっくり くらべよう。',
    },
    {
      id: 'long-drop',
      explain: 'のばす おとを かかなかったのかな。カタカナの のばす おとは 「ー」で かくよ。',
    },
    {
      id: 'long-vowel-kana',
      explain:
        'のばす おとを 「ア」「イ」「ウ」「エ」「オ」で かいたのかな。カタカナでは 「ー」で かくよ。',
    },
    {
      id: 'tsu-drop',
      explain: 'つまる おとを かかなかったのかな。ちいさい 「ッ」を わすれずに かこう。',
    },
    {
      id: 'small-big',
      explain:
        'ちいさく かく じを おおきく かいたのかな。「ッ」「ャ」「ュ」「ョ」は ちいさく かくよ。',
    },
    {
      id: 'dakuten-missing',
      explain: 'てんてんを わすれたのかな。にごる おとには てんてんを つけるよ。',
    },
    {
      id: 'n-drop',
      explain: 'さいごの じを わすれたのかな。こえに だして、おとの かずを かぞえよう。',
    },
    {
      id: 'native-as-kata',
      explain:
        'むかしから にほんで つかって いる ことばを カタカナと かんがえたのかな。カタカナで かくのは、がいこくから きた ことば だよ。',
    },
    {
      id: 'kata-as-hira',
      explain:
        'がいこくから きた ことばを ひらがなと かんがえたのかな。がいこくから きた ことばは カタカナで かくよ。',
    },
    { id: 'stroke-order', explain: 'かく じゅんばんが ちがったかな。すうじの じゅんに なぞろう。' },
    {
      id: 'stroke-direction',
      explain: 'せんを かく むきが ぎゃくだったかな。みどりの まるから かきはじめよう。',
    },
  ],
  levels: [
    { label: 'カタカナを よむ', chance: 0.02 },
    { label: 'カタカナを なぞる', chance: 0.02 },
    { label: 'カタカナで かく ことば', chance: 0.1 },
  ],
  intro: [
    {
      text: 'カタカナは、ひらがなと おなじ おとを あらわす もう ひとつの じ だよ。「あ」は 「ア」、「か」は 「カ」。',
    },
    {
      text: 'がいこくから きた ことばは カタカナで かくよ。「ぱん」は 「パン」、「ばす」は 「バス」。',
    },
    { text: 'のばす おとは 「ー」で かくよ。「ケーキ」「ボール」。' },
  ],
  source: { kind: 'items', items },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕(1)ウ（平仮名及び片仮名を読み、書くこと。片仮名で書く語の種類を知り、文や文章の中で使うこと）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
