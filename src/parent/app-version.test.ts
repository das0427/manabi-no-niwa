// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from './util';

describe('アプリの版', () => {
  it('保護者画面と書き出しファイルの版は package.json の version と同じ（手で書かない）', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as {
      version: string;
    };
    expect(APP_VERSION).toBe(pkg.version);
  });
});
