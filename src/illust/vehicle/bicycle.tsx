import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

const FRAME = 'M24 68 L38 40 L62 40 L76 68 M38 40 L48 68 L62 40 M24 68 L48 68';

export const bicycle: IllustDef = {
  id: 'bicycle',
  label: 'じてんしゃ',
  status: 'final',
  draw: () => (
    <g transform="translate(0 -2)">
      {/* 車輪 */}
      <circle cx="24" cy="68" r="17" fill={P.white} fillOpacity="0.6" {...line} strokeWidth="4.5" />
      <circle cx="76" cy="68" r="17" fill={P.white} fillOpacity="0.6" {...line} strokeWidth="4.5" />
      {/* フレーム */}
      <path
        d={FRAME}
        fill="none"
        stroke={INK}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={FRAME}
        fill="none"
        stroke={P.red}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* ハンドル */}
      <path d="M62 40 L60 28 L70 28" fill="none" {...line} />
      {/* サドル */}
      <path d="M38 40 L38 34" fill="none" {...line} />
      <rect x="29" y="29" width="18" height="7" rx="3.5" fill={INK} stroke={INK} strokeWidth="2" />
      {/* ハブ・ペダル */}
      <circle cx="24" cy="68" r="3.5" fill={P.gray} {...line} strokeWidth="2.5" />
      <circle cx="76" cy="68" r="3.5" fill={P.gray} {...line} strokeWidth="2.5" />
      <circle cx="48" cy="68" r="5" fill={P.gray} {...line} strokeWidth="2.5" />
    </g>
  ),
};
