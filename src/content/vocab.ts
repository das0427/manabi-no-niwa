/**
 * モード横断の語彙。同じ絵は全モードで同じ名前・同じ属性で使う（DESINGN.md 6章の一貫性）。
 *
 * 分類に使う属性（category / color）は、4歳児が迷わず一つに決まるものだけを付ける。
 * 曖昧なもの（さかな・たまご・たこ・すいか など）は、その属性を付けない＝なかまわけに出ない。
 */

export type Category = 'animal' | 'food' | 'vehicle';
export type MatColor = 'red' | 'yellow' | 'green';
export type Counter = 'ko' | 'hiki';

export interface VocabItem {
  /** イラストID（src/illust/registry.ts のキー）。音声キーは `item.<id>` */
  id: string;
  /** 表示と読み上げの名前 */
  label: string;
  /** なかまわけ（しゅるい）で使ってよい場合のみ */
  category?: Category;
  /** なかまわけ（いろ）で使ってよい場合のみ */
  color?: MatColor;
  /** 数の問題で使う数え方 */
  counter: Counter;
  /** 絵のグループ（担当の分担と、記憶課題での「別の種類」の判定に使う） */
  group: 'food' | 'animal' | 'vehicle' | 'thing' | 'nature';
}

export const VOCAB = [
  // たべもの（正面）
  { id: 'apple', label: 'りんご', category: 'food', color: 'red', counter: 'ko', group: 'food' },
  {
    id: 'banana',
    label: 'バナナ',
    category: 'food',
    color: 'yellow',
    counter: 'ko',
    group: 'food',
  },
  { id: 'mikan', label: 'みかん', category: 'food', counter: 'ko', group: 'food' },
  {
    id: 'strawberry',
    label: 'いちご',
    category: 'food',
    color: 'red',
    counter: 'ko',
    group: 'food',
  },
  { id: 'carrot', label: 'にんじん', category: 'food', counter: 'ko', group: 'food' },
  { id: 'tomato', label: 'トマト', category: 'food', color: 'red', counter: 'ko', group: 'food' },
  { id: 'bread', label: 'パン', category: 'food', counter: 'ko', group: 'food' },
  { id: 'egg', label: 'たまご', counter: 'ko', group: 'food' },
  { id: 'onigiri', label: 'おにぎり', category: 'food', counter: 'ko', group: 'food' },
  { id: 'watermelon', label: 'すいか', category: 'food', counter: 'ko', group: 'food' },
  { id: 'peach', label: 'もも', category: 'food', counter: 'ko', group: 'food' },
  { id: 'eggplant', label: 'なす', category: 'food', counter: 'ko', group: 'food' },
  { id: 'lemon', label: 'レモン', category: 'food', color: 'yellow', counter: 'ko', group: 'food' },
  {
    id: 'green-pepper',
    label: 'ピーマン',
    category: 'food',
    color: 'green',
    counter: 'ko',
    group: 'food',
  },
  {
    id: 'cucumber',
    label: 'きゅうり',
    category: 'food',
    color: 'green',
    counter: 'ko',
    group: 'food',
  },
  // どうぶつ（3/4 の横向き）
  { id: 'dog', label: 'いぬ', category: 'animal', counter: 'hiki', group: 'animal' },
  { id: 'cat', label: 'ねこ', category: 'animal', counter: 'hiki', group: 'animal' },
  { id: 'rabbit', label: 'うさぎ', category: 'animal', counter: 'hiki', group: 'animal' },
  { id: 'elephant', label: 'ぞう', category: 'animal', counter: 'hiki', group: 'animal' },
  { id: 'bear', label: 'くま', category: 'animal', counter: 'hiki', group: 'animal' },
  { id: 'monkey', label: 'さる', category: 'animal', counter: 'hiki', group: 'animal' },
  { id: 'cow', label: 'うし', category: 'animal', counter: 'hiki', group: 'animal' },
  { id: 'turtle', label: 'かめ', category: 'animal', counter: 'hiki', group: 'animal' },
  { id: 'bird', label: 'とり', category: 'animal', counter: 'hiki', group: 'animal' },
  { id: 'fox', label: 'きつね', category: 'animal', counter: 'hiki', group: 'animal' },
  {
    id: 'chick',
    label: 'ひよこ',
    category: 'animal',
    color: 'yellow',
    counter: 'hiki',
    group: 'animal',
  },
  {
    id: 'frog',
    label: 'かえる',
    category: 'animal',
    color: 'green',
    counter: 'hiki',
    group: 'animal',
  },
  { id: 'ant', label: 'あり', counter: 'hiki', group: 'animal' },
  { id: 'octopus', label: 'たこ', counter: 'hiki', group: 'animal' },
  // のりもの（真横）
  {
    id: 'car-red',
    label: 'くるま',
    category: 'vehicle',
    color: 'red',
    counter: 'ko',
    group: 'vehicle',
  },
  {
    id: 'bus-yellow',
    label: 'バス',
    category: 'vehicle',
    color: 'yellow',
    counter: 'ko',
    group: 'vehicle',
  },
  { id: 'train', label: 'でんしゃ', category: 'vehicle', counter: 'ko', group: 'vehicle' },
  { id: 'airplane', label: 'ひこうき', category: 'vehicle', counter: 'ko', group: 'vehicle' },
  { id: 'ship', label: 'ふね', category: 'vehicle', counter: 'ko', group: 'vehicle' },
  { id: 'bicycle', label: 'じてんしゃ', category: 'vehicle', counter: 'ko', group: 'vehicle' },
  // もの・しぜん
  { id: 'pencil', label: 'えんぴつ', counter: 'ko', group: 'thing' },
  { id: 'scissors', label: 'はさみ', counter: 'ko', group: 'thing' },
  { id: 'umbrella', label: 'かさ', counter: 'ko', group: 'thing' },
  { id: 'ball', label: 'ボール', counter: 'ko', group: 'thing' },
  { id: 'leaf', label: 'はっぱ', color: 'green', counter: 'ko', group: 'nature' },
  { id: 'flower', label: 'おはな', counter: 'ko', group: 'nature' },
  { id: 'tree', label: 'き', counter: 'ko', group: 'nature' },
  { id: 'rock', label: 'いわ', counter: 'ko', group: 'nature' },
] as const satisfies readonly VocabItem[];

export type VocabId = (typeof VOCAB)[number]['id'];

const byId = new Map<string, VocabItem>(VOCAB.map((v) => [v.id, v]));

export function vocab(id: VocabId): VocabItem {
  const v = byId.get(id);
  if (!v) throw new Error(`unknown vocab ${id}`);
  return v;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  animal: 'どうぶつ',
  food: 'たべもの',
  vehicle: 'のりもの',
};

export const COLOR_LABEL: Record<MatColor, string> = {
  red: 'あか',
  yellow: 'きいろ',
  green: 'みどり',
};
