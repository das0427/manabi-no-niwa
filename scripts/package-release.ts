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

const locals: Buffer[] = [];
const centrals: Buffer[] = [];
let offset = 0;
const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

for (const [src, name] of files) {
  const data = readFileSync(src);
  const comp = deflateRawSync(data, { level: 9 });
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = crc32(data);
  const mode = name.endsWith('.sh') ? 0o100755 : 0o100644;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8
  local.writeUInt16LE(8, 8); // deflate
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
  central.writeUInt16LE(8, 10);
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
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

const zip = Buffer.concat([...locals, centralBuf, end]);
mkdirSync(path.join(root, 'release'), { recursive: true });
const out = path.join(root, 'release', `${top}-${pkg.version}.zip`);
writeFileSync(out, zip);
const sha = createHash('sha256').update(zip).digest('hex');
writeFileSync(`${out}.sha256`, `${sha}  ${path.basename(out)}\n`);
console.log(
  `${path.relative(root, out)}  ${(zip.length / 1024 / 1024).toFixed(2)} MB  ${files.length} files`,
);
console.log(`sha256 ${sha}`);
