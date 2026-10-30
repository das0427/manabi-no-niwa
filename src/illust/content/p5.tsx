/**
 * p5（5歳）の教材で使う絵。画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・palette の色だけ・文字なし）。
 * はんこ用に描いた絵（stamps/）は ILLUST に入っていないため、同じ絵を p5- の id で使えるようにする。
 */
import { HIGHLIGHT, INK, line, type IllustDef, type IllustGroup } from '../types';
import { P } from '../palette';
import { book, clock, hat } from '../stamps/life';
import { moon, sun } from '../stamps/nature';
import { rocket, truck } from '../stamps/vehicle';
import { balloon, musicNote, ribbon } from '../stamps/decor';

const reuse = (def: IllustDef, id: string, label: string): IllustDef => ({ ...def, id, label });

const box: IllustDef = {
  id: 'p5-box',
  label: 'はこ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M14 36 L50 22 L86 36 L50 50 Z" fill={P.tan} {...line} />
      <path d="M14 36 L50 50 L50 90 L14 76 Z" fill={P.wood} {...line} />
      <path d="M86 36 L50 50 L50 90 L86 76 Z" fill={P.brown} {...line} />
    </g>
  ),
};

const can: IllustDef = {
  id: 'p5-can',
  label: 'つつ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M22 22 L22 80 C22 92 78 92 78 80 L78 22" fill={P.sky} {...line} />
      <ellipse cx="50" cy="22" rx="28" ry="10" fill={P.white} {...line} />
      <rect x="30" y="40" width="6" height="34" rx="3" fill={HIGHLIGHT} opacity="0.7" />
    </g>
  ),
};

const cake: IllustDef = {
  id: 'p5-cake',
  label: 'ケーキ',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M50 10 C46 16 46 20 50 22 C54 20 54 16 50 10 Z"
        fill={P.orange}
        {...line}
        strokeWidth="2.5"
      />
      <rect x="47" y="22" width="6" height="16" fill={P.pink} {...line} strokeWidth="2.5" />
      <rect x="14" y="38" width="72" height="50" rx="6" fill={P.cream} {...line} />
      <path
        d="M14 52 C24 60 32 46 42 54 C52 62 60 46 70 54 C78 60 84 52 86 50"
        fill="none"
        {...line}
      />
      <circle cx="30" cy="44" r="5" fill={P.red} {...line} strokeWidth="2.5" />
      <circle cx="70" cy="44" r="5" fill={P.red} {...line} strokeWidth="2.5" />
    </g>
  ),
};

const icecream: IllustDef = {
  id: 'p5-icecream',
  label: 'アイス',
  status: 'final',
  draw: () => (
    <g>
      <path d="M30 46 L50 94 L70 46 Z" fill={P.tan} {...line} />
      <path d="M36 56 L64 56 M40 66 L60 66" fill="none" {...line} strokeWidth="2.5" />
      <circle cx="50" cy="34" r="22" fill={P.pink} {...line} />
      <ellipse cx="42" cy="26" rx="5" ry="3" fill={HIGHLIGHT} opacity="0.8" />
    </g>
  ),
};

const tv: IllustDef = {
  id: 'p5-tv',
  label: 'テレビ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M36 18 L50 30 L64 14" fill="none" {...line} />
      <rect x="10" y="30" width="80" height="54" rx="8" fill={P.gray} {...line} />
      <rect x="18" y="38" width="56" height="38" rx="4" fill={P.sky} {...line} strokeWidth="2.5" />
      <circle cx="82" cy="46" r="3" fill={INK} />
      <circle cx="82" cy="58" r="3" fill={INK} />
      <path d="M28 84 L24 92 M72 84 L76 92" fill="none" {...line} />
    </g>
  ),
};

/** 切手: ぎざぎざの縁（小さな半円の切れ込み）、内側の枠、花1輪。金額の数字・文字は描かない */
const stamp: IllustDef = {
  id: 'p5-stamp',
  label: 'きって',
  status: 'final',
  draw: () => {
    const notch = 'a6 6 0 0 0';
    const edge =
      `M20 8 ${`${notch} 12 0 `.repeat(5)}` +
      `${`${notch} 0 12 `.repeat(7)}` +
      `${`${notch} -12 0 `.repeat(5)}` +
      `${`${notch} 0 -12 `.repeat(7)}Z`;
    const petals = [0, 72, 144, 216, 288].map((a) => {
      const r = (a * Math.PI) / 180;
      return (
        <circle
          key={a}
          cx={50 + 10 * Math.sin(r)}
          cy={40 - 10 * Math.cos(r)}
          r="7"
          fill={P.pink}
          {...line}
          strokeWidth="2.5"
        />
      );
    });
    return (
      <g>
        <path d={edge} fill={P.white} {...line} />
        <rect x="28" y="16" width="44" height="68" rx="2" fill="none" {...line} strokeWidth="2" />
        <path d="M50 52 L50 76" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <path
          d="M50 52 L50 76"
          fill="none"
          stroke={P.greenDark}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M50 68 C44 68 38 64 36 58 C44 58 50 62 50 68 Z"
          fill={P.green}
          {...line}
          strokeWidth="2.5"
        />
        <path
          d="M50 64 C56 64 62 60 64 54 C56 54 50 58 50 64 Z"
          fill={P.green}
          {...line}
          strokeWidth="2.5"
        />
        {petals}
        <circle cx="50" cy="40" r="6" fill={P.yellow} {...line} strokeWidth="2.5" />
      </g>
    );
  },
};

/** あめ: 雲としずく */
const rain: IllustDef = {
  id: 'p5-rain',
  label: 'あめ',
  status: 'final',
  draw: () => {
    const drop = 'M0 0 C0 0 -7 9 -7 14 A7 7 0 0 0 7 14 C7 9 0 0 0 0 Z';
    return (
      <g>
        <path
          d="M24 50 C10 50 8 32 24 30 C26 16 46 12 52 24 C62 14 80 20 78 34 C94 34 94 50 78 50 Z"
          fill={P.white}
          {...line}
        />
        {[
          [28, 58],
          [50, 62],
          [72, 58],
          [39, 74],
          [61, 76],
        ].map(([x, y]) => (
          <path
            key={`${x}-${y}`}
            d={drop}
            transform={`translate(${x} ${y})`}
            fill={P.blue}
            {...line}
            strokeWidth="2.5"
          />
        ))}
      </g>
    );
  },
};

/** こおり: 角の丸い立方体（面は白と青の2色） */
const ice: IllustDef = {
  id: 'p5-ice',
  label: 'こおり',
  status: 'final',
  draw: () => (
    <g>
      <path d="M16 30 L50 46 L50 88 L16 72 Z" fill={P.white} {...line} />
      <path d="M84 30 L50 46 L50 88 L84 72 Z" fill={P.blue} {...line} />
      <path d="M50 14 L84 30 L50 46 L16 30 Z" fill={P.blue} {...line} />
      <ellipse cx="46" cy="27" rx="7" ry="3" fill={HIGHLIGHT} transform="rotate(24 46 27)" />
    </g>
  ),
};

/** しおれた はな: 植木鉢から伸びて途中で大きく曲がり、下を向いた茎と花、垂れた葉 */
const wilted: IllustDef = {
  id: 'p5-wilted',
  label: 'しおれた はな',
  status: 'final',
  draw: () => {
    const stem = 'M50 66 L50 30 C50 12 78 10 78 28 L78 34';
    return (
      <g>
        <path
          d="M50 50 C42 48 32 52 28 62 C38 64 46 60 50 50 Z"
          fill={P.green}
          {...line}
          strokeWidth="3"
        />
        <path
          d="M50 42 C56 44 62 50 62 58 C56 57 51 51 50 42 Z"
          fill={P.green}
          {...line}
          strokeWidth="3"
        />
        <path
          d={stem}
          fill="none"
          stroke={INK}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={stem}
          fill="none"
          stroke={P.greenDark}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <ellipse
          cx="71"
          cy="47"
          rx="5.5"
          ry="9"
          transform="rotate(25 71 47)"
          fill={P.pink}
          {...line}
          strokeWidth="2.5"
        />
        <ellipse
          cx="85"
          cy="47"
          rx="5.5"
          ry="9"
          transform="rotate(-25 85 47)"
          fill={P.pink}
          {...line}
          strokeWidth="2.5"
        />
        <ellipse cx="78" cy="50" rx="6" ry="9" fill={P.pink} {...line} strokeWidth="2.5" />
        <circle cx="78" cy="38" r="5" fill={P.yellow} {...line} strokeWidth="2.5" />
        <path d="M32 72 L68 72 L63 95 L37 95 Z" fill={P.orange} {...line} />
        <rect x="27" y="64" width="46" height="11" rx="4" fill={P.orange} {...line} />
        <ellipse cx="50" cy="64" rx="22" ry="3.5" fill={P.brown} {...line} strokeWidth="2.5" />
      </g>
    );
  },
};

/** てがみ: 封筒とハートのシール。宛名・文字は描かない */
const letter: IllustDef = {
  id: 'p5-letter',
  label: 'てがみ',
  status: 'final',
  draw: () => (
    <g>
      <rect x="8" y="24" width="84" height="58" rx="5" fill={P.white} {...line} />
      <path d="M8 28 L50 60 L92 28" fill="none" {...line} />
      <path d="M8 80 L38 52 M92 80 L62 52" fill="none" {...line} strokeWidth="2.5" />
      <path
        d="M50 74 C36 66 38 52 46 54 C48 55 50 57 50 59 C50 57 52 55 54 54 C62 52 64 66 50 74 Z"
        fill={P.red}
        {...line}
        strokeWidth="2.5"
      />
    </g>
  ),
};

export const p5Illust: IllustGroup = {
  'p5-box': box,
  'p5-can': can,
  'p5-cake': cake,
  'p5-icecream': icecream,
  'p5-tv': tv,
  'p5-stamp': stamp,
  'p5-rain': rain,
  'p5-ice': ice,
  'p5-wilted': wilted,
  'p5-letter': letter,
  'p5-hat': reuse(hat, 'p5-hat', 'ぼうし'),
  'p5-balloon': reuse(balloon, 'p5-balloon', 'ふうせん'),
  'p5-note': reuse(musicNote, 'p5-note', 'おんぷ'),
  'p5-clock': reuse(clock, 'p5-clock', 'とけい'),
  'p5-book': reuse(book, 'p5-book', 'えほん'),
  'p5-truck': reuse(truck, 'p5-truck', 'トラック'),
  'p5-rocket': reuse(rocket, 'p5-rocket', 'ロケット'),
  'p5-ribbon': reuse(ribbon, 'p5-ribbon', 'リボン'),
  'p5-sun': reuse(sun, 'p5-sun', 'おひさま'),
  'p5-moon': reuse(moon, 'p5-moon', 'つき'),
};
