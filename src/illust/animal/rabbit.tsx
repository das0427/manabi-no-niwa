import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const rabbit: IllustDef = {
  id: 'rabbit',
  label: 'うさぎ',
  status: 'final',
  draw: () => (
    <g>
      {/* 奥の耳 */}
      <ellipse
        cx="64"
        cy="22"
        rx="6"
        ry="14"
        transform="rotate(-8 64 22)"
        fill={P.cream}
        {...line}
      />
      <ellipse cx="64" cy="23" rx="2.6" ry="8" transform="rotate(-8 64 23)" fill={P.pink} />
      {/* 手前の耳 */}
      <ellipse
        cx="50"
        cy="23"
        rx="6"
        ry="14"
        transform="rotate(-16 50 23)"
        fill={P.cream}
        {...line}
      />
      <ellipse cx="50" cy="24" rx="2.6" ry="8" transform="rotate(-16 50 24)" fill={P.pink} />
      {/* まるいしっぽ */}
      <circle cx="17" cy="78" r="8" fill={P.white} {...line} />
      {/* からだ */}
      <ellipse cx="44" cy="74" rx="26" ry="18" fill={P.cream} {...line} />
      <ellipse cx="34" cy="80" rx="13" ry="10" fill={P.cream} {...line} />
      {/* あたま */}
      <ellipse cx="62" cy="48" rx="19" ry="16" fill={P.cream} {...line} />
      {/* 顔 */}
      <circle cx="70" cy="46" r="2.6" fill={INK} />
      <ellipse cx="79" cy="50" rx="2.6" ry="2" fill={P.pink} stroke={INK} strokeWidth="1.5" />
      <ellipse cx="68" cy="55" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
      <path d="M73 57 Q77 60 81 56" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
