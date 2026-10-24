import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const register: IllustDef = {
  id: 'register',
  label: 'これで おねがいします',
  status: 'final',
  draw: () => (
    <g>
      <rect x="32" y="8" width="38" height="22" rx="4" fill={P.sky} {...line} />
      <path d="M22 62 L30 28 H72 L80 62 Z" fill={P.gray} {...line} />
      <circle cx="42" cy="44" r="3" fill={INK} />
      <circle cx="51" cy="44" r="3" fill={INK} />
      <circle cx="60" cy="44" r="3" fill={INK} />
      <rect x="6" y="58" width="88" height="34" rx="5" fill={P.wood} {...line} />
      <path d="M6 72 H94" fill="none" {...line} />
    </g>
  ),
};
