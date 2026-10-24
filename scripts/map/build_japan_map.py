"""日本の47都道府県の地図データ（src/engines/map/data/japan.json）を Natural Earth の admin-1 から作る。

出典: Natural Earth（公有・パブリックドメイン）Admin 1 – States, Provinces 1:10m（ne_10m_admin_1_states_provinces）。
取得・版・取得日は licenses/NaturalEarth-NOTICE.txt と docs/assets-pipeline.md の「日本地図（map エンジン）」の節。

使い方（取得物のフォルダの外から、-I で）:
  python -I scripts/map/build_japan_map.py <展開したフォルダ> src/engines/map/data/japan.json

処理:
  1. adm0_a3 == 'JPN' の47件を取り出す（iso_3166_2 = JP-01〜JP-47）。
  2. 北方領土（択捉島・国後島・色丹島・歯舞群島）は Natural Earth では RU-SAK に入っているため、
     その範囲（経度145.3〜149.0・緯度43.0〜45.7）の環を北海道に加える（学習指導要領 社会5年「我が国の領土」に合わせる）。
  3. 投影: 正距円筒（経度は cos(37.5°) を掛ける）。1度 = 縦60・横48 の単位。
  4. 離島: 沖縄県と、鹿児島県の北緯29度より南（奄美群島など）は左上の囲み（縮尺は本図と同じ）に移す。
     東京都の北緯32.5度より南（小笠原諸島・沖ノ鳥島・南鳥島など）は描かない。
     面積が 8 単位²（約27km²）未満の島は描かない（各都道府県の最大の環は残す）。
  5. 簡略化: 隣の都道府県と共有する頂点の並びが切り替わる点（境界の分かれ目）を固定し、
     その間の鎖ごとに Douglas–Peucker（許容 0.8 単位）をかけ、整数に丸める。隣どうしは同じ鎖を同じ結果に簡略化するので、すき間が出ない。
  6. ピンの位置: 最大の環の内側で、辺から最も遠い格子点。
"""
from __future__ import annotations

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from naturalearth_io import read_dbf, read_shp_polygons  # noqa: E402

LON0 = 128.4
LAT0 = 45.75
KX = 60 * math.cos(math.radians(37.5))
KY = 60.0
INSET = {'lon0': 122.7, 'lat0': 29.0, 's': 1.0, 'x': 12.0, 'y': 12.0}
DP_TOL = 0.8
MIN_AREA = 8.0

# 都道府県コード → (漢字の名前, 名前の部分, よみ, 都道府県の字, その字のよみ, 地方)
PREFS: dict[int, tuple[str, str, str, str, str, str]] = {
    1: ('北海道', '北海道', 'ほっかいどう', '', '', 'hokkaido'),
    2: ('青森県', '青森', 'あおもり', '県', 'けん', 'tohoku'),
    3: ('岩手県', '岩手', 'いわて', '県', 'けん', 'tohoku'),
    4: ('宮城県', '宮城', 'みやぎ', '県', 'けん', 'tohoku'),
    5: ('秋田県', '秋田', 'あきた', '県', 'けん', 'tohoku'),
    6: ('山形県', '山形', 'やまがた', '県', 'けん', 'tohoku'),
    7: ('福島県', '福島', 'ふくしま', '県', 'けん', 'tohoku'),
    8: ('茨城県', '茨城', 'いばらき', '県', 'けん', 'kanto'),
    9: ('栃木県', '栃木', 'とちぎ', '県', 'けん', 'kanto'),
    10: ('群馬県', '群馬', 'ぐんま', '県', 'けん', 'kanto'),
    11: ('埼玉県', '埼玉', 'さいたま', '県', 'けん', 'kanto'),
    12: ('千葉県', '千葉', 'ちば', '県', 'けん', 'kanto'),
    13: ('東京都', '東京', 'とうきょう', '都', 'と', 'kanto'),
    14: ('神奈川県', '神奈川', 'かながわ', '県', 'けん', 'kanto'),
    15: ('新潟県', '新潟', 'にいがた', '県', 'けん', 'chubu'),
    16: ('富山県', '富山', 'とやま', '県', 'けん', 'chubu'),
    17: ('石川県', '石川', 'いしかわ', '県', 'けん', 'chubu'),
    18: ('福井県', '福井', 'ふくい', '県', 'けん', 'chubu'),
    19: ('山梨県', '山梨', 'やまなし', '県', 'けん', 'chubu'),
    20: ('長野県', '長野', 'ながの', '県', 'けん', 'chubu'),
    21: ('岐阜県', '岐阜', 'ぎふ', '県', 'けん', 'chubu'),
    22: ('静岡県', '静岡', 'しずおか', '県', 'けん', 'chubu'),
    23: ('愛知県', '愛知', 'あいち', '県', 'けん', 'chubu'),
    24: ('三重県', '三重', 'みえ', '県', 'けん', 'kinki'),
    25: ('滋賀県', '滋賀', 'しが', '県', 'けん', 'kinki'),
    26: ('京都府', '京都', 'きょうと', '府', 'ふ', 'kinki'),
    27: ('大阪府', '大阪', 'おおさか', '府', 'ふ', 'kinki'),
    28: ('兵庫県', '兵庫', 'ひょうご', '県', 'けん', 'kinki'),
    29: ('奈良県', '奈良', 'なら', '県', 'けん', 'kinki'),
    30: ('和歌山県', '和歌山', 'わかやま', '県', 'けん', 'kinki'),
    31: ('鳥取県', '鳥取', 'とっとり', '県', 'けん', 'chugoku'),
    32: ('島根県', '島根', 'しまね', '県', 'けん', 'chugoku'),
    33: ('岡山県', '岡山', 'おかやま', '県', 'けん', 'chugoku'),
    34: ('広島県', '広島', 'ひろしま', '県', 'けん', 'chugoku'),
    35: ('山口県', '山口', 'やまぐち', '県', 'けん', 'chugoku'),
    36: ('徳島県', '徳島', 'とくしま', '県', 'けん', 'shikoku'),
    37: ('香川県', '香川', 'かがわ', '県', 'けん', 'shikoku'),
    38: ('愛媛県', '愛媛', 'えひめ', '県', 'けん', 'shikoku'),
    39: ('高知県', '高知', 'こうち', '県', 'けん', 'shikoku'),
    40: ('福岡県', '福岡', 'ふくおか', '県', 'けん', 'kyushu'),
    41: ('佐賀県', '佐賀', 'さが', '県', 'けん', 'kyushu'),
    42: ('長崎県', '長崎', 'ながさき', '県', 'けん', 'kyushu'),
    43: ('熊本県', '熊本', 'くまもと', '県', 'けん', 'kyushu'),
    44: ('大分県', '大分', 'おおいた', '県', 'けん', 'kyushu'),
    45: ('宮崎県', '宮崎', 'みやざき', '県', 'けん', 'kyushu'),
    46: ('鹿児島県', '鹿児島', 'かごしま', '県', 'けん', 'kyushu'),
    47: ('沖縄県', '沖縄', 'おきなわ', '県', 'けん', 'kyushu'),
}


def centroid(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def in_inset(code: int, lonlat_ring) -> bool:
    if code == 47:
        return True
    if code == 46:
        return centroid(lonlat_ring)[1] < 29.0
    return False


def project(code: int, ring, inset: bool):
    out = []
    for lon, lat in ring:
        if inset:
            s = INSET['s']
            out.append((INSET['x'] + (lon - INSET['lon0']) * KX * s, INSET['y'] + (INSET['lat0'] - lat) * KY * s))
        else:
            out.append(((lon - LON0) * KX, (LAT0 - lat) * KY))
    return out


def area(ring) -> float:
    a = 0.0
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % len(ring)]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def dp(points, tol):
    """Douglas–Peucker（両はしを残す）"""
    if len(points) <= 2:
        return list(points)
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy)
    best, bi = -1.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        if norm == 0:
            d = math.hypot(px - x1, py - y1)
        else:
            d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm
        if d > best:
            best, bi = d, i
    if best <= tol:
        return [points[0], points[-1]]
    left = dp(points[:bi + 1], tol)
    right = dp(points[bi:], tol)
    return left[:-1] + right


def key(p) -> tuple[int, int]:
    return (round(p[0] * 1e6), round(p[1] * 1e6))


def simplify_ring(ring, owners, tol):
    """ring は閉じていない点列（経緯度のキー付き、投影済み）。owners[key] = その点を持つ都道府県の集合"""
    n = len(ring)
    keys = [r[0] for r in ring]
    pts = [r[1] for r in ring]
    fixed = []
    for i in range(n):
        o = owners[keys[i]]
        if o != owners[keys[i - 1]] or o != owners[keys[(i + 1) % n]] or len(o) > 2:
            fixed.append(i)
    if len(fixed) < 2:
        # 島（共有点が無い）: 始点と、始点から最も遠い点を固定
        far = max(range(n), key=lambda i: math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]))
        fixed = sorted({0, far})
    out = []
    for j, s in enumerate(fixed):
        e = fixed[(j + 1) % len(fixed)]
        chain = [pts[k % n] for k in range(s, (e if e > s else e + n) + 1)]
        # 向きをそろえる（同じ鎖を逆向きにたどる隣の環と同じ結果にするため、端の点の小さい方から）
        if key_pt(chain[-1]) < key_pt(chain[0]):
            simp = list(reversed(dp(list(reversed(chain)), tol)))
        else:
            simp = dp(chain, tol)
        out.extend(simp[:-1])
    return out


def key_pt(p):
    return (round(p[0], 6), round(p[1], 6))


def to_ints(ring):
    out = []
    for x, y in ring:
        q = (int(round(x)), int(round(y)))
        if not out or out[-1] != q:
            out.append(q)
    while len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out


def point_in_rings(x, y, rings) -> bool:
    inside = False
    for ring in rings:
        n = len(ring)
        for i in range(n):
            x1, y1 = ring[i]
            x2, y2 = ring[(i + 1) % n]
            if (y1 > y) != (y2 > y):
                xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
                if x < xi:
                    inside = not inside
    return inside


def seg_dist(px, py, a, b):
    (x1, y1), (x2, y2) = a, b
    dx, dy = x2 - x1, y2 - y1
    l2 = dx * dx + dy * dy
    t = 0 if l2 == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / l2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def label_point(rings):
    big = max(rings, key=area)
    xs = [p[0] for p in big]
    ys = [p[1] for p in big]
    best, bp = -1.0, centroid(big)
    steps = 24
    for i in range(steps + 1):
        for j in range(steps + 1):
            x = min(xs) + (max(xs) - min(xs)) * i / steps
            y = min(ys) + (max(ys) - min(ys)) * j / steps
            if not point_in_rings(x, y, [big]):
                continue
            d = min(seg_dist(x, y, r[k], r[(k + 1) % len(r)]) for r in rings for k in range(len(r)))
            if d > best:
                best, bp = d, (x, y)
    return [int(round(bp[0])), int(round(bp[1]))]


def main(src_dir: str, out_path: str) -> None:
    base = os.path.join(src_dir, 'ne_10m_admin_1_states_provinces')
    rows = read_dbf(base + '.dbf')
    shapes = list(read_shp_polygons(base + '.shp'))
    raw: dict[int, list] = {c: [] for c in PREFS}
    for r, s in zip(rows, shapes):
        if r['adm0_a3'] == 'JPN':
            code = int(str(r['iso_3166_2']).split('-')[1])
            raw[code].extend(s)
        elif r['iso_3166_2'] == 'RU-SAK':
            for ring in s:
                lon, lat = centroid(ring)
                if 145.3 <= lon <= 149.0 and 43.0 <= lat <= 45.7:
                    raw[1].append(ring)
    for c, rings in raw.items():
        if not rings:
            raise SystemExit(f'JP-{c:02d} が見つからない')

    # 頂点の持ち主（共有する境界の分かれ目を見つける）
    owners: dict[tuple[int, int], frozenset[int]] = {}
    tmp: dict[tuple[int, int], set[int]] = {}
    for c, rings in raw.items():
        for ring in rings:
            for p in ring:
                tmp.setdefault(key(p), set()).add(c)
    for k, v in tmp.items():
        owners[k] = frozenset(v)

    prefs_out = []
    total_pts = 0
    inset_pts: list[tuple[int, int]] = []
    for c in sorted(PREFS):
        name, base_name, yomi, suffix, suffix_yomi, region = PREFS[c]
        kept = []
        for ring in raw[c]:
            pts = ring[:-1] if ring[0] == ring[-1] else ring
            lon, lat = centroid(pts)
            if c == 13 and lat < 32.5:
                continue  # 小笠原諸島など
            ins = in_inset(c, pts)
            proj = project(c, pts, ins)
            kept.append((area(proj), [(key(p), q) for p, q in zip(pts, proj)], ins))
        kept.sort(key=lambda t: -t[0])
        rings_out = []
        for i, (a, ring, ins) in enumerate(kept):
            if i > 0 and a < MIN_AREA:
                continue
            simp = to_ints(simplify_ring(ring, owners, DP_TOL))
            if len(simp) < 3:
                continue
            rings_out.append(simp)
            if ins:
                inset_pts.extend(simp)
        total_pts += sum(len(r) for r in rings_out)
        prefs_out.append({
            'code': c,
            'name': name,
            'base': base_name,
            'yomi': yomi,
            'suffix': suffix,
            'suffixYomi': suffix_yomi,
            'region': region,
            'label': label_point(rings_out),
            'rings': [[v for p in r for v in p] for r in rings_out],
        })

    xs = [r[k] for p in prefs_out for r in p['rings'] for k in range(0, len(r), 2)]
    ys = [r[k] for p in prefs_out for r in p['rings'] for k in range(1, len(r), 2)]
    ix0 = min(p[0] for p in inset_pts) - 10
    iy0 = min(p[1] for p in inset_pts) - 10
    ix1 = max(p[0] for p in inset_pts) + 10
    iy1 = max(p[1] for p in inset_pts) + 10
    out = {
        'source': 'Natural Earth 1:10m Cultural Vectors, Admin 1 – States, Provinces (ne_10m_admin_1_states_provinces) v5.1.1. Public domain. 簡略化: scripts/map/build_japan_map.py',
        'viewBox': [0, 0, max(xs) + 10, max(ys) + 10],
        'inset': [max(0, ix0), max(0, iy0), ix1 - max(0, ix0), iy1 - max(0, iy0)],
        'prefs': prefs_out,
    }
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print(f'都道府県 {len(prefs_out)}・頂点 {total_pts}・{os.path.getsize(out_path)} バイト → {out_path}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('使い方: python -I build_japan_map.py <展開したフォルダ> <出力 json>')
    sys.stdout.reconfigure(encoding='utf-8')
    main(sys.argv[1], sys.argv[2])
