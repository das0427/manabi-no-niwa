import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const heartOn: IllustDef = {
  id: 'heart-on',
  label: 'すき（えらんだ）',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M50 88 C14 64 6 42 12 30 C19 15 40 16 50 33 C60 16 81 15 88 30 C94 42 86 64 50 88 Z"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="29"
        cy="36"
        rx="3.5"
        ry="6.5"
        transform="rotate(30 29 36)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
