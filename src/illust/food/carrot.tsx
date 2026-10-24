import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const carrot: IllustDef = {
  id: 'carrot',
  label: 'にんじん',
  status: 'final',
  draw: () => (
    <g>
      {/* 葉 */}
      <path d="M50 34 C38 28 32 16 36 8 C46 10 52 22 50 34 Z" fill={P.green} {...line} />
      <path d="M50 34 C62 28 68 16 64 8 C54 10 48 22 50 34 Z" fill={P.green} {...line} />
      <path d="M50 34 C44 22 46 10 50 4 C54 10 56 22 50 34 Z" fill={P.green} {...line} />
      {/* 本体 */}
      <path
        d="M20 40 C20 30 80 30 80 40 C80 54 62 80 52 93 C50 95 50 95 48 93 C38 80 20 54 20 40 Z"
        fill={P.orange}
        {...line}
      />
      {/* しわ */}
      <path d="M30 46 L40 47" fill="none" {...line} strokeWidth="2.5" stroke={P.redDark} />
      <path d="M60 56 L69 55" fill="none" {...line} strokeWidth="2.5" stroke={P.redDark} />
      <path d="M40 66 L47 67" fill="none" {...line} strokeWidth="2.5" stroke={P.redDark} />
      <ellipse
        cx="33"
        cy="40"
        rx="3"
        ry="5.5"
        transform="rotate(-12 33 40)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
