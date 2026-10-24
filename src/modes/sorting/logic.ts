/**
 * なかまわけ（M3）の盤面生成と判定（純粋関数）。仕様: docs/learning-design.md 3章。
 * 段階: N1 いろ2つ / N2 しゅるい2つ / N3 しゅるい3つ / N4 同じ4枚をしゅるい→いろの順に分け直す。
 * 素材は vocab.ts の属性（category / color）が付いた絵だけ。属性の無い絵は出さない。
 * 1盤面 = 1問。N4 は2つの分け方をまとめて1盤面とする。
 */
import {
  CATEGORY_LABEL,
  COLOR_LABEL,
  VOCAB,
  vocab,
  type Category,
  type MatColor,
  type VocabId,
} from '../../content/vocab';
import { createRng, hashSeed, type Rng } from '../../core/util/rng';

export type Criterion = 'color' | 'kind';
export type BoxValue = MatColor | Category;
export type SortPic = VocabId;

export interface Stage {
  criterion: Criterion;
  /** 箱の並び（左から）。値は criterion に対応する属性 */
  boxes: BoxValue[];
}

export interface Board {
  /** N1〜N3 は1つ、N4 は2つ（しゅるい → いろ） */
  stages: Stage[];
  /** 分ける絵。トレーに並ぶ順（乱数） */
  pics: SortPic[];
}

export const PICS_PER_BOX = 2;

/** 色の組は あか・きいろ と きいろ・みどり のみ（あか・みどりは出さない） */
export const COLOR_PAIRS: readonly (readonly [MatColor, MatColor])[] = [
  ['red', 'yellow'],
  ['yellow', 'green'],
];
const KINDS: readonly Category[] = ['animal', 'food', 'vehicle'];

const colorPool = new Map<MatColor, SortPic[]>();
const kindPool = new Map<Category, SortPic[]>();
for (const v of VOCAB) {
  const id = v.id as SortPic;
  const item = vocab(id);
  if (item.color) colorPool.set(item.color, [...(colorPool.get(item.color) ?? []), id]);
  if (item.category) kindPool.set(item.category, [...(kindPool.get(item.category) ?? []), id]);
}

export const isColor = (v: BoxValue): v is MatColor =>
  v === 'red' || v === 'yellow' || v === 'green';

/** 絵の、その基準での属性（無ければ undefined） */
export function attrOf(pic: SortPic, criterion: Criterion): BoxValue | undefined {
  const item = vocab(pic);
  return criterion === 'color' ? item.color : item.category;
}

export function labelOf(value: BoxValue): string {
  return isColor(value) ? COLOR_LABEL[value] : CATEGORY_LABEL[value];
}

/** 絵が入る箱（その基準での属性） */
export function correctBox(stage: Stage, pic: SortPic): BoxValue {
  const a = attrOf(pic, stage.criterion);
  if (!a || !stage.boxes.includes(a))
    throw new Error(`pic ${pic} has no box in ${stage.criterion}`);
  return a;
}

/** 箱の見出しに添える代表の絵（盤面の絵と重ならないものを選ぶ） */
const REP_POOL: Record<BoxValue, SortPic[]> = {
  red: ['apple', 'tomato', 'strawberry', 'car-red'],
  yellow: ['banana', 'lemon', 'chick', 'bus-yellow'],
  green: ['green-pepper', 'cucumber', 'frog', 'leaf'],
  animal: ['dog', 'cat', 'bear', 'rabbit'],
  food: ['bread', 'onigiri', 'peach', 'mikan'],
  vehicle: ['train', 'airplane', 'ship', 'bicycle'],
};
export function repOf(value: BoxValue, pics: readonly SortPic[]): SortPic {
  const pool = REP_POOL[value];
  return pool.find((p) => !pics.includes(p)) ?? pool[0]!;
}

export function boardKey(b: Board): string {
  const stages = b.stages.map((s) => `${s.criterion}:${[...s.boxes].sort().join('/')}`).join('>');
  return `${stages}|${[...b.pics].sort().join(',')}`;
}

export function boardLabel(b: Board): string {
  return `${b.stages.map((s) => s.boxes.map(labelOf).join('・')).join('→')}：${b.pics
    .map((p) => vocab(p).label)
    .join('・')}`;
}

function pickPics(pool: readonly SortPic[], rng: Rng): SortPic[] {
  return rng.sample(pool, PICS_PER_BOX);
}

function makeColorBoard(rng: Rng): Board {
  const pair = rng.pick(COLOR_PAIRS);
  const boxes = rng.shuffle(pair);
  const pics = boxes.flatMap((c) => pickPics(colorPool.get(c)!, rng));
  return { stages: [{ criterion: 'color', boxes }], pics: rng.shuffle(pics) };
}

function makeKindBoard(count: number, rng: Rng): Board {
  const boxes = rng.shuffle(rng.sample(KINDS, count));
  const pics = boxes.flatMap((k) => pickPics(kindPool.get(k)!, rng));
  return { stages: [{ criterion: 'kind', boxes }], pics: rng.shuffle(pics) };
}

/** N4: 種類2 × 色2 の各組み合わせに1枚ずつ（どちらの基準でも2枚ずつに分かれる） */
function makeSwitchBoard(rng: Rng): Board {
  for (let guard = 0; guard < 200; guard++) {
    const kinds = rng.sample(KINDS, 2);
    const colors = rng.pick(COLOR_PAIRS);
    const pics: SortPic[] = [];
    let ok = true;
    for (const k of kinds) {
      for (const c of colors) {
        const cell = (kindPool.get(k) ?? []).filter((p) => vocab(p).color === c);
        if (cell.length === 0) ok = false;
        else pics.push(rng.pick(cell));
      }
    }
    if (!ok) continue;
    return {
      stages: [
        { criterion: 'kind', boxes: rng.shuffle(kinds) },
        { criterion: 'color', boxes: rng.shuffle(colors) },
      ],
      pics: rng.shuffle(pics),
    };
  }
  throw new Error('no switch board');
}

/** 1回分の盤面。1回の中で同じ盤面（絵の集合と基準）は出さない */
export function generateRound(level: number, seed: number, size: number): Board[] {
  const rng = createRng(hashSeed('sorting', level, seed));
  const used = new Set<string>();
  const out: Board[] = [];
  let guard = 0;
  while (out.length < size && guard++ < 2000) {
    const b =
      level <= 0
        ? makeColorBoard(rng)
        : level === 1
          ? makeKindBoard(2, rng)
          : level === 2
            ? makeKindBoard(3, rng)
            : makeSwitchBoard(rng);
    const key = boardKey(b);
    if (used.has(key)) continue;
    used.add(key);
    out.push(b);
  }
  return out;
}

/** 音声の列: 「いろで わけよう。あか と きいろ」 */
export function stageVoice(stage: Stage, again: boolean): string[] {
  const head = stage.criterion === 'color' ? 'sort.by-color' : 'sort.by-kind';
  const seq: string[] = [again ? 'sort.then-color' : head];
  stage.boxes.forEach((v, i) => {
    if (i > 0) seq.push('sort.and');
    seq.push(`sort.val.${v}`);
  });
  return seq;
}

/** ヒント2の声: 「これは あか だね」 */
export const isVoice = (value: BoxValue): string => `sort.is.${value}`;
export const lookVoice = (c: Criterion): string =>
  c === 'color' ? 'sort.look-color' : 'sort.look-kind';

/** すべての音声キー用: 属性の値の一覧 */
export const ALL_VALUES: readonly BoxValue[] = [
  'red',
  'yellow',
  'green',
  'animal',
  'food',
  'vehicle',
];
