import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

const TAIL = 'M32 88 C10 92 8 64 18 50 C22 42 20 30 24 20';

export const cat: IllustDef = {
  id: 'cat',
  label: 'ねこ',
  status: 'final',
  draw: () => (
    <g>
      {/* 上にたてた長いしっぽ */}
      <path d={TAIL} fill="none" stroke={INK} strokeWidth="11" strokeLinecap="round" />
      <path d={TAIL} fill="none" stroke={P.orange} strokeWidth="4.5" strokeLinecap="round" />
      {/* おくの耳 */}
      <path d="M52 26 L60 4 L70 24 Z" fill={P.orange} {...line} />
      {/* しなやかなからだ（背すじをのばしてすわる） */}
      <ellipse cx="48" cy="70" rx="17" ry="22" fill={P.orange} {...line} />
      <ellipse cx="38" cy="80" rx="13" ry="12" fill={P.orange} {...line} />
      <ellipse cx="48" cy="90" rx="14" ry="4.5" fill={P.orange} {...line} />
      {/* まえあし */}
      <rect x="53" y="62" width="11" height="30" rx="5.5" fill={P.orange} {...line} />
      {/* あたま */}
      <ellipse cx="56" cy="36" rx="18" ry="14" fill={P.orange} {...line} />
      {/* てまえの耳 */}
      <path d="M38 28 L40 6 L56 22 Z" fill={P.orange} {...line} />
      <path d="M42 22 L43 12 L50 19 Z" fill={P.pink} />
      {/* ひたいのもよう */}
      <path
        d="M60 24 L60 29 M66 25 L66 30"
        fill="none"
        stroke={P.brown}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* ひげ */}
      <path
        d="M74 41 L93 36 M74 43 L95 43 M74 45 L92 50 M40 41 L24 37 M40 43 L22 43"
        fill="none"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 顔 */}
      <circle cx="63" cy="34" r="2.6" fill={INK} />
      <path
        d="M70 38 L76 38 L73 42 Z"
        fill={P.pink}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <ellipse cx="55" cy="44" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
      <path d="M66 46 Q70 49 75 45" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
