/**
 * 区分の既定パック（初回準備の2段目で取得するパック。docs/expansion/architecture.md 6.3、R#20）。
 * 正本は単元の索引（unit-index.json）: その区分の段階（stage）の単元を持つパックを既定パックとする
 * （例 g3 → g3-math, g3-ja, kanji-g34, sci-g34, soc-g34, en-g34, prog-g16）。
 * 幼児（toddler/p4/p5）の教材はコアに同梱なので、既定パックは無い（空）。
 */
import { isPreschool, type AudienceId } from '../audience/audience';
import { profileAudience } from '../core/types';
import type { UnitMeta } from './types';
import { UNIT_INDEX } from './unitIndex';

/** 区分の既定パック（packId の名前順）。予定（planned）だけの単元のパックは含めない */
export function defaultPackIds(
  audience: AudienceId,
  index: readonly UnitMeta[] = UNIT_INDEX,
): string[] {
  if (isPreschool(audience)) return [];
  const ids = new Set<string>();
  for (const u of index) {
    if (u.stage === audience && u.status !== 'planned') ids.add(u.pack);
  }
  return [...ids].sort();
}

/**
 * 起動画面で準備するパック: 登録しているすべてのプロフィールの区分の既定パックを合わせたもの。
 * 起動画面ではまだ誰が遊ぶか決まっていない（2人以上のときは「はじめる」のあとに選ぶ）ため、全員分をそろえる。
 */
export function setupPackIds(
  profiles: readonly { audience?: AudienceId }[],
  index: readonly UnitMeta[] = UNIT_INDEX,
): string[] {
  const ids = new Set<string>();
  for (const p of profiles) {
    for (const id of defaultPackIds(profileAudience(p), index)) ids.add(id);
  }
  return [...ids].sort();
}
