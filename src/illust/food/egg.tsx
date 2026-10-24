import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const egg: IllustDef = {
  id: 'egg',
  label: 'たまご',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M50 10 C70 10 82 38 82 58 C82 78 68 92 50 92 C32 92 18 78 18 58 C18 38 30 10 50 10 Z"
        fill={P.cream}
        {...line}
      />
      <ellipse
        cx="35"
        cy="46"
        rx="3.5"
        ry="9"
        transform="rotate(18 35 46)"
        fill={HIGHLIGHT}
        opacity="0.8"
      />
    </g>
  ),
};
