import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const pencil: IllustDef = {
  id: 'pencil',
  label: 'えんぴつ',
  status: 'final',
  draw: () => (
    <g transform="rotate(-45 50 50)">
      {/* けしごむ */}
      <path
        d="M84 38 L90 38 C95 38 97 42 97 50 C97 58 95 62 90 62 L84 62 Z"
        fill={P.pink}
        {...line}
      />
      {/* かなぐ */}
      <rect x="76" y="37" width="9" height="26" fill={P.gray} {...line} />
      {/* じく */}
      <path d="M28 37 L76 37 L76 63 L28 63 Z" fill={P.yellow} {...line} />
      <path d="M28 50 L76 50" fill="none" {...line} strokeWidth="2.5" stroke={P.orange} />
      {/* けずったところ */}
      <path d="M28 37 L9 50 L28 63 Z" fill={P.tan} {...line} />
      {/* しん */}
      <path d="M16 45.5 L9 50 L16 54.5 Z" fill={P.ink} />
      <ellipse cx="50" cy="42.5" rx="10" ry="1.8" fill={HIGHLIGHT} opacity="0.5" />
    </g>
  ),
};
