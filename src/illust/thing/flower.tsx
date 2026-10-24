import { line, type IllustDef } from '../types';
import { P } from '../palette';

const petals: [number, number][] = [
  [50, 18],
  [67.1, 30.4],
  [60.6, 50.6],
  [39.4, 50.6],
  [32.9, 30.4],
];

export const flower: IllustDef = {
  id: 'flower',
  label: 'おはな',
  status: 'final',
  draw: () => (
    <g>
      {/* くき */}
      <path d="M46.5 48 L53.5 48 L54 94 L46 94 Z" fill={P.green} {...line} />
      {/* は */}
      <path d="M50 80 C38 80 26 72 26 60 C40 60 48 68 50 80 Z" fill={P.green} {...line} />
      {/* はなびら */}
      {petals.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="14" fill={P.pink} {...line} />
      ))}
      <circle cx="50" cy="36" r="9" fill={P.yellow} {...line} />
    </g>
  ),
};
