/**
 * g1-math（小1 算数）の教材で使う絵。画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・palette の色だけ・文字なし）。
 * 立体（はこ・つつ）は ななめから見た形で描く（g1.math.shapes）。
 */
import { HIGHLIGHT, INK, line, type IllustDef, type IllustGroup } from '../types';
import { P } from '../palette';
import { clock } from '../stamps/life';

const reuse = (def: IllustDef, id: string, label: string): IllustDef => ({ ...def, id, label });

/** ななめから見た はこ（直方体）。x,y: 前の面の左上、w,h: 前の面、d: 奥行き */
function cuboid(
  x: number,
  y: number,
  w: number,
  h: number,
  d: number,
  front: string,
  top: string,
  side: string,
) {
  return (
    <g>
      <path
        d={`M${x} ${y} L${x + d} ${y - d} L${x + w + d} ${y - d} L${x + w} ${y} Z`}
        fill={top}
        {...line}
      />
      <path
        d={`M${x + w} ${y} L${x + w + d} ${y - d} L${x + w + d} ${y + h - d} L${x + w} ${y + h} Z`}
        fill={side}
        {...line}
      />
      <rect x={x} y={y} width={w} height={h} fill={front} {...line} />
    </g>
  );
}

/** 立てた つつ（円柱）。cx: 中心、top/bottom: 上下の楕円の中心の y、rx・ry: 楕円 */
function cylinder(
  cx: number,
  top: number,
  bottom: number,
  rx: number,
  ry: number,
  body: string,
  lid: string,
) {
  return (
    <g>
      <path
        d={`M${cx - rx} ${top} L${cx - rx} ${bottom} A${rx} ${ry} 0 0 0 ${cx + rx} ${bottom} L${cx + rx} ${top} Z`}
        fill={body}
        {...line}
      />
      <ellipse cx={cx} cy={top} rx={rx} ry={ry} fill={lid} {...line} />
    </g>
  );
}

const box: IllustDef = {
  id: 'g1m-box',
  label: 'おかしの はこ',
  status: 'final',
  draw: () => (
    <g>
      {cuboid(12, 40, 56, 40, 18, P.red, P.pink, P.redDark)}
      <path d="M22 52 L58 52 M22 66 L48 66" fill="none" {...line} strokeWidth="2.5" />
      <circle cx="56" cy="66" r="5" fill={P.yellow} {...line} strokeWidth="2.5" />
    </g>
  ),
};

const dice: IllustDef = {
  id: 'g1m-dice',
  label: 'さいころ',
  status: 'final',
  draw: () => (
    <g>
      {cuboid(16, 38, 46, 46, 20, P.white, P.cream, P.tan)}
      <circle cx="28" cy="50" r="4" fill={INK} />
      <circle cx="39" cy="61" r="4" fill={P.red} />
      <circle cx="50" cy="72" r="4" fill={INK} />
      <circle cx="72" cy="40" r="3" fill={INK} />
      <circle cx="72" cy="62" r="3" fill={INK} />
    </g>
  ),
};

const tissue: IllustDef = {
  id: 'g1m-tissue',
  label: 'ティッシュの はこ',
  status: 'final',
  draw: () => (
    <g>
      {cuboid(8, 50, 64, 30, 16, P.sky, P.white, P.blue)}
      <path
        d="M38 42 C34 30 42 22 46 30 C50 20 60 24 56 36"
        fill={P.white}
        {...line}
        strokeWidth="2.5"
      />
      <path d="M18 64 C28 58 38 70 48 64" fill="none" {...line} strokeWidth="2.5" />
    </g>
  ),
};

const block: IllustDef = {
  id: 'g1m-block',
  label: 'つみきの はこ',
  status: 'final',
  draw: () => cuboid(14, 34, 40, 52, 22, P.green, P.leaf, P.greenDark),
};

const cheese: IllustDef = {
  id: 'g1m-cheese',
  label: 'さんかくの はこ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M14 82 L34 40 L54 82 Z" fill={P.yellow} {...line} />
      <path d="M34 40 L74 26 L94 68 L54 82 Z" fill={P.orange} {...line} />
      <circle cx="68" cy="52" r="4" fill={P.yellow} {...line} strokeWidth="2.5" />
      <circle cx="30" cy="70" r="3.5" fill={P.orange} {...line} strokeWidth="2.5" />
    </g>
  ),
};

const can: IllustDef = {
  id: 'g1m-can',
  label: 'かん',
  status: 'final',
  draw: () => (
    <g>
      {cylinder(50, 22, 80, 24, 9, P.yellow, P.gray)}
      <path d="M26 42 L74 42 M26 62 L74 62" fill="none" {...line} strokeWidth="2.5" />
      <ellipse cx="50" cy="22" rx="8" ry="3" fill={P.white} {...line} strokeWidth="2" />
      <rect x="32" y="46" width="5" height="12" rx="2.5" fill={HIGHLIGHT} opacity="0.7" />
    </g>
  ),
};

const roll: IllustDef = {
  id: 'g1m-roll',
  label: 'まいた かみ',
  status: 'final',
  draw: () => (
    <g>
      {cylinder(50, 28, 76, 30, 12, P.white, P.white)}
      <ellipse cx="50" cy="28" rx="10" ry="4" fill={P.tan} {...line} strokeWidth="2.5" />
      <path d="M20 52 C34 58 66 58 80 52" fill="none" {...line} strokeWidth="2" />
    </g>
  ),
};

const cyl: IllustDef = {
  id: 'g1m-cyl',
  label: 'つみきの つつ',
  status: 'final',
  draw: () => cylinder(50, 22, 80, 20, 8, P.blue, P.sky),
};

export const g1MathIllust: IllustGroup = {
  'g1m-clock': reuse(clock, 'g1m-clock', 'とけい'),
  'g1m-box': box,
  'g1m-dice': dice,
  'g1m-tissue': tissue,
  'g1m-block': block,
  'g1m-cheese': cheese,
  'g1m-can': can,
  'g1m-roll': roll,
  'g1m-cyl': cyl,
};
