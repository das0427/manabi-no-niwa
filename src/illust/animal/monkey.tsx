import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

const TAIL = 'M28 84 C6 92 2 56 18 52 C26 50 26 40 18 40';
const ARM = 'M56 54 C70 60 76 72 72 84';

export const monkey: IllustDef = {
  id: 'monkey',
  label: 'さる',
  status: 'final',
  draw: () => (
    <g>
      {/* くるっと巻くしっぽ */}
      <path d={TAIL} fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
      <path d={TAIL} fill="none" stroke={P.brown} strokeWidth="4" strokeLinecap="round" />
      {/* おくの耳 */}
      <circle cx="75" cy="20" r="7" fill={P.tan} {...line} />
      {/* からだ（しゃがむ） */}
      <ellipse cx="46" cy="66" rx="19" ry="22" fill={P.brown} {...line} />
      <ellipse cx="52" cy="70" rx="10" ry="14" fill={P.tan} />
      <ellipse cx="36" cy="80" rx="12" ry="11" fill={P.brown} {...line} />
      <ellipse cx="44" cy="91" rx="13" ry="4.5" fill={P.tan} {...line} />
      {/* ほそくて長いうで */}
      <path d={ARM} fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d={ARM} fill="none" stroke={P.brown} strokeWidth="3" strokeLinecap="round" />
      <circle cx="72" cy="87" r="5" fill={P.tan} {...line} />
      {/* あたま */}
      <ellipse cx="58" cy="32" rx="19" ry="17" fill={P.brown} {...line} />
      {/* てまえの耳 */}
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
