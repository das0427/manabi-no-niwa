#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""文部科学省「小学校学習指導要領（平成29年告示）」PDF の別表「学年別漢字配当表」を読み取る補助ツール。

背景: この PDF の別表は文字がアウトライン（ベクタ図形）で、テキストとして抽出できない。
そこで次の手順で読み取り、人が PDF の画像と見比べて確定する（推測では作らない）。
  1. PDF の別表のページ（4 ページ）を高解像度で描画し、表の罫線から文字領域を決める。
  2. 1 行 20 字の等間隔の枠（スロット）ごとに 1 文字を切り出す。
  3. 同じ形をシステムのフォント（既定: UD デジタル教科書体。PDF の字体に近い）で描いた
     JIS X 0208 の全漢字と照合して、近い字の候補（上位 4 つ）を出す。
  4. 行末の「（80字）」等の字数表記の行（右寄せ）で学年を区切る。
  5. `--verify <学年別の文字列の JSON>` を付けると、確定した文字列を各スロットの形と照合し直し、
     1 位でない（形が合わない）字を一覧に出す。誤読の検出用。

  python extract_grades.py [--pdf .cache/mext-g/shidoyoryo.pdf] [--out .cache/mext-g/grades-raw.json]
                           [--font C:/Windows/Fonts/UDDigiKyokashoN-R.ttc] [--sheet-dir .cache/mext-g/sheets]
                           [--verify grades.json]

要: PyMuPDF, Pillow, numpy（プロジェクトの .venv。pip で追加してよいのは .venv の中だけ）。Windows のフォントを使う。
出力は確認用の中間データ。最終データは src/text/kanji-grades.ts（人が確認して反映し、単体テストで字数・重複を検査）。
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PAGES = [43, 44, 45, 46]  # 0 始まり（PDF 通し 44〜47 ページ。本文のページ番号 42〜45）
SLOTS = 20  # 1 行の字数
N = 48  # 比較用の正規化サイズ
SCALE = 6  # PDF -> 画像の拡大率（ピクセル/pt）


def table_bounds(page):
    """表の縦罫線（細く縦に長い図形）から、文字列の領域の左右端と上下端を得る。"""
    xs, ys = set(), []
    for d in page.get_drawings():
        r = d["rect"]
        if r.width < 2 and 30 < r.height < 900:
            xs.add(round((r.x0 + r.x1) / 2, 0))
            ys += [r.y0, r.y1]
    xs = sorted(xs)
    if len(xs) != 3:
        raise ValueError(f"縦罫線が 3 本でない: {xs}")
    return xs[1], xs[2], min(ys), max(ys)


def bands(ink_rows, min_gap):
    """ink_rows: 各ピクセル行に墨があるか。間隔が min_gap 以下なら同じ帯とみなす。"""
    out = []
    start = last = None
    for i, v in enumerate(ink_rows):
        if v:
            if start is None:
                start = i
            elif i - last > min_gap:
                out.append((start, last + 1))
                start = i
            last = i
    if start is not None:
        out.append((start, last + 1))
    return out


def read_page(doc, pi):
    """ページの各行を [(スロット番号, 切り出した画像), ...] のリストで返す。"""
    page = doc[pi]
    left, right, top, bottom = table_bounds(page)
    clip = pymupdf.Rect(left + 1, top + 1, right - 1, bottom - 1)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), clip=clip, colorspace=pymupdf.csGRAY)
    a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
    img = Image.fromarray(a)
    ink = a < 128
    slot_pt = (right - left) / SLOTS
    rows = []
    for y0, y1 in bands(ink.any(axis=1), min_gap=5 * SCALE):
        if (y1 - y0) < 3 * SCALE:  # 学年間の横罫線
            continue
        band = ink[y0:y1]
        cells = []
        for k in range(SLOTS):
            x0 = max(0, int(round((k * slot_pt - 1) * SCALE)))  # clip の左端は left+1
            x1 = min(a.shape[1], int(round(((k + 1) * slot_pt - 1) * SCALE)))
            sub = band[:, x0:x1]
            if not sub.any():
                continue
            ys, xs = np.where(sub)
            cells.append((k, img.crop((x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1))))
        if cells:
            rows.append(cells)
    return rows


def normalize(img):
    """縦横比を保って長辺を N-8 に拡縮し N×N の中央に置き、ぼかして平均を引いて正規化する。"""
    a = np.asarray(img.convert("L"), dtype=np.float32)
    ink = a < 128
    if not ink.any():
        return None, 1.0
    ys, xs = np.where(ink)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = img.crop((x0, y0, x1, y1))
    w, h = crop.size
    aspect = w / max(1, h)
    s = (N - 8) / max(w, h)
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    z = crop.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("L", (N, N), 255)
    canvas.paste(z, ((N - nw) // 2, (N - nh) // 2))
    canvas = canvas.filter(ImageFilter.GaussianBlur(1.0))
    v = 1.0 - np.asarray(canvas, dtype=np.float32) / 255.0
    v = v - v.mean()
    n = np.linalg.norm(v)
    return (v / n if n > 0 else v), aspect


def render_font_char(font, ch, size=160):
    img = Image.new("L", (size * 2, size * 2), 255)
    ImageDraw.Draw(img).text((size // 2, size // 2), ch, font=font, fill=0)
    return img


def jis0208_kanji():
    chars = []
    for hi in range(0x30, 0x75):
        for lo in range(0x21, 0x7F):
            try:
                ch = bytes([hi + 0x80, lo + 0x80]).decode("euc_jp")
            except UnicodeDecodeError:
                continue
            if "\u4e00" <= ch <= "\u9fff":
                chars.append(ch)
    return chars


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", type=Path, default=ROOT / ".cache" / "mext-g" / "shidoyoryo.pdf")
    ap.add_argument("--font", type=Path, default=Path("C:/Windows/Fonts/UDDigiKyokashoN-R.ttc"))
    ap.add_argument("--out", type=Path, default=ROOT / ".cache" / "mext-g" / "grades-raw.json")
    ap.add_argument("--sheet-dir", type=Path, default=None, help="学年ごとの切り出し画像（確認用）を出す場所")
    ap.add_argument("--verify", type=Path, default=None, help="確定した {学年: 文字列} の JSON を照合し直す")
    a = ap.parse_args()

    font = ImageFont.truetype(str(a.font), 120)
    vecs, asps, keep = [], [], []
    for ch in jis0208_kanji():
        v, asp = normalize(render_font_char(font, ch))
        if v is None:
            continue
        vecs.append(v.reshape(-1))
        asps.append(asp)
        keep.append(ch)
    cand_vec = np.stack(vecs)
    cand_asp = np.array(asps)
    index = {ch: i for i, ch in enumerate(keep)}
    print(f"[grades] 候補 {len(keep)} 字")

    def score(img):
        v, asp = normalize(img)
        d = 1.0 - cand_vec @ v.reshape(-1)
        return d + 0.05 * np.abs(np.log(np.maximum(cand_asp, 0.05) / max(asp, 0.05)))

    doc = pymupdf.open(str(a.pdf))
    # 行（ページ番号, セル列）を集め、字数表記の行（先頭スロットが 0 でない右寄せの行）で学年を区切る
    grades = [[]]
    labels = []
    for pi in PAGES:
        for cells in read_page(doc, pi):
            # 先頭スロットから途切れず続く部分が漢字。その後ろ（右寄せ）が「（202字）」等の字数表記
            n_run = 0
            while n_run < len(cells) and cells[n_run][0] == n_run:
                n_run += 1
            if n_run:
                grades[-1].append((pi, cells[:n_run]))
            if n_run < len(cells):
                labels.append((pi, len(cells) - n_run))
                grades.append([])
    if not grades[-1]:
        grades.pop()
    verify = json.loads(a.verify.read_text(encoding="utf-8")) if a.verify else None
    out = {"grades": [], "uncertain": []}
    for gi, rows in enumerate(grades, 1):
        s = ""
        for pi, cells in rows:
            for k, im in cells:
                d = score(im)
                order = np.argsort(d)[:4]
                top = [(keep[i], round(float(d[i]), 3)) for i in order]
                ch = top[0][0]
                if verify:
                    want = verify[str(gi)][len(s)] if len(s) < len(verify[str(gi)]) else "?"
                    rank = int((d < d[index[want]]).sum()) if want in index else -1
                    if rank != 0:
                        out["uncertain"].append(
                            {"grade": gi, "pos": len(s) + 1, "page": pi, "slot": k, "want": want, "rank": rank,
                             "dist": round(float(d[index[want]]), 3) if want in index else None, "top": top}
                        )
                    ch = want
                elif top[1][1] - top[0][1] < 0.03 or top[0][1] > 0.35:
                    out["uncertain"].append({"grade": gi, "pos": len(s) + 1, "page": pi, "slot": k, "top": top})
                s += ch
        out["grades"].append({"grade": gi, "count": len(s), "chars": s})
        print(f"[grades] 第{gi}学年 {len(s)} 字: {s}")
    print(f"[grades] 字数表記の行 {len(labels)} 個（ページ, 記号数）: {labels}")
    print(f"[grades] 要確認 {len(out['uncertain'])} 件")
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    if a.sheet_dir:
        a.sheet_dir.mkdir(parents=True, exist_ok=True)
        for gi, rows in enumerate(grades, 1):
            sheet = Image.new("L", (SLOTS * 90, len(rows) * 100), 255)
            for ri, (pi, cells) in enumerate(rows):
                for k, im in cells:
                    t = im.copy()
                    t.thumbnail((86, 92))
                    sheet.paste(t, (k * 90, ri * 100))
            sheet.save(a.sheet_dir / f"grade{gi}.png")
    print(f"[grades] -> {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
