import { defineConfig, devices } from '@playwright/test';

/**
 * 自動更新の通し試験（npm run e2e:update）。e2e/update.spec.ts だけを、chromium で 1 つずつ流す。
 * 偽の GitHub（127.0.0.1 の 4800〜4999）と、一時フォルダに導入した古い版を本物の serve.py で動かし、
 * 保護者画面で「更新する」を押す。本体のビルドは試験の中で（見本パック入り・版を変えて）作るので、
 * 通常の E2E（playwright.config.ts）の webServer（vite preview）は使わない。
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: /update\.spec\.ts$/,
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
