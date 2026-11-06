/**
 * 配布用 zip と版の情報を作る（`npm run build` の後に `npm run package`）。
 * 出力（release/）: zip（本体 + 音声の部品 3 つまで）・各 .sha256・manabi-no-niwa-update.json（版の情報）。
 * zip の中身: manabi-no-niwa/dist/、manabi-no-niwa/deploy/zorin/（install.sh が前提とする配置。mnwupdate/ も）、
 * README.md、LICENSE、licenses/、DESINGN.md、docs/device-checklist.md、部品の印 parts/<kind>.json。
 * zip・部品の印・版の情報の作り方は scripts/release-lib.ts（設計: docs/expansion/updater-design.md 3 章）。
 * 依存なし（zlib の deflate と自前の ZIP 書き出し）。.sh には実行権限を付ける。
 * 版の番号は git のタグ（vX.Y.Z）と比べ、古い・公開済みと同じ・大きく飛ぶなら止める（release-lib の checkReleaseVersion。
 * わざとなら `npm run package -- --allow-jump`、まだ公開していないタグなら `-- --allow-existing-tag`）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAIN_KIND,
  MANIFEST_NAME,
  MIN_AUTO_UPDATE_FROM,
  TOP,
  audioGroupOf,
  assertNotes,
  audioPackIdOf,
  buildManifest,
  checkReleaseVersion,
  compareVersions,
  isVersion,
  packPart,
  parseReleaseNotes,
  sha256FileText,
  todayInJapan,
  toJsonText,
  type PackedPart,
  type ZipEntry,
} from './release-lib.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  version: string;
};
const dist = path.join(root, 'dist');
const releaseDir = path.join(root, 'release');

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

/** zip に入れない: Python のキャッシュ・OS の作業ファイル */
function isJunk(name: string): boolean {
  return name === '__pycache__' || name === '.DS_Store' || name.endsWith('.pyc');
}

function walk(dir: string, base: string): [string, string][] {
  const out: [string, string][] = [];
  for (const name of readdirSync(dir)) {
    if (isJunk(name)) continue;
    const p = path.join(dir, name);
    const rel = `${base}/${name}`;
    if (statSync(p).isDirectory()) out.push(...walk(p, rel));
    else out.push([p, rel]);
  }
  return out;
}

// --- 入れる前の確かめ（時間のかかる zip 作りの前に止める）

if (!existsSync(path.join(dist, 'index.html')) || !existsSync(path.join(dist, 'sw.js'))) {
  die('dist がありません。先に npm run build を実行してください。');
}
if (!isVersion(pkg.version))
  die(`package.json の version が X.Y.Z の形ではありません: ${pkg.version}`);
if (compareVersions(MIN_AUTO_UPDATE_FROM, pkg.version) > 0) {
  die(
    `package.json の version（${pkg.version}）が、更新できる最も古い版 MIN_AUTO_UPDATE_FROM（${MIN_AUTO_UPDATE_FROM}、scripts/release-lib.ts）より古いです。版を上げてから npm run build をやり直してください。`,
  );
}
// 版の番号の誤り（大きく飛ぶ・古い・公開済みと同じ）は、自動の更新では取り返せないので、出す前に止める
const releaseTags = (() => {
  try {
    return execFileSync('git', ['tag', '--list', 'v*'], { cwd: root, encoding: 'utf8' }).split(
      /\r?\n/,
    );
  } catch {
    console.warn('警告: git のタグを読めません。版の番号を、これまでの版と比べずに続けます。');
    return [];
  }
})();
const versionProblem = checkReleaseVersion(pkg.version, releaseTags, {
  allowJump: process.argv.includes('--allow-jump'),
  allowExistingTag: process.argv.includes('--allow-existing-tag'),
});
if (versionProblem) die(versionProblem);

const distVersion = (() => {
  try {
    return (
      JSON.parse(readFileSync(path.join(dist, 'version.json'), 'utf8')) as { appVersion?: unknown }
    ).appVersion;
  } catch {
    return undefined;
  }
})();
if (distVersion !== pkg.version) {
  die(
    `dist/version.json の appVersion（${String(distVersion ?? 'なし')}）が package.json の version（${pkg.version}）と違います。npm run build をやり直してください。`,
  );
}

// 保護者画面に出す短い説明（無くても止めない）
const notesFile = path.join(root, 'docs', 'expansion', `release-${pkg.version}.md`);
const notesRel = path.relative(root, notesFile).replaceAll('\\', '/');
let notes: string[] = [];
if (existsSync(notesFile)) {
  notes = parseReleaseNotes(readFileSync(notesFile, 'utf8'));
  if (notes.length === 0) {
    console.warn(
      `警告: ${notesRel} に「## 保護者画面に出す短い説明」の見出しか、その下の「- 」の箇条書きがありません。notes は空にします。`,
    );
  }
} else {
  console.warn(`警告: ${notesRel} がありません。notes は空にします。`);
}
try {
  assertNotes(notes); // 1 行 120 字まで（超えていれば zip を作る前に止める）
} catch (e) {
  die(`${notesRel}: ${(e as Error).message}`);
}

// --- 入れるファイルを集めて、部品（zip）ごとに分ける

const files: [string, string][] = [
  ...walk(dist, `${TOP}/dist`),
  ...walk(path.join(root, 'deploy/zorin'), `${TOP}/deploy/zorin`),
  ...walk(path.join(root, 'licenses'), `${TOP}/licenses`),
  [path.join(root, 'README.md'), `${TOP}/README.md`],
  [path.join(root, 'LICENSE'), `${TOP}/LICENSE`],
  [path.join(root, 'DESINGN.md'), `${TOP}/DESINGN.md`],
  [path.join(root, 'docs/device-checklist.md'), `${TOP}/docs/device-checklist.md`],
];

/**
 * 小学生の教材パックの音声（dist/audio/<packId>/）は数万本あるので、学年ごとの別の zip に分ける
 * （分け方は release-lib の audioGroupOf）。どの zip も同じ最上位フォルダ manabi-no-niwa/ を持つので、
 * 全部を同じ場所に展開すれば1つにそろう。
 */
const packIds: string[] = (() => {
  try {
    const pj = JSON.parse(readFileSync(path.join(dist, 'packs.json'), 'utf8')) as {
      packs?: Record<string, unknown>;
    };
    return Object.keys(pj.packs ?? pj);
  } catch {
    console.warn(
      '警告: dist/packs.json を読めません。音声を学年ごとに分けず、すべて本体に入れます。',
    );
    return [];
  }
})();
const groups = new Map<string, [string, string][]>([[MAIN_KIND, []]]);
for (const f of files) {
  const g = audioGroupOf(f[1], packIds) ?? MAIN_KIND;
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g)!.push(f);
}

// --- zip・.sha256 を書く

mkdirSync(releaseDir, { recursive: true });
const parts: PackedPart[] = [];
for (const [kind, list] of groups) {
  const entries: ZipEntry[] = list.map(([src, name]) => ({ name, data: readFileSync(src) }));
  // 変わらない部品を今の版から写すときに、この下を全部写す（main は毎回取得するので []）
  const roots = [
    ...new Set(
      list.flatMap(([, name]) => {
        const id = audioPackIdOf(name, packIds);
        return id === null ? [] : [`dist/audio/${id}`];
      }),
    ),
  ].sort();
  const part = packPart({ version: pkg.version, kind, entries, roots });
  const out = path.join(releaseDir, part.name);
  writeFileSync(out, part.zip);
  writeFileSync(`${out}.sha256`, sha256FileText(part.sha256, part.name));
  console.log(
    `${path.relative(root, out)}  ${(part.bytes / 1024 / 1024).toFixed(2)} MB  ${part.files + 1} files`,
  );
  console.log(`sha256 ${part.sha256}`);
  console.log(`contentId ${part.contentId}`);
  parts.push(part);
}

// --- 版の情報（これを最後に GitHub に上げる）

const manifest = buildManifest({
  version: pkg.version,
  date: todayInJapan(),
  minVersion: MIN_AUTO_UPDATE_FROM,
  notes,
  parts,
});
const manifestOut = path.join(releaseDir, MANIFEST_NAME);
writeFileSync(manifestOut, toJsonText(manifest));
console.log(
  `${path.relative(root, manifestOut)}  ${manifest.parts.length} parts  notes ${notes.length}`,
);

const tag = manifest.tag;
console.log('');
console.log(`GitHub Releases（${tag}）に上げる順:`);
console.log('  1. タグ ' + tag + ' の下書きのリリースを作る');
let step = 2;
for (const p of manifest.parts) {
  console.log(`  ${step++}. ${p.name} と ${p.name}.sha256 を上げる`);
}
console.log(
  `  ${step++}. 最後に ${MANIFEST_NAME} を上げる（これが先に出ると、まだ無い zip を取りに行かれる）`,
);
console.log(`  ${step}. 先行版（pre-release）にしない。「Set as latest」にして公開する`);
