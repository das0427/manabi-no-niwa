import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const leaf: IllustDef = {
  id: 'leaf',
  label: 'はっぱ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M24 76 L12 90" fill="none" {...line} stroke={P.brown} strokeWidth="5" />
      <path d="M20 80 C12 40 40 12 86 12 C90 56 64 88 20 80 Z" fill={P.green} {...line} />
      {/* 葉脈 */}
      <path
        d="M20 80 L66 32 M42 58 L44 38 M56 44 L74 44 M34 68 L52 72"
        fill="none"
        stroke={P.greenDark}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse
        cx="38"
        cy="30"
        rx="3"
        ry="8"
        transform="rotate(55 38 30)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
