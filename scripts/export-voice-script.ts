/**
 * VOICE_CATALOG から voice/script.json を書き出す（npm run voice:script）。
 * 形式は docs/assets-pipeline.md の script.json。キー順にソートし、
 * yomi は text と違うときだけ、speed は指定があるときだけ出す。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VOICE_CATALOG } from '../src/voice/catalog/index.ts';
import { voiceText, voiceYomi } from '../src/voice/types.ts';

interface ScriptEntry {
  key: string;
  text: string;
  yomi?: string;
  speed?: number;
}

export function buildScript(): { version: 1; entries: ScriptEntry[] } {
  const entries: ScriptEntry[] = Object.keys(VOICE_CATALOG)
    .sort()
    .map((key) => {
      const e = VOICE_CATALOG[key]!;
      const text = voiceText(e);
      const yomi = voiceYomi(e);
      const out: ScriptEntry = { key, text };
      if (yomi !== text) out.yomi = yomi;
      if (typeof e !== 'string' && e.speed !== undefined) out.speed = e.speed;
      return out;
    });
  return { version: 1, entries };
}

export function scriptText(): string {
  return JSON.stringify(buildScript(), null, 2) + '\n';
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(here, '..', 'voice', 'script.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, scriptText(), 'utf8');
  console.log(`voice/script.json: ${buildScript().entries.length} entries`);
}
