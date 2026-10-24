/**
 * p5.ja.kana-read-all ひらがなを よむ（curriculum-matrix 3.3）: 清音46・濁音20・半濁音5（71字）と、2〜3文字の語。
 * 段階0: 清音（行ごとに 4択まで）。段階1: 濁音・半濁音（点・丸の ない字を 誤りに入れる）。段階2: 語を読んで えらぶ。
 * 別例: 字は「ことばの なかの 音」で聞く。語は「聞いた ことばの 字」を選ぶ。
 * 同一性キー: 字（＋ことばの中か）、語（＋聞いて選ぶか）。誤りの選択肢だけ違うものは同じ（1.4 知識）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { choiceItem, ill, listenItem, mix } from './lib';

const SEION =
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const DAKU = 'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ';

/** ことばの なかの 音（別例） */
const WORD: Record<string, string> = {
  あ: 'あめ',
  い: 'いぬ',
  う: 'うし',
  え: 'えき',
  お: 'おにぎり',
  か: 'かさ',
  き: 'きつね',
  く: 'くま',
  け: 'けむし',
  こ: 'こま',
  さ: 'さる',
  し: 'しか',
  す: 'すいか',
  せ: 'せみ',
  そ: 'そら',
  た: 'たこ',
  ち: 'ちず',
  つ: 'つき',
  て: 'てがみ',
  と: 'とり',
  な: 'なす',
  に: 'にじ',
  ぬ: 'ぬいぐるみ',
  ね: 'ねこ',
  の: 'のり',
  は: 'はな',
  ひ: 'ひよこ',
  ふ: 'ふね',
  へ: 'へび',
  ほ: 'ほし',
  ま: 'まど',
  み: 'みかん',
  む: 'むし',
  め: 'めがね',
  も: 'もも',
  や: 'やま',
  ゆ: 'ゆき',
  よ: 'よる',
  ら: 'らっぱ',
  り: 'りんご',
  る: 'るすばん',
  れ: 'れもん',
  ろ: 'ろうそく',
  わ: 'わに',
  を: 'ほんを よむ',
  ん: 'みかん',
  が: 'がっこう',
  ぎ: 'ぎゅうにゅう',
  ぐ: 'ぐんて',
  げ: 'げた',
  ご: 'ごりら',
  ざ: 'ざる',
  じ: 'じてんしゃ',
  ず: 'ずかん',
  ぜ: 'ぜんまい',
  ぞ: 'ぞう',
  だ: 'だんご',
  ぢ: 'はなぢ',
  づ: 'みかづき',
  で: 'でんしゃ',
  ど: 'どんぐり',
  ば: 'ばなな',
  び: 'びわ',
  ぶ: 'ぶどう',
  べ: 'べんとう',
  ぼ: 'ぼうし',
  ぱ: 'ぱん',
  ぴ: 'ぴあの',
  ぷ: 'ぷりん',
  ぺ: 'ぺんぎん',
  ぽ: 'ぽすと',
};
const CONTEXT = (c: string) =>
  c === 'を'
    ? '「ほんを よむ」の「を」'
    : c === 'ん'
      ? '「みかん」の さいごの「ん」'
      : c === 'ぢ'
        ? '「はなぢ」の「ぢ」'
        : c === 'づ'
          ? '「みかづき」の「づ」'
          : `「${WORD[c]}」の「${c}」`;

const SIMILAR = [
  'ねれわ',
  'さきち',
  'ぬめ',
  'るろ',
  'はほま',
  'いり',
  'こに',
  'うつ',
  'あおめ',
  'くへ',
  'たな',
  'しつ',
  'そん',
  'すむ',
  'けは',
];
const similar = (a: string, b: string) => SIMILAR.some((g) => g.includes(a) && g.includes(b));
const base = (c: string) => c.normalize('NFD')[0]!;
/** 同じ もとの字の 濁音・半濁音（「ぶ」→「ふ」「ぷ」） */
const family = (c: string) => [...(SEION + DAKU)].filter((x) => x !== c && base(x) === base(c));

function charItem(c: string, ctx: boolean): Item {
  const daku = DAKU.includes(c);
  const fam = daku ? family(c) : [];
  const pool = [...(daku ? DAKU : SEION)].filter(
    (x) => x !== c && !fam.includes(x) && !similar(base(x), base(c)),
  );
  const others = mix(`${c}:${ctx}`, pool).slice(0, 3 - fam.length);
  const id = `${ctx ? 'word' : 'char'}:${c}`;
  return listenItem({
    id,
    objective: daku ? 'dakuon' : 'seion',
    level: daku ? 1 : 0,
    alt: ctx,
    prompt: ctx ? 'ことばの なかの この おとの じは どれ？' : 'きこえた おとの じは どれ？',
    audio: { text: ctx ? CONTEXT(c) : c },
    hints: [
      'もういちど きいて、まねして いって みよう。',
      daku
        ? c.normalize('NFD').includes('゚')
          ? '「まる」が つく おとかな。'
          : '「てんてん」が つく おとかな。'
        : 'くちの かたちを まねして いって みよう。',
    ],
    explain: `${CONTEXT(c)}。この じだよ。`,
    identity: id,
    correct: { label: c },
    wrong: [
      ...fam.map((x) => ({
        label: x,
        misconception: base(x) === x ? 'dakuten-miss' : 'dakuten-swap',
      })),
      ...others.map((x) => ({ label: x, misconception: 'other-sound' })),
    ],
  });
}

/** よむ ことば（絵あり。2〜3文字） */
const WORDS: { illust: string; name: string; wrong: [string, string] }[] = [
  { illust: 'dog', name: 'いぬ', wrong: ['ぬい', 'いね'] },
  { illust: 'cat', name: 'ねこ', wrong: ['こね', 'ねて'] },
  { illust: 'bear', name: 'くま', wrong: ['まく', 'くも'] },
  { illust: 'monkey', name: 'さる', wrong: ['るさ', 'さろ'] },
  { illust: 'turtle', name: 'かめ', wrong: ['めか', 'かぬ'] },
  { illust: 'octopus', name: 'たこ', wrong: ['こた', 'なこ'] },
  { illust: 'eggplant', name: 'なす', wrong: ['すな', 'たす'] },
  { illust: 'umbrella', name: 'かさ', wrong: ['さか', 'かき'] },
  { illust: 'bird', name: 'とり', wrong: ['りと', 'とい'] },
  { illust: 'apple', name: 'りんご', wrong: ['りんこ', 'いんご'] },
  { illust: 'strawberry', name: 'いちご', wrong: ['いちこ', 'いさご'] },
  { illust: 'rabbit', name: 'うさぎ', wrong: ['うさき', 'うきさ'] },
  { illust: 'fox', name: 'きつね', wrong: ['きうね', 'きつわ'] },
  { illust: 'watermelon', name: 'すいか', wrong: ['すいが', 'いすか'] },
  { illust: 'egg', name: 'たまご', wrong: ['たまこ', 'なまご'] },
  { illust: 'banana', name: 'ばなな', wrong: ['はなな', 'ぱなな'] },
  { illust: 'elephant', name: 'ぞう', wrong: ['そう', 'ぞい'] },
  { illust: 'bread', name: 'ぱん', wrong: ['はん', 'ばん'] },
];

function wordItem(w: (typeof WORDS)[number]): Item {
  return choiceItem({
    id: `read:${w.name}`,
    objective: 'words',
    level: 2,
    prompt: 'この えの なまえは どれ？ よんで えらぼう。',
    figure: ill(w.illust),
    hints: ['ひとつずつ じを よんで みよう。', `はじめの じは「${[...w.name][0]}」だよ。`],
    explain: `「${w.name}」と よむよ。`,
    identity: `read:${w.name}`,
    correct: { label: w.name },
    wrong: w.wrong.map((x) => ({
      label: x,
      misconception:
        [...x].sort().join('') === [...w.name].sort().join('')
          ? 'order-swap'
          : base(x) === base(w.name) || x.length === w.name.length
            ? 'one-char'
            : 'one-char',
    })),
  });
}

function hearWordItem(w: (typeof WORDS)[number]): Item {
  return listenItem({
    id: `hear:${w.name}`,
    objective: 'words',
    level: 2,
    alt: true,
    prompt: 'きこえた ことばは どれ？ よんで えらぼう。',
    audio: { text: w.name },
    hints: ['もういちど きいて、ひとつずつ じを よもう。', 'じの じゅんばんも たしかめよう。'],
    explain: `「${w.name}」と かくよ。`,
    identity: `hear:${w.name}`,
    correct: { label: w.name },
    wrong: w.wrong.map((x) => ({
      label: x,
      misconception:
        [...x].sort().join('') === [...w.name].sort().join('') ? 'order-swap' : 'one-char',
    })),
  });
}

function build(): Item[] {
  const items: Item[] = [];
  [...SEION].forEach((c, i) => {
    items.push(charItem(c, false));
    if (i % 5 === 0) items.push(charItem(c, true));
  });
  [...DAKU].forEach((c, i) => {
    items.push(charItem(c, false));
    if (i % 4 === 0) items.push(charItem(c, true));
  });
  WORDS.forEach((w, i) => {
    items.push(wordItem(w));
    if (i % 4 === 0) items.push(hearWordItem(w));
  });
  return items;
}

export const kanaReadAll: UnitSpec = {
  id: 'p5.ja.kana-read-all',
  title: 'ひらがなを よむ',
  stage: 'p5',
  subject: 'ja',
  domain: 'play',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-hiragana',
  prereq: ['p4.ja.kana-read'],
  objectives: [
    { id: 'seion', title: 'せいおん（46じ）' },
    { id: 'dakuon', title: 'だくおん・はんだくおん（25じ）' },
    { id: 'words', title: '2〜3もじの ことばを よむ' },
  ],
  misconceptions: [
    {
      id: 'other-sound',
      explain: 'ちがう おとの じだったね。もういちど きいて、じの かたちを よく みよう。',
    },
    {
      id: 'dakuten-miss',
      explain: '「てんてん」や「まる」が ついて いる じかな。にごった おとを よく きこう。',
    },
    {
      id: 'dakuten-swap',
      explain: '「てんてん」と「まる」が いれかわったかな。「ぱ」は まる、「ば」は てんてん。',
    },
    {
      id: 'order-swap',
      explain: 'じの じゅんばんが いれかわって いるね。ひだりから じゅんに よもう。',
    },
    { id: 'one-char', explain: 'ひとつ ちがう じが あるね。ひとつずつ よんで くらべよう。' },
  ],
  levels: [
    { label: 'せいおん（46じ）', chance: 0.25 },
    { label: 'だくおん・はんだくおん', chance: 0.25 },
    { label: 'ことばを よむ', chance: 1 / 3 },
  ],
  intro: [
    {
      text: '「は」に てんてんを つけると「ば」。まるを つけると「ぱ」。',
      figure: { kind: 'text', text: 'は ば ぱ', size: 'xl' },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'view',
  basis: '研R10（5歳児クラス平均 65.9/71字）、幼稚園教育要領解説、curriculum-matrix 3.3',
  revised: '2026-10-24',
};
