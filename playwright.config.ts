import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // 環境変数 MNW_FIREFOX_PATH があれば、その firefox を使う（Windows で既定の場所から起動できない場合の回避用）
        launchOptions: { executablePath: process.env.MNW_FIREFOX_PATH || undefined },
      },
      // serve.py の検査はブラウザに依存しないため、chromium の project でだけ実行する
      testIgnore: /serve\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
