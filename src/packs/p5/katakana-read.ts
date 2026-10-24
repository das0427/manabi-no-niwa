/**
 * p5.ja.katakana-read カタカナを よむ（curriculum-matrix 3.3・4.4）: ひらがなとの対応 → 身近な語と絵 → 形の似た字。
 * 書きは p5.hand.katakana-trace（P2・既定で非表示）。公的資料に記述が無い題材（教C1/C2）なので、読みだけ。
 * 同一性キー: pair:行の3字、hear:字、word:語、hearword:語、similar:字、hira:字。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { MatchItem } from '../../engines/match/match';
import { choiceItem, ill, listenItem, mix } from './lib';

const HIRA =
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const KATA =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
const toKata = (h: string) => KATA[[...HIRA].indexOf(h)]!;

/** 形の似た字の組 */
const SIMILAR: [string, string][] = [
  ['シ', 'ツ'],
  ['ソ', 'ン'],
  ['ク', 'ケ'],
  ['ワ', 'ウ'],
  ['コ', 'ユ'],
  ['チ', 'テ'],
  ['ヌ', 'ス'],
  ['ノ', 'メ'],
  ['ア', 'マ'],
  ['ロ', 'コ'],
];
const similarOf = (k: string) => SIMILAR.find((p) => p.includes(k))?.find((x) => x !== k);

function pairItem(hs: string[]): MatchItem {
  const ks = hs.map(toKata);
  // 下の段に、形の似た字を1つ足す（あれば）
  const extra = ks.map(similarOf).find((x) => x && !ks.includes(x));
  const right = mix(`pair:${hs.join('')}`, [...ks, ...(extra ? [extra] : [])]);
  const id = `pair:${hs.join('')}`;
  return {
    engine: 'match',
    id,
    objective: 'pair',
    level: 0,
    prompt: 'おなじ おとの ひらがなと カタカナを せんで むすぼう。',
    left: hs.map((h) => ({ label: h })),
    right: right.map((k) => ({ label: k })),
    pairs: ks.map((k, li) => [li, right.indexOf(k)] as [number, number]),
    wrongPairs: extra
      ? ks.flatMap((k, li) =>
          similarOf(k) === extra
            ? [
                {
                  pair: [li, right.indexOf(extra)] as [number, number],
                  misconception: 'similar-shape',
                },
              ]
            : [],
        )
      : [],
    hints: [
      'ひらがなと にて いる カタカナも あるよ。',
      'ひとつずつ こえに だして、おなじ おとの じを さがそう。',
    ],
    explain: hs.map((h, k) => `${h}は ${ks[k]}`).join('、') + '。',
    identity: id,
  };
}

function hearItem(k: string): Item {
  const sim = similarOf(k);
  const others = mix(
    `hear:${k}`,
    [...KATA].filter((x) => x !== k && x !== sim),
  ).slice(0, sim ? 2 : 3);
  return listenItem({
    id: `hear:${k}`,
    objective: 'pair',
    level: 0,
    alt: true,
    prompt: 'きこえた おとの カタカナは どれ？',
    audio: { text: [...HIRA][[...KATA].indexOf(k)]! },
    hints: ['もういちど きこう。', 'ひらがなを おもいうかべて、にた かたちを さがそう。'],
    explain: `この おとは カタカナで「${k}」。`,
    identity: `hear:${k}`,
    correct: { label: k },
    wrong: [
      ...(sim ? [{ label: sim, misconception: 'similar-shape' }] : []),
      ...others.map((x) => ({ label: x, misconception: 'other-char' })),
    ],
  });
}

/** 絵の ある 身近な語（誤りは 点・丸の ちがいや 形の似た字） */
const WORDS: { illust: string; word: string; wrong: [string, string] }[] = [
  { illust: 'bus-yellow', word: 'バス', wrong: ['パス', 'ハス'] },
  { illust: 'banana', word: 'バナナ', wrong: ['パナナ', 'バメナ'] },
  { illust: 'tomato', word: 'トマト', wrong: ['ドマト', 'トアト'] },
  { illust: 'bread', word: 'パン', wrong: ['バン', 'パソ'] },
  { illust: 'lemon', word: 'レモン', wrong: ['レモソ', 'ルモン'] },
  { illust: 'green-pepper', word: 'ピーマン', wrong: ['ビーマン', 'ピーアン'] },
  { illust: 'ball', word: 'ボール', wrong: ['ポール', 'ホール'] },
  { illust: 'p5-truck', word: 'トラック', wrong: ['トラシク', 'ドラック'] },
  { illust: 'p5-rocket', word: 'ロケット', wrong: ['ロクット', 'ロケシト'] },
  { illust: 'p5-ribbon', word: 'リボン', wrong: ['リポン', 'リボソ'] },
  { illust: 'p5-cake', word: 'ケーキ', wrong: ['クーキ', 'ゲーキ'] },
  { illust: 'p5-icecream', word: 'アイス', wrong: ['マイス', 'アイヌ'] },
  { illust: 'p5-tv', word: 'テレビ', wrong: ['チレビ', 'テレヒ'] },
  { illust: 'p23-spoon', word: 'スプーン', wrong: ['ヌプーン', 'スブーン'] },
  { illust: 'p23-cup', word: 'コップ', wrong: ['ユップ', 'コッブ'] },
  { illust: 'p23-towel', word: 'タオル', wrong: ['ダオル', 'タオレ'] },
];
const misOf = (right: string, wrong: string) => {
  const r = [...right];
  const w = [...wrong];
  const i = r.findIndex((c, k) => c !== w[k]);
  if (i < 0) return 'other-char';
  return r[i]!.normalize('NFD')[0] === w[i]!.normalize('NFD')[0] ? 'dakuten' : 'similar-shape';
};

function wordItem(w: (typeof WORDS)[number]): Item {
  return choiceItem({
    id: `word:${w.word}`,
    objective: 'word',
    level: 1,
    prompt: 'この えの なまえは どれ？ よんで えらぼう。',
    figure: ill(w.illust),
    hints: [
      'ひとつずつ じを よんで みよう。',
      '「てんてん」「まる」や、にた かたちの じに きを つけよう。',
    ],
    explain: `「${w.word}」と よむよ。`,
    identity: `word:${w.word}`,
    correct: { label: w.word },
    wrong: w.wrong.map((x) => ({ label: x, misconception: misOf(w.word, x) })),
  });
}

/** 別例: 聞いた語を カタカナで 選ぶ（絵なし） */
const HEAR_WORDS: [string, string, string][] = [
  ['ライオン', 'ライオソ', 'ヲイオン'],
  ['ペンギン', 'ベンギン', 'ペソギン'],
  ['ゴリラ', 'コリラ', 'ゴリヲ'],
  ['パンダ', 'バンダ', 'パンタ'],
  ['コアラ', 'ユアラ', 'コマラ'],
  ['カメラ', 'ガメラ', 'カヌラ'],
  ['ピアノ', 'ビアノ', 'ピアメ'],
  ['ギター', 'キター', 'ギテー'],
  ['ジュース', 'シュース', 'ジュースー'],
  ['プリン', 'ブリン', 'プリソ'],
  ['ドーナツ', 'トーナツ', 'ドーナシ'],
  ['クレヨン', 'ケレヨン', 'クレヨソ'],
  ['ノート', 'メート', 'ノード'],
  ['ハサミ', 'バサミ', 'ハサモ'],
];
function hearWordItem([word, w1, w2]: [string, string, string]): Item {
  return listenItem({
    id: `hearword:${word}`,
    objective: 'word',
    level: 1,
    alt: true,
    prompt: 'きこえた ことばは どれ？ よんで えらぼう。',
    audio: { text: word },
    hints: [
      'もういちど きいて、ひとつずつ じを よもう。',
      '「てんてん」「まる」や、にた かたちの じに きを つけよう。',
    ],
    explain: `「${word}」と かくよ。`,
    identity: `hearword:${word}`,
    correct: { label: word },
    wrong: [w1, w2].map((x) => ({
      label: x,
      misconception: [...x].length !== [...word].length ? 'other-char' : misOf(word, x),
    })),
  });
}

/** 形の似た字（聞いて選ぶ） */
function similarItem(k: string, other: string): Item {
  const third = mix(
    `sim:${k}`,
    [...KATA].filter((x) => x !== k && x !== other),
  )[0]!;
  return listenItem({
    id: `similar:${k}`,
    objective: 'similar',
    level: 2,
    prompt: 'きこえた おとの カタカナは どれ？ にて いる じに きを つけてね。',
    audio: { text: [...HIRA][[...KATA].indexOf(k)]! },
    hints: [
      'てんや せんの むきを よく みよう。',
      `「${k === 'シ' || k === 'ツ' ? 'シは したから うえへ、ツは うえから したへ はらう' : 'せんの ながさや むきを くらべよう'}」よ。`,
    ],
    explain: `「${k}」と「${other}」は にて いるね。きこえたのは「${k}」。`,
    identity: `similar:${k}`,
    correct: { label: k },
    wrong: [
      { label: other, misconception: 'similar-shape' },
      { label: third, misconception: 'other-char' },
    ],
  });
}

/** 別例: ひらがなを 見て、おなじ 音の カタカナを 選ぶ */
function hiraItem(k: string, other: string): Item {
  const h = [...HIRA][[...KATA].indexOf(k)]!;
  return choiceItem({
    id: `hira:${k}`,
    objective: 'similar',
    level: 2,
    alt: true,
    prompt: 'この ひらがなと おなじ おとの カタカナは どれ？',
    figure: { kind: 'text', text: h, size: 'xl' },
    hints: ['ひらがなを よんで みよう。', 'にて いる カタカナが 2つ あるよ。よく くらべよう。'],
    explain: `「${h}」は カタカナで「${k}」。`,
    identity: `hira:${k}`,
    correct: { label: k },
    wrong: [{ label: other, misconception: 'similar-shape' }],
  });
}

function build(): Item[] {
  const items: Item[] = [];
  const hs = [...HIRA];
  for (let i = 0; i < hs.length; i += 3) {
    const g = hs.slice(i, i + 3);
    items.push(pairItem(g.length === 3 ? g : hs.slice(hs.length - 3)));
  }
  for (const k of ['ア', 'カ', 'サ', 'ナ', 'ホ']) items.push(hearItem(k));
  for (const w of WORDS) items.push(wordItem(w));
  for (const w of HEAR_WORDS) items.push(hearWordItem(w));
  for (const [a, b] of SIMILAR) items.push(similarItem(a, b), similarItem(b, a));
  for (const [a, b] of SIMILAR.slice(0, 4)) items.push(hiraItem(a, b));
  // 重複した id（「ロ」「コ」のように 2組に入る字）を 1つに
  const seen = new Set<string>();
  return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
}

export const katakanaRead: UnitSpec = {
  id: 'p5.ja.katakana-read',
  title: 'カタカナを よむ',
  stage: 'p5',
  subject: 'ja',
  domain: 'play',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'bus-yellow',
  prereq: ['p5.ja.kana-read-all'],
  objectives: [
    { id: 'pair', title: 'ひらがなと カタカナ' },
    { id: 'word', title: 'みぢかな ことばを よむ' },
    { id: 'similar', title: 'かたちの にた じ' },
  ],
  misconceptions: [
    { id: 'similar-shape', explain: 'かたちの にた じだね。てんや せんの むきを くらべよう。' },
    {
      id: 'dakuten',
      explain: '「てんてん」や「まる」の ちがいかな。いって みて、おとを たしかめよう。',
    },
    { id: 'other-char', explain: 'ちがう じだね。ひとつずつ よんで みよう。' },
  ],
  levels: [
    { label: 'ひらがなと カタカナ', chance: 1 / 6 },
    { label: 'みぢかな ことば', chance: 1 / 3 },
    { label: 'かたちの にた じ', chance: 1 / 3 },
  ],
  intro: [
    {
      text: 'ひらがなの「か」は、カタカナで「カ」。にて いるね。',
      figure: { kind: 'text', text: 'か → カ', size: 'xl' },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'view',
  basis: '教材会社の目安（教C1/C2。公的資料に記述なし）、curriculum-matrix 3.3・4.4',
  revised: '2026-10-24',
};
