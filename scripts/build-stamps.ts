/**
 * はんこの素材（src/drawing/stamps.json）を生成する（`npm run build-stamps`。review-1 #10）。
 * src/illust の React の絵を renderToStaticMarkup で SVG 文字列にし、width/height=100 を付ける
 * （Firefox は大きさの無い SVG を drawImage できないため）。
 * 一覧は src/illust/stamps/catalog.ts。生成物はリポジトリに含め、check:design が一覧との一致を検査する。
 *
 * 実行: tsx --tsconfig tsconfig.app.json scripts/build-stamps.ts（JSX を読むため app の設定を使う）
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STAMP_CATEGORIES, STAMP_LIST } from '../src/illust/stamps/catalog.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src/drawing/stamps.json');

interface Def {
  id: string;
  label: string;
  status: string;
  draw: () => unknown;
}

// .tsx を型検査の対象（scripts の tsconfig）に入れないよう、パスを実行時に組み立てて読む
const load = (p: string) => import(pathToFileURL(path.join(root, p)).href);
const { renderToStaticMarkup } = (await import('react-dom/server')) as {
  renderToStaticMarkup: (el: unknown) => string;
};
const { createElement } = (await import('react')) as {
  createElement: (t: string, p: Record<string, unknown>, ...c: unknown[]) => unknown;
};
const { ILLUST } = (await load('src/illust/registry.ts')) as { ILLUST: Record<string, Def> };
const { stampIllust } = (await load('src/illust/stamps/index.ts')) as {
  stampIllust: Record<string, Def>;
};

const all: Record<string, Def> = { ...ILLUST };
for (const [id, d] of Object.entries(stampIllust)) {
  if (id in all) throw new Error(`stamp illust duplicates an existing illust: ${id}`);
  all[id] = d;
}

const stamps = STAMP_LIST.map((s) => {
  const def = all[s.id];
  if (!def) throw new Error(`stamp ${s.id}: illust not found`);
  if (def.status !== 'final') throw new Error(`stamp ${s.id}: illust is not final`);
  const svg = renderToStaticMarkup(
    createElement(
      'svg',
      { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 100 100', width: 100, height: 100 },
      def.draw(),
    ),
  );
  return { id: s.id, version: s.version, category: s.category, label: def.label, svg };
});

const json = {
  generatedBy: 'scripts/build-stamps.ts',
  categories: STAMP_CATEGORIES.map((c) => ({ ...c })),
  stamps,
};
// リポジトリの整形（prettier）と同じ形で書く（format:check を通すため）
const prettier = await import('prettier');
const options = (await prettier.resolveConfig(out)) ?? {};
writeFileSync(
  out,
  await prettier.format(JSON.stringify(json), { ...options, filepath: out }),
  'utf8',
);
console.log(
  `stamps.json: ${stamps.length} stamps / ${STAMP_CATEGORIES.length} categories → ${path.relative(root, out)}`,
);
