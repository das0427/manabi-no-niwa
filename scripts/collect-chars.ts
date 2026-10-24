/**
 * 同梱フォント（Zen Maru Gothic）に入れる文字を集める（`npm run chars`）。
 * かな・英数・記号の基本セット（漢字を除く）＋ src のコード中の文字（コメントを除く）＋ 音声台本の文。
 * 出力: scripts/fonts/used-chars.txt。続けて `npm run fonts` でサブセットを作る。
 * 保護者が入力する文字（メモ・名前）は、保護者画面のフォントの先頭にあるシステムの日本語フォントで表示する。
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICE_CATALOG } from '../src/voice/catalog/index.ts';
import { voiceText } from '../src/voice/types.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isIdeograph = (c: string) => {
  const n = c.codePointAt(0) ?? 0;
  return (
    (n >= 0x4e00 && n <= 0x9fff) || (n >= 0x3400 && n <= 0x4dbf) || (n >= 0xf900 && n <= 0xfaff)
  );
};

const chars = new Set<string>();
for (const ch of readFileSync(path.join(root, 'scripts/fonts/base-chars.txt'), 'utf8')) {
  if (!isIdeograph(ch) && ch !== '\n' && ch !== '\r') chars.add(ch);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

let kanji = 0;
for (const file of walk(path.join(root, 'src'))) {
  const code = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const ch of code) {
    if (ch.charCodeAt(0) > 0x7f && !chars.has(ch)) {
      chars.add(ch);
      if (isIdeograph(ch)) kanji++;
    }
  }
}
for (const e of Object.values(VOICE_CATALOG)) for (const ch of voiceText(e)) chars.add(ch);

const out = path.join(root, 'scripts/fonts/used-chars.txt');
writeFileSync(out, [...chars].sort().join(''), 'utf8');
console.log(`used-chars.txt: ${chars.size} 文字（うち漢字 ${kanji}）`);
