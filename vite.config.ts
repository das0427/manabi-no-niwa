import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { packChunkName, precachePlugin } from './scripts/vite-plugin-precache.ts';

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
          groups: [{ name: packChunkName, priority: 100 }],
        },
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
  },
});
