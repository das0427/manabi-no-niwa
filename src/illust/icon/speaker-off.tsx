import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const speakerOff: IllustDef = {
  id: 'speaker-off',
  label: 'おとが でない',
  status: 'final',
  draw: () => (
    <g>
      <path d="M8 36 L26 36 L46 18 L46 82 L26 64 L8 64 Z" fill={P.gray} {...line} />
      <path d="M62 38 L84 62" fill="none" stroke={P.gray} strokeWidth="7" strokeLinecap="round" />
    </g>
  ),
};
