/**
 * 英語の音声の台本（key → 英文）。問題データ（listen の audio）から作る。
 * scripts/voice/generate_en.py の台本（voice/script-en.json）と同じ形で返す:
 *   { key: '<packId>.<種類>.<スラッグ>', text: '英文' } → public/audio/en/<key>.mp3
 * listen の key は 'en/' + この key（core/audio は public/audio/<key>.mp3 を読む）。
 * script-en.json はこの関数の出力を書き出したもの（テストで一致を確かめる）。
 */
import type { PackContent } from '../../curriculum/types';

export interface EnEntry {
  key: string;
  text: string;
}

function walk(x: unknown, out: Map<string, string>, clash: string[]): void {
  if (Array.isArray(x)) {
    for (const v of x) walk(v, out, clash);
    return;
  }
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (typeof o.key === 'string' && typeof o.text === 'string' && o.key.startsWith('en/')) {
      const k = o.key.slice(3);
      const prev = out.get(k);
      if (prev !== undefined && prev !== o.text) clash.push(`${k}: 「${prev}」と「${o.text}」`);
      out.set(k, o.text);
    }
    for (const v of Object.values(o)) if (typeof v !== 'function') walk(v, out, clash);
  }
}

/** パックの全問題の英語の音声（key の昇順）。同じ key に違う文があれば clash に入れる */
export function englishScript(pack: PackContent): { entries: EnEntry[]; clash: string[] } {
  const out = new Map<string, string>();
  const clash: string[] = [];
  for (const u of pack.units) walk(u.source.items ?? [], out, clash);
  const entries = [...out.entries()]
    .map(([key, text]) => ({ key, text }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return { entries, clash };
}
