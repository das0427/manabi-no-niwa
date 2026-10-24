import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const ant: IllustDef = {
  id: 'ant',
  label: 'あり',
  status: 'final',
  draw: () => (
    <g>
      {/* あし（6本） */}
      <path
        d="M46 54 L40 40 L34 32 M52 54 L52 38 L50 28 M58 54 L64 40 L70 34 M46 58 L40 72 L34 82 M52 58 L52 74 L50 84 M58 58 L64 72 L70 80"
        fill="none"
        {...line}
      />
      {/* しょっかく */}
      <path d="M84 44 C84 32 88 28 94 28 M90 46 C94 38 98 38 98 34" fill="none" {...line} />
      {/* つなぎ */}
      <path d="M36 57 L44 56 M60 55 L68 54" fill="none" {...line} />
      {/* おなか・むね・あたま */}
      <ellipse cx="24" cy="58" rx="15" ry="13" fill={INK} stroke={INK} strokeWidth="3.5" />
      <ellipse cx="52" cy="56" rx="9" ry="8" fill={INK} stroke={INK} strokeWidth="3.5" />
      <circle cx="80" cy="53" r="12" fill={INK} stroke={INK} strokeWidth="3.5" />
      {/* 顔 */}
      <circle cx="84" cy="50" r="3" fill={P.white} />
      <circle cx="85" cy="50" r="1.3" fill={INK} />
      <ellipse cx="76" cy="58" rx="3.5" ry="2.5" fill={CHEEK} opacity="0.7" />
      <path
        d="M80 60 Q84 63 88 59"
        fill="none"
        stroke={P.white}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  ),
};
