/**
 * 書き順データ（KanjiVG 由来。src/packs/_data/strokes/*.json、CC BY-SA 3.0）の引き方。
 * ファイルは大きい（学年ごとに 0.3〜1MB）ので、必要になった集合だけを遅延で読む（チャンクは packs/_data/strokes/*）。
 * 形は v1 のなぞり（src/modes/trace/content.ts の letter()）と同じに整える: 外接矩形の中心を (500,500) へ、約 10 単位ごと。
 */
import { kanjiGrade } from '../../text/kanji-grades';
import { GUIDE_STEP, resample, type Pt } from '../../modes/trace/judge';

export type StrokeSet =
  'kana' | 'kanji-g1' | 'kanji-g2' | 'kanji-g3' | 'kanji-g4' | 'kanji-g5' | 'kanji-g6';

interface StrokeFile {
  chars: Record<string, { strokes: number[][][] }>;
}

const LOADERS: Record<StrokeSet, () => Promise<{ default: StrokeFile }>> = {
  kana: () => import('../../packs/_data/strokes/kana.json'),
  'kanji-g1': () => import('../../packs/_data/strokes/kanji-g1.json'),
  'kanji-g2': () => import('../../packs/_data/strokes/kanji-g2.json'),
  'kanji-g3': () => import('../../packs/_data/strokes/kanji-g3.json'),
  'kanji-g4': () => import('../../packs/_data/strokes/kanji-g4.json'),
  'kanji-g5': () => import('../../packs/_data/strokes/kanji-g5.json'),
  'kanji-g6': () => import('../../packs/_data/strokes/kanji-g6.json'),
};

/** かな（ぁ〜ゔ・ァ〜ヶ・ー） */
export const isKana = (ch: string): boolean => /^[ぁ-ゔァ-ヶー]$/u.test(ch);

/** 字の書き順データの集合（データが無い字は null: 英字・記号・配当外の漢字） */
export function strokeSetOf(ch: string): StrokeSet | null {
  if ([...ch].length !== 1) return null;
  if (isKana(ch)) return 'kana';
  if (/^\p{Script=Han}$/u.test(ch)) {
    const g = kanjiGrade(ch);
    if (g >= 1 && g <= 6) return `kanji-g${g}` as StrokeSet;
  }
  return null;
}

/** 0〜1000 の点列を中央にそろえ、約 GUIDE_STEP ごとに並べ直す */
export function normalizeStrokes(raw: readonly (readonly (readonly number[])[])[]): Pt[][] {
  const xs = raw.flatMap((s) => s.map((p) => p[0]!));
  const ys = raw.flatMap((s) => s.map((p) => p[1]!));
  const dx = 500 - (Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = 500 - (Math.min(...ys) + Math.max(...ys)) / 2;
  return raw.map((s) =>
    resample(
      s.map((p) => [p[0]! + dx, p[1]! + dy] as Pt),
      GUIDE_STEP,
    ),
  );
}

const fileCache = new Map<StrokeSet, Promise<StrokeFile>>();
const guideCache = new Map<string, Pt[][]>();

/** 字の書き順（整えた点列）。データが無ければ null */
export async function loadGuide(ch: string): Promise<Pt[][] | null> {
  const hit = guideCache.get(ch);
  if (hit) return hit;
  const set = strokeSetOf(ch);
  if (!set) return null;
  let f = fileCache.get(set);
  if (!f) {
    f = LOADERS[set]().then((m) => m.default);
    fileCache.set(set, f);
  }
  const raw = (await f).chars[ch]?.strokes;
  if (!raw || raw.length === 0) return null;
  const g = normalizeStrokes(raw);
  guideCache.set(ch, g);
  return g;
}
