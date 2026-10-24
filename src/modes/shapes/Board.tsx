/** 盤面（100 × 100 の同じ座標系）。穴・破線の置き場所・外形だけ、と置いたピースを描く */
import { useRef, type MouseEvent } from 'react';
import { BOARD, type Point } from './geometry';
import type { BoardState, Puzzle } from './logic';
import { ShapePath } from './ShapeSvg';

interface Props {
  puzzle: Puzzle;
  board: BoardState;
  /** ヒント2で囲む置き場所 */
  hintSlot: number | null;
  /** 絵が完成した（色を付ける） */
  done: boolean;
  onTap: (p: Point) => void;
}

export function Board({ puzzle, board, hintSlot, done, onTap }: Props) {
  const ref = useRef<SVGSVGElement>(null);

  const handle = (e: MouseEvent<SVGSVGElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    onTap({
      x: ((e.clientX - r.left) / r.width) * BOARD,
      y: ((e.clientY - r.top) / r.height) * BOARD,
    });
  };

  const { slots, layout } = puzzle;
  const empty = (i: number) => board.placed[i] === null;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${BOARD} ${BOARD}`}
      className={`shp-board__svg ${done ? 'shp-board__svg--done' : ''}`}
      onClick={handle}
      role="group"
      aria-label="ばんめん"
      focusable="false"
      data-testid="shapes-board"
    >
      <rect className="shp-board__bg" x={0} y={0} width={BOARD} height={BOARD} rx={3} />

      {layout === 'silhouette' ? (
        <g className="shp-sil">
          {slots.map((s, i) => (
            <ShapePath key={`e${i}`} {...s} className="shp-sil__edge" />
          ))}
          {slots.map((s, i) => (
            <ShapePath key={`f${i}`} {...s} className="shp-sil__fill" testId={`slot-${i}`} />
          ))}
        </g>
      ) : null}

      {layout === 'hole'
        ? slots.map((s, i) =>
            empty(i) ? (
              <ShapePath
                key={i}
                {...s}
                className={`shp-hole ${hintSlot === i ? 'shp-hint' : ''}`}
                testId={`slot-${i}`}
              />
            ) : null,
          )
        : null}

      {layout === 'lines'
        ? slots.map((s, i) =>
            empty(i) ? (
              <ShapePath
                key={i}
                {...s}
                className={`shp-slot ${hintSlot === i ? 'shp-hint' : ''}`}
                testId={`slot-${i}`}
              />
            ) : null,
          )
        : null}

      {/* K5: 外形の上に、ヒント2の置き場所を重ねる */}
      {layout === 'silhouette' && hintSlot !== null && empty(hintSlot) ? (
        <ShapePath {...slots[hintSlot]!} className="shp-slot shp-hint" />
      ) : null}

      {slots.map((s, i) => {
        if (board.placed[i] === null) return null;
        return (
          <g key={`p${i}`} className="shp-pop" style={{ transformOrigin: `${s.x}px ${s.y}px` }}>
            <ShapePath
              {...s}
              className="shp-placed"
              style={done ? { fill: s.color } : undefined}
              testId={`placed-${i}`}
            />
          </g>
        );
      })}
    </svg>
  );
}
