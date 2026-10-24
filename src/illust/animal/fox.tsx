import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

const TAIL = 'M30 60 C18 62 14 46 20 34 C22 30 26 26 30 22';

export const fox: IllustDef = {
  id: 'fox',
  label: 'きつね',
  status: 'final',
  draw: () => (
    <g>
      {/* ふさふさの大きなしっぽ */}
      <path d={TAIL} fill="none" stroke={INK} strokeWidth="24" strokeLinecap="round" />
      <path
        d="M30 60 C18 62 14 46 20 34"
        fill="none"
        stroke={P.orange}
        strokeWidth="17"
        strokeLinecap="round"
      />
      <path
        d="M20 34 C22 30 26 26 30 22"
        fill="none"
        stroke={P.white}
        strokeWidth="17"
        strokeLinecap="round"
      />
      {/* おくの足 */}
      <rect x="36" y="62" width="8" height="30" rx="4" fill={P.orange} {...line} />
      <rect x="62" y="62" width="8" height="30" rx="4" fill={P.orange} {...line} />
      {/* ほそいからだ */}
      <ellipse cx="48" cy="58" rx="26" ry="12" fill={P.orange} {...line} />
      <ellipse cx="68" cy="60" rx="7" ry="9" fill={P.white} />
      {/* てまえの足 */}
      <rect x="28" y="64" width="9" height="28" rx="4.5" fill={P.orange} {...line} />
      <rect x="54" y="64" width="9" height="28" rx="4.5" fill={P.orange} {...line} />
      <ellipse cx="32.5" cy="90" rx="5" ry="3" fill={INK} />
      <ellipse cx="58.5" cy="90" rx="5" ry="3" fill={INK} />
      {/* おくの耳 */}
      <path d="M72 24 L82 2 L88 28 Z" fill={P.orange} {...line} />
      {/* あたま */}
      <path
        d="M54 40 C54 24 68 20 76 24 L94 42 C88 50 78 52 68 52 C58 52 54 48 54 40 Z"
        fill={P.orange}
        {...line}
      />
      {/* 白い口元 */}
      <path d="M66 50 C72 44 82 43 93 42 C88 50 78 54 66 50 Z" fill={P.white} {...line} />
      {/* てまえの大きな耳 */}
      <path d="M54 32 L52 4 L72 22 Z" fill={P.orange} {...line} />
      <path d="M56 26 L55 13 L65 21 Z" fill={P.brown} />
      {/* 顔 */}
      <ellipse cx="93" cy="42" rx="3" ry="2.6" fill={INK} stroke={INK} strokeWidth="1" />
      <circle cx="72" cy="34" r="2.6" fill={INK} />
      <ellipse cx="63" cy="46" rx="4" ry="2.8" fill={CHEEK} opacity="0.7" />
      <path d="M76 50 Q81 52 85 48" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
