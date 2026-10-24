/**
 * 漢字の読みの単元（g3.ja.kanji-read-g3・g4.ja.kanji-read-g4）で共通の誤概念と段階。
 * 文の漢字は3年までの配当字で書き、必ず《よみ》を付ける。
 */
import type { LevelDef, Misconception } from '../../curriculum/types';

export const READ_MISCONCEPTIONS: Misconception[] = [
  {
    id: 'on-kun',
    explain:
      '同《おな》じ字《じ》でも、ことばによって読《よ》み方《かた》がかわるよ。ほかのことばで使《つか》う読《よ》みをえらんだのかな。ことば全《ぜん》体《たい》を声《こえ》に出《だ》して読《よ》んでみよう。',
  },
  {
    id: 'okurigana-edge',
    explain:
      '送《おく》りがなまで読《よ》みに入《い》れたのかな。字《じ》の読《よ》みは、送《おく》りがなの前《まえ》までだよ。かなで書《か》いてあるところは、そのまま読《よ》むんだね。',
  },
  {
    id: 'similar-kanji',
    explain:
      '形《かたち》がにているほかの字《じ》とまちがえたのかな。太《ふと》い字《じ》の形《かたち》を、よく見《み》くらべてみよう。',
  },
  {
    id: 'other-reading',
    explain:
      'ほかの字《じ》の読《よ》みをえらんだのかな。太《ふと》い字《じ》をもう一《いち》度《ど》よく見《み》て、まわりのことばもヒントにしよう。',
  },
];

/** 段階（形式の割合は各単元のファイル）。chance は選択肢の数の逆数（rules.ts promoteNeedFor） */
export const READ_LEVELS_G3: LevelDef[] = [
  { label: 'ことばの中で読む', chance: 1 / 4 },
  { label: '文の中で読む', chance: 1 / 4 },
  { label: '同じ字の音と訓（読み分け）', chance: 1 / 4 },
];

export const READ_LEVELS_G4: LevelDef[] = [
  { label: 'ことばの中で読む', chance: 1 / 4 },
  { label: '文の中で読む', chance: 1 / 4 },
  { label: '都道府県名と読み分け', chance: 1 / 4 },
];
