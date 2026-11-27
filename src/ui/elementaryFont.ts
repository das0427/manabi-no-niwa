/**
 * 小学生用フォント（漢字だけのサブセット。review-1 #22、architecture 11章）の読み込み。
 * 小学生のプロフィールを選んだときだけ FontFace で読み込む（幼児の画面では取得しない）。
 * 'Zen Maru Gothic' の漢字（unicode-range）に重ねる。ファイルはコアのキャッシュに入っているので、オフラインでも読める。
 * 作り方: `npm run chars` → `npm run fonts`（scripts/fonts/subset.py の --elementary）。
 */
import { gradeOf } from '../audience/audience';
import type { AudienceId } from '../audience/audience';

/** 漢字のおおまかな範囲（CJK 統合漢字・拡張 A・互換漢字・拡張 B 以降。scripts/fonts/chars-lib.ts の isIdeograph と同じ）。かなと英数は通常のフォントを使う */
export const KANJI_UNICODE_RANGE = 'U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+20000-2FFFF';

export const ELEMENTARY_FONT_FILES = [
  { weight: '400', file: 'fonts/zen-maru-gothic-kanji-400.woff2' },
  { weight: '700', file: 'fonts/zen-maru-gothic-kanji-700.woff2' },
] as const;

let started = false;

/** この区分で小学生用フォントを使うか */
export function needsElementaryFont(audience: AudienceId): boolean {
  return gradeOf(audience) > 0;
}

/** 読み込みを始める（2回目以降は何もしない。FontFace が無い環境・失敗時は通常のフォントのまま） */
export function loadElementaryFont(base: string = import.meta.env.BASE_URL ?? '/'): void {
  if (started) return;
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
  started = true;
  for (const f of ELEMENTARY_FONT_FILES) {
    try {
      const face = new FontFace('Zen Maru Gothic', `url(${base}${f.file}) format('woff2')`, {
        weight: f.weight,
        display: 'swap',
        unicodeRange: KANJI_UNICODE_RANGE,
      });
      face
        .load()
        .then((loaded) => document.fonts.add(loaded))
        .catch(() => {
          /* 取得に失敗しても、通常のフォント（コアの Zen Maru Gothic → システムの日本語）で表示する */
        });
    } catch {
      /* 同上 */
    }
  }
}

/** テスト用: 読み込み済みの印を戻す */
export function resetElementaryFontForTest(): void {
  started = false;
}
