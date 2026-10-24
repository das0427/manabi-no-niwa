import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

const TAIL = 'M26 84 C6 88 4 66 12 54 C16 48 18 44 18 40';

export const fox: IllustDef = {
  id: 'fox',
  label: 'きつね',
  status: 'final',
  draw: () => (
    <g>
      {/* ふさふさのしっぽ */}
      <path d={TAIL} fill="none" stroke={INK} strokeWidth="17" strokeLinecap="round" />
      <path
        d="M26 84 C6 88 4 66 12 54"
        fill="none"
        stroke={P.orange}
        strokeWidth="10.5"
        strokeLinecap="round"
      />
      <path
        d="M12 54 C16 48 18 44 18 40"
        fill="none"
        stroke={P.white}
        strokeWidth="10.5"
        strokeLinecap="round"
      />
      {/* 奥の耳 */}
      <path d="M62 20 L70 2 L80 24 Z" fill={P.orange} {...line} />
      {/* からだ（すわり） */}
      <path
        d="M46 48 C32 54 22 70 24 84 C25 91 30 92 36 92 L70 92 C72 76 70 60 62 48 Z"
        fill={P.orange}
        {...line}
      />
      <ellipse cx="36" cy="79" rx="13" ry="12" fill={P.orange} {...line} />
      <ellipse cx="42" cy="90" rx="11" ry="4.5" fill={P.orange} {...line} />
      <ellipse cx="60" cy="70" rx="7" ry="14" fill={P.white} />
      {/* まえあし */}
      <rect x="55" y="62" width="14" height="30" rx="7" fill={P.orange} {...line} />
      <path d="M55 84 L69 84" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      {/* あたま */}
      <path
        d="M40 32 C40 16 58 14 68 20 L92 40 C86 48 74 50 64 50 C50 52 40 46 40 32 Z"
        fill={P.orange}
        {...line}
      />
      {/* 白い口元 */}
      <path d="M62 49 C68 42 80 42 91 41 C86 48 74 52 62 49 Z" fill={P.white} {...line} />
      {/* 手前の耳 */}
      <path d="M42 26 L42 4 L60 17 Z" fill={P.orange} {...line} />
      <path d="M46 20 L46 11 L54 17 Z" fill={P.brown} />
      {/* 顔 */}
      <ellipse cx="92" cy="40" rx="3.4" ry="2.8" fill={INK} stroke={INK} strokeWidth="1" />
      <circle cx="66" cy="31" r="2.6" fill={INK} />
      <ellipse cx="59" cy="42" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
      <path d="M74 48 Q79 50 83 46" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
