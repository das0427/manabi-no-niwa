/**
 * en-g34（外国語活動 3・4年）の絵: きもち・ようすの かお 10種（g3.en.greetings）。
 * 画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・palette の色だけ・文字なし）。
 * 表情は 目・まゆ・口と、まわりの しるし（なみだ・あせ・あわ など）で区別する（色だけで区別しない）。
 */
import type { ReactElement } from 'react';
import { CHEEK, INK, line, type IllustDef, type IllustGroup } from '../types';
import { P } from '../palette';

/** かおの 土台（かお・かみ） */
function Face({
  fill = P.cream,
  children,
}: {
  fill?: string;
  children?: ReactElement | ReactElement[];
}) {
  return (
    <g>
      <circle cx="50" cy="56" r="34" fill={fill} {...line} />
      <path
        d="M17 50 C18 24 82 24 83 50 C72 40 60 36 50 40 C40 36 28 40 17 50 Z"
        fill={P.brown}
        {...line}
      />
      {children}
    </g>
  );
}

const cheeks = (
  <g>
    <circle cx="32" cy="68" r="5" fill={CHEEK} />
    <circle cx="68" cy="68" r="5" fill={CHEEK} />
  </g>
);
const dotEyes = (
  <g>
    <circle cx="38" cy="57" r="3.5" fill={INK} />
    <circle cx="62" cy="57" r="3.5" fill={INK} />
  </g>
);
const closedEyes = (
  <g>
    <path d="M32 58 L44 58" fill="none" {...line} />
    <path d="M56 58 L68 58" fill="none" {...line} />
  </g>
);

const def = (id: string, label: string, draw: () => ReactElement): IllustDef => ({
  id,
  label,
  status: 'final',
  draw,
});

const happy = def('eng34-face-happy', 'うれしい かお', () => (
  <Face>
    <path d="M32 59 Q38 51 44 59" fill="none" {...line} />
    <path d="M56 59 Q62 51 68 59" fill="none" {...line} />
    <path d="M36 70 Q50 86 64 70 Z" fill={P.red} {...line} />
    {cheeks}
  </Face>
));

const sad = def('eng34-face-sad', 'かなしい かお', () => (
  <Face>
    <path d="M31 50 L43 46" fill="none" {...line} />
    <path d="M57 46 L69 50" fill="none" {...line} />
    {dotEyes}
    <path d="M40 78 Q50 68 60 78" fill="none" {...line} />
    <path
      d="M36 63 C33 69 33 73 36 74 C39 73 39 69 36 63 Z"
      fill={P.sky}
      {...line}
      strokeWidth="2.5"
    />
  </Face>
));

const angry = def('eng34-face-angry', 'おこった かお', () => (
  <Face>
    <path d="M30 46 L44 52" fill="none" {...line} />
    <path d="M70 46 L56 52" fill="none" {...line} />
    {dotEyes}
    <path d="M38 78 Q50 66 62 78" fill="none" {...line} />
    <path
      d="M80 18 C76 12 82 8 86 12 C90 8 96 12 92 18 C96 22 90 28 86 24 C82 28 76 24 80 18 Z"
      fill={P.gray}
      {...line}
      strokeWidth="2.5"
    />
  </Face>
));

const fine = def('eng34-face-fine', 'げんきな かお', () => (
  <Face>
    {dotEyes}
    <path d="M38 70 Q50 80 62 70" fill="none" {...line} />
    {cheeks}
    <path
      d="M86 14 L89 22 L97 23 L91 28 L93 36 L86 31 L79 36 L81 28 L75 23 L83 22 Z"
      fill={P.yellow}
      {...line}
      strokeWidth="2.5"
    />
  </Face>
));

const sleepy = def('eng34-face-sleepy', 'ねむい かお', () => (
  <Face>
    {closedEyes}
    <ellipse cx="50" cy="76" rx="5" ry="4" fill={P.redDark} {...line} strokeWidth="2.5" />
    <circle cx="74" cy="76" r="9" fill={P.sky} {...line} strokeWidth="2.5" />
    <circle cx="71" cy="73" r="2.5" fill={P.white} />
  </Face>
));

const hungry = def('eng34-face-hungry', 'おなかが すいた かお', () => (
  <Face>
    {dotEyes}
    <ellipse cx="50" cy="74" rx="8" ry="7" fill={P.redDark} {...line} />
    <path
      d="M60 76 C59 81 60 84 62 84 C64 84 65 81 63 76 Z"
      fill={P.sky}
      {...line}
      strokeWidth="2"
    />
    <path d="M80 6 L94 26 L66 26 Z" fill={P.white} {...line} strokeWidth="2.5" />
    <rect x="73" y="18" width="14" height="8" fill={P.ink} />
  </Face>
));

const tired = def('eng34-face-tired', 'つかれた かお', () => (
  <Face>
    <path d="M32 56 Q38 61 44 56" fill="none" {...line} />
    <path d="M56 56 Q62 61 68 56" fill="none" {...line} />
    <path d="M38 76 Q44 72 50 76 Q56 80 62 76" fill="none" {...line} />
    <path
      d="M84 30 C80 38 80 42 84 44 C88 42 88 38 84 30 Z"
      fill={P.sky}
      {...line}
      strokeWidth="2.5"
    />
    <path
      d="M10 34 C7 40 7 43 10 45 C13 43 13 40 10 34 Z"
      fill={P.sky}
      {...line}
      strokeWidth="2.5"
    />
  </Face>
));

const thirsty = def('eng34-face-thirsty', 'のどが かわいた かお', () => (
  <Face>
    {dotEyes}
    <path d="M40 72 Q50 78 60 72 Z" fill={P.redDark} {...line} strokeWidth="2.5" />
    <path d="M47 75 Q50 84 53 75 Z" fill={P.pink} {...line} strokeWidth="2" />
    <path d="M78 8 L94 8 L91 32 L81 32 Z" fill={P.sky} {...line} strokeWidth="2.5" />
    <path d="M80 16 L92 16" fill="none" {...line} strokeWidth="2" />
  </Face>
));

const hot = def('eng34-face-hot', 'あつい かお', () => (
  <Face fill={P.pink}>
    {dotEyes}
    <path d="M40 74 Q50 68 60 74" fill="none" {...line} />
    <path
      d="M86 40 C82 48 82 52 86 54 C90 52 90 48 86 40 Z"
      fill={P.sky}
      {...line}
      strokeWidth="2.5"
    />
    <path
      d="M14 40 C10 48 10 52 14 54 C18 52 18 48 14 40 Z"
      fill={P.sky}
      {...line}
      strokeWidth="2.5"
    />
    <circle cx="88" cy="14" r="8" fill={P.sun} {...line} strokeWidth="2.5" />
  </Face>
));

const cold = def('eng34-face-cold', 'さむい かお', () => (
  <Face>
    {dotEyes}
    <path
      d="M38 72 L42 69 L46 72 L50 69 L54 72 L58 69 L62 72"
      fill="none"
      {...line}
      strokeWidth="3"
    />
    <path d="M24 80 Q50 92 76 80 L77 88 Q50 99 23 88 Z" fill={P.red} {...line} />
    <path
      d="M88 6 L88 26 M79 11 L97 21 M97 11 L79 21"
      fill="none"
      {...line}
      stroke={P.blue}
      strokeWidth="3"
    />
  </Face>
));

export const enG34Illust: IllustGroup = Object.fromEntries(
  [happy, sad, angry, fine, sleepy, hungry, tired, thirsty, hot, cold].map((d) => [d.id, d]),
);
