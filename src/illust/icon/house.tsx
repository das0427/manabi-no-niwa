import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const house: IllustDef = {
  id: 'house',
  label: 'いえ',
  status: 'final',
  draw: () => (
    <g>
      <rect x="66" y="14" width="12" height="22" rx="2" fill={P.brown} {...line} />
      <rect x="16" y="46" width="68" height="44" rx="3" fill={P.cream} {...line} />
      <path d="M50 8 L94 48 L6 48 Z" fill={P.red} {...line} />
      <path d="M56 90 V70 Q56 60 64 60 Q72 60 72 70 V90 Z" fill={P.wood} {...line} />
      <rect x="23" y="58" width="24" height="20" rx="2" fill={P.sky} {...line} />
      <path d="M35 58 V78 M23 68 H47" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
