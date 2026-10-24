/** 手元のピース。全部同じ木の色で、形と大きさだけが手がかり（M4-06） */
import { useMemo } from 'react';
import { StateMark } from '../../ui/Tap';
import { SHAPE_LABEL } from './geometry';
import { isPlaced, type BoardState, type Puzzle } from './logic';
import { ShapePath } from './ShapeSvg';
import { SCALE, trayLayout, trayWidthU } from './trayLayout';

interface Props {
  puzzle: Puzzle;
  board: BoardState;
  /** 置き間違いの直後に「？」を出すピース */
  flash: number | null;
  disabled: boolean;
  onSelect: (id: number) => void;
}

const u = (n: number) => `calc(var(--u) * ${Math.round(n * 1000) / 1000})`;
/** ピースの下の段差（盤面の単位） */
const STEP = 1.4;

export function Tray({ puzzle, board, flash, disabled, onSelect }: Props) {
  const { cells } = useMemo(() => trayLayout(puzzle), [puzzle]);
  return (
    <div
      className="shp-tray"
      style={{ width: u(trayWidthU(puzzle.sample)) }}
      role="group"
      aria-label="てもと"
    >
      {cells.map((c) => {
        const piece = puzzle.pieces[c.id]!;
        const rot = board.rots[c.id] ?? piece.rot;
        const placed = isPlaced(board, c.id);
        const selected = board.selected === c.id;
        const wrong = flash === c.id;
        return (
          <button
            key={c.id}
            type="button"
            className={`shp-piece ${selected ? 'is-selected' : ''} ${wrong ? 'is-wrong' : ''}`}
            style={{
              left: u(c.x * SCALE),
              top: u(c.y * SCALE),
              width: u(c.w * SCALE),
              height: u(c.h * SCALE),
              visibility: placed ? 'hidden' : 'visible',
            }}
            aria-label={SHAPE_LABEL[piece.shape]}
            aria-pressed={selected}
            disabled={disabled || placed}
            onClick={() => onSelect(c.id)}
            data-testid={`piece-${c.id}`}
          >
            <svg
              viewBox={`${-c.w / 2} ${-c.h / 2} ${c.w} ${c.h}`}
              focusable="false"
              aria-hidden
              className="shp-piece__svg"
            >
              <ShapePath
                shape={piece.shape}
                size={piece.size}
                rot={rot}
                y={STEP}
                className="shp-piece__step"
              />
              <ShapePath
                shape={piece.shape}
                size={piece.size}
                rot={rot}
                className="shp-piece__face"
              />
            </svg>
            <StateMark state={wrong ? 'wrong' : null} />
          </button>
        );
      })}
    </div>
  );
}
