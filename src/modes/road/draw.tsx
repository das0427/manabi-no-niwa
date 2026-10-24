/**
 * みちの絵（SVG）。盤面・縮小表示・道具の札で同じ描き方を使う。
 * 座標は 1マス = 10 の同一座標系。色はすべて CSS のトークン（road.css）で付ける。
 */
import type { ReactNode } from 'react';
import { getIllust } from '../../illust/registry';
import { isLinked, openingsOf, type Board, type Dir, type Pos, type TileKind } from './board';
import { tileOpenings } from './board';

export const CELL = 10;
/** 道の太さ（輪郭を含む / 中の面） */
export const ROAD_INK = 6;
export const ROAD_CORE = 4.8;
/** 盤面の外側の余白（viewBox） */
export const MARGIN = 1.4;

/** マスの中心から各向きの縁までのずれ */
export const EDGE: Record<Dir, readonly [number, number]> = {
  0: [0, -CELL / 2],
  1: [CELL / 2, 0],
  2: [0, CELL / 2],
  3: [-CELL / 2, 0],
};

export const centerOf = (p: Pos): { x: number; y: number } => ({
  x: p.c * CELL + CELL / 2,
  y: p.r * CELL + CELL / 2,
});

/** 盤面全体の viewBox */
export const viewBoxOf = (board: Board): string =>
  `${-MARGIN} ${-MARGIN} ${board.cols * CELL + MARGIN * 2} ${board.rows * CELL + MARGIN * 2}`;

/** viewBox の幅・高さ（盤面の単位） */
export const sizeOf = (board: Board): { w: number; h: number } => ({
  w: board.cols * CELL + MARGIN * 2,
  h: board.rows * CELL + MARGIN * 2,
});

/** 組み込みイラスト（うさぎ・いえ等）を、盤面の座標で (x, y) から size の大きさで描く */
export function IllustAt({
  id,
  x,
  y,
  size,
  flip,
  className,
}: {
  id: string;
  x: number;
  y: number;
  size: number;
  flip?: boolean;
  className?: string;
}) {
  const def = getIllust(id);
  if (!def) return null;
  const s = size / 100;
  const transform = flip
    ? `translate(${x + size} ${y}) scale(${-s} ${s})`
    : `translate(${x} ${y}) scale(${s})`;
  return (
    <g transform={transform} className={className} data-illust={id}>
      {def.draw()}
    </g>
  );
}

/** 開口の向きから、中心→縁の線分（stub）を並べた path の d */
function stubs(cx: number, cy: number, dirs: readonly Dir[], reach = 1): string {
  return dirs
    .map((d) => {
      const [dx, dy] = EDGE[d];
      return `M${cx} ${cy}l${dx * reach} ${dy * reach}`;
    })
    .join('');
}

/**
 * 道の絵（輪郭 → 中の面 → 行き止まりの印）。すべてのマスをまとめて描くので、
 * 隣り合う道の輪郭がつながって見える。caps が true なら、つながっていない道の端に横線を引く。
 */
export function RoadRoads({ board, caps = true }: { board: Board; caps?: boolean }): ReactNode {
  let lines = '';
  let dots = '';
  let capPath = '';
  board.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      const ops = openingsOf(cell);
      if (ops.length === 0) return;
      const { x, y } = { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
      lines += stubs(x, y, ops);
      dots += `M${x} ${y}h0`;
      if (!caps) return;
      for (const d of ops) {
        if (isLinked(board, { r, c }, d)) continue;
        const [dx, dy] = EDGE[d];
        const ex = x + dx;
        const ey = y + dy;
        const half = ROAD_INK / 2;
        capPath += dx !== 0 ? `M${ex} ${ey - half}v${half * 2}` : `M${ex - half} ${ey}h${half * 2}`;
      }
    }),
  );
  return (
    <g className="road-roads">
      <path d={lines} className="road-ink" strokeWidth={ROAD_INK} />
      <path d={dots} className="road-ink road-dot" strokeWidth={ROAD_INK} />
      <path d={lines} className="road-core" strokeWidth={ROAD_CORE} />
      <path d={dots} className="road-core road-dot" strokeWidth={ROAD_CORE} />
      {capPath ? <path d={capPath} className="road-cap" strokeWidth={1} /> : null}
    </g>
  );
}

/** 道具の札に出す、道1マスの小さな絵 */
export function ToolGlyph({ kind, className }: { kind: TileKind; className?: string }) {
  const ops = tileOpenings(kind, 0);
  const d = stubs(5, 5, ops);
  return (
    <svg viewBox="0 0 10 10" className={className} aria-hidden focusable="false">
      <rect x="0.4" y="0.4" width="9.2" height="9.2" rx="1.4" className="road-glyph-ground" />
      <path d={d} className="road-ink" strokeWidth={5.2} />
      <path d="M5 5h0" className="road-ink road-dot" strokeWidth={5.2} />
      <path d={d} className="road-core" strokeWidth={4} />
      <path d="M5 5h0" className="road-core road-dot" strokeWidth={4} />
    </svg>
  );
}

/**
 * 盤面と道だけの絵（作品の縮小表示・完了画面）。
 * icons が true なら いえ・にんじん・いわ を絵で、false なら小さな印で示す。
 */
export function RoadPicture({
  board,
  icons = false,
  className,
  label,
}: {
  board: Board;
  icons?: boolean;
  className?: string;
  label?: string;
}) {
  const marks: ReactNode[] = [];
  board.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      const x = c * CELL;
      const y = r * CELL;
      const k = `${r}-${c}`;
      if (cell.t === 'rock') {
        marks.push(
          icons ? (
            <IllustAt key={k} id="rock" x={x + 1} y={y + 1} size={8} />
          ) : (
            <circle key={k} cx={x + 5} cy={y + 5} r={3} className="road-pic-rock" />
          ),
        );
      } else if (cell.t === 'start') {
        marks.push(
          icons ? (
            <IllustAt key={k} id="house" x={x + 1.2} y={y + 1.2} size={7.6} />
          ) : (
            <circle key={k} cx={x + 5} cy={y + 5} r={3.4} className="road-pic-start" />
          ),
        );
      } else if (cell.t === 'goal') {
        marks.push(
          icons ? (
            <IllustAt key={k} id="carrot" x={x + 1.2} y={y + 1.2} size={7.6} />
          ) : (
            <circle key={k} cx={x + 5} cy={y + 5} r={3.4} className="road-pic-goal" />
          ),
        );
      }
    }),
  );
  return (
    <svg
      viewBox={viewBoxOf(board)}
      className={className}
      role="img"
      aria-label={label ?? 'みち'}
      focusable="false"
    >
      <rect
        x="0"
        y="0"
        width={board.cols * CELL}
        height={board.rows * CELL}
        rx="1.6"
        className="road-ground"
      />
      <RoadRoads board={board} caps={false} />
      {marks}
    </svg>
  );
}
