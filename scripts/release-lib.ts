/**
 * リリース（配布 zip・部品の印・版の情報）の作り方の共通部品（docs/expansion/updater-design.md 3 章）。
 *
 * 副作用のない関数が中心。scripts/package-release.ts が使うほか、後の段の e2e が小さな偽のリリースを
 * 作るときにも使う（packPart で zip を作り、buildManifest で版の情報を作る）。
 * 依存なし（node の crypto と zlib だけ）。
 */
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';

// ---------------------------------------------------------------- 定数

/** zip の最上位フォルダ。どの zip も同じ名前を持つので、全部を同じ場所に展開すれば1つにそろう */
export const TOP = 'manabi-no-niwa';
/** リリースの asset に置く版の情報の名前（名前に版を入れない。latest/download で取れるように） */
export const MANIFEST_NAME = 'manabi-no-niwa-update.json';
/**
 * 版の情報の minVersion に入れる値。これより古い版は、保護者画面からの更新では入れられない。
 * 上げるとき: 新しい版を古い更新の仕組みでは正しく入れられないとき（置き場の作りを変える、
 * .desktop・.service の中身を変える、部品の印の形を変える など）。上げると、古い版の人は
 * README の手順で入れ直すことになる。
 */
export const MIN_AUTO_UPDATE_FROM = '2.1.0';
/** 本体の部品の種類 */
export const MAIN_KIND = 'main';
/** 音声の部品の種類（小学生の教材パックの音声を学年でまとめたもの） */
export const AUDIO_KINDS = ['audio-g1-g2', 'audio-g3-g4', 'audio-g5-g6'] as const;
export type AudioKind = (typeof AUDIO_KINDS)[number];

/** docs/expansion/release-<版>.md の、保護者画面に出す短い説明の見出し */
export const NOTES_HEADING = '保護者画面に出す短い説明';
/** 版の情報の notes の上限（個数・1つの文字数） */
export const MAX_NOTES = 5;
export const MAX_NOTE_CHARS = 120;

const MAX_PARTS = 8;
/** ZIP（ZIP64 でない形）の上限: ファイル数 65535・位置と大きさは 32 ビット */
const MAX_ZIP_ENTRIES = 65535;
const MAX_U32 = 0xffffffff;
/** GitHub の添付の上限（1 ファイル 2GiB） */
const MAX_PART_BYTES = 2147483648;
/** 部品の印の分（1 ファイル）を引いた、中身のファイルの数の上限 */
const MAX_PART_FILES = MAX_ZIP_ENTRIES - 1;

const VERSION_RE = /^(\d{1,4})\.(\d{1,4})\.(\d{1,6})$/;
const KIND_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message: string): never {
  throw new Error(message);
}

function isInt(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
}

// ---------------------------------------------------------------- 版・名前・日付

/** `X.Y.Z`（先行版の印は付けない）の形か */
export function isVersion(v: unknown): v is string {
  return typeof v === 'string' && VERSION_RE.test(v);
}

/** 版の比較（数として比べる。2.10.0 > 2.9.9）。a が古ければ負、同じなら 0、新しければ正 */
export function compareVersions(a: string, b: string): number {
  const pa = VERSION_RE.exec(a) ?? fail(`版の形が X.Y.Z ではありません: ${a}`);
  const pb = VERSION_RE.exec(b) ?? fail(`版の形が X.Y.Z ではありません: ${b}`);
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d !== 0) return d;
  }
  return 0;
}

/** zip の名前。main は manabi-no-niwa-<版>.zip、ほかは manabi-no-niwa-<版>-<種類>.zip */
export function zipNameFor(version: string, kind: string): string {
  return kind === MAIN_KIND ? `${TOP}-${version}.zip` : `${TOP}-${version}-${kind}.zip`;
}

/** 部品の印の zip の中の名前 */
export function markerEntryName(kind: string): string {
  return `${TOP}/parts/${kind}.json`;
}

/** 日本時間の今日（YYYY-MM-DD） */
export function todayInJapan(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** JSON を 2 字下げ＋末尾に改行の文字にする（版の情報・部品の印の書き方） */
export function toJsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** sha256（小文字の16進） */
export function sha256Hex(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** `.sha256` ファイルの中身（sha256sum と同じ形） */
export function sha256FileText(sha256: string, fileName: string): string {
  return `${sha256}  ${fileName}\n`;
}

// ---------------------------------------------------------------- 音声の部品への分け方

/**
 * zip の中の名前（manabi-no-niwa/dist/audio/<packId>/…）から packId を返す。
 * packIds（dist/packs.json のパックの一覧）に無いもの（数の部品・幼児の音声など）は null。
 */
export function audioPackIdOf(zipEntryName: string, packIds: readonly string[]): string | null {
  const m = new RegExp(`^${TOP}/dist/audio/([^/]+)/`).exec(zipEntryName);
  if (!m || !packIds.includes(m[1]!)) return null;
  return m[1]!;
}

/**
 * 小学生の教材パックの音声（dist/audio/<packId>/）がどの音声の部品に入るか。null は main（本体）。
 * 数万本あるので学年ごとの別の zip に分ける。ZIP（ZIP64 でない形）はファイル数 65535・4GB まで、
 * GitHub の添付は 1 ファイル 2GB までのため。
 */
export function audioGroupOf(zipEntryName: string, packIds: readonly string[]): AudioKind | null {
  const id = audioPackIdOf(zipEntryName, packIds);
  if (id === null) return null;
  // 学年: g<n>-… は n、<教科>-g<ab> は a（例 kanji-g34 → 3、prog-g16 → 5・6 にまとめる）
  const g = /^g(\d)-/.exec(id)?.[1] ?? (id === 'prog-g16' ? '5' : /-g(\d)/.exec(id)?.[1]);
  const n = Number(g ?? 0);
  return n <= 2 ? 'audio-g1-g2' : n <= 4 ? 'audio-g3-g4' : 'audio-g5-g6';
}

// ---------------------------------------------------------------- 中身の ID（contentId）

export interface ContentFile {
  /** 先頭の manabi-no-niwa/ を除いた相対パス（例 dist/audio/g1-ja/q1.mp3） */
  path: string;
  size: number;
  /** 内容の sha256（小文字の16進） */
  sha256: string;
}

function comparePath(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * 中身の ID（設計 3.2 節）。各ファイルの `<path>\t<size>\t<sha256>\n` を、path の順
 * （JavaScript の文字列の `<`）につないだ UTF-8 の sha256（小文字の16進）。
 * 部品の印（parts/<kind>.json）は渡さない。同じ中身なら、渡す順や zip の作った時刻によらず同じ ID になる。
 */
export function computeContentId(files: readonly ContentFile[]): string {
  const seen = new Set<string>();
  for (const f of files) {
    if (f.path === '' || /[\t\r\n]/.test(f.path))
      fail(`contentId: パスが正しくありません: ${JSON.stringify(f.path)}`);
    if (f.path.startsWith('/') || f.path.startsWith(`${TOP}/`)) {
      fail(`contentId: パスは先頭の ${TOP}/ を除いた相対パスにしてください: ${f.path}`);
    }
    if (!isInt(f.size, 0, Number.MAX_SAFE_INTEGER))
      fail(`contentId: 大きさが正しくありません: ${f.path}`);
    if (!HEX64_RE.test(f.sha256))
      fail(`contentId: sha256 が64桁の小文字の16進ではありません: ${f.path}`);
    if (seen.has(f.path)) fail(`contentId: パスが重なっています: ${f.path}`);
    seen.add(f.path);
  }
  const text = [...files]
    .sort((a, b) => comparePath(a.path, b.path))
    .map((f) => `${f.path}\t${f.size}\t${f.sha256}\n`)
    .join('');
  return sha256Hex(Buffer.from(text, 'utf8'));
}

// ---------------------------------------------------------------- 部品の印

export interface PartMarker {
  schema: 1;
  app: typeof TOP;
  kind: string;
  version: string;
  contentId: string;
  /** 中身のファイルの数（印を除く） */
  files: number;
  /** 中身の合計の大きさ（印を除く） */
  unpackedBytes: number;
  /** その部品が持つフォルダ（音声の部品は dist/audio/<packId>。main は []） */
  roots: string[];
}

function isSafeRoot(r: unknown): r is string {
  return (
    typeof r === 'string' &&
    r.startsWith('dist/') &&
    !r.includes('\\') &&
    !/\p{Cc}/u.test(r) &&
    r.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..')
  );
}

/** zip の中の部品の印（manabi-no-niwa/parts/<kind>.json）。キーの順は設計 3.2 節のとおり */
export function makeMarker(input: {
  kind: string;
  version: string;
  contentId: string;
  files: number;
  unpackedBytes: number;
  roots: readonly string[];
}): PartMarker {
  if (!KIND_RE.test(input.kind)) fail(`部品の印: kind が正しくありません: ${input.kind}`);
  if (!isVersion(input.version))
    fail(`部品の印: version が X.Y.Z ではありません: ${input.version}`);
  if (!HEX64_RE.test(input.contentId))
    fail('部品の印: contentId が64桁の小文字の16進ではありません');
  if (!isInt(input.files, 0, MAX_U32)) fail(`部品の印: files が正しくありません: ${input.files}`);
  if (!isInt(input.unpackedBytes, 0, Number.MAX_SAFE_INTEGER)) {
    fail(`部品の印: unpackedBytes が正しくありません: ${input.unpackedBytes}`);
  }
  for (const r of input.roots) if (!isSafeRoot(r)) fail(`部品の印: roots が正しくありません: ${r}`);
  return {
    schema: 1,
    app: TOP,
    kind: input.kind,
    version: input.version,
    contentId: input.contentId,
    files: input.files,
    unpackedBytes: input.unpackedBytes,
    roots: [...input.roots],
  };
}

// ---------------------------------------------------------------- ZIP の書き出し

export interface ZipEntry {
  /** zip の中の名前（"/" 区切り。UTF-8） */
  name: string;
  data: Buffer;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** CRC-32（ZIP の形式） */
export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * 最小の ZIP 書き出し（UTF-8 のファイル名）。名前の順に並べる。.sh には実行権限（0o100755）、
 * ほかは 0o100644。mp3 は圧縮が効かないので格納だけ、ほかは deflate。
 * ZIP64 でない形なので、ファイル数 65535・合計 4GB を超えたら例外にする。
 * date は zip に書く更新時刻（既定は今。ローカル時刻）。
 */
export function createZip(entries: readonly ZipEntry[], options: { date?: Date } = {}): Buffer {
  if (entries.length > MAX_ZIP_ENTRIES) fail(`zip: ファイルが多すぎる（${entries.length}）`);
  const sorted = [...entries].sort((a, b) => comparePath(a.name, b.name));
  let rawTotal = 0;
  for (const [i, e] of sorted.entries()) {
    if (e.name === '') fail('zip: 名前が空のファイルがあります');
    if (i > 0 && sorted[i - 1]!.name === e.name) fail(`zip: 名前が重なっています: ${e.name}`);
    if (e.data.length > MAX_U32) fail(`zip: ファイルが 4GB を超える: ${e.name}`);
    rawTotal += e.data.length;
  }
  if (rawTotal > MAX_U32) fail('zip: 中身の合計が 4GB を超える');

  const when = options.date ?? new Date();
  if (when.getFullYear() < 1980 || when.getFullYear() > 2107)
    fail('zip: 時刻が DOS 形式の範囲外です');
  const dosTime =
    (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2);
  const dosDate =
    ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();

  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of sorted) {
    // mp3 は圧縮が効かないので格納だけ（作成を速くする）
    const store = name.endsWith('.mp3');
    const comp = store ? data : deflateRawSync(data, { level: 9 });
    const method = store ? 0 : 8;
    const nameBuf = Buffer.from(name, 'utf8');
    if (nameBuf.length > 0xffff) fail(`zip: 名前が長すぎる: ${name}`);
    if (offset > MAX_U32) fail('zip: 4GB を超える');
    const crc = crc32(data);
    const mode = name.endsWith('.sh') ? 0o100755 : 0o100644;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8
    local.writeUInt16LE(method, 8); // 8: deflate, 0: 格納
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, comp);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by Unix（実行権限を伝えるため）
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE((mode << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }

  const centralBuf = Buffer.concat(centrals);
  if (offset > MAX_U32) fail('zip: 4GB を超える');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(sorted.length, 8);
  end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

// ---------------------------------------------------------------- 部品（zip 1つ）を作る

export interface PackedPart {
  kind: string;
  /** zip の名前（zipNameFor） */
  name: string;
  zip: Buffer;
  /** zip の大きさ */
  bytes: number;
  /** zip 全体の sha256 */
  sha256: string;
  contentId: string;
  /** 中身のファイルの数（印を除く） */
  files: number;
  /** 中身の合計の大きさ（印を除く） */
  unpackedBytes: number;
  marker: PartMarker;
}

/**
 * 部品の zip を作る。entries は中身のファイル（名前は `manabi-no-niwa/…` で始める。部品の印は含めない）。
 * contentId・files・unpackedBytes は印を除いた中身から計算し、印（parts/<kind>.json）を足して zip にする。
 */
export function packPart(input: {
  version: string;
  kind: string;
  entries: readonly ZipEntry[];
  /** その部品が持つフォルダ（音声の部品は dist/audio/<packId>。省略は []） */
  roots?: readonly string[];
  /** zip に書く時刻（省略は今） */
  date?: Date;
}): PackedPart {
  const markerName = markerEntryName(input.kind);
  const content: ContentFile[] = [];
  let unpackedBytes = 0;
  for (const e of input.entries) {
    if (!e.name.startsWith(`${TOP}/`)) fail(`zip: 名前が ${TOP}/ で始まっていません: ${e.name}`);
    if (e.name === markerName) fail(`zip: 部品の印は自動で入れます。渡さないでください: ${e.name}`);
    content.push({
      path: e.name.slice(TOP.length + 1),
      size: e.data.length,
      sha256: sha256Hex(e.data),
    });
    unpackedBytes += e.data.length;
  }
  const contentId = computeContentId(content);
  const marker = makeMarker({
    kind: input.kind,
    version: input.version,
    contentId,
    files: content.length,
    unpackedBytes,
    roots: input.roots ?? [],
  });
  const zip = createZip(
    [...input.entries, { name: markerName, data: Buffer.from(toJsonText(marker), 'utf8') }],
    { date: input.date },
  );
  return {
    kind: input.kind,
    name: zipNameFor(input.version, input.kind),
    zip,
    bytes: zip.length,
    sha256: sha256Hex(zip),
    contentId,
    files: content.length,
    unpackedBytes,
    marker,
  };
}

// ---------------------------------------------------------------- 版の情報

export interface ManifestPart {
  kind: string;
  name: string;
  bytes: number;
  sha256: string;
  contentId: string;
  files: number;
  unpackedBytes: number;
}

export interface UpdateManifest {
  schema: 1;
  app: typeof TOP;
  version: string;
  tag: string;
  date: string;
  minVersion: string;
  notes: string[];
  parts: ManifestPart[];
}

/** 暦に実在する YYYY-MM-DD か */
function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** notes（保護者画面に出す短い説明）が 0〜5 個・各 120 字までの文字列か。違えば例外 */
export function assertNotes(notes: readonly unknown[]): asserts notes is readonly string[] {
  if (!Array.isArray(notes) || notes.length > MAX_NOTES) {
    fail(`版の情報: notes は ${MAX_NOTES} 個までの配列にしてください`);
  }
  for (const [i, n] of notes.entries()) {
    if (typeof n !== 'string') fail(`版の情報: notes[${i}] が文字列ではありません`);
    if ([...n].length > MAX_NOTE_CHARS) {
      fail(`版の情報: notes[${i}] が ${MAX_NOTE_CHARS} 字を超えています（${[...n].length} 字）`);
    }
  }
}

/**
 * 版の情報（manabi-no-niwa-update.json）を作る（設計 3.1 節）。決まりに合わなければ例外。
 * parts は main を先頭に、残りを kind の順に並べる。parts の余計な欄（zip など）は入れない。
 */
export function buildManifest(input: {
  version: string;
  date: string;
  minVersion: string;
  notes: readonly string[];
  parts: readonly ManifestPart[];
}): UpdateManifest {
  const { version, date, minVersion, notes, parts } = input;
  if (!isVersion(version)) fail(`版の情報: version が X.Y.Z ではありません: ${version}`);
  if (!isVersion(minVersion)) fail(`版の情報: minVersion が X.Y.Z ではありません: ${minVersion}`);
  if (compareVersions(minVersion, version) > 0) {
    fail(`版の情報: minVersion（${minVersion}）が version（${version}）より新しい`);
  }
  if (typeof date !== 'string' || !isRealDate(date)) {
    fail(`版の情報: date が YYYY-MM-DD ではありません: ${date}`);
  }
  assertNotes(notes);
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > MAX_PARTS) {
    fail(`版の情報: parts は 1〜${MAX_PARTS} 個にしてください`);
  }

  const kinds = new Set<string>();
  const out: ManifestPart[] = [];
  for (const p of parts) {
    if (typeof p.kind !== 'string' || !KIND_RE.test(p.kind)) {
      fail(`版の情報: parts の kind が正しくありません: ${String(p.kind)}`);
    }
    if (kinds.has(p.kind)) fail(`版の情報: parts の kind が重なっています: ${p.kind}`);
    kinds.add(p.kind);
    const expected = zipNameFor(version, p.kind);
    if (p.name !== expected) {
      fail(`版の情報: ${p.kind} の name が ${expected} と一致しません: ${String(p.name)}`);
    }
    if (!isInt(p.bytes, 1, MAX_PART_BYTES)) {
      fail(`版の情報: ${p.kind} の bytes が 1〜${MAX_PART_BYTES} の整数ではありません: ${p.bytes}`);
    }
    if (typeof p.sha256 !== 'string' || !HEX64_RE.test(p.sha256)) {
      fail(`版の情報: ${p.kind} の sha256 が64桁の小文字の16進ではありません`);
    }
    if (typeof p.contentId !== 'string' || !HEX64_RE.test(p.contentId)) {
      fail(`版の情報: ${p.kind} の contentId が64桁の小文字の16進ではありません`);
    }
    if (!isInt(p.files, 1, MAX_PART_FILES)) {
      fail(`版の情報: ${p.kind} の files が 1〜${MAX_PART_FILES} の整数ではありません: ${p.files}`);
    }
    if (!isInt(p.unpackedBytes, 0, MAX_U32)) {
      fail(
        `版の情報: ${p.kind} の unpackedBytes が 0〜${MAX_U32} の整数ではありません: ${p.unpackedBytes}`,
      );
    }
    out.push({
      kind: p.kind,
      name: p.name,
      bytes: p.bytes,
      sha256: p.sha256,
      contentId: p.contentId,
      files: p.files,
      unpackedBytes: p.unpackedBytes,
    });
  }
  if (!kinds.has(MAIN_KIND)) fail(`版の情報: parts に ${MAIN_KIND} がありません`);
  out.sort((a, b) =>
    a.kind === MAIN_KIND ? -1 : b.kind === MAIN_KIND ? 1 : comparePath(a.kind, b.kind),
  );

  return {
    schema: 1,
    app: TOP,
    version,
    tag: `v${version}`,
    date,
    minVersion,
    notes: [...notes],
    parts: out,
  };
}

// ---------------------------------------------------------------- リリースノートから notes を取る

/**
 * リリースノート（docs/expansion/release-<版>.md）の、見出し `## 保護者画面に出す短い説明` の下、
 * 次の見出しまでの `- ` で始まる行の本文を返す（最大 5 行。見出しが無ければ []）。
 * 本文は文字として画面に出すので、Markdown は解釈しない。制御文字（タブなど）は空白にする。
 */
export function parseReleaseNotes(markdown: string): string[] {
  const heading = new RegExp(`^##[ \\t]+${NOTES_HEADING}[ \\t]*$`);
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => heading.test(l));
  if (start < 0) return [];
  const notes: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    if (!line.startsWith('- ')) continue;
    const body = line
      .slice(2)
      .replace(/\p{Cc}+/gu, ' ')
      .trim();
    if (body === '') continue;
    notes.push(body);
    if (notes.length >= MAX_NOTES) break;
  }
  return notes;
}
