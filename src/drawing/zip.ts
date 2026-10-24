/**
 * 無圧縮（stored）の zip の読み書き（review-1 #16。依存パッケージを増やさない）。
 * PNG は既に圧縮されているので圧縮しない。ZIP64 は使わない（1ファイル・全体とも 4GB 未満）。
 * 読み込みは「無圧縮のエントリ」だけを受け付ける（このアプリが書いた zip を読む前提）。
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

/** DOS の日時（UTC ではなく端末の時刻） */
function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const enc = new TextEncoder();

/** zip を作る（無圧縮）。名前は UTF-8（汎用フラグの bit 11） */
export function writeZip(entries: readonly ZipEntry[], at = new Date()): Uint8Array<ArrayBuffer> {
  const { time, date } = dosTime(at);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.path)) throw new Error(`zip: duplicated path ${e.path}`);
    seen.add(e.path);
    const name = enc.encode(e.path);
    const crc = crc32(e.data);
    const size = e.data.length;
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);
    parts.push(local, e.data);
    central.push(cen);
    offset += local.length + size;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const total = offset + cdSize + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const x of [...parts, ...central, end]) {
    out.set(x, p);
    p += x.length;
  }
  return out;
}

export class ZipError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ZipError';
  }
}

const dec = new TextDecoder();

/** zip を読む（無圧縮のエントリだけ。CRC を確かめる） */
export function readZip(bytes: Uint8Array): ZipEntry[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // 終端レコードを後ろから探す（コメントは最大 65535 バイト）
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('zip の終わりが見つかりません');
  const count = v.getUint16(eocd + 10, true);
  const cdSize = v.getUint32(eocd + 12, true);
  const cdOff = v.getUint32(eocd + 16, true);
  if (cdOff + cdSize > eocd) throw new ZipError('zip の目次が壊れています');
  const out: ZipEntry[] = [];
  let p = cdOff;
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new ZipError('zip の目次が壊れています');
    const method = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const csize = v.getUint32(p + 20, true);
    const usize = v.getUint32(p + 24, true);
    const nlen = v.getUint16(p + 28, true);
    const xlen = v.getUint16(p + 30, true);
    const clen = v.getUint16(p + 32, true);
    const loc = v.getUint32(p + 42, true);
    const path = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (method !== 0 || csize !== usize) throw new ZipError(`圧縮された項目は読めません: ${path}`);
    if (v.getUint32(loc, true) !== 0x04034b50) throw new ZipError('zip の項目が壊れています');
    const lnlen = v.getUint16(loc + 26, true);
    const lxlen = v.getUint16(loc + 28, true);
    const start = loc + 30 + lnlen + lxlen;
    if (start + csize > bytes.length) throw new ZipError('zip の項目が途中で切れています');
    const data = bytes.slice(start, start + csize);
    if (crc32(data) !== crc) throw new ZipError(`zip の項目が壊れています（CRC）: ${path}`);
    out.push({ path, data });
  }
  return out;
}
