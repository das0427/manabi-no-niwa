/**
 * 「すすむ・まわる」の命令で図形をかく部品（g4 draw-shapes・g5 polygon で使う）。
 * program エンジンは格子の上を動くだけでかけないので、かいた線を SVG の図（figure）にして、
 * choice・number・match・order の問題で使う。
 *
 * 向きは はじめ 右むき。「みぎに ◯ど」は時計まわりに曲がる。
 */
import type { Figure } from '../../engines/figure/types';

export type TStep = { f: number } | { t: number };
export const FW = (n: number): TStep => ({ f: n });
export const TR = (d: number): TStep => ({ t: d });

/** body を n 回くりかえした列 */
export const repeatSteps = (n: number, ...body: TStep[]): TStep[] =>
  Array.from({ length: n }, () => body).flat();

const isF = (s: TStep): s is { f: number } => 'f' in s;

/** 「すすむ 3」「みぎに 90ど」 */
export function stepText(s: TStep): string {
  return isF(s) ? `すすむ ${s.f}` : `みぎに ${s.t}ど`;
}
export const stepsText = (ss: readonly TStep[]) => ss.map(stepText).join('、');
/** 「すすむ 3、みぎに 90ど」を 4かい くりかえす */
export const repText = (n: number, ...body: TStep[]) =>
  `「${stepsText(body)}」を ${n}かい くりかえす`;

export interface Trace {
  pts: [number, number][];
  /** さいごの向き（度。はじめは 0 = 右） */
  heading: number;
  /** 進んだ長さの合計 */
  length: number;
  /** 曲がった角度の合計 */
  turned: number;
  /** はじめの場所に もどって いるか */
  closed: boolean;
}

export function trace(steps: readonly TStep[]): Trace {
  let x = 0;
  let y = 0;
  let h = 0;
  let length = 0;
  let turned = 0;
  const pts: [number, number][] = [[0, 0]];
  for (const s of steps) {
    if (isF(s)) {
      x += s.f * Math.cos((h * Math.PI) / 180);
      y += s.f * Math.sin((h * Math.PI) / 180);
      length += s.f;
      pts.push([x, y]);
    } else {
      h = (h + s.t) % 360;
      turned += s.t;
    }
  }
  const closed = Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6 && pts.length > 2;
  return { pts, heading: h, length, turned, closed };
}

/** 命令でかいた線の図。grid: 1の長さごとの目盛り線を出す（長さを数えて読む問題で） */
export function turtleFigure(
  steps: readonly TStep[],
  label: string,
  opt: { grid?: boolean; box?: number; hU?: number } = {},
): Figure {
  const { pts } = trace(steps);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 0.5);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 0.5);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const box = opt.box ?? 130;
  const u = Math.min(box / spanX, box / spanY, 30);
  const pad = 14;
  const W = spanX * u + pad * 2;
  const H = spanY * u + pad * 2;
  const X = (v: number) => (pad + (v - minX) * u).toFixed(1);
  const Y = (v: number) => (pad + (v - minY) * u).toFixed(1);
  let body = '';
  if (opt.grid) {
    for (let gx = Math.ceil(minX - 1e-9); gx <= maxX + 1e-9; gx++)
      body += `<line x1="${X(gx)}" y1="${Y(minY)}" x2="${X(gx)}" y2="${Y(maxY)}" stroke="var(--paper-2)" stroke-width="1.5"/>`;
    for (let gy = Math.ceil(minY - 1e-9); gy <= maxY + 1e-9; gy++)
      body += `<line x1="${X(minX)}" y1="${Y(gy)}" x2="${X(maxX)}" y2="${Y(gy)}" stroke="var(--paper-2)" stroke-width="1.5"/>`;
  }
  body += `<polyline points="${pts.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  // はじめ: みどりの点と右むきの矢じるし
  body += `<circle cx="${X(0)}" cy="${Y(0)}" r="5" fill="var(--leaf)" stroke="var(--ink)" stroke-width="2"/>`;
  body += `<polygon points="${(Number(X(0)) + 7).toFixed(1)},${(Number(Y(0)) - 5).toFixed(1)} ${(Number(X(0)) + 14).toFixed(1)},${Y(0)} ${(Number(X(0)) + 7).toFixed(1)},${(Number(Y(0)) + 5).toFixed(1)}" fill="var(--leaf)" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>`;
  // おわり: ふとい点
  const last = pts[pts.length - 1]!;
  if (pts.length > 1 && (Math.abs(last[0]) > 1e-6 || Math.abs(last[1]) > 1e-6))
    body += `<circle cx="${X(last[0])}" cy="${Y(last[1])}" r="5" fill="var(--sun)" stroke="var(--ink)" stroke-width="2"/>`;
  return {
    kind: 'svg',
    label,
    markup: `<svg viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" style="height:calc(var(--u) * ${(opt.hU ?? 9).toFixed(1)})" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  };
}
