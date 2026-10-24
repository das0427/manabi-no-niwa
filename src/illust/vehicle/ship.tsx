import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const ship: IllustDef = {
  id: 'ship',
  label: 'ふね',
  status: 'final',
  draw: () => (
    <g transform="translate(0 -2)">
      {/* えんとつ */}
      <rect x="46" y="12" width="14" height="22" rx="2" fill={P.red} {...line} />
      <rect x="46" y="18" width="14" height="6" fill={P.yellow} {...line} strokeWidth="2.5" />
      {/* 船室 */}
      <rect x="38" y="30" width="30" height="14" rx="3" fill={P.white} {...line} />
      <rect x="22" y="44" width="58" height="16" rx="3" fill={P.white} {...line} />
      <circle cx="34" cy="52" r="3.5" fill={P.blue} {...line} strokeWidth="2.5" />
      <circle cx="51" cy="52" r="3.5" fill={P.blue} {...line} strokeWidth="2.5" />
      <circle cx="68" cy="52" r="3.5" fill={P.blue} {...line} strokeWidth="2.5" />
      {/* 船体 */}
      <path d="M6 60 L94 60 C92 74 86 82 76 82 L24 82 C14 82 8 74 6 60 Z" fill={P.red} {...line} />
      {/* 波 */}
      <path
        d="M4 88 Q12 80 20 88 T36 88 T52 88 T68 88 T84 88 T98 88"
        fill="none"
        {...line}
        stroke={P.blue}
      />
    </g>
  ),
};
