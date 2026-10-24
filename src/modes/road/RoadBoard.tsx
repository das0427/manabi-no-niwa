/**
 * 遊ぶ盤面（SVG）。マスのタップ、うさぎ、あしあと、止まった所の印、ヒントの囲み。
 * 盤面の要素には touch-action: none と contextmenu の抑止を付ける（OP-06）。
 */
import type { KeyboardEvent, MouseEvent } from 'react';
import { cellAt, neighbor, inBoard, type Board, type Dir, type Pos } from './board';
import { CELL, EDGE, IllustAt, RoadRoads, centerOf, sizeOf, viewBoxOf } from './draw';

export interface StopView {
  pos: Pos;
  /** つながっていない開口の向き（点線で示す） */
  sides: Dir[];
}

export interface RabbitView {
  pos: Pos;
  /** 左向きに進んでいるか */
  flip: boolean;
}

interface Props {
  board: Board;
  /** 1マスの大きさ（u）。盤面の見た目の大きさを決める */
  cellU: number;
  interactive: boolean;
  hint?: Pos | null;
  stop?: StopView | null;
  rabbit: RabbitView;
  trail?: readonly Pos[];
  arrived?: boolean;
  onCell?: (p: Pos) => void;
}

const RABBIT = 5.8;

/** うさぎを置く位置（スタート・ゴールのマスでは いえ・にんじんと重ならないよう少しずらす） */
function rabbitAt(board: Board, pos: Pos): { x: number; y: number } {
  const { x, y } = centerOf(pos);
  const t = cellAt(board, pos)?.t;
  const shift = t === 'start' || t === 'goal' ? 1.3 : 0;
  return { x: x - RABBIT / 2 + shift, y: y - RABBIT / 2 + 0.4 + shift };
}

export function RoadBoard({
  board,
  cellU,
  interactive,
  hint,
  stop,
  rabbit,
  trail = [],
  arrived,
  onCell,
}: Props) {
  const { w, h } = sizeOf(board);
  const rb = rabbitAt(board, rabbit.pos);

  const cells: React.ReactNode[] = [];
  const icons: React.ReactNode[] = [];
  const hits: React.ReactNode[] = [];
  board.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      const x = c * CELL;
      const y = r * CELL;
      const key = `${r}-${c}`;
      if (cell.t === 'empty') {
        cells.push(
          <rect
            key={key}
            x={x + 0.6}
            y={y + 0.6}
            width={CELL - 1.2}
            height={CELL - 1.2}
            rx={1.4}
            className="road-empty"
          />,
        );
      } else if (cell.t === 'tile') {
        cells.push(
          <rect
            key={key}
            x={x + 0.6}
            y={y + 0.6}
            width={CELL - 1.2}
            height={CELL - 1.2}
            rx={1.4}
            className="road-tile"
          />,
        );
        icons.push(
          <IllustAt
            key={`rot-${key}`}
            id="rotate"
            x={x + CELL - 3.5}
            y={y + 0.9}
            size={2.7}
            className="road-rot"
          />,
        );
      } else if (cell.t === 'rock') {
        icons.push(<IllustAt key={key} id="rock" x={x + 0.8} y={y + 0.9} size={8.4} />);
      } else if (cell.t === 'start') {
        icons.push(<IllustAt key={key} id="house" x={x + 0.6} y={y + 0.4} size={7} />);
      } else if (cell.t === 'goal') {
        icons.push(<IllustAt key={key} id="carrot" x={x + 0.8} y={y + 0.8} size={7} />);
      }
      const active = interactive && (cell.t === 'empty' || cell.t === 'tile');
      const press = () => onCell?.({ r, c });
      hits.push(
        <rect
          key={`hit-${key}`}
          x={x}
          y={y}
          width={CELL}
          height={CELL}
          className={`road-hit ${active ? 'road-hit--on' : ''}`}
          data-hit
          data-testid={`cell-${r}-${c}`}
          data-cell={cell.t}
          role={active ? 'button' : undefined}
          tabIndex={active ? 0 : undefined}
          aria-label={
            cell.t === 'empty' ? 'あいている ます' : cell.t === 'tile' ? 'おいた みち' : undefined
          }
          onClick={active ? press : undefined}
          onKeyDown={
            active
              ? (e: KeyboardEvent<SVGRectElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    press();
                  }
                }
              : undefined
          }
        />,
      );
    }),
  );

  const trailPts = trail.map((p) => {
    const q = centerOf(p);
    return `${q.x},${q.y}`;
  });
  const goalCell = (() => {
    for (let r = 0; r < board.rows; r++)
      for (let c = 0; c < board.cols; c++) if (board.cells[r]![c]!.t === 'goal') return { r, c };
    return null;
  })();

  return (
    <svg
      viewBox={viewBoxOf(board)}
      className="road-svg"
      style={{
        width: `calc(var(--u) * ${w * cellU * 0.1})`,
        height: `calc(var(--u) * ${h * cellU * 0.1})`,
      }}
      data-testid="road-board"
      role="group"
      aria-label="みちの ばんめん"
      focusable="false"
      onContextMenu={(e: MouseEvent) => e.preventDefault()}
    >
      <rect
        x="0"
        y="0"
        width={board.cols * CELL}
        height={board.rows * CELL}
        rx="1.6"
        className="road-ground"
      />
      {cells}
      {hint ? (
        <rect
          x={hint.c * CELL + 0.3}
          y={hint.r * CELL + 0.3}
          width={CELL - 0.6}
          height={CELL - 0.6}
          rx={1.6}
          className="road-hint-fill"
        />
      ) : null}
      <RoadRoads board={board} />
      {icons}
      {trailPts.length > 1 ? <polyline points={trailPts.join(' ')} className="road-trail" /> : null}
      {stop
        ? stop.sides.map((d) => {
            const c = centerOf(stop.pos);
            const [dx, dy] = EDGE[d];
            const out = inBoard(board, neighbor(stop.pos, d)) ? 1.7 : 1.1;
            const k = 1 + out / (CELL / 2);
            return (
              <path
                key={d}
                d={`M${c.x} ${c.y}l${dx * k} ${dy * k}`}
                className="road-dotted"
                data-testid={`stop-side-${d}`}
              />
            );
          })
        : null}
      {arrived && goalCell ? (
        <circle
          cx={centerOf(goalCell).x}
          cy={centerOf(goalCell).y}
          r={5.2}
          className="road-ok-ring"
          data-testid="arrived-ring"
        />
      ) : null}
      <g
        className="road-rabbit"
        style={{ transform: `translate(${rb.x}px, ${rb.y}px)` }}
        data-testid="rabbit"
        data-rabbit-r={rabbit.pos.r}
        data-rabbit-c={rabbit.pos.c}
      >
        <IllustAt id="rabbit" x={0} y={0} size={RABBIT} flip={rabbit.flip} />
      </g>
      {stop ? (
        <g
          transform={`translate(${centerOf(stop.pos).x + 3.4} ${centerOf(stop.pos).y - 3.6})`}
          data-testid="stop-mark"
        >
          <circle r="2.7" className="road-q" />
          <text className="road-q-text" textAnchor="middle" dominantBaseline="central" y="0.2">
            ？
          </text>
        </g>
      ) : null}
      {hint ? (
        <rect
          x={hint.c * CELL + 0.3}
          y={hint.r * CELL + 0.3}
          width={CELL - 0.6}
          height={CELL - 0.6}
          rx={1.6}
          className="road-hint-line"
          data-testid="hint-cell"
        />
      ) : null}
      {hits}
    </svg>
  );
}
