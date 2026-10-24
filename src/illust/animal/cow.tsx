import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const cow: IllustDef = {
  id: 'cow',
  label: 'うし',
  status: 'final',
  draw: () => (
    <g>
      {/* しっぽ */}
      <path d="M12 46 C6 54 6 66 8 74" fill="none" {...line} />
      <ellipse cx="8" cy="76" rx="3.5" ry="5" fill={INK} stroke={INK} strokeWidth="1.5" />
      {/* あし */}
      <rect x="16" y="66" width="13" height="26" rx="5" fill={P.white} {...line} />
      <rect x="52" y="66" width="13" height="26" rx="5" fill={P.white} {...line} />
      <rect x="30" y="66" width="13" height="26" rx="5" fill={P.white} {...line} />
      {/* おっぱい */}
      <ellipse cx="38" cy="76" rx="6" ry="4" fill={P.pink} {...line} />
      {/* からだ */}
      <rect x="10" y="38" width="62" height="38" rx="17" fill={P.white} {...line} />
      <ellipse cx="26" cy="50" rx="9" ry="7" fill={INK} />
      <ellipse cx="52" cy="62" rx="8" ry="6" fill={INK} />
      {/* ひづめ */}
      <path d="M17 89 L28 89 M31 89 L42 89 M53 89 L64 89" fill="none" {...line} strokeWidth="2.5" />
      {/* つの */}
      <path d="M74 32 C72 24 74 20 78 20 C80 24 80 28 80 32 Z" fill={P.tan} {...line} />
      <path d="M86 34 C88 26 92 24 94 26 C94 30 92 33 90 36 Z" fill={P.tan} {...line} />
      {/* あたま */}
      <ellipse cx="80" cy="46" rx="15" ry="14" fill={P.white} {...line} />
      <ellipse cx="72" cy="38" rx="6" ry="5" fill={INK} />
      {/* 耳 */}
      <ellipse
        cx="65"
        cy="40"
        rx="8"
        ry="4"
        transform="rotate(-24 65 40)"
        fill={INK}
        stroke={INK}
        strokeWidth="1.5"
      />
      {/* 鼻先 */}
      <ellipse cx="88" cy="55" rx="9" ry="7" fill={P.pink} {...line} />
      <circle cx="85" cy="55" r="1.4" fill={INK} />
      <circle cx="91" cy="55" r="1.4" fill={INK} />
      {/* 顔 */}
      <circle cx="82" cy="43" r="2.6" fill={INK} />
      <ellipse cx="74" cy="52" rx="4" ry="3" fill={CHEEK} opacity="0.7" />
    </g>
  ),
};
