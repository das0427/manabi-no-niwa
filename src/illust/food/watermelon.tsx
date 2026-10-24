import { line, type IllustDef } from '../types';
import { P } from '../palette';

const seeds: [number, number, number][] = [
  [32, 48, 20],
  [50, 58, 0],
  [68, 48, -20],
  [42, 44, 10],
  [60, 42, -10],
];

export const watermelon: IllustDef = {
  id: 'watermelon',
  label: 'すいか',
  status: 'final',
  draw: () => (
    <g>
      {/* 皮 */}
      <path d="M6 34 A44 44 0 0 0 94 34 Z" fill={P.green} {...line} />
      {/* 白いところ */}
      <path d="M13 34 A37 37 0 0 0 87 34 Z" fill={P.cream} />
      {/* 果肉 */}
      <path d="M18 34 A32 32 0 0 0 82 34 Z" fill={P.red} />
      {seeds.map(([x, y, r]) => (
        <ellipse
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          rx="2"
          ry="3.4"
          transform={`rotate(${r} ${x} ${y})`}
          fill={P.ink}
        />
      ))}
    </g>
  ),
};
