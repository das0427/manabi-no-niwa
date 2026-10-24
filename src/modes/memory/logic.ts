/**
 * おぼえてさがす の問題生成と判定（純粋関数）。仕様: docs/learning-design.md 5章。
 * 段階: B1 1枚→2択 / B2 1枚→3択 / B3 2枚→4枚から2枚 / B4 場所（3か所）/ B5 2枚の順番 / B6 3枚の順番。
 * 誤りの選択肢は、全段階で答えと別のグループ（たべもの・どうぶつ・のりもの・もの）から選ぶ。
 */
import { VOCAB, vocab, type VocabId } from '../../content/vocab';
import { balancedPositions, createRng, hashSeed, placeAt } from '../../core/util/rng';

export type MemItem = Exclude<VocabId, 'rock' | 'tree'>;
export type MemGroup = 'food' | 'animal' | 'vehicle' | 'thing';
export const GROUPS: readonly MemGroup[] = ['food', 'animal', 'vehicle', 'thing'];

export const POOL: readonly MemItem[] = VOCAB.map((v) => v.id).filter(
  (id): id is MemItem => id !== 'rock' && id !== 'tree',
);

/** 子供に言うグループ（しぜん＝「もの」にまとめる） */
export function groupOf(id: MemItem): MemGroup {
  const g = vocab(id).group;
  return g === 'nature' ? 'thing' : g;
}

export type MemKind = 'pick' | 'place' | 'order';

export interface MemQuestion {
  kind: MemKind;
  /** 覚える画面に出す絵（order は出る順） */
  shown: MemItem[];
  /** pick: 正解の絵（1〜2枚）/ place: 絵 / order: 正しい順 */
  answer: MemItem[];
  /** pick: 選択肢 / order: 候補（並べ替えた絵）/ place: なし */
  choices: MemItem[];
  /** place のみ: 絵があった場所（0〜2） */
  pos?: number;
}

export const PLACE_COUNT = 3;
export const CHOICE_COUNTS = [2, 3, 4] as const;

export function kindOf(level: number): MemKind {
  return level <= 2 ? 'pick' : level === 3 ? 'place' : 'order';
}

export function orderLength(level: number): number {
  return level === 4 ? 2 : 3;
}

export function generateRound(level: number, seed: number, size: number): MemQuestion[] {
  const rng = createRng(hashSeed('memory', level, seed));
  const used = new Set<MemItem>();
  const fresh = (pred: (i: MemItem) => boolean = () => true): MemItem => {
    const c = POOL.filter((i) => !used.has(i) && pred(i));
    const it = rng.pick(c);
    used.add(it);
    return it;
  };
  const out: MemQuestion[] = [];

  if (level <= 2) {
    const n = CHOICE_COUNTS[level]!;
    const positions = balancedPositions(size, n, rng);
    for (let k = 0; k < size; k++) {
      const pos = positions[k] ?? 0;
      if (level < 2) {
        const a = fresh();
        const g = groupOf(a);
        const others = rng.sample(
          POOL.filter((i) => groupOf(i) !== g),
          n - 1,
        );
        out.push({ kind: 'pick', shown: [a], answer: [a], choices: placeAt(a, others, pos, rng) });
      } else {
        const [ga, gb] = rng.sample(GROUPS, 2) as [MemGroup, MemGroup];
        const a = fresh((i) => groupOf(i) === ga);
        const b = fresh((i) => groupOf(i) === gb);
        const others = rng.sample(
          POOL.filter((i) => groupOf(i) !== ga && groupOf(i) !== gb),
          2,
        );
        out.push({
          kind: 'pick',
          shown: rng.shuffle([a, b]),
          answer: [a, b],
          choices: placeAt(a, [b, ...others], pos, rng),
        });
      }
    }
    return out;
  }

  if (level === 3) {
    const positions = balancedPositions(size, PLACE_COUNT, rng);
    for (let k = 0; k < size; k++) {
      const a = fresh();
      out.push({ kind: 'place', shown: [a], answer: [a], choices: [], pos: positions[k] ?? 0 });
    }
    return out;
  }

  const len = orderLength(level);
  for (let k = 0; k < size; k++) {
    const seq: MemItem[] = [];
    for (let j = 0; j < len; j++) seq.push(fresh());
    let tray = rng.shuffle(seq);
    for (let t = 0; t < 20 && tray.every((x, i) => x === seq[i]); t++) tray = rng.shuffle(seq);
    out.push({ kind: 'order', shown: seq, answer: seq, choices: tray });
  }
  return out;
}

/** pick: 押した絵が正解の絵か */
export function isAnswerPick(q: MemQuestion, item: MemItem): boolean {
  return q.answer.includes(item);
}

/** order: 次に置くべき絵 */
export function nextInOrder(q: MemQuestion, placedCount: number): MemItem | undefined {
  return q.answer[placedCount];
}

export function isFinishedPick(q: MemQuestion, picked: readonly MemItem[]): boolean {
  return q.answer.every((a) => picked.includes(a));
}

/** 保護者画面に出す問題の内容 */
export function itemKey(q: MemQuestion): string {
  const names = q.answer.map((i) => vocab(i).label);
  if (q.kind === 'order') return names.join('→');
  if (q.kind === 'place') return `${names[0]}（${['ひだり', 'まんなか', 'みぎ'][q.pos ?? 0]}）`;
  return names.join('+');
}
