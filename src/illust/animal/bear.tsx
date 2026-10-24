import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const bear: IllustDef = {
  id: 'bear',
  label: 'くま',
  status: 'final',
  draw: () => (
    <g>
      {/* しっぽ */}
      <circle cx="22" cy="84" r="6" fill={P.brown} {...line} />
      {/* 奥の耳 */}
      <circle cx="72" cy="17" r="8" fill={P.brown} {...line} />
      {/* からだ（すわり） */}
      <path
        d="M44 48 C28 54 18 70 20 84 C21 91 28 92 34 92 L72 92 C74 76 72 60 62 48 Z"
        fill={P.brown}
        {...line}
      />
      <ellipse cx="34" cy="78" rx="15" ry="13" fill={P.brown} {...line} />
      <ellipse cx="42" cy="90" rx="13" ry="4.5" fill={P.brown} {...line} />
      <ellipse cx="58" cy="72" rx="9" ry="14" fill={P.tan} />
      {/* まえあし */}
      <rect x="57" y="62" width="15" height="30" rx="7.5" fill={P.brown} {...line} />
      <path d="M64 82 L64 90" fill="none" {...line} strokeWidth="2.5" />
      {/* あたま */}
      <ellipse cx="58" cy="32" rx="20" ry="17" fill={P.brown} {...line} />
      {/* 手前の耳 */}
      <circle cx="42" cy="18" r="9" fill={P.brown} {...line} />
      <circle cx="42" cy="18" r="4" fill={P.tan} />
      {/* 明るい口元 */}
      <ellipse cx="76" cy="40" rx="12" ry="9.5" fill={P.tan} {...line} />
      <ellipse cx="83" cy="36" rx="4" ry="3" fill={INK} stroke={INK} strokeWidth="1" />
      <circle cx="66" cy="29" r="2.6" fill={INK} />
      <ellipse cx="62" cy="41" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
      <path d="M74 45 Q78 49 83 45" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
