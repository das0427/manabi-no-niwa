import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const frog: IllustDef = {
  id: 'frog',
  label: 'かえる',
  status: 'final',
  draw: () => (
    <g>
      {/* 頭の上の目のふくらみ（手前が大きい） */}
      <circle cx="78" cy="34" r="10" fill={P.green} {...line} />
      <circle cx="58" cy="32" r="13" fill={P.green} {...line} />
      {/* からだ（よこ向きにすわる） */}
      <ellipse cx="44" cy="68" rx="32" ry="22" fill={P.green} {...line} />
      <ellipse cx="66" cy="58" rx="25" ry="17" fill={P.green} {...line} />
      {/* あし */}
      <ellipse cx="62" cy="85" rx="7" ry="8" fill={P.green} {...line} />
      <ellipse cx="72" cy="91" rx="11" ry="4" fill={P.green} {...line} />
      <ellipse cx="24" cy="77" rx="15" ry="13" fill={P.green} {...line} />
      <ellipse cx="34" cy="91" rx="16" ry="4.5" fill={P.green} {...line} />
      {/* しろいおなか */}
      <ellipse cx="62" cy="72" rx="9" ry="5" fill={P.white} />
      {/* 大きな目 */}
      <circle cx="58" cy="32" r="8" fill={P.white} stroke={INK} strokeWidth="2.5" />
      <circle cx="61" cy="32" r="4" fill={INK} />
      <circle cx="78" cy="34" r="6.5" fill={P.white} stroke={INK} strokeWidth="2.5" />
      <circle cx="80.5" cy="34" r="3.2" fill={INK} />
      {/* 顔 */}
      <ellipse cx="70" cy="68" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
      <path d="M62 60 Q78 68 90 57" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
