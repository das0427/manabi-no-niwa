/**
 * 配布用 zip を作る（`npm run build` の後に `npm run package`）。
 * 中身: manabi-no-niwa/dist/、manabi-no-niwa/deploy/zorin/（install.sh が前提とする配置）、README.md、LICENSE、licenses/、DESINGN.md、docs/device-checklist.md
 * 依存なし（zlib の deflate と自前の ZIP 書き出し）。.sh には実行権限を付ける。
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  version: string;
};
const top = 'manabi-no-niwa';

function walk(dir: string, base: string): [string, string][] {
  const out: [string, string][] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const rel = `${base}/${name}`;
    if (statSync(p).isDirectory()) out.push(...walk(p, rel));
    else out.push([p, rel]);
  }
  return out;
}

const dist = path.join(root, 'dist');
if (!existsSync(path.join(dist, 'index.html')) || !existsSync(path.join(dist, 'sw.js'))) {
  console.error('dist がありません。先に npm run build を実行してください。');
  process.exit(1);
}

const files: [string, string][] = [
  ...walk(dist, `${top}/dist`),
  ...walk(path.join(root, 'deploy/zorin'), `${top}/deploy/zorin`),
  ...walk(path.join(root, 'licenses'), `${top}/licenses`),
  [path.join(root, 'README.md'), `${top}/README.md`],
  [path.join(root, 'LICENSE'), `${top}/LICENSE`],
  [path.join(root, 'DESINGN.md'), `${top}/DESINGN.md`],
  [path.join(root, 'docs/device-checklist.md'), `${top}/docs/device-checklist.md`],
];

// --- 最小の ZIP 書き出し（deflate、UTF-8 ファイル名）
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

/**
 * 小学生の教材パックの音声（dist/audio/<packId>/）は数万本あるので、学年ごとの別の zip に分ける。
 * ZIP（ZIP64 でない形）はファイル数 65535・4GB まで、GitHub の添付は 1 ファイル 2GB までのため。
 * どの zip も同じ最上位フォルダ manabi-no-niwa/ を持つので、全部を同じ場所に展開すれば1つにそろう。
 */
const packIds: string[] = (() => {
  try {
    const pj = JSON.parse(readFileSync(path.join(dist, 'packs.json'), 'utf8')) as {
      packs?: Record<string, unknown>;
    };
    return Object.keys(pj.packs ?? pj);
  } catch {
    return [];
  }
})();
function audioGroupOf(name: string): string | null {
  const m = new RegExp(`^${top}/dist/audio/([^/]+)/`).exec(name);
  if (!m || !packIds.includes(m[1]!)) return null;
  const id = m[1]!;
  // 学年: g<n>-… は n、<教科>-g<ab> は a（例 kanji-g34 → 3、prog-g16 → 5・6 にまとめる）
  const g = /^g(\d)-/.exec(id)?.[1] ?? (id === 'prog-g16' ? '5' : /-g(\d)/.exec(id)?.[1]);
  const n = Number(g ?? 0);
  return n <= 2 ? 'audio-g1-g2' : n <= 4 ? 'audio-g3-g4' : 'audio-g5-g6';
}
const groups = new Map<string, [string, string][]>([['', []]]);
for (const f of files) {
  const g = audioGroupOf(f[1]) ?? '';
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g)!.push(f);
}
mkdirSync(path.join(root, 'release'), { recursive: true });
for (const [g, list] of groups)
  writeZip(g ? `${top}-${pkg.version}-${g}.zip` : `${top}-${pkg.version}.zip`, list);

function writeZip(fileName: string, list: [string, string][]): void {
  if (list.length > 65535) throw new Error(`${fileName}: ファイルが多すぎる（${list.length}）`);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [src, name] of list) {
    const data = readFileSync(src);
    // mp3 は圧縮が効かないので格納だけ（作成を速くする）
    const store = name.endsWith('.mp3');
    const comp = store ? data : deflateRawSync(data, { level: 9 });
    const method = store ? 0 : 8;
    const nameBuf = Buffer.from(name, 'utf8');
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
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(list.length, 8);
  end.writeUInt16LE(list.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  if (offset > 0xffffffff) throw new Error(`${fileName}: 4GB を超える`);

  const zip = Buffer.concat([...locals, centralBuf, end]);
  const out = path.join(root, 'release', fileName);
  writeFileSync(out, zip);
  const sha = createHash('sha256').update(zip).digest('hex');
  writeFileSync(`${out}.sha256`, `${sha}  ${path.basename(out)}\n`);
  console.log(
    `${path.relative(root, out)}  ${(zip.length / 1024 / 1024).toFixed(2)} MB  ${list.length} files`,
  );
  console.log(`sha256 ${sha}`);
}
