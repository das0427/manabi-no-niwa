import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

// あ の字形は KanjiVG (U+3042, CC BY-SA 3.0) の書き順データから作成。

export const modeHiragana: IllustDef = {
  id: 'mode-hiragana',
  label: 'ひらがな',
  status: 'final',
  draw: () => (
    <g>
      <rect x="8" y="26" width="72" height="64" rx="7" fill={P.wood} {...line} />
      <path d="M14 26 L26 10 H92 L80 26 Z" fill={P.tan} {...line} />
      <path d="M80 26 L92 10 V74 L80 90 Z" fill={P.brown} {...line} />
      <path
        d="M28.26 42.95c0.62 0.62 1.92 1.27 3.68 1.22c6.03 -0.17 14 -1.48 20.65 -2.97c1.06 -0.24 3.23 -0.62 4.63 -0.35"
        fill="none"
        stroke={INK}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M41.38 32.18c0.62 0.7 1.27 2.28 0.97 3.68c-2.62 11.73 -4.37 26.69 -3.59 37.54c0.29 3.99 1.32 7.62 2.37 9.53"
        fill="none"
        stroke={INK}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M52.49 50.73c0.52 0.78 0.81 3.07 0.35 4.28c-3.23 8.58 -7.87 16.63 -17.76 25.03c-4.8 4.08 -11.12 2.63 -11.37 -5.87c-0.24 -7.61 9.37 -16.18 22.67 -18.72c8.69 -1.66 18.9 0.97 21.35 8.92c2.83 9.23 -2.63 18.46 -14.62 21.34"
        fill="none"
        stroke={INK}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ),
};
