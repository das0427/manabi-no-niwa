import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const airplane: IllustDef = {
  id: 'airplane',
  label: 'ひこうき',
  status: 'final',
  draw: () => (
    <g transform="translate(0 -4)">
      {/* 尾翼 */}
      <path d="M12 50 L6 22 L26 22 L38 48 Z" fill={P.blue} {...line} />
      {/* 胴体 */}
      <ellipse cx="50" cy="54" rx="44" ry="13" fill={P.white} {...line} />
      {/* まど */}
      <circle cx="30" cy="52" r="3" fill={P.blue} {...line} strokeWidth="2" />
      <circle cx="42" cy="52" r="3" fill={P.blue} {...line} strokeWidth="2" />
      <circle cx="54" cy="52" r="3" fill={P.blue} {...line} strokeWidth="2" />
      <path d="M72 46 C78 45 84 46 88 50 L72 52 Z" fill={P.blue} {...line} strokeWidth="2.5" />
      {/* 主翼 */}
      <path d="M44 60 L26 86 L44 86 L68 60 Z" fill={P.blue} {...line} />
    </g>
  ),
};
