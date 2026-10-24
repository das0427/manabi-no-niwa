import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const frog: IllustDef = {
  id: 'frog',
  label: 'かえる',
  status: 'final',
  draw: () => (
    <g>
      {/* 頭の上の目のふくらみ */}
      <circle cx="54" cy="34" r="13" fill={P.green} {...line} />
      <circle cx="78" cy="38" r="13" fill={P.green} {...line} />
      {/* あし */}
      <ellipse cx="62" cy="88" rx="13" ry="5" fill={P.green} {...line} />
      {/* からだ */}
      <ellipse cx="48" cy="68" rx="36" ry="23" fill={P.green} {...line} />
      <ellipse cx="22" cy="78" rx="15" ry="12" fill={P.green} {...line} />
      <ellipse cx="22" cy="90" rx="14" ry="4.5" fill={P.green} {...line} />
      {/* 白いおなか */}
      <ellipse cx="58" cy="77" rx="19" ry="11" fill={P.white} />
      {/* 大きな目 */}
      <circle cx="54" cy="34" r="8" fill={P.white} stroke={INK} strokeWidth="2.5" />
      <circle cx="57" cy="34" r="4" fill={INK} />
      <circle cx="78" cy="38" r="8" fill={P.white} stroke={INK} strokeWidth="2.5" />
      <circle cx="81" cy="38" r="4" fill={INK} />
      {/* 顔 */}
      <ellipse cx="86" cy="60" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
      <path d="M58 60 Q72 67 86 58" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
