/** かたちを描く小さな部品（盤面・手元・見本・完了画面で共通） */
import type { CSSProperties } from 'react';
import type { SlotDef } from './content';
import { dims, shapePath, type Piece } from './geometry';

interface PathProps extends Piece {
  x?: number;
  y?: number;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}

/** 中心 (x, y)、向き rot で描く。色は className か style で決める */
export function ShapePath({ shape, size, rot, x = 0, y = 0, className, style, testId }: PathProps) {
  return (
    <path
      d={shapePath(shape, size)}
      transform={`translate(${x} ${y}) rotate(${rot})`}
      className={className}
      style={style}
      data-testid={testId}
    />
  );
}

/** 絵がちょうど収まる正方形の viewBox（余白つき） */
export function fitBox(slots: readonly SlotDef[], pad = 4): string {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of slots) {
    const d = dims(s.shape, s.size, s.rot);
    x0 = Math.min(x0, s.x - d.w / 2);
    x1 = Math.max(x1, s.x + d.w / 2);
    y0 = Math.min(y0, s.y - d.h / 2);
    y1 = Math.max(y1, s.y + d.h / 2);
  }
  const side = Math.max(x1 - x0, y1 - y0) + pad * 2;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const r = (n: number) => Math.round(n * 100) / 100;
  return `${r(cx - side / 2)} ${r(cy - side / 2)} ${r(side)} ${r(side)}`;
}

/** 完成した絵（色付き）。見本と完了画面に使う。絵が大きく見えるよう、外形に合わせて拡大する */
export function PictureSvg({
  slots,
  className,
  testId,
}: {
  slots: readonly SlotDef[];
  className?: string;
  testId?: string;
}) {
  return (
    <svg
      viewBox={fitBox(slots)}
      className={className}
      aria-hidden
      focusable="false"
      data-testid={testId}
    >
      {slots.map((s, i) => (
        <ShapePath
          key={i}
          shape={s.shape}
          size={s.size}
          rot={s.rot}
          x={s.x}
          y={s.y}
          className="shp-mini"
          style={{ fill: s.color }}
        />
      ))}
    </svg>
  );
}
