/**
 * はんこ用に足した「かざり」の絵（DESINGN.md 6章・20章の画風）。文字・数字は描かない。
 */
import { HIGHLIGHT, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

function starPoints(cx: number, cy: number, R: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? R : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(' ');
}
const STAR = starPoints(50, 54, 44, 19);

export const star: IllustDef = {
  id: 'star',
  label: 'ほし',
  status: 'final',
  draw: () => (
    <g>
      <polygon points={STAR} fill={P.yellow} {...line} />
      <ellipse
        cx="42"
        cy="44"
        rx="3"
        ry="6"
        transform="rotate(35 42 44)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};

export const ribbon: IllustDef = {
  id: 'ribbon',
  label: 'りぼん',
  status: 'final',
  draw: () => (
    <g>
      <path d="M46 52 L30 86 L40 82 L46 90 L52 56 Z" fill={P.pink} {...line} />
      <path d="M54 52 L70 86 L60 82 L54 90 L48 56 Z" fill={P.pink} {...line} />
      <path d="M50 48 C36 26 8 24 8 46 C8 68 36 66 50 52 Z" fill={P.pink} {...line} />
      <path d="M50 48 C64 26 92 24 92 46 C92 68 64 66 50 52 Z" fill={P.pink} {...line} />
      <rect x="42" y="40" width="16" height="20" rx="5" fill={P.red} {...line} />
    </g>
  ),
};

export const crown: IllustDef = {
  id: 'crown',
  label: 'おうかん',
  status: 'final',
  draw: () => (
    <g>
      <path d="M12 76 L16 28 L34 50 L50 18 L66 50 L84 28 L88 76 Z" fill={P.yellow} {...line} />
      <rect x="12" y="70" width="76" height="14" rx="3" fill={P.orange} {...line} />
      <circle cx="30" cy="77" r="4" fill={P.red} {...line} strokeWidth="2" />
      <circle cx="50" cy="77" r="4" fill={P.blue} {...line} strokeWidth="2" />
      <circle cx="70" cy="77" r="4" fill={P.green} {...line} strokeWidth="2" />
      <circle cx="50" cy="18" r="5" fill={P.red} {...line} strokeWidth="2.5" />
    </g>
  ),
};

export const musicNote: IllustDef = {
  id: 'music-note',
  label: 'おんぷ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M58 14 C66 26 84 28 82 46 C78 36 68 34 62 32 Z" fill={P.purple} {...line} />
      <rect x="55" y="12" width="7" height="62" rx="3" fill={P.purple} {...line} />
      <ellipse
        cx="45"
        cy="76"
        rx="17"
        ry="12"
        transform="rotate(-20 45 76)"
        fill={P.purple}
        {...line}
      />
      <ellipse
        cx="38"
        cy="73"
        rx="3"
        ry="5"
        transform="rotate(50 38 73)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};

export const balloon: IllustDef = {
  id: 'balloon',
  label: 'ふうせん',
  status: 'final',
  draw: () => (
    <g>
      <path d="M50 70 C44 78 58 84 50 94" fill="none" stroke={INK} strokeWidth="2.5" />
      <path d="M45 72 L55 72 L50 64 Z" fill={P.red} {...line} strokeWidth="2.5" />
      <ellipse cx="50" cy="38" rx="26" ry="31" fill={P.red} {...line} />
      <ellipse
        cx="39"
        cy="26"
        rx="4"
        ry="8"
        transform="rotate(30 39 26)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};

export const sparkle: IllustDef = {
  id: 'sparkle',
  label: 'きらきら',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M42 12 Q46 44 76 48 Q46 52 42 86 Q38 52 8 48 Q38 44 42 12 Z"
        fill={P.yellow}
        {...line}
      />
      <path
        d="M78 10 Q80 24 92 26 Q80 28 78 42 Q76 28 64 26 Q76 24 78 10 Z"
        fill={P.sun}
        {...line}
        strokeWidth="2.5"
      />
      <path
        d="M78 62 Q79 72 88 74 Q79 76 78 86 Q77 76 68 74 Q77 72 78 62 Z"
        fill={P.sun}
        {...line}
        strokeWidth="2.5"
      />
    </g>
  ),
};
