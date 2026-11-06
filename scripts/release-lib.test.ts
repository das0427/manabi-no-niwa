// @vitest-environment node
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  AUDIO_KINDS,
  MANIFEST_NAME,
  MAX_NOTES,
  MAX_NOTE_CHARS,
  MIN_AUTO_UPDATE_FROM,
  TOP,
  assertNotes,
  audioGroupOf,
  audioPackIdOf,
  buildManifest,
  checkReleaseVersion,
  compareVersions,
  computeContentId,
  crc32,
  createZip,
  isVersion,
  makeMarker,
  markerEntryName,
  packPart,
  parseReleaseNotes,
  sha256FileText,
  sha256Hex,
  toJsonText,
  todayInJapan,
  zipNameFor,
  type ContentFile,
  type ManifestPart,
  type ZipEntry,
} from './release-lib.ts';

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
