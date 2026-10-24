/**
 * はんこの一覧（X-ST-01、DESINGN.md 20章）。JSX を含まない純粋なデータ（check:design からも読む）。
 * - id はイラストの ID と同じ（既存の教材イラストは同じ物を同じ絵で再利用し、足りない物は stamps/ に描いた）
 * - version は絵を描き直したときに上げる（作品は "<id>@<version>" で参照し、SVG を作品に埋め込む: X-SV-08）
 * stamps.json は `npm run build-stamps` でこの一覧から生成する。
 */
export const STAMP_CATEGORIES = [
  { id: 'animal', label: 'どうぶつ', icon: 'rabbit' },
  { id: 'food', label: 'たべもの', icon: 'apple' },
  { id: 'vehicle', label: 'のりもの', icon: 'car-red' },
  { id: 'nature', label: 'しぜん', icon: 'flower' },
  { id: 'decor', label: 'かざり', icon: 'star' },
  { id: 'life', label: 'くらし', icon: 'house' },
] as const;

export type StampCategory = (typeof STAMP_CATEGORIES)[number]['id'];

export interface StampEntry {
  id: string;
  category: StampCategory;
  version: number;
}

const list = (category: StampCategory, ids: string[]): StampEntry[] =>
  ids.map((id) => ({ id, category, version: 1 }));

export const STAMP_LIST: StampEntry[] = [
  ...list('animal', [
    'rabbit',
    'dog',
    'cat',
    'bear',
    'elephant',
    'monkey',
    'cow',
    'turtle',
    'bird',
    'fox',
    'chick',
    'frog',
    'ant',
    'octopus',
  ]),
  ...list('food', [
    'apple',
    'banana',
    'mikan',
    'strawberry',
    'peach',
    'watermelon',
    'lemon',
    'tomato',
    'carrot',
    'eggplant',
    'green-pepper',
    'cucumber',
    'bread',
    'onigiri',
    'egg',
  ]),
  ...list('vehicle', [
    'car-red',
    'bus-yellow',
    'truck',
    'train',
    'airplane',
    'ship',
    'bicycle',
    'rocket',
  ]),
  ...list('nature', [
    'flower',
    'tree',
    'leaf',
    'rock',
    'sun',
    'cloud',
    'rainbow',
    'moon',
    'mushroom',
    'mountain',
  ]),
  ...list('decor', ['star', 'heart-on', 'ribbon', 'crown', 'music-note', 'balloon', 'sparkle']),
  ...list('life', [
    'house',
    'umbrella',
    'ball',
    'pencil',
    'scissors',
    'hat',
    'shoe',
    'book',
    'clock',
  ]),
];

/** 下限（X-ST-01）。check:design が検査する */
export const STAMP_MIN_COUNT = 60;
export const STAMP_MIN_CATEGORIES = 6;
