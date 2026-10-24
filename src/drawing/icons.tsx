/**
 * おえかきの道具の絵（操作アイコン。DESINGN.md 6.2 の線の規約: 輪郭 #4A3B32・3.5・丸い端）。
 * 既存のアイコン（undo, eraser, picture, rotate, look, done）は src/illust のものを使う。
 */
import type { ReactElement } from 'react';
import { P } from '../illust/palette';
import { INK, line } from '../illust/types';
import { shapePathD } from './geometry';
import type { ShapeKind } from './model';

export type DrawIconId =
  | 'pen'
  | 'bucket'
  | 'stamp'
  | 'shapes'
  | 'move'
  | 'new'
  | 'redo'
  | 'export'
  | 'cloud'
  | 'check'
  | 'alert'
  | 'swap'
  | 'bigger'
  | 'smaller'
  | 'flip'
  | 'front'
  | 'back'
  | 'trash'
  | 'outline'
  | 'filled'
  | 'arrow';

const ICONS: Record<DrawIconId, () => ReactElement> = {
  pen: () => (
    <g>
      <path d="M22 78 L30 58 L70 18 L82 30 L42 70 Z" fill={P.yellow} {...line} />
      <path d="M22 78 L30 58 L42 70 Z" fill={P.tan} {...line} />
      <path d="M22 78 L25 70 L30 75 Z" fill={INK} />
      <path d="M62 26 L74 38" fill="none" {...line} />
    </g>
  ),
  bucket: () => (
    <g>
      <path d="M20 40 L56 18 L80 58 L44 80 Z" fill={P.sky} {...line} />
      <path d="M20 40 L56 18" fill="none" {...line} />
      <path d="M78 56 C88 66 90 76 84 82 C78 88 72 80 76 70 Z" fill={P.blue} {...line} />
      <path d="M28 44 L58 26" fill="none" stroke={P.blue} strokeWidth="6" strokeLinecap="round" />
    </g>
  ),
  stamp: () => (
    <g>
      <rect x="18" y="62" width="64" height="18" rx="4" fill={P.red} {...line} />
      <path d="M38 62 L42 40 L58 40 L62 62 Z" fill={P.wood} {...line} />
      <circle cx="50" cy="28" r="14" fill={P.wood} {...line} />
      <path d="M22 88 L78 88" fill="none" {...line} />
    </g>
  ),
  shapes: () => (
    <g>
      <circle cx="34" cy="36" r="20" fill={P.sky} {...line} />
      <path d="M62 20 L86 60 L38 60 Z" fill={P.yellow} {...line} />
      <rect x="22" y="58" width="30" height="28" rx="3" fill={P.red} {...line} />
    </g>
  ),
  move: () => (
    <g>
      <path
        d="M50 10 L62 24 L55 24 L55 45 L76 45 L76 38 L90 50 L76 62 L76 55 L55 55 L55 76 L62 76 L50 90 L38 76 L45 76 L45 55 L24 55 L24 62 L10 50 L24 38 L24 45 L45 45 L45 24 L38 24 Z"
        fill={P.sky}
        {...line}
      />
    </g>
  ),
  new: () => (
    <g>
      <path d="M24 10 L64 10 L80 26 L80 90 L24 90 Z" fill={P.white} {...line} />
      <path d="M64 10 L64 26 L80 26" fill="none" {...line} />
      <path
        d="M52 44 L52 76 M36 60 L68 60"
        fill="none"
        stroke={P.leaf}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </g>
  ),
  redo: () => (
    <g transform="translate(100 0) scale(-1 1)">
      <path
        d="M30 30 L14 46 L30 62"
        fill="none"
        stroke={INK}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 46 L58 46 C74 46 84 56 84 68 C84 80 74 88 60 88 L44 88"
        fill="none"
        stroke={INK}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </g>
  ),
  export: () => (
    <g>
      <rect x="12" y="14" width="76" height="56" rx="4" fill={P.white} {...line} />
      <path d="M18 64 L40 40 L56 56 L66 46 L82 64 Z" fill={P.green} {...line} strokeWidth="2.5" />
      <circle cx="68" cy="30" r="7" fill={P.yellow} {...line} strokeWidth="2.5" />
      <path
        d="M50 66 L50 92 M38 80 L50 92 L62 80"
        fill="none"
        stroke={INK}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ),
  cloud: () => (
    <g>
      <path
        d="M24 72 C10 72 8 54 22 51 C20 36 38 30 46 40 C50 26 72 26 74 42 C88 40 94 58 82 68 C80 72 78 72 74 72 Z"
        fill={P.white}
        {...line}
      />
      <path
        d="M36 60 L64 60"
        fill="none"
        stroke={P.sky}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="2 9"
      />
    </g>
  ),
  check: () => (
    <g>
      <circle cx="50" cy="50" r="38" fill={P.white} stroke={P.leaf} strokeWidth="9" />
      <path
        d="M32 52 L45 64 L70 36"
        fill="none"
        stroke={INK}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ),
  alert: () => (
    <g>
      <path d="M50 10 L92 86 L8 86 Z" fill={P.sun} {...line} />
      <path d="M50 36 L50 60" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <circle cx="50" cy="74" r="5" fill={INK} />
    </g>
  ),
  swap: () => (
    <g>
      <path
        d="M18 36 L78 36 M66 22 L80 36 L66 50"
        fill="none"
        stroke={INK}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M82 66 L22 66 M34 52 L20 66 L34 80"
        fill="none"
        stroke={INK}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ),
  bigger: () => (
    <g>
      <rect x="10" y="10" width="80" height="80" rx="6" fill={P.sky} {...line} />
      <path
        d="M50 30 L50 70 M30 50 L70 50"
        fill="none"
        stroke={INK}
        strokeWidth="8"
        strokeLinecap="round"
      />
    </g>
  ),
  smaller: () => (
    <g>
      <rect x="28" y="28" width="44" height="44" rx="5" fill={P.sky} {...line} />
      <path d="M38 50 L62 50" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
    </g>
  ),
  flip: () => (
    <g>
      <path d="M44 20 L44 80 L12 80 Z" fill={P.sky} {...line} />
      <path d="M56 20 L56 80 L88 80 Z" fill={P.white} {...line} />
      <path d="M50 10 L50 90" fill="none" stroke={INK} strokeWidth="3" strokeDasharray="6 5" />
    </g>
  ),
  front: () => (
    <g>
      <rect x="12" y="12" width="48" height="48" rx="4" fill={P.white} {...line} />
      <rect x="40" y="40" width="48" height="48" rx="4" fill={P.red} {...line} />
    </g>
  ),
  back: () => (
    <g>
      <rect x="40" y="40" width="48" height="48" rx="4" fill={P.red} {...line} />
      <rect x="12" y="12" width="48" height="48" rx="4" fill={P.white} {...line} />
    </g>
  ),
  trash: () => (
    <g>
      <path d="M24 30 L76 30 L70 88 L30 88 Z" fill={P.gray} {...line} />
      <rect x="16" y="20" width="68" height="10" rx="3" fill={P.gray} {...line} />
      <path d="M40 14 L60 14" fill="none" {...line} />
      <path d="M42 42 L44 76 M58 42 L56 76" fill="none" {...line} strokeWidth="3" />
    </g>
  ),
  outline: () => (
    <g>
      <circle cx="50" cy="50" r="34" fill={P.white} stroke={INK} strokeWidth="8" />
    </g>
  ),
  filled: () => (
    <g>
      <circle cx="50" cy="50" r="34" fill={P.red} {...line} />
    </g>
  ),
  arrow: () => (
    <g>
      <path d="M50 14 L82 50 L62 50 L62 86 L38 86 L38 50 L18 50 Z" fill={P.sky} {...line} />
    </g>
  ),
};

export function DrawIcon({
  id,
  className,
  rotate = 0,
}: {
  id: DrawIconId;
  className?: string;
  rotate?: number;
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden focusable="false">
      <g transform={rotate ? `rotate(${rotate} 50 50)` : undefined}>{ICONS[id]()}</g>
    </svg>
  );
}

/** 図形の見本（道具欄・選択板） */
export function ShapeIcon({
  shape,
  filled,
  color,
  className,
}: {
  shape: ShapeKind;
  filled: boolean;
  color: string;
  className?: string;
}) {
  const size =
    shape === 'ellipse' ? { w: 80, h: 52 } : shape === 'line' ? { w: 76, h: 10 } : { w: 70, h: 70 };
  return (
    <svg viewBox="-50 -50 100 100" className={className} aria-hidden focusable="false">
      <path
        d={shapePathD(shape, size.w, size.h)}
        fill={filled && shape !== 'line' ? color : 'none'}
        stroke={color}
        strokeWidth={shape === 'line' ? 9 : 7}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
