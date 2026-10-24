/**
 * 作品の縮小表示（がんばりノート・保護者画面の作品一覧）。
 * 各モードが自分の作品の描き方を登録する（なぞり・みち）。未登録なら絵だけ。
 */
import type { ReactElement } from 'react';
import type { WorkKind, WorkRecord } from '../core/types';
import { Illust } from '../illust/Illust';

type Renderer = (data: unknown) => ReactElement;
const renderers: Partial<Record<WorkKind, Renderer>> = {};

export function registerWorkRenderer(kind: WorkKind, r: Renderer): void {
  renderers[kind] = r;
}

export function WorkThumb({ work }: { work: WorkRecord }) {
  const r = renderers[work.kind];
  if (r) return r(work.data);
  return (
    <Illust
      id={work.kind === 'trace' ? 'mode-trace' : 'mode-road'}
      style={{ width: '100%', height: '100%' }}
      label={work.title}
    />
  );
}
