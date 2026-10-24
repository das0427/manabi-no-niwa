import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

const seeds: [number, number][] = [
  [36, 50],
  [50, 48],
  [64, 50],
  [30, 62],
  [43, 62],
  [57, 62],
  [70, 62],
  [37, 74],
  [50, 74],
  [63, 74],
  [50, 85],
];

export const strawberry: IllustDef = {
  id: 'strawberry',
  label: 'いちご',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M50 92 C30 82 12 60 14 42 C16 28 30 26 50 32 C70 26 84 28 86 42 C88 60 70 82 50 92 Z"
        fill={P.red}
        {...line}
      />
      {/* 表面の種 */}
      {seeds.map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="1.8" ry="2.6" fill={P.cream} />
      ))}
      {/* へた */}
      <path
        d="M24 32 L40 36 L42 24 L50 34 L58 24 L60 36 L76 32 L66 46 L50 42 L34 46 Z"
        fill={P.green}
        {...line}
      />
      <path d="M50 38 L50 20" fill="none" {...line} strokeWidth="5" />
      <ellipse
        cx="26"
        cy="52"
        rx="3"
        ry="6"
        transform="rotate(12 26 52)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
