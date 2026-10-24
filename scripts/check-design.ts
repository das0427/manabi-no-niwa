/**
 * DESINGN.md 14章の自動検査（`npm run check:design`）。違反があれば一覧を出して exit 1。
 *
 * - CSS: グラデーション・backdrop-filter・blur・ぼかし影・text-shadow・#000/#fff・トークン外の色
 * - イラスト: グラデーション・filter・<text>・パレット外の色・輪郭線の色
 * - 子供に見える文字: 音声台本の文と、子供画面の JSX の文字に英字・漢字・絵文字がない
 *   （「保護者」を含む行は保護者向けの案内として対象外）
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICE_CATALOG } from '../src/voice/catalog/index.ts';
import { voiceText } from '../src/voice/types.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems: string[] = [];
const rel = (p: string) => path.relative(root, p).replaceAll('\\', '/');

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((e) => name.endsWith(e)) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** 括弧の外側にある区切り文字だけで分ける（calc(var(--u) * 2) を壊さない） */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// ---- 色の許可リスト
const tokensCss = readFileSync(path.join(root, 'src/styles/tokens.css'), 'utf8');
const tokenColors = new Set(
  [...tokensCss.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase()),
);
const paletteTs = readFileSync(path.join(root, 'src/illust/palette.ts'), 'utf8');
const paletteColors = new Set(
  [...paletteTs.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase()),
);
const typesTs = readFileSync(path.join(root, 'src/illust/types.ts'), 'utf8');
for (const m of typesTs.matchAll(/#[0-9a-fA-F]{6}\b/g)) paletteColors.add(m[0].toUpperCase());

// ---- CSS
for (const file of walk(path.join(root, 'src'), ['.css'])) {
  const css = readFileSync(file, 'utf8');
  const lines = css.split('\n');
  lines.forEach((line, i) => {
    const at = `${rel(file)}:${i + 1}`;
    if (/gradient\(/.test(line)) problems.push(`${at} グラデーションは使わない`);
    if (/backdrop-filter/.test(line)) problems.push(`${at} backdrop-filter は使わない`);
    if (/filter:\s*[^;]*blur\(/.test(line)) problems.push(`${at} blur は使わない`);
    if (/text-shadow/.test(line)) problems.push(`${at} text-shadow は使わない`);
    if (/#(000|000000|fff|ffffff)\b/i.test(line)) problems.push(`${at} 純黒・純白は使わない`);
    if (!file.endsWith('tokens.css')) {
      for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        problems.push(`${at} 色 ${m[0]} を直接書かない（トークン var(--…) を使う）`);
      }
    }
  });
  // box-shadow のぼかし（3つ目の長さが 0 以外）
  for (const m of css.matchAll(/box-shadow:\s*([^;}]+)/g)) {
    for (const part of splitTop(m[1]!, ',')) {
      const tokens = splitTop(part.trim(), ' ').filter(Boolean);
      // 長さ（数値・calc()・寸法のトークン）だけを取り出し、3つ目をぼかしとみなす
      const lengths = tokens.filter(
        (t) =>
          /^-?[\d.]+[a-z%]*$/.test(t) ||
          t.startsWith('calc(') ||
          /^var\(--(u|step|outline)/.test(t),
      );
      const blur = lengths[2];
      if (part.trim() !== 'none' && blur !== undefined && blur !== '0' && blur !== '0px') {
        problems.push(`${rel(file)} box-shadow「${part.trim()}」にぼかしがある`);
      }
    }
  }
}

// ---- イラスト
for (const file of walk(path.join(root, 'src/illust'), ['.tsx'])) {
  if (file.endsWith('gallery-main.tsx') || file.endsWith('Illust.tsx')) continue;
  const src = readFileSync(file, 'utf8');
  const at = rel(file);
  if (/linearGradient|radialGradient/.test(src)) problems.push(`${at} グラデーションは使わない`);
  if (/<filter\b|filter=/.test(src)) problems.push(`${at} filter は使わない`);
  if (/<text\b/.test(src)) problems.push(`${at} 絵に文字を描き込まない（<text>）`);
  for (const m of src.matchAll(/['"](#[0-9a-fA-F]{6})['"]/g)) {
    if (!paletteColors.has(m[1]!.toUpperCase())) problems.push(`${at} パレット外の色 ${m[1]}`);
  }
  if (/status:\s*'draft'/.test(src)) problems.push(`${at} 仮素材（status: 'draft'）が残っている`);
}

// ---- 子供に見える文字
const KANJI = /[一-鿿㐀-䶿]/;
// 子供に見えるカタカナは、品物名（vocab）と発注で決まったモード名の語だけ（DESINGN.md 4章）
const KATAKANA_RUN = /[ァ-ヶー]{2,}|[ァ-ヶ]/g;
const vocabTs = readFileSync(path.join(root, 'src/content/vocab.ts'), 'utf8');
// 物の名前（外来語）は可。かたちパズルで作る絵の名前もここに足す（動作・説明の語「タップ」「ヒント」「レジ」等は不可）
const KATAKANA_OK = new Set<string>([
  'パズル',
  'ノート',
  'ハート',
  'アイス',
  'ロケット',
  'ロボット',
  'ヨット',
  'ケーキ',
  'トラック',
]);
for (const m of vocabTs.matchAll(/label: '([^']+)'/g)) {
  for (const k of m[1]!.match(KATAKANA_RUN) ?? []) KATAKANA_OK.add(k);
}
const badKatakana = (t: string) => (t.match(KATAKANA_RUN) ?? []).filter((k) => !KATAKANA_OK.has(k));
const LATIN = /[A-Za-z]/;
const EMOJI = /\p{Extended_Pictographic}/u;
for (const [key, entry] of Object.entries(VOICE_CATALOG)) {
  const t = voiceText(entry);
  if (KANJI.test(t)) problems.push(`voice ${key}: 漢字「${t}」`);
  if (LATIN.test(t)) problems.push(`voice ${key}: 英字「${t}」`);
  if (EMOJI.test(t)) problems.push(`voice ${key}: 絵文字「${t}」`);
  for (const k of badKatakana(t))
    problems.push(`voice ${key}: 許可されていないカタカナ「${k}」（${t}）`);
}
const childDirs = ['src/app', 'src/modes', 'src/ui'].map((d) => path.join(root, d));
const parentFiles = new Set(['src/app/ParentGate.tsx', 'src/app/ChunkErrorBoundary.tsx']);
for (const dir of childDirs) {
  for (const file of walk(dir, ['.tsx'])) {
    if (parentFiles.has(rel(file))) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes('保護者') || /^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const m of line.matchAll(/>([^<>{}]+)</g)) {
        const text = m[1]!.trim();
        // 型引数や比較演算子（a >= b && c < d、Array<T>）など、JSX の文字でないものを除く
        if (!text || /[=&;()|?:]/.test(text) || /^[A-Za-z_$][\w$.]*$/.test(text)) continue;
        const at = `${rel(file)}:${i + 1}`;
        if (KANJI.test(text)) problems.push(`${at} 子供画面に漢字「${text}」`);
        if (LATIN.test(text)) problems.push(`${at} 子供画面に英字「${text}」`);
        if (EMOJI.test(text)) problems.push(`${at} 子供画面に絵文字「${text}」`);
        for (const k of badKatakana(text))
          problems.push(`${at} 子供画面に許可されていないカタカナ「${k}」`);
      }
    });
  }
}

if (problems.length) {
  console.error(`DESINGN.md の規約違反 ${problems.length} 件:`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
console.log(
  `OK: DESINGN.md の自動検査に違反はありません（トークン色 ${tokenColors.size}・パレット ${paletteColors.size}）`,
);
