import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

const TAIL = 'M22 50 C10 46 8 34 16 26';

export const dog: IllustDef = {
  id: 'dog',
  label: 'いぬ',
  status: 'final',
  draw: () => (
    <g>
      {/* しっぽ（ふっている） */}
      <path d={TAIL} fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" />
      <path d={TAIL} fill="none" stroke={P.tan} strokeWidth="6.5" strokeLinecap="round" />
      {/* おくの足 */}
      <rect x="32" y="62" width="12" height="30" rx="6" fill={P.tan} {...line} />
      <rect x="62" y="62" width="12" height="30" rx="6" fill={P.tan} {...line} />
      {/* からだ（四つ足で立つ） */}
      <ellipse cx="44" cy="56" rx="30" ry="17" fill={P.tan} {...line} />
      {/* てまえの足 */}
      <rect x="22" y="64" width="13" height="28" rx="6.5" fill={P.tan} {...line} />
      <rect x="55" y="64" width="13" height="28" rx="6.5" fill={P.tan} {...line} />
      {/* おくの耳 */}
      <ellipse
        cx="78"
        cy="22"
        rx="5.5"
        ry="8"
        transform="rotate(20 78 22)"
        fill={P.brown}
        {...line}
      />
      {/* あたま・ながい鼻先 */}
      <ellipse cx="70" cy="36" rx="15" ry="13" fill={P.tan} {...line} />
      <ellipse cx="85" cy="42" rx="11" ry="7.5" fill={P.cream} {...line} />
      <ellipse cx="94" cy="39" rx="3.5" ry="2.8" fill={INK} stroke={INK} strokeWidth="1" />
      {/* たれ耳 */}
      <ellipse
        cx="62"
        cy="38"
        rx="7.5"
        ry="14"
        transform="rotate(10 62 38)"
        fill={P.brown}
        {...line}
      />
      {/* 顔 */}
      <circle cx="75" cy="32" r="2.6" fill={INK} />
      <ellipse cx="73" cy="45" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
      <path d="M81 48 Q86 52 91 47" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
