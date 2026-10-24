import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const ball: IllustDef = {
  id: 'ball',
  label: 'ボール',
  status: 'final',
  draw: () => (
    <g>
      <path d="M50 50 L50 12 A38 38 0 0 1 82.9 31 Z" fill={P.red} />
      <path d="M50 50 L82.9 31 A38 38 0 0 1 82.9 69 Z" fill={P.yellow} />
      <path d="M50 50 L82.9 69 A38 38 0 0 1 50 88 Z" fill={P.blue} />
      <path d="M50 50 L50 88 A38 38 0 0 1 17.1 69 Z" fill={P.red} />
      <path d="M50 50 L17.1 69 A38 38 0 0 1 17.1 31 Z" fill={P.yellow} />
      <path d="M50 50 L17.1 31 A38 38 0 0 1 50 12 Z" fill={P.blue} />
      <path
        d="M50 50 L50 12 M50 50 L82.9 31 M50 50 L82.9 69 M50 50 L50 88 M50 50 L17.1 69 M50 50 L17.1 31"
        fill="none"
        {...line}
        strokeWidth="2.5"
      />
      <circle cx="50" cy="50" r="6" fill={P.white} {...line} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="38" fill="none" {...line} />
      <ellipse
        cx="31"
        cy="30"
        rx="3.5"
        ry="7"
        transform="rotate(45 31 30)"
        fill={HIGHLIGHT}
        opacity="0.6"
      />
    </g>
  ),
};
