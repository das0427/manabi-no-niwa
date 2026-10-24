/**
 * はんこ用に足した「のりもの」の絵。のりものは真横（ロケットは立てた姿）で、顔は付けない。
 */
import { HIGHLIGHT, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const rocket: IllustDef = {
  id: 'rocket',
  label: 'ロケット',
  status: 'final',
  draw: () => (
    <g>
      {/* ほのお */}
      <path d="M40 78 Q50 100 60 78 Z" fill={P.orange} {...line} />
      <path d="M45 78 Q50 90 55 78 Z" fill={P.yellow} />
      {/* はね */}
      <path d="M36 56 L20 76 L36 74 Z" fill={P.red} {...line} />
      <path d="M64 56 L80 76 L64 74 Z" fill={P.red} {...line} />
      {/* からだ */}
      <path d="M50 6 C66 18 68 46 64 78 L36 78 C32 46 34 18 50 6 Z" fill={P.white} {...line} />
      <path d="M50 6 C58 12 62 20 63 26 L37 26 C38 20 42 12 50 6 Z" fill={P.red} {...line} />
      {/* まど */}
      <circle cx="50" cy="44" r="8" fill={P.blue} {...line} />
      <ellipse cx="47" cy="41" rx="2" ry="3.5" fill={HIGHLIGHT} opacity="0.6" />
    </g>
  ),
};

export const truck: IllustDef = {
  id: 'truck',
  label: 'トラック',
  status: 'final',
  draw: () => (
    <g transform="translate(0 -4)">
      {/* にだい */}
      <rect x="6" y="26" width="56" height="42" rx="3" fill={P.cream} {...line} />
      {/* うんてんせき */}
      <path d="M62 38 L80 38 C83 38 85 40 86 42 L93 54 L93 68 L62 68 Z" fill={P.blue} {...line} />
      <path d="M68 43 L79 43 L85 54 L68 54 Z" fill={P.white} {...line} strokeWidth="2.5" />
      {/* タイヤ */}
      <circle cx="24" cy="72" r="10" fill={INK} stroke={INK} strokeWidth="3.5" />
      <circle cx="24" cy="72" r="4" fill={P.gray} />
      <circle cx="76" cy="72" r="10" fill={INK} stroke={INK} strokeWidth="3.5" />
      <circle cx="76" cy="72" r="4" fill={P.gray} />
    </g>
  ),
};
