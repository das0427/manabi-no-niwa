import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const dog: IllustDef = {
  id: 'dog',
  label: 'いぬ',
  status: 'final',
  draw: () => (
    <g>
      {/* しっぽ */}
      <path
        d="M26 82 C10 84 8 66 14 56"
        fill="none"
        stroke={INK}
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M26 82 C10 84 8 66 14 56"
        fill="none"
        stroke={P.tan}
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      {/* 奥の耳 */}
      <ellipse
        cx="70"
        cy="17"
        rx="6.5"
        ry="9"
        transform="rotate(25 70 17)"
        fill={P.brown}
        {...line}
      />
      {/* からだ（すわり） */}
      <path
        d="M44 48 C28 54 18 70 20 84 C21 91 28 92 34 92 L72 92 C74 76 72 60 62 48 Z"
        fill={P.tan}
        {...line}
      />
      {/* うしろあし */}
      <ellipse cx="34" cy="78" rx="15" ry="13" fill={P.tan} {...line} />
      <ellipse cx="42" cy="90" rx="13" ry="4.5" fill={P.tan} {...line} />
      {/* まえあし */}
      <rect x="57" y="62" width="15" height="30" rx="7.5" fill={P.tan} {...line} />
      <path d="M64 82 L64 90" fill="none" {...line} strokeWidth="2.5" />
      {/* あたま */}
      <ellipse cx="58" cy="32" rx="19" ry="17" fill={P.tan} {...line} />
      <ellipse cx="78" cy="40" rx="11" ry="8.5" fill={P.cream} {...line} />
      {/* 手前の耳（たれ耳） */}
      <ellipse
        cx="44"
        cy="32"
        rx="9"
        ry="15"
        transform="rotate(14 44 32)"
        fill={P.brown}
        {...line}
      />
      {/* 顔 */}
      <ellipse cx="86" cy="36" rx="3.8" ry="3" fill={INK} stroke={INK} strokeWidth="1" />
      <circle cx="67" cy="29" r="2.6" fill={INK} />
      <ellipse cx="64" cy="40" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
      <path d="M76 45 Q80 49 85 45" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
