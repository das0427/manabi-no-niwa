import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const modeCompare: IllustDef = {
  id: 'mode-compare',
  label: 'くらべっこ',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M31.45 38.7C31.45 31.9 33.15 25.95 36.55 20.85L40.8 22.55C39.1 27.65 38.25 32.75 38.25 38.7Z"
        fill={P.brown}
        {...line}
      />
      <path
        d="M39.1 27.65C44.2 17.45 57.8 16.6 62.9 21.7C57.8 31.05 45.05 32.75 39.1 27.65Z"
        fill={P.green}
        {...line}
      />
      <path
        d="M34 36.15C27.2 30.2 3.4 31.9 3.4 56.55C3.4 76.1 17 88 27.2 86.3C30.6 85.45 37.4 85.45 40.8 86.3C51 88 64.6 76.1 64.6 56.55C64.6 31.9 40.8 30.2 34 36.15Z"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="16.15"
        cy="52.3"
        rx="2.98"
        ry="5.95"
        transform="rotate(12 16.15 52.3)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
      <path
        d="M75.65 61.9C75.65 58.3 76.55 55.15 78.35 52.45L80.6 53.35C79.7 56.05 79.25 58.75 79.25 61.9Z"
        fill={P.brown}
        {...line}
      />
      <path
        d="M79.7 56.05C82.4 50.65 89.6 50.2 92.3 52.9C89.6 57.85 82.85 58.75 79.7 56.05Z"
        fill={P.green}
        {...line}
      />
      <path
        d="M77 60.55C73.4 57.4 60.8 58.3 60.8 71.35C60.8 81.7 68 88 73.4 87.1C75.2 86.65 78.8 86.65 80.6 87.1C86 88 93.2 81.7 93.2 71.35C93.2 58.3 80.6 57.4 77 60.55Z"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="67.55"
        cy="69.1"
        rx="1.58"
        ry="3.15"
        transform="rotate(12 67.55 69.1)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
