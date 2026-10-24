import { HIGHLIGHT, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const mathAdd: IllustDef = {
  id: 'math-add',
  label: 'たす',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M20.68 41.86C20.68 38.34 21.56 35.26 23.32 32.62L25.52 33.5C24.64 36.14 24.2 38.78 24.2 41.86Z"
        fill={P.brown}
        {...line}
      />
      <path
        d="M24.64 36.14C27.28 30.86 34.32 30.42 36.96 33.06C34.32 37.9 27.72 38.78 24.64 36.14Z"
        fill={P.green}
        {...line}
      />
      <path
        d="M22 40.54C18.48 37.46 6.16 38.34 6.16 51.1C6.16 61.22 13.2 67.38 18.48 66.5C20.24 66.06 23.76 66.06 25.52 66.5C30.8 67.38 37.84 61.22 37.84 51.1C37.84 38.34 25.52 37.46 22 40.54Z"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="12.76"
        cy="48.9"
        rx="1.54"
        ry="3.08"
        transform="rotate(12 12.76 48.9)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
      <path
        d="M76.68 41.86C76.68 38.34 77.56 35.26 79.32 32.62L81.52 33.5C80.64 36.14 80.2 38.78 80.2 41.86Z"
        fill={P.brown}
        {...line}
      />
      <path
        d="M80.64 36.14C83.28 30.86 90.32 30.42 92.96 33.06C90.32 37.9 83.72 38.78 80.64 36.14Z"
        fill={P.green}
        {...line}
      />
      <path
        d="M78 40.54C74.48 37.46 62.16 38.34 62.16 51.1C62.16 61.22 69.2 67.38 74.48 66.5C76.24 66.06 79.76 66.06 81.52 66.5C86.8 67.38 93.84 61.22 93.84 51.1C93.84 38.34 81.52 37.46 78 40.54Z"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="68.76"
        cy="48.9"
        rx="1.54"
        ry="3.08"
        transform="rotate(12 68.76 48.9)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
      <path
        d="M50 41V59M41 50H59"
        fill="none"
        stroke={INK}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ),
};
