/**
 * 漢字パックの共通の部品（読みの誤答・選択肢・字の表の引き方）。
 */
import type { Rng } from '../../core/util/rng';
import { HOMOPHONE_G56 } from './data/homophone-g56';
import { SIMILAR_G56 } from './data/similar-g56';
import { ENTRIES_ALL, ENTRY_OF, type KanjiEntry, type Occurrence } from './table';

const parseMap = (text: string): ReadonlyMap<string, string[]> =>
  new Map(
    text
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [c, rest] = l.split(':') as [string, string];
        return [c, [...rest]] as const;
      }),
  );

/** 形の似た字 */
export const SIMILAR_OF = parseMap(SIMILAR_G56);
/** 同音の字 */
export const HOMOPHONE_OF = parseMap(HOMOPHONE_G56);

/** 字の読み（音・訓） */
export const readingsOf = (e: KanjiEntry): string[] => [...e.on, ...e.kun];

/** 選択肢に出す字の読み（音声用。ふりがなは出さない）。訓があれば訓、なければ音 */
export const firstReading = (e: KanjiEntry): string => e.kun[0] ?? e.on[0]!;

/** 字だけの選択肢の文: 山《!やま》（ふりがなを出さず、読み上げ用に読みを持つ） */
export const kanjiLabel = (ch: string): string => `${ch}《!${firstReading(ENTRY_OF.get(ch)!)}》`;

/** 学年までの字の表（maxGrade = 1 なら1年の字だけ） */
export const poolOf = (maxGrade: 4 | 5 | 6): KanjiEntry[] =>
  ENTRIES_ALL.filter((e) => e.grade <= maxGrade);

/** 正解を先頭に置かない並べ替え（choice エンジンは並べ替えないので、生成側で混ぜる） */
export const shuffled = <T>(rng: Rng, items: readonly T[]): T[] => rng.shuffle(items);

export type ReadMis = 'on-kun' | 'okurigana-edge' | 'similar-kanji' | 'other-reading';

export interface Wrong {
  value: string;
  misconception: ReadMis;
}

/**
 * 読みの誤答の候補を、誤概念ごとに作る（まぎらわしい順）。
 *   on-kun        … 同じ字の、ほかの読み（音と訓の取り違え）
 *   okurigana-edge … 送り仮名まで読みに入れた形（おおき・みる）
 *   similar-kanji … 形の似た字の読み
 *   other-reading … ほかの字の読み（上のどれも足りないときの穴うめ）
 * 正解や、この字の読みと同じものは入れない。
 */
export function readingWrongs(
  entry: KanjiEntry,
  occ: Occurrence,
  rng: Rng,
  pool: KanjiEntry[],
  count: number,
): Wrong[] {
  const own = new Set(readingsOf(entry));
  const seen = new Set<string>([occ.part]);
  const ok = (value: string, kind: ReadMis) =>
    !!value && !seen.has(value) && (kind === 'on-kun' || !own.has(value));

  // 誤概念ごとに候補を1つずつ作る
  const families: Wrong[] = [];
  // 1) 音と訓の取り違え: 反対の種類を先に、なければ同じ種類
  const others = readingsOf(entry).filter((r) => r !== occ.part);
  const opposite = others.filter((r) => (occ.kind === 'on' ? entry.kun : entry.on).includes(r));
  const same = others.filter((r) => !opposite.includes(r));
  const onKun = [...rng.shuffle(opposite), ...rng.shuffle(same)];
  if (onKun[0]) families.push({ value: onKun[0], misconception: 'on-kun' });
  // 2) 送り仮名の境目
  if (occ.okuri) {
    const v = occ.part + occ.okuri[0]!;
    if (ok(v, 'okurigana-edge')) families.push({ value: v, misconception: 'okurigana-edge' });
  }
  // 3) 形の似た字の読み
  const sims = (SIMILAR_OF.get(entry.ch) ?? [])
    .map((c) => pool.find((p) => p.ch === c))
    .filter((p): p is KanjiEntry => p !== undefined);
  for (const s of rng.shuffle(sims)) {
    const kindList = occ.kind === 'on' ? s.on : s.kun;
    const pick = rng.pick(kindList.length > 0 ? kindList : readingsOf(s));
    if (ok(pick, 'similar-kanji')) {
      families.push({ value: pick, misconception: 'similar-kanji' });
      break;
    }
  }

  // 誤概念の種類を混ぜて、必要な数だけ使う
  const out: Wrong[] = [];
  for (const w of rng.shuffle(families)) {
    if (out.length >= count) break;
    if (ok(w.value, w.misconception)) {
      seen.add(w.value);
      out.push(w);
    }
  }
  // 足りないときは、ほかの字の読み。それでも足りなければ同じ字のほかの読みを足す
  for (let t = 0; out.length < count && t < 60; t++) {
    const e = rng.pick(pool);
    if (e.ch === entry.ch) continue;
    const rs = readingsOf(e);
    if (rs.length === 0) continue;
    const v = rng.pick(rs);
    if (ok(v, 'other-reading')) {
      seen.add(v);
      out.push({ value: v, misconception: 'other-reading' });
    }
  }
  for (const r of onKun) {
    if (out.length >= count) break;
    if (ok(r, 'on-kun')) {
      seen.add(r);
      out.push({ value: r, misconception: 'on-kun' });
    }
  }
  return out;
}

/** 選択肢（正解1つ＋誤答）を混ぜて返す */
export function readingOptions(
  rng: Rng,
  correct: string,
  wrongs: Wrong[],
): { label: string; correct?: true; misconception?: string }[] {
  return rng.shuffle([
    { label: correct, correct: true as const },
    ...wrongs.map((w) => ({ label: w.value, misconception: w.misconception })),
  ]);
}
