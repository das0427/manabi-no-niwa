import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const banana: IllustDef = {
  id: 'banana',
  label: 'バナナ',
  status: 'final',
  draw: () => (
    <g>
      {/* 軸 */}
      <path d="M79 30 L83 12 L92 15 L89 34 Z" fill={P.brown} {...line} />
      {/* 体（弓なり） */}
      <path d="M10 58 C22 96 72 98 89 34 L79 28 C70 66 40 70 10 58 Z" fill={P.yellow} {...line} />
      {/* 左の先端 */}
      <circle cx="11" cy="58" r="3.2" fill={P.brown} />
      {/* 筋 */}
      <path d="M26 74 C46 86 68 76 80 48" fill="none" {...line} strokeWidth="2" />
      <ellipse
        cx="40"
        cy="68"
        rx="2.4"
        ry="8"
        transform="rotate(75 40 68)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
