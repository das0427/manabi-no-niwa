/**
 * 台本(VOICE_CATALOG / voice/script.json)と public/audio を突き合わせる（npm run check:audio）。
 *  - 欠け: 台本にあるが manifest か mp3 が無い
 *  - 余り: manifest か public/audio にあるが台本に無い
 *  - 台本ずれ: voice/script.json が VOICE_CATALOG と違う（npm run voice:script を忘れている）
 *  - 未生成: 台本の文・パラメータが変わって hash が合わない
 *    （hash は generate.py が計算するので、.venv の python で generate.py --dry-run を呼んで件数を得る）
 * 欠け・台本ずれ・未生成のどれかがあれば exit 1。余りは警告のみ。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICE_CATALOG } from '../src/voice/catalog/index.ts';
import { scriptText } from './export-voice-script.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const audioDir = resolve(root, 'public', 'audio');
const scriptPath = resolve(root, 'voice', 'script.json');
const manifestPath = resolve(audioDir, 'manifest.json');

const problems: string[] = [];
const warnings: string[] = [];
const catalogKeys = Object.keys(VOICE_CATALOG);
const catalogSet = new Set(catalogKeys);

// 1. voice/script.json が台本と一致しているか
if (!existsSync(scriptPath)) {
  problems.push('voice/script.json がありません（npm run voice:script）');
} else {
  const current = readFileSync(scriptPath, 'utf8').replace(/\r\n/g, '\n');
  if (current !== scriptText()) {
    problems.push('voice/script.json が台本(VOICE_CATALOG)と違います（npm run voice:script）');
  }
}

// 2. manifest と mp3 の有無
interface Manifest {
  entries?: Record<string, { file: string; hash: string; ms: number }>;
}
let manifest: Manifest = {};
if (!existsSync(manifestPath)) {
  problems.push('public/audio/manifest.json がありません（npm run voice:build）');
} else {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')) as Manifest;
}
const entries = manifest.entries ?? {};
const files = new Set(existsSync(audioDir) ? readdirSync(audioDir) : []);

const missing: string[] = [];
for (const k of catalogKeys) {
  const e = entries[k];
  if (!e) missing.push(`${k} (manifest に無い)`);
  else if (!files.has(e.file)) missing.push(`${k} (${e.file} が無い)`);
}
const extra: string[] = [];
for (const k of Object.keys(entries)) if (!catalogSet.has(k)) extra.push(`${k} (manifest のみ)`);
for (const f of files) {
  if (f === 'manifest.json') continue;
  if (!f.endsWith('.mp3') || !catalogSet.has(f.slice(0, -4))) extra.push(`${f} (ファイルのみ)`);
}
if (missing.length) problems.push(`欠け ${missing.length} 件:\n  ${missing.join('\n  ')}`);
if (extra.length) warnings.push(`余り ${extra.length} 件:\n  ${extra.join('\n  ')}`);

// 3. hash 不一致（台本変更後の未生成）。generate.py の dry-run に聞く
const py = resolve(
  root,
  '.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
if (!existsSync(py)) {
  warnings.push('.venv が無いため hash 照合を省略しました（npm run voice:build で環境を作る）');
} else if (existsSync(scriptPath)) {
  const r = spawnSync(py, ['-I', resolve(root, 'scripts', 'voice', 'generate.py'), '--dry-run'], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONUTF8: '1' },
  });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const m = /生成 (\d+) 件/.exec(out);
  if (r.status !== 0 || !m) {
    warnings.push(`hash 照合に失敗しました: ${out.trim().split('\n').slice(-3).join(' / ')}`);
  } else if (Number(m[1]) > 0 && missing.length === 0) {
    problems.push(`未生成/hash 不一致 ${m[1]} 件（台本の変更後に npm run voice:build が必要）`);
  }
}

console.log(
  `台本 ${catalogKeys.length} 件 / manifest ${Object.keys(entries).length} 件 / mp3 ${[...files].filter((f) => f.endsWith('.mp3')).length} 件`,
);
for (const w of warnings) console.warn(`警告: ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`NG: ${p}`);
  process.exit(1);
}
console.log('OK: 台本と音声が一致しています');
