import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const elephant: IllustDef = {
  id: 'elephant',
  label: 'ぞう',
  status: 'final',
  draw: () => (
    <g>
      {/* しっぽ */}
      <path d="M12 58 C6 64 6 72 8 78" fill="none" {...line} />
      {/* 奥のあし */}
      <rect x="30" y="66" width="14" height="26" rx="6" fill={P.gray} {...line} />
      <rect x="56" y="66" width="14" height="26" rx="6" fill={P.gray} {...line} />
      {/* からだ */}
      <ellipse cx="40" cy="56" rx="30" ry="23" fill={P.gray} {...line} />
      {/* 手前のあし */}
      <rect x="18" y="66" width="15" height="26" rx="6.5" fill={P.gray} {...line} />
      <rect x="44" y="68" width="15" height="24" rx="6.5" fill={P.gray} {...line} />
      {/* あたま */}
      <circle cx="72" cy="40" r="17" fill={P.gray} {...line} />
      {/* はな */}
      <path
        d="M84 48 C94 54 94 70 86 76"
        fill="none"
        stroke={INK}
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M84 48 C94 54 94 70 86 76"
        fill="none"
        stroke={P.gray}
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* 大きな耳 */}
      <ellipse
        cx="60"
        cy="44"
        rx="13"
        ry="18"
        transform="rotate(10 60 44)"
        fill={P.gray}
        {...line}
      />
      <ellipse cx="60" cy="45" rx="6" ry="11" transform="rotate(10 60 45)" fill={P.pink} />
      {/* 顔 */}
      <circle cx="78" cy="35" r="2.6" fill={INK} />
      <ellipse cx="72" cy="50" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
    </g>
  ),
};
