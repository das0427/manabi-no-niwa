/**
 * p5（5歳）の教材で使う絵。画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・palette の色だけ・文字なし）。
 * はんこ用に描いた絵（stamps/）は ILLUST に入っていないため、同じ絵を p5- の id で使えるようにする。
 */
import { HIGHLIGHT, INK, line, type IllustDef, type IllustGroup } from '../types';
import { P } from '../palette';
import { book, clock } from '../stamps/life';
import { moon, sun } from '../stamps/nature';
import { rocket, truck } from '../stamps/vehicle';
import { ribbon } from '../stamps/decor';

const reuse = (def: IllustDef, id: string, label: string): IllustDef => ({ ...def, id, label });

const box: IllustDef = {
  id: 'p5-box',
  label: 'はこ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M14 36 L50 22 L86 36 L50 50 Z" fill={P.tan} {...line} />
      <path d="M14 36 L50 50 L50 90 L14 76 Z" fill={P.wood} {...line} />
      <path d="M86 36 L50 50 L50 90 L86 76 Z" fill={P.brown} {...line} />
    </g>
  ),
};

const can: IllustDef = {
  id: 'p5-can',
  label: 'つつ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M22 22 L22 80 C22 92 78 92 78 80 L78 22" fill={P.sky} {...line} />
      <ellipse cx="50" cy="22" rx="28" ry="10" fill={P.white} {...line} />
      <rect x="30" y="40" width="6" height="34" rx="3" fill={HIGHLIGHT} opacity="0.7" />
    </g>
  ),
};

const cake: IllustDef = {
  id: 'p5-cake',
  label: 'ケーキ',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M50 10 C46 16 46 20 50 22 C54 20 54 16 50 10 Z"
        fill={P.orange}
        {...line}
        strokeWidth="2.5"
      />
      <rect x="47" y="22" width="6" height="16" fill={P.pink} {...line} strokeWidth="2.5" />
      <rect x="14" y="38" width="72" height="50" rx="6" fill={P.cream} {...line} />
      <path
        d="M14 52 C24 60 32 46 42 54 C52 62 60 46 70 54 C78 60 84 52 86 50"
        fill="none"
        {...line}
      />
      <circle cx="30" cy="44" r="5" fill={P.red} {...line} strokeWidth="2.5" />
      <circle cx="70" cy="44" r="5" fill={P.red} {...line} strokeWidth="2.5" />
    </g>
  ),
};

const icecream: IllustDef = {
  id: 'p5-icecream',
  label: 'アイス',
  status: 'final',
  draw: () => (
    <g>
      <path d="M30 46 L50 94 L70 46 Z" fill={P.tan} {...line} />
      <path d="M36 56 L64 56 M40 66 L60 66" fill="none" {...line} strokeWidth="2.5" />
      <circle cx="50" cy="34" r="22" fill={P.pink} {...line} />
      <ellipse cx="42" cy="26" rx="5" ry="3" fill={HIGHLIGHT} opacity="0.8" />
    </g>
  ),
};

const tv: IllustDef = {
  id: 'p5-tv',
  label: 'テレビ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M36 18 L50 30 L64 14" fill="none" {...line} />
      <rect x="10" y="30" width="80" height="54" rx="8" fill={P.gray} {...line} />
      <rect x="18" y="38" width="56" height="38" rx="4" fill={P.sky} {...line} strokeWidth="2.5" />
      <circle cx="82" cy="46" r="3" fill={INK} />
      <circle cx="82" cy="58" r="3" fill={INK} />
      <path d="M28 84 L24 92 M72 84 L76 92" fill="none" {...line} />
    </g>
  ),
};

export const p5Illust: IllustGroup = {
  'p5-box': box,
  'p5-can': can,
  'p5-cake': cake,
  'p5-icecream': icecream,
  'p5-tv': tv,
  'p5-clock': reuse(clock, 'p5-clock', 'とけい'),
  'p5-book': reuse(book, 'p5-book', 'えほん'),
  'p5-truck': reuse(truck, 'p5-truck', 'トラック'),
  'p5-rocket': reuse(rocket, 'p5-rocket', 'ロケット'),
  'p5-ribbon': reuse(ribbon, 'p5-ribbon', 'リボン'),
  'p5-sun': reuse(sun, 'p5-sun', 'おひさま'),
  'p5-moon': reuse(moon, 'p5-moon', 'つき'),
};
