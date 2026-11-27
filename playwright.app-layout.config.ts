import { defineConfig, devices } from '@playwright/test';

/**
 * アプリの全画面の配置の検査（npm run check:app-layout。docs/test-plan.md 3.3）。
 * 開発サーバー（127.0.0.1:4298）を開発用の指定 ?dev-open で開き、起動・プロフィール選択・ホーム・ほかの がくねん・
 * 選ぶ画面・単元の地図・ノート・さくひん・おえかき・保護者画面を、プロフィール 13 通り × 画面サイズ 4 通りで検査する。
 * 違反は失敗にせず docs/screenshots/app-layout-report/ に出す（e2e/app-layout.al.ts）。
 *
 * 環境変数:
 *   MNW_APP_PROFILES=p4,g*     プロフィールを絞る（* が使える。カンマ区切り）
 *   MNW_APP_SCREENS=explore*   画面を絞る（* が使える。カンマ区切り）
 *   MNW_FRESH=1                途中の結果（.cache/app-layout/）を使わず、はじめから
 *   MNW_WORKERS=3              並列の数
 *   MNW_REUSE_SERVER=1         起動済みの開発サーバー（MNW_DEV_NO_HMR=1 で起動したもの）を使う
 *   MNW_PORT=4298              開発サーバーのポート（既定 4298。全体の文字の検査は 4299）
 *   MNW_SHOTS=8                種類ごとの代表のスクリーンショットの枚数（全体）
 * 検査自体の確認は --project=probe（npm run check:app-layout:probe）。page.setContent の見本だけを使うので、
 * 開発サーバーは起動しない。
 */
const port = Number(process.env.MNW_PORT) || 4298;
const probeOnly = /--project[= ]probe\b/.test(process.argv.join(' '));

export default defineConfig({
  testDir: 'e2e',
  // 通常の E2E（*.spec.ts）・文字の配置の検査（*.tl.ts）と分けるため、拡張子を .al.ts にする
  testMatch: /app-layout.*\.al\.ts$/,
  fullyParallel: true,
  workers: Number(process.env.MNW_WORKERS) || 3,
  // 1 プロフィール = 1 テスト（画面 100 前後 × 4 サイズ）。時間のかかる検査なので上限は長く取る
  timeout: 2 * 60 * 60 * 1000,
  retries: 0,
  reporter: [['line']],
  globalTeardown: './e2e/helpers/app-layout-report.ts',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'off',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'probe',
      testMatch: /app-layout-probe\.al\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'screens',
      testMatch: /app-layout\.al\.ts$/,
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--mute-audio'] } },
    },
  ],
  webServer: probeOnly
    ? undefined
    : {
        command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
        url: `http://127.0.0.1:${port}/`,
        // 自動の読み直し（HMR）を切った専用のサーバーを毎回起動する（ほかの開発サーバーを使わない）。
        // 自分で MNW_DEV_NO_HMR=1 npx vite --port <番号> を起動してあるときは MNW_REUSE_SERVER=1 で使える
        env: { MNW_DEV_NO_HMR: '1' },
        reuseExistingServer: process.env.MNW_REUSE_SERVER === '1',
        timeout: 120_000,
      },
});
