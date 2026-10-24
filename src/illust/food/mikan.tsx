import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const mikan: IllustDef = {
  id: 'mikan',
  label: 'みかん',
  status: 'final',
  draw: () => (
    <g>
      <ellipse cx="50" cy="56" rx="38" ry="33" fill={P.orange} {...line} />
      {/* 表面の点々 */}
      <circle cx="66" cy="62" r="1.8" fill={P.yellow} />
      <circle cx="58" cy="76" r="1.8" fill={P.yellow} />
      <circle cx="34" cy="70" r="1.8" fill={P.yellow} />
      {/* へた */}
      <path
        d="M50 28 L43 30 L40 36 L47 34 L50 40 L53 34 L60 36 L57 30 Z"
        fill={P.green}
        {...line}
        strokeWidth="3"
      />
      <ellipse
        cx="27"
        cy="50"
        rx="3.5"
        ry="7"
        transform="rotate(25 27 50)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
