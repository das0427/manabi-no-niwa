import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const turtle: IllustDef = {
  id: 'turtle',
  label: 'かめ',
  status: 'final',
  draw: () => (
    <g>
      {/* しっぽ */}
      <path d="M12 72 L4 76 L14 80 Z" fill={P.green} {...line} />
      {/* あし */}
      <rect x="20" y="64" width="18" height="20" rx="8" fill={P.green} {...line} />
      <rect x="56" y="64" width="18" height="20" rx="8" fill={P.green} {...line} />
      {/* くび・あたま */}
      <path
        d="M72 66 C74 52 76 50 84 50 C94 50 98 56 97 62 C96 70 88 72 82 72 Z"
        fill={P.green}
        {...line}
      />
      {/* こうら */}
      <path d="M12 72 C12 34 82 34 82 72 Z" fill={P.brown} {...line} />
      <path d="M12 72 L82 72" fill="none" {...line} />
      {/* 六角もよう */}
      <path
        d="M39 50 L55 50 L63 60 L55 70 L39 70 L31 60 Z M47 50 L47 42 M39 50 L26 46 M55 50 L68 46 M31 60 L16 62 M63 60 L78 62"
        fill="none"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 顔 */}
      <circle cx="88" cy="55" r="2.6" fill={INK} />
      <ellipse cx="84" cy="64" rx="3.5" ry="2.5" fill={CHEEK} opacity="0.7" />
      <path d="M89 63 Q92 66 95 62" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
