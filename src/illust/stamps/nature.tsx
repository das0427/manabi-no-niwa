/**
 * はんこ用に足した「しぜん」の絵（DESINGN.md 6章・20章の画風）。
 * 背景のない単体の絵。輪郭 ink 3.5、平塗り、パレットの色だけ。顔は付けない（動物以外）。
 */
import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const p = (r: number, da: number) =>
    `${(50 + Math.cos(a + da) * r).toFixed(1)} ${(50 + Math.sin(a + da) * r).toFixed(1)}`;
  return `M${p(31, -0.2)} L${p(44, 0)} L${p(31, 0.2)} Z`;
});

export const sun: IllustDef = {
  id: 'sun',
  label: 'たいよう',
  status: 'final',
  draw: () => (
    <g>
      {RAYS.map((d) => (
        <path key={d} d={d} fill={P.orange} {...line} />
      ))}
      <circle cx="50" cy="50" r="25" fill={P.yellow} {...line} />
      <ellipse
        cx="41"
        cy="40"
        rx="3.5"
        ry="7"
        transform="rotate(40 41 40)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};

export const cloud: IllustDef = {
  id: 'cloud',
  label: 'くも',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M22 74 C9 74 7 56 20 53 C18 38 35 31 43 40 C47 25 70 24 73 41 C87 39 95 57 83 67 C81 74 77 74 73 74 Z"
        fill={P.white}
        {...line}
      />
      <path
        d="M26 66 Q50 72 76 66"
        fill="none"
        stroke={P.sky}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  ),
};

const BANDS = [P.red, P.orange, P.yellow, P.green, P.blue, P.purple];

export const rainbow: IllustDef = {
  id: 'rainbow',
  label: 'にじ',
  status: 'final',
  draw: () => (
    <g transform="translate(0 4)">
      {BANDS.map((c, i) => {
        const r = 41 - i * 5;
        return (
          <path
            key={c}
            d={`M${50 - r} 72 A${r} ${r} 0 0 1 ${50 + r} 72`}
            fill="none"
            stroke={c}
            strokeWidth="5.4"
          />
        );
      })}
      <path d="M6 72 A44 44 0 0 1 94 72" fill="none" {...line} />
      <path d="M19 72 A31 31 0 0 1 81 72" fill="none" {...line} />
      <ellipse cx="17" cy="74" rx="13" ry="8" fill={P.white} {...line} />
      <ellipse cx="83" cy="74" rx="13" ry="8" fill={P.white} {...line} />
    </g>
  ),
};

export const moon: IllustDef = {
  id: 'moon',
  label: 'おつきさま',
  status: 'final',
  draw: () => (
    <g>
      <path d="M66 6 A46 46 0 0 0 66 94 A100 100 0 0 1 66 6 Z" fill={P.yellow} {...line} />
      <ellipse
        cx="42"
        cy="34"
        rx="3"
        ry="7"
        transform="rotate(30 42 34)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};

export const mushroom: IllustDef = {
  id: 'mushroom',
  label: 'きのこ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M38 54 L62 54 L65 86 Q50 92 35 86 Z" fill={P.cream} {...line} />
      <path d="M10 58 C10 22 90 22 90 58 Z" fill={P.red} {...line} />
      <circle cx="32" cy="42" r="6" fill={P.white} />
      <circle cx="56" cy="34" r="5" fill={P.white} />
      <circle cx="72" cy="48" r="5.5" fill={P.white} />
    </g>
  ),
};

export const mountain: IllustDef = {
  id: 'mountain',
  label: 'やま',
  status: 'final',
  draw: () => (
    <g>
      <path d="M44 84 L70 34 L96 84 Z" fill={P.greenDark} {...line} />
      <path d="M4 84 L38 18 L72 84 Z" fill={P.green} {...line} />
      <path
        d="M27 39 L38 18 L49 39 L43 35 L38 41 L33 35 Z"
        fill={P.white}
        {...line}
        strokeWidth="2.5"
      />
    </g>
  ),
};
