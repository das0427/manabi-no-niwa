import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const greenPepper: IllustDef = {
  id: 'green-pepper',
  label: 'ピーマン',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M24 36 C24 28 36 26 50 30 C64 26 76 28 76 36 C82 54 80 70 71 82 C67 90 58 88 56 82 C54 91 46 91 44 82 C42 88 33 90 29 82 C20 70 18 54 24 36 Z"
        fill={P.green}
        {...line}
      />
      {/* へた */}
      <path d="M50 32 L52 14" fill="none" {...line} strokeWidth="7" />
      <path
        d="M50 32 L52 14"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        stroke={P.greenDark}
      />
      <ellipse cx="50" cy="31" rx="14" ry="5" fill={P.greenDark} {...line} />
      <ellipse
        cx="31"
        cy="54"
        rx="3"
        ry="8"
        transform="rotate(8 31 54)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
