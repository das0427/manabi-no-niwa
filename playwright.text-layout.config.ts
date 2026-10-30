import { defineConfig, devices } from '@playwright/test';

/**
 * 文字の配置の検査（npm run check:text-layout）。開発サーバー（127.0.0.1:4299）の
 * 開発用の画面 #/dev/unit/<unitId>/<n> を巡って、全単元の見本の問題を検査する。
 * 違反は失敗にせず docs/screenshots/text-layout-report/ に出す（e2e/text-layout.tl.ts）。
 *
 * 環境変数:
 *   MNW_UNITS=g1.math.*,p4.*   単元を絞る（* が使える。カンマ区切り）
 *   MNW_SEEDS=2                生成器の単元で、段階ごとに作る seed の数
 *   MNW_MAX_ITEMS=0            1単元の問題数の上限（0 = 上限なし。上限で減らしたらログと要約に出す）
 *   MNW_FRESH=1                途中の結果（.cache/text-layout/）を使わず、はじめから
 *   MNW_WORKERS=6              並列の数
 *   MNW_BROWSER=firefox        Firefox で（MNW_FIREFOX_PATH の firefox を使う）
 *   MNW_REUSE_SERVER=1         起動済みの開発サーバー（MNW_DEV_NO_HMR=1 で起動したもの）を使う
 */
const firefox = process.env.MNW_BROWSER === 'firefox';

export default defineConfig({
  testDir: 'e2e',
  // 通常の E2E（*.spec.ts）と分けるため、拡張子を .tl.ts にする
  testMatch: /text-layout.*\.tl\.ts$/,
  fullyParallel: true,
  workers: Number(process.env.MNW_WORKERS) || 6,
  // 大きな単元（数百問 × 状態 × 画面サイズ）は時間がかかる
  timeout: 3 * 60 * 60 * 1000,
  retries: 0,
  reporter: [['line']],
  globalTeardown: './e2e/helpers/text-layout-teardown.ts',
  use: {
    baseURL: 'http://127.0.0.1:4299',
    trace: 'off',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'probe',
      testMatch: /text-layout-probe\.tl\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'units',
      testMatch: /text-layout\.tl\.ts$/,
      use: firefox
        ? {
            ...devices['Desktop Firefox'],
            launchOptions: { executablePath: process.env.MNW_FIREFOX_PATH || undefined },
          }
        : { ...devices['Desktop Chrome'], launchOptions: { args: ['--mute-audio'] } },
    },
  ],
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4299 --strictPort',
    url: 'http://127.0.0.1:4299/',
    // 自動の読み直し（HMR）を切った専用のサーバーを毎回起動する（ほかの開発サーバーを使わない）。
    // 自分で MNW_DEV_NO_HMR=1 npx vite --port 4299 を起動してあるときは MNW_REUSE_SERVER=1 で使える
    env: { MNW_DEV_NO_HMR: '1' },
    reuseExistingServer: process.env.MNW_REUSE_SERVER === '1',
    timeout: 120_000,
  },
});
