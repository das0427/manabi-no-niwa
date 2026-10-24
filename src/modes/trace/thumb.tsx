/**
 * なぞりの作品の縮小表示（SVG）。お手本の薄い線と、子供が書いた線を重ねる。
 * 統括が作品一覧に登録する: registerWorkRenderer('trace', (d) => <TraceThumb data={d} />)
 */
import { findItem } from './content';
import { isTraceWorkData } from './logic';

const points = (pts: readonly (readonly [number, number])[]) =>
  pts.map((p) => p.join(',')).join(' ');

export function TraceThumb({ data }: { data: unknown }) {
  if (!isTraceWorkData(data)) return null;
  const item = findItem(data.guideId);
  const maze = item?.kind === 'maze';
  return (
    <svg
      viewBox="0 0 1000 1000"
      style={{ width: '100%', height: '100%' }}
      role="img"
      aria-label={item?.title ?? 'なぞった せん'}
    >
      <rect width="1000" height="1000" fill={maze ? 'var(--wood)' : 'var(--white)'} />
      {item
        ? maze
          ? (item.corridors ?? []).map((c, i) => (
              <polyline
                key={`c${i}`}
                points={points(c)}
                fill="none"
                stroke="var(--white)"
                strokeWidth={2 * (item.halfWidth ?? 75)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))
          : item.strokes.map((s, i) => (
              <polyline
                key={`g${i}`}
                points={points(s)}
                fill="none"
                stroke="var(--sky)"
                strokeOpacity="0.45"
                strokeWidth="130"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))
        : null}
      {data.strokes.map((s, i) => (
        <polyline
          key={`s${i}`}
          points={points(s)}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="34"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
