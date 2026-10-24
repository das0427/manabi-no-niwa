import { line, type IllustDef } from '../types';
import { P } from '../palette';

/** 道しるべ（「ほかの がくねん・きょうか」の入口）。向きの違う2枚の板で「ほかへ行ける」を表す */
export const explore: IllustDef = {
  id: 'explore',
  label: 'ほかの がくねん・きょうか',
  status: 'final',
  draw: () => (
    <g>
      <rect x="45" y="14" width="10" height="80" rx="3" fill={P.brown} {...line} />
      <path d="M50 20 H84 L94 31 L84 42 H50 Z" fill={P.sky} {...line} />
      <path d="M50 50 H16 L6 61 L16 72 H50 Z" fill={P.sun} {...line} />
      <path d="M36 94 H64" fill="none" {...line} />
    </g>
  ),
};
