/**
 * なぞり・みち の作品（works ストア。1.0 から続く）を おえかきの作品一覧に見るだけで出す（X-SV-05）。
 */
import type { WorkRecord } from '../core/types';

const isDraft = (w: WorkRecord): boolean =>
  typeof w.data === 'object' && w.data !== null && (w.data as { draft?: unknown }).draft === true;

/** 一覧に出すもの（作りかけの下書きは出さない）。新しい順 */
export function viewableWorks(works: readonly WorkRecord[]): WorkRecord[] {
  return works
    .filter((w) => (w.kind === 'trace' || w.kind === 'road') && !isDraft(w))
    .sort((a, b) => b.createdAt - a.createdAt);
}
