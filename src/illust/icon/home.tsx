import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const home: IllustDef = {
  id: 'home',
  label: 'おうち',
  status: 'final',
  draw: () => (
    <g>
      <rect x="18" y="44" width="64" height="46" rx="3" fill={P.paper} {...line} />
      <path d="M50 10 L94 48 L6 48 Z" fill={P.leaf} {...line} />
      <path d="M42 90 L42 72 C42 64 58 64 58 72 L58 90 Z" fill={P.wood} {...line} />
    </g>
  ),
};
