import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const apple: IllustDef = {
  id: 'apple',
  label: 'りんご',
  status: 'final',
  draw: () => (
    <g>
      {/* 軸（本体の奥） */}
      <path d="M47 34 C47 26 49 19 53 13 L58 15 C56 21 55 27 55 34 Z" fill={P.brown} {...line} />
      {/* 葉 */}
      <path d="M56 21 C62 9 78 8 84 14 C78 25 63 27 56 21 Z" fill={P.green} {...line} />
      {/* 本体（上のくぼみ） */}
      <path
        d="M50 31 C42 24 14 26 14 55 C14 78 30 92 42 90 C46 89 54 89 58 90 C70 92 86 78 86 55 C86 26 58 24 50 31 Z"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="29"
        cy="50"
        rx="3.5"
        ry="7"
        transform="rotate(12 29 50)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
