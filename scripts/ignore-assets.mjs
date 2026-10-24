// Node でスクリプトを動かすとき（tsx）、画面の部品が読む CSS を空として扱う。
// 使い方: tsx --import ./scripts/ignore-assets.mjs scripts/xxx.ts
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function load(url, context, next) {
  if (url.endsWith('.css')) return { format: 'module', source: 'export default {};', shortCircuit: true };
  return next(url, context);
}
`),
);
