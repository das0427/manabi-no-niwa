/**
 * public/icons/icon.svg から PNG アイコンを作る（Playwright の Chromium で描画）。
 * 実行: npx tsx e2e/helpers/render-icons.ts
 *  - icon-192.png / icon-512.png : icon.svg そのまま（角丸、外側は透明）
 *  - icon-maskable-512.png       : 全面を紙色で塗り、絵を 72% に縮めて中央に置く（マスクで切られても絵が残る）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const iconsDir = path.resolve(import.meta.dirname, '../../public/icons');
const svg = readFileSync(path.join(iconsDir, 'icon.svg'), 'utf8');
const art = /<g id="art"[\s\S]*?<\/g>/.exec(svg)?.[0];
if (!art) throw new Error('icon.svg に <g id="art"> がありません');

const maskableSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect x="0" y="0" width="100" height="100" fill="#FBF5E9"/>' +
  `<g transform="translate(50 50) scale(0.72) translate(-50 -50)">${art}</g></svg>`;

const browser = await chromium.launch();
try {
  const render = async (source: string, size: number, file: string, transparent: boolean) => {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">` +
        `<img src="data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}" ` +
        `width="${size}" height="${size}" style="display:block"></body></html>`,
    );
    const buf = await page.screenshot({
      omitBackground: transparent,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    writeFileSync(path.join(iconsDir, file), buf);
    await page.close();
  };
  await render(svg, 192, 'icon-192.png', true);
  await render(svg, 512, 'icon-512.png', true);
  await render(maskableSvg, 512, 'icon-maskable-512.png', false);
  console.log('icons written to', iconsDir);
} finally {
  await browser.close();
}
