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
      {/* おなか側 */}
      <path d="M14 56 L2 46 L8 66 Z" fill={P.blue} {...line} />
      {/* からだ */}
      <ellipse cx="48" cy="58" rx="32" ry="22" fill={P.blue} {...line} />
      <ellipse cx="58" cy="66" rx="16" ry="11" fill={P.cream} />
      {/* あたま */}
      <circle cx="66" cy="36" r="17" fill={P.blue} {...line} />
      {/* くちばし */}
      <path d="M80 32 L95 38 L80 44 Z" fill={P.orange} {...line} />
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
      <circle cx="70" cy="33" r="2.6" fill={INK} />
      <ellipse cx="68" cy="43" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
    </g>
  ),
};
