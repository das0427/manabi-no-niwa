import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const scissors: IllustDef = {
  id: 'scissors',
  label: 'はさみ',
  status: 'final',
  draw: () => (
    <g>
      {/* 持ち手 */}
      <path d="M44 52 L58 50 L76 66 L66 74 Z" fill={P.red} {...line} />
      <path d="M56 52 L42 50 L24 66 L34 74 Z" fill={P.red} {...line} />
      <ellipse
        cx="72"
        cy="78"
        rx="14"
        ry="12"
        transform="rotate(20 72 78)"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="72"
        cy="78"
        rx="6.5"
        ry="5.5"
        transform="rotate(20 72 78)"
        fill={P.white}
        {...line}
        strokeWidth="3"
      />
      <ellipse
        cx="28"
        cy="78"
        rx="14"
        ry="12"
        transform="rotate(-20 28 78)"
        fill={P.red}
        {...line}
      />
      <ellipse
        cx="28"
        cy="78"
        rx="6.5"
        ry="5.5"
        transform="rotate(-20 28 78)"
        fill={P.white}
        {...line}
        strokeWidth="3"
      />
      {/* 刃（先は丸く） */}
      <path d="M44 52 L26 14 C25 8 33 6 36 11 L59 48 Z" fill={P.gray} {...line} />
      <path d="M56 52 L74 14 C75 8 67 6 64 11 L41 48 Z" fill={P.gray} {...line} />
      <circle cx="50" cy="52" r="3" fill={P.ink} />
    </g>
  ),
};
