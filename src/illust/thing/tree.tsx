import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const tree: IllustDef = {
  id: 'tree',
  label: 'き',
  status: 'final',
  draw: () => (
    <g>
      {/* みき */}
      <path d="M41 94 L44 56 L56 56 L59 94 Z" fill={P.brown} {...line} />
      {/* は */}
      <path
        d="M50 7 C66 5 79 15 81 28 C93 32 95 52 83 58 C76 68 58 68 50 63 C42 68 24 68 17 58 C5 52 7 32 19 28 C21 15 34 5 50 7 Z"
        fill={P.green}
        {...line}
      />
      <ellipse
        cx="30"
        cy="34"
        rx="3.5"
        ry="8"
        transform="rotate(35 30 34)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
