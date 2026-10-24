/**
 * p4.ja.kana-read もじよみ（curriculum-matrix 3.2・4.1）: ひらがな（清音46字）を見て、音と結ぶ。
 * 段階0: あ〜と の20字・2択（v1 の H1）。段階1: 20字・3択、ことばの中の音（別例）。
 * 段階2: な〜ん の26字・2択。段階3: 26字・3択、ことばの中の音（別例）。開始の段階は保護者が選べる。
 * 似た形の字（ね・れ・わ など）は同じ問題に出さない。
 * 同一性キー: 字（＋ことばの中か）。誤りの字だけ違うものは同じ（1.4 知識）。
 * v1 の ひらがな（kana）スキルから分けた単元なので、進度は新しく始める（統括の判断6）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { listenItem, mix } from './lib';

const ROWS: { obj: string; chars: string }[] = [
  { obj: 'a-ka', chars: 'あいうえおかきくけこ' },
  { obj: 'sa-ta', chars: 'さしすせそたちつてと' },
  { obj: 'na-ha', chars: 'なにぬねのはひふへほ' },
  { obj: 'ma-ya', chars: 'まみむめもやゆよ' },
  { obj: 'ra-wa', chars: 'らりるれろわをん' },
];
const FIRST20 = 'あいうえおかきくけこさしすせそたちつてと';
const ALL = ROWS.map((r) => r.chars).join('');

/** ことばの中の音（別例）。「ねこの ね」 */
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
};
/** 「を」「ん」は ことばの はじめに来ないので、言い方を変える */
const CONTEXT = (c: string) =>
  c === 'を'
    ? '「ほんを よむ」の「を」'
    : c === 'ん'
      ? '「みかん」の さいごの「ん」'
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
  // 形は ちがうが 音が おなじ（「を」は「お」と おなじ おと）。音から 字を 選ぶ 問題で 正解が 2つに なる
  'をお',
];
const similar = (a: string, b: string) => SIMILAR.some((g) => g.includes(a) && g.includes(b));

function item(c: string, level: number, n: number, ctx: boolean): Item {
  const pool = level <= 1 ? FIRST20 : ALL;
  const wrong = mix(
    `${c}:${level}`,
    [...pool].filter((x) => x !== c && !similar(x, c)),
  ).slice(0, n);
  const id = `${ctx ? 'word' : 'char'}:${c}`;
  return listenItem({
    id: `${id}:${level}`,
    objective: ROWS.find((r) => r.chars.includes(c))!.obj,
    level,
    alt: ctx,
    prompt: ctx ? 'ことばの なかの この おとの じは どれ？' : 'きこえた おとの じは どれ？',
    audio: { text: ctx ? CONTEXT(c) : c },
    // 2段めに 答えの字を 含む ことば（「あめ」など）を 書かない（字を見比べるだけで 答えが わかる）
    hints: [
      'もういちど きいて、まねして いって みよう。',
      ctx && (c === 'を' || c === 'ん')
        ? 'ことばの さいごの ほうを よく きこう。'
        : 'じを ひとつずつ ゆびで さして、こえに だして よんで みよう。',
    ],
    explain: ctx
      ? `${CONTEXT(c)}。この じだよ。`
      : `「${c}」は この じ。「${WORD[c]}」の「${c}」だね。`,
    identity: id,
    correct: { label: c },
    wrong: wrong.map((x) => ({ label: x, misconception: 'other-sound' })),
  });
}

function build(): Item[] {
  const items: Item[] = [];
  for (const c of FIRST20) items.push(item(c, 0, 1, false), item(c, 1, 2, true));
  for (const c of ALL)
    if (!FIRST20.includes(c)) items.push(item(c, 2, 1, false), item(c, 3, 2, true));
  return items;
}

export const kanaRead: UnitSpec = {
  id: 'p4.ja.kana-read',
  title: 'もじよみ',
  stage: 'p4',
  subject: 'ja',
  domain: 'play',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'trace-letters',
  prereq: ['p4.ja.first-sound'],
  objectives: ROWS.map((r) => ({ id: r.obj, title: `${[...r.chars][0]}〜${[...r.chars].at(-1)}` })),
  misconceptions: [
    {
      id: 'other-sound',
      explain: 'ちがう おとの じだったね。もういちど きいて、じの かたちを よく みよう。',
    },
    {
      id: 'similar-shape',
      explain: 'かたちが にている じだね。まがりかたや はねかたを くらべて みよう。',
    },
  ],
  levels: [
    { label: 'あ〜と（20じ）2たく', chance: 0.5 },
    { label: 'あ〜と 3たく・ことばの なか', chance: 1 / 3 },
    { label: 'な〜ん（26じ）2たく', chance: 0.5 },
    { label: 'な〜ん 3たく・ことばの なか', chance: 1 / 3 },
  ],
  intro: [
    {
      text: 'この じは「あ」。「あめ」の「あ」だよ。',
      figure: { kind: 'text', text: 'あ', size: 'xl' },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'view',
  basis: '研R10、curriculum-matrix 3.2・4.1（H1・H2。20字 → 46字）',
  revised: '2026-10-24',
};
