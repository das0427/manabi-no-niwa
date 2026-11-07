/**
 * 配布用 zip と版の情報を作る（`npm run build` の後に `npm run package`）。
 * 出力（release/）: zip（本体 + 音声の部品 3 つまで）・各 .sha256・manabi-no-niwa-update.json（版の情報）。
 * zip の中身: manabi-no-niwa/dist/、manabi-no-niwa/deploy/zorin/（install.sh が前提とする配置。mnwupdate/ も）、
 * README.md、LICENSE、licenses/、DESINGN.md、docs/device-checklist.md、部品の印 parts/<kind>.json。
 * zip・部品の印・版の情報の作り方は scripts/release-lib.ts（設計: docs/expansion/updater-design.md 3 章）。
 * 依存なし（zlib の deflate と自前の ZIP 書き出し）。.sh には実行権限を付ける。
 *
 * 入れるファイルは「入れてよいもの」で選ぶ（2.1.0 の点検 app-2。選び方は release-lib の「配布に入れるファイルの選び方」）:
 * - deploy/zorin・licenses・最上位の配布ファイルは git で追跡済みのものだけ。
 * - dist は、隠しファイル・隠しフォルダ（dist/.vite/ など）と、Thumbs.db・desktop.ini・~ 終わり・.swp を入れない。
 * - 最初に、配布に入る元（public・deploy/zorin・licenses・最上位の配布ファイル）に git の外のファイル・変更・
 *   無視されたファイルが無いかを確かめ、あれば一覧を出して止める（public は vite が dist にそのまま写すので、
 *   音声の作りかけもここで止まる）。わざとなら `npm run package -- --allow-dirty`。
 *   リンク（シンボリックリンク・ジャンクション）が deploy/zorin・licenses の下にあれば、--allow-dirty でも止める。
 * - dist/sw.js の事前保存の一覧と dist/packs.json のファイルが、zip に入れるファイルにすべてあるかを確かめ、
 *   無ければ止める（dist から除いた Thumbs.db などを vite が一覧に入れていると、家で install が 404 で失敗する）。
 *   これも --allow-dirty では通さない。
 * - zip ごとに、入れたファイルの一覧（パス・大きさ・sha256）を release/<zip の名前>.files.txt に書く（GitHub には上げない）。
 *
 * 版の番号は git のタグ（vX.Y.Z）と比べ、古い・公開済みと同じ・大きく飛ぶなら止める（release-lib の checkReleaseVersion。
 * わざとなら `npm run package -- --allow-jump`、まだ公開していないタグなら `-- --allow-existing-tag`）。
 * git のタグを読めない・タグが 1 つも無いときも止める（読めないまま比べずに出すと、版の番号の誤りを見のがす）。
 * わざと比べないなら `-- --no-tag-check`。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  checkReleaseSources,
  checkReleaseVersion,
  compareVersions,
  contentListText,
  findUnpackagedPrecache,
  isVersion,
  listTrackedReleaseFiles,
  packPart,
  parsePrecacheLists,
  parseReleaseNotes,
  readReleaseTags,
  sha256FileText,
  sourceProblems,
  todayInJapan,
  toJsonText,
  walkDist,
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

// --- 入れる前の確かめ（時間のかかる zip 作りの前に止める）

const allowDirty = process.argv.includes('--allow-dirty');
const noTagCheck = process.argv.includes('--no-tag-check');

// 配布に入る元（public・deploy/zorin・licenses・最上位の配布ファイル）の確かめ。何よりも先に行う
{
  let check;
  try {
    check = checkReleaseSources(root);
  } catch (e) {
    die(
      `配布に入る元を git で確かめられません: ${(e as Error).message}\n追跡済みのファイルだけを入れるため、git が使える作業ツリーで実行してください。`,
    );
  }
  const { errors, warnings } = sourceProblems(check, allowDirty);
  for (const w of warnings) console.warn(w);
  if (errors.length > 0) die(errors.join('\n\n'));
}

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
// 版の番号の誤り（大きく飛ぶ・古い・公開済みと同じ）は、自動の更新では取り返せないので、出す前に止める。
// タグを読めない・1 つも無いときも止める（黙って続けると、この確かめが働かない）。--no-tag-check のときだけ続ける
const releaseTags = (() => {
  if (noTagCheck) {
    console.warn(
      '警告: --no-tag-check なので、版の番号を git のタグ（これまでの版）と比べずに続けます。',
    );
    return [];
  }
  try {
    return readReleaseTags(root);
  } catch (e) {
    return die(
      `${(e as Error).message}\n版の番号を、これまでの版と比べられません。タグを取り込む（git fetch --tags）か、わざと比べないなら npm run package -- --no-tag-check。`,
    );
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

const distFiles = walkDist(dist);
if (distFiles.skipped.length > 0) {
  const shown = distFiles.skipped.slice(0, 20).map((p) => `dist/${p}`);
  const more = distFiles.skipped.length > 20 ? ` ほか ${distFiles.skipped.length - 20} 件` : '';
  console.log(`dist から入れないもの（隠しファイル・作業ファイル）: ${shown.join(' ')}${more}`);
}
// sw.js の事前保存の一覧・packs.json が読みに行くファイルは、すべて zip に入れる。
// vite は隠しファイルしか事前保存から除かないので、Thumbs.db・~ 終わりなどが dist にあると、
// zip には無いのに sw.js が取りに行き、家のサービスワーカーの install が 404 で失敗する。--allow-dirty でも通さない
const unpackaged = (() => {
  try {
    const packsFile = path.join(dist, 'packs.json');
    return findUnpackagedPrecache(
      parsePrecacheLists(
        readFileSync(path.join(dist, 'sw.js'), 'utf8'),
        existsSync(packsFile) ? readFileSync(packsFile, 'utf8') : null,
      ),
      distFiles.files.map(([, rel]) => rel),
    );
  } catch (e) {
    return die(
      `dist の事前保存の一覧（sw.js・packs.json）を確かめられません: ${(e as Error).message}\nnpm run build をやり直してください。`,
    );
  }
})();
if (unpackaged.length > 0) {
  const shown = unpackaged.slice(0, 20).map((p) => `  dist/${p}`);
  const more = unpackaged.length > 20 ? `\n  ほか ${unpackaged.length - 20} 件` : '';
  die(
    `sw.js の事前保存の一覧か packs.json にあるのに、zip に入らないファイルがあります（${unpackaged.length} 件）:\n${shown.join('\n')}${more}\n` +
      'Thumbs.db・desktop.ini・~ で終わる名前・.swp・__pycache__・.pyc などを vite が一覧に入れたためです。' +
      'このまま公開すると、家のサービスワーカーの install が 404 で失敗し、パックの確かめも止まります。' +
      'public の下から消して、npm run build をやり直してください（--allow-dirty でも通しません）。',
  );
}
const trackedFiles = (() => {
  try {
    return listTrackedReleaseFiles(root);
  } catch (e) {
    return die(`配布に入れるファイルを git の追跡済みから選べません: ${(e as Error).message}`);
  }
})();
const files: [string, string][] = [
  ...distFiles.files.map(([src, rel]): [string, string] => [src, `${TOP}/dist/${rel}`]),
  ...trackedFiles.map((rel): [string, string] => [path.join(root, rel), `${TOP}/${rel}`]),
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
  // 入れたファイルの一覧（パス・大きさ・sha256。部品の印は除く）。この文字の sha256 が contentId になる
  writeFileSync(`${out}.files.txt`, contentListText(part.content));
  console.log(
    `${path.relative(root, out)}  ${(part.bytes / 1024 / 1024).toFixed(2)} MB  ${part.files + 1} files`,
  );
  console.log(`sha256 ${part.sha256}`);
  console.log(`contentId ${part.contentId}`);
  console.log(`入れたファイルの一覧 ${path.relative(root, out)}.files.txt（GitHub には上げない）`);
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
