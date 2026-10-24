import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const chick: IllustDef = {
  id: 'chick',
  label: 'ひよこ',
  status: 'final',
  draw: () => (
    <g>
      {/* あし（つま先は右） */}
      <path
        d="M42 82 L42 91 M42 92 L52 92 M58 82 L58 90 M58 91 L68 91"
        fill="none"
        stroke={P.orange}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 尾の羽 */}
      <path d="M18 56 L4 48 L8 60 L6 70 L20 70 Z" fill={P.yellow} {...line} />
      {/* まるいからだ（よこ向き） */}
      <ellipse cx="50" cy="56" rx="34" ry="30" fill={P.yellow} {...line} />
      {/* あたまの毛 */}
      <path d="M62 27 C60 18 62 13 68 11 M68 29 C70 21 74 18 79 18" fill="none" {...line} />
      {/* つばさ */}
      <path d="M22 58 C26 48 46 48 52 62 C46 74 28 74 22 58 Z" fill={P.yellow} {...line} />
      {/* くちばし */}
      <path d="M82 44 L97 51 L82 58 Z" fill={P.orange} {...line} />
      {/* 顔 */}
      <circle cx="70" cy="43" r="2.6" fill={INK} />
      <ellipse cx="66" cy="57" rx="5" ry="3.2" fill={CHEEK} opacity="0.7" />
    </g>
  ),
};
