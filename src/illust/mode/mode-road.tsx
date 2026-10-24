import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const modeRoad: IllustDef = {
  id: 'mode-road',
  label: 'みちを つくろう',
  status: 'final',
  draw: () => (
    <g>
      <rect x="8" y="34" width="84" height="56" rx="5" fill={P.green} />
      <path
        d="M8 64 H50 Q70 64 70 80 V90"
        fill="none"
        stroke={INK}
        strokeWidth="25"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <path
        d="M8 64 H50 Q70 64 70 80 V90"
        fill="none"
        stroke={P.tan}
        strokeWidth="18"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <rect x="8" y="34" width="84" height="56" rx="5" fill="none" {...line} />
      <ellipse
        cx="50.68"
        cy="28.64"
        rx="3.72"
        ry="8.68"
        transform="rotate(-8 50.68 28.64)"
        fill={P.cream}
        {...line}
      />
      <ellipse
        cx="50.68"
        cy="29.26"
        rx="1.61"
        ry="4.96"
        transform="rotate(-8 50.68 29.26)"
        fill={P.pink}
      />
      <ellipse
        cx="42"
        cy="29.26"
        rx="3.72"
        ry="8.68"
        transform="rotate(-16 42 29.26)"
        fill={P.cream}
        {...line}
      />
      <ellipse
        cx="42"
        cy="29.88"
        rx="1.61"
        ry="4.96"
        transform="rotate(-16 42 29.88)"
        fill={P.pink}
      />
      <circle cx="21.54" cy="63.36" r="4.96" fill={P.white} {...line} />
      <ellipse cx="38.28" cy="60.88" rx="16.12" ry="11.16" fill={P.cream} {...line} />
      <ellipse cx="32.08" cy="64.6" rx="8.06" ry="6.2" fill={P.cream} {...line} />
      <ellipse cx="49.44" cy="44.76" rx="11.78" ry="9.92" fill={P.cream} {...line} />
      <circle cx="54.4" cy="43.52" r="2.6" fill={INK} />
      <ellipse cx="59.98" cy="46" rx="2.6" ry="2" fill={P.pink} stroke={INK} strokeWidth="1.5" />
      <ellipse cx="53.16" cy="49.1" rx="2.79" ry="1.86" fill={CHEEK} opacity="0.7" />
      <path d="M56.26 50.34Q58.74 52.2 61.22 49.72" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
