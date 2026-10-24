#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""日本語フォントのサブセット化 -> woff2。

  python subset.py [--chars FILE ...] [--extra FILE ...] [--klee-extra FILE ...] [--out public/fonts]

  --chars       文字リスト(UTF-8 テキスト。全文字を使う。既定: scripts/fonts/base-chars.txt)
  --extra       追加の文字リスト(src から抽出したもの等)。--chars とマージ
  --klee-extra  Klee One 専用の追加文字(既定の Klee は かな/英数/記号のみ。教材の漢字をここに)
  入力 TTF は .cache/fonts/ (--src で変更)。無ければ google/fonts リポジトリから自動取得。

出力: zen-maru-gothic-400.woff2 / -700.woff2 / klee-one-400.woff2 / klee-one-600.woff2
"""
import argparse
import sys
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
RAW = "https://raw.githubusercontent.com/google/fonts/main/ofl"

# 出力名, 入力TTF, 取得元ディレクトリ, 対象(zen=全文字 / klee=かな英数記号のみ)
JOBS = [
    ("zen-maru-gothic-400.woff2", "ZenMaruGothic-Regular.ttf", "zenmarugothic", "zen"),
    ("zen-maru-gothic-700.woff2", "ZenMaruGothic-Bold.ttf", "zenmarugothic", "zen"),
    ("klee-one-400.woff2", "KleeOne-Regular.ttf", "kleeone", "klee"),
    ("klee-one-600.woff2", "KleeOne-SemiBold.ttf", "kleeone", "klee"),
]
OFL = [("zenmarugothic", "OFL-ZenMaruGothic.txt"), ("kleeone", "OFL-KleeOne.txt")]

# 残す OpenType フィーチャ(かな用の proportional metrics=palt, 縦書き, 互換用)
FEATURES = ["kern", "palt", "vert", "vrt2", "ccmp", "locl", "liga", "calt"]


def is_ideograph(ch: str) -> bool:
    c = ord(ch)
    return (0x4E00 <= c <= 0x9FFF) or (0x3400 <= c <= 0x4DBF) or (0xF900 <= c <= 0xFAFF) or (0x20000 <= c <= 0x2FFFF)


def read_chars(paths) -> set:
    s = set()
    for p in paths:
        for ch in Path(p).read_text(encoding="utf-8-sig"):
            if ch not in "\r\n\t﻿":
                s.add(ch)
    s.add(" ")
    return s


def fetch(name: str, directory: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{RAW}/{directory}/{name}"
    print(f"[fonts] ダウンロード: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "manabi-no-niwa-asset-pipeline"})
    with urllib.request.urlopen(req) as r, open(dest, "wb") as f:
        f.write(r.read())


def subset_font(src: Path, dst: Path, chars: set) -> int:
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = FEATURES
    opts.hinting = False
    opts.desubroutinize = True
    opts.notdef_outline = True
    opts.name_IDs = [0, 1, 2, 3, 4, 6, 13, 14]  # 著作権/ライセンス表記は残す
    opts.name_languages = [0x409]
    opts.drop_tables += ["DSIG"]
    opts.glyph_names = False
    font = TTFont(str(src))
    sub = subset.Subsetter(opts)
    sub.populate(text="".join(sorted(chars)))
    sub.subset(font)
    dst.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(str(dst))
    return dst.stat().st_size


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--chars", nargs="+", default=[str(HERE / "base-chars.txt")])
    ap.add_argument("--extra", nargs="*", default=[])
    ap.add_argument("--klee-extra", nargs="*", default=[])
    ap.add_argument("--src", type=Path, default=ROOT / ".cache" / "fonts")
    ap.add_argument("--out", type=Path, default=ROOT / "public" / "fonts")
    a = ap.parse_args()

    all_chars = read_chars(list(a.chars) + list(a.extra))
    klee_chars = {c for c in all_chars if not is_ideograph(c)}
    if a.klee_extra:
        klee_chars |= read_chars(a.klee_extra)
    print(f"[fonts] zen: {len(all_chars)} 文字 / klee: {len(klee_chars)} 文字")

    total = 0
    for out_name, ttf, directory, kind in JOBS:
        src = a.src / ttf
        if not src.exists():
            fetch(ttf, directory, src)
        size = subset_font(src, a.out / out_name, all_chars if kind == "zen" else klee_chars)
        total += size
        # 実際に入った文字数
        f = TTFont(str(a.out / out_name))
        n = len(f.getBestCmap())
        print(f"[fonts] {out_name:<28} {size / 1024:8.1f} KiB  cmap {n} 件")
    print(f"[fonts] 合計 {total / 1024:.1f} KiB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
