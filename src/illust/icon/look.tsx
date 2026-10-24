import { HIGHLIGHT, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const look: IllustDef = {
  id: 'look',
  label: 'もういちど みる',
  status: 'final',
  draw: () => (
    <g>
      <path d="M6 50 C22 22 78 22 94 50 C78 78 22 78 6 50 Z" fill={P.white} {...line} />
      <circle cx="50" cy="50" r="19" fill={P.blue} {...line} />
      <circle cx="50" cy="50" r="8" fill={INK} />
      <circle cx="44" cy="44" r="4" fill={HIGHLIGHT} />
    </g>
  ),
};
