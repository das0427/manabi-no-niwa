import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const monkey: IllustDef = {
  id: 'monkey',
  label: 'さる',
  status: 'final',
  draw: () => (
    <g>
      {/* ながいしっぽ */}
      <path
        d="M26 86 C4 92 0 62 14 46 C18 42 12 36 8 40"
        fill="none"
        stroke={INK}
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M26 86 C4 92 0 62 14 46 C18 42 12 36 8 40"
        fill="none"
        stroke={P.brown}
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      {/* 奥の耳 */}
      <circle cx="74" cy="20" r="7" fill={P.tan} {...line} />
      {/* からだ（すわり） */}
      <path
        d="M44 48 C30 54 20 70 22 84 C23 91 28 92 34 92 L70 92 C72 76 70 60 62 48 Z"
        fill={P.brown}
        {...line}
      />
      <ellipse cx="34" cy="78" rx="14" ry="12" fill={P.brown} {...line} />
      <ellipse cx="42" cy="90" rx="12" ry="4.5" fill={P.tan} {...line} />
      <ellipse cx="58" cy="72" rx="8" ry="13" fill={P.tan} />
      {/* まえあし */}
      <rect x="56" y="62" width="14" height="30" rx="7" fill={P.brown} {...line} />
      <ellipse cx="63" cy="90" rx="8" ry="4.5" fill={P.tan} {...line} />
      {/* あたま */}
      <ellipse cx="58" cy="32" rx="19" ry="17" fill={P.brown} {...line} />
      {/* 手前の耳 */}
      <circle cx="42" cy="34" r="8" fill={P.tan} {...line} />
      <circle cx="42" cy="34" r="3.5" fill={P.brown} />
      {/* 顔 */}
      <path
        d="M54 30 C54 24 64 22 68 28 C72 24 82 26 82 36 C82 46 72 50 64 48 C56 46 54 38 54 30 Z"
        fill={P.tan}
        {...line}
      />
      <circle cx="66" cy="33" r="2.6" fill={INK} />
      <circle cx="77" cy="33" r="2.6" fill={INK} />
      <ellipse cx="62" cy="43" rx="3.5" ry="2.5" fill={CHEEK} opacity="0.7" />
      <path d="M67 42 Q72 47 78 42" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
