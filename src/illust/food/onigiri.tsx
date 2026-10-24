import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const onigiri: IllustDef = {
  id: 'onigiri',
  label: 'おにぎり',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M50 12 C56 12 60 16 64 22 L88 70 C93 81 87 89 77 89 L23 89 C13 89 7 81 12 70 L36 22 C40 16 44 12 50 12 Z"
        fill={P.white}
        {...line}
      />
      {/* のり */}
      <path d="M37 64 L63 64 L63 89 L37 89 Z" fill={P.ink} {...line} />
      <ellipse cx="42" cy="40" rx="3" ry="7" transform="rotate(25 42 40)" fill={P.cream} />
    </g>
  ),
};
