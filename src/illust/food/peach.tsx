import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const peach: IllustDef = {
  id: 'peach',
  label: 'もも',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M50 30 C34 20 12 32 14 58 C16 80 36 92 50 92 C64 92 84 80 86 58 C88 32 66 20 50 30 Z"
        fill={P.pink}
        {...line}
      />
      {/* 筋 */}
      <path
        d="M50 34 C43 50 45 68 52 82"
        fill="none"
        stroke={P.red}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* 軸と葉 */}
      <path d="M48 32 L50 20" fill="none" {...line} strokeWidth="4.5" stroke={P.brown} />
      <path d="M52 24 C58 10 76 8 84 14 C78 26 62 30 52 24 Z" fill={P.green} {...line} />
      <ellipse
        cx="27"
        cy="56"
        rx="3.5"
        ry="7"
        transform="rotate(12 27 56)"
        fill={HIGHLIGHT}
        opacity="0.6"
      />
    </g>
  ),
};
