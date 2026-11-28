/**
 * リリース（配布 zip・部品の印・版の情報）の作り方の共通部品（docs/expansion/updater-design.md 3 章）。
 *
 * 副作用のない関数が中心。scripts/package-release.ts が使うほか、後の段の e2e が小さな偽のリリースを
 * 作るときにも使う（packPart で zip を作り、buildManifest で版の情報を作る）。
 * 例外は「配布に入れるファイルの選び方」の節だけで、git とファイルを読む（書き換えない）。
 * 依存なし（node の標準の部品だけ）。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
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

/** 版の形。先頭の 0 は付けない（2.01.0 は別の版に見えるのに数では 2.1.0 と同じになり、取り違えのもと） */
const VERSION_RE = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,5})$/;
/** git のタグ（vX.Y.Z）。先頭の 0 も受ける: 過去に v2.01.0 と付けられていても、数では 2.1.0 の公開済みとして扱うため */
const TAG_VERSION_RE = /^v(\d{1,4})\.(\d{1,4})\.(\d{1,6})$/;
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

/** 版の 3 つの数（先頭の 0 を許す。タグの比べ用） */
type VersionTuple = readonly [number, number, number];

function compareTuples(a: VersionTuple, b: VersionTuple): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * 出す版の番号を、これまでのタグ（`git tag` の `vX.Y.Z`。先行版の印つきは見ない）と比べる。
 * 自動の更新は「今より新しい版」しか入れないので、版の番号を誤って出すと、あとから正しい番号の版を出しても
 * 家に届かない。それを npm run package の段で止める。問題があればその説明、無ければ null。
 * 公開済みかどうかは文字ではなく数で比べる（タグが v2.01.0 でも、2.1.0 は公開済みとして止める）。
 * - 同じ版のタグがある → すでにその版を入れた家には、直した版が届かない（opts.allowExistingTag で許す。まだ公開していないタグのとき）
 * - これまでのいちばん新しい版より新しくない → 届かない
 * - メジャーが 2 以上、またはマイナーが 2 以上飛ぶ（2.0.2 → 2.2.0・4.0.0・21.0.0 など。メジャーを上げるときは X.0.Z）
 *   → 打ち間違いの疑い（opts.allowJump で許す）
 * tags が空のときは何とも比べない。タグを読めたかどうか（読めないとき・1 つも無いとき）の扱いは呼ぶ側で決める
 * （scripts/package-release.ts は、読めなければ --no-tag-check が無い限り止める）。
 */
export function checkReleaseVersion(
  version: string,
  tags: readonly string[],
  opts: { allowJump?: boolean; allowExistingTag?: boolean } = {},
): string | null {
  if (!isVersion(version))
    return `版の形が X.Y.Z ではありません（先頭に 0 は付けません）: ${version}`;
  const [c0, c1, c2] = version.split('.').map(Number) as [number, number, number];
  const cur: VersionTuple = [c0, c1, c2];
  const released: { tag: string; n: VersionTuple }[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    const m = TAG_VERSION_RE.exec(tag);
    if (m) released.push({ tag, n: [Number(m[1]), Number(m[2]), Number(m[3])] });
  }
  const same = released.find((r) => compareTuples(r.n, cur) === 0);
  if (same !== undefined && !opts.allowExistingTag) {
    return `タグ ${same.tag} はもうあります。公開した版と同じ番号では、その版を入れた家に届きません。版の番号を上げてください（まだ公開していないタグなら --allow-existing-tag）。`;
  }
  const others = released
    .filter((r) => compareTuples(r.n, cur) !== 0)
    .sort((a, b) => compareTuples(a.n, b.n));
  const latest = others.at(-1)?.n;
  if (latest === undefined) return null;
  const latestText = latest.join('.');
  if (compareTuples(cur, latest) < 0) {
    return `版 ${version} は、これまでのいちばん新しい版 ${latestText} より古いです。自動の更新では届きません（前の中身に戻したいときは、その中身で版の番号を上げて出してください）。`;
  }
  const [M, m] = latest;
  const [M2, m2] = cur;
  const jump = M2 > M + 1 || (M2 === M + 1 && m2 !== 0) || (M2 === M && m2 > m + 1);
  if (jump && !opts.allowJump) {
    return `版 ${version} は、これまでのいちばん新しい版 ${latestText} から大きく飛んでいます。打ち間違いなら直してください。一度出すと、それより小さい番号の版は自動の更新で届かなくなります（わざとなら --allow-jump）。`;
  }
  return null;
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
  return sha256Hex(Buffer.from(contentListText(files), 'utf8'));
}

/**
 * 中身のファイルの一覧の文字: 各ファイルの `<path>\t<size>\t<sha256>\n` を path の順につないだもの。
 * この文字の sha256 が contentId になる（computeContentId）。release/<zip の名前>.files.txt にも同じ形で書く。
 */
export function contentListText(files: readonly ContentFile[]): string {
  return [...files]
    .sort((a, b) => comparePath(a.path, b.path))
    .map((f) => `${f.path}\t${f.size}\t${f.sha256}\n`)
    .join('');
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
  /** 中身のファイルの一覧（印を除く。path の順。contentListText で .files.txt の文字になる） */
  content: ContentFile[];
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
    content: [...content].sort((a, b) => comparePath(a.path, b.path)),
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

// ---------------------------------------------------------------- 配布に入れるファイルの選び方（git で追跡済みのものだけ）

/**
 * zip に入れるファイルは「除くもの」ではなく「入れてよいもの」で選ぶ（2.1.0 の点検 app-2）。
 * - deploy/zorin・licenses・最上位の配布ファイル: HEAD のコミットで追跡済みのものだけを、
 *   作業ツリーではなく git の blob から読む（改行の変換に左右されない）
 * - dist: vite が作ったものから、隠しファイル・隠しフォルダ・OS やエディタの作業ファイルを除く
 * 入れる前に、元（public・deploy/zorin・licenses・最上位の配布ファイル）に git の外のファイル・変更・
 * 無視されたファイルが無いか、deploy/zorin・licenses の下にリンクが無いかを確かめる。
 * dist から除いたファイルを sw.js の事前保存の一覧・packs.json が参照していないかも確かめ、あれば止める
 * （vite 側の事前保存の除き方（隠しファイルだけ）は、ここの除き方より狭いため。--allow-dirty でも通さない）。
 */

/** 配布の最上位のファイル（zip では manabi-no-niwa/ の直下か、docs/ の下） */
export const RELEASE_TOP_FILES = [
  'README.md',
  'LICENSE',
  'DESINGN.md',
  'docs/device-checklist.md',
] as const;
/** git で追跡済みのファイルだけを入れるフォルダ */
export const RELEASE_TRACKED_DIRS = ['deploy/zorin', 'licenses'] as const;
/** vite が dist にそのまま写すフォルダ。ここの作りかけは dist 経由で zip に入る */
export const RELEASE_PUBLIC_DIR = 'public';
/** 配布に入る元（git status で確かめる範囲） */
export const RELEASE_SOURCES = [
  RELEASE_PUBLIC_DIR,
  ...RELEASE_TRACKED_DIRS,
  ...RELEASE_TOP_FILES,
] as const;

/** git を root で動かして標準出力を返す。失敗すれば例外（メッセージに git の標準エラーが入る） */
export type GitRunner = (root: string, args: readonly string[]) => string;

/** git の置き場を変える環境変数。フックなどから動かされても、root のリポジトリを見るために外す */
const GIT_LOCATION_ENV = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_PREFIX',
  'GIT_NAMESPACE',
];

const GIT_MAX_BUFFER = 64 * 1024 * 1024;

/** git の置き場を変える環境変数を外した環境 */
function gitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of GIT_LOCATION_ENV) delete env[k];
  return env;
}

/** 既定の GitRunner。--no-optional-locks で index を書き換えない */
export const runGit: GitRunner = (root, args) => {
  return execFileSync('git', ['--no-optional-locks', ...args], {
    cwd: root,
    env: gitEnv(),
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
};

/** git を root で動かして標準出力をそのまま（バイト列で）返す。input は標準入力に渡す。失敗すれば例外 */
export type GitBufferRunner = (root: string, args: readonly string[], input?: string) => Buffer;

/** 既定の GitBufferRunner。runGit と同じく index を書き換えない */
export const runGitBuffer: GitBufferRunner = (root, args, input) => {
  return execFileSync('git', ['--no-optional-locks', ...args], {
    cwd: root,
    env: gitEnv(),
    maxBuffer: GIT_MAX_BUFFER,
    ...(input === undefined ? {} : { input }),
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  });
};

function errorText(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .slice(0, 2)
    .join(' ');
}

/**
 * 版の番号の確かめに使うタグ（`vX.Y.Z` の形だけ）。git が読めない・そういうタグが 1 つも無いときは例外にする。
 * 「読めなかったので比べない」で黙って続けると、版の番号の誤りを見のがすため、続けるかは呼ぶ側が決める
 * （package-release.ts は --no-tag-check のときだけ続ける）。
 */
export function readReleaseTags(root: string, git: GitRunner = runGit): string[] {
  let out: string;
  try {
    out = git(root, ['tag', '--list', 'v*']);
  } catch (e) {
    return fail(`git のタグを読めません: ${errorText(e)}`);
  }
  const tags = out
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter((t) => TAG_VERSION_RE.test(t));
  if (tags.length === 0) {
    fail(
      'git に vX.Y.Z の形のタグが 1 つもありません（タグを取り込んでいない clone かもしれません）',
    );
  }
  return tags;
}

// ---- 元の確かめ（git status）

export interface StatusEntry {
  /** git status --porcelain=v1 の 2 文字（?? は git の外、!! は無視されている、ほかは変更） */
  code: string;
  path: string;
}

/** `git status --porcelain=v1 -z` の出力を読む（名前の変更は「新しい名前 NUL 元の名前」なので、元の名前は読み飛ばす） */
export function parseStatusZ(out: string): StatusEntry[] {
  const tokens = out.split('\0');
  const entries: StatusEntry[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t === '') continue;
    const code = t.slice(0, 2);
    entries.push({ code, path: t.slice(3) });
    if (/[RC]/.test(code)) i++;
  }
  return entries;
}

/**
 * 止めなくてよい「無視されたもの」か。
 * - public/audio/<名前>/: 教材パックの音声は git に入れず（.gitignore の public/audio/ 直下のフォルダ）、配布の zip にだけ入れる決まり
 * - Python・OS の作業ファイル（__pycache__・*.pyc・.DS_Store・Thumbs.db）: deploy/zorin・licenses・最上位のファイルでは
 *   zip に入らない（追跡済みだけを入れる）。public の下のものは dist に写り、dist からは除くが、
 *   vite が sw.js の一覧に入れていれば、あとの突き合わせ（findUnpackagedPrecache）で止める
 * 無視されたものでも、これ以外（.env・.venv など）は止める。git の外・変更はいつも止める。
 */
export function isExpectedStatus(e: StatusEntry): boolean {
  if (e.code !== '!!') return false;
  if (/^public\/audio\/[^/]+\/$/.test(e.path)) return true;
  const base = e.path.replace(/\/$/, '').split('/').at(-1) ?? '';
  return (
    base === '__pycache__' || base === '.DS_Store' || base === 'Thumbs.db' || base.endsWith('.pyc')
  );
}

/** 配布に入る元にある、git の外・変更・無視されたもの（上の想定内を除く）。無ければ [] */
export function findDirtySources(root: string, git: GitRunner = runGit): StatusEntry[] {
  const out = git(root, [
    'status',
    '--porcelain=v1',
    '--ignored',
    '--untracked-files=normal',
    '-z',
    '--',
    ...RELEASE_SOURCES,
  ]);
  return parseStatusZ(out).filter((e) => !isExpectedStatus(e));
}

function statusLabel(code: string): string {
  if (code === '??') return 'git の外';
  if (code === '!!') return '無視されている';
  return '変更あり';
}

/** 一覧の文字（1 行 1 件。limit 件まで） */
export function describeStatusEntries(entries: readonly StatusEntry[], limit = 30): string {
  const lines = entries.slice(0, limit).map((e) => `  [${statusLabel(e.code)}] ${e.path}`);
  if (entries.length > limit) lines.push(`  ほか ${entries.length - limit} 件`);
  return lines.join('\n');
}

// ---- リンクの確かめ

/**
 * rels（root からの相対）の下にある、リンクの相対パスを返す（lstat の isSymbolicLink。
 * Windows のジャンクションも Node ではリンクとして見える）。リンクの先へは入らない。無いものは見ない。
 */
export function findLinks(root: string, rels: readonly string[]): string[] {
  const found: string[] = [];
  const visit = (rel: string): void => {
    const abs = path.join(root, rel);
    let st;
    try {
      st = lstatSync(abs);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw e;
    }
    if (st.isSymbolicLink()) {
      found.push(rel);
      return;
    }
    if (!st.isDirectory()) return;
    for (const name of readdirSync(abs).sort()) visit(`${rel}/${name}`);
  };
  for (const rel of rels) visit(rel);
  return found;
}

// ---- まとめ

export interface SourceCheck {
  dirty: StatusEntry[];
  links: string[];
}

/** 配布に入る元の確かめ。リンクを見るのは deploy/zorin・licenses・最上位の配布ファイル（dist と public には掛けない） */
export function checkReleaseSources(root: string, git: GitRunner = runGit): SourceCheck {
  return {
    dirty: findDirtySources(root, git),
    links: findLinks(root, [...RELEASE_TRACKED_DIRS, ...RELEASE_TOP_FILES]),
  };
}

/**
 * 確かめた結果を、止める説明（errors）と警告（warnings）にする。
 * git の外・変更・無視されたものは allowDirty のとき警告にして続ける。リンクは allowDirty でも止める。
 */
export function sourceProblems(
  check: SourceCheck,
  allowDirty: boolean,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (check.dirty.length > 0) {
    const list = describeStatusEntries(check.dirty);
    const n = check.dirty.length;
    if (allowDirty) {
      warnings.push(
        `警告: --allow-dirty なので、配布に入る元の ${n} 件（下）を見のがして続けます。` +
          'deploy/zorin・licenses・最上位のファイルは、作業ツリーではなく HEAD のコミットの中身' +
          '（追跡済みのものだけ）が入り、コミットしていない変更は入りません。' +
          'public の下は dist にそのまま写されているので、変更したままの中身も、追跡していないファイルも入ります。\n' +
          list,
      );
    } else {
      errors.push(
        `配布に入る元（${RELEASE_SOURCES.join('・')}）に、git の外のファイル・変更・無視されたファイルがあります（${n} 件）:\n` +
          `${list}\n` +
          'コミットするか、消すか、.gitignore に入れてからやり直してください。' +
          'わざと入れるなら npm run package -- --allow-dirty。',
      );
    }
  }
  if (check.links.length > 0) {
    errors.push(
      `${RELEASE_TRACKED_DIRS.join('・')} の下にリンク（シンボリックリンク・ジャンクション）があります。` +
        'リンクの先の中身が、気づかないまま zip に入ったり、入らなかったりします。消してからやり直してください' +
        '（--allow-dirty では通しません）:\n' +
        check.links.map((l) => `  ${l}`).join('\n'),
    );
  }
  return { errors, warnings };
}

// ---- 入れるファイル

export interface TrackedReleaseBlob {
  path: string;
  mode: string;
  oid: string;
}

/**
 * deploy/zorin・licenses・最上位の配布ファイルのうち、HEAD のコミットで追跡されているもの
 * （root からの相対パス・"/" 区切り・名前の順。mode と blob の oid つき）。
 * 最上位のファイルが無い・フォルダに 1 つも無い・通常のファイル（mode 100644・100755）でない
 * （リンク・サブモジュールなど）なら例外。
 * 作業ツリーは見ない: 中身は blob から読むので、作業ツリーのファイルが無い・リンク・変更ありでも
 * zip の中身は変わらない。作業ツリーのリンクは checkReleaseSources の findLinks、
 * 無い・変更ありは findDirtySources が止める。
 */
export function listTrackedReleaseBlobs(
  root: string,
  git: GitRunner = runGit,
): TrackedReleaseBlob[] {
  const out = git(root, [
    'ls-tree',
    '-r',
    '-z',
    'HEAD',
    '--',
    ...RELEASE_TRACKED_DIRS,
    ...RELEASE_TOP_FILES,
  ]);
  const byPath = new Map<string, TrackedReleaseBlob>();
  for (const rec of out.split('\0')) {
    if (rec === '') continue;
    const m = /^(\d{6}) (\w+) ([0-9a-f]{40}|[0-9a-f]{64})\t(.+)$/s.exec(rec);
    if (!m) return fail(`git ls-tree の出力を読めません: ${JSON.stringify(rec)}`);
    const [, mode, type, oid, file] = m as unknown as [string, string, string, string, string];
    if (type !== 'blob' || (mode !== '100644' && mode !== '100755')) {
      const kind =
        mode === '120000'
          ? 'リンク'
          : type === 'commit' || mode === '160000'
            ? 'サブモジュール'
            : `mode ${mode}`;
      return fail(`通常のファイルではありません（${kind}）: ${file}`);
    }
    byPath.set(file, { path: file, mode, oid });
  }
  const blobs = [...byPath.values()].sort((a, b) => comparePath(a.path, b.path));
  for (const f of RELEASE_TOP_FILES) {
    if (!byPath.has(f)) {
      fail(`配布に入れる ${f} が git で追跡されていません（HEAD のコミットにありません）`);
    }
  }
  for (const d of RELEASE_TRACKED_DIRS) {
    if (!blobs.some((b) => b.path.startsWith(`${d}/`))) {
      fail(`${d}/ に git で追跡されたファイルがありません（HEAD のコミット）`);
    }
  }
  return blobs;
}

/**
 * deploy/zorin・licenses・最上位の配布ファイルのうち、HEAD のコミットで追跡されているもの
 * （root からの相対パス・"/" 区切り・名前の順）。選び方は listTrackedReleaseBlobs。
 * zip の中の名前は `manabi-no-niwa/` + この相対パス。
 */
export function listTrackedReleaseFiles(root: string, git: GitRunner = runGit): string[] {
  return listTrackedReleaseBlobs(root, git).map((b) => b.path);
}

/**
 * `git cat-file --batch` の出力を読む。oids の順に中身を返す。
 * 各件は `<oid> blob <大きさ>` の行（LF まで）、中身、LF。中身はバイト列のまま扱う（LF や NUL があってもよい）。
 * missing・blob でない・大きさが合わない・最後に余りがあれば例外。
 */
export function parseCatFileBatch(out: Buffer, oids: readonly string[]): Buffer[] {
  const result: Buffer[] = [];
  let pos = 0;
  for (const oid of oids) {
    const eol = out.indexOf(0x0a, pos);
    if (eol < 0) return fail(`git cat-file の出力が途中で終わっています: ${oid}`);
    const head = out.toString('latin1', pos, eol);
    if (head === `${oid} missing`) return fail(`git に ${oid} の中身がありません`);
    const m = /^([0-9a-f]+) (\w+) (\d+)$/.exec(head);
    if (!m) return fail(`git cat-file の見出しを読めません: ${JSON.stringify(head)}`);
    if (m[1] !== oid) return fail(`git cat-file の oid が違います（期待 ${oid}、実際 ${m[1]}）`);
    if (m[2] !== 'blob') return fail(`blob ではありません（${m[2]}）: ${oid}`);
    const size = Number(m[3]);
    const start = eol + 1;
    const end = start + size;
    if (end + 1 > out.length) return fail(`git cat-file の中身が大きさより短いです: ${oid}`);
    if (out[end] !== 0x0a) return fail(`git cat-file の中身のあとが改行ではありません: ${oid}`);
    result.push(Buffer.from(out.subarray(start, end)));
    pos = end + 1;
  }
  if (pos !== out.length) return fail('git cat-file の出力に余りがあります');
  return result;
}

/**
 * deploy/zorin・licenses・最上位の配布ファイルの中身を、作業ツリーではなく HEAD の git の blob から読む（path の順）。
 * Windows の作業ツリーは `* text=auto` と core.eol の既定で文書が CRLF になる。改行だけの違いは
 * git の正規化で git status に出ないので、元の確かめ（findDirtySources）では止まらず、作業ツリーから読むと
 * タグの中身と違う zip ができてしまう。blob から読めば core.autocrlf・core.eol・エディタの保存に左右されず、
 * zip の中身がタグの中身とバイト単位で同じになる（blob が CRLF のものは CRLF のまま）。
 * index ではなく HEAD を読むのは、タグを付けるのがコミットだから。
 */
export function readTrackedReleaseFiles(
  root: string,
  git: GitRunner = runGit,
  gitBuffer: GitBufferRunner = runGitBuffer,
): { path: string; data: Buffer }[] {
  const blobs = listTrackedReleaseBlobs(root, git);
  const oids = blobs.map((b) => b.oid);
  const datas = parseCatFileBatch(
    gitBuffer(root, ['cat-file', '--batch'], `${oids.join('\n')}\n`),
    oids,
  );
  return blobs.map((b, i) => ({ path: b.path, data: datas[i]! }));
}

/**
 * dist から zip に入れない名前: 隠しファイル・隠しフォルダ（. で始まる。vite の .vite/ を含む）、
 * Thumbs.db・desktop.ini（大文字小文字は問わない）、~ で終わるもの、.swp、Python のキャッシュ。
 */
export function isDistJunk(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    name.startsWith('.') ||
    lower === 'thumbs.db' ||
    lower === 'desktop.ini' ||
    name.endsWith('~') ||
    lower.endsWith('.swp') ||
    name === '__pycache__' ||
    lower.endsWith('.pyc')
  );
}

/**
 * dist の下のファイル。files は [絶対パス, dist からの相対パス（"/" 区切り）]、
 * skipped は isDistJunk で除いたもの（フォルダは末尾に "/"）。
 */
export function walkDist(dist: string): { files: [string, string][]; skipped: string[] } {
  const files: [string, string][] = [];
  const skipped: string[] = [];
  const visit = (dir: string, base: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const rel = base === '' ? name : `${base}/${name}`;
      const isDir = statSync(abs).isDirectory();
      if (isDistJunk(name)) {
        skipped.push(isDir ? `${rel}/` : rel);
      } else if (isDir) {
        visit(abs, rel);
      } else {
        files.push([abs, rel]);
      }
    }
  };
  visit(dist, '');
  return { files, skipped };
}

// ---- sw.js・packs.json の一覧との突き合わせ

/**
 * dist/sw.js の事前保存の一覧（`const __MNW_FILES__ = [...]`）と、dist/packs.json の各パックの files を合わせた、
 * dist からの相対パス（"/" 区切り）。どちらも scripts/vite-plugin-precache.ts が書く形。
 * packsText が null のときは packs.json が無い dist（Vite 以外で作ったもの）として、sw.js の一覧だけを返す。
 * 形が違えば例外（dist が壊れている・途中で書き換えられた）。
 */
export function parsePrecacheLists(swText: string, packsText: string | null): string[] {
  const m = /^const __MNW_FILES__ = (\[[^\n]*\]);\r?$/m.exec(swText);
  if (m === null) fail('dist/sw.js に事前保存の一覧（__MNW_FILES__）がありません');
  const out: string[] = [];
  const pushAll = (list: unknown, where: string): void => {
    if (!Array.isArray(list) || !list.every((p): p is string => typeof p === 'string')) {
      fail(`${where} が文字列の配列ではありません`);
    }
    out.push(...list);
  };
  try {
    pushAll(JSON.parse(m[1]!), 'dist/sw.js の __MNW_FILES__');
  } catch (e) {
    if (e instanceof SyntaxError) fail('dist/sw.js の __MNW_FILES__ を読めません');
    throw e;
  }
  if (packsText === null) return out;
  let index: unknown;
  try {
    index = JSON.parse(packsText);
  } catch {
    return fail('dist/packs.json を読めません');
  }
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!isRecord(index)) fail('dist/packs.json がオブジェクトではありません');
  // 古い形 {packs: {…}} も読む（package-release.ts と同じ）
  const packs = isRecord(index.packs) && !('files' in index.packs) ? index.packs : index;
  for (const [id, pack] of Object.entries(packs)) {
    if (!isRecord(pack)) fail(`dist/packs.json の ${id} がオブジェクトではありません`);
    pushAll(pack.files, `dist/packs.json の ${id} の files`);
  }
  return out;
}

/**
 * sw.js の事前保存の一覧・packs.json のファイル（precached）のうち、zip に入れるファイル（distRels。dist からの相対パス）に
 * 無いもの。パス順・重複なし。
 * isDistJunk で除いた Thumbs.db などを vite が一覧に入れていると、zip には無いのに sw.js が取りに行き、
 * 家ではサービスワーカーの install が 404 で失敗する（パックの確かめも content-check で止まる）。
 * 無ければ []。あれば zip を作る前に止める。
 */
export function findUnpackagedPrecache(
  precached: readonly string[],
  distRels: readonly string[],
): string[] {
  const have = new Set(distRels);
  return [...new Set(precached.filter((p) => !have.has(p)))].sort(comparePath);
}
