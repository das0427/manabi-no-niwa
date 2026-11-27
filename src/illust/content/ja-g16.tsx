/**
 * 国語（小1〜小6）の単元の絵（FX15・E-15）。画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・palette の色だけ・文字なし）。
 *
 * 地図の札の絵に使われているのに ILLUST に登録がなく、本番では赤い破線の仮の枠になっていた 2 つ。
 *   book       … g1.ja.folktales（むかしばなしを きこう）・g6.ja.language-change（方言と共通語、言葉の変化と由来）
 *   music-note … g1.ja.word-play（ことばあそび）
 * パックが指す id（book・music-note）のまま登録する（パックのファイルは変えない）。
 * はんこ用の絵（stamps/）にも同じ id があるが、はんこは ILLUST とは別の登録なので重ならない。
 * 文字は描かない（題の札・ふきだしの中は形だけ）。
 */
import { HIGHLIGHT, line, type IllustDef, type IllustGroup } from '../types';
import { P } from '../palette';

/**
 * 表紙を向けた とじた ほん。ページの束が右と下に少し見え、しおりが下に垂れる。題の札は形だけ。
 * 色は輪郭のほかに 4 色まで（cream・red・redDark・yellow。しおりは題の札と同じ yellow）。下の余白 6 を守る
 */
const book: IllustDef = {
  id: 'book',
  label: 'ほん',
  status: 'final',
  draw: () => (
    <g>
      <rect x="26" y="13" width="55" height="69" rx="4" fill={P.cream} {...line} />
      <rect x="18" y="9" width="57" height="71" rx="5" fill={P.red} {...line} />
      <path d="M18 14 A5 5 0 0 1 23 9 H30 V80 H23 A5 5 0 0 1 18 75 Z" fill={P.redDark} {...line} />
      <rect x="37" y="20" width="28" height="24" rx="4" fill={P.yellow} {...line} />
      <path d="M52 80 V91 L58 86 L64 91 V80 Z" fill={P.yellow} {...line} />
      <ellipse cx="35" cy="56" rx="2.6" ry="7" fill={HIGHLIGHT} opacity="0.5" />
    </g>
  ),
};

/** ふきだしの中の ふたつの おんぷ（ことばの おと・リズムで あそぶ） */
const musicNote: IllustDef = {
  id: 'music-note',
  label: 'おんぷ',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M16 14 H84 A8 8 0 0 1 92 22 V60 A8 8 0 0 1 84 68 H46 L28 88 V68 H16 A8 8 0 0 1 8 60 V22 A8 8 0 0 1 16 14 Z"
        fill={P.yellow}
        {...line}
      />
      <path d="M42 26 L72 21 V31 L42 36 Z" fill={P.purple} {...line} />
      <rect x="40" y="26" width="6" height="26" rx="2.5" fill={P.purple} {...line} />
      <rect x="68" y="21" width="6" height="26" rx="2.5" fill={P.purple} {...line} />
      <ellipse
        cx="36"
        cy="53"
        rx="9"
        ry="6.5"
        transform="rotate(-20 36 53)"
        fill={P.purple}
        {...line}
      />
      <ellipse
        cx="64"
        cy="48"
        rx="9"
        ry="6.5"
        transform="rotate(-20 64 48)"
        fill={P.purple}
        {...line}
      />
    </g>
  ),
};

export const jaG16: IllustGroup = {
  book,
  'music-note': musicNote,
};
