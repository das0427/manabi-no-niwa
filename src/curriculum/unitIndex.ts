/**
 * 単元の索引（本体に同梱する軽い一覧。architecture.md 3章）。
 * 正本は各パックの UnitSpec。`npm run build:unit-index` で unit-index.json を作り直す
 * （古いままだと unitIndex.test.ts が失敗する）。
 */
import { createRng } from '../core/util/rng';
import type { PackContent, StageId, SubjectId, UnitMeta, UnitSpec } from './types';
import data from './unit-index.json';

export const UNIT_INDEX: readonly UnitMeta[] = data as UnitMeta[];

const BY_ID = new Map(UNIT_INDEX.map((u) => [u.id, u]));

export function unitMeta(id: string): UnitMeta | undefined {
  return BY_ID.get(id);
}

/** 子供画面に出す単元（planned は出さない） */
export function visibleUnits(
  filter: { subject?: SubjectId; stage?: StageId } = {},
  /** 保護者が開いた単元（hiddenByDefault の単元はこれに含まれるときだけ出す） */
  opened: readonly string[] = [],
): UnitMeta[] {
  return UNIT_INDEX.filter(
    (u) =>
      u.status !== 'planned' &&
      (!u.hiddenByDefault || opened.includes(u.id)) &&
      (filter.subject === undefined || u.subject === filter.subject) &&
      (filter.stage === undefined || u.stage === filter.stage),
  );
}

/** パックの単元定義から索引の行を作る（生成スクリプトとテストで使う） */
export function metaOf(packId: string, u: UnitSpec): UnitMeta {
  // 主なエンジン: 最初の問題のエンジン（生成器は seed 1・段階0 の1問目）。v1 のモードは 'legacy'
  const src = u.source;
  const firstItem =
    src.kind === 'items'
      ? src.items[0]
      : src.kind === 'generator'
        ? src.generate({ level: 0, rng: createRng(1), index: 0 })
        : undefined;
  return {
    ...(src.kind === 'legacy' ? { legacy: src.legacy } : {}),
    ...(u.hiddenByDefault ? { hiddenByDefault: true } : {}),
    id: u.id,
    pack: packId,
    title: u.title,
    stage: u.stage,
    subject: u.subject,
    domain: u.domain,
    icon: u.icon,
    prereq: u.prereq,
    priority: u.priority,
    status: u.status,
    engine: src.kind === 'legacy' ? 'legacy' : (firstItem?.engine ?? 'choice'),
  };
}

export function buildIndex(packs: PackContent[]): UnitMeta[] {
  return packs
    .flatMap((p) => p.units.map((u) => metaOf(p.packId, u)))
    .sort((a, b) => a.id.localeCompare(b.id));
}
