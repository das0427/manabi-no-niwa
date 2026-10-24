/**
 * 教科の絵（小学生ホームの教科の札。DESINGN.md 3.1: 教科は色だけで区別せず、絵と名前を併記）。
 * 画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・グラデーションと影なし）。色は palette.ts だけ。
 */
import { P } from '../palette';
import { line, type IllustDef, type IllustGroup } from '../types';

/** こくご: ひらいた本 */
const subjKokugo: IllustDef = {
  id: 'subj-kokugo',
  label: 'こくご（ほん）',
  status: 'final',
  draw: () => (
    <g>
      <path d="M50 28 C38 20 22 20 12 24 V78 C22 74 38 74 50 82 Z" fill={P.white} {...line} />
      <path d="M50 28 C62 20 78 20 88 24 V78 C78 74 62 74 50 82 Z" fill={P.cream} {...line} />
      <path d="M20 36 H40 M20 46 H40 M20 56 H36" {...line} strokeWidth={3} />
      <path d="M60 36 H80 M60 46 H80 M60 56 H76" {...line} strokeWidth={3} />
      <path d="M68 20 V40 L72 36 L76 40 V20" fill={P.red} {...line} strokeWidth={2.5} />
    </g>
  ),
};

/** さんすう: つみき（1・2・3） */
const subjSansu: IllustDef = {
  id: 'subj-sansu',
  label: 'さんすう（つみき）',
  status: 'final',
  draw: () => (
    <g>
      <rect x="14" y="56" width="30" height="30" rx="3" fill={P.blue} {...line} />
      <rect x="50" y="56" width="30" height="30" rx="3" fill={P.yellow} {...line} />
      <rect x="32" y="20" width="30" height="30" rx="3" fill={P.orange} {...line} />
      {/* さいころの目（絵に文字を描かない: DESINGN.md 6章） */}
      <circle cx="29" cy="71" r="3.5" fill={P.ink} />
      <circle cx="59" cy="65" r="3.5" fill={P.ink} />
      <circle cx="71" cy="77" r="3.5" fill={P.ink} />
      <circle cx="39" cy="27" r="3.5" fill={P.ink} />
      <circle cx="47" cy="35" r="3.5" fill={P.ink} />
      <circle cx="55" cy="43" r="3.5" fill={P.ink} />
    </g>
  ),
};

/** せいかつ: はちから出た芽 */
const subjSeikatsu: IllustDef = {
  id: 'subj-seikatsu',
  label: 'せいかつ（め）',
  status: 'final',
  draw: () => (
    <g>
      <path d="M50 62 V36" {...line} />
      <path d="M50 44 C40 30 26 32 22 38 C30 46 42 48 50 44 Z" fill={P.green} {...line} />
      <path d="M50 38 C58 24 74 24 78 30 C72 40 58 42 50 38 Z" fill={P.green} {...line} />
      <path d="M24 60 H76 L70 88 H30 Z" fill={P.orange} {...line} />
      <path d="M22 60 H78" {...line} strokeWidth={5} />
    </g>
  ),
};

/** りか: 虫めがね */
const subjRika: IllustDef = {
  id: 'subj-rika',
  label: 'りか（むしめがね）',
  status: 'final',
  draw: () => (
    <g>
      <path d="M60 62 L84 86" {...line} strokeWidth={10} stroke={P.brown} />
      <path d="M60 62 L84 86" fill="none" {...line} strokeWidth={3.5} />
      <circle cx="42" cy="42" r="26" fill={P.white} {...line} strokeWidth={6} />
      <path d="M30 36 C32 28 38 24 44 24" {...line} fill="none" stroke={P.sky} strokeWidth={4} />
      <circle cx="46" cy="48" r="7" fill={P.green} {...line} strokeWidth={2.5} />
    </g>
  ),
};

/** しゃかい: たたんだ地図 */
const subjShakai: IllustDef = {
  id: 'subj-shakai',
  label: 'しゃかい（ちず）',
  status: 'final',
  draw: () => (
    <g>
      <path d="M12 24 L36 16 L64 24 L88 16 V76 L64 84 L36 76 L12 84 Z" fill={P.cream} {...line} />
      <path d="M36 16 V76 M64 24 V84" {...line} strokeWidth={3} />
      <path
        d="M20 46 C26 38 32 40 34 48 C36 56 44 54 48 46 C52 38 58 42 60 50"
        fill="none"
        {...line}
        stroke={P.blue}
        strokeWidth={4}
      />
      <path d="M72 40 L78 52 L66 52 Z" fill={P.green} {...line} strokeWidth={2.5} />
      <circle cx="74" cy="66" r="4" fill={P.red} {...line} strokeWidth={2.5} />
    </g>
  ),
};

/** えいご: ABC の吹き出し */
const subjEigo: IllustDef = {
  id: 'subj-eigo',
  label: 'えいご（ABC）',
  status: 'final',
  draw: () => (
    <g>
      <path d="M14 22 H86 V66 H44 L28 82 V66 H14 Z" fill={P.white} {...line} />
      {/* 文字の形を線で描く（文字の要素は使わない） */}
      <g
        fill="none"
        stroke={P.purple}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M24 56 L31 32 L38 56 M27 47 H35" />
        <path d="M45 32 V56 H52 C60 56 60 44 52 44 H45 M45 44 H51 C57 44 57 32 51 32 H45" />
        <path d="M78 36 C74 30 64 31 64 44 C64 57 74 58 78 52" />
      </g>
    </g>
  ),
};

/** プログラミング: 矢印の札 */
const subjProgram: IllustDef = {
  id: 'subj-program',
  label: 'プログラミング（やじるしの ふだ）',
  status: 'final',
  draw: () => (
    <g>
      <rect x="10" y="30" width="24" height="40" rx="4" fill={P.sky} {...line} />
      <rect x="38" y="30" width="24" height="40" rx="4" fill={P.sky} {...line} />
      <rect x="66" y="30" width="24" height="40" rx="4" fill={P.yellow} {...line} />
      <path d="M16 50 H28 M23 44 L29 50 L23 56" fill="none" {...line} />
      <path d="M44 50 H56 M51 44 L57 50 L51 56" fill="none" {...line} />
      <path d="M72 56 V44 H84 M80 40 L84 44 L80 48" fill="none" {...line} />
    </g>
  ),
};

export const subjectIllust: IllustGroup = {
  'subj-kokugo': subjKokugo,
  'subj-sansu': subjSansu,
  'subj-seikatsu': subjSeikatsu,
  'subj-rika': subjRika,
  'subj-shakai': subjShakai,
  'subj-eigo': subjEigo,
  'subj-program': subjProgram,
};
