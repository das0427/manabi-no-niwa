/** 文字の配置の検査の後に、要約（report.json・summary.md）を作る（playwright.text-layout.config.ts） */
import path from 'node:path';
import { REPORT_DIR, writeSummary } from './text-layout-report';

export default function teardown(): void {
  const md = writeSummary(path.resolve(import.meta.dirname, '..', '..'));
  if (md) console.log(`[text-layout] 要約: ${REPORT_DIR}/summary.md`);
}
