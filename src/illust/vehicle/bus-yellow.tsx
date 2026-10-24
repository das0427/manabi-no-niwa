import { HIGHLIGHT, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const busYellow: IllustDef = {
  id: 'bus-yellow',
  label: 'バス',
  status: 'final',
  draw: () => (
    <g transform="translate(0 -4)">
      {/* 車体 */}
      <rect x="6" y="22" width="88" height="48" rx="9" fill={P.yellow} {...line} />
      {/* 窓 */}
      <rect x="12" y="30" width="13" height="14" rx="2" fill={P.blue} {...line} />
      <rect x="29" y="30" width="13" height="14" rx="2" fill={P.blue} {...line} />
      <rect x="46" y="30" width="13" height="14" rx="2" fill={P.blue} {...line} />
      <rect x="63" y="30" width="13" height="14" rx="2" fill={P.blue} {...line} />
      <path d="M81 30 L88 30 L88 50 L81 50 Z" fill={P.blue} {...line} />
      {/* 帯・ライト */}
      <path d="M8 56 L92 56" fill="none" stroke={P.orange} strokeWidth="4" />
      <circle cx="90" cy="62" r="2.5" fill={HIGHLIGHT} stroke={INK} strokeWidth="1.5" />
      {/* タイヤ */}
      <circle cx="26" cy="72" r="11" fill={INK} stroke={INK} strokeWidth="3.5" />
      <circle cx="26" cy="72" r="4.5" fill={P.gray} />
      <circle cx="74" cy="72" r="11" fill={INK} stroke={INK} strokeWidth="3.5" />
      <circle cx="74" cy="72" r="4.5" fill={P.gray} />
    </g>
  ),
};
