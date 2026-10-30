/**
 * 同梱フォント（Zen Maru Gothic）に入れる文字を集める（`npm run chars`）。
 * かな・英数・記号の基本セット（漢字を除く）＋ src のコード中の文字（コメントを除く）＋ 音声台本の文。
 * 教材パックと配当表は漢字以外の字だけをコアに入れる（漢字は小学生用フォント側）。
 * 出力: scripts/fonts/used-chars.txt。続けて `npm run fonts` でサブセットを作る。
 *
 * あわせて小学生用フォント（漢字だけ。review-1 #22）に入れる字を scripts/fonts/used-chars-elementary.txt に出す
 * （学年別漢字配当表 1026 字 + src・教材パック・音声台本の漢字）。集め方はどちらも scripts/fonts/chars-lib.ts。
 * 保護者が入力する文字（メモ・名前）は、保護者画面のフォントの先頭にあるシステムの日本語フォントで表示する。
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectCoreChars, collectElementaryKanji, isIdeograph } from './fonts/chars-lib.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const core = collectCoreChars(root);
writeFileSync(path.join(root, 'scripts/fonts/used-chars.txt'), core.join(''), 'utf8');
const elementary = collectElementaryKanji(root);
writeFileSync(
  path.join(root, 'scripts/fonts/used-chars-elementary.txt'),
  elementary.join(''),
  'utf8',
);
console.log(
  `used-chars.txt: ${core.length} 文字（うち漢字 ${core.filter(isIdeograph).length}）／ used-chars-elementary.txt: 漢字 ${elementary.length} 字`,
);
