import { CHEEK, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const bear: IllustDef = {
  id: 'bear',
  label: 'くま',
  status: 'final',
  draw: () => (
    <g>
      {/* しっぽ */}
      <circle cx="17" cy="78" r="6" fill={P.brown} {...line} />
      {/* おくの耳 */}
      <circle cx="72" cy="14" r="8" fill={P.brown} {...line} />
      {/* 大きくて丸いからだ（おしりをついてすわる） */}
      <ellipse cx="46" cy="64" rx="31" ry="27" fill={P.brown} {...line} />
      <ellipse cx="54" cy="68" rx="15" ry="16" fill={P.tan} />
      {/* 前に出した短い足 */}
      <ellipse cx="72" cy="88" rx="13" ry="7" fill={P.brown} {...line} />
      <ellipse cx="42" cy="90" rx="13" ry="5.5" fill={P.brown} {...line} />
      <ellipse cx="74" cy="88" rx="5" ry="3" fill={P.tan} />
      {/* うで */}
      <ellipse
        cx="68"
        cy="66"
        rx="7"
        ry="12"
        transform="rotate(-20 68 66)"
        fill={P.brown}
        {...line}
      />
      {/* あたま */}
      <circle cx="55" cy="32" r="21" fill={P.brown} {...line} />
      {/* てまえの耳 */}
      <circle cx="38" cy="16" r="9" fill={P.brown} {...line} />
      <circle cx="38" cy="16" r="4" fill={P.tan} />
      {/* 明るい口元 */}
      <ellipse cx="72" cy="40" rx="11" ry="9" fill={P.tan} {...line} />
      <ellipse cx="80" cy="36" rx="4" ry="3" fill={INK} stroke={INK} strokeWidth="1" />
      <circle cx="64" cy="28" r="2.6" fill={INK} />
      <ellipse cx="57" cy="40" rx="4.5" ry="3" fill={CHEEK} opacity="0.7" />
      <path d="M70 45 Q74 49 79 45" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};
