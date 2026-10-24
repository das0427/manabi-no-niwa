import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const modeSorting: IllustDef = {
  id: 'mode-sorting',
  label: 'なかまわけ',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M24.65 35.9C24.65 32.3 25.55 29.15 27.35 26.45L29.6 27.35C28.7 30.05 28.25 32.75 28.25 35.9Z"
        fill={P.brown}
        {...line}
      />
      <path
        d="M28.7 30.05C31.4 24.65 38.6 24.2 41.3 26.9C38.6 31.85 31.85 32.75 28.7 30.05Z"
        fill={P.green}
        {...line}
      />
      <path
        d="M26 34.55C22.4 31.4 9.8 32.3 9.8 45.35C9.8 55.7 17 62 22.4 61.1C24.2 60.65 27.8 60.65 29.6 61.1C35 62 42.2 55.7 42.2 45.35C42.2 32.3 29.6 31.4 26 34.55Z"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="16.55"
        cy="43.1"
        rx="1.58"
        ry="3.15"
        transform="rotate(12 16.55 43.1)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
      <path
        d="M55.8 62C58 46.6 73.4 34.5 89.9 36.7L92.1 44.4C78.9 45.5 70.1 52.1 70.1 62Z"
        fill={P.yellow}
        {...line}
      />
      <circle cx="89.9" cy="40" r="2.2" fill={P.brown} />
      <path d="M6 54 H46 L42 90 H10 Z" fill={P.wood} {...line} />
      <circle cx="26" cy="72" r="8" fill={P.red} {...line} />
      <path d="M54 54 H94 L90 90 H58 Z" fill={P.wood} {...line} />
      <circle cx="74" cy="72" r="8" fill={P.yellow} {...line} />
    </g>
  ),
};
