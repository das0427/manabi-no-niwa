import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const roadFree: IllustDef = {
  id: 'road-free',
  label: 'じゆうに つくる',
  status: 'final',
  draw: () => (
    <g>
      <rect x="6" y="40" width="56" height="50" rx="5" fill={P.green} />
      <path
        d="M6 66 H34 Q47 66 47 78 V90"
        fill="none"
        stroke={INK}
        strokeWidth="25"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <path
        d="M6 66 H34 Q47 66 47 78 V90"
        fill="none"
        stroke={P.tan}
        strokeWidth="18"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <rect x="6" y="40" width="56" height="50" rx="5" fill="none" {...line} />
      <rect x="73" y="40" width="6" height="46" rx="3" fill={P.green} {...line} />
      <path d="M79 70 C86 62 92 64 93 68 C88 74 82 74 79 70 Z" fill={P.green} {...line} />
      <circle cx="76" cy="22" r="7" fill={P.pink} {...line} />
      <circle cx="85" cy="29" r="7" fill={P.pink} {...line} />
      <circle cx="82" cy="39" r="7" fill={P.pink} {...line} />
      <circle cx="70" cy="39" r="7" fill={P.pink} {...line} />
      <circle cx="67" cy="29" r="7" fill={P.pink} {...line} />
      <circle cx="76" cy="31" r="6" fill={P.yellow} {...line} />
    </g>
  ),
};
