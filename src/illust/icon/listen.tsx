import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const listen: IllustDef = {
  id: 'listen',
  label: 'もういちど きく',
  status: 'final',
  draw: () => (
    <g>
      {/* スピーカー */}
      <path d="M10 38 L26 38 L44 22 L44 78 L26 62 L10 62 Z" fill={P.sky} {...line} />
      {/* 音の波 */}
      <path d="M57 38 Q65 50 57 62" fill="none" {...line} />
      <path d="M67 28 Q81 50 67 72" fill="none" {...line} />
      <path d="M77 18 Q97 50 77 82" fill="none" {...line} />
    </g>
  ),
};
