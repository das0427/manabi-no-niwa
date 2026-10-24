/**
 * 教材パックの音声台本を書き出す（npm run voice:packs）。
 *   voice/packs/<packId>.json … 言い回し・文（キー = よみのハッシュ。音声は public/audio/<packId>/<hash>.mp3）
 *   voice/packs/num.json      … 数の部品（public/audio/num/<hash>.mp3）
 * 形式は voice/script.json と同じ（scripts/voice/generate.py の --script / --out で生成）。
 * 出力先をパックごとに分けるのは、generate.py が manifest に無い古いファイルを消すため（v1 の音声を消さない）。
 *
 * 文は問題データから再帰的に拾う（エンジンの項目名に頼らない）: かな・漢字を含む文字列を全部。
 * 生成問題は seed を変えて生成した問題から拾う（qa.ts と同じ数）。
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RETRY_MESSAGE } from '../src/core/answer/number';
import { sampleItems } from '../src/curriculum/qa';
import type { PackContent, UnitSpec } from '../src/curriculum/types';
import { GENERIC_WRONG } from '../src/units/unitFlow';
import { allNumberParts, speechParts } from '../src/voice/speech';
import { yomiHash } from '../src/voice/hash';

const JA = /[ぁ-ゖァ-ヺ一-鿿]/;
/** 文として読まない項目（ID・キー・絵の名前など） */
const SKIP_KEYS = new Set([
  'id',
  'identity',
  'engine',
  'objective',
  'misconception',
  'icon',
  'key',
  'svg',
  'markup',
]);

export function collectTexts(x: unknown, out: Set<string>, key = ''): void {
  if (typeof x === 'string') {
    if (!SKIP_KEYS.has(key) && JA.test(x)) out.add(x);
    return;
  }
  if (Array.isArray(x)) {
    for (const v of x) collectTexts(v, out, key);
    return;
  }
  if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) if (typeof v !== 'function') collectTexts(v, out, k);
  }
}

export function unitTexts(unit: UnitSpec, seeds?: number): Set<string> {
  const out = new Set<string>();
  collectTexts({ title: unit.title, intro: unit.intro, misconceptions: unit.misconceptions }, out);
  if (unit.source.kind !== 'legacy')
    for (const it of sampleItems(unit, seeds)) collectTexts(it, out);
  return out;
}

interface Entry {
  key: string;
  text: string;
  yomi?: string;
}

export function packScript(
  pack: PackContent,
  seeds?: number,
): { pack: Entry[]; numbers: Set<string> } {
  const texts = new Set<string>([GENERIC_WRONG, ...Object.values(RETRY_MESSAGE)]);
  for (const u of pack.units) for (const t of unitTexts(u, seeds)) texts.add(t);
  const entries = new Map<string, Entry>();
  const numbers = new Set<string>();
  for (const t of texts) {
    for (const p of speechParts(pack.packId, t)) {
      if (p.key.startsWith('num/')) {
        numbers.add(p.yomi);
        continue;
      }
      const key = p.key.slice(pack.packId.length + 1);
      if (!entries.has(key))
        entries.set(key, { key, text: p.text, ...(p.yomi !== p.text ? { yomi: p.yomi } : {}) });
    }
  }
  return { pack: [...entries.values()].sort((a, b) => a.key.localeCompare(b.key)), numbers };
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const root = join(import.meta.dirname, '..');
  const packsDir = join(root, 'src', 'packs');
  const outDir = join(root, 'voice', 'packs');
  mkdirSync(outDir, { recursive: true });
  for (const d of readdirSync(packsDir, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('_')) continue;
    const mod = (await import(pathToFileURL(join(packsDir, d.name, 'index.ts')).href)) as {
      default: PackContent;
    };
    const { pack } = packScript(mod.default);
    writeFileSync(
      join(outDir, `${d.name}.json`),
      JSON.stringify({ version: 1, entries: pack }, null, 2) + '\n',
    );
    console.log(`voice/packs/${d.name}.json: ${pack.length} 本`);
  }
  // 数の部品は全部（どの数も読めるように）
  const nums = allNumberParts().map((y) => ({ key: yomiHash(y), text: y }));
  writeFileSync(
    join(outDir, 'num.json'),
    JSON.stringify({ version: 1, entries: nums }, null, 2) + '\n',
  );
  console.log(`voice/packs/num.json: ${nums.length} 本`);
}
