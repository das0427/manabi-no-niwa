import { HIGHLIGHT, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const mathSub: IllustDef = {
  id: 'math-sub',
  label: 'ひく',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M25.74 24.28C25.74 20.92 26.58 17.98 28.26 15.46L30.36 16.3C29.52 18.82 29.1 21.34 29.1 24.28Z"
        fill={P.brown}
        {...line}
      />
      <path
        d="M29.52 18.82C32.04 13.78 38.76 13.36 41.28 15.88C38.76 20.5 32.46 21.34 29.52 18.82Z"
        fill={P.green}
        {...line}
      />
      <path
        d="M27 23.02C23.64 20.08 11.88 20.92 11.88 33.1C11.88 42.76 18.6 48.64 23.64 47.8C25.32 47.38 28.68 47.38 30.36 47.8C35.4 48.64 42.12 42.76 42.12 33.1C42.12 20.92 30.36 20.08 27 23.02Z"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="18.18"
        cy="31"
        rx="1.47"
        ry="2.94"
        transform="rotate(12 18.18 31)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
      <path
        d="M71.74 24.28C71.74 20.92 72.58 17.98 74.26 15.46L76.36 16.3C75.52 18.82 75.1 21.34 75.1 24.28Z"
        fill={P.brown}
        {...line}
      />
      <path
        d="M75.52 18.82C78.04 13.78 84.76 13.36 87.28 15.88C84.76 20.5 78.46 21.34 75.52 18.82Z"
        fill={P.green}
        {...line}
      />
      <path
        d="M73 23.02C69.64 20.08 57.88 20.92 57.88 33.1C57.88 42.76 64.6 48.64 69.64 47.8C71.32 47.38 74.68 47.38 76.36 47.8C81.4 48.64 88.12 42.76 88.12 33.1C88.12 20.92 76.36 20.08 73 23.02Z"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="64.18"
        cy="31"
        rx="1.47"
        ry="2.94"
        transform="rotate(12 64.18 31)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
      <g opacity="0.35">
        <path
          d="M48.74 64.28C48.74 60.92 49.58 57.98 51.26 55.46L53.36 56.3C52.52 58.82 52.1 61.34 52.1 64.28Z"
          fill={P.brown}
          {...line}
        />
        <path
          d="M52.52 58.82C55.04 53.78 61.76 53.36 64.28 55.88C61.76 60.5 55.46 61.34 52.52 58.82Z"
          fill={P.green}
          {...line}
        />
        <path
          d="M50 63.02C46.64 60.08 34.88 60.92 34.88 73.1C34.88 82.76 41.6 88.64 46.64 87.8C48.32 87.38 51.68 87.38 53.36 87.8C58.4 88.64 65.12 82.76 65.12 73.1C65.12 60.92 53.36 60.08 50 63.02Z"
          fill={P.red}
          {...line}
        />
        <ellipse
          cx="41.18"
          cy="71"
          rx="1.47"
          ry="2.94"
          transform="rotate(12 41.18 71)"
          fill={HIGHLIGHT}
          opacity="0.5"
        />
      </g>
      <path d="M33 56 L67 90" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
    </g>
  ),
};
