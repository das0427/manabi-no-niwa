#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""KanjiVG からひらがなの書き順ストロークを抽出し、なぞり用 JSON を作る (標準ライブラリのみ)。

  python extract.py [--zip .cache/kanjivg/kanjivg-20260714-main.zip] [--chars しくつ...]
                    [--out src/modes/trace/data/kana-strokes.json] [--preview scripts/strokes/preview.svg]

- 入力: KanjiVG リリース zip (kanji/<5桁hex>.svg)。無ければ GitHub release から取得 (sha256 検証)。
- 各 <path d=...> を完全パース (M m L l H h V v C c S s Q q T t A a Z z) し、弧長で
  STEP 単位(KanjiVG 109 座標系で約2単位)ごとにサンプリングしたポリラインへ変換。
- 座標は 109 -> 1000 に拡大し整数丸め。ストロークの順序は KanjiVG の順(=書き順)。
出力: {"source":"KanjiVG","license":"CC BY-SA 3.0","version":"r20260714","size":1000,"chars":{"し":{"strokes":[[[x,y],...],...]}}}
"""
import argparse
import hashlib
import io
import json
import math
import re
import sys
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RELEASE = "r20260714"
ZIP_NAME = "kanjivg-20260714-main.zip"
ZIP_URL = f"https://github.com/KanjiVG/kanjivg/releases/download/{RELEASE}/{ZIP_NAME}"
ZIP_SHA256 = "b5df6cd2bc249dd49b8041eb99e38ba9f8dc6b9ea57962a80084b4a315d1a7fc"

DEFAULT_CHARS = "しくつへのてこいりうそちるろひ"
SRC_SIZE = 109.0
OUT_SIZE = 1000
STEP = 2.0  # KanjiVG 座標系での弧長間隔


# ---------------------------------------------------------------- path parser
TOKEN_RE = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")
ARGC = {"M": 2, "L": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "T": 2, "A": 7, "Z": 0}


def tokenize(d: str):
    return TOKEN_RE.findall(d)


def parse_path(d: str):
    """パスを絶対座標のセグメント列にする。
    戻り値: [("L",p0,p1) | ("C",p0,c1,c2,p1) | ("Q",p0,c,p1) | ("A",...)] を点列(サブパス)に変換するための中間表現。
    ここでは直接ポリライン用の 'subpaths' (各: [segments]) を返す。"""
    toks = tokenize(d)
    i = 0
    cx = cy = 0.0          # 現在点
    sx = sy = 0.0          # サブパス始点
    last_cmd = None
    last_c2 = None         # 直前の C/S の第2制御点 (S 用)
    last_q = None          # 直前の Q/T の制御点 (T 用)
    cmd = None
    subpaths = []
    segs = None

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v

    while i < len(toks):
        t = toks[i]
        if re.match(r"[A-Za-z]", t):
            cmd = t
            i += 1
            if cmd in "Zz":
                if segs is not None and (cx, cy) != (sx, sy):
                    segs.append(("L", (cx, cy), (sx, sy)))
                cx, cy = sx, sy
                last_cmd = "Z"
                last_c2 = last_q = None
                continue
        elif cmd is None:
            raise ValueError("path は コマンドで始まる必要がある")
        elif cmd in "Zz":
            raise ValueError("Z の後に数値")
        # 暗黙の繰り返し: M の後続は L
        up = cmd.upper()
        rel = cmd.islower()
        n = ARGC[up]
        if i + n > len(toks) and n:
            raise ValueError(f"引数不足: {cmd}")
        if up == "M":
            x, y = num(), num()
            if rel:
                x += cx; y += cy
            cx, cy = sx, sy = x, y
            segs = []
            subpaths.append(segs)
            cmd = "l" if rel else "L"   # 以降の暗黙コマンド
            last_c2 = last_q = None
        elif up == "L":
            x, y = num(), num()
            if rel:
                x += cx; y += cy
            segs.append(("L", (cx, cy), (x, y)))
            cx, cy = x, y
            last_c2 = last_q = None
        elif up == "H":
            x = num()
            if rel:
                x += cx
            segs.append(("L", (cx, cy), (x, cy)))
            cx = x
            last_c2 = last_q = None
        elif up == "V":
            y = num()
            if rel:
                y += cy
            segs.append(("L", (cx, cy), (cx, y)))
            cy = y
            last_c2 = last_q = None
        elif up == "C":
            v = [num() for _ in range(6)]
            if rel:
                v = [v[0] + cx, v[1] + cy, v[2] + cx, v[3] + cy, v[4] + cx, v[5] + cy]
            segs.append(("C", (cx, cy), (v[0], v[1]), (v[2], v[3]), (v[4], v[5])))
            last_c2 = (v[2], v[3]); last_q = None
            cx, cy = v[4], v[5]
        elif up == "S":
            v = [num() for _ in range(4)]
            if rel:
                v = [v[0] + cx, v[1] + cy, v[2] + cx, v[3] + cy]
            if last_c2 is not None and last_cmd in ("C", "S"):
                c1 = (2 * cx - last_c2[0], 2 * cy - last_c2[1])
            else:
                c1 = (cx, cy)
            segs.append(("C", (cx, cy), c1, (v[0], v[1]), (v[2], v[3])))
            last_c2 = (v[0], v[1]); last_q = None
            cx, cy = v[2], v[3]
        elif up == "Q":
            v = [num() for _ in range(4)]
            if rel:
                v = [v[0] + cx, v[1] + cy, v[2] + cx, v[3] + cy]
            segs.append(("Q", (cx, cy), (v[0], v[1]), (v[2], v[3])))
            last_q = (v[0], v[1]); last_c2 = None
            cx, cy = v[2], v[3]
        elif up == "T":
            x, y = num(), num()
            if rel:
                x += cx; y += cy
            if last_q is not None and last_cmd in ("Q", "T"):
                c = (2 * cx - last_q[0], 2 * cy - last_q[1])
            else:
                c = (cx, cy)
            segs.append(("Q", (cx, cy), c, (x, y)))
            last_q = c; last_c2 = None
            cx, cy = x, y
        elif up == "A":
            rx, ry, rot, laf, sf = num(), num(), num(), num(), num()
            x, y = num(), num()
            if rel:
                x += cx; y += cy
            segs.append(("A", (cx, cy), rx, ry, rot, int(laf), int(sf), (x, y)))
            cx, cy = x, y
            last_c2 = last_q = None
        last_cmd = up
    return subpaths


# ------------------------------------------------------------ 評価(サンプリング)
def cubic(p0, c1, c2, p1, t):
    u = 1 - t
    return (u**3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t**3 * p1[0],
            u**3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t**3 * p1[1])


def quad(p0, c, p1, t):
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
            u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1])


def arc_points(p0, rx, ry, rot_deg, laf, sf, p1, n):
    """SVG 仕様 F.6.5 の端点→中心パラメータ変換で円弧を n 分割。"""
    x1, y1 = p0
    x2, y2 = p1
    if (x1, y1) == (x2, y2):
        return [p0, p1]
    rx, ry = abs(rx), abs(ry)
    if rx == 0 or ry == 0:
        return [p0, p1]
    phi = math.radians(rot_deg)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p = cp * dx + sp * dy
    y1p = -sp * dx + cp * dy
    lam = (x1p**2) / (rx**2) + (y1p**2) / (ry**2)
    if lam > 1:
        s = math.sqrt(lam)
        rx *= s; ry *= s
    num_ = rx**2 * ry**2 - rx**2 * y1p**2 - ry**2 * x1p**2
    den = rx**2 * y1p**2 + ry**2 * x1p**2
    coef = math.sqrt(max(0.0, num_ / den)) * (-1 if laf == sf else 1)
    cxp = coef * rx * y1p / ry
    cyp = -coef * ry * x1p / rx
    cx = cp * cxp - sp * cyp + (x1 + x2) / 2
    cy = sp * cxp + cp * cyp + (y1 + y2) / 2

    def ang(ux, uy, vx, vy):
        a = math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        return a
    th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sf and dth > 0:
        dth -= 2 * math.pi
    elif sf and dth < 0:
        dth += 2 * math.pi
    pts = []
    for k in range(n + 1):
        th = th1 + dth * k / n
        x = cp * rx * math.cos(th) - sp * ry * math.sin(th) + cx
        y = sp * rx * math.cos(th) + cp * ry * math.sin(th) + cy
        pts.append((x, y))
    pts[0], pts[-1] = p0, p1
    return pts


def flatten(segs, dense=64):
    """セグメント列 -> 細かい点列 (弧長リサンプリング前の元データ)。"""
    pts = []
    for s in segs:
        kind = s[0]
        if kind == "L":
            seg_pts = [s[1], s[2]]
        elif kind == "C":
            seg_pts = [cubic(s[1], s[2], s[3], s[4], k / dense) for k in range(dense + 1)]
        elif kind == "Q":
            seg_pts = [quad(s[1], s[2], s[3], k / dense) for k in range(dense + 1)]
        else:
            seg_pts = arc_points(s[1], s[2], s[3], s[4], s[5], s[6], s[7], dense)
        if pts:
            seg_pts = seg_pts[1:]
        pts.extend(seg_pts)
    return pts


def resample(pts, step):
    """折れ線を弧長 step ごとに等間隔サンプリング(始点と終点は必ず含む)。"""
    if len(pts) < 2:
        return list(pts)
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    total = cum[-1]
    if total == 0:
        return [pts[0]]
    n = max(1, int(round(total / step)))   # 区間数 (間隔 = total/n ≈ step)
    out = []
    j = 0
    for k in range(n + 1):
        target = total * k / n
        while j < len(cum) - 2 and cum[j + 1] < target:
            j += 1
        seg_len = cum[j + 1] - cum[j]
        r = 0.0 if seg_len == 0 else (target - cum[j]) / seg_len
        out.append((pts[j][0] + (pts[j + 1][0] - pts[j][0]) * r,
                    pts[j][1] + (pts[j + 1][1] - pts[j][1]) * r))
    return out


def to_out(pts):
    k = OUT_SIZE / SRC_SIZE
    res = []
    for x, y in pts:
        p = [int(round(x * k)), int(round(y * k))]
        if not res or res[-1] != p:
            res.append(p)
    return res


# ------------------------------------------------------------ KanjiVG 読み込み
def ensure_zip(path: Path) -> Path:
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[strokes] ダウンロード: {ZIP_URL}")
    req = urllib.request.Request(ZIP_URL, headers={"User-Agent": "manabi-no-niwa-asset-pipeline"})
    data = urllib.request.urlopen(req).read()
    if hashlib.sha256(data).hexdigest() != ZIP_SHA256:
        raise RuntimeError("sha256 不一致: KanjiVG zip が想定と異なる")
    path.write_bytes(data)
    return path


def load_strokes(zf: zipfile.ZipFile, ch: str):
    name = f"kanji/{ord(ch):05x}.svg"
    raw = zf.read(name)
    root = ET.parse(io.BytesIO(raw)).getroot()
    strokes = []
    for el in root.iter("{http://www.w3.org/2000/svg}path"):
        pid = el.get("id", "")
        m = re.fullmatch(r"kvg:([0-9a-f]+)-s(\d+)", pid)
        if not m:
            continue
        strokes.append((int(m.group(2)), el.get("d")))
    strokes.sort(key=lambda t: t[0])  # 通常は文書順=書き順と一致。番号で念のため整列
    if [n for n, _ in strokes] != list(range(1, len(strokes) + 1)):
        raise ValueError(f"{ch}: ストローク番号が連番でない {[n for n, _ in strokes]}")
    return [d for _, d in strokes]


def stroke_polyline(d: str):
    subs = parse_path(d)
    segs = [s for sub in subs for s in sub]   # ひらがなは 1 ストローク 1 サブパス
    if len(subs) != 1:
        print(f"[strokes] 警告: サブパスが {len(subs)} 個 (連結して扱う)")
    return to_out(resample(flatten(segs), STEP))


# ------------------------------------------------------------ プレビュー
def write_preview(chars_data, path: Path):
    cols = 5
    cell = 260
    pad = 20
    rows = math.ceil(len(chars_data) / cols)
    W, H = cols * cell, rows * cell + 40
    palette = ["#e63946", "#f4a261", "#2a9d8f", "#264653", "#8338ec", "#3a86ff", "#ff006e", "#6a994e"]
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="sans-serif">',
           f'<rect width="{W}" height="{H}" fill="#fff"/>',
           f'<text x="10" y="24" font-size="16">KanjiVG {RELEASE} stroke order preview (circle = start, number = order)</text>']
    scale = (cell - 2 * pad) / OUT_SIZE
    for idx, (ch, data) in enumerate(chars_data.items()):
        ox = (idx % cols) * cell + pad
        oy = (idx // cols) * cell + pad + 40
        out.append(f'<rect x="{ox - 8}" y="{oy - 8}" width="{cell - 2 * pad + 16}" height="{cell - 2 * pad + 16}" fill="none" stroke="#ccc"/>')
        out.append(f'<line x1="{ox - 8}" y1="{oy + (cell - 2 * pad) / 2}" x2="{ox + cell - 2 * pad + 8}" y2="{oy + (cell - 2 * pad) / 2}" stroke="#eee"/>')
        out.append(f'<line y1="{oy - 8}" x1="{ox + (cell - 2 * pad) / 2}" y2="{oy + cell - 2 * pad + 8}" x2="{ox + (cell - 2 * pad) / 2}" stroke="#eee"/>')
        out.append(f'<text x="{ox}" y="{oy + 14}" font-size="14" fill="#999">{ch}</text>')
        for n, st in enumerate(data["strokes"], 1):
            col = palette[(n - 1) % len(palette)]
            pts = " ".join(f"{ox + x * scale:.1f},{oy + y * scale:.1f}" for x, y in st)
            out.append(f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>')
            x0, y0 = st[0]
            sx, sy = ox + x0 * scale, oy + y0 * scale
            out.append(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="7" fill="{col}"/>')
            out.append(f'<text x="{sx:.1f}" y="{sy + 4:.1f}" font-size="10" fill="#fff" text-anchor="middle">{n}</text>')
    out.append("</svg>")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", type=Path, default=ROOT / ".cache" / "kanjivg" / ZIP_NAME)
    ap.add_argument("--chars", default=DEFAULT_CHARS)
    ap.add_argument("--out", type=Path, default=ROOT / "src" / "modes" / "trace" / "data" / "kana-strokes.json")
    ap.add_argument("--preview", type=Path, default=ROOT / "scripts" / "strokes" / "preview.svg")
    a = ap.parse_args()

    zpath = ensure_zip(a.zip)
    chars = {}
    with zipfile.ZipFile(zpath) as zf:
        for ch in a.chars:
            if ch in chars:
                continue
            ds = load_strokes(zf, ch)
            chars[ch] = {"strokes": [stroke_polyline(d) for d in ds]}
            npts = sum(len(s) for s in chars[ch]["strokes"])
            print(f"[strokes] {ch} U+{ord(ch):04X}: {len(ds)} ストローク {npts} 点")
    doc = {"source": "KanjiVG", "license": "CC BY-SA 3.0", "version": RELEASE, "size": OUT_SIZE, "chars": chars}
    a.out.parent.mkdir(parents=True, exist_ok=True)
    # ストロークごと1行にして diff しやすく、かつ小さく
    lines = ['{"source":%s,"license":%s,"version":%s,"size":%d,"chars":{' % (
        json.dumps(doc["source"]), json.dumps(doc["license"], ensure_ascii=False), json.dumps(RELEASE), OUT_SIZE)]
    items = []
    for ch, v in chars.items():
        strokes = ",\n    ".join(json.dumps(s, separators=(",", ":")) for s in v["strokes"])
        items.append(f'  {json.dumps(ch, ensure_ascii=False)}:{{"strokes":[\n    {strokes}\n  ]}}')
    lines.append(",\n".join(items))
    lines.append("}}\n")
    a.out.write_text("\n".join(lines), encoding="utf-8")
    json.loads(a.out.read_text(encoding="utf-8"))  # 妥当性確認
    print(f"[strokes] {a.out} ({a.out.stat().st_size} B)")
    if a.preview:
        write_preview(chars, a.preview)
        print(f"[strokes] preview: {a.preview}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
