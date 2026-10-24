/**
 * はんこの素材（ビルド時に生成した stamps.json。scripts/build-stamps.ts）。
 */
import data from './stamps.json';

export interface StampDef {
  id: string;
  version: number;
  category: string;
  label: string;
  /** width/height=100 付きの SVG */
  svg: string;
}

export interface StampCategoryDef {
  id: string;
  label: string;
  /** タブの絵（はんこの ID） */
  icon: string;
}

export const STAMPS: readonly StampDef[] = data.stamps;
export const STAMP_CATEGORIES: readonly StampCategoryDef[] = data.categories;

const byId = new Map(STAMPS.map((s) => [s.id, s]));
export function getStamp(id: string): StampDef | undefined {
  return byId.get(id);
}
/** 作品の素材キー "<id>@<version>" */
export const assetKey = (s: Pick<StampDef, 'id' | 'version'>): string => `${s.id}@${s.version}`;

/** SVG を img の src にする */
export function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
