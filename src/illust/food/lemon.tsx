import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const lemon: IllustDef = {
  id: 'lemon',
  label: 'レモン',
  status: 'final',
  draw: () => (
    <g transform="rotate(-15 50 50)">
      <path
        d="M6 50 L12 46 C16 46 20 42 26 36 C38 22 62 22 74 36 C80 42 84 46 88 46 L94 50 L88 54 C84 54 80 58 74 64 C62 78 38 78 26 64 C20 58 16 54 12 54 Z"
        fill={P.yellow}
        {...line}
      />
      <ellipse
        cx="40"
        cy="40"
        rx="3.5"
        ry="9"
        transform="rotate(70 40 40)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
