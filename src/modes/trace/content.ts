/**
 * なぞり（M8）の教材。お手本はすべて 0〜1000 の正方形座標の点列（約 10 単位ごと）。
 * 段階 T1〜T7 の内容と数は docs/learning-design.md 8章。
 * 字（T5〜T7）は data/kana-strokes.json（KanjiVG 由来・CC BY-SA 3.0。書き順どおりの点列）から作る。
 * 字形は表示フォントとは別（M8-08）。
 */
import kana from './data/kana-strokes.json';
import { GUIDE_STEP, resample, type Pt } from './judge';

export type TraceKind = 'line' | 'shape' | 'maze' | 'letter';

export interface TraceItem {
  /** 作品に保存する名前（guideId） */
  id: string;
  /** 段階（0 = T1 … 6 = T7） */
  level: number;
  kind: TraceKind;
  /** 保護者画面・作品の名前 */
  title: string;
  /** お手本の画（書き順どおり）。約 10 単位ごとの点列 */
  strokes: Pt[][];
  /** 折れ線の頂点（近道のテスト用。曲線では省略） */
  vertices?: Pt[];
  /** 迷路の通路の中心線すべて（行き止まりを含む。描画用） */
  corridors?: Pt[][];
  /** 迷路の通路の半幅 = 判定幅 r（設定の判定幅は使わない） */
  halfWidth?: number;
  /** 字（T5〜T7） */
  char?: string;
  /** 音声キーの末尾（trace.letter.<voiceId>） */
  voiceId?: string;
}

const poly = (...pts: [number, number][]): Pt[] => resample(pts, GUIDE_STEP);

/** 楕円の弧（角度は真上 = 0、時計まわりが正。ラジアン） */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): Pt[] {
  const n = 240;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + rx * Math.sin(a), cy - ry * Math.cos(a)]);
  }
  return resample(pts, GUIDE_STEP);
}

/** x を 100〜900 で動かし、y = f(t)（t は 0〜1）の曲線 */
function curve(f: (t: number) => number, x0 = 100, x1 = 900): Pt[] {
  const n = 240;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + (x1 - x0) * t, f(t)]);
  }
  return resample(pts, GUIDE_STEP);
}

const straight = (
  id: string,
  title: string,
  a: [number, number],
  b: [number, number],
  level: number,
) => ({ id, level, kind: 'line', title, strokes: [poly(a, b)] }) satisfies TraceItem;

// ---- T1: 太く短い直線（6本） ---------------------------------------------------
const T1: TraceItem[] = [
  straight('t1-yoko', 'よこせん', [200, 500], [800, 500], 0),
  straight('t1-tate', 'たてせん', [500, 200], [500, 800], 0),
  straight('t1-naname-migi', 'ななめせん（みぎした）', [250, 250], [750, 750], 0),
  straight('t1-naname-hidari', 'ななめせん（ひだりした）', [750, 250], [250, 750], 0),
  straight('t1-yoko-hidari', 'よこせん（ひだりへ）', [800, 500], [200, 500], 0),
  straight('t1-tate-ue', 'たてせん（うえへ）', [500, 800], [500, 200], 0),
];

// ---- T2: 長い直線・ゆるい曲線（6本） ---------------------------------------------
const T2: TraceItem[] = [
  straight('t2-yoko', 'ながい よこせん', [100, 500], [900, 500], 1),
  straight('t2-tate', 'ながい たてせん', [500, 100], [500, 900], 1),
  straight('t2-naname', 'ながい ななめせん', [120, 880], [880, 120], 1),
  {
    id: 't2-yama',
    level: 1,
    kind: 'line',
    title: 'やま',
    strokes: [curve((t) => 750 - 350 * Math.sin(Math.PI * t))],
  },
  {
    id: 't2-nami',
    level: 1,
    kind: 'line',
    title: 'なみ',
    strokes: [curve((t) => 500 - 140 * Math.sin(4 * Math.PI * t))],
  },
  {
    id: 't2-kaabu',
    level: 1,
    kind: 'line',
    title: 'ゆるい カーブ',
    strokes: [arc(150, 250, 600, 600, Math.PI, Math.PI / 2)],
  },
];

// ---- T3: 折れ線・形（6題） -------------------------------------------------------
const ZIGZAG: [number, number][] = [
  [100, 650],
  [260, 350],
  [420, 650],
  [580, 350],
  [740, 650],
  [900, 350],
];
const STAIRS: [number, number][] = [
  [100, 850],
  [350, 850],
  [350, 600],
  [600, 600],
  [600, 350],
  [850, 350],
  [850, 100],
];
const TRIANGLE: [number, number][] = [
  [500, 150],
  [850, 800],
  [150, 800],
  [500, 150],
];
const SQUARE: [number, number][] = [
  [200, 200],
  [800, 200],
  [800, 800],
  [200, 800],
  [200, 200],
];
const BOLT: [number, number][] = [
  [200, 200],
  [800, 200],
  [200, 800],
  [800, 800],
];
const T3: TraceItem[] = [
  {
    id: 't3-gizagiza',
    level: 2,
    kind: 'line',
    title: 'ぎざぎざ',
    strokes: [poly(...ZIGZAG)],
    vertices: ZIGZAG,
  },
  {
    id: 't3-kaidan',
    level: 2,
    kind: 'line',
    title: 'かいだん',
    strokes: [poly(...STAIRS)],
    vertices: STAIRS,
  },
  {
    id: 't3-maru',
    level: 2,
    kind: 'shape',
    title: 'まる',
    strokes: [arc(500, 500, 330, 330, 0, 2 * Math.PI)],
  },
  {
    id: 't3-sankaku',
    level: 2,
    kind: 'shape',
    title: 'さんかく',
    strokes: [poly(...TRIANGLE)],
    vertices: TRIANGLE,
  },
  {
    id: 't3-shikaku',
    level: 2,
    kind: 'shape',
    title: 'しかく',
    strokes: [poly(...SQUARE)],
    vertices: SQUARE,
  },
  {
    id: 't3-inazuma',
    level: 2,
    kind: 'line',
    title: 'いなずま',
    strokes: [poly(...BOLT)],
    vertices: BOLT,
  },
];

// ---- T4: かんたんな迷路（4題）。4×4 の格子、通路の幅 150（半幅 75）、壁の厚み 100 ----------
/** 格子の列・行 → 座標 */
const cell = (c: number, r: number): [number, number] => [125 + 250 * c, 125 + 250 * r];
const cells = (...cs: [number, number][]): [number, number][] => cs.map(([c, r]) => cell(c, r));
export const MAZE_HALF_WIDTH = 75;

function maze(
  id: string,
  title: string,
  route: [number, number][],
  stubs: [number, number][][],
): TraceItem {
  const vertices = cells(...route);
  return {
    id,
    level: 3,
    kind: 'maze',
    title,
    strokes: [poly(...vertices)],
    vertices,
    corridors: [poly(...vertices), ...stubs.map((s) => poly(...cells(...s)))],
    halfWidth: MAZE_HALF_WIDTH,
  };
}

const T4: TraceItem[] = [
  maze(
    't4-1',
    'めいろ 1',
    [
      [0, 0],
      [3, 0],
      [3, 2],
      [0, 2],
    ],
    [
      [
        [1, 0],
        [1, 1],
      ],
      [
        [2, 2],
        [2, 3],
      ],
    ],
  ),
  maze(
    't4-2',
    'めいろ 2',
    [
      [0, 3],
      [0, 1],
      [2, 1],
      [2, 3],
      [3, 3],
    ],
    [
      [
        [1, 1],
        [1, 0],
      ],
      [
        [2, 2],
        [3, 2],
      ],
    ],
  ),
  maze(
    't4-3',
    'めいろ 3',
    [
      [3, 0],
      [1, 0],
      [1, 2],
      [3, 2],
      [3, 3],
    ],
    [
      [
        [1, 1],
        [0, 1],
      ],
      [
        [2, 2],
        [2, 3],
      ],
    ],
  ),
  maze(
    't4-4',
    'めいろ 4',
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
      [2, 0],
      [2, 2],
      [3, 2],
      [3, 3],
    ],
    [
      [
        [2, 0],
        [3, 0],
      ],
      [
        [1, 1],
        [1, 2],
      ],
    ],
  ),
];

// ---- T5〜T7: ひらがな（KanjiVG 由来の書き順データ）-------------------------------
const KANA = kana.chars as unknown as Record<string, { strokes: [number, number][][] }>;

/** 字の音声キー末尾（trace.letter.<romaji>）。字の名前は単独のひらがな1字で読みが揺れやすいので、台本は「しを なぞろう」の形にする */
const ROMAJI: Record<string, string> = {
  し: 'shi',
  く: 'ku',
  つ: 'tsu',
  へ: 'he',
  の: 'no',
  て: 'te',
  こ: 'ko',
  い: 'i',
  り: 'ri',
  う: 'u',
  ち: 'chi',
  そ: 'so',
  る: 'ru',
  ろ: 'ro',
  ひ: 'hi',
};

/** 字を正方形の中央にそろえる（bbox の中心を (500,500) へ。形は変えない） */
function letter(ch: string, level: number): TraceItem {
  const raw = KANA[ch]!.strokes;
  const xs = raw.flatMap((s) => s.map((p) => p[0]));
  const ys = raw.flatMap((s) => s.map((p) => p[1]));
  const dx = 500 - (Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = 500 - (Math.min(...ys) + Math.max(...ys)) / 2;
  const strokes = raw.map((s) =>
    resample(
      s.map((p) => [p[0] + dx, p[1] + dy] as Pt),
      GUIDE_STEP,
    ),
  );
  return {
    id: `kana-${ROMAJI[ch]}`,
    level,
    kind: 'letter',
    title: ch,
    char: ch,
    voiceId: ROMAJI[ch]!,
    strokes,
  };
}

const T5 = [...'しくつへのて'].map((c) => letter(c, 4));
const T6 = [...'こいりうち'].map((c) => letter(c, 5));
const T7 = [...'そるろひ'].map((c) => letter(c, 6));

export const TRACE_ITEMS: readonly TraceItem[] = [...T1, ...T2, ...T3, ...T4, ...T5, ...T6, ...T7];

export const LETTER_VOICE_IDS: readonly string[] = Object.values(ROMAJI);

export function itemsForLevel(level: number): TraceItem[] {
  return TRACE_ITEMS.filter((i) => i.level === level);
}

export function findItem(id: string): TraceItem | undefined {
  return TRACE_ITEMS.find((i) => i.id === id);
}
