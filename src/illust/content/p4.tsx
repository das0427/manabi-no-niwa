/**
 * p4（4歳）の教材で使う絵。画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・palette の色だけ・文字なし）。
 * 季節の絵（はる・なつ・あき・ふゆ）は色だけで区別しないように、形（花・太陽と海・落ち葉・雪の木）で見分ける。
 */
import { HIGHLIGHT, INK, line, type IllustDef, type IllustGroup } from '../types';
import { P } from '../palette';

const def = (id: string, label: string, draw: IllustDef['draw']): IllustDef => ({
  id,
  label,
  status: 'final',
  draw,
});

/** 5まいの はなびらの はな（中心 cx, cy） */
function Blossom({ cx, cy, r = 6 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle
          key={a}
          cx={cx + Math.cos(((a - 90) * Math.PI) / 180) * r}
          cy={cy + Math.sin(((a - 90) * Math.PI) / 180) * r}
          r={r * 0.75}
          fill={P.pink}
          {...line}
          strokeWidth="2"
        />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.55} fill={P.yellow} {...line} strokeWidth="2" />
    </g>
  );
}

const spring = def('p4-spring', 'はる', () => (
  <g>
    <rect x="45" y="52" width="10" height="38" rx="3" fill={P.brown} {...line} />
    <circle cx="50" cy="36" r="26" fill={P.green} {...line} />
    <Blossom cx={38} cy={28} />
    <Blossom cx={60} cy={26} />
    <Blossom cx={50} cy={44} />
    <Blossom cx={31} cy={46} r={5} />
    <Blossom cx={69} cy={45} r={5} />
    <path d="M10 92 L90 92" fill="none" {...line} />
    <path
      d="M70 80 C66 74 62 76 64 82 C66 86 70 84 70 80 Z"
      fill={P.yellow}
      {...line}
      strokeWidth="2.5"
    />
    <path
      d="M70 80 C74 74 78 76 76 82 C74 86 70 84 70 80 Z"
      fill={P.yellow}
      {...line}
      strokeWidth="2.5"
    />
    <path
      d="M70 84 C66 90 64 90 66 86 M70 84 C74 90 76 90 74 86"
      fill="none"
      {...line}
      strokeWidth="2.5"
    />
  </g>
));

const summer = def('p4-summer', 'なつ', () => (
  <g>
    <path
      d="M50 6 L50 14 M22 18 L28 24 M78 18 L72 24 M10 40 L18 40 M90 40 L82 40"
      fill="none"
      {...line}
    />
    <circle cx="50" cy="38" r="20" fill={P.sun} {...line} />
    <rect x="8" y="58" width="84" height="34" rx="6" fill={P.sky} {...line} />
    <path
      d="M14 68 Q22 62 30 68 T46 68 T62 68 T78 68 T88 68 M14 78 Q22 72 30 78 T46 78 T62 78 T78 78 T88 78 M14 88 Q22 82 30 88 T46 88 T62 88 T78 88 T88 88"
      fill="none"
      stroke={P.blue}
      strokeWidth="3"
      strokeLinecap="round"
    />
  </g>
));

const autumn = def('p4-autumn', 'あき', () => (
  <g>
    <rect x="42" y="38" width="10" height="54" rx="3" fill={P.brown} {...line} />
    <path d="M47 50 L28 32 M47 46 L68 26 M47 62 L72 48" fill="none" {...line} strokeWidth="4.5" />
    <path
      d="M22 70 C16 62 22 56 30 60 C34 66 30 72 22 70 Z"
      fill={P.orange}
      {...line}
      strokeWidth="2.5"
    />
    <path
      d="M62 78 C56 70 64 64 70 70 C72 76 68 82 62 78 Z"
      fill={P.yellow}
      {...line}
      strokeWidth="2.5"
    />
    <path
      d="M80 62 C74 54 82 48 88 54 C90 60 86 66 80 62 Z"
      fill={P.orange}
      {...line}
      strokeWidth="2.5"
    />
    <ellipse cx="82" cy="86" rx="6" ry="7" fill={P.wood} {...line} strokeWidth="2.5" />
    <path d="M75 82 C75 76 89 76 89 82 Z" fill={P.brown} {...line} strokeWidth="2.5" />
  </g>
));

const winter = def('p4-winter', 'ふゆ', () => (
  <g>
    <rect x="46" y="66" width="8" height="14" rx="2" fill={P.brown} {...line} />
    <path d="M50 12 L72 42 L62 42 L78 66 L22 66 L38 42 L28 42 Z" fill={P.greenDark} {...line} />
    <path d="M50 12 L60 26 L40 26 Z" fill={P.white} {...line} strokeWidth="2.5" />
    <path d="M38 42 L62 42 L68 52 L32 52 Z" fill={P.white} {...line} strokeWidth="2.5" />
    <path d="M6 82 C20 74 36 78 50 80 C66 76 80 74 94 82 L94 94 L6 94 Z" fill={P.white} {...line} />
    <circle cx="14" cy="30" r="3.5" fill={P.white} {...line} strokeWidth="2.5" />
    <circle cx="86" cy="22" r="3.5" fill={P.white} {...line} strokeWidth="2.5" />
    <circle cx="84" cy="52" r="3.5" fill={P.white} {...line} strokeWidth="2.5" />
  </g>
));

const tulip = def('p4-tulip', 'チューリップ', () => (
  <g>
    <path d="M50 46 L50 92" fill="none" stroke={P.green} strokeWidth="6" strokeLinecap="round" />
    <path d="M50 88 C30 84 26 66 28 56 C38 62 46 74 50 88 Z" fill={P.green} {...line} />
    <path d="M50 88 C70 84 74 66 72 56 C62 62 54 74 50 88 Z" fill={P.green} {...line} />
    <path
      d="M26 14 L38 24 L50 12 L62 24 L74 14 C78 34 70 52 50 52 C30 52 22 34 26 14 Z"
      fill={P.red}
      {...line}
    />
    <path d="M38 24 C40 36 42 42 44 46" fill="none" {...line} strokeWidth="2.5" />
    <path d="M62 24 C60 36 58 42 56 46" fill="none" {...line} strokeWidth="2.5" />
  </g>
));

const sunflower = def('p4-sunflower', 'ひまわり', () => (
  <g>
    <rect x="46" y="56" width="8" height="36" rx="3" fill={P.green} {...line} />
    <path d="M54 76 C70 66 82 72 84 82 C70 86 60 84 54 76 Z" fill={P.green} {...line} />
    <path d="M46 80 C34 72 22 76 20 84 C32 88 40 86 46 80 Z" fill={P.green} {...line} />
    {Array.from({ length: 12 }, (_, i) => (
      <ellipse
        key={i}
        cx="50"
        cy="14"
        rx="6"
        ry="11"
        transform={`rotate(${i * 30} 50 38)`}
        fill={P.yellow}
        {...line}
        strokeWidth="2.5"
      />
    ))}
    <circle cx="50" cy="38" r="15" fill={P.brown} {...line} />
    <circle cx="45" cy="34" r="1.8" fill={INK} />
    <circle cx="55" cy="34" r="1.8" fill={INK} />
    <circle cx="50" cy="40" r="1.8" fill={INK} />
    <circle cx="44" cy="43" r="1.8" fill={INK} />
    <circle cx="56" cy="43" r="1.8" fill={INK} />
  </g>
));

const cicada = def('p4-cicada', 'せみ', () => (
  <g>
    <ellipse
      cx="32"
      cy="46"
      rx="22"
      ry="12"
      transform="rotate(-30 32 46)"
      fill={P.white}
      {...line}
    />
    <ellipse
      cx="68"
      cy="46"
      rx="22"
      ry="12"
      transform="rotate(30 68 46)"
      fill={P.white}
      {...line}
    />
    <path
      d="M18 56 L40 38 M26 60 L44 44 M82 56 L60 38 M74 60 L56 44"
      fill="none"
      {...line}
      strokeWidth="2"
    />
    <ellipse cx="50" cy="56" rx="12" ry="28" fill={P.brown} {...line} />
    <path d="M40 50 L60 50 M41 60 L59 60 M43 70 L57 70" fill="none" {...line} strokeWidth="2.5" />
    <ellipse cx="50" cy="26" rx="14" ry="9" fill={P.brown} {...line} />
    <circle cx="40" cy="24" r="4.5" fill={P.cream} {...line} strokeWidth="2.5" />
    <circle cx="60" cy="24" r="4.5" fill={P.cream} {...line} strokeWidth="2.5" />
    <circle cx="40" cy="24" r="1.6" fill={INK} />
    <circle cx="60" cy="24" r="1.6" fill={INK} />
  </g>
));

function Acorn({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx - 50} ${cy - 50})`}>
      <path d="M32 44 C32 66 42 80 50 84 C58 80 68 66 68 44 Z" fill={P.wood} {...line} />
      <path d="M26 46 C26 24 74 24 74 46 Z" fill={P.brown} {...line} />
      <path
        d="M36 32 L40 44 M46 28 L48 44 M56 28 L54 44 M64 32 L60 44"
        fill="none"
        {...line}
        strokeWidth="2"
      />
      <path d="M50 24 L50 16" fill="none" {...line} />
    </g>
  );
}
const acorn = def('p4-acorn', 'どんぐり', () => (
  <g>
    <g transform="scale(0.8) translate(-2 12)">
      <Acorn cx={34} cy={50} />
    </g>
    <g transform="scale(0.8) translate(30 22)">
      <Acorn cx={50} cy={50} />
    </g>
  </g>
));

const ice = def('p4-ice', 'こおり', () => (
  <g>
    <ellipse cx="50" cy="60" rx="42" ry="24" fill={P.sky} {...line} />
    <path
      d="M30 56 L46 62 L58 52 M46 62 L50 74 M58 52 L72 58"
      fill="none"
      stroke={P.white}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M24 66 C28 70 32 72 36 72"
      fill="none"
      stroke={P.white}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path
      d="M12 44 L12 34 M16 44 L18 32 M20 44 L24 36"
      fill="none"
      stroke={P.gray}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path
      d="M80 42 L82 32 M84 42 L88 34"
      fill="none"
      stroke={P.gray}
      strokeWidth="3"
      strokeLinecap="round"
    />
  </g>
));

const carp = def('p4-carp-streamer', 'こいのぼり', () => (
  <g>
    <rect x="46" y="14" width="6" height="80" rx="3" fill={P.brown} {...line} />
    <circle cx="49" cy="12" r="7" fill={P.gray} {...line} strokeWidth="2.5" />
    <path d="M49 5 L49 19 M42 12 L56 12" fill="none" {...line} strokeWidth="2" />
    <path d="M52 24 L84 28 C90 32 90 40 84 44 L52 46 Z" fill={P.blue} {...line} />
    <path d="M84 28 L94 24 L94 48 L84 44 Z" fill={P.blue} {...line} strokeWidth="2.5" />
    <circle cx="62" cy="33" r="3" fill={P.white} {...line} strokeWidth="2" />
    <circle cx="62" cy="33" r="1.2" fill={INK} />
    <path d="M70 32 Q74 36 70 40 M78 32 Q82 36 78 40" fill="none" {...line} strokeWidth="2" />
    <path d="M52 52 L84 56 C90 60 90 68 84 72 L52 74 Z" fill={P.red} {...line} />
    <path d="M84 56 L94 52 L94 76 L84 72 Z" fill={P.red} {...line} strokeWidth="2.5" />
    <circle cx="62" cy="61" r="3" fill={P.white} {...line} strokeWidth="2" />
    <circle cx="62" cy="61" r="1.2" fill={INK} />
    <path d="M70 60 Q74 64 70 68 M78 60 Q82 64 78 68" fill="none" {...line} strokeWidth="2" />
  </g>
));

const bamboo = def('p4-bamboo-shoot', 'たけのこ', () => (
  <g>
    <path d="M50 10 C58 26 70 48 72 82 L28 82 C30 48 42 26 50 10 Z" fill={P.tan} {...line} />
    <path
      d="M50 10 C54 20 58 28 60 34 L40 34 C42 28 46 20 50 10 Z"
      fill={P.brown}
      {...line}
      strokeWidth="2.5"
    />
    <path d="M36 52 Q50 62 64 52 M31 68 Q50 80 69 68" fill="none" {...line} strokeWidth="2.5" />
    <path d="M44 34 L44 82 M56 34 L56 82" fill="none" {...line} strokeWidth="1.5" opacity="0.5" />
    <path d="M10 92 C14 76 30 76 34 84 L66 84 C70 76 86 76 90 92 Z" fill={P.wood} {...line} />
  </g>
));

const shavedIce = def('p4-shaved-ice', 'かきごおり', () => (
  <g>
    <path d="M14 56 C14 20 86 20 86 56 Z" fill={P.white} {...line} />
    <path
      d="M26 40 C34 26 66 26 74 40 C66 36 34 36 26 40 Z"
      fill={P.pink}
      {...line}
      strokeWidth="2.5"
    />
    <path
      d="M30 46 C28 38 24 36 22 38"
      fill="none"
      stroke={P.pink}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path d="M18 56 L82 56 L74 88 L26 88 Z" fill={P.blue} {...line} />
    <path
      d="M24 60 L34 60"
      fill="none"
      stroke={HIGHLIGHT}
      strokeWidth="3"
      strokeLinecap="round"
      opacity="0.8"
    />
    <path d="M66 36 L84 10" fill="none" stroke={P.gray} strokeWidth="6" strokeLinecap="round" />
    <ellipse
      cx="62"
      cy="40"
      rx="8"
      ry="5"
      transform="rotate(-50 62 40)"
      fill={P.gray}
      {...line}
      strokeWidth="2.5"
    />
  </g>
));

const sweetPotato = def('p4-sweet-potato', 'さつまいも', () => (
  <g>
    <path
      d="M14 56 C22 36 58 40 78 52 C84 58 80 68 70 70 C46 76 20 72 14 56 Z"
      fill={P.purple}
      {...line}
    />
    <path
      d="M22 80 C30 64 62 66 84 76 C90 82 86 90 76 90 C52 94 28 92 22 80 Z"
      fill={P.purple}
      {...line}
    />
    <path
      d="M30 52 Q40 48 52 52 M36 82 Q50 78 66 82"
      fill="none"
      stroke={P.pink}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path d="M12 58 L6 62 M10 54 L4 52" fill="none" {...line} strokeWidth="2.5" />
    <path
      d="M70 46 C70 34 64 26 56 22"
      fill="none"
      stroke={P.green}
      strokeWidth="4"
      strokeLinecap="round"
    />
    <path d="M56 22 C48 10 36 14 34 22 C42 30 52 28 56 22 Z" fill={P.green} {...line} />
  </g>
));

function Chestnut({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <path
        d="M-12 -4 C-12 -14 12 -14 12 -4 C14 8 8 14 0 14 C-8 14 -14 8 -12 -4 Z"
        fill={P.brown}
        {...line}
        transform={`translate(${cx} ${cy})`}
      />
      <path
        d="M-11 4 C-6 8 6 8 11 4 C10 12 6 14 0 14 C-6 14 -10 12 -11 4 Z"
        fill={P.tan}
        transform={`translate(${cx} ${cy})`}
      />
    </g>
  );
}
const chestnut = def('p4-chestnut', 'くり', () => (
  <g>
    <circle cx="50" cy="42" r="30" fill={P.green} {...line} />
    <path
      d="M50 8 L50 16 M24 18 L30 24 M76 18 L70 24 M14 42 L22 42 M86 42 L78 42 M24 66 L30 60 M76 66 L70 60"
      fill="none"
      {...line}
    />
    <path
      d="M28 46 C36 56 64 56 72 46 L70 60 C60 70 40 70 30 60 Z"
      fill={P.greenDark}
      {...line}
      strokeWidth="2.5"
    />
    <Chestnut cx={38} cy={44} />
    <Chestnut cx={62} cy={44} />
    <path d="M24 90 L30 80 M40 92 L42 82 M60 92 L58 82 M76 90 L70 80" fill="none" {...line} />
    <ellipse cx="50" cy="90" rx="30" ry="4" fill={P.wood} {...line} strokeWidth="2.5" />
  </g>
));

const mittens = def('p4-mittens', 'てぶくろ', () => (
  <g>
    <g transform="rotate(-10 28 50)">
      <path
        d="M12 86 L12 50 C8 36 18 14 30 14 C42 14 46 34 42 48 L42 86 Z"
        fill={P.red}
        {...line}
      />
      <path d="M12 52 C2 48 0 34 8 34 C14 34 18 42 20 50" fill={P.red} {...line} />
      <rect x="10" y="70" width="34" height="16" rx="3" fill={P.white} {...line} />
      <path d="M18 70 L18 86 M26 70 L26 86 M34 70 L34 86" fill="none" {...line} strokeWidth="2" />
    </g>
    <g transform="rotate(10 72 50)">
      <path
        d="M88 86 L88 50 C92 36 82 14 70 14 C58 14 54 34 58 48 L58 86 Z"
        fill={P.blue}
        {...line}
      />
      <path d="M88 52 C98 48 100 34 92 34 C86 34 82 42 80 50" fill={P.blue} {...line} />
      <rect x="56" y="70" width="34" height="16" rx="3" fill={P.white} {...line} />
      <path d="M64 70 L64 86 M72 70 L72 86 M80 70 L80 86" fill="none" {...line} strokeWidth="2" />
    </g>
  </g>
));

const sock = def('p4-sock', 'くつした', () => (
  <g>
    <path
      d="M30 10 L58 10 L58 52 L86 62 C94 66 92 82 82 84 L38 84 C28 84 26 76 28 70 Z"
      fill={P.white}
      {...line}
    />
    <rect x="30" y="10" width="28" height="12" fill={P.blue} {...line} />
    <path d="M28 34 L58 34 M28 44 L58 44" fill="none" stroke={P.blue} strokeWidth="5" />
    <path
      d="M30 10 L58 10 L58 52 L86 62 C94 66 92 82 82 84 L38 84 C28 84 26 76 28 70 Z"
      fill="none"
      {...line}
    />
    <path d="M68 62 L86 62 C94 66 92 82 82 84 L72 84 Z" fill={P.blue} {...line} strokeWidth="2.5" />
    <path
      d="M28 70 C26 76 28 84 38 84 L46 84 C40 80 38 74 40 66 Z"
      fill={P.blue}
      {...line}
      strokeWidth="2.5"
    />
  </g>
));

const rain = def('p4-rain', 'あめ', () => (
  <g>
    <path
      d="M24 56 C10 56 8 36 24 34 C26 20 46 16 54 28 C62 20 82 24 80 40 C94 42 92 58 78 56 Z"
      fill={P.gray}
      {...line}
    />
    {(
      [
        [24, 70],
        [42, 78],
        [60, 70],
        [78, 78],
        [50, 90],
      ] as [number, number][]
    ).map(([x, y], i) => (
      <path
        key={i}
        d={`M${x} ${y - 8} C${x + 6} ${y}, ${x + 5} ${y + 6}, ${x} ${y + 6} C${x - 5} ${y + 6}, ${x - 6} ${y}, ${x} ${y - 8} Z`}
        fill={P.sky}
        {...line}
        strokeWidth="2.5"
      />
    ))}
  </g>
));

const shirt = def('p4-shirt', 'ふく', () => (
  <g>
    <path
      d="M34 14 L10 30 L22 50 L30 44 L30 88 L70 88 L70 44 L78 50 L90 30 L66 14 C62 22 38 22 34 14 Z"
      fill={P.yellow}
      {...line}
    />
    <path d="M34 14 C38 24 62 24 66 14" fill={P.white} {...line} />
    <path
      d="M34 14 C38 24 62 24 66 14 C62 18 38 18 34 14 Z"
      fill={P.white}
      {...line}
      strokeWidth="2.5"
    />
  </g>
));

const bath = def('p4-bath', 'おふろ', () => (
  <g>
    <path
      d="M30 30 C24 22 38 16 36 8 M50 30 C44 22 58 16 56 8 M70 30 C64 22 78 16 76 8"
      fill="none"
      stroke={P.gray}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path d="M8 44 L92 44 L84 84 L16 84 Z" fill={P.white} {...line} />
    <path d="M12 52 L88 52 L84 76 L16 76 Z" fill={P.sky} {...line} strokeWidth="2.5" />
    <rect x="4" y="38" width="92" height="10" rx="5" fill={P.gray} {...line} />
    <rect x="22" y="84" width="10" height="8" rx="2" fill={P.gray} {...line} strokeWidth="2.5" />
    <rect x="68" y="84" width="10" height="8" rx="2" fill={P.gray} {...line} strokeWidth="2.5" />
  </g>
));

const paper = def('p4-paper', 'かみ', () => (
  <g>
    <path d="M20 10 L80 10 L80 70 L66 90 L20 90 Z" fill={P.white} {...line} />
    <path d="M80 70 L66 90 L66 74 C66 71 68 70 70 70 Z" fill={P.gray} {...line} strokeWidth="2.5" />
  </g>
));

const faucet = def('p4-faucet', 'すいどう', () => (
  <g>
    <rect x="4" y="8" width="22" height="34" rx="3" fill={P.gray} {...line} />
    <path
      d="M26 20 L58 20 C70 20 74 26 74 36 L74 44 L60 44 L60 36 C60 34 59 34 58 34 L26 34 Z"
      fill={P.gray}
      {...line}
    />
    <rect x="34" y="8" width="18" height="6" rx="3" fill={P.blue} {...line} strokeWidth="2.5" />
    <path d="M42 8 L42 20" fill="none" {...line} strokeWidth="2.5" />
    <path d="M67 48 L67 78" fill="none" stroke={P.sky} strokeWidth="6" strokeLinecap="round" />
    <path
      d="M52 88 L58 82 M82 88 L76 82 M67 90 L67 84"
      fill="none"
      stroke={P.sky}
      strokeWidth="4"
      strokeLinecap="round"
    />
  </g>
));

const bowl = def('p4-bowl', 'おわん', () => (
  <g>
    <ellipse cx="50" cy="40" rx="38" ry="10" fill={P.cream} {...line} />
    <path
      d="M12 40 C12 70 28 86 50 86 C72 86 88 70 88 40 C80 48 20 48 12 40 Z"
      fill={P.white}
      {...line}
    />
    <path d="M30 88 L70 88" fill="none" {...line} />
    <path
      d="M24 56 C28 66 34 72 40 76"
      fill="none"
      stroke={P.gray}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </g>
));

const pan = def('p4-pan', 'フライパン', () => (
  <g>
    <rect x="62" y="44" width="34" height="12" rx="6" fill={P.brown} {...line} />
    <ellipse cx="38" cy="52" rx="32" ry="26" fill={P.gray} {...line} />
    <ellipse cx="38" cy="52" rx="24" ry="19" fill={P.gray} stroke={INK} strokeWidth="2.5" />
    <ellipse
      cx="28"
      cy="46"
      rx="8"
      ry="4"
      transform="rotate(-20 28 46)"
      fill={HIGHLIGHT}
      opacity="0.7"
    />
  </g>
));

const plate = def('p4-plate', 'おさら', () => (
  <g>
    <ellipse cx="50" cy="54" rx="42" ry="30" fill={P.white} {...line} />
    <ellipse cx="50" cy="54" rx="32" ry="21" fill="none" {...line} strokeWidth="2.5" />
    <ellipse cx="50" cy="54" rx="38" ry="26" fill="none" stroke={P.blue} strokeWidth="3" />
  </g>
));

const melted = def('p4-melted', 'とけた アイス', () => (
  <g>
    <path
      d="M10 70 C6 56 18 46 32 50 C42 40 66 42 72 54 C90 54 94 72 80 78 C70 86 24 86 10 70 Z"
      fill={P.white}
      {...line}
    />
    <path
      d="M24 70 C30 66 38 66 44 70"
      fill="none"
      stroke={P.pink}
      strokeWidth="5"
      strokeLinecap="round"
    />
    <path
      d="M20 56 C28 50 40 54 44 58 C40 64 30 62 20 56 Z"
      fill={P.pink}
      {...line}
      strokeWidth="2.5"
    />
    <path
      d="M58 26 L82 16 L74 44 Z"
      fill={P.tan}
      {...line}
      transform="rotate(90 70 30) translate(10 -6)"
    />
    <path d="M64 34 L74 28 M68 40 L78 32" fill="none" {...line} strokeWidth="2" />
    <path
      d="M28 88 C24 92 24 96 28 96 C32 96 32 92 28 88 Z"
      fill={P.white}
      {...line}
      strokeWidth="2.5"
    />
    <path
      d="M64 88 C60 92 60 96 64 96 C68 96 68 92 64 88 Z"
      fill={P.white}
      {...line}
      strokeWidth="2.5"
    />
  </g>
));

const eggCrack = def('p4-egg-crack', 'ひびの はいった たまご', () => (
  <g>
    <path
      d="M50 18 C72 18 82 44 82 62 C82 80 68 90 50 90 C32 90 18 80 18 62 C18 44 28 18 50 18 Z"
      fill={P.cream}
      {...line}
    />
    <path d="M24 52 L36 44 L44 56 L54 42 L64 54 L76 44" fill="none" {...line} />
    <ellipse cx="38" cy="70" rx="5" ry="8" fill={HIGHLIGHT} opacity="0.7" />
    <path d="M80 12 L90 10 L88 20 Z" fill={P.cream} {...line} strokeWidth="2.5" />
  </g>
));

export const p4Illust: IllustGroup = {
  'p4-spring': spring,
  'p4-summer': summer,
  'p4-autumn': autumn,
  'p4-winter': winter,
  'p4-tulip': tulip,
  'p4-sunflower': sunflower,
  'p4-cicada': cicada,
  'p4-acorn': acorn,
  'p4-ice': ice,
  'p4-carp-streamer': carp,
  'p4-bamboo-shoot': bamboo,
  'p4-shaved-ice': shavedIce,
  'p4-sweet-potato': sweetPotato,
  'p4-chestnut': chestnut,
  'p4-mittens': mittens,
  'p4-sock': sock,
  'p4-rain': rain,
  'p4-shirt': shirt,
  'p4-bath': bath,
  'p4-paper': paper,
  'p4-faucet': faucet,
  'p4-bowl': bowl,
  'p4-pan': pan,
  'p4-plate': plate,
  'p4-melted': melted,
  'p4-egg-crack': eggCrack,
};
