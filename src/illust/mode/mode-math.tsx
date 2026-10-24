import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

const apple = (cx: number, cy: number) => (
  <g key={cx}>
    <path d={`M${cx} ${cy - 6} L${cx + 2} ${cy - 13}`} fill="none" {...line} />
    <ellipse
      cx={cx + 7}
      cy={cy - 12}
      rx="5.5"
      ry="3"
      transform={`rotate(-25 ${cx + 7} ${cy - 12})`}
      fill={P.green}
      {...line}
    />
    <path
      d={`M${cx} ${cy - 6} C${cx - 4} ${cy - 10} ${cx - 14} ${cy - 6} ${cx - 14} ${cy + 3} C${cx - 14} ${cy + 11} ${cx - 8} ${cy + 15} ${cx - 4} ${cy + 14} C${cx - 2} ${cy + 13} ${cx + 2} ${cy + 13} ${cx + 4} ${cy + 14} C${cx + 8} ${cy + 15} ${cx + 14} ${cy + 11} ${cx + 14} ${cy + 3} C${cx + 14} ${cy - 6} ${cx + 4} ${cy - 10} ${cx} ${cy - 6} Z`}
      fill={P.red}
      {...line}
    />
  </g>
);

export const modeMath: IllustDef = {
  id: 'mode-math',
  label: 'さんすう',
  status: 'final',
  draw: () => (
    <g>
      {/* 木の札 */}
      <rect x="8" y="50" width="84" height="42" rx="6" fill={P.wood} {...line} />
      {/* 「1＋2」（記号として path で描く） */}
      <g fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 64 L31 59 L31 83" />
        <path d="M44 71 L62 71 M53 62 L53 80" />
        <path d="M68 65 C70 58 82 58 82 66 C82 73 70 77 67 83 L83 83" />
      </g>
      {/* りんご3つ */}
      {apple(22, 26)}
      {apple(50, 26)}
      {apple(78, 26)}
    </g>
  ),
};
