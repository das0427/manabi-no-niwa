import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { packChunkName, precachePlugin } from './scripts/vite-plugin-precache.ts';

/** パックが値として import してよい本体のモジュール（check-packs でも検査） */
const PACK_RUNTIME = [
  '/src/core/util/rng.ts',
  '/src/text/kanji-grades.ts',
  '/src/text/rich.ts',
  // 数の答えの判定（他を import しない純粋関数。算数のパックが誤答例の確かめに使う）
  '/src/core/answer/number.ts',
];
function packRuntimeName(id: string): string | null {
  const p = id.replace(/\\/g, '/').split('?')[0] ?? '';
  // 既知の制約: rolldown の補助関数（動的 import の名前空間）は本体の hash 付きチャンクに入り、
  // パックがそれを読み込む。本体を更新するとパックの版も変わる（更新時に配信から取り直す）
  return PACK_RUNTIME.some((m) => p.endsWith(m)) ? 'pack-runtime' : null;
}

/**
 * 見本の教材パック（src/packs/_sample-*）をビルドに入れるか。E2E 用のビルドだけで '1' にする。
 * 既定（未設定）の本番ビルドには入らず、dist/packs.json にも出ない（docs/expansion/architecture.md 6章）。
 * 画面側は import.meta.env.VITE_MNW_SAMPLE_PACKS で同じ値を見る（src/packs/loader.ts）。
 */
const samplePacks = process.env.VITE_MNW_SAMPLE_PACKS === '1';

export default defineConfig({
  plugins: [react(), precachePlugin()],
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    // dist/.vite/manifest.json（パックの分離と npm run check:packs が使う。プリキャッシュには入れない）
    manifest: true,
    rollupOptions: {
      input: 'index.html',
      output: {
        // 教材パックを assets/packs/<packId>/ のチャンクに閉じ込める（R#5。旧 manualChunks）
        codeSplitting: {
          groups: [
            { name: packChunkName, priority: 100 },
            // パックが値として使う本体の小さな部品（乱数・漢字の学年表・RichText）を固定名のチャンクに
            // まとめる。本体を更新してもパックの import 先の名前が変わらず、パックの版（packs.json の hash）が
            // 変わらない（コードレビュー #2: 更新のたびに全パックが outdated になるのを防ぐ）
            // パックのグループは依存先も取り込むので、本体の部品は先（高い優先度）で取り分ける
            { name: packRuntimeName, priority: 110 },
          ],
        },
        // パックと pack-runtime はファイル名に hash を付けない（版は packs.json の内容 hash で管理する）
        chunkFileNames: (chunk) =>
          chunk.name === 'pack-runtime' || chunk.name.startsWith('packs/')
            ? 'assets/[name].js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
  define: { 'import.meta.env.VITE_MNW_SAMPLE_PACKS': JSON.stringify(samplePacks ? '1' : '') },
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    // 教材の自動検査（seed 1000 × 段階）は重く、並列実行では 5 秒を超えることがある
    testTimeout: 30000,
  },
});
