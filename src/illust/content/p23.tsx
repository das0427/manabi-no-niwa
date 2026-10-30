/**
 * p23（2〜3歳）の教材で使う絵。画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・palette の色だけ・文字なし）。
 * はんこ用に描いた絵（stamps/）は ILLUST に入っていないため、同じ絵を p23- の id で使えるようにする。
 */
import type { ReactElement } from 'react';
import { CHEEK, HIGHLIGHT, INK, line, type IllustDef, type IllustGroup } from '../types';
import { P } from '../palette';
import { book, hat, shoe, clock } from '../stamps/life';
import { sun } from '../stamps/nature';
import { star } from '../stamps/decor';
import { apple } from '../food/apple';
import { tomato } from '../food/tomato';
import { carRed } from '../vehicle/car-red';
import { busYellow } from '../vehicle/bus-yellow';
import { ship } from '../vehicle/ship';
import { umbrella } from '../thing/umbrella';
import { elephant } from '../animal/elephant';
import { turtle } from '../animal/turtle';

const reuse = (def: IllustDef, id: string, label: string): IllustDef => ({ ...def, id, label });

const toothbrush: IllustDef = {
  id: 'p23-toothbrush',
  label: 'はぶらし',
  status: 'final',
  draw: () => (
    <g transform="rotate(-35 50 50)">
      <rect x="10" y="44" width="62" height="12" rx="6" fill={P.blue} {...line} />
      <rect x="66" y="40" width="26" height="16" rx="4" fill={P.white} {...line} />
      <path d="M70 40 L70 28 M76 40 L76 28 M82 40 L82 28 M88 40 L88 28" fill="none" {...line} />
      <rect x="67" y="24" width="24" height="6" rx="3" fill={P.white} {...line} strokeWidth="2.5" />
    </g>
  ),
};

const soap: IllustDef = {
  id: 'p23-soap',
  label: 'せっけん',
  status: 'final',
  draw: () => (
    <g>
      <circle cx="30" cy="26" r="8" fill={P.white} {...line} strokeWidth="2.5" />
      <circle cx="48" cy="16" r="6" fill={P.white} {...line} strokeWidth="2.5" />
      <circle cx="66" cy="24" r="9" fill={P.white} {...line} strokeWidth="2.5" />
      <rect x="14" y="40" width="72" height="44" rx="18" fill={P.pink} {...line} />
      <ellipse cx="36" cy="52" rx="10" ry="4" fill={HIGHLIGHT} opacity="0.7" />
    </g>
  ),
};

const spoon: IllustDef = {
  id: 'p23-spoon',
  label: 'スプーン',
  status: 'final',
  draw: () => (
    <g transform="rotate(35 50 50)">
      <ellipse cx="50" cy="26" rx="15" ry="20" fill={P.gray} {...line} />
      <ellipse cx="45" cy="22" rx="4" ry="8" fill={HIGHLIGHT} opacity="0.7" />
      <rect x="45" y="44" width="10" height="48" rx="5" fill={P.gray} {...line} />
    </g>
  ),
};

const towel: IllustDef = {
  id: 'p23-towel',
  label: 'タオル',
  status: 'final',
  draw: () => (
    <g>
      <path d="M8 22 L92 22" fill="none" {...line} strokeWidth="5" />
      <path d="M22 22 L22 84 L78 84 L78 22 Z" fill={P.sky} {...line} />
      <path d="M22 70 L78 70 M22 76 L78 76" fill="none" {...line} strokeWidth="2.5" />
      <path
        d="M26 88 L26 92 M36 88 L36 92 M46 88 L46 92 M56 88 L56 92 M66 88 L66 92"
        fill="none"
        {...line}
        strokeWidth="2.5"
      />
    </g>
  ),
};

const cup: IllustDef = {
  id: 'p23-cup',
  label: 'コップ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M22 18 L78 18 L70 88 L30 88 Z" fill={P.white} {...line} />
      <path d="M26 40 L74 40 L70 84 L30 84 Z" fill={P.sky} />
      <path d="M22 18 L78 18 L70 88 L30 88 Z" fill="none" {...line} />
      <path d="M26 40 L74 40" fill="none" {...line} strokeWidth="2.5" />
      <rect x="32" y="48" width="5" height="26" rx="2.5" fill={HIGHLIGHT} opacity="0.8" />
    </g>
  ),
};

const pillow: IllustDef = {
  id: 'p23-pillow',
  label: 'まくら',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M14 34 C30 26 70 26 86 34 C92 46 92 60 86 72 C70 80 30 80 14 72 C8 60 8 46 14 34 Z"
        fill={P.white}
        {...line}
      />
      <path d="M30 44 C40 48 60 48 70 44" fill="none" {...line} strokeWidth="2.5" />
      <circle cx="36" cy="60" r="3" fill={P.pink} />
      <circle cx="50" cy="62" r="3" fill={P.pink} />
      <circle cx="64" cy="60" r="3" fill={P.pink} />
    </g>
  ),
};

const pig: IllustDef = {
  id: 'p23-pig',
  label: 'ぶた',
  status: 'final',
  draw: () => (
    <g>
      <rect x="22" y="70" width="12" height="18" rx="5" fill={P.pink} {...line} />
      <rect x="58" y="70" width="12" height="18" rx="5" fill={P.pink} {...line} />
      <ellipse cx="46" cy="58" rx="34" ry="24" fill={P.pink} {...line} />
      <path d="M12 54 C6 50 8 44 12 46" fill="none" {...line} strokeWidth="2.5" />
      <path d="M64 30 L70 18 L78 30 Z" fill={P.pink} {...line} />
      <ellipse cx="74" cy="44" rx="16" ry="15" fill={P.pink} {...line} />
      <ellipse cx="84" cy="48" rx="8" ry="6" fill={P.pink} {...line} />
      <circle cx="82" cy="48" r="1.5" fill={INK} />
      <circle cx="87" cy="48" r="1.5" fill={INK} />
      <circle cx="72" cy="40" r="2.6" fill={INK} />
      <ellipse cx="68" cy="50" rx="4" ry="3" fill={CHEEK} opacity="0.8" />
    </g>
  ),
};

const sheep: IllustDef = {
  id: 'p23-sheep',
  label: 'ひつじ',
  status: 'final',
  draw: () => (
    <g>
      <rect x="26" y="68" width="9" height="22" rx="4" fill={INK} />
      <rect x="54" y="68" width="9" height="22" rx="4" fill={INK} />
      <path
        d="M20 60 C10 56 12 42 22 42 C22 32 36 28 42 34 C46 26 60 26 64 34 C72 30 82 38 76 48 C84 54 78 68 68 66 C64 74 50 74 46 68 C40 74 26 72 26 66 C22 66 20 64 20 60 Z"
        fill={P.white}
        {...line}
      />
      <ellipse cx="80" cy="42" rx="11" ry="13" fill={P.gray} {...line} />
      <ellipse
        cx="70"
        cy="34"
        rx="7"
        ry="3.5"
        transform="rotate(-20 70 34)"
        fill={P.gray}
        {...line}
        strokeWidth="2.5"
      />
      <circle cx="83" cy="40" r="2.4" fill={INK} />
      <ellipse cx="78" cy="48" rx="3" ry="2" fill={CHEEK} opacity="0.8" />
    </g>
  ),
};

const duck: IllustDef = {
  id: 'p23-duck',
  label: 'あひる',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M12 56 C14 76 34 86 54 84 C74 82 84 70 82 56 C70 60 50 60 40 52 C30 46 18 48 12 56 Z"
        fill={P.white}
        {...line}
      />
      <path d="M40 64 C50 72 62 72 70 66" fill="none" {...line} strokeWidth="2.5" />
      <circle cx="66" cy="34" r="16" fill={P.white} {...line} />
      <path d="M80 34 L94 38 L80 44 Z" fill={P.orange} {...line} />
      <circle cx="70" cy="30" r="2.6" fill={INK} />
      <ellipse cx="64" cy="40" rx="3.5" ry="2.5" fill={CHEEK} opacity="0.8" />
    </g>
  ),
};

// ---- p23.think.peekaboo: かくれ場所と、すこし みえて いる からだ（設計書 p23.md 2章）----
type Place = 'cup' | 'box';
const PLACE_NAME: Record<Place, string> = { cup: 'カップ', box: 'はこ' };

const hideCup: IllustDef = {
  id: 'p23-hide-cup',
  label: 'カップ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M30 42 L70 42 L80 92 L20 92 Z" fill={P.blue} {...line} />
      <path d="M22 84 L78 84" fill="none" {...line} />
      <rect x="36" y="52" width="5" height="26" rx="2.5" fill={HIGHLIGHT} opacity="0.8" />
    </g>
  ),
};

const hideBox: IllustDef = {
  id: 'p23-hide-box',
  label: 'はこ',
  status: 'final',
  draw: () => (
    <g>
      <rect x="20" y="50" width="60" height="42" rx="3" fill={P.tan} {...line} />
      <path d="M20 50 L14 38 L36 42 L36 50 Z" fill={P.tan} {...line} />
      <path d="M80 50 L86 38 L64 42 L64 50 Z" fill={P.tan} {...line} />
      <path d="M42 50 L42 62 L58 62 L58 50" fill="none" stroke={P.brown} strokeWidth="3" />
      <path d="M20 62 L80 62" fill="none" stroke={P.brown} strokeWidth="2.5" />
    </g>
  ),
};

/** かくれ場所の うしろから みえる ところ（色・形は全身の絵と同じ） */
const PEEK_PART: Record<string, () => ReactElement> = {
  rabbit: () => (
    <g transform="translate(-7 14)">
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
    </g>
  ),
  bear: () => (
    <g>
      <circle cx="38" cy="37" r="9" fill={P.brown} {...line} />
      <circle cx="38" cy="37" r="4" fill={P.tan} />
      <circle cx="62" cy="37" r="9" fill={P.brown} {...line} />
      <circle cx="62" cy="37" r="4" fill={P.tan} />
    </g>
  ),
  elephant: () => (
    <g>
      <path
        d="M60 62 C84 52 96 62 92 82"
        fill="none"
        stroke={INK}
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M60 62 C84 52 96 62 92 82"
        fill="none"
        stroke={P.gray}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </g>
  ),
  fox: () => (
    <g>
      <path
        d="M60 72 C80 76 92 64 90 46"
        fill="none"
        stroke={INK}
        strokeWidth="24"
        strokeLinecap="round"
      />
      <path
        d="M60 72 C80 76 92 64 90 56"
        fill="none"
        stroke={P.orange}
        strokeWidth="17"
        strokeLinecap="round"
      />
      <path
        d="M90 58 C91 54 90 50 90 46"
        fill="none"
        stroke={P.white}
        strokeWidth="17"
        strokeLinecap="round"
      />
    </g>
  ),
  turtle: () => (
    <g>
      <path d="M26 58 C26 20 74 20 74 58 Z" fill={P.brown} {...line} />
      <path
        d="M42 34 L58 34 L65 43 L58 52 L42 52 L35 43 Z"
        fill="none"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>
  ),
  duck: () => (
    <g>
      <circle cx="46" cy="42" r="15" fill={P.white} {...line} />
      <path d="M58 36 L76 41 L58 47 Z" fill={P.orange} {...line} />
      <circle cx="50" cy="35" r="2.6" fill={INK} />
    </g>
  ),
  pig: () => (
    <g>
      <path
        d="M62 72 C78 72 90 68 90 60 C90 54 82 54 82 60"
        fill="none"
        stroke={INK}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M62 72 C78 72 90 68 90 60 C90 54 82 54 82 60"
        fill="none"
        stroke={P.pink}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </g>
  ),
  cat: () => (
    <g>
      <path d="M32 52 L34 24 L50 44 Z" fill={P.orange} {...line} />
      <path d="M36 42 L37 32 L44 39 Z" fill={P.pink} />
      <path d="M68 52 L66 24 L50 44 Z" fill={P.orange} {...line} />
    </g>
  ),
};
const PEEK_NAME: Record<string, string> = {
  rabbit: 'うさぎ',
  bear: 'くま',
  elephant: 'ぞう',
  fox: 'きつね',
  turtle: 'かめ',
  duck: 'あひる',
  pig: 'ぶた',
  cat: 'ねこ',
};
const HIDER: Record<Place, IllustDef> = { cup: hideCup, box: hideBox };

function peek(animal: string, place: Place): IllustDef {
  return {
    id: `p23-peek-${animal}-${place}`,
    label: `${PLACE_NAME[place]}の ${PEEK_NAME[animal]}`,
    status: 'final',
    draw: () => (
      <g>
        {PEEK_PART[animal]!()}
        {HIDER[place].draw()}
      </g>
    ),
  };
}

const peekGroup: IllustGroup = { 'p23-hide-cup': hideCup, 'p23-hide-box': hideBox };
for (const a of Object.keys(PEEK_PART))
  for (const pl of ['cup', 'box'] as const) {
    const d = peek(a, pl);
    peekGroup[d.id] = d;
  }

// ---- p23.math.puzzle2: 絵を半分に切った札（設計書 p23.md 3章）----
interface PuzSrc {
  p: string;
  name: string;
  def: IllustDef;
  /** 切る位置（x。元の絵の真ん中からずれる絵だけ変える） */
  cut: number;
}
const PUZ: PuzSrc[] = [
  { p: 'apple', name: 'りんご', def: apple, cut: 50 },
  { p: 'tomato', name: 'トマト', def: tomato, cut: 50 },
  { p: 'car', name: 'くるま', def: carRed, cut: 50 },
  { p: 'bus', name: 'バス', def: busYellow, cut: 50 },
  { p: 'elephant', name: 'ぞう', def: elephant, cut: 50 },
  { p: 'turtle', name: 'かめ', def: turtle, cut: 50 },
  { p: 'umbrella', name: 'かさ', def: umbrella, cut: 50 },
  { p: 'ship', name: 'ふね', def: ship, cut: 50 },
];

const SLOT = {
  fill: 'none',
  stroke: INK,
  strokeWidth: 3,
  strokeDasharray: '6 6',
  rx: 8,
  y: 8,
  height: 84,
} as const;

function halfPiece(s: PuzSrc, side: 'l' | 'r', moved: boolean): ReactElement {
  const id = `p23puz-${s.p}-${side}`;
  const x0 = side === 'l' ? 0 : s.cut;
  const w = side === 'l' ? s.cut : 100 - s.cut;
  const dx = moved ? 50 - (x0 + w / 2) : 0;
  return (
    <g transform={`translate(${dx} 0)`}>
      <clipPath id={id}>
        <rect x={x0} y="0" width={w} height="100" />
      </clipPath>
      <g clipPath={`url(#${id})`}>{s.def.draw()}</g>
    </g>
  );
}

const puzGroup: IllustGroup = {};
for (const s of PUZ) {
  const add = (suffix: string, label: string, draw: () => ReactElement) => {
    const id = `p23-puz-${s.p}-${suffix}`;
    puzGroup[id] = { id, label: `${s.name}の ${label}`, status: 'final', draw };
  };
  add('l', 'ひだり はんぶん', () => halfPiece(s, 'l', true));
  add('r', 'みぎ はんぶん', () => halfPiece(s, 'r', true));
  add('lslot', 'ひだり はんぶんと おきば', () => (
    <g>
      {halfPiece(s, 'l', false)}
      <rect x="52" width="44" {...SLOT} />
    </g>
  ));
  add('rslot', 'みぎ はんぶんと おきば', () => (
    <g>
      {halfPiece(s, 'r', false)}
      <rect x="4" width="44" {...SLOT} />
    </g>
  ));
}

export const p23Illust: IllustGroup = {
  ...peekGroup,
  ...puzGroup,
  'p23-toothbrush': toothbrush,
  'p23-soap': soap,
  'p23-spoon': spoon,
  'p23-towel': towel,
  'p23-cup': cup,
  'p23-pillow': pillow,
  'p23-pig': pig,
  'p23-sheep': sheep,
  'p23-duck': duck,
  'p23-shoe': reuse(shoe, 'p23-shoe', 'くつ'),
  'p23-hat': reuse(hat, 'p23-hat', 'ぼうし'),
  'p23-book': reuse(book, 'p23-book', 'えほん'),
  'p23-clock': reuse(clock, 'p23-clock', 'とけい'),
  'p23-sun': reuse(sun, 'p23-sun', 'おひさま'),
  'p23-star': reuse(star, 'p23-star', 'ほし'),
};
