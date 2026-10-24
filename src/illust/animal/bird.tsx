import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const bird: IllustDef = {
  id: 'bird',
  label: 'とり',
  status: 'final',
  draw: () => (
    <g>
      {/* あし */}
      <path
        d="M44 76 L44 88 M42 90 L50 90 M58 76 L58 88 M56 90 L64 90"
        fill="none"
        stroke={P.orange}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 短い扇形の尾羽 */}
      <path d="M22 52 L6 46 Q3 54 6 58 Q4 64 8 68 L24 66 Z" fill={P.blue} {...line} />
      <path d="M10 52 L22 56 M10 62 L22 60" fill="none" {...line} strokeWidth="2" />
      {/* からだ */}
      <ellipse cx="48" cy="58" rx="30" ry="22" fill={P.blue} {...line} />
      <ellipse cx="58" cy="68" rx="15" ry="10" fill={P.cream} />
      {/* あたま */}
      <circle cx="64" cy="36" r="17" fill={P.blue} {...line} />
      {/* 大きなくちばし */}
      <path d="M78 27 L96 38 L78 49 Z" fill={P.orange} {...line} />
      {/* つばさ */}
      <path d="M22 54 C28 46 48 48 52 60 C46 70 28 68 22 54 Z" fill={P.blue} {...line} />
      <path
        d="M32 58 C36 56 42 57 46 60"
        fill="none"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 顔 */}
      <circle cx="68" cy="32" r="3.4" fill={INK} />
      <ellipse cx="64" cy="43" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
    </g>
  ),
};
