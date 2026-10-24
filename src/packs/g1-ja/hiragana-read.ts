/**
 * g1.ja.hiragana-read ひらがなの よみ（清音・濁音・半濁音の71字、音節と文字）。curriculum-matrix 3.4。
 *
 * 到達項目:
 *   char     … 1字の音と字（聞いて字を選ぶ）。71字すべて。別例 = 語の中の字（ことばを聞いて、はじめ・さいごの字）
 *   count    … 語の音の数（字を読んで、音がいくつ）。別例 = 音の数のマスにタイルで語を作る
 *   word     … 絵に合う語を読む。別例 = 語を読んで絵を選ぶ（選択肢は絵だけ）
 *   sentence … 文を拾い読みする（文は図に出し、問題文で読み上げない）。別例 = 文の空欄に語を入れる
 *
 * 読む力を見る問題では、読ませたい字・語・文を問題文（自動で読み上げる）に書かず、図（figure）に出す。
 * 同一性キー: 字の問題は `char:<字>`、語の中の字は `char-word:<語>`、ほかは語・文ごと。
 * 知識の項目（71字）は、1字に2問（単独の字・語の中の字）ずつある（curriculum-matrix 1.3 知）。
 */
import type { Figure } from '../../engines/figure/types';
import type { BuildItem } from '../../engines/build/build';
import type { FillItem } from '../../engines/fill/fill';
import type { ListenItem } from '../../engines/listen/listen';
import type { ChoiceItem, ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import { opts, REVISED, type Wrong } from './util';

// ---- 字の表 ----
const ROWS: string[][] = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', '', 'ゆ', '', 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', '', '', '', 'を'],
  ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  ['だ', 'ぢ', 'づ', 'で', 'ど'],
  ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
  ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
];
const SEION_ROWS = 10;
const ALL: string[] = [...ROWS.flat().filter(Boolean), 'ん'];
const isSeion = (k: string) => ROWS.slice(0, SEION_ROWS).some((r) => r.includes(k)) || k === 'ん';
const rowOf = (k: string) => ROWS.find((r) => r.includes(k)) ?? ['ん'];
const vowelOf = (k: string) => rowOf(k).indexOf(k);

/** 形の似た字（清音） */
const SHAPE: Record<string, string[]> = {
  あ: ['お', 'め'],
  い: ['こ', 'り'],
  う: ['つ', 'ら'],
  え: ['ん', 'そ'],
  お: ['あ', 'す'],
  か: ['や', 'ち'],
  き: ['さ', 'ち'],
  く: ['へ', 'し'],
  け: ['は', 'に'],
  こ: ['い', 'に'],
  さ: ['ち', 'き'],
  し: ['つ', 'く'],
  す: ['む', 'お'],
  せ: ['さ', 'や'],
  そ: ['て', 'ろ'],
  た: ['な', 'に'],
  ち: ['さ', 'ら'],
  つ: ['し', 'う'],
  て: ['そ', 'と'],
  と: ['こ', 'て'],
  な: ['た', 'は'],
  に: ['こ', 'け'],
  ぬ: ['め', 'ね'],
  ね: ['れ', 'わ'],
  の: ['め', 'お'],
  は: ['ほ', 'け'],
  ひ: ['し', 'い'],
  ふ: ['な', 'う'],
  へ: ['く', 'し'],
  ほ: ['は', 'ま'],
  ま: ['ほ', 'も'],
  み: ['め', 'む'],
  む: ['す', 'お'],
  め: ['ぬ', 'あ'],
  も: ['ま', 'し'],
  や: ['か', 'せ'],
  ゆ: ['わ', 'ぬ'],
  よ: ['ま', 'ほ'],
  ら: ['ち', 'う'],
  り: ['い', 'け'],
  る: ['ろ', 'ら'],
  れ: ['ね', 'わ'],
  ろ: ['る', 'ら'],
  わ: ['ね', 'れ'],
  を: ['と', 'あ'],
  ん: ['え', 'そ'],
};

/** 濁音・半濁音のもとの字 */
const BASE: Record<string, string> = {};
const VOICED: Record<string, string> = {};
const SEMI: Record<string, string> = {};
/** 濁音の行 → もとの清音の行（が→か、ざ→さ、だ→た、ば→は） */
const BASE_ROW: Record<number, number> = { 10: 1, 11: 2, 12: 3, 13: 5 };
for (let r = 10; r < 14; r++)
  ROWS[r]!.forEach((k, i) => {
    const b = ROWS[BASE_ROW[r]!]![i]!;
    BASE[k] = b;
    VOICED[b] = k;
  });
ROWS[14]!.forEach((k, i) => {
  const b = ROWS[5]![i]!;
  BASE[k] = b;
  SEMI[b] = k;
});

/** 同じ音で聞き分けられない組（聞く問題の誤りの選択肢に入れない） */
const SAME_SOUND: Record<string, string[]> = {
  じ: ['ぢ'],
  ぢ: ['じ'],
  ず: ['づ'],
  づ: ['ず'],
  お: ['を'],
  を: ['お'],
};

/** 同じ母音で、別の行の字（音の似た字） */
function sameVowel(k: string, step: number): string | undefined {
  const v = vowelOf(k);
  if (v < 0 || k === 'ん') return undefined;
  const group = isSeion(k) ? ROWS.slice(0, SEION_ROWS) : ROWS.slice(SEION_ROWS);
  const r = group.indexOf(rowOf(k));
  for (let d = 1; d < group.length; d++) {
    const c = group[(r + d * step + group.length * 4) % group.length]![v];
    if (c && c !== k) return c;
  }
  return undefined;
}

/** 誤りの選択肢（3つまで）。exclude の字は入れない（語の中の字の問題で、語に含まれる字） */
function distract(k: string, exclude = ''): Wrong[] {
  const out: Wrong[] = [];
  // 「ぢ」「づ」は使う語が少ないので、ほかの字の誤りの選択肢には入れない
  const ban = new Set([
    k,
    ...(SAME_SOUND[k] ?? []),
    ...exclude,
    ...['ぢ', 'づ'].filter((c) => c !== k),
  ]);
  const add = (c: string | undefined, m: string) => {
    if (c && !ban.has(c) && !out.some((o) => o[0] === c)) out.push([c, m]);
  };
  if (isSeion(k)) {
    for (const s of SHAPE[k] ?? []) add(s, 'shape-similar');
    add(VOICED[k] ?? SEMI[k], 'dakuten');
    add(sameVowel(k, 1), 'sound-similar');
    add(sameVowel(k, -1), 'sound-similar');
    if (k === 'ん') add('む', 'sound-similar');
  } else {
    const b = BASE[k]!;
    add(b, 'dakuten');
    add(VOICED[b] !== k ? VOICED[b] : SEMI[b], 'dakuten');
    add(sameVowel(k, 1), 'sound-similar');
    for (const s of SHAPE[b] ?? []) add(VOICED[s] ?? SEMI[s], 'shape-similar');
    add(sameVowel(k, -1), 'sound-similar');
  }
  return out.slice(0, 3);
}

const rowHint = (k: string) => {
  const r = rowOf(k).filter(Boolean);
  return r.length > 1
    ? `「${r.join('・')}」の なかまの じだよ。`
    : '「ん」は ことばの はじめには こない じだよ。';
};
const markHint = (k: string) =>
  isSeion(k)
    ? 'かたちの にて いる じが あるよ。よく みくらべよう。'
    : '「゛」（てんてん）か「゜」（まる）が つく じだよ。どちらが つくかな。';

// ---- 字ごとの語（語の中の字の問題・解説に使う）。pos: 字が語のどこにあるか ----
type Pos = 'first' | 'last' | 'in';
const WORD: Record<string, [string, Pos]> = {
  あ: ['あり', 'first'],
  い: ['いぬ', 'first'],
  う: ['うし', 'first'],
  え: ['えき', 'first'],
  お: ['おに', 'first'],
  か: ['かめ', 'first'],
  き: ['きつね', 'first'],
  く: ['くま', 'first'],
  け: ['けむり', 'first'],
  こ: ['こま', 'first'],
  さ: ['さる', 'first'],
  し: ['しか', 'first'],
  す: ['すいか', 'first'],
  せ: ['せみ', 'first'],
  そ: ['そら', 'first'],
  た: ['たこ', 'first'],
  ち: ['ちず', 'first'],
  つ: ['つくえ', 'first'],
  て: ['てがみ', 'first'],
  と: ['とり', 'first'],
  な: ['なす', 'first'],
  に: ['にんじん', 'first'],
  ぬ: ['ぬりえ', 'first'],
  ね: ['ねこ', 'first'],
  の: ['のり', 'first'],
  は: ['はな', 'first'],
  ひ: ['ひよこ', 'first'],
  ふ: ['ふね', 'first'],
  へ: ['へび', 'first'],
  ほ: ['ほし', 'first'],
  ま: ['まめ', 'first'],
  み: ['みかん', 'first'],
  む: ['むし', 'first'],
  め: ['めだか', 'first'],
  も: ['もも', 'first'],
  や: ['やま', 'first'],
  ゆ: ['ゆき', 'first'],
  よ: ['よる', 'first'],
  ら: ['らくだ', 'first'],
  り: ['りんご', 'first'],
  る: ['はる', 'last'],
  れ: ['れもん', 'first'],
  ろ: ['ろうか', 'first'],
  わ: ['わに', 'first'],
  を: ['ほんを よむ', 'in'],
  ん: ['きりん', 'last'],
  が: ['がけ', 'first'],
  ぎ: ['うさぎ', 'last'],
  ぐ: ['ぐみ', 'first'],
  げ: ['げた', 'first'],
  ご: ['ごま', 'first'],
  ざ: ['ざる', 'first'],
  じ: ['ひつじ', 'last'],
  ず: ['みみず', 'last'],
  ぜ: ['かぜ', 'last'],
  ぞ: ['ぞう', 'first'],
  だ: ['だんご', 'first'],
  ぢ: ['はなぢ', 'last'],
  づ: ['みかづき', 'in'],
  で: ['でんわ', 'first'],
  ど: ['どんぐり', 'first'],
  ば: ['ばら', 'first'],
  び: ['えび', 'last'],
  ぶ: ['ぶた', 'first'],
  べ: ['かべ', 'last'],
  ぼ: ['ぼうし', 'first'],
  ぱ: ['ぱん', 'first'],
  ぴ: ['えんぴつ', 'in'],
  ぷ: ['てんぷら', 'in'],
  ぺ: ['ぺたぺた', 'first'],
  ぽ: ['たんぽぽ', 'last'],
};
const POS_TEXT: Record<Pos, string> = { first: 'はじめ', last: 'さいご', in: 'なか' };

// ---- char: 聞いて字を選ぶ（71字） ----
function charItem(k: string): Item {
  const level = isSeion(k) ? 0 : 1;
  const [word] = WORD[k]!;
  const explain = `「${k}」だよ。「${word}」の「${k}」と おなじ じだね。`;
  const hints = ['もういちど きいて、こえに だして まねして みよう。', markHint(k), rowHint(k)];
  // 同じ音の字がある「ぢ」「づ」「を」は、聞くだけでは決まらないので、字の作り・使い方で問う
  if (k === 'ぢ' || k === 'づ') {
    const b = BASE[k]!;
    const item: ChoiceItem = {
      engine: 'choice',
      id: `char:${k}`,
      objective: 'char',
      level,
      prompt: `「${b}」に てんてん（゛）を つけた じは どれ？`,
      options: opts(k, [
        [k === 'ぢ' ? 'じ' : 'ず', 'same-sound'],
        [b, 'dakuten'],
        [k === 'ぢ' ? 'ぎ' : 'ぐ', 'shape-similar'],
      ]),
      hints: [
        `「${b}」の かたちを さがそう。`,
        'おとが おなじでも、かく じが ちがう ことが あるよ。',
        `「${b}」の みぎうえに「゛」が ついて いる じだよ。`,
      ],
      explain: `「${b}」に「゛」で「${k}」。「${word}」の「${k}」だよ。`,
      identity: `char:${k}`,
    };
    return item;
  }
  if (k === 'を') {
    const item: ChoiceItem = {
      engine: 'choice',
      id: 'char:を',
      objective: 'char',
      level: 0,
      prompt: '「ほん□ よむ」の □に はいる じは どれ？',
      options: opts('を', [
        ['お', 'wo-o'],
        ['と', 'shape-similar'],
      ]),
      hints: [
        '「ほん」と「よむ」を つなぐ じだよ。',
        '「お」と おなじ おとでも、つなぐ ときは べつの じを かくよ。',
        '「わ」の なかまの じだよ。',
      ],
      explain: '「ほんを よむ」の「を」だよ。ことばを つなぐ ときは「を」と かくよ。',
      identity: 'char:を',
    };
    return item;
  }
  const item: ListenItem = {
    engine: 'listen',
    id: `char:${k}`,
    objective: 'char',
    level,
    prompt: 'きこえた おとの じは どれ？',
    audio: { text: k },
    options: opts(k, distract(k)),
    hints,
    explain,
    identity: `char:${k}`,
  };
  return item;
}

// ---- char の別例: ことばを聞いて、語の中の字を選ぶ（71字） ----
function charWordItem(k: string): Item {
  const [word, pos] = WORD[k]!;
  if (k === 'を') {
    const item: ChoiceItem = {
      engine: 'choice',
      id: 'char-word:を',
      objective: 'char',
      level: 1,
      prompt: '「てを あらう」の「て」の つぎの じは どれ？',
      figure: { kind: 'text', text: 'て□ あらう', size: 'xl' },
      options: opts('を', [
        ['お', 'wo-o'],
        ['あ', 'shape-similar'],
      ]),
      hints: [
        '「て」と「あらう」を つなぐ じだよ。',
        '「お」と おなじ おとでも、つなぐ ときは べつの じを かくよ。',
        '「ほん□ よむ」の □と おなじ じだよ。',
      ],
      explain: '「てを あらう」の「を」だよ。ことばと ことばを つなぐ「を」だね。',
      identity: 'char-word:を',
      alt: true,
    };
    return item;
  }
  const item: ListenItem = {
    engine: 'listen',
    id: `char-word:${word}`,
    objective: 'char',
    level: 1,
    prompt: `きこえた ことばの ${POS_TEXT[pos]}${pos === 'in' ? 'に ある' : 'の'} じは どれ？`,
    audio: { text: word },
    options: opts(k, distract(k, word)),
    hints: [
      `もういちど きいて、ことばの ${POS_TEXT[pos]}の おとを こえに だそう。`,
      markHint(k),
      rowHint(k),
    ],
    explain: `「${word}」の ${POS_TEXT[pos]}${pos === 'in' ? 'に ある' : 'の'} じは「${k}」だよ。`,
    identity: `char-word:${word}`,
    alt: true,
  };
  return item;
}

// ---- count: 音の数 ----
const DAKU = /[がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ]/;
const COUNT_WORDS: [word: string, illust?: string][] = [
  ['ねこ', 'cat'],
  ['うさぎ', 'rabbit'],
  ['きつね', 'fox'],
  ['たまご', 'egg'],
  ['えんぴつ', 'pencil'],
  ['にんじん', 'carrot'],
  ['ひよこ', 'chick'],
  ['ぶどう'],
  ['かぶとむし'],
  ['めだか'],
];
function countItem(word: string, illust?: string): ChoiceItem {
  const n = [...word].length;
  const hasDaku = DAKU.test(word);
  const wordFig: Figure = { kind: 'text', text: word, size: 'xl' };
  return {
    engine: 'choice',
    id: `count:${word}`,
    objective: 'count',
    level: 1,
    prompt: 'この ことばは いくつの おと？ てを たたきながら よんで みよう。',
    figure: illust ? { kind: 'column', items: [{ kind: 'illust', id: illust }, wordFig] } : wordFig,
    options: [
      { label: `${n - 1}つ`, misconception: 'count-off' },
      { label: `${n}つ`, correct: true },
      { label: `${n + 1}つ`, misconception: hasDaku ? 'count-dakuten' : 'count-off' },
    ],
    fixedOrder: true,
    hints: [
      'じを ひとつずつ ゆびで おさえながら よもう。',
      hasDaku
        ? '「゛」や「゜」は じの いちぶだよ。べつに かぞえないよ。'
        : 'ひとつの じが ひとつの おとだよ。「ん」も ひとつと かぞえるよ。',
      `はじめの「${word[0]}」で ひとつ。つぎの じで ふたつ…と かぞえよう。`,
    ],
    explain: `「${word}」は ${[...word].join('・')}で ${n}つの おとだよ。`,
    identity: `count:${word}`,
  };
}

/** count の別例: 音の数のマスに、タイルで語を作る */
const BUILD_WORDS: [word: string, illust: string, extra: [string, string][]][] = [
  [
    'かえる',
    'frog',
    [
      ['が', 'dakuten'],
      ['ろ', 'shape-similar'],
    ],
  ],
  [
    'りんご',
    'apple',
    [
      ['こ', 'dakuten'],
      ['い', 'shape-similar'],
    ],
  ],
  [
    'すいか',
    'watermelon',
    [
      ['む', 'shape-similar'],
      ['が', 'dakuten'],
    ],
  ],
  [
    'はさみ',
    'scissors',
    [
      ['ば', 'dakuten'],
      ['め', 'shape-similar'],
    ],
  ],
  [
    'くるま',
    'car-red',
    [
      ['ぐ', 'dakuten'],
      ['ろ', 'shape-similar'],
    ],
  ],
  [
    'たこ',
    'octopus',
    [
      ['だ', 'dakuten'],
      ['い', 'shape-similar'],
    ],
  ],
];
function buildItem(word: string, illust: string, extra: [string, string][]): BuildItem {
  const chars = [...word];
  const wrongAnswers = extra.flatMap(([c, m]) => {
    // まぎらわしい字を、その字と取り違えやすい位置に入れた語
    const at = chars.findIndex((x) =>
      m === 'dakuten'
        ? BASE[c] === x || BASE[x] === c || VOICED[x] === c
        : (SHAPE[x] ?? []).includes(c),
    );
    if (at < 0) return [];
    const v = [...chars];
    v[at] = c;
    return [{ value: v.join(''), misconception: m }];
  });
  return {
    engine: 'build',
    id: `count-build:${word}`,
    objective: 'count',
    level: 1,
    prompt: 'えに あう ことばを つくろう。おとの かずだけ ますが あるよ。',
    figure: { kind: 'illust', id: illust },
    tiles: [...chars, ...extra.map(([c]) => c)],
    answer: { kind: 'text', values: [word] },
    wrongAnswers,
    hints: [
      'えの なまえを こえに だして、おとの かずを かぞえよう。',
      `${chars.length}つの おとで できて いるよ。ますも ${chars.length}つ。`,
      `はじめの じは「${chars[0]}」だよ。`,
    ],
    explain: `「${word}」。${chars.length}つの おとだから、${chars.length}つの じを ならべるよ。`,
    identity: `count-build:${word}`,
    alt: true,
  };
}

// ---- word: 絵に合う語を読む ----
type W = [illust: string, word: string, w1: Wrong, w2: Wrong];
const WORDS: W[] = [
  ['cat', 'ねこ', ['れこ', 'shape-similar'], ['ねい', 'shape-similar']],
  ['dog', 'いぬ', ['いめ', 'shape-similar'], ['りぬ', 'shape-similar']],
  ['rabbit', 'うさぎ', ['うさき', 'dakuten'], ['うちぎ', 'shape-similar']],
  ['monkey', 'さる', ['さろ', 'shape-similar'], ['ちる', 'shape-similar']],
  ['fox', 'きつね', ['きつれ', 'shape-similar'], ['さつね', 'shape-similar']],
  ['frog', 'かえる', ['かえろ', 'shape-similar'], ['がえる', 'dakuten']],
  ['octopus', 'たこ', ['だこ', 'dakuten'], ['なこ', 'shape-similar']],
  ['bear', 'くま', ['ぐま', 'dakuten'], ['くほ', 'shape-similar']],
  ['bird', 'とり', ['どり', 'dakuten'], ['とい', 'shape-similar']],
  ['chick', 'ひよこ', ['びよこ', 'dakuten'], ['ひよい', 'shape-similar']],
  ['ant', 'あり', ['おり', 'shape-similar'], ['あい', 'shape-similar']],
  ['elephant', 'ぞう', ['そう', 'dakuten'], ['ぞつ', 'shape-similar']],
  ['apple', 'りんご', ['りんこ', 'dakuten'], ['いんご', 'shape-similar']],
  ['peach', 'もも', ['まも', 'shape-similar'], ['もま', 'shape-similar']],
  ['eggplant', 'なす', ['たす', 'shape-similar'], ['なむ', 'shape-similar']],
  ['lemon', 'れもん', ['ねもん', 'shape-similar'], ['れまん', 'shape-similar']],
  ['bread', 'ぱん', ['ばん', 'dakuten'], ['はん', 'dakuten']],
  ['ship', 'ふね', ['ぶね', 'dakuten'], ['ふれ', 'shape-similar']],
  ['pencil', 'えんぴつ', ['えんびつ', 'dakuten'], ['えんぴし', 'shape-similar']],
];
function wordItem([illust, word, w1, w2]: W): ChoiceItem {
  return {
    engine: 'choice',
    id: `word:${word}`,
    objective: 'word',
    level: 0,
    prompt: 'えに あう ことばは どれ？',
    figure: { kind: 'illust', id: illust },
    options: opts(word, [w1, w2]),
    hints: [
      'えの なまえを こえに だして いおう。',
      'にて いる じや「゛」「゜」に きを つけて、ひとつずつ よもう。',
      `「${word[0]}」で はじまる ことばを、さいごまで ゆっくり よもう。`,
    ],
    explain: `えは「${word}」。${[...word].join('・')}と よむよ。`,
    identity: `word:${word}`,
  };
}

/** word の別例: 語を読んで絵を選ぶ（選択肢は絵だけ。はじめの字が同じ絵を混ぜる） */
const PICK: [word: string, illust: string, others: string[]][] = [
  ['かさ', 'umbrella', ['turtle', 'frog']],
  ['かめ', 'turtle', ['umbrella', 'frog']],
  ['はな', 'flower', ['scissors']],
  ['はさみ', 'scissors', ['flower']],
  ['たまご', 'egg', ['octopus']],
  ['きつね', 'fox', ['tree']],
  ['いぬ', 'dog', ['rock', 'strawberry']],
  ['いちご', 'strawberry', ['dog', 'rock']],
  ['くま', 'bear', ['car-red']],
  ['うさぎ', 'rabbit', ['cow']],
];
function pickItem([word, illust, others]: (typeof PICK)[number]): ChoiceItem {
  const options: ChoiceOption[] = [
    { figure: { kind: 'illust', id: illust }, correct: true },
    ...others.map((o) => ({
      figure: { kind: 'illust', id: o } as Figure,
      misconception: 'first-only',
    })),
  ];
  return {
    engine: 'choice',
    id: `word-pick:${word}`,
    objective: 'word',
    level: 1,
    prompt: 'ことばを よんで、あう えを えらぼう。',
    figure: { kind: 'text', text: word, size: 'xl' },
    options,
    hints: [
      'ことばを こえに だして よもう。',
      'はじめの じだけで えらばず、さいごの じまで よもう。',
      `「${word[0]}」の つぎの じは「${word[1]}」だよ。`,
    ],
    explain: `「${word}」の えだね。`,
    identity: `word-pick:${word}`,
    alt: true,
  };
}

// ---- sentence: 文を拾い読み（文は図に出す。選択肢は絵だけ） ----
type S = {
  id: string;
  text: string;
  q: string;
  ans: string;
  other?: string[];
  notIn: string[];
  h2: string;
  h3: string;
  explain: string;
};
const SENTENCES: S[] = [
  {
    id: 'saru',
    text: 'さるが りんごを たべる。',
    q: 'たべるのは だれ？',
    ans: 'monkey',
    other: ['apple'],
    notIn: ['bear'],
    h2: '「〜が」の まえの ことばが、する ものだよ。',
    h3: '「□□が たべる」の □□を よもう。',
    explain: '「さるが たべる」だから、さるだよ。りんごは たべられる ものだね。',
  },
  {
    id: 'neko',
    text: 'ねこが いぬを みて いる。',
    q: 'みて いるのは だれ？',
    ans: 'cat',
    other: ['dog'],
    notIn: ['rabbit'],
    h2: '「〜が」の まえの ことばが、みて いる ものだよ。',
    h3: '「□□が」の □□を よもう。',
    explain: '「ねこが みて いる」だから、ねこだよ。いぬは みられて いるね。',
  },
  {
    id: 'tori',
    text: 'とりが きの えだに とまった。',
    q: 'とりが とまったのは どこ？',
    ans: 'tree',
    other: ['bird'],
    notIn: ['rock'],
    h2: '「〜に とまった」の まえを みよう。',
    h3: '「□の えだに」の □を よもう。',
    explain: '「きの えだに とまった」から、きだよ。',
  },
  {
    id: 'kame',
    text: 'かめが いしの うえで ねて いる。',
    q: 'かめが いるのは なんの うえ？',
    ans: 'rock',
    other: ['turtle'],
    notIn: ['leaf'],
    h2: '「〜の うえ」の まえを みよう。',
    h3: '「□□の うえ」の □□を よもう。',
    explain: '「いしの うえで ねて いる」から、いしだよ。',
  },
  {
    id: 'kuma',
    text: 'くまが ももを みっつ もって いる。',
    q: 'くまが もって いるのは なに？',
    ans: 'peach',
    other: ['bear'],
    notIn: ['mikan'],
    h2: '「〜を もって いる」の まえを みよう。',
    h3: '「□□を」の □□を よもう。',
    explain: '「ももを もって いる」から、ももだよ。',
  },
  {
    id: 'usagi',
    text: 'うさぎが にんじんを かじる。',
    q: 'うさぎが かじるのは なに？',
    ans: 'carrot',
    other: ['rabbit'],
    notIn: ['cucumber'],
    h2: '「〜を かじる」の まえを みよう。',
    h3: '「□□□□を」の □□□□を よもう。',
    explain: '「にんじんを かじる」から、にんじんだよ。',
  },
  {
    id: 'fune',
    text: 'ひろい うみを ふねが すすむ。',
    q: 'うみを すすむのは なに？',
    ans: 'ship',
    notIn: ['car-red', 'airplane'],
    h2: '「〜が すすむ」の まえを みよう。',
    h3: '「□□が」の □□を よもう。',
    explain: '「ふねが すすむ」から、ふねだよ。',
  },
  {
    id: 'hiyoko',
    text: 'たまごから ひよこが でて きた。',
    q: 'でて きたのは だれ？',
    ans: 'chick',
    other: ['egg'],
    notIn: ['bird'],
    h2: '「〜が でて きた」の まえを みよう。',
    h3: '「□□□が」の □□□を よもう。',
    explain: '「ひよこが でて きた」から、ひよこだよ。たまごは でて きた ところだね。',
  },
];
function sentenceItem(s: S): ChoiceItem {
  const fig = (id: string): Figure => ({ kind: 'illust', id });
  return {
    engine: 'choice',
    id: `sentence:${s.id}`,
    objective: 'sentence',
    level: 2,
    prompt: `ぶんを よもう。${s.q}`,
    figure: { kind: 'text', text: s.text, size: 'l' },
    options: [
      { figure: fig(s.ans), correct: true },
      ...(s.other ?? []).map((o) => ({ figure: fig(o), misconception: 'sentence-other' })),
      ...s.notIn.map((o) => ({ figure: fig(o), misconception: 'not-in-sentence' })),
    ],
    hints: ['ぶんを ゆびで なぞりながら、こえに だして よもう。', s.h2, s.h3],
    explain: s.explain,
    identity: `sentence:${s.id}`,
  };
}

/** sentence の別例: 文の空欄に、絵に合う語を入れる */
const FILLS: [id: string, illust: string, text: string, ans: string, wrong: [string, string][]][] =
  [
    [
      'neru',
      'cat',
      '{{}}が まるく なって ねて いる。',
      'ねこ',
      [
        ['れこ', 'shape-similar'],
        ['ねい', 'shape-similar'],
      ],
    ],
    [
      'umi',
      'ship',
      '{{}}が うみに うかんで いる。',
      'ふね',
      [
        ['ぶね', 'dakuten'],
        ['ふれ', 'shape-similar'],
      ],
    ],
    [
      'ame',
      'umbrella',
      'あめの ひは {{}}を さす。',
      'かさ',
      [
        ['がさ', 'dakuten'],
        ['かち', 'shape-similar'],
      ],
    ],
    [
      'taberu',
      'apple',
      'あかい {{}}を たべた。',
      'りんご',
      [
        ['りんこ', 'dakuten'],
        ['いんご', 'shape-similar'],
      ],
    ],
  ];
function fillItem([id, illust, text, ans, wrong]: (typeof FILLS)[number]): FillItem {
  return {
    engine: 'fill',
    id: `sentence-fill:${id}`,
    objective: 'sentence',
    level: 2,
    prompt: 'えを みて、□に あう ことばを いれよう。',
    figure: { kind: 'illust', id: illust },
    text,
    options: [ans, ...wrong.map(([w]) => w)],
    blanks: [
      { answers: [ans], wrong: wrong.map(([value, misconception]) => ({ value, misconception })) },
    ],
    hints: [
      'えの なまえを こえに だして いおう。',
      'にて いる じや「゛」に きを つけて よもう。',
      `「${ans[0]}」で はじまる ことばを さがそう。`,
    ],
    explain: `「${text.replace('{{}}', ans)}」。えは「${ans}」だね。`,
    identity: `sentence-fill:${id}`,
    alt: true,
  };
}

const items: Item[] = [
  ...ALL.map(charItem),
  ...ALL.map(charWordItem),
  ...WORDS.map(wordItem),
  ...PICK.map(pickItem),
  ...COUNT_WORDS.map(([w, i]) => countItem(w, i)),
  ...BUILD_WORDS.map(([w, i, e]) => buildItem(w, i, e)),
  ...SENTENCES.map(sentenceItem),
  ...FILLS.map(fillItem),
];

export const hiraganaRead: UnitSpec = {
  id: 'g1.ja.hiragana-read',
  title: 'ひらがなを よもう',
  stage: 'g1',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-hiragana',
  prereq: ['p5.ja.kana-read-all'],
  objectives: [
    { id: 'char', title: 'ひとつの じの おと' },
    { id: 'count', title: 'ことばの おとの かず' },
    { id: 'word', title: 'えに あう ことばを よむ' },
    { id: 'sentence', title: 'ぶんを よむ' },
  ],
  misconceptions: [
    {
      id: 'shape-similar',
      explain: 'かたちの にて いる じと まちがえたのかな。まがりかたや むすびかたを よく みよう。',
    },
    {
      id: 'dakuten',
      explain: '「゛」（てんてん）や「゜」（まる）を みおとしたのかな。じの みぎうえを みよう。',
    },
    {
      id: 'sound-similar',
      explain:
        'おとの にて いる じと まちがえたのかな。くちの かたちを まねして、もういちど きこう。',
    },
    {
      id: 'same-sound',
      explain:
        'おとが おなじ じと まちがえたのかな。「ち」に「゛」は「ぢ」、「し」に「゛」は「じ」だよ。',
    },
    {
      id: 'wo-o',
      explain: '「お」と かんがえたのかな。ことばと ことばを つなぐ ときは「を」と かくよ。',
    },
    {
      id: 'count-off',
      explain:
        'かぞえる ときに ひとつ とばしたり、おおく かぞえたり したのかな。じを ゆびで おさえて かぞえよう。',
    },
    {
      id: 'count-dakuten',
      explain:
        '「゛」や「゜」も ひとつと かぞえたのかな。「゛」は じの いちぶだから、かぞえないよ。',
    },
    {
      id: 'first-only',
      explain: 'はじめの じだけ みて えらんだのかな。さいごの じまで よもう。',
    },
    {
      id: 'sentence-other',
      explain:
        'ぶんの なかの べつの ことばを えらんだのかな。「〜が」「〜を」の まえを よく みよう。',
    },
    {
      id: 'not-in-sentence',
      explain: 'ぶんに ない ものを えらんだのかな。もういちど ぶんを ゆびで なぞって よもう。',
    },
  ],
  levels: [
    { label: 'せいおん（あ〜ん）', chance: 0.1 },
    { label: 'てんてん・まる、おとの かず', chance: 0.1 },
    { label: 'ぶんを よむ', chance: 0.1 },
  ],
  intro: [
    {
      text: 'ひらがなは ひとつの じが ひとつの おと。「ね」「こ」で「ねこ」。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'illust', id: 'cat' },
          { kind: 'text', text: 'ね こ', size: 'xl' },
        ],
      },
    },
    {
      text: '「か」に「゛」（てんてん）を つけると「が」。「は」に「゜」（まる）を つけると「ぱ」。',
      figure: { kind: 'text', text: 'か → が　は → ぱ', size: 'xl' },
    },
    {
      text: 'ことばを よむ ときは、じを ひとつずつ ゆびで おさえて よもう。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'illust', id: 'rabbit' },
          { kind: 'text', text: 'う さ ぎ', size: 'xl' },
        ],
      },
    },
  ],
  source: { kind: 'items', items },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年 〔知識及び技能〕(1)ア（音節と文字の関係）・ウ（平仮名を読むこと）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
