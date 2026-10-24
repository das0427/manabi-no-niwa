import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const bread: IllustDef = {
  id: 'bread',
  label: 'パン',
  status: 'final',
  draw: () => (
    <g>
      {/* 耳 */}
      <path
        d="M24 86 C17 86 14 81 14 76 L14 52 C6 48 6 26 26 24 C34 14 66 14 74 24 C94 26 94 48 86 52 L86 76 C86 81 83 86 76 86 Z"
        fill={P.brown}
        {...line}
      />
      {/* 中身 */}
      <path
        d="M28 77 C25 77 23 75 23 72 L23 48 C17 44 17 33 30 31 C38 25 62 25 70 31 C83 33 83 44 77 48 L77 72 C77 75 75 77 72 77 Z"
        fill={P.cream}
      />
      <circle cx="40" cy="48" r="2" fill={P.tan} />
      <circle cx="58" cy="42" r="2" fill={P.tan} />
      <circle cx="50" cy="62" r="2" fill={P.tan} />
      <circle cx="64" cy="64" r="2" fill={P.tan} />
      <circle cx="35" cy="66" r="2" fill={P.tan} />
    </g>
  ),
};
