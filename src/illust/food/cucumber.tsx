import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

const warts: [number, number][] = [
  [34, 64],
  [48, 58],
  [60, 52],
  [70, 40],
  [44, 70],
  [58, 64],
  [30, 54],
  [54, 44],
];

export const cucumber: IllustDef = {
  id: 'cucumber',
  label: 'きゅうり',
  status: 'final',
  draw: () => (
    <g>
      <rect
        x="8"
        y="38"
        width="84"
        height="26"
        rx="13"
        transform="rotate(-35 50 51)"
        fill={P.green}
        {...line}
      />
      {warts.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill={P.greenDark} />
      ))}
      <ellipse
        cx="42"
        cy="52"
        rx="2.6"
        ry="9"
        transform="rotate(55 42 52)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
