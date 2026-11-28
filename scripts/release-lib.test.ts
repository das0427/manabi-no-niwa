// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AUDIO_KINDS,
  MANIFEST_NAME,
  MAX_NOTES,
  MAX_NOTE_CHARS,
  MIN_AUTO_UPDATE_FROM,
  RELEASE_SOURCES,
  RELEASE_TOP_FILES,
  RELEASE_TRACKED_DIRS,
  TOP,
  assertNotes,
  audioGroupOf,
  audioPackIdOf,
  buildManifest,
  checkReleaseSources,
  checkReleaseVersion,
  compareVersions,
  computeContentId,
  contentListText,
  crc32,
  createZip,
  describeStatusEntries,
  findDirtySources,
  findLinks,
  findUnpackagedPrecache,
  isDistJunk,
  isExpectedStatus,
  isVersion,
  listTrackedReleaseBlobs,
  listTrackedReleaseFiles,
  makeMarker,
  markerEntryName,
  packPart,
  parseCatFileBatch,
  parsePrecacheLists,
  parseReleaseNotes,
  parseStatusZ,
  readReleaseTags,
  readTrackedReleaseFiles,
  runGit,
  sha256FileText,
  sha256Hex,
  sourceProblems,
  toJsonText,
  todayInJapan,
  walkDist,
  zipNameFor,
  type ContentFile,
  type GitRunner,
  type ManifestPart,
  type StatusEntry,
  type ZipEntry,
} from './release-lib.ts';
import { finalizeDist, renderServiceWorker, type PackIndex } from './vite-plugin-precache.ts';

// ---------------------------------------------------------------- 試験用の道具

const HEX_A = 'a'.repeat(64);
const HEX_B = 'b'.repeat(64);

function file(p: string, data: string): ContentFile {
  return { path: p, size: Buffer.byteLength(data), sha256: sha256Hex(data) };
}

interface ReadEntry {
  name: string;
  flags: number;
  method: number;
  madeBy: number;
  mode: number;
  crc: number;
  dosTime: number;
  dosDate: number;
  data: Buffer;
}

/** createZip の出力を読む小さな ZIP の読み取り（中央ディレクトリをたどる） */
function readZip(zip: Buffer): { count: number; entries: ReadEntry[] } {
  const endAt = zip.length - 22;
  expect(zip.readUInt32LE(endAt)).toBe(0x06054b50);
  const count = zip.readUInt16LE(endAt + 10);
  expect(zip.readUInt16LE(endAt + 8)).toBe(count);
  const cdSize = zip.readUInt32LE(endAt + 12);
  const cdOffset = zip.readUInt32LE(endAt + 16);
  expect(cdOffset + cdSize).toBe(endAt); // 中央ディレクトリは終端の直前までで終わる
  const entries: ReadEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(p)).toBe(0x02014b50);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const name = zip.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const method = zip.readUInt16LE(p + 10);
    const csize = zip.readUInt32LE(p + 20);
    const usize = zip.readUInt32LE(p + 24);
    const local = zip.readUInt32LE(p + 42);
    expect(zip.readUInt32LE(local)).toBe(0x04034b50);
    const lNameLen = zip.readUInt16LE(local + 26);
    const lExtraLen = zip.readUInt16LE(local + 28);
    const raw = zip.subarray(
      local + 30 + lNameLen + lExtraLen,
      local + 30 + lNameLen + lExtraLen + csize,
    );
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    expect(data.length).toBe(usize);
    const crc = zip.readUInt32LE(p + 16);
    expect(crc32(data)).toBe(crc);
    entries.push({
      name,
      flags: zip.readUInt16LE(p + 8),
      method,
      madeBy: zip.readUInt16LE(p + 4),
      mode: zip.readUInt32LE(p + 38) >>> 16,
      crc,
      dosTime: zip.readUInt16LE(p + 12),
      dosDate: zip.readUInt16LE(p + 14),
      data,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { count, entries };
}

function entry(name: string, data: string): ZipEntry {
  return { name, data: Buffer.from(data, 'utf8') };
}

/** 版 2.2.0 の正しい部品 4 つ */
function goodParts(version = '2.2.0'): ManifestPart[] {
  return [
    {
      kind: 'main',
      name: zipNameFor(version, 'main'),
      bytes: 178257920,
      sha256: HEX_A,
      contentId: HEX_B,
      files: 2310,
      unpackedBytes: 190012345,
    },
    {
      kind: 'audio-g1-g2',
      name: zipNameFor(version, 'audio-g1-g2'),
      bytes: 345000000,
      sha256: 'c'.repeat(64),
      contentId: 'd'.repeat(64),
      files: 9800,
      unpackedBytes: 344900000,
    },
    {
      kind: 'audio-g3-g4',
      name: zipNameFor(version, 'audio-g3-g4'),
      bytes: 790000000,
      sha256: 'e'.repeat(64),
      contentId: 'f'.repeat(64),
      files: 21000,
      unpackedBytes: 789800000,
    },
    {
      kind: 'audio-g5-g6',
      name: zipNameFor(version, 'audio-g5-g6'),
      bytes: 1300000000,
      sha256: '1'.repeat(64),
      contentId: '2'.repeat(64),
      files: 33000,
      unpackedBytes: 1299700000,
    },
  ];
}

function manifestInput(over: Record<string, unknown> = {}) {
  return {
    version: '2.2.0',
    date: '2026-11-20',
    minVersion: '2.1.0',
    notes: ['小学4年の算数に「がい数」を足しました'],
    parts: goodParts(),
    ...over,
  } as Parameters<typeof buildManifest>[0];
}

// ---------------------------------------------------------------- 定数・版・名前

describe('checkReleaseVersion（版の番号の誤りを、出す前に止める）', () => {
  const tags = ['v1.0.0', 'v2.0.0-beta.1', 'v2.0.0', 'v2.0.1', 'v2.0.2'];

  it('次の版（パッチ・マイナー・メジャーを 1 つ上げる）は通る', () => {
    for (const v of ['2.0.3', '2.0.9', '2.1.0', '3.0.0', '3.0.1']) {
      expect(checkReleaseVersion(v, tags), v).toBeNull();
    }
    expect(checkReleaseVersion('2.1.0', [])).toBeNull(); // タグが無い（git が無い）ときは比べない
  });

  it('同じ版のタグがあるなら止める（まだ公開していないタグなら指定で許す）', () => {
    expect(checkReleaseVersion('2.0.2', tags)).toContain('タグ v2.0.2 はもうあります');
    expect(checkReleaseVersion('2.0.2', tags, { allowExistingTag: true })).toBeNull();
    expect(
      checkReleaseVersion('2.1.0', [...tags, 'v2.1.0'], { allowExistingTag: true }),
    ).toBeNull();
  });

  it('これまでのいちばん新しい版より古ければ止める', () => {
    expect(checkReleaseVersion('2.0.1', ['v2.0.2'], { allowExistingTag: true })).toContain(
      'より古い',
    );
    expect(checkReleaseVersion('1.9.0', tags)).toContain('より古い');
    expect(checkReleaseVersion('2.0.10', ['v2.0.9'])).toBeNull(); // 数として比べる
  });

  it('大きく飛ぶ版（打ち間違いの疑い）は止める。わざとなら指定で許す', () => {
    for (const v of ['2.2.0', '4.0.0', '21.0.0', '3.1.0', '2.10.0']) {
      expect(checkReleaseVersion(v, tags), v).toContain('大きく飛んで');
      expect(checkReleaseVersion(v, tags, { allowJump: true }), v).toBeNull();
    }
  });

  it('形が X.Y.Z でなければ止める', () => {
    expect(checkReleaseVersion('2.1', tags)).toContain('X.Y.Z');
  });

  it('先頭に 0 のある版（2.01.0 など）は止める（2.1.0 と数は同じで、取り違えのもと）', () => {
    for (const v of ['2.01.0', '2.1.00', '02.1.0', '2.0.03']) {
      expect(checkReleaseVersion(v, tags), v).toContain('X.Y.Z');
      expect(checkReleaseVersion(v, [], { allowJump: true, allowExistingTag: true }), v).toContain(
        'X.Y.Z',
      );
    }
  });

  it('公開済みかは文字ではなく数で比べる（タグが v2.01.0 でも 2.1.0 は公開済み）', () => {
    const t = [...tags, 'v2.01.0'];
    expect(checkReleaseVersion('2.1.0', t)).toContain('タグ v2.01.0 はもうあります');
    expect(checkReleaseVersion('2.1.0', t, { allowExistingTag: true })).toBeNull();
    // 先頭の 0 のあるタグが最新のときも、数で「古い」を判定し、説明の版は数の形で出す
    const old = checkReleaseVersion('2.0.3', [...tags, 'v2.01.0']);
    expect(old).toContain('より古い');
    expect(old).toContain('2.1.0');
    expect(checkReleaseVersion('2.1.1', ['v2.01.0'])).toBeNull();
    expect(checkReleaseVersion('2.1.0', ['v2.0.2'])).toBeNull();
  });
});

describe('readReleaseTags（タグを読めない・1 つも無いときは止める）', () => {
  it('git が失敗したら例外にする（黙って空の一覧にしない）', () => {
    const failing: GitRunner = () => {
      throw new Error('Command failed: git tag\nfatal: not a git repository');
    };
    expect(() => readReleaseTags('/x', failing)).toThrow(/git のタグを読めません.*not a git/);
  });

  it('vX.Y.Z の形のタグが 1 つも無ければ例外にする（先行版の印つき・別の名前は数えない）', () => {
    expect(() => readReleaseTags('/x', () => '')).toThrow(/1 つもありません/);
    expect(() => readReleaseTags('/x', () => 'v2.0.0-beta.1\nvfoo\nrelease-1\n')).toThrow(
      /1 つもありません/,
    );
  });

  it('vX.Y.Z の形のタグだけを返す', () => {
    expect(readReleaseTags('/x', () => 'v1.0.0\r\nv2.0.0-beta.1\nv2.0.2\n\n')).toEqual([
      'v1.0.0',
      'v2.0.2',
    ]);
  });
});

describe('定数と名前', () => {
  it('置き場・版の情報の名前・自動で更新できる最も古い版', () => {
    expect(TOP).toBe('manabi-no-niwa');
    expect(MANIFEST_NAME).toBe('manabi-no-niwa-update.json');
    expect(MIN_AUTO_UPDATE_FROM).toBe('2.1.0');
    expect(isVersion(MIN_AUTO_UPDATE_FROM)).toBe(true);
    expect(AUDIO_KINDS).toEqual(['audio-g1-g2', 'audio-g3-g4', 'audio-g5-g6']);
  });

  it('zipNameFor: main は種類なし、ほかは -<種類>', () => {
    expect(zipNameFor('2.2.0', 'main')).toBe('manabi-no-niwa-2.2.0.zip');
    expect(zipNameFor('2.2.0', 'audio-g1-g2')).toBe('manabi-no-niwa-2.2.0-audio-g1-g2.zip');
    expect(zipNameFor('10.0.12', 'audio-g5-g6')).toBe('manabi-no-niwa-10.0.12-audio-g5-g6.zip');
    expect(markerEntryName('audio-g3-g4')).toBe('manabi-no-niwa/parts/audio-g3-g4.json');
  });

  it('版の形と比べ方（数として比べる）', () => {
    expect(isVersion('2.1.0')).toBe(true);
    for (const bad of ['2.1', '2.1.0-beta', 'v2.1.0', '2.1.0.1', '', '12345.0.0', '1.2.x']) {
      expect(isVersion(bad), bad).toBe(false);
    }
    for (const bad of ['2.01.0', '02.1.0', '2.1.00', '00.0.0', '0.00.0', '2.1.01']) {
      expect(isVersion(bad), bad).toBe(false);
    }
    for (const ok of ['0.0.0', '2.0.0', '10.20.300', '9999.9999.999999']) {
      expect(isVersion(ok), ok).toBe(true);
    }
    expect(compareVersions('2.10.0', '2.9.9')).toBeGreaterThan(0);
    expect(compareVersions('2.0.2', '2.1.0')).toBeLessThan(0);
    expect(compareVersions('2.1.0', '2.1.0')).toBe(0);
    expect(() => compareVersions('2.1', '2.1.0')).toThrow();
  });

  it('日本時間の今日', () => {
    expect(todayInJapan(new Date('2026-11-06T14:59:59Z'))).toBe('2026-11-06');
    expect(todayInJapan(new Date('2026-11-06T15:00:00Z'))).toBe('2026-11-07');
    expect(todayInJapan(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
  });

  it('JSON は 2 字下げ＋末尾に改行。.sha256 は sha256sum の形', () => {
    expect(toJsonText({ a: 1, b: [1] })).toBe('{\n  "a": 1,\n  "b": [\n    1\n  ]\n}\n');
    expect(sha256FileText(HEX_A, 'x.zip')).toBe(`${HEX_A}  x.zip\n`);
  });
});

// ---------------------------------------------------------------- 音声の部品への分け方

/** package-release.ts の、これまでの分け方（そのままの写し）。変わっていないことの基準 */
function legacyAudioGroupOf(name: string, packIds: string[]): string | null {
  const m = new RegExp(`^manabi-no-niwa/dist/audio/([^/]+)/`).exec(name);
  if (!m || !packIds.includes(m[1]!)) return null;
  const id = m[1]!;
  const g = /^g(\d)-/.exec(id)?.[1] ?? (id === 'prog-g16' ? '5' : /-g(\d)/.exec(id)?.[1]);
  const n = Number(g ?? 0);
  return n <= 2 ? 'audio-g1-g2' : n <= 4 ? 'audio-g3-g4' : 'audio-g5-g6';
}

const PACK_IDS = [
  'en-g34',
  'en-g56',
  'g1-ja',
  'g1-math',
  'g2-ja',
  'g2-math',
  'g3-ja',
  'g3-math',
  'g4-ja',
  'g4-math',
  'g5-ja',
  'g5-math',
  'g6-ja',
  'g6-math',
  'kanji-g12',
  'kanji-g34',
  'kanji-g56',
  'life-g12',
  'prog-g16',
  'sci-g34',
  'sci-g56',
  'soc-g34',
  'soc-g56',
  '_sample-a',
];
const audioFile = (id: string) => `manabi-no-niwa/dist/audio/${id}/q1.mp3`;

describe('audioGroupOf', () => {
  it('学年で 3 つに分ける（g1-… → g1-g2、kanji-g34 → g3-g4、prog-g16 → g5-g6）', () => {
    expect(audioGroupOf(audioFile('g1-ja'), PACK_IDS)).toBe('audio-g1-g2');
    expect(audioGroupOf(audioFile('g2-math'), PACK_IDS)).toBe('audio-g1-g2');
    expect(audioGroupOf(audioFile('kanji-g12'), PACK_IDS)).toBe('audio-g1-g2');
    expect(audioGroupOf(audioFile('life-g12'), PACK_IDS)).toBe('audio-g1-g2');
    expect(audioGroupOf(audioFile('g3-ja'), PACK_IDS)).toBe('audio-g3-g4');
    expect(audioGroupOf(audioFile('g4-math'), PACK_IDS)).toBe('audio-g3-g4');
    expect(audioGroupOf(audioFile('kanji-g34'), PACK_IDS)).toBe('audio-g3-g4');
    expect(audioGroupOf(audioFile('en-g34'), PACK_IDS)).toBe('audio-g3-g4');
    expect(audioGroupOf(audioFile('g5-ja'), PACK_IDS)).toBe('audio-g5-g6');
    expect(audioGroupOf(audioFile('g6-math'), PACK_IDS)).toBe('audio-g5-g6');
    expect(audioGroupOf(audioFile('soc-g56'), PACK_IDS)).toBe('audio-g5-g6');
    expect(audioGroupOf(audioFile('prog-g16'), PACK_IDS)).toBe('audio-g5-g6');
  });

  it('学年の分からない見本パックは audio-g1-g2（今までどおり）', () => {
    expect(audioGroupOf(audioFile('_sample-a'), PACK_IDS)).toBe('audio-g1-g2');
  });

  it('packs.json に無いもの（幼児の音声・数の部品など）や dist/audio の下でないものは null（main）', () => {
    expect(audioGroupOf(audioFile('p23'), PACK_IDS)).toBeNull();
    expect(audioGroupOf(audioFile('en-pre'), PACK_IDS)).toBeNull();
    expect(audioGroupOf(audioFile('g1-ja'), [])).toBeNull();
    expect(audioGroupOf('manabi-no-niwa/dist/audio/app.next.mp3', PACK_IDS)).toBeNull();
    expect(audioGroupOf('manabi-no-niwa/dist/audio/g1-ja', PACK_IDS)).toBeNull();
    expect(audioGroupOf('manabi-no-niwa/dist/assets/audio/g1-ja/q1.mp3', PACK_IDS)).toBeNull();
    expect(audioGroupOf('manabi-no-niwa/dist/index.html', PACK_IDS)).toBeNull();
    expect(audioGroupOf('other/dist/audio/g1-ja/q1.mp3', PACK_IDS)).toBeNull();
    expect(audioPackIdOf(audioFile('g3-ja'), PACK_IDS)).toBe('g3-ja');
    expect(audioPackIdOf(audioFile('p4'), PACK_IDS)).toBeNull();
  });

  it('今の分け方（package-release.ts にあった関数）と、どのパックでも同じ結果', () => {
    const ids = [...PACK_IDS, 'g0-x', 'foo', 'bar-g7', 'x-g9', 'prog-g16x', 'kanji-g12-extra'];
    for (const id of ids) {
      for (const name of [audioFile(id), `manabi-no-niwa/dist/audio/${id}/sub/dir/z.mp3`]) {
        expect(audioGroupOf(name, ids), name).toBe(legacyAudioGroupOf(name, ids));
      }
    }
  });
});

// ---------------------------------------------------------------- contentId

describe('computeContentId', () => {
  const sample: ContentFile[] = [
    { path: 'dist/index.html', size: 13, sha256: sha256Hex('<html></html>') },
    { path: 'dist/audio/g1-ja/q1.mp3', size: 3, sha256: sha256Hex('mp3') },
    { path: 'README.md', size: 2, sha256: sha256Hex('hi') },
  ];

  it('各行 <path>\\t<size>\\t<sha256>\\n を path の順につないだ UTF-8 の sha256（固定の見本と一致）', () => {
    const text =
      `README.md\t2\t${sha256Hex('hi')}\n` +
      `dist/audio/g1-ja/q1.mp3\t3\t${sha256Hex('mp3')}\n` +
      `dist/index.html\t13\t${sha256Hex('<html></html>')}\n`;
    const id = computeContentId(sample);
    expect(id).toBe(sha256Hex(Buffer.from(text, 'utf8')));
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    // 形が変わったことに気づくための固定値（sha256sum でも確かめた値）
    expect(id).toBe('220e87050ab85bd6325ede8e68bf4022c0e4c37a4b983b33179d87cbab17e51e');
  });

  it('渡す順によらない。渡した配列は並べ替えない', () => {
    const copy = [...sample];
    const reversed = [...sample].reverse();
    expect(computeContentId(reversed)).toBe(computeContentId(sample));
    expect(sample).toEqual(copy);
  });

  it('path の並べ方は JavaScript の文字列の < （大文字が先、- < . < /）', () => {
    const paths = ['dist/a/b', 'dist/a-b', 'dist/a.b', 'dist/B', 'dist/a', 'dist/あ'];
    const files = paths.map((p) => file(p, 'x'));
    const expectedOrder = [...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(expectedOrder).toEqual([
      'dist/B',
      'dist/a',
      'dist/a-b',
      'dist/a.b',
      'dist/a/b',
      'dist/あ',
    ]);
    const text = expectedOrder.map((p) => `${p}\t1\t${sha256Hex('x')}\n`).join('');
    expect(computeContentId(files)).toBe(sha256Hex(Buffer.from(text, 'utf8')));
  });

  it('同じ中身なら同じ ID。パス・大きさ・内容のどれが変わっても ID が変わる', () => {
    const base = computeContentId(sample);
    expect(computeContentId(sample.map((f) => ({ ...f })))).toBe(base);
    const changed = (i: number, patch: Partial<ContentFile>) =>
      computeContentId(sample.map((f, j) => (j === i ? { ...f, ...patch } : f)));
    expect(changed(0, { path: 'dist/index2.html' })).not.toBe(base);
    expect(changed(0, { size: 14 })).not.toBe(base);
    expect(changed(0, { sha256: HEX_A })).not.toBe(base);
    expect(computeContentId(sample.slice(1))).not.toBe(base);
  });

  it('ファイルが 0 個でも計算できる（空の文字列の sha256）', () => {
    expect(computeContentId([])).toBe(sha256Hex(''));
  });

  it('部品の印や先頭の manabi-no-niwa/ 付きのパス、おかしな値は断る', () => {
    expect(() => computeContentId([file('manabi-no-niwa/dist/a', 'x')])).toThrow(/manabi-no-niwa/);
    expect(() => computeContentId([file('/dist/a', 'x')])).toThrow();
    expect(() => computeContentId([file('dist/a\tb', 'x')])).toThrow();
    expect(() => computeContentId([file('dist/a\nb', 'x')])).toThrow();
    expect(() => computeContentId([file('', 'x')])).toThrow();
    expect(() => computeContentId([{ path: 'a', size: -1, sha256: HEX_A }])).toThrow();
    expect(() => computeContentId([{ path: 'a', size: 1.5, sha256: HEX_A }])).toThrow();
    expect(() => computeContentId([{ path: 'a', size: 1, sha256: 'ABC' }])).toThrow();
    expect(() => computeContentId([{ path: 'a', size: 1, sha256: HEX_A.toUpperCase() }])).toThrow();
    expect(() => computeContentId([file('a', 'x'), file('a', 'y')])).toThrow(/重なって/);
  });
});

// ---------------------------------------------------------------- 部品の印

describe('makeMarker', () => {
  const input = {
    kind: 'audio-g1-g2',
    version: '2.2.0',
    contentId: HEX_A,
    files: 12345,
    unpackedBytes: 345678901,
    roots: ['dist/audio/g1-ja', 'dist/audio/g2-ja'],
  };

  it('設計 3.2 節の形とキーの順', () => {
    const m = makeMarker(input);
    expect(Object.keys(m)).toEqual([
      'schema',
      'app',
      'kind',
      'version',
      'contentId',
      'files',
      'unpackedBytes',
      'roots',
    ]);
    expect(m).toEqual({
      schema: 1,
      app: 'manabi-no-niwa',
      kind: 'audio-g1-g2',
      version: '2.2.0',
      contentId: HEX_A,
      files: 12345,
      unpackedBytes: 345678901,
      roots: ['dist/audio/g1-ja', 'dist/audio/g2-ja'],
    });
  });

  it('main の roots は []。渡した roots の配列は写して持つ', () => {
    expect(makeMarker({ ...input, kind: 'main', roots: [] }).roots).toEqual([]);
    const roots = ['dist/audio/g1-ja'];
    const m = makeMarker({ ...input, roots });
    roots.push('dist/audio/x');
    expect(m.roots).toEqual(['dist/audio/g1-ja']);
  });

  it('正しくない値は断る', () => {
    expect(() => makeMarker({ ...input, kind: 'Audio' })).toThrow();
    expect(() => makeMarker({ ...input, version: '2.2' })).toThrow();
    expect(() => makeMarker({ ...input, contentId: 'abc' })).toThrow();
    expect(() => makeMarker({ ...input, files: -1 })).toThrow();
    expect(() => makeMarker({ ...input, unpackedBytes: 1.5 })).toThrow();
    const badRoots = ['audio/g1', 'dist/../x', '/dist/a', 'dist/a\\b', 'dist//a', 'dist/'];
    for (const bad of [...badRoots, 'dist/a\u0001b', 'dist/a\nb', 'dist/./a']) {
      expect(() => makeMarker({ ...input, roots: [bad] }), JSON.stringify(bad)).toThrow();
    }
  });
});

// ---------------------------------------------------------------- 版の情報

describe('buildManifest', () => {
  it('3.1 節の全欄とキーの順。parts は main を先頭に kind の順', () => {
    const shuffled = goodParts();
    const m = buildManifest(
      manifestInput({ parts: [shuffled[3], shuffled[1], shuffled[0], shuffled[2]] }),
    );
    expect(Object.keys(m)).toEqual([
      'schema',
      'app',
      'version',
      'tag',
      'date',
      'minVersion',
      'notes',
      'parts',
    ]);
    expect(m.schema).toBe(1);
    expect(m.app).toBe('manabi-no-niwa');
    expect(m.version).toBe('2.2.0');
    expect(m.tag).toBe('v2.2.0');
    expect(m.date).toBe('2026-11-20');
    expect(m.minVersion).toBe('2.1.0');
    expect(m.notes).toEqual(['小学4年の算数に「がい数」を足しました']);
    expect(m.parts.map((p) => p.kind)).toEqual([
      'main',
      'audio-g1-g2',
      'audio-g3-g4',
      'audio-g5-g6',
    ]);
    expect(Object.keys(m.parts[0]!)).toEqual([
      'kind',
      'name',
      'bytes',
      'sha256',
      'contentId',
      'files',
      'unpackedBytes',
    ]);
    expect(m.parts[0]).toEqual({
      kind: 'main',
      name: 'manabi-no-niwa-2.2.0.zip',
      bytes: 178257920,
      sha256: HEX_A,
      contentId: HEX_B,
      files: 2310,
      unpackedBytes: 190012345,
    });
    expect(m.parts[3]!.name).toBe('manabi-no-niwa-2.2.0-audio-g5-g6.zip');
  });

  it('JSON にすると 2 字下げ＋改行で書ける。入力は書き換えない。余計な欄は入れない', () => {
    const input = manifestInput();
    const before = JSON.stringify(input);
    const withZip = (input.parts as unknown as Record<string, unknown>[]).map((p) => ({
      ...p,
      zip: Buffer.from('zip'),
    }));
    const m = buildManifest({ ...input, parts: withZip as unknown as ManifestPart[] });
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(m)).not.toContain('"zip"');
    const text = toJsonText(m);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.startsWith('{\n  "schema": 1,\n  "app": "manabi-no-niwa",')).toBe(true);
    expect(JSON.parse(text)).toEqual(m);
  });

  it('main だけでも、minVersion と version が同じでも、notes が 0 個でもよい', () => {
    const m = buildManifest(
      manifestInput({ minVersion: '2.2.0', notes: [], parts: [goodParts()[0]] }),
    );
    expect(m.parts).toHaveLength(1);
    expect(m.notes).toEqual([]);
  });

  describe('決まりに合わなければ例外', () => {
    const bad = (over: Record<string, unknown>) => () => buildManifest(manifestInput(over));
    const withPart = (i: number, patch: Record<string, unknown>) => {
      const parts = goodParts().map((p, j) => (j === i ? { ...p, ...patch } : p));
      return bad({ parts });
    };

    it('version・minVersion・date', () => {
      for (const v of ['2.2', '2.2.0-beta.1', 'v2.2.0', '2.2.0.1', '', '1.2.x']) {
        expect(bad({ version: v, parts: goodParts(v) }), v).toThrow();
        expect(bad({ minVersion: v }), v).toThrow();
      }
      expect(bad({ minVersion: '2.2.1' })).toThrow(/minVersion/);
      expect(bad({ minVersion: '3.0.0' })).toThrow(/minVersion/);
      for (const d of ['2026-13-01', '2026-02-30', '2026/11/20', '26-11-20', '2026-1-2', '']) {
        expect(bad({ date: d }), d).toThrow();
      }
      expect(buildManifest(manifestInput({ date: '2028-02-29' })).date).toBe('2028-02-29');
    });

    it('main がちょうど1つ・parts の個数・kind', () => {
      expect(bad({ parts: [] })).toThrow();
      expect(bad({ parts: goodParts().slice(1) })).toThrow(/main/);
      expect(bad({ parts: [goodParts()[0], goodParts()[0]] })).toThrow(/重なって/);
      expect(bad({ parts: [...goodParts(), ...goodParts()] })).toThrow();
      const nine = Array.from({ length: 9 }, (_, i) =>
        i === 0
          ? goodParts()[0]
          : { ...goodParts()[1], kind: `k${i}`, name: zipNameFor('2.2.0', `k${i}`) },
      );
      expect(bad({ parts: nine })).toThrow();
      expect(bad({ parts: nine.slice(0, 8) })).not.toThrow();
      for (const kind of ['Audio', '-x', 'a_b', 'a/b', '', 'a'.repeat(41)]) {
        expect(withPart(1, { kind, name: zipNameFor('2.2.0', kind) }), kind).toThrow();
      }
      expect(
        withPart(1, { kind: 'a'.repeat(40), name: zipNameFor('2.2.0', 'a'.repeat(40)) }),
      ).not.toThrow();
    });

    it('name は zipNameFor と完全に一致', () => {
      expect(withPart(0, { name: 'manabi-no-niwa-2.2.0-main.zip' })).toThrow(/name/);
      expect(withPart(0, { name: 'manabi-no-niwa-2.1.0.zip' })).toThrow(/name/);
      expect(withPart(1, { name: 'manabi-no-niwa-2.2.0.zip' })).toThrow(/name/);
      expect(withPart(1, { name: 'manabi-no-niwa-2.2.0-audio-g3-g4.zip' })).toThrow(/name/);
      expect(withPart(1, { name: '../manabi-no-niwa-2.2.0-audio-g1-g2.zip' })).toThrow(/name/);
    });

    it('bytes は 1〜2147483648 の整数', () => {
      for (const bytes of [0, -1, 2147483649, 1.5, Number.NaN, '100']) {
        expect(withPart(0, { bytes }), String(bytes)).toThrow(/bytes/);
      }
      expect(withPart(0, { bytes: 1 })).not.toThrow();
      expect(withPart(0, { bytes: 2147483648 })).not.toThrow();
    });

    it('sha256・contentId は64桁の小文字の16進', () => {
      for (const v of ['', 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), `${'a'.repeat(63)}g`]) {
        expect(withPart(0, { sha256: v }), v).toThrow(/sha256/);
        expect(withPart(0, { contentId: v }), v).toThrow(/contentId/);
      }
    });

    it('files は 1〜65534、unpackedBytes は 0〜4294967295（整数）', () => {
      for (const files of [0, -1, 65535, 1.5]) {
        expect(withPart(0, { files }), String(files)).toThrow(/files/);
      }
      expect(withPart(0, { files: 1 })).not.toThrow();
      expect(withPart(0, { files: 65534 })).not.toThrow();
      for (const unpackedBytes of [-1, 4294967296, 0.5]) {
        expect(withPart(0, { unpackedBytes }), String(unpackedBytes)).toThrow(/unpackedBytes/);
      }
      expect(withPart(0, { unpackedBytes: 0 })).not.toThrow();
      expect(withPart(0, { unpackedBytes: 4294967295 })).not.toThrow();
    });

    it('notes は 0〜5 個・各 120 字まで（文字数は1文字ずつ数える）', () => {
      const six = Array.from({ length: MAX_NOTES + 1 }, (_, i) => `説明${i}`);
      expect(bad({ notes: six })).toThrow(/notes/);
      expect(bad({ notes: six.slice(0, MAX_NOTES) })).not.toThrow();
      expect(bad({ notes: ['あ'.repeat(MAX_NOTE_CHARS + 1)] })).toThrow(/notes\[0\]/);
      expect(bad({ notes: ['あ'.repeat(MAX_NOTE_CHARS)] })).not.toThrow();
      // サロゲートペアの文字も 1 字
      expect(bad({ notes: ['😀'.repeat(MAX_NOTE_CHARS)] })).not.toThrow();
      expect(bad({ notes: ['a', 1] })).toThrow(/notes\[1\]/);
      expect(bad({ notes: 'not array' })).toThrow();
    });
  });
});

describe('assertNotes', () => {
  it('0〜5 個・各 120 字までの文字列なら通る。違えば例外', () => {
    expect(() => assertNotes([])).not.toThrow();
    expect(() => assertNotes(['a', 'あ'.repeat(MAX_NOTE_CHARS)])).not.toThrow();
    expect(() => assertNotes(['あ'.repeat(MAX_NOTE_CHARS + 1)])).toThrow(/notes\[0\]/);
    expect(() => assertNotes(Array.from({ length: MAX_NOTES + 1 }, () => 'a'))).toThrow(/notes/);
    expect(() => assertNotes([1])).toThrow(/notes\[0\]/);
  });
});

// ---------------------------------------------------------------- リリースノート

describe('parseReleaseNotes', () => {
  const heading = '## 保護者画面に出す短い説明';

  it('見出しの下、次の見出しまでの「- 」の行の本文', () => {
    const md = [
      '# 2.2.0 リリースノート',
      '',
      '## 変わったこと',
      '- ここは入らない',
      '',
      heading,
      '- 小学4年の算数に「がい数」を足しました',
      '- おえかきの消しゴムが太くなりました',
      '',
      '## 既知の制約',
      '- ここも入らない',
    ].join('\n');
    expect(parseReleaseNotes(md)).toEqual([
      '小学4年の算数に「がい数」を足しました',
      'おえかきの消しゴムが太くなりました',
    ]);
  });

  it('見出しが無ければ []。見出しだけでも []', () => {
    expect(parseReleaseNotes('')).toEqual([]);
    expect(parseReleaseNotes('# タイトル\n- 箇条書き\n')).toEqual([]);
    expect(parseReleaseNotes(heading)).toEqual([]);
    expect(parseReleaseNotes(`${heading}\n\n文章だけ\n`)).toEqual([]);
    // 別の名前・別の深さの見出しは対象外
    expect(parseReleaseNotes('## 保護者画面に出す説明\n- a\n')).toEqual([]);
    expect(parseReleaseNotes('### 保護者画面に出す短い説明\n- a\n')).toEqual([]);
  });

  it('6 行以上は先頭の 5 行だけ', () => {
    const md = [heading, ...Array.from({ length: 8 }, (_, i) => `- 項目${i + 1}`)].join('\n');
    expect(parseReleaseNotes(md)).toEqual(['項目1', '項目2', '項目3', '項目4', '項目5']);
  });

  it('空行・「- 」で始まらない行・本文が空の行は飛ばす。CRLF でもよい。前後の空白は取る', () => {
    const md = [
      `${heading}  `,
      '',
      '- 一つめ  ',
      '',
      '補足の文章',
      '  - 字下げした行は箇条書きとして数えない',
      '-',
      '- ',
      '-ハイフンの後ろに空白なし',
      '* アスタリスクも数えない',
      '- 二つめ\tタブ入り',
      '',
    ].join('\r\n');
    expect(parseReleaseNotes(md)).toEqual(['一つめ', '二つめ タブ入り']);
  });

  it('次の見出し（# の数によらず）で止まる。見出しの前の箇条書きは入らない', () => {
    for (const next of ['# 次', '## 次', '### 次', '###### 次']) {
      const md = ['- 前の行', heading, '- 入る', next, '- 入らない'].join('\n');
      expect(parseReleaseNotes(md), next).toEqual(['入る']);
    }
    // # の直後に空白が無い行は見出しではない
    expect(parseReleaseNotes([heading, '- a', '#タグ', '- b'].join('\n'))).toEqual(['a', 'b']);
  });

  it('Markdown は解釈しない（そのまま文字として渡す）', () => {
    expect(parseReleaseNotes(`${heading}\n- **太字**: <b>x</b>\n`)).toEqual(['**太字**: <b>x</b>']);
  });
});

// ---------------------------------------------------------------- createZip

describe('createZip', () => {
  const when = new Date(2026, 10, 6, 12, 34, 56);

  it('中央ディレクトリの件数が入れた数と同じ。名前の順に並ぶ。中身が戻る', () => {
    const entries: ZipEntry[] = [
      entry('manabi-no-niwa/z.txt', 'zzz'),
      entry('manabi-no-niwa/dist/b.js', 'b'.repeat(1000)),
      entry('manabi-no-niwa/dist/a.js', 'a'),
      entry('manabi-no-niwa/Dist/c.js', 'c'),
      entry('manabi-no-niwa/empty.txt', ''),
    ];
    const names = entries.map((e) => e.name);
    const zip = createZip(entries, { date: when });
    expect(entries.map((e) => e.name)).toEqual(names); // 入力は並べ替えない
    const { count, entries: read } = readZip(zip);
    expect(count).toBe(5);
    expect(read.map((e) => e.name)).toEqual([
      'manabi-no-niwa/Dist/c.js',
      'manabi-no-niwa/dist/a.js',
      'manabi-no-niwa/dist/b.js',
      'manabi-no-niwa/empty.txt',
      'manabi-no-niwa/z.txt',
    ]);
    const byName = new Map(read.map((e) => [e.name, e.data.toString('utf8')]));
    expect(byName.get('manabi-no-niwa/dist/b.js')).toBe('b'.repeat(1000));
    expect(byName.get('manabi-no-niwa/empty.txt')).toBe('');
    expect(byName.get('manabi-no-niwa/z.txt')).toBe('zzz');
  });

  it('渡す順によらず同じ zip（時刻を固定すれば）', () => {
    const a = [entry('x/1.txt', '1'), entry('x/2.txt', '2'), entry('x/3.txt', '3')];
    expect(createZip([...a].reverse(), { date: when }).equals(createZip(a, { date: when }))).toBe(
      true,
    );
  });

  it('UTF-8 のフラグが立ち、日本語の名前が戻る', () => {
    const zip = createZip([entry('manabi-no-niwa/docs/保護者向け.md', '日本語')], { date: when });
    const { entries } = readZip(zip);
    expect(entries[0]!.name).toBe('manabi-no-niwa/docs/保護者向け.md');
    expect(entries[0]!.flags & 0x0800).toBe(0x0800);
    expect(entries[0]!.data.toString('utf8')).toBe('日本語');
    // ローカルヘッダーにも立っている
    expect(zip.readUInt16LE(6) & 0x0800).toBe(0x0800);
  });

  it('.sh は 0o100755、ほかは 0o100644（made by Unix）', () => {
    const zip = createZip(
      [
        entry('manabi-no-niwa/deploy/zorin/install.sh', '#!/bin/sh\n'),
        entry('manabi-no-niwa/deploy/zorin/serve.py', 'print(1)\n'),
        entry('manabi-no-niwa/README.md', '# r\n'),
        entry('manabi-no-niwa/dist/audio/a.mp3', 'mp3'),
      ],
      { date: when },
    );
    const modes = new Map(readZip(zip).entries.map((e) => [e.name, e.mode]));
    expect(modes.get('manabi-no-niwa/deploy/zorin/install.sh')).toBe(0o100755);
    expect(modes.get('manabi-no-niwa/deploy/zorin/serve.py')).toBe(0o100644);
    expect(modes.get('manabi-no-niwa/README.md')).toBe(0o100644);
    expect(modes.get('manabi-no-niwa/dist/audio/a.mp3')).toBe(0o100644);
    for (const e of readZip(zip).entries) expect(e.madeBy >> 8).toBe(3);
  });

  it('mp3 は格納（方式 0）、ほかは deflate（方式 8）', () => {
    const zip = createZip(
      [entry('a/x.mp3', 'mp3 data'), entry('a/y.json', '{"a":1}'.repeat(100))],
      { date: when },
    );
    const m = new Map(readZip(zip).entries.map((e) => [e.name, e.method]));
    expect(m.get('a/x.mp3')).toBe(0);
    expect(m.get('a/y.json')).toBe(8);
  });

  it('時刻を書く（DOS 形式）', () => {
    const e = readZip(createZip([entry('a/b', 'x')], { date: when })).entries[0]!;
    expect(e.dosTime).toBe((12 << 11) | (34 << 5) | 28);
    expect(e.dosDate).toBe(((2026 - 1980) << 9) | (11 << 5) | 6);
  });

  it('上限: 65535 件まで。それを超える・名前の重なり・空の名前・4GB 超えは例外', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `f/${i}.mp3`, data: Buffer.alloc(0) }));
    const full = createZip(many(65535), { date: when });
    expect(full.readUInt16LE(full.length - 22 + 10)).toBe(65535);
    expect(() => createZip(many(65536), { date: when })).toThrow(/多すぎる/);
    expect(() => createZip([entry('a', '1'), entry('a', '2')])).toThrow(/重なって/);
    expect(() => createZip([entry('', '1')])).toThrow();
    const huge = { length: 2 ** 32 } as unknown as Buffer;
    expect(() => createZip([{ name: 'big.mp3', data: huge }])).toThrow(/4GB/);
    const half = { length: 2 ** 31 + 1 } as unknown as Buffer;
    expect(() =>
      createZip([
        { name: 'a.mp3', data: half },
        { name: 'b.mp3', data: half },
      ]),
    ).toThrow(/4GB/);
  });

  it('空の zip も作れる', () => {
    expect(readZip(createZip([], { date: when })).count).toBe(0);
  });
});

// ---------------------------------------------------------------- packPart（部品の zip）

describe('packPart', () => {
  const when = new Date(2026, 10, 6, 12, 0, 0);
  const content = [
    entry('manabi-no-niwa/dist/index.html', '<html></html>'),
    entry('manabi-no-niwa/dist/audio/g1-ja/q1.mp3', 'mp3-1'),
    entry('manabi-no-niwa/dist/audio/g1-ja/q2.mp3', 'mp3-22'),
    entry('manabi-no-niwa/deploy/zorin/manabi.sh', '#!/bin/sh\n'),
  ];

  it('印を入れた zip を作り、contentId・files・unpackedBytes は印を除いた中身から計算する', () => {
    const roots = ['dist/audio/g1-ja'];
    const p = packPart({
      version: '2.2.0',
      kind: 'audio-g1-g2',
      entries: content,
      roots,
      date: when,
    });
    expect(p.name).toBe('manabi-no-niwa-2.2.0-audio-g1-g2.zip');
    expect(p.kind).toBe('audio-g1-g2');
    expect(p.files).toBe(4);
    expect(p.unpackedBytes).toBe(content.reduce((s, e) => s + e.data.length, 0));
    expect(p.bytes).toBe(p.zip.length);
    expect(p.sha256).toBe(sha256Hex(p.zip));

    // contentId は「先頭の manabi-no-niwa/ を除いた path」と中身から作る（印は入らない）
    const expectedId = computeContentId(
      content.map((e) => ({
        path: e.name.slice('manabi-no-niwa/'.length),
        size: e.data.length,
        sha256: sha256Hex(e.data),
      })),
    );
    expect(p.contentId).toBe(expectedId);

    // zip の中: 中身 + 印（件数は files + 1）。印は名前の順の中に入る
    const { count, entries } = readZip(p.zip);
    expect(count).toBe(p.files + 1);
    const names = entries.map((e) => e.name);
    expect(names).toContain('manabi-no-niwa/parts/audio-g1-g2.json');
    expect(names).toEqual([...names].sort());
    const markerEntry = entries.find((e) => e.name === 'manabi-no-niwa/parts/audio-g1-g2.json')!;
    const markerText = markerEntry.data.toString('utf8');
    expect(markerText.endsWith('\n')).toBe(true);
    expect(markerText.startsWith('{\n  "schema": 1,\n')).toBe(true);
    expect(JSON.parse(markerText)).toEqual({
      schema: 1,
      app: 'manabi-no-niwa',
      kind: 'audio-g1-g2',
      version: '2.2.0',
      contentId: expectedId,
      files: 4,
      unpackedBytes: p.unpackedBytes,
      roots,
    });
    expect(p.marker).toEqual(JSON.parse(markerText));
  });

  it('印の中身（版・roots）が変わっても contentId は変わらない。中身が変わると変わる', () => {
    const a = packPart({ version: '2.2.0', kind: 'main', entries: content, date: when });
    const b = packPart({
      version: '2.3.0',
      kind: 'audio-g1-g2',
      entries: content,
      roots: ['dist/audio/g1-ja'],
      date: when,
    });
    expect(b.contentId).toBe(a.contentId);
    const c = packPart({
      version: '2.2.0',
      kind: 'main',
      entries: [...content.slice(1), entry('manabi-no-niwa/dist/index.html', '<html>2</html>')],
      date: when,
    });
    expect(c.contentId).not.toBe(a.contentId);
  });

  it('zip の作った時刻が違っても contentId は同じ（zip の sha256 は変わる）', () => {
    const a = packPart({ version: '2.2.0', kind: 'main', entries: content, date: when });
    const b = packPart({
      version: '2.2.0',
      kind: 'main',
      entries: content,
      date: new Date(2026, 10, 7, 9, 0, 0),
    });
    expect(b.contentId).toBe(a.contentId);
    expect(b.sha256).not.toBe(a.sha256);
  });

  it('版の情報にそのまま渡せる（余計な欄は buildManifest が落とす）', () => {
    const main = packPart({ version: '2.2.0', kind: 'main', entries: content, date: when });
    const audio = packPart({
      version: '2.2.0',
      kind: 'audio-g5-g6',
      entries: [entry('manabi-no-niwa/dist/audio/g5-ja/q1.mp3', 'x')],
      roots: ['dist/audio/g5-ja'],
      date: when,
    });
    const m = buildManifest({
      version: '2.2.0',
      date: '2026-11-20',
      minVersion: MIN_AUTO_UPDATE_FROM,
      notes: [],
      parts: [audio, main],
    });
    expect(m.parts.map((x) => x.name)).toEqual([
      'manabi-no-niwa-2.2.0.zip',
      'manabi-no-niwa-2.2.0-audio-g5-g6.zip',
    ]);
    expect(m.parts[0]).toEqual({
      kind: 'main',
      name: main.name,
      bytes: main.bytes,
      sha256: main.sha256,
      contentId: main.contentId,
      files: 4,
      unpackedBytes: main.unpackedBytes,
    });
  });

  it('名前が manabi-no-niwa/ で始まらない・印を自分で渡す・種類や版がおかしいときは例外', () => {
    expect(() =>
      packPart({ version: '2.2.0', kind: 'main', entries: [entry('dist/a', 'x')] }),
    ).toThrow(/manabi-no-niwa\//);
    expect(() =>
      packPart({
        version: '2.2.0',
        kind: 'main',
        entries: [entry('manabi-no-niwa/parts/main.json', '{}')],
      }),
    ).toThrow(/部品の印/);
    expect(() => packPart({ version: '2.2.0', kind: 'Main', entries: content })).toThrow();
    expect(() => packPart({ version: '2.2', kind: 'main', entries: content })).toThrow();
    expect(() =>
      packPart({ version: '2.2.0', kind: 'main', entries: [...content, content[0]!] }),
    ).toThrow(/重なって/);
  });
});

// ---------------------------------------------------------------- 配布に入れるファイルの選び方
//
// git の操作は、os の一時フォルダに作った使い捨てのリポジトリで試す（作業ツリーの git には触らない）。

const tempDirs: string[] = [];

/** 一時のフォルダ（afterAll で消す） */
function tempDir(prefix: string): string {
  const d = mkdtempSync(path.join(os.tmpdir(), `mnw-release-test-${prefix}-`));
  tempDirs.push(d);
  return d;
}

afterAll(() => {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
});

function writeFiles(root: string, files: Record<string, string>): void {
  for (const [rel, data] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, data);
  }
}

/** 本物のリポジトリと同じ決まりの .gitignore（教材パックの音声は public/audio/ 直下のフォルダ単位で無視） */
const GITIGNORE = [
  'dist/',
  'release/',
  '.venv/',
  '.env',
  '__pycache__/',
  '*.pyc',
  'Thumbs.db',
  '.DS_Store',
  'public/audio/*/',
  '!public/audio/num/',
  '!public/audio/_sample-*/',
  '',
].join('\n');

/** 追跡済みの配布物（これが「きれいな」状態） */
const BASE_FILES: Record<string, string> = {
  '.gitignore': GITIGNORE,
  'README.md': 'readme\n',
  LICENSE: 'license\n',
  'DESINGN.md': 'design\n',
  'docs/device-checklist.md': 'checklist\n',
  'licenses/a.txt': 'a\n',
  'deploy/zorin/serve.py': 'print(1)\n',
  'deploy/zorin/install.sh': '#!/bin/sh\n',
  'deploy/zorin/mnwupdate/__init__.py': '',
  'public/manifest.webmanifest': '{}\n',
  'public/audio/num/manifest.json': '{}\n',
  'public/audio/num/a.mp3': 'mp3',
};

let templateRepo = '';

beforeAll(() => {
  templateRepo = tempDir('template');
  runGit(templateRepo, ['init', '-q']);
  const config: [string, string][] = [
    ['user.name', 'release test'],
    ['user.email', 'test@example.invalid'],
    ['commit.gpgsign', 'false'],
    ['core.autocrlf', 'false'],
    ['core.hooksPath', path.join(templateRepo, '.git', 'no-hooks')],
  ];
  for (const [k, v] of config) runGit(templateRepo, ['config', k, v]);
  writeFiles(templateRepo, BASE_FILES);
  runGit(templateRepo, ['add', '-A']);
  runGit(templateRepo, ['commit', '-q', '-m', 'base']);
  runGit(templateRepo, ['tag', 'v2.0.2']);
});

/** きれいな使い捨てのリポジトリ（タグ v2.0.2 つき）を、雛形の写しで作る */
function newRepo(): string {
  const d = tempDir('repo');
  cpSync(templateRepo, d, { recursive: true });
  return d;
}

/**
 * Windows の取り出しを、どの OS でも同じに再現する（2.1.0 の公開で起きた不具合の再現）。
 * `* text=auto` と core.eol=crlf（Windows の既定 native と同じ）で、配布の文書が作業ツリーでは CRLF になる。
 * blob が CRLF のファイル（licenses/crlf.txt）も 1 つ入れる。
 */
function crlfCheckout(repo: string): void {
  // 1. blob 自体が CRLF のファイル（雛形は core.autocrlf=false で .gitattributes が無いので、そのまま入る）
  writeFiles(repo, { 'licenses/crlf.txt': 'a\r\nb\r\n' });
  runGit(repo, ['add', 'licenses/crlf.txt']);
  runGit(repo, ['commit', '-q', '-m', 'crlf blob']);
  // 2. 本物と同じ .gitattributes
  writeFiles(repo, {
    '.gitattributes': '* text=auto\n*.sh text eol=lf\n*.py text eol=lf\n',
  });
  runGit(repo, ['add', '.gitattributes']);
  runGit(repo, ['commit', '-q', '-m', 'gitattributes']);
  // 3. Windows の既定（native）と同じ。Linux でも同じ結果にする
  runGit(repo, ['config', 'core.eol', 'crlf']);
  // 4. 配布に入る追跡済みのファイルを消して取り出し直す（git checkout は変わっていないファイルを書き直さない）
  for (const f of listTrackedReleaseFiles(repo)) rmSync(path.join(repo, f));
  runGit(repo, ['checkout', '--', '.']);
  // 前提の確かめ
  const wt = (f: string) => readFileSync(path.join(repo, f), 'utf8');
  expect(wt('README.md')).toBe('readme\r\n');
  expect(wt('licenses/a.txt')).toBe('a\r\n');
  expect(wt('licenses/crlf.txt')).toBe('a\r\nb\r\n');
  expect(wt('deploy/zorin/serve.py')).toBe('print(1)\n'); // eol=lf
  // 改行だけの違いは git の正規化で git status に出ない。だから元の確かめ（findDirtySources）では止まらない。
  // これがこの不具合の原因（作業ツリーから読むと、タグと違う CRLF の zip ができる）
  expect(findDirtySources(repo)).toEqual([]);
}

/** HEAD の blob を、本体とは別の方法（git cat-file blob）で取る */
function headBlob(repo: string, rel: string): Buffer {
  return execFileSync('git', ['cat-file', 'blob', `HEAD:${rel}`], { cwd: repo });
}

function codes(entries: readonly StatusEntry[]): string[] {
  return entries.map((e) => `${e.code} ${e.path}`).sort();
}

describe('parseStatusZ・isExpectedStatus・describeStatusEntries', () => {
  it('git status -z の出力を読む（空白を含む名前・名前の変更の元の名前）', () => {
    expect(parseStatusZ('?? a b.txt\0 M c\0R  new.txt\0old.txt\0!! d/\0')).toEqual([
      { code: '??', path: 'a b.txt' },
      { code: ' M', path: 'c' },
      { code: 'R ', path: 'new.txt' },
      { code: '!!', path: 'd/' },
    ]);
    expect(parseStatusZ('')).toEqual([]);
  });

  it('止めなくてよいのは、無視された教材パックの音声のフォルダと Python・OS の作業ファイルだけ', () => {
    const ok = (code: string, p: string) => isExpectedStatus({ code, path: p });
    expect(ok('!!', 'public/audio/g1-ja/')).toBe(true);
    expect(ok('!!', 'public/audio/en/')).toBe(true);
    expect(ok('!!', 'deploy/zorin/__pycache__/')).toBe(true);
    expect(ok('!!', 'deploy/zorin/mnwupdate/x.pyc')).toBe(true);
    expect(ok('!!', 'public/Thumbs.db')).toBe(true);
    expect(ok('!!', 'public/.DS_Store')).toBe(true);
    // 音声のフォルダでも、git の外（??）・変更は止める。深い所や直下のファイルは音声のフォルダではない
    expect(ok('??', 'public/audio/g1-ja/')).toBe(false);
    expect(ok('!!', 'public/audio/g1-ja/q1.mp3')).toBe(false);
    expect(ok('!!', 'public/audio/num/.env')).toBe(false);
    expect(ok('!!', 'public/audio/a/b/')).toBe(false);
    expect(ok('!!', 'public/audio/')).toBe(false);
    expect(ok('!!', 'deploy/zorin/.env')).toBe(false);
    expect(ok('!!', 'deploy/zorin/.venv/')).toBe(false);
    expect(ok('!!', 'public/other/')).toBe(false);
    expect(ok(' M', 'public/audio/g1-ja/')).toBe(false);
  });

  it('一覧は 1 行 1 件で、多いときは件数でまとめる', () => {
    const list: StatusEntry[] = [
      { code: '??', path: 'a' },
      { code: ' M', path: 'b' },
      { code: '!!', path: 'c' },
    ];
    expect(describeStatusEntries(list)).toBe(
      '  [git の外] a\n  [変更あり] b\n  [無視されている] c',
    );
    expect(describeStatusEntries(list, 2)).toBe('  [git の外] a\n  [変更あり] b\n  ほか 1 件');
  });
});

describe('runGit', () => {
  it('GIT_DIR などの環境変数に引きずられず、root のリポジトリを見る', () => {
    const repo = newRepo();
    const saved = process.env.GIT_DIR;
    process.env.GIT_DIR = path.join(os.tmpdir(), 'mnw-release-test-no-such-git-dir');
    try {
      expect(runGit(repo, ['tag', '--list'])).toContain('v2.0.2');
    } finally {
      if (saved === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = saved;
    }
  });

  it('タグを読める（readReleaseTags）', () => {
    expect(readReleaseTags(newRepo())).toEqual(['v2.0.2']);
  });
});

describe('findDirtySources（配布に入る元に、git の外・変更・無視されたものが無いか）', () => {
  it('きれいなら何も出さない。想定内（教材パックの音声・Python のキャッシュ）と、元の外の物は見ない', () => {
    const repo = newRepo();
    writeFiles(repo, {
      'public/audio/g1-ja/q1.mp3': 'x',
      'public/audio/en/a.mp3': 'x',
      'deploy/zorin/__pycache__/serve.cpython-312.pyc': 'x',
      'deploy/zorin/mnwupdate/__pycache__/a.pyc': 'x',
      'public/Thumbs.db': 'x',
      'dist/index.html': 'x',
      'release/a.zip': 'x',
      'notes.txt': 'x',
      'scripts/tmp.ts': 'x',
    });
    expect(findDirtySources(repo)).toEqual([]);
    expect(checkReleaseSources(repo)).toEqual({ dirty: [], links: [] });
  });

  it('git の外のファイルを出す（public・deploy/zorin・licenses の下）', () => {
    const repo = newRepo();
    writeFiles(repo, {
      'deploy/zorin/notes.txt': 'x',
      'licenses/extra.txt': 'x',
      'public/audio/num/unfinished.mp3': 'x',
      'public/draft.txt': 'x',
      'notes.txt': 'x',
    });
    expect(codes(findDirtySources(repo))).toEqual([
      '?? deploy/zorin/notes.txt',
      '?? licenses/extra.txt',
      '?? public/audio/num/unfinished.mp3',
      '?? public/draft.txt',
    ]);
  });

  it('git の外のフォルダ・最上位の配布ファイルの隣のものは、元の範囲の外なので見ない', () => {
    const repo = newRepo();
    writeFiles(repo, { 'deploy/other/x.txt': 'x', 'docs/other.md': 'x', 'src/a.ts': 'x' });
    expect(findDirtySources(repo)).toEqual([]);
  });

  it('変更（作業ツリーの変更・ステージ済み・削除）を出す', () => {
    const repo = newRepo();
    writeFiles(repo, {
      'deploy/zorin/serve.py': 'print(2)\n',
      'public/audio/num/manifest.json': '{"x":1}\n',
      'licenses/a.txt': 'changed\n',
    });
    runGit(repo, ['add', 'licenses/a.txt']);
    rmSync(path.join(repo, 'README.md'));
    expect(codes(findDirtySources(repo))).toEqual([
      ' D README.md',
      ' M deploy/zorin/serve.py',
      ' M public/audio/num/manifest.json',
      'M  licenses/a.txt',
    ]);
  });

  it('無視されたファイルを出す（.env・.venv など。num の下の無視されたものも）', () => {
    const repo = newRepo();
    writeFiles(repo, {
      'deploy/zorin/.env': 'TOKEN=x',
      'deploy/zorin/.venv/pyvenv.cfg': 'x',
      'public/audio/num/.env': 'x',
      'public/audio/g1-ja/q1.mp3': 'x',
    });
    expect(codes(findDirtySources(repo))).toEqual([
      '!! deploy/zorin/.env',
      '!! deploy/zorin/.venv/',
      '!! public/audio/num/.env',
    ]);
  });

  it('git が使えない所では例外にする（黙って「きれい」にしない）', () => {
    const notRepo = tempDir('norepo');
    const failing: GitRunner = () => {
      throw new Error('fatal: not a git repository');
    };
    expect(() => findDirtySources(notRepo, failing)).toThrow(/not a git repository/);
  });
});

describe('sourceProblems（止める説明と警告）', () => {
  const dirty: StatusEntry[] = [
    { code: '??', path: 'public/audio/num/new.mp3' },
    { code: ' M', path: 'public/audio/num/manifest.json' },
  ];

  it('問題が無ければ何も出さない', () => {
    expect(sourceProblems({ dirty: [], links: [] }, false)).toEqual({ errors: [], warnings: [] });
    expect(sourceProblems({ dirty: [], links: [] }, true)).toEqual({ errors: [], warnings: [] });
  });

  it('git の外・変更があれば、一覧と --allow-dirty の案内を付けて止める', () => {
    const { errors, warnings } = sourceProblems({ dirty, links: [] }, false);
    expect(warnings).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('[git の外] public/audio/num/new.mp3');
    expect(errors[0]).toContain('[変更あり] public/audio/num/manifest.json');
    expect(errors[0]).toContain('（2 件）');
    expect(errors[0]).toContain('--allow-dirty');
    for (const s of RELEASE_SOURCES) expect(errors[0]).toContain(s);
  });

  it('--allow-dirty のときは、同じ一覧を警告にして続ける', () => {
    const { errors, warnings } = sourceProblems({ dirty, links: [] }, true);
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('警告');
    expect(warnings[0]).toContain('[git の外] public/audio/num/new.mp3');
    expect(warnings[0]).toContain('public の下は dist にそのまま写されている');
  });

  it('リンクは --allow-dirty でも止める', () => {
    const links = ['deploy/zorin/linked'];
    for (const allow of [false, true]) {
      const { errors } = sourceProblems({ dirty: [], links }, allow);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('リンク');
      expect(errors[0]).toContain('  deploy/zorin/linked');
    }
    const both = sourceProblems({ dirty, links }, true);
    expect(both.errors).toHaveLength(1);
    expect(both.warnings).toHaveLength(1);
  });
});

/** ディレクトリのリンクを作る（Windows は権限の要らないジャンクション、ほかはシンボリックリンク） */
function linkDir(target: string, linkPath: string): void {
  mkdirSync(path.dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, 'junction');
}

describe('findLinks（deploy/zorin・licenses・最上位の配布ファイルの下のリンク）', () => {
  it('ディレクトリのリンク（Windows ではジャンクション）を見つける。public と dist には掛けない', () => {
    const repo = newRepo();
    const target = tempDir('target');
    writeFiles(target, { 'secret.txt': 's' });
    linkDir(target, path.join(repo, 'deploy/zorin/linked'));
    linkDir(target, path.join(repo, 'licenses/sub/l2'));
    linkDir(target, path.join(repo, 'public/audio-link'));
    linkDir(target, path.join(repo, 'dist/audio'));
    const rels = [...RELEASE_TRACKED_DIRS, ...RELEASE_TOP_FILES];
    expect(findLinks(repo, rels)).toEqual(['deploy/zorin/linked', 'licenses/sub/l2']);
    expect(checkReleaseSources(repo).links).toEqual(['deploy/zorin/linked', 'licenses/sub/l2']);
  });

  it('リンクの先へは入らない（先にあるリンクを二重に数えない）', () => {
    const repo = newRepo();
    const target = tempDir('target');
    linkDir(target, path.join(target, 'inner'));
    linkDir(target, path.join(repo, 'licenses/l'));
    expect(findLinks(repo, ['licenses'])).toEqual(['licenses/l']);
  });

  it('ファイルのリンクも見つける（作れない環境では飛ばす）', (ctx) => {
    const repo = newRepo();
    try {
      symlinkSync(path.join(repo, 'LICENSE'), path.join(repo, 'deploy/zorin/lnk.txt'), 'file');
      rmSync(path.join(repo, 'README.md'));
      symlinkSync(path.join(repo, 'LICENSE'), path.join(repo, 'README.md'), 'file');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EPERM') return ctx.skip();
      throw e;
    }
    expect(findLinks(repo, [...RELEASE_TRACKED_DIRS, ...RELEASE_TOP_FILES])).toEqual([
      'deploy/zorin/lnk.txt',
      'README.md',
    ]);
    // 中身は HEAD の blob から読むので、一覧は変わらない（作業ツリーのリンクは findLinks で止める）
    expect(listTrackedReleaseFiles(repo)).toContain('README.md');
  });

  it('無いフォルダは見ない。ふつうのファイルだけなら空', () => {
    const repo = newRepo();
    expect(findLinks(repo, ['no/such/dir', 'README.md'])).toEqual([]);
  });
});

describe('listTrackedReleaseFiles（git で追跡済みのものだけ）', () => {
  it('追跡済みだけを返す。git の外・無視された・エディタの作業ファイルは入らない', () => {
    const repo = newRepo();
    writeFiles(repo, {
      'deploy/zorin/.env': 'TOKEN=x',
      'deploy/zorin/serve.py~': 'x',
      'deploy/zorin/.serve.py.swp': 'x',
      'deploy/zorin/.venv/pyvenv.cfg': 'x',
      'deploy/zorin/notes.txt': 'x',
      'deploy/zorin/__pycache__/a.pyc': 'x',
      'licenses/b.txt': 'x',
      'notes.txt': 'x',
    });
    expect(listTrackedReleaseFiles(repo)).toEqual([
      'DESINGN.md',
      'LICENSE',
      'README.md',
      'deploy/zorin/install.sh',
      'deploy/zorin/mnwupdate/__init__.py',
      'deploy/zorin/serve.py',
      'docs/device-checklist.md',
      'licenses/a.txt',
    ]);
  });

  it('最上位の配布ファイルが追跡されていなければ例外', () => {
    const repo = newRepo();
    runGit(repo, ['rm', '-q', '--cached', 'README.md']);
    runGit(repo, ['commit', '-q', '-m', 'rm']);
    expect(() => listTrackedReleaseFiles(repo)).toThrow(/README\.md が git で追跡されていません/);
  });

  it('フォルダに追跡済みのファイルが 1 つも無ければ例外', () => {
    const repo = newRepo();
    runGit(repo, ['rm', '-rq', '--cached', 'licenses']);
    runGit(repo, ['commit', '-q', '-m', 'rm']);
    expect(() => listTrackedReleaseFiles(repo)).toThrow(/licenses\/ に git で追跡された/);
  });

  it('HEAD の木でリンク（mode 120000）なら例外（本物の git で作る）', () => {
    const repo = newRepo();
    writeFiles(repo, { 'tmp-target.txt': 'target\n' });
    const oid = runGit(repo, ['hash-object', '-w', 'tmp-target.txt']).trim();
    runGit(repo, ['update-index', '--add', '--cacheinfo', `120000,${oid},licenses/link.txt`]);
    runGit(repo, ['commit', '-q', '-m', 'link']);
    expect(() => listTrackedReleaseFiles(repo)).toThrow(
      /通常のファイルではありません（リンク）.*licenses\/link\.txt/,
    );
  });

  it('HEAD の木でサブモジュール（mode 160000）なら例外（本物の git で作る）', () => {
    const repo = newRepo();
    const head = runGit(repo, ['rev-parse', 'HEAD']).trim();
    runGit(repo, ['update-index', '--add', '--cacheinfo', `160000,${head},deploy/zorin/sub`]);
    runGit(repo, ['commit', '-q', '-m', 'submodule']);
    expect(() => listTrackedReleaseFiles(repo)).toThrow(
      /通常のファイルではありません（サブモジュール）.*deploy\/zorin\/sub/,
    );
  });

  it('作業ツリーに無い・変えた・ステージだけしたファイルは、一覧と中身に効かない', () => {
    const repo = newRepo();
    const before = listTrackedReleaseFiles(repo);
    expect(before).toHaveLength(8);
    rmSync(path.join(repo, 'deploy/zorin/serve.py'));
    writeFiles(repo, { 'README.md': 'changed\n', 'licenses/b.txt': 'b\n' });
    runGit(repo, ['add', 'licenses/b.txt']);
    expect(listTrackedReleaseFiles(repo)).toEqual(before);
    const files = readTrackedReleaseFiles(repo);
    const get = (p: string) => files.find((f) => f.path === p)!.data.toString('utf8');
    expect(get('README.md')).toBe('readme\n');
    expect(get('deploy/zorin/serve.py')).toBe('print(1)\n');
  });

  it('偽の GitRunner: 100755 の blob を受け、形が壊れた出力・tree は例外', () => {
    const oid = 'a'.repeat(40);
    const rec = (mode: string, type: string, p: string) => `${mode} ${type} ${oid}\t${p}`;
    const names = [...RELEASE_TOP_FILES, 'licenses/a.txt', 'deploy/zorin/serve.py'];
    const base = names.map((n) => rec('100644', 'blob', n));
    const ok: GitRunner = () =>
      `${[...base, rec('100755', 'blob', 'deploy/zorin/install.sh')].join('\0')}\0`;
    const blobs = listTrackedReleaseBlobs('x', ok);
    expect(blobs.find((b) => b.path === 'deploy/zorin/install.sh')).toEqual({
      path: 'deploy/zorin/install.sh',
      mode: '100755',
      oid,
    });
    expect(blobs).toHaveLength(names.length + 1);
    const broken: GitRunner = () => 'garbage\0';
    expect(() => listTrackedReleaseFiles('x', broken)).toThrow(/読めません/);
    const shortOid: GitRunner = () => `100644 blob abc123\tREADME.md\0`;
    expect(() => listTrackedReleaseFiles('x', shortOid)).toThrow(/読めません/);
    const tree: GitRunner = () =>
      `${[...base, rec('040000', 'tree', 'deploy/zorin/sub')].join('\0')}\0`;
    expect(() => listTrackedReleaseFiles('x', tree)).toThrow(
      /通常のファイルではありません（mode 040000）.*deploy\/zorin\/sub/,
    );
  });
});

describe('readTrackedReleaseFiles（作業ツリーではなく HEAD の blob から読む）', () => {
  it('作業ツリーが CRLF でも、中身は git cat-file blob とバイト単位で同じ', () => {
    const repo = newRepo();
    crlfCheckout(repo);
    const files = readTrackedReleaseFiles(repo);
    expect(files.map((f) => f.path)).toEqual(listTrackedReleaseFiles(repo));
    for (const f of files) {
      expect(f.data.equals(headBlob(repo, f.path)), f.path).toBe(true);
    }
    const get = (p: string) => files.find((f) => f.path === p)!.data.toString('utf8');
    expect(get('README.md')).toBe('readme\n'); // LF（作業ツリーの CRLF ではない）
    expect(get('licenses/crlf.txt')).toBe('a\r\nb\r\n'); // blob が CRLF のものは CRLF のまま
  });
});

describe('parseCatFileBatch', () => {
  const oidA = 'a'.repeat(40);
  const oidB = 'b'.repeat(40);
  const item = (oid: string, body: Buffer, type = 'blob') =>
    Buffer.concat([Buffer.from(`${oid} ${type} ${body.length}\n`), body, Buffer.from('\n')]);

  it('中身に LF・NUL・CR があっても 2 件読める', () => {
    const a = Buffer.from([0x61, 0x0a, 0x00, 0x0d, 0x0a, 0x62]);
    const b = Buffer.alloc(0);
    const out = Buffer.concat([item(oidA, a), item(oidB, b)]);
    const r = parseCatFileBatch(out, [oidA, oidB]);
    expect(r).toHaveLength(2);
    expect(r[0]!.equals(a)).toBe(true);
    expect(r[1]!.length).toBe(0);
  });

  it('missing・blob でない・途中で切れた・中身のあとが LF でない・余り・oid の順違いは例外', () => {
    const body = Buffer.from('hello');
    expect(() => parseCatFileBatch(Buffer.from(`${oidA} missing\n`), [oidA])).toThrow(/ありません/);
    expect(() => parseCatFileBatch(item(oidA, body, 'tree'), [oidA])).toThrow(
      /blob ではありません/,
    );
    const cut = item(oidA, body).subarray(0, item(oidA, body).length - 4);
    expect(() => parseCatFileBatch(cut, [oidA])).toThrow(/短い/);
    const noLf = Buffer.concat([Buffer.from(`${oidA} blob 5\n`), body, Buffer.from('X')]);
    expect(() => parseCatFileBatch(noLf, [oidA])).toThrow(/改行ではありません/);
    const extra = Buffer.concat([item(oidA, body), Buffer.from('x')]);
    expect(() => parseCatFileBatch(extra, [oidA])).toThrow(/余り/);
    const two = Buffer.concat([item(oidA, body), item(oidB, body)]);
    expect(() => parseCatFileBatch(two, [oidB, oidA])).toThrow(/oid が違います/);
    expect(() => parseCatFileBatch(Buffer.alloc(0), [oidA])).toThrow(/途中で終わっています/);
  });
});

describe('walkDist・isDistJunk（dist から入れないもの）', () => {
  it('名前の決まり: 隠し・Thumbs.db・desktop.ini・~・.swp・Python のキャッシュ', () => {
    for (const bad of [
      '.vite',
      '.hidden',
      '.DS_Store',
      '.htaccess',
      'Thumbs.db',
      'thumbs.db',
      'THUMBS.DB',
      'desktop.ini',
      'Desktop.ini',
      'a.js~',
      '~',
      'x.swp',
      'X.SWP',
      '__pycache__',
      'c.pyc',
    ]) {
      expect(isDistJunk(bad), bad).toBe(true);
    }
    for (const ok of [
      'index.html',
      'sw.js',
      'a.mp3',
      'thumbs.png',
      'desktop.ini.txt',
      'swp',
      'a~b',
    ]) {
      expect(isDistJunk(ok), ok).toBe(false);
    }
  });

  it('ふつうのファイルは残し、隠しフォルダ（.vite/）は中身ごと除く', () => {
    const dist = tempDir('dist');
    writeFiles(dist, {
      'index.html': 'x',
      'sw.js': 'x',
      'assets/app-1.js': 'x',
      'audio/num/a.mp3': 'x',
      'icons/icon.png': 'x',
      '.vite/manifest.json': '{}',
      '.hidden': 'x',
      'assets/.keep': 'x',
      'Thumbs.db': 'x',
      'icons/THUMBS.DB': 'x',
      'desktop.ini': 'x',
      'sub/Desktop.ini': 'x',
      'a.js~': 'x',
      'b.swp': 'x',
      '__pycache__/x.pyc': 'x',
      'c.pyc': 'x',
      '.DS_Store': 'x',
    });
    const { files, skipped } = walkDist(dist);
    expect(files.map(([, rel]) => rel).sort()).toEqual([
      'assets/app-1.js',
      'audio/num/a.mp3',
      'icons/icon.png',
      'index.html',
      'sw.js',
    ]);
    for (const [abs, rel] of files) expect(abs).toBe(path.join(dist, ...rel.split('/')));
    expect([...skipped].sort()).toEqual([
      '.DS_Store',
      '.hidden',
      '.vite/',
      'Thumbs.db',
      '__pycache__/',
      'a.js~',
      'assets/.keep',
      'b.swp',
      'c.pyc',
      'desktop.ini',
      'icons/THUMBS.DB',
      'sub/Desktop.ini',
    ]);
  });

  it('dist の中のリンク（public/audio をジャンクションにした作業場所）は止めず、先のファイルを入れる', () => {
    const dist = tempDir('dist');
    const target = tempDir('target');
    writeFiles(target, { 'q1.mp3': 'x' });
    writeFiles(dist, { 'index.html': 'x' });
    linkDir(target, path.join(dist, 'audio'));
    expect(
      walkDist(dist)
        .files.map(([, rel]) => rel)
        .sort(),
    ).toEqual(['audio/q1.mp3', 'index.html']);
  });
});

/** sw.js（本物の書き出し renderServiceWorker の形）。list は事前保存の一覧 */
function fakeSw(list: readonly string[]): string {
  return renderServiceWorker('self.addEventListener("fetch", () => {});\n', 'abc123', list);
}

/** packs.json（本物の形 PackIndex）。パック g1-math の files だけを持つ */
function fakePacks(files: readonly string[]): string {
  const index: PackIndex = { 'g1-math': { files: [...files], bytes: 1, hash: '0123456789abcdef' } };
  return `${JSON.stringify(index, null, 2)}\n`;
}

describe('parsePrecacheLists・findUnpackagedPrecache（sw.js・packs.json が読みに行くファイルが zip に入るか）', () => {
  it('sw.js の一覧と packs.json の各パックの files を合わせて読む（空白・日本語の名前も）', () => {
    const packs: PackIndex = {
      'g1-math': {
        files: ['assets/packs/g1-math/index.js', 'audio/g1-math/q 1.mp3'],
        bytes: 1,
        hash: 'a'.repeat(16),
      },
      'g3-math': { files: ['audio/g3-math/さん.mp3'], bytes: 1, hash: 'b'.repeat(16) },
    };
    expect(
      parsePrecacheLists(
        fakeSw(['icons/日本 語.png', 'index.html']),
        `${JSON.stringify(packs, null, 2)}\n`,
      ),
    ).toEqual([
      'icons/日本 語.png',
      'index.html',
      'assets/packs/g1-math/index.js',
      'audio/g1-math/q 1.mp3',
      'audio/g3-math/さん.mp3',
    ]);
  });

  it('packs.json が無い dist（null）は sw.js の一覧だけ。CRLF の sw.js・空の一覧・古い形 {packs: …} も読む', () => {
    expect(parsePrecacheLists(fakeSw(['index.html']), null)).toEqual(['index.html']);
    expect(parsePrecacheLists(fakeSw(['index.html']).replaceAll('\n', '\r\n'), '{}')).toEqual([
      'index.html',
    ]);
    expect(parsePrecacheLists(fakeSw([]), '{}')).toEqual([]);
    const legacy = JSON.stringify({ packs: { a: { files: ['audio/a/x.mp3'] } } });
    expect(parsePrecacheLists(fakeSw(['index.html']), legacy)).toEqual([
      'index.html',
      'audio/a/x.mp3',
    ]);
  });

  it('形が違えば例外（一覧が無い・JSON でない・文字列の配列でない・files が無い）', () => {
    expect(() => parsePrecacheLists('//', null)).toThrow(/__MNW_FILES__）がありません/);
    expect(() => parsePrecacheLists('const __MNW_FILES__ = [oops];\n', null)).toThrow(/読めません/);
    expect(() => parsePrecacheLists('const __MNW_FILES__ = [1];\n', null)).toThrow(/文字列の配列/);
    expect(() => parsePrecacheLists(fakeSw([]), '{oops')).toThrow(/packs\.json を読めません/);
    expect(() => parsePrecacheLists(fakeSw([]), '[]')).toThrow(/オブジェクトではありません/);
    expect(() => parsePrecacheLists(fakeSw([]), '{"a": 1}')).toThrow(
      /a がオブジェクトではありません/,
    );
    expect(() => parsePrecacheLists(fakeSw([]), '{"a": {}}')).toThrow(/a の files が文字列の配列/);
    expect(() => parsePrecacheLists(fakeSw([]), '{"a": {"files": [1]}}')).toThrow(/a の files/);
  });

  it('zip に入れるファイルに無いものだけを、パス順・重複なしで返す', () => {
    expect(
      findUnpackagedPrecache(
        ['icons/Thumbs.db', 'index.html', 'a/~', 'index.html', 'icons/Thumbs.db'],
        ['index.html', 'icons/icon.png'],
      ),
    ).toEqual(['a/~', 'icons/Thumbs.db']);
    expect(findUnpackagedPrecache(['index.html'], ['index.html'])).toEqual([]);
    expect(findUnpackagedPrecache([], [])).toEqual([]);
  });
});

describe('入れたファイルの一覧（.files.txt）', () => {
  it('contentListText の sha256 が contentId で、PackedPart.content は path の順', () => {
    const part = packPart({
      version: '2.2.0',
      kind: 'main',
      entries: [entry(`${TOP}/b.txt`, 'b'), entry(`${TOP}/a/x.txt`, 'x')],
    });
    expect(part.content.map((f) => f.path)).toEqual(['a/x.txt', 'b.txt']);
    expect(contentListText(part.content)).toBe(
      `a/x.txt\t1\t${sha256Hex('x')}\nb.txt\t1\t${sha256Hex('b')}\n`,
    );
    expect(sha256Hex(contentListText(part.content))).toBe(part.contentId);
  });
});

// ---- package-release.ts を、使い捨てのリポジトリの中で本当に動かす（フラグのつなぎ込みを見る）

const TSX_CLI = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../node_modules/tsx/dist/cli.mjs',
);

/** package-release.ts を動かせる使い捨てのリポジトリ（版 2.1.0・dist つき・タグ v2.0.2 つき・追跡済みの配布物はきれい） */
function newPackageProject(): string {
  const repo = newRepo();
  writeFiles(repo, {
    'package.json': '{"name":"x","type":"module","version":"2.1.0"}\n',
    'dist/index.html': '<html></html>',
    // sw.js・packs.json は本物の書き出しの形。一覧は dist の中身と合っている（packs.json の files は sw.js の一覧に入れない）
    'dist/sw.js': fakeSw(['icons/icon.png', 'index.html', 'packs.json']),
    'dist/packs.json': fakePacks(['assets/packs/g1-math/index.js']),
    'dist/assets/packs/g1-math/index.js': 'export default 1;',
    'dist/version.json': '{"version":"abc","appVersion":"2.1.0"}',
    'dist/icons/icon.png': 'png',
    'dist/.vite/manifest.json': '{}',
    'dist/desktop.ini': 'x',
    'dist/icons/Thumbs.db': 'x',
    'dist/.hidden': 'x',
  });
  for (const f of ['package-release.ts', 'release-lib.ts']) {
    cpSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), f),
      path.join(repo, 'scripts', f),
    );
  }
  return repo;
}

function runPackage(repo: string, args: string[] = []) {
  const r = spawnSync(process.execPath, [TSX_CLI, 'scripts/package-release.ts', ...args], {
    cwd: repo,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function zipNames(repo: string): string[] {
  const zip = readFileSync(path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip'));
  return readZip(zip).entries.map((e) => e.name);
}

function zipEntryText(repo: string, name: string): string {
  const zip = readFileSync(path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip'));
  return readZip(zip)
    .entries.find((e) => e.name === name)!
    .data.toString('utf8');
}

describe('package-release.ts（使い捨てのリポジトリで動かす）', { timeout: 90_000 }, () => {
  it('作業ツリーが CRLF（Windows の取り出し）でも、zip の追跡済みファイルは HEAD の blob とバイト単位で同じ', () => {
    const repo = newPackageProject();
    crlfCheckout(repo);
    const r = runPackage(repo); // フラグなし。git status がきれいなので止まらない
    expect(r.code, r.err).toBe(0);
    const zip = readZip(readFileSync(path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip')));
    for (const rel of listTrackedReleaseFiles(repo)) {
      const e = zip.entries.find((x) => x.name === `${TOP}/${rel}`);
      expect(e, rel).toBeDefined();
      expect(e!.data.equals(headBlob(repo, rel)), rel).toBe(true);
    }
    expect(zipEntryText(repo, `${TOP}/README.md`)).toBe('readme\n');
    expect(zipEntryText(repo, `${TOP}/licenses/crlf.txt`)).toBe('a\r\nb\r\n');
    const list = readFileSync(
      path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip.files.txt'),
      'utf8',
    );
    expect(list.split('\n')).toContain(`README.md\t7\t${sha256Hex('readme\n')}`);
  });

  it('きれいなら通り、zip に入るのは追跡済みの配布物と、隠しファイルなどを除いた dist だけ。一覧も書く', () => {
    const repo = newPackageProject();
    const r = runPackage(repo);
    expect(r.err).not.toContain('警告: --allow-dirty');
    expect(r.code, r.err).toBe(0);
    const names = zipNames(repo);
    expect(names).toEqual(
      [
        `${TOP}/DESINGN.md`,
        `${TOP}/LICENSE`,
        `${TOP}/README.md`,
        `${TOP}/deploy/zorin/install.sh`,
        `${TOP}/deploy/zorin/mnwupdate/__init__.py`,
        `${TOP}/deploy/zorin/serve.py`,
        `${TOP}/dist/assets/packs/g1-math/index.js`,
        `${TOP}/dist/icons/icon.png`,
        `${TOP}/dist/index.html`,
        `${TOP}/dist/packs.json`,
        `${TOP}/dist/sw.js`,
        `${TOP}/dist/version.json`,
        `${TOP}/docs/device-checklist.md`,
        `${TOP}/licenses/a.txt`,
        `${TOP}/parts/main.json`,
      ].sort(),
    );
    // 入れたファイルの一覧: 部品の印を除く各ファイルの パス・大きさ・sha256。その sha256 が部品の印の contentId
    const list = readFileSync(
      path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip.files.txt'),
      'utf8',
    );
    const lines = list.trimEnd().split('\n');
    expect(lines).toHaveLength(names.length - 1);
    for (const line of lines) expect(line).toMatch(/^[^\t]+\t\d+\t[0-9a-f]{64}$/);
    expect(lines).toContain(`dist/index.html\t13\t${sha256Hex('<html></html>')}`);
    const marker = JSON.parse(
      readZip(readFileSync(path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip')))
        .entries.find((e) => e.name === `${TOP}/parts/main.json`)!
        .data.toString('utf8'),
    ) as { contentId: string };
    expect(sha256Hex(list)).toBe(marker.contentId);
  });

  it('git の外・無視されたファイルがあれば、一覧を出して止める（zip は作らない）', () => {
    const repo = newPackageProject();
    writeFiles(repo, {
      'public/audio/num/unfinished.mp3': 'x',
      'deploy/zorin/.env': 'TOKEN=x',
      'deploy/zorin/serve.py': 'print(2)\n',
    });
    const r = runPackage(repo);
    expect(r.code).toBe(1);
    expect(r.err).toContain('[git の外] public/audio/num/unfinished.mp3');
    expect(r.err).toContain('[無視されている] deploy/zorin/.env');
    expect(r.err).toContain('[変更あり] deploy/zorin/serve.py');
    expect(r.err).toContain('--allow-dirty');
    expect(existsSync(path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip'))).toBe(false);
  });

  it('--allow-dirty のときだけ警告を出して続け、それでも zip には追跡済みのファイルだけが入る', () => {
    const repo = newPackageProject();
    writeFiles(repo, {
      'deploy/zorin/.env': 'TOKEN=x',
      'deploy/zorin/notes.txt': 'x',
      'deploy/zorin/serve.py~': 'x',
      'licenses/b.txt': 'x',
      'README.md': 'changed\n',
    });
    const r = runPackage(repo, ['--allow-dirty']);
    expect(r.code, r.err).toBe(0);
    expect(r.err).toContain('警告: --allow-dirty');
    expect(r.err).toContain('[無視されている] deploy/zorin/.env');
    const names = zipNames(repo);
    expect(names).toContain(`${TOP}/deploy/zorin/serve.py`);
    expect(names.filter((n) => /\.env|notes|~|licenses\/b/.test(n))).toEqual([]);
    // 変更したままの README.md ではなく、HEAD の中身が入る
    expect(zipEntryText(repo, `${TOP}/README.md`)).toBe('readme\n');
    expect(names.filter((n) => /\.vite|desktop\.ini|Thumbs|\.hidden/.test(n))).toEqual([]);
  });

  it('リンクは --allow-dirty でも止める', () => {
    const repo = newPackageProject();
    const target = tempDir('target');
    writeFiles(target, { 'secret.txt': 's' });
    linkDir(target, path.join(repo, 'deploy/zorin/linked'));
    for (const args of [[], ['--allow-dirty']]) {
      const r = runPackage(repo, args);
      expect(r.code, args.join(' ')).toBe(1);
      expect(r.err).toContain('リンク');
      expect(r.err).toContain('deploy/zorin/linked');
    }
    expect(existsSync(path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip'))).toBe(false);
  });

  it('zip に入れないファイル（Thumbs.db など）を sw.js の一覧か packs.json が参照していたら、zip を作る前に止める（--allow-dirty でも）', () => {
    // dist/icons/Thumbs.db・dist/desktop.ini は zip から除くのに、vite は隠しファイルしか事前保存から除かない。
    // 以前は exit 0 で通り、zip に無いファイルを sw.js が取りに行って、家のサービスワーカーの install が 404 で失敗した
    const viaSw = newPackageProject();
    writeFiles(viaSw, {
      'dist/sw.js': fakeSw([
        'desktop.ini',
        'icons/Thumbs.db',
        'icons/icon.png',
        'index.html',
        'packs.json',
      ]),
    });
    const viaPacks = newPackageProject();
    writeFiles(viaPacks, {
      'dist/assets/packs/g1-math/Thumbs.db': 'x',
      'dist/packs.json': fakePacks([
        'assets/packs/g1-math/Thumbs.db',
        'assets/packs/g1-math/index.js',
      ]),
    });
    for (const [repo, listed] of [
      [viaSw, ['dist/desktop.ini', 'dist/icons/Thumbs.db']],
      [viaPacks, ['dist/assets/packs/g1-math/Thumbs.db']],
    ] as const) {
      for (const args of [[], ['--allow-dirty']]) {
        const r = runPackage(repo, args);
        expect(r.code, `${args.join(' ')}\n${r.err}`).toBe(1);
        expect(r.err).toContain('zip に入らないファイルがあります');
        for (const p of listed) expect(r.err).toContain(`  ${p}\n`);
        expect(r.err).toContain('npm run build をやり直してください');
        expect(existsSync(path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip'))).toBe(false);
      }
    }
  });

  it('sw.js に事前保存の一覧が無い・packs.json が壊れている dist も、zip を作る前に止める', () => {
    const noList = newPackageProject();
    writeFiles(noList, { 'dist/sw.js': '//' });
    const brokenPacks = newPackageProject();
    writeFiles(brokenPacks, { 'dist/packs.json': '{broken' });
    for (const repo of [noList, brokenPacks]) {
      const r = runPackage(repo);
      expect(r.code).toBe(1);
      expect(r.err).toContain('事前保存の一覧（sw.js・packs.json）を確かめられません');
      expect(existsSync(path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip'))).toBe(false);
    }
  });

  it('vite の本物の書き出し（finalizeDist）の dist: 作業ファイルが無ければ通り、Thumbs.db があれば（sw.js が一覧に入れるので）止まる', async () => {
    const repo = newPackageProject();
    const dist = path.join(repo, 'dist');
    // 作業ファイルが dist に残っている状態（public に Thumbs.db を置いて vite build した、のと同じ）
    await finalizeDist(dist, { appVersion: '2.1.0' });
    const sw = readFileSync(path.join(dist, 'sw.js'), 'utf8');
    // 前提: vite の事前保存は、隠しファイル以外の作業ファイルを除かない（この前提が変わったら、この試験を見直す）
    expect(sw).toContain('"icons/Thumbs.db"');
    const stopped = runPackage(repo);
    expect(stopped.code, stopped.err).toBe(1);
    expect(stopped.err).toContain('dist/icons/Thumbs.db');
    expect(existsSync(path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip'))).toBe(false);
    // public から消して build し直した状態
    rmSync(path.join(dist, 'icons', 'Thumbs.db'));
    rmSync(path.join(dist, 'desktop.ini'));
    await finalizeDist(dist, { appVersion: '2.1.0' });
    const ok = runPackage(repo);
    expect(ok.code, ok.err).toBe(0);
    expect(zipNames(repo)).toContain(`${TOP}/dist/icons/icon.png`);
  });

  it('git のタグを読めない・1 つも無いときは止め、--no-tag-check のときだけ続ける', () => {
    const repo = newPackageProject();
    runGit(repo, ['tag', '-d', 'v2.0.2']);
    const stopped = runPackage(repo);
    expect(stopped.code).toBe(1);
    expect(stopped.err).toContain('--no-tag-check');
    expect(existsSync(path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip'))).toBe(false);
    const forced = runPackage(repo, ['--no-tag-check']);
    expect(forced.code, forced.err).toBe(0);
    expect(forced.err).toContain('--no-tag-check');
    expect(existsSync(path.join(repo, 'release', 'manabi-no-niwa-2.1.0.zip'))).toBe(true);
  });

  it('公開済みの版と同じ番号は、これまでどおり止める（先頭が 0 のタグでも）', () => {
    const repo = newPackageProject();
    runGit(repo, ['tag', 'v2.01.0']);
    const r = runPackage(repo);
    expect(r.code).toBe(1);
    expect(r.err).toContain('タグ v2.01.0 はもうあります');
  });
});
