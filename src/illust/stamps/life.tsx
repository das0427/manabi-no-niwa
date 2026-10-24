/**
 * はんこ用に足した「くらし」の絵（身の回りの物）。顔は付けない。文字盤の数字は描かない。
 */
import { HIGHLIGHT, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const hat: IllustDef = {
  id: 'hat',
  label: 'ぼうし',
  status: 'final',
  draw: () => (
    <g>
      <ellipse cx="50" cy="66" rx="44" ry="14" fill={P.tan} {...line} />
      <path d="M26 64 C26 30 74 30 74 64 Z" fill={P.tan} {...line} />
      <path d="M27 54 Q50 60 73 54 L74 63 Q50 69 26 63 Z" fill={P.red} {...line} />
    </g>
  ),
};

export const shoe: IllustDef = {
  id: 'shoe',
  label: 'くつ',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M14 72 L14 36 C14 32 18 30 22 30 L40 30 C44 30 46 34 46 38 C52 48 64 50 80 54 C90 56 94 62 94 72 Z"
        fill={P.red}
        {...line}
      />
      <path
        d="M10 70 L96 70 L96 78 C96 82 92 84 88 84 L14 84 C10 84 10 80 10 76 Z"
        fill={P.white}
        {...line}
      />
      <path d="M48 44 L58 40 M54 49 L64 45 M61 52 L70 48" fill="none" {...line} strokeWidth="2.5" />
      <ellipse cx="24" cy="44" rx="3" ry="6" fill={HIGHLIGHT} opacity="0.5" />
    </g>
  ),
};

export const book: IllustDef = {
  id: 'book',
  label: 'ほん',
  status: 'final',
  draw: () => (
    <g>
      <path d="M6 26 L50 32 L94 26 L94 80 L50 86 L6 80 Z" fill={P.green} {...line} />
      <path d="M10 20 Q32 18 50 28 L50 80 Q32 70 10 74 Z" fill={P.cream} {...line} />
      <path d="M90 20 Q68 18 50 28 L50 80 Q68 70 90 74 Z" fill={P.cream} {...line} />
      <path
        d="M18 34 Q30 32 42 38 M18 46 Q30 44 42 50 M58 38 Q70 32 82 34 M58 50 Q70 44 82 46"
        fill="none"
        stroke={P.gray}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </g>
  ),
};

export const clock: IllustDef = {
  id: 'clock',
  label: 'とけい',
  status: 'final',
  draw: () => (
    <g>
      <circle cx="50" cy="52" r="40" fill={P.red} {...line} />
      <circle cx="50" cy="52" r="31" fill={P.white} {...line} />
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return (
          <circle
            key={i}
            cx={(50 + Math.cos(a) * 25).toFixed(1)}
            cy={(52 + Math.sin(a) * 25).toFixed(1)}
            r="2.5"
            fill={INK}
          />
        );
      })}
      <path d="M50 52 L50 32 M50 52 L64 58" fill="none" {...line} strokeWidth="4" />
      <circle cx="50" cy="52" r="3" fill={INK} />
    </g>
  ),
};
