// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkDist, checkSources } from './check-packs.ts';
import {
  finalizeDist,
  isExcluded,
  packChunkName,
  packHash,
  type PackIndex,
  type ViteManifest,
} from './vite-plugin-precache.ts';

let dir: string;

async function put(rel: string, content: string): Promise<void> {
  const file = path.join(dir, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, 'utf8');
}

/** コア（index・shared）、小学生のパック 2つ（共有データ kanji-g1 を両方が使う）、コア同梱の p4 */
function baseManifest(): ViteManifest {
  return {
    'index.html': {
      file: 'assets/index-1.js',
      src: 'index.html',
      isEntry: true,
      imports: ['_shared-1.js'],
      dynamicImports: ['_g3-sansu-1.js', '_g3-kokugo-1.js', '_p4-1.js'],
      css: ['assets/index-1.css'],
    },
    '_shared-1.js': { file: 'assets/shared-1.js' },
    '_g3-sansu-1.js': {
      file: 'assets/packs/g3-sansu/g3-sansu-1.js',
      imports: ['_shared-1.js', '_kanji-g1-1.js'],
    },
    '_g3-kokugo-1.js': {
      file: 'assets/packs/g3-kokugo/g3-kokugo-1.js',
      imports: ['_kanji-g1-1.js'],
    },
    '_kanji-g1-1.js': { file: 'assets/packs/_data/strokes/kanji-g1-1.js' },
    '_p4-1.js': { file: 'assets/packs/p4/p4-1.js', imports: ['_shared-1.js'] },
  };
}

async function writeDist(manifest: ViteManifest): Promise<void> {
  await put('.vite/manifest.json', JSON.stringify(manifest));
  for (const c of Object.values(manifest)) {
    for (const f of [c.file, ...(c.css ?? []), ...(c.assets ?? [])]) await put(f, `/* ${f} */`);
  }
}

async function readIndex(): Promise<PackIndex> {
  return JSON.parse(await readFile(path.join(dir, 'packs.json'), 'utf8')) as PackIndex;
}

async function swFiles(): Promise<string[]> {
  const sw = await readFile(path.join(dir, 'sw.js'), 'utf8');
  return JSON.parse(/const __MNW_FILES__ = (\[.*\]);/.exec(sw)?.[1] ?? '[]') as string[];
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'mnw-packs-'));
  await put('index.html', '<html></html>');
  await put('audio/app.mp3', 'core audio');
  await put('audio/g3-sansu/q1.mp3', 'sansu audio');
  await put('audio/p4/hello.mp3', 'p4 audio');
  await put('audio/_sample-a/x.mp3', 'sample audio');
  await writeDist(baseManifest());
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('packChunkName（codeSplitting の名前）', () => {
  it('パック配下は packs/<id>/<id>、共有データは 1 ファイル 1 チャンク、それ以外は null', () => {
    expect(packChunkName('C:\\w\\src\\packs\\g3-sansu\\units\\a.ts')).toBe(
      'packs/g3-sansu/g3-sansu',
    );
    expect(packChunkName('/w/src/packs/g3-sansu/index.ts')).toBe('packs/g3-sansu/g3-sansu');
    expect(packChunkName('/w/src/packs/_data/strokes/kanji-g1.json')).toBe(
      'packs/_data/strokes/kanji-g1',
    );
    expect(packChunkName('/w/src/packs/_data/strokes/kanji-g1.json?import')).toBe(
      'packs/_data/strokes/kanji-g1',
    );
    expect(packChunkName('/w/src/packs/loader.ts')).toBeNull();
    expect(packChunkName('/w/src/engines/choice.ts')).toBeNull();
    expect(packChunkName('\0vite/preload-helper')).toBeNull();
  });
});

describe('finalizeDist（パックの分離）', () => {
  it('packs.json を出し、小学生のパックのチャンク・共有データ・音声をコアの一覧から外す', async () => {
    const info = await finalizeDist(dir);
    const index = await readIndex();
    expect(Object.keys(index)).toEqual(['g3-kokugo', 'g3-sansu']);
    expect(index['g3-sansu']?.files).toEqual([
      'assets/packs/_data/strokes/kanji-g1-1.js',
      'assets/packs/g3-sansu/g3-sansu-1.js',
      'audio/g3-sansu/q1.mp3',
    ]);
    // 共有データは使うパックすべての files に入る
    expect(index['g3-kokugo']?.files).toEqual([
      'assets/packs/_data/strokes/kanji-g1-1.js',
      'assets/packs/g3-kokugo/g3-kokugo-1.js',
    ]);
    expect(index['g3-sansu']?.bytes).toBe(
      '/* assets/packs/_data/strokes/kanji-g1-1.js */'.length +
        '/* assets/packs/g3-sansu/g3-sansu-1.js */'.length +
        'sansu audio'.length,
    );
    expect(index['g3-sansu']?.hash).toMatch(/^[0-9a-f]{16}$/);

    const files = await swFiles();
    expect(files).toEqual([
      'assets/index-1.css',
      'assets/index-1.js',
      'assets/packs/p4/p4-1.js',
      'assets/shared-1.js',
      'audio/app.mp3',
      'audio/p4/hello.mp3',
      'index.html',
      'packs.json',
    ]);
    expect(info.fileCount).toBe(files.length);
    // ビルドに入っていない見本パックの音声は消す。manifest はプリキャッシュしない
    expect(files.some((f) => f.includes('_sample'))).toBe(false);
    expect(isExcluded('.vite/manifest.json')).toBe(true);
  });

  it('パックの内容が変わると packs.json の hash が変わり、コアの一覧（パックのファイル）は変わらない', async () => {
    await finalizeDist(dir);
    const before = await readIndex();
    const filesBefore = await swFiles();
    await put('audio/g3-sansu/q1.mp3', 'sansu audio v2');
    await finalizeDist(dir);
    const after = await readIndex();
    expect(after['g3-sansu']?.hash).not.toBe(before['g3-sansu']?.hash);
    expect(after['g3-kokugo']?.hash).toBe(before['g3-kokugo']?.hash);
    expect(await swFiles()).toEqual(filesBefore);
  });

  it('packHash は「パス \\0 sha256 \\n」をパス順に並べた sha256 の先頭16桁（画面側と同じ計算）', () => {
    expect(
      packHash([
        {
          path: 'b',
          hash: 'df7e70e5021544f4834bbee64a9e3789febc4be81470df629cad6ddb03320a5c',
        },
        {
          path: 'a',
          hash: '559aead08264d5795d3909718cdd05abd49572e84fe55590eef31a88a08fdffd',
        },
      ]),
    ).toBe('cdc907f4882337ec');
  });

  it('manifest が無い dist では従来どおり（packs.json を作らず、すべてコア）', async () => {
    await rm(path.join(dir, '.vite'), { recursive: true });
    await finalizeDist(dir);
    expect(await swFiles()).toContain('assets/packs/g3-sansu/g3-sansu-1.js');
    expect(await swFiles()).not.toContain('packs.json');
  });
});

describe('checkDist（npm run check:packs）', () => {
  it('正しく分かれていれば違反なし', async () => {
    await finalizeDist(dir);
    const r = await checkDist(dir);
    expect(r.problems).toEqual([]);
    expect(r.summary.join('\n')).toContain('g3-sansu@');
  });

  it('パックが別のパックを import すると違反', async () => {
    const m = baseManifest();
    m['_g3-kokugo-1.js']!.imports!.push('_g3-sansu-1.js');
    await writeDist(m);
    await finalizeDist(dir);
    const r = await checkDist(dir);
    expect(r.problems.join('\n')).toContain('パック g3-kokugo が別のパック g3-sansu のチャンク');
  });

  it('パックだけが使う、パックの外のチャンク（共有コードの置き場違い）は違反', async () => {
    const m = baseManifest();
    m['_helper-1.js'] = { file: 'assets/helper-1.js' };
    m['_g3-sansu-1.js']!.imports!.push('_helper-1.js');
    m['_g3-kokugo-1.js']!.imports!.push('_helper-1.js');
    await writeDist(m);
    await finalizeDist(dir);
    const r = await checkDist(dir);
    expect(r.problems.join('\n')).toContain('コアにも自分にも属さないチャンク assets/helper-1.js');
  });

  it('コアが小学生のパックを静的に import すると違反', async () => {
    const m = baseManifest();
    m['index.html']!.imports!.push('_g3-sansu-1.js');
    await writeDist(m);
    await finalizeDist(dir);
    const r = await checkDist(dir);
    expect(r.problems.join('\n')).toContain('コアが小学生のパック g3-sansu');
  });

  it('packs.json が実際と合わない・見本パックが本番に出ると違反', async () => {
    const m = baseManifest();
    m['_sample-a-1.js'] = { file: 'assets/packs/_sample-a/_sample-a-1.js' };
    m['index.html']!.dynamicImports!.push('_sample-a-1.js');
    await writeDist(m);
    await finalizeDist(dir);
    const index = await readIndex();
    index['g3-sansu']!.hash = '0000000000000000';
    await writeFile(path.join(dir, 'packs.json'), JSON.stringify(index));
    const problems = (await checkDist(dir)).problems.join('\n');
    expect(problems).toContain('g3-sansu.hash が実際の内容と違う');
    expect(problems).toContain('見本パック _sample-a が packs.json にある');
    expect((await checkDist(dir, { allowSamples: true })).problems.join('\n')).not.toContain(
      '見本パック',
    );
  });
});

describe('checkSources', () => {
  it('パックが別のパックを import すると違反（共有データ・パックの外は可）', async () => {
    const packs = path.join(dir, 'src-packs');
    const w = async (rel: string, text: string) => {
      await mkdir(path.dirname(path.join(packs, rel)), { recursive: true });
      await writeFile(path.join(packs, rel), text, 'utf8');
    };
    await w(
      'g3-sansu/index.ts',
      "import x from '../_data/strokes/kanji-g1.json';\nimport { y } from '../../engines/a';\nimport type { PackContent } from '../loader';\nexport default x;",
    );
    await w('g3-kokugo/index.ts', "import { z } from '../g3-sansu/units';\nexport default z;");
    await w('Bad_Id/index.ts', 'export default 1;');
    const problems = checkSources(packs);
    expect(problems).toHaveLength(2);
    expect(problems.join('\n')).toContain('別のパック g3-sansu を import');
    expect(problems.join('\n')).toContain('Bad_Id: packId の形式が不正');
  });
});
