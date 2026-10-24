/**
 * 作品の縮小表示（がんばりノート・保護者画面の作品一覧）。盤面と道だけの簡素な絵。
 * data は saveWork の data（`{ board, draft }`）。壊れたデータでも落ちない。
 * 統括が registerWorkRenderer('road', (data) => <RoadThumb data={data} />) で登録する。
 */
import { isBoard } from './board';
import { RoadPicture } from './draw';
import './road.css';

export function RoadThumb({ data }: { data: unknown }) {
  const board = data && typeof data === 'object' ? (data as { board?: unknown }).board : undefined;
  if (!isBoard(board)) {
    return (
      <svg
        viewBox="0 0 10 8"
        role="img"
        aria-label="みち"
        style={{ width: '100%', height: '100%' }}
      >
        <rect x="0.4" y="0.4" width="9.2" height="7.2" rx="1" className="road-ground" />
      </svg>
    );
  }
  return <RoadPicture board={board} className="road-thumb" label="じゆうな みち" />;
}
