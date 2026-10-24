"""Natural Earth のシェープファイル（.shp/.dbf）を標準ライブラリだけで読む（依存を増やさない）。

使い方: build_japan_map.py から import する。取得物のフォルダの外から `python -I` で実行すること
（-I では スクリプトのフォルダが sys.path に入らないので、build_japan_map.py がこのフォルダを足す）。
"""
from __future__ import annotations

import struct
from typing import Iterator


def read_dbf(path: str) -> list[dict[str, object]]:
    with open(path, 'rb') as f:
        data = f.read()
    n_rec, header_len, rec_len = struct.unpack('<IHH', data[4:12])
    fields: list[tuple[str, str, int]] = []
    pos = 32
    while data[pos] != 0x0D:
        name = data[pos:pos + 11].split(b'\x00')[0].decode('ascii')
        ftype = chr(data[pos + 11])
        flen = data[pos + 16]
        fields.append((name, ftype, flen))
        pos += 32
    out: list[dict[str, object]] = []
    for i in range(n_rec):
        base = header_len + i * rec_len
        rec = data[base:base + rec_len]
        off = 1  # 削除の印
        row: dict[str, object] = {}
        for name, ftype, flen in fields:
            raw = rec[off:off + flen]
            off += flen
            s = raw.decode('utf-8', errors='replace').strip(' \x00')
            if ftype in 'NF':
                try:
                    row[name] = float(s) if s else None
                except ValueError:
                    row[name] = None
            else:
                row[name] = s
        out.append(row)
    return out


def read_shp_polygons(path: str) -> Iterator[list[list[tuple[float, float]]]]:
    """各レコードの環（ring）の一覧（経度, 緯度）を順に返す。Polygon（type 5）だけを扱う。"""
    with open(path, 'rb') as f:
        data = f.read()
    pos = 100
    end = len(data)
    while pos < end:
        _num, clen = struct.unpack('>II', data[pos:pos + 8])
        content = data[pos + 8:pos + 8 + clen * 2]
        pos += 8 + clen * 2
        stype = struct.unpack('<i', content[0:4])[0]
        if stype == 0:
            yield []
            continue
        if stype != 5:
            raise ValueError(f'shape type {stype} は扱わない')
        n_parts, n_points = struct.unpack('<ii', content[36:44])
        parts = list(struct.unpack(f'<{n_parts}i', content[44:44 + 4 * n_parts]))
        pbase = 44 + 4 * n_parts
        pts = [struct.unpack('<dd', content[pbase + 16 * k:pbase + 16 * k + 16]) for k in range(n_points)]
        rings = []
        for j, s in enumerate(parts):
            e = parts[j + 1] if j + 1 < n_parts else n_points
            rings.append([(p[0], p[1]) for p in pts[s:e]])
        yield rings
