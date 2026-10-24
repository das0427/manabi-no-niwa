import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const ant: IllustDef = {
  id: 'ant',
  label: 'あり',
  status: 'final',
  draw: () => (
    <g>
      {/* あし（6本・太め） */}
      <path
        d="M44 54 L36 38 L28 28 M52 52 L52 34 L50 22 M60 54 L68 40 L74 30 M44 60 L36 76 L28 88 M52 62 L52 78 L50 90 M60 60 L68 76 L74 88"
        fill="none"
        {...line}
        strokeWidth="5.5"
      />
      {/* しょっかく（太め） */}
      <path
        d="M82 42 C82 28 88 22 95 24 M90 44 C96 36 98 30 94 26"
        fill="none"
        {...line}
        strokeWidth="5"
      />
      {/* おなか・むね・あたま */}
      <ellipse cx="22" cy="58" rx="17" ry="15" fill={P.redDark} {...line} />
      <ellipse cx="51" cy="57" rx="11" ry="10" fill={P.redDark} {...line} />
      <circle cx="79" cy="55" r="14" fill={P.redDark} {...line} />
      {/* 顔 */}
      <circle cx="83" cy="51" r="4.5" fill={P.white} />
      <circle cx="84.5" cy="51" r="2.6" fill={INK} />
      <ellipse cx="74" cy="60" rx="3.5" ry="2.5" fill={CHEEK} opacity="0.7" />
      <path d="M79 62 Q84 66 89 61" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
