/**
 * 文字の配置の検査の前に、古いスクリーンショットを消す（C26。playwright.text-layout.config.ts の globalSetup）。
 * MNW_FRESH=1 で単元を絞らず（MNW_UNITS なし）に全部を流すときだけ、shots/ の種類ごとのフォルダを消す。
 * 違反が 0 になった種類に、前の実行の画像が残らないようにする（markup-leak の古い画像が残っていた）。
 * 単元を絞った実行・途中からの続きでは消さない（ほかの単元の画像を失わないため）。
 */
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { REPORT_DIR } from './text-layout-report';

export default function setup(): void {
  if (process.env.MNW_FRESH !== '1') return;
  if ((process.env.MNW_UNITS ?? '').trim() !== '') return;
  const shots = path.resolve(import.meta.dirname, '..', '..', REPORT_DIR, 'shots');
  if (!existsSync(shots)) return;
  for (const e of readdirSync(shots, { withFileTypes: true }))
    if (e.isDirectory()) rmSync(path.join(shots, e.name), { recursive: true, force: true });
  console.log(`[text-layout] 古い shots/ を消しました（MNW_FRESH=1・全単元）`);
}
