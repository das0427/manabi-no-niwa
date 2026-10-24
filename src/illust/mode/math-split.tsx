import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const mathSplit: IllustDef = {
  id: 'math-split',
  label: 'わける',
  status: 'final',
  draw: () => (
    <g>
      <ellipse cx="27" cy="74" rx="22" ry="9" fill={P.sky} {...line} />
      <ellipse cx="73" cy="74" rx="22" ry="9" fill={P.sky} {...line} />
      <path
        d="M25.5 41C25.5 37 26.5 33.5 28.5 30.5L31 31.5C30 34.5 29.5 37.5 29.5 41Z"
        fill={P.brown}
        {...line}
      />
      <path d="M30 34.5C33 28.5 41 28 44 31C41 36.5 33.5 37.5 30 34.5Z" fill={P.green} {...line} />
      <path
        d="M27 39.5C23 36 9 37 9 51.5C9 63 17 70 23 69C25 68.5 29 68.5 31 69C37 70 45 63 45 51.5C45 37 31 36 27 39.5Z"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="16.5"
        cy="49"
        rx="1.75"
        ry="3.5"
        transform="rotate(12 16.5 49)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
      <path
        d="M71.5 41C71.5 37 72.5 33.5 74.5 30.5L77 31.5C76 34.5 75.5 37.5 75.5 41Z"
        fill={P.brown}
        {...line}
      />
      <path d="M76 34.5C79 28.5 87 28 90 31C87 36.5 79.5 37.5 76 34.5Z" fill={P.green} {...line} />
      <path
        d="M73 39.5C69 36 55 37 55 51.5C55 63 63 70 69 69C71 68.5 75 68.5 77 69C83 70 91 63 91 51.5C91 37 77 36 73 39.5Z"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="62.5"
        cy="49"
        rx="1.75"
        ry="3.5"
        transform="rotate(12 62.5 49)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
