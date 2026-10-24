import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const go: IllustDef = {
  id: 'go',
  label: 'しゅっぱつ',
  status: 'final',
  draw: () => (
    <g>
      <ellipse cx="26" cy="88" rx="18" ry="5" fill={P.tan} {...line} />
      <rect x="22" y="10" width="8" height="78" rx="4" fill={P.brown} {...line} />
      <path d="M30 14 H88 L75 33 L88 52 H30 Z" fill={P.leaf} {...line} />
    </g>
  ),
};
