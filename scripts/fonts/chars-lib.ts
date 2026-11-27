/**
 * 小学生用フォント（漢字だけのサブセット）に入れる字の集め方（review-1 #22）。
 * collect-chars.ts と単体テスト（collect-chars.test.ts）が使う。
 *
 * 入れる字 = 学年別漢字配当表の 1026 字
 *          + src の中の漢字（コード・教材パックの .ts / .json・音声台本。コメントと単体テストは除く）
 * 配当外の漢字（教材の文中の「《よみ》」付きの字など）も、src に現れる限り入る。
 *
 * コアのフォント（used-chars.txt）は collectCoreChars。教材パックと配当表の「漢字」は小学生用フォントに任せて
 * コアには入れないが、教材パックの漢字以外の字（℃・²・◯・≦ など）はコアに入れる（小学生用フォントは漢字だけのため）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { KANJI_BY_GRADE } from '../../src/text/kanji-grades.ts';
import { VOICE_CATALOG } from '../../src/voice/catalog/index.ts';
import { voiceText } from '../../src/voice/types.ts';

/** 正規表現の範囲の端（[一-鿿] 等）に書かれているだけで、実在の字ではないもの */
const RANGE_BOUNDS = new Set(['㐀', '䶿', '鿿']);

export const isIdeograph = (c: string): boolean => {
  const n = c.codePointAt(0) ?? 0;
  return (
    (n >= 0x4e00 && n <= 0x9fff) ||
    (n >= 0x3400 && n <= 0x4dbf) ||
    (n >= 0xf900 && n <= 0xfaff) ||
    (n >= 0x20000 && n <= 0x2ffff)
  );
};

/** src の中の対象ファイル。筆順データ（_data/strokes）は座標の数字だけなので除く */
export function walkSources(dir: string, exts: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'strokes' && path.basename(dir) === '_data') continue;
      out.push(...walkSources(p, exts));
    } else if (exts.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

export function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const toPosix = (p: string): string => p.replaceAll('\\', '/');

/** コアのフォントで漢字を入れないファイルか（教材パックと配当表のデータ） */
export function isElementaryOnlyKanjiSource(root: string, file: string): boolean {
  const rel = toPosix(path.relative(root, file));
  return rel.startsWith('src/packs/') || rel === 'src/text/kanji-grades.ts';
}

/**
 * コアのフォント（Zen Maru Gothic 400/700・Klee One）に入れる字（整列済みの配列）。
 * かな・英数・記号の基本セット（漢字を除く）＋ src のコード中の字（コメントと単体テストを除く。
 * 教材パック・配当表は漢字以外だけ）＋ 音声台本の文。
 */
export function collectCoreChars(root: string): string[] {
  const chars = new Set<string>();
  for (const ch of readFileSync(path.join(root, 'scripts/fonts/base-chars.txt'), 'utf8')) {
    if (!isIdeograph(ch) && ch !== '\n' && ch !== '\r') chars.add(ch);
  }
  for (const file of walkSources(path.join(root, 'src'), /\.(tsx?|css)$/)) {
    const noKanji = isElementaryOnlyKanjiSource(root, file);
    for (const ch of stripComments(readFileSync(file, 'utf8'))) {
      if ((ch.codePointAt(0) ?? 0) <= 0x7f) continue;
      if (noKanji && isIdeograph(ch)) continue;
      chars.add(ch);
    }
  }
  for (const e of Object.values(VOICE_CATALOG)) for (const ch of voiceText(e)) chars.add(ch);
  return [...chars].sort();
}

/** 小学生用フォントに入れる漢字（整列済みの配列） */
export function collectElementaryKanji(root: string): string[] {
  const set = new Set<string>();
  const add = (ch: string) => {
    if (isIdeograph(ch) && !RANGE_BOUNDS.has(ch)) set.add(ch);
  };
  for (const g of Object.values(KANJI_BY_GRADE)) for (const ch of g) add(ch);
  for (const file of walkSources(path.join(root, 'src'), /\.(tsx?|css|json)$/)) {
    const raw = readFileSync(file, 'utf8');
    const code = file.endsWith('.json') ? raw : stripComments(raw);
    for (const ch of code) add(ch);
  }
  for (const e of Object.values(VOICE_CATALOG)) {
    for (const ch of voiceText(e)) add(ch);
  }
  return [...set].sort();
}
