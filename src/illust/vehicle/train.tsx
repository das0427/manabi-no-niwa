import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const train: IllustDef = {
  id: 'train',
  label: 'でんしゃ',
  status: 'final',
  draw: () => (
    <g transform="translate(0 -2)">
      {/* パンタグラフ */}
      <path d="M38 28 L50 14 L62 28 M43 14 L57 14" fill="none" {...line} />
      {/* 車体 */}
      <rect x="6" y="28" width="88" height="44" rx="9" fill={P.white} {...line} />
      <rect x="9" y="52" width="82" height="9" fill={P.green} />
      <path d="M8 52 L92 52 M8 61 L92 61" fill="none" stroke={INK} strokeWidth="2" />
      {/* 窓・ドア */}
      <rect x="13" y="35" width="13" height="12" rx="2" fill={P.blue} {...line} />
      <rect x="30" y="35" width="13" height="12" rx="2" fill={P.blue} {...line} />
      <rect x="47" y="35" width="13" height="12" rx="2" fill={P.blue} {...line} />
      <path d="M70 34 L88 34 L88 48 L70 48 Z" fill={P.blue} {...line} />
      <circle cx="88" cy="66" r="2.5" fill={P.yellow} stroke={INK} strokeWidth="1.5" />
      {/* しゃりん */}
      <circle cx="24" cy="76" r="7" fill={INK} stroke={INK} strokeWidth="3.5" />
      <circle cx="24" cy="76" r="2.5" fill={P.gray} />
      <circle cx="76" cy="76" r="7" fill={INK} stroke={INK} strokeWidth="3.5" />
      <circle cx="76" cy="76" r="2.5" fill={P.gray} />
      <path d="M4 87 L96 87" fill="none" {...line} />
    </g>
  ),
};
