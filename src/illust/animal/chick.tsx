import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const chick: IllustDef = {
  id: 'chick',
  label: 'ひよこ',
  status: 'final',
  draw: () => (
    <g>
      {/* あし */}
      <path
        d="M40 82 L40 91 M36 92 L45 92 M58 82 L58 91 M54 92 L63 92"
        fill="none"
        stroke={P.orange}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* おしり */}
      <path d="M18 62 L6 58 L16 72 Z" fill={P.yellow} {...line} />
      {/* まるいからだ */}
      <ellipse cx="50" cy="56" rx="35" ry="32" fill={P.yellow} {...line} />
      {/* あたまの毛 */}
      <path d="M50 25 C48 16 50 12 54 10 M56 25 C58 17 62 14 66 14" fill="none" {...line} />
      {/* つばさ */}
      <path d="M24 56 C28 48 44 50 48 62 C42 72 28 70 24 56 Z" fill={P.yellow} {...line} />
      {/* くちばし */}
      <path d="M82 46 L96 52 L82 58 Z" fill={P.orange} {...line} />
      {/* 顔 */}
      <circle cx="68" cy="45" r="2.6" fill={INK} />
      <ellipse cx="66" cy="57" rx="5" ry="3.2" fill={CHEEK} opacity="0.7" />
    </g>
  ),
};
