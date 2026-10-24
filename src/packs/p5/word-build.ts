/**
 * p5.ja.word-build ことばづくり（curriculum-matrix 3.3・4.1）: 2文字 → 3文字 → 4文字・濁音入り。
 * 字の タイルを ならべて 絵の なまえを つくる（build）。v1 の H4・H5 を5歳へ移した単元なので、進度は新しく始める（判断6）。
 * 別例: 絵の ない ことば（書いてある ことばを 見て つくる）。
 * 同一性キー: 語。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { BuildItem } from '../../engines/build/build';
import { ill, mix } from './lib';

const PIC: [string, string][] = [
  ['いぬ', 'dog'],
  ['ねこ', 'cat'],
  ['くま', 'bear'],
  ['さる', 'monkey'],
  ['かめ', 'turtle'],
  ['たこ', 'octopus'],
  ['もも', 'peach'],
  ['なす', 'eggplant'],
  ['かさ', 'umbrella'],
  ['とり', 'bird'],
  ['うし', 'cow'],
  ['あり', 'ant'],
  ['ふね', 'ship'],
  ['はな', 'flower'],
  ['いし', 'rock'],
  ['ぞう', 'elephant'],
  ['ぱん', 'bread'],
  ['くつ', 'p23-shoe'],
  ['はこ', 'p5-box'],
  ['つき', 'p5-moon'],
  ['りんご', 'apple'],
  ['いちご', 'strawberry'],
  ['うさぎ', 'rabbit'],
  ['きつね', 'fox'],
  ['みかん', 'mikan'],
  ['すいか', 'watermelon'],
  ['ひよこ', 'chick'],
  ['たまご', 'egg'],
  ['はさみ', 'scissors'],
  ['かえる', 'frog'],
  ['くるま', 'car-red'],
  ['ばなな', 'banana'],
  ['まくら', 'p23-pillow'],
  ['ぼうし', 'p23-hat'],
  ['えほん', 'p5-book'],
  ['とけい', 'p5-clock'],
  ['にんじん', 'carrot'],
  ['おにぎり', 'onigiri'],
  ['えんぴつ', 'pencil'],
  ['ひこうき', 'airplane'],
  ['はぶらし', 'p23-toothbrush'],
  ['おひさま', 'p5-sun'],
];
const TEXT_ONLY = [
  'あめ',
  'そら',
  'ゆき',
  'やま',
  'うみ',
  'みみ',
  'めがね',
  'さかな',
  'たいこ',
  'こども',
  'からす',
  'どんぐり',
  'ひまわり',
  'ともだち',
  'ぶらんこ',
  'しんぶん',
  'かみなり',
  'くつした',
];

const SIMILAR: Record<string, string> = {
  ね: 'れ',
  れ: 'ね',
  さ: 'き',
  き: 'さ',
  ぬ: 'め',
  め: 'ぬ',
  る: 'ろ',
  ろ: 'る',
  は: 'ほ',
  ほ: 'は',
  い: 'り',
  り: 'い',
  こ: 'に',
  に: 'こ',
  う: 'つ',
  つ: 'う',
  あ: 'お',
  お: 'あ',
  く: 'へ',
  ま: 'も',
  も: 'ま',
  し: 'つ',
  す: 'む',
  た: 'な',
  な: 'た',
  ち: 'さ',
  か: 'が',
  み: 'よ',
  ん: 'そ',
  と: 'こ',
  け: 'は',
  ひ: 'し',
  ら: 'ち',
  や: 'か',
  ゆ: 'ぬ',
  そ: 'ん',
  え: 'ん',
  ふ: 'ぶ',
};
const plain = (c: string) => c.normalize('NFD')[0]!;
const FILL =
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわ';

function buildItem(word: string, illust: string | null): BuildItem {
  const cs = [...word];
  const obj = cs.length === 2 ? 'two' : cs.length === 3 ? 'three' : 'four';
  // まちがいやすい タイル: 濁音・半濁音は 点のない字、それ以外は 形の似た字
  const di = cs.findIndex((c) => plain(c) !== c);
  const si = di >= 0 ? di : cs.findIndex((c) => SIMILAR[c] && !cs.includes(SIMILAR[c]!));
  const trap = si >= 0 ? (di >= 0 ? plain(cs[si]!) : SIMILAR[cs[si]!]!) : null;
  const wrongValue = trap !== null ? cs.map((c, i) => (i === si ? trap : c)).join('') : null;
  const extra = mix(
    `fill:${word}`,
    [...FILL].filter((c) => !cs.includes(c) && c !== trap),
  )[0]!;
  const tiles = mix(`tiles:${word}`, [...cs, ...(trap ? [trap] : []), extra]);
  return {
    engine: 'build',
    id: `word:${word}`,
    objective: obj,
    level: cs.length === 2 ? 0 : cs.length === 3 ? 1 : 2,
    alt: illust === null,
    prompt: illust
      ? 'この えの なまえを、じを ならべて つくろう。'
      : `「${word}」と おなじに、じを ならべて つくろう。`,
    ...(illust ? { figure: ill(illust) } : {}),
    tiles,
    answer: { kind: 'text', values: [word] },
    ...(wrongValue
      ? {
          wrongAnswers: [
            { value: wrongValue, misconception: di >= 0 ? 'dakuten' : 'similar-shape' },
          ],
        }
      : {}),
    hints: [
      illust
        ? 'なまえを ゆっくり いって、はじめの おとを さがそう。'
        : 'ひだりの じから じゅんに さがそう。',
      `はじめの じは「${cs[0]}」。${di >= 0 ? '「てんてん」や「まる」も よく みよう。' : ''}`,
    ],
    explain: `${cs.join('・')} で「${word}」。`,
    identity: `word:${word}`,
  };
}

function build(): Item[] {
  return [...PIC.map(([w, il]) => buildItem(w, il)), ...TEXT_ONLY.map((w) => buildItem(w, null))];
}

export const wordBuild: UnitSpec = {
  id: 'p5.ja.word-build',
  title: 'ことばづくり',
  stage: 'p5',
  subject: 'ja',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-hiragana',
  prereq: ['p5.ja.kana-read-all'],
  objectives: [
    { id: 'two', title: '2もじの ことば' },
    { id: 'three', title: '3もじの ことば' },
    { id: 'four', title: '4もじの ことば（てんてん いり）' },
  ],
  misconceptions: [
    {
      id: 'dakuten',
      explain: '「てんてん」や「まる」の ある じかな。いって みて、にごる おとか たしかめよう。',
    },
    { id: 'similar-shape', explain: 'かたちの にた じだね。まがりかたや ながさを よく みよう。' },
    { id: 'order', explain: 'じの じゅんばんが ちがうかな。ゆっくり いいながら ならべよう。' },
  ],
  levels: [
    { label: '2もじ（H4）', chance: 1 / 6 },
    { label: '3もじ（H5）', chance: 1 / 24 },
    { label: '4もじ・てんてん いり', chance: 0.01 },
  ],
  intro: [{ text: '「い」「ぬ」と ならべると「いぬ」。', figure: ill('dog') }],
  source: { kind: 'items', items: build() },
  review: 'view',
  basis: '教材会社の目安（教C1）、curriculum-matrix 3.3・4.1（H4・H5 を5歳へ）',
  revised: '2026-10-24',
};
