import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const umbrella: IllustDef = {
  id: 'umbrella',
  label: 'かさ',
  status: 'final',
  draw: () => (
    <g>
      {/* え */}
      <path d="M50 50 L50 80 C50 92 36 92 36 80" fill="none" {...line} strokeWidth="9" />
      <path
        d="M50 50 L50 80 C50 92 36 92 36 80"
        fill="none"
        stroke={P.brown}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* さきっぽ */}
      <path d="M50 16 L50 8" fill="none" {...line} />
      {/* かさ */}
      <path
        d="M7 54 C7 30 27 15 50 15 C73 15 93 30 93 54 Q82 42 71.5 54 Q60 42 50 54 Q40 42 28.5 54 Q18 42 7 54 Z"
        fill={P.blue}
        {...line}
      />
      <path
        d="M50 16 L50 52 M50 16 Q34 30 28.5 52 M50 16 Q66 30 71.5 52"
        fill="none"
        {...line}
        strokeWidth="2"
      />
      <ellipse
        cx="26"
        cy="33"
        rx="3"
        ry="7"
        transform="rotate(45 26 33)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
