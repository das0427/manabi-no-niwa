/**
 * 作品の縮小表示（がんばりノート・保護者画面の作品一覧）。
 * 作品の種類ごとに、各モードが用意した縮小表示を使う。
 */
import type { WorkRecord } from '../core/types';
import { Illust } from '../illust/Illust';
import { RoadThumb } from './road/thumb';
import { TraceThumb } from './trace/thumb';

export function WorkThumb({ work }: { work: WorkRecord }) {
  if (work.kind === 'road') return <RoadThumb data={work.data} />;
  if (work.kind === 'trace') return <TraceThumb data={work.data} />;
  return (
    <Illust
      id={work.kind === 'trace' ? 'mode-trace' : 'mode-road'}
      style={{ width: '100%', height: '100%' }}
      label={work.title}
    />
  );
}
