import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const picture: IllustDef = {
  id: 'picture',
  label: 'えで みる',
  status: 'final',
  draw: () => (
    <g>
      <rect x="8" y="10" width="84" height="80" rx="7" fill={P.wood} {...line} />
      <rect x="19" y="21" width="62" height="58" rx="3" fill={P.cream} {...line} />
      <path
        d="M48.2 37.9C48.2 33.1 49.4 28.9 51.8 25.3L54.8 26.5C53.6 30.1 53 33.7 53 37.9Z"
        fill={P.brown}
        {...line}
      />
      <path
        d="M53.6 30.1C57.2 22.9 66.8 22.3 70.4 25.9C66.8 32.5 57.8 33.7 53.6 30.1Z"
        fill={P.green}
        {...line}
      />
      <path
        d="M50 36.1C45.2 31.9 28.4 33.1 28.4 50.5C28.4 64.3 38 72.7 45.2 71.5C47.6 70.9 52.4 70.9 54.8 71.5C62 72.7 71.6 64.3 71.6 50.5C71.6 33.1 54.8 31.9 50 36.1Z"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="37.4"
        cy="47.5"
        rx="2.1"
        ry="4.2"
        transform="rotate(12 37.4 47.5)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
