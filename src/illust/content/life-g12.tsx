/**
 * life-g12（小1・小2 生活）の教材で使う絵。画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・palette の色だけ・文字なし）。
 * 信号は色だけで区別しないように、ともしている ランプに「立つ人」「歩く人」の形を入れた。
 * 町の建物は、建物の形をそろえ、かんばんの絵（パン・十字・本・時計 など）で見分ける。
 */
import type { ReactElement } from 'react';
import { HIGHLIGHT, INK, line, type IllustDef, type IllustGroup } from '../types';
import { P } from '../palette';
import { mushroom, sun } from '../stamps/nature';

/** はんこ用に描いた絵（stamps/）は ILLUST に入っていないため、同じ絵を life- の id で使えるようにする */
const reuse = (d: IllustDef, id: string, label: string): IllustDef => ({ ...d, id, label });

const def = (id: string, label: string, draw: IllustDef['draw']): IllustDef => ({
  id,
  label,
  status: 'final',
  draw,
});

// ---- 信号・横断歩道 ----
const WHITE_LINE = {
  stroke: P.white,
  strokeWidth: 3.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

/** 立っている人（止まれ） */
function Standing({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy - 9} r="3.4" fill={P.white} />
      <path d={`M${cx} ${cy - 4} L${cx} ${cy + 5} M${cx - 6} ${cy - 1} L${cx + 6} ${cy - 1} M${cx} ${cy + 5} L${cx - 4} ${cy + 12} M${cx} ${cy + 5} L${cx + 4} ${cy + 12}`} {...WHITE_LINE} />
    </g>
  );
}
/** 歩いている人（すすめ） */
function Walking({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx + 1} cy={cy - 9} r="3.4" fill={P.white} />
      <path d={`M${cx} ${cy - 4} L${cx - 1} ${cy + 5} M${cx} ${cy - 1} L${cx - 6} ${cy + 4} M${cx} ${cy - 1} L${cx + 6} ${cy + 1} M${cx - 1} ${cy + 5} L${cx - 6} ${cy + 12} M${cx - 1} ${cy + 5} L${cx + 5} ${cy + 12}`} {...WHITE_LINE} />
    </g>
  );
}

function signal(redOn: boolean) {
  return (
    <g>
      <rect x="46" y="86" width="8" height="10" fill={P.gray} {...line} strokeWidth="2.5" />
      <rect x="26" y="4" width="48" height="84" rx="10" fill={INK} {...line} />
      {/* 上: 赤（止まれ） */}
      <circle cx="50" cy="29" r="17" fill={redOn ? P.red : P.gray} {...line} strokeWidth="2.5" />
      {redOn ? <Standing cx={50} cy={29} /> : null}
      {/* 下: 青（すすめ） */}
      <circle cx="50" cy="65" r="17" fill={redOn ? P.gray : P.green} {...line} strokeWidth="2.5" />
      {redOn ? null : <Walking cx={50} cy={65} />}
    </g>
  );
}

const signalRed = def('life-signal-red', 'あかの しんごう（とまれ）', () => signal(true));
const signalGreen = def('life-signal-green', 'あおの しんごう（わたれる）', () => signal(false));

const crosswalk = def('life-crosswalk', 'おうだんほどう', () => (
  <g>
    <rect x="6" y="20" width="88" height="60" rx="6" fill={P.gray} {...line} />
    {Array.from({ length: 6 }, (_, i) => (
      <rect key={i} x={14 + i * 12.5} y="26" width="8" height="48" rx="2" fill={P.white} />
    ))}
    <path d="M6 20 L94 20 M6 80 L94 80" fill="none" {...line} />
  </g>
));

// ---- きせつ ----
const blossom = (cx: number, cy: number, r: number) => (
  <g key={`${cx}-${cy}`}>
    {[0, 72, 144, 216, 288].map((a) => {
      const x = cx + Math.cos(((a - 90) * Math.PI) / 180) * r;
      const y = cy + Math.sin(((a - 90) * Math.PI) / 180) * r;
      return <circle key={a} cx={x} cy={y} r={r * 0.78} fill={P.pink} {...line} strokeWidth="2.5" />;
    })}
    <circle cx={cx} cy={cy} r={r * 0.5} fill={P.yellow} {...line} strokeWidth="2" />
  </g>
);
const cherry = def('life-cherry', 'さくらの えだ', () => (
  <g>
    <path d="M6 82 C26 70 38 52 52 44 C66 36 78 30 94 24" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
    <path d="M6 82 C26 70 38 52 52 44 C66 36 78 30 94 24" fill="none" stroke={P.brown} strokeWidth="4" strokeLinecap="round" />
    {blossom(30, 52, 9)}
    {blossom(60, 30, 9)}
    {blossom(76, 54, 8)}
  </g>
));

const redleaf = def('life-redleaf', 'もみじの は', () => (
  <g>
    <path d="M50 94 L50 70" fill="none" {...line} strokeWidth="4.5" />
    <path
      d="M50 8 L58 28 L78 20 L70 42 L92 48 L70 60 L76 80 L54 70 L50 90 L46 70 L24 80 L30 60 L8 48 L30 42 L22 20 L42 28 Z"
      fill={P.red}
      {...line}
    />
    <path d="M50 70 L50 30 M50 62 L30 48 M50 62 L70 48" fill="none" stroke={P.redDark} strokeWidth="2.5" strokeLinecap="round" />
  </g>
));

const ARMS = [0, 60, 120, 180, 240, 300];
const snowflake = def('life-snowflake', 'ゆきの けっしょう', () => {
  const arm = (a: number) => {
    const r = (d: number) => `${(50 + Math.cos(((a - 90) * Math.PI) / 180) * d).toFixed(1)}`;
    const s = (d: number) => `${(50 + Math.sin(((a - 90) * Math.PI) / 180) * d).toFixed(1)}`;
    const b = (d: number, w: number, sign: number) => {
      const bx = Number(r(d));
      const by = Number(s(d));
      const ax = Math.cos(((a - 90 + sign * 50) * Math.PI) / 180) * w;
      const ay = Math.sin(((a - 90 + sign * 50) * Math.PI) / 180) * w;
      return `M${bx} ${by} L${(bx + ax).toFixed(1)} ${(by + ay).toFixed(1)}`;
    };
    return `M50 50 L${r(40)} ${s(40)} ${b(26, 11, 1)} ${b(26, 11, -1)}`;
  };
  const d = ARMS.map(arm).join(' ');
  return (
    <g>
      <circle cx="50" cy="50" r="46" fill={P.sky} {...line} />
      <path d={d} fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={P.white} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
});

const snowman = def('life-snowman', 'ゆきだるま', () => (
  <g>
    <circle cx="50" cy="68" r="24" fill={P.white} {...line} />
    <circle cx="50" cy="34" r="16" fill={P.white} {...line} />
    <path d="M32 24 L68 24 L62 8 L38 8 Z" fill={P.blue} {...line} />
    <rect x="30" y="22" width="40" height="6" rx="3" fill={P.blue} {...line} />
    <circle cx="44" cy="33" r="2.4" fill={INK} />
    <circle cx="56" cy="33" r="2.4" fill={INK} />
    <path d="M50 38 L64 42 L50 45 Z" fill={P.orange} {...line} strokeWidth="2.5" />
    <circle cx="50" cy="60" r="2.6" fill={INK} />
    <circle cx="50" cy="70" r="2.6" fill={INK} />
    <circle cx="50" cy="80" r="2.6" fill={INK} />
    <path d="M28 62 L12 52 M72 62 L88 52" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
    <path d="M28 62 L12 52 M72 62 L88 52" fill="none" stroke={P.brown} strokeWidth="4" strokeLinecap="round" />
    <ellipse cx="42" cy="58" rx="4" ry="6" transform="rotate(30 42 58)" fill={HIGHLIGHT} opacity="0.5" />
  </g>
));

const swimring = def('life-swimring', 'うきわ', () => (
  <g>
    <path
      d="M50 8 A42 42 0 1 0 50.01 8 Z M50 30 A20 20 0 1 1 49.99 30 Z"
      fillRule="evenodd"
      fill={P.red}
      {...line}
    />
    {[0, 90, 180, 270].map((a) => {
      const x = 50 + Math.cos((a * Math.PI) / 180) * 31;
      const y = 50 + Math.sin((a * Math.PI) / 180) * 31;
      return <ellipse key={a} cx={x} cy={y} rx="7" ry="7" fill={P.white} {...line} strokeWidth="2.5" />;
    })}
  </g>
));

// ---- 植物 ----
const soil = (
  <path d="M10 92 C10 80 26 74 50 74 C74 74 90 80 90 92 Z" fill={P.brown} {...line} />
);
const seed = def('life-seed', 'たね', () => (
  <g>
    {soil}
    <ellipse cx="38" cy="58" rx="9" ry="13" transform="rotate(-25 38 58)" fill={P.tan} {...line} />
    <ellipse cx="62" cy="60" rx="9" ry="13" transform="rotate(25 62 60)" fill={P.tan} {...line} />
    <ellipse cx="35" cy="54" rx="2.5" ry="5" transform="rotate(-25 35 54)" fill={HIGHLIGHT} opacity="0.7" />
    <ellipse cx="59" cy="56" rx="2.5" ry="5" transform="rotate(25 59 56)" fill={HIGHLIGHT} opacity="0.7" />
  </g>
));
const sprout = def('life-sprout', 'め（ふたば）', () => (
  <g>
    {soil}
    <path d="M50 76 L50 52" fill="none" {...line} strokeWidth="5" />
    <path d="M50 54 C36 56 24 48 22 34 C36 32 48 40 50 54 Z" fill={P.green} {...line} />
    <path d="M50 54 C64 56 76 48 78 34 C64 32 52 40 50 54 Z" fill={P.green} {...line} />
  </g>
));
const leafShape = (x: number, y: number, rot: number, s = 1) => (
  <path
    key={`${x}-${y}`}
    transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}
    d="M0 0 C-12 -8 -12 -26 0 -34 C12 -26 12 -8 0 0 Z"
    fill={P.green}
    {...line}
  />
);
const leaves = def('life-leaves', 'はっぱが ふえた', () => (
  <g>
    {soil}
    <path d="M50 76 L50 26" fill="none" {...line} strokeWidth="5" />
    {leafShape(50, 66, -70, 0.9)}
    {leafShape(50, 66, 70, 0.9)}
    {leafShape(50, 50, -62, 0.85)}
    {leafShape(50, 50, 62, 0.85)}
    {leafShape(50, 36, 0, 0.95)}
  </g>
));
const bud = def('life-bud', 'つぼみ', () => (
  <g>
    {soil}
    <path d="M50 76 L50 36" fill="none" {...line} strokeWidth="5" />
    {leafShape(50, 66, -70, 0.9)}
    {leafShape(50, 66, 70, 0.9)}
    <path d="M50 38 C34 34 34 12 50 8 C66 12 66 34 50 38 Z" fill={P.pink} {...line} />
    <path d="M50 38 C40 34 38 22 42 16 C46 22 50 28 50 38 Z" fill={P.green} {...line} strokeWidth="2.5" />
    <path d="M50 38 C60 34 62 22 58 16 C54 22 50 28 50 38 Z" fill={P.green} {...line} strokeWidth="2.5" />
  </g>
));
const wateringCan = def('life-watering-can', 'じょうろ', () => (
  <g>
    <path d="M20 40 L66 40 L62 86 L24 86 Z" fill={P.blue} {...line} />
    <path d="M66 52 L90 30 L96 36 L70 66" fill={P.blue} {...line} />
    <path d="M90 30 L96 36 L100 28 Z" fill={P.sky} {...line} strokeWidth="2.5" />
    <path d="M24 46 C4 46 4 74 24 74" fill="none" {...line} strokeWidth="5" />
    <ellipse cx="43" cy="40" rx="23" ry="6" fill={P.sky} {...line} />
    <rect x="30" y="52" width="6" height="26" rx="3" fill={HIGHLIGHT} opacity="0.6" />
    <path d="M92 44 L88 52 M98 46 L95 56" fill="none" stroke={P.sky} strokeWidth="3" strokeLinecap="round" />
  </g>
));
const pot = def('life-pot', 'うえきばち', () => (
  <g>
    <path d="M26 50 L74 50 L68 92 L32 92 Z" fill={P.orange} {...line} />
    <rect x="22" y="42" width="56" height="12" rx="4" fill={P.orange} {...line} />
    <ellipse cx="50" cy="42" rx="26" ry="4" fill={P.brown} {...line} strokeWidth="2.5" />
    <path d="M50 42 L50 26" fill="none" {...line} strokeWidth="4.5" />
    <path d="M50 28 C40 30 32 24 30 14 C40 12 48 18 50 28 Z" fill={P.green} {...line} strokeWidth="3" />
    <path d="M50 28 C60 30 68 24 70 14 C60 12 52 18 50 28 Z" fill={P.green} {...line} strokeWidth="3" />
    <rect x="34" y="60" width="5" height="22" rx="2.5" fill={HIGHLIGHT} opacity="0.5" />
  </g>
));

// ---- 町の建物（形をそろえ、かんばんで見分ける） ----
interface Shop {
  wall: string;
  roof: string;
  /** かんばんの絵（中心 0,0・幅 ±10 くらい） */
  sign: ReactElement;
  /** かんばんの白い丸をしく（屋根の上に置く絵はしかない） */
  plaque?: boolean;
  awning?: string;
}
function building({ wall, roof, sign, plaque = true, awning }: Shop) {
  return (
    <g>
      <rect x="14" y="42" width="72" height="48" fill={wall} {...line} />
      <path d="M8 44 L50 10 L92 44 Z" fill={roof} {...line} />
      <rect x="40" y="62" width="20" height="28" rx="2" fill={P.wood} {...line} strokeWidth="2.5" />
      <circle cx="56" cy="77" r="1.8" fill={INK} />
      <rect x="20" y="52" width="16" height="14" rx="2" fill={P.sky} {...line} strokeWidth="2.5" />
      <rect x="64" y="52" width="16" height="14" rx="2" fill={P.sky} {...line} strokeWidth="2.5" />
      {awning ? (
        <path d="M14 46 L86 46 L86 54 L14 54 Z" fill={awning} {...line} strokeWidth="2.5" />
      ) : null}
      <g transform="translate(50 29)">
        {plaque ? <circle r="13" fill={P.white} {...line} strokeWidth="2.5" /> : null}
        {sign}
      </g>
    </g>
  );
}
const signBread = (
  <g transform="scale(0.21) translate(-50 -50)">
    <path
      d="M20 76 C10 76 8 66 14 60 C4 46 14 26 32 26 C40 18 60 18 68 26 C86 26 96 46 86 60 C92 66 90 76 80 76 Z"
      fill={P.brown}
      {...line}
      strokeWidth="9"
    />
    <path d="M34 48 L46 36 M54 50 L66 38" fill="none" stroke={P.cream} strokeWidth="9" strokeLinecap="round" />
  </g>
);
const signPlus = (
  <path d="M0 -8 L0 8 M-8 0 L8 0" fill="none" stroke={P.green} strokeWidth="5.5" strokeLinecap="round" />
);
const signBook = (
  <g transform="scale(0.2) translate(-50 -50)">
    <path d="M50 30 C38 22 22 22 10 28 L10 76 C22 70 38 70 50 78 C62 70 78 70 90 76 L90 28 C78 22 62 22 50 30 Z" fill={P.sky} {...line} strokeWidth="9" />
    <path d="M50 30 L50 78" fill="none" {...line} strokeWidth="9" />
  </g>
);
const signClock = (
  <path d="M0 -8 L0 0 L6 4" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
);
const signLamp = (
  <g transform="translate(0 -2)">
    <path d="M-10 6 A10 10 0 0 1 10 6 Z" fill={P.red} {...line} strokeWidth="2.5" />
    <rect x="-12" y="6" width="24" height="5" rx="1.5" fill={P.white} {...line} strokeWidth="2.5" />
  </g>
);
const signFlower = (
  <g transform="scale(0.2) translate(-50 -40)">
    {[
      [50, 18],
      [67.1, 30.4],
      [60.6, 50.6],
      [39.4, 50.6],
      [32.9, 30.4],
    ].map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r="14" fill={P.pink} {...line} strokeWidth="9" />
    ))}
    <circle cx="50" cy="36" r="9" fill={P.yellow} {...line} strokeWidth="9" />
  </g>
);
const signCarrot = (
  <g transform="scale(0.2) translate(-50 -50)">
    <path d="M24 40 L80 60 C84 70 78 78 70 76 L22 56 C18 48 20 42 24 40 Z" fill={P.orange} {...line} strokeWidth="9" />
    <path d="M20 44 L6 32 M16 52 L2 54" fill="none" stroke={P.green} strokeWidth="10" strokeLinecap="round" />
  </g>
);

const bakery = def('life-bakery', 'パンやさん', () => building({ wall: P.cream, roof: P.red, sign: signBread, awning: P.orange }));
const hospital = def('life-hospital', 'びょういん', () => building({ wall: P.white, roof: P.sky, sign: signPlus }));
const library = def('life-library', 'としょかん', () => building({ wall: P.tan, roof: P.brown, sign: signBook }));
const station = def('life-station', 'えき', () => building({ wall: P.cream, roof: P.blue, sign: signClock }));
const police = def('life-police', 'こうばん', () => building({ wall: P.white, roof: P.blue, sign: signLamp, plaque: false }));
const flowerShop = def('life-flowershop', 'おはなやさん', () => building({ wall: P.pink, roof: P.green, sign: signFlower, awning: P.white }));
const vegeShop = def('life-vegeshop', 'やおやさん', () => building({ wall: P.cream, roof: P.greenDark, sign: signCarrot, awning: P.green }));const fireStation = def('life-firestation', 'しょうぼうしょ', () => (
  <g>
    <rect x="12" y="44" width="76" height="46" fill={P.red} {...line} />
    <rect x="62" y="12" width="22" height="34" fill={P.red} {...line} />
    <rect x="66" y="18" width="14" height="10" rx="2" fill={P.sky} {...line} strokeWidth="2.5" />
    <path d="M58 12 L88 12 L74 2 Z" fill={P.gray} {...line} strokeWidth="2.5" />
    <rect x="20" y="56" width="38" height="34" rx="3" fill={P.white} {...line} />
    <path d="M20 66 L58 66 M20 76 L58 76" fill="none" {...line} strokeWidth="2.5" />
    <circle cx="74" cy="72" r="6" fill={P.yellow} {...line} strokeWidth="2.5" />
    <circle cx="23" cy="53" r="2.5" fill={P.yellow} />
  </g>
));

export const lifeG12Illust: IllustGroup = {
  'life-mushroom': reuse(mushroom, 'life-mushroom', 'きのこ'),
  'life-sun': reuse(sun, 'life-sun', 'おひさま'),
  'life-signal-red': signalRed,
  'life-signal-green': signalGreen,
  'life-crosswalk': crosswalk,
  'life-cherry': cherry,
  'life-redleaf': redleaf,
  'life-snowflake': snowflake,
  'life-snowman': snowman,
  'life-swimring': swimring,
  'life-seed': seed,
  'life-sprout': sprout,
  'life-leaves': leaves,
  'life-bud': bud,
  'life-watering-can': wateringCan,
  'life-pot': pot,
  'life-bakery': bakery,
  'life-hospital': hospital,
  'life-library': library,
  'life-station': station,
  'life-police': police,
  'life-flowershop': flowerShop,
  'life-vegeshop': vegeShop,
  'life-firestation': fireStation,
};
