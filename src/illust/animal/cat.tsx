import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const cat: IllustDef = {
  id: 'cat',
  label: 'ねこ',
  status: 'final',
  draw: () => (
    <g>
      {/* ながいしっぽ */}
      <path
        d="M28 84 C6 90 2 62 14 46"
        fill="none"
        stroke={INK}
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M28 84 C6 90 2 62 14 46"
        fill="none"
        stroke={P.orange}
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      {/* 奥の耳 */}
      <path d="M60 20 L70 4 L78 24 Z" fill={P.orange} {...line} />
      {/* からだ（すわり） */}
      <path
        d="M46 48 C32 54 22 70 24 84 C25 91 30 92 36 92 L70 92 C72 76 70 60 62 48 Z"
        fill={P.orange}
        {...line}
      />
      <ellipse cx="36" cy="79" rx="13" ry="12" fill={P.orange} {...line} />
      <ellipse cx="42" cy="90" rx="11" ry="4.5" fill={P.orange} {...line} />
      {/* まえあし */}
      <rect x="55" y="62" width="14" height="30" rx="7" fill={P.orange} {...line} />
      <path d="M62 82 L62 90" fill="none" {...line} strokeWidth="2.5" />
      {/* あたま */}
      <ellipse cx="60" cy="34" rx="20" ry="16" fill={P.orange} {...line} />
      {/* 手前の耳 */}
      <path d="M42 26 L44 5 L60 18 Z" fill={P.orange} {...line} />
      <path d="M46 20 L47 11 L54 17 Z" fill={P.pink} />
      {/* ひたいのもよう */}
      <path
        d="M58 20 L58 26 M64 20 L64 26 M52 22 L53 27"
        fill="none"
        stroke={P.brown}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* ひげ */}
      <path
        d="M78 42 L94 38 M78 44 L95 44 M78 46 L94 50 M42 42 L28 38 M42 44 L27 44 M42 46 L28 50"
        fill="none"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 顔 */}
      <circle cx="68" cy="32" r="2.6" fill={INK} />
      <path
        d="M76 38 L82 38 L79 42 Z"
        fill={P.pink}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <ellipse cx="62" cy="43" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
      <path d="M72 46 Q76 49 80 45" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
