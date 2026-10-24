import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

/** 8本の足。うしろ（左）へ流れ、先はくるっと巻く。吸盤は各足2つ。 */
const legs = Array.from({ length: 8 }, (_, i) => {
  const x0 = 25 + i * 7.8;
  const x2 = x0 - 3 + (i - 3.5) * 2;
  const x1 = x0 + (i % 2 === 0 ? 3 : -5);
  const sg = i < 5 ? -1 : 1;
  const y2 = 80;
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2,
    y: (1 - t) * (1 - t) * 60 + 2 * (1 - t) * t * 70 + t * t * y2,
  });
  return {
    d: `M${x0} 60 Q${x1} 70 ${x2} ${y2} C${x2 + sg * 1} 88 ${x2 + sg * 6} 90 ${x2 + sg * 7} 85`,
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
      {/* 少し右にかたむけたあたま */}
      <g transform="rotate(10 49 60)">
        <path
          d="M16 58 C14 26 30 4 49 4 C68 4 84 26 82 58 C82 64 16 64 16 58 Z"
          fill={P.red}
          {...line}
        />
        <circle cx="40" cy="40" r="2.6" fill={INK} />
        <circle cx="66" cy="40" r="2.6" fill={INK} />
        <ellipse cx="32" cy="48" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
        <ellipse cx="72" cy="48" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
        <path d="M48 46 Q53 51 58 46" fill="none" {...line} strokeWidth="2.5" />
      </g>
    </g>
  ),
};
