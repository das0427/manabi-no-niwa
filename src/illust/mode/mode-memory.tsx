import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const modeMemory: IllustDef = {
  id: 'mode-memory',
  label: 'おぼえて さがす',
  status: 'final',
  draw: () => (
    <g>
      <g transform="rotate(-8 22 58)">
        <rect x="7" y="35" width="30" height="46" rx="5" fill={P.sky} {...line} />
        <circle cx="22" cy="58" r="6" fill={P.white} />
      </g>
      <g transform="rotate(0 50 48)">
        <rect x="35" y="25" width="30" height="46" rx="5" fill={P.sky} {...line} />
        <circle cx="50" cy="48" r="6" fill={P.white} />
      </g>
      <g transform="rotate(8 78 58)">
        <rect x="63" y="35" width="30" height="46" rx="5" fill={P.white} {...line} />
        <path
          d="M78 47L80.82 54.12L88.46 54.6L82.57 59.48L84.47 66.9L78 62.8L71.53 66.9L73.43 59.48L67.54 54.6L75.18 54.12Z"
          fill={P.sun}
          {...line}
        />
      </g>
    </g>
  ),
};
