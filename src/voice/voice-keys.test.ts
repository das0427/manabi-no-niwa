// @vitest-environment node
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasVoice, VOICE_CATALOG } from './catalog';

/**
 * src 配下のソースに直接書かれた音声キー（文字列リテラル）が、すべて VOICE_CATALOG にあることを検査する。
 * 対象外: テンプレート文字列で組み立てるキー（`count.ko.${n}` など。実行時に dev 警告で検知する）、
 * テストファイル、台本そのもの（src/voice/catalog 以下）。
 */
const srcDir = fileURLToPath(new URL('..', import.meta.url));
const KEY_LITERAL =
  /(['"])((?:app|praise|title|item|num|count|shop|kana|sort|shape|mem|cmp|road|trace|math)\.[a-z0-9.-]+)\1/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(d.name)) out.push(p);
  }
  return out;
}

function isTarget(file: string): boolean {
  const rel = relative(srcDir, file).split(sep).join('/');
  if (/\.test\.(ts|tsx)$/.test(rel)) return false;
  if (rel.startsWith('voice/catalog/')) return false;
  if (/^modes\/[^/]+\/voice\.ts$/.test(rel)) return false; // 各モードの台本そのもの
  return true;
}

describe('voice keys referenced in source', () => {
  it('every literal voice key exists in VOICE_CATALOG', () => {
    const unknown: string[] = [];
    for (const file of walk(srcDir).filter(isTarget)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(KEY_LITERAL)) {
        const key = m[2]!;
        if (!hasVoice(key)) unknown.push(`${relative(srcDir, file)}: ${key}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('catalog keys are well-formed', () => {
    for (const k of Object.keys(VOICE_CATALOG)) expect(k).toMatch(/^[a-z0-9._-]+$/);
  });
});
