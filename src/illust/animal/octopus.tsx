import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

/** 8本の足。先は外側にくるっと巻く。吸盤は各足2つ。 */
const legs = Array.from({ length: 8 }, (_, i) => {
  const x0 = 21.5 + i * 8.2;
  const x2 = x0 + (i - 3.5) * 3;
  const x1 = x0 + (i % 2 === 0 ? 4 : -4);
  const sg = i < 4 ? -1 : 1;
  const y2 = 80;
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2,
    y: (1 - t) * (1 - t) * 58 + 2 * (1 - t) * t * 70 + t * t * y2,
  });
  return {
    d: `M${x0} 58 Q${x1} 70 ${x2} ${y2} C${x2 + sg * 1} 88 ${x2 + sg * 6} 90 ${x2 + sg * 7} 85`,
    dots: [at(0.35), at(0.75)],
  };
});

export const octopus: IllustDef = {
  id: 'octopus',
  label: 'たこ',
  status: 'final',
  draw: () => (
    <g>
      {/* あし（8本） */}
      {legs.map((l) => (
        <path
          key={`o${l.d}`}
          d={l.d}
          fill="none"
          stroke={INK}
          strokeWidth="8"
          strokeLinecap="round"
        />
      ))}
      {legs.map((l) => (
        <path
          key={`r${l.d}`}
          d={l.d}
          fill="none"
          stroke={P.red}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      ))}
      {legs.flatMap((l) =>
        l.dots.map((p) => <circle key={`s${p.x}`} cx={p.x} cy={p.y} r="1.4" fill={P.cream} />),
      )}
      {/* あたま */}
      <path
        d="M16 58 C14 26 30 4 49 4 C68 4 84 26 82 58 C82 64 16 64 16 58 Z"
        fill={P.red}
        {...line}
      />
      {/* 顔 */}
      <circle cx="36" cy="40" r="2.6" fill={INK} />
      <circle cx="62" cy="40" r="2.6" fill={INK} />
      <ellipse cx="29" cy="48" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
      <ellipse cx="69" cy="48" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
      <path d="M44 46 Q49 51 54 46" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
