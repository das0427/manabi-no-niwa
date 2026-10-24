#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""KanjiVG から、ひらがな・カタカナ全部と、学年別漢字配当表の 1026 字の書き順（点列）を抽出する。

  python extract_all.py [--zip .cache/kanjivg/kanjivg-20260714-main.zip]
                        [--grades src/text/kanji-grades.ts]
                        [--outdir src/packs/_data/strokes] [--preview-dir scripts/strokes]
                        [--step 2.0]

- パスの解析・サンプリングは extract.py と同じ関数を使う（点の間隔も同じ。弧長 STEP=2.0 単位 = 1000 座標で約 18）。
  座標は 0〜1000 の整数（KanjiVG の 109 座標を ×1000/109）。ストロークの順序 = KanjiVG の順 = 書き順。
- 入力の漢字の学年は src/text/kanji-grades.ts の KANJI_BY_GRADE から読む（正本は 1 か所）。
- 出力（src/packs/_data/strokes/）:
    kana.json        ひらがな U+3041〜U+3094 と カタカナ U+30A1〜U+30F6、長音記号 ー
    kanji-g1.json … kanji-g6.json   学年別の漢字
  各ファイル: {"source":"KanjiVG","license":"CC BY-SA 3.0","version":"r…","size":1000,"set":"kana|kanji-gN",
               "chars":{"字":{"strokes":[[[x,y],…],…]}}}   （既存の kana-strokes.json と同じ形）
- KanjiVG に無い字・ストローク番号が連番でない字は出力に入れず、最後に一覧を表示して終了コード 1 にする。
- プレビュー: scripts/strokes/preview-kana.svg, preview-g1.svg … preview-g6.svg（番号と始点付き。確認用の抜粋）
"""
import argparse
import io
import json
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract as E  # noqa: E402  (同じディレクトリの extract.py)

ROOT = E.ROOT

HIRAGANA = "".join(chr(c) for c in range(0x3041, 0x3095))  # ぁ … ゔ
KATAKANA = "".join(chr(c) for c in range(0x30A1, 0x30F7)) + "ー"  # ァ … ヶ と 長音記号

# 確認用プレビューに載せる字（各学年から、画数が多いもの・形が似たもの・払いや跳ねの多いものを含めて選ぶ）
PREVIEW = {
    "kana": "あおかきさすたなはまやらわんがぱアイキケシソチテヌネハフホムリンヴー",
    "g1": "右学空見森町先年字男竹虫赤貝",
    "g2": "羽雲園歌絵楽顔鳥魚図場曜電船",
    "g3": "感業様緑橋農鼻薬競童題",
    "g4": "愛議熊潟競鏡働験飯焼",
    "g5": "圧額護鉱際織職築燃豊",
    "g6": "異警厳蚕縦臓難優認",
}


def read_grades(ts_path: Path):
    """kanji-grades.ts の G1〜G6 配列（1 行 20 字の文字列の並び）から学年別の文字列を作る。"""
    src = ts_path.read_text(encoding="utf-8")
    out = {}
    for g in range(1, 7):
        m = re.search(rf"const G{g} = \[(.*?)\];", src, re.S)
        if not m:
            raise ValueError(f"G{g} が kanji-grades.ts に見つからない")
        out[g] = "".join(re.findall(r"'([^']*)'", m.group(1)))
    return out


def extract_set(zf, chars, step, label):
    done, missing = {}, []
    for ch in chars:
        if ch in done:
            continue
        try:
            ds = E.load_strokes(zf, ch)
            if not ds:
                raise ValueError("ストロークが無い")
            polys = [stroke_polyline(d, step) for d in ds]
            if any(len(p) < 2 for p in polys):
                raise ValueError("2 点未満のストロークがある")
            done[ch] = {"strokes": polys}
        except (KeyError, ValueError) as e:
            missing.append((ch, f"U+{ord(ch):04X}", str(e)))
    print(f"[strokes-all] {label}: {len(done)}/{len(chars)} 字を抽出、不足 {len(missing)} 字")
    return done, missing


def stroke_polyline(d, step):
    subs = E.parse_path(d)
    segs = [s for sub in subs for s in sub]
    return E.to_out(E.resample(E.flatten(segs), step))


def write_json(path: Path, set_name: str, chars: dict):
    lines = ['{"source":%s,"license":%s,"version":%s,"size":%d,"set":%s,"chars":{' % (
        json.dumps("KanjiVG"), json.dumps("CC BY-SA 3.0"), json.dumps(E.RELEASE), E.OUT_SIZE, json.dumps(set_name))]
    items = []
    for ch, v in chars.items():
        strokes = ",\n    ".join(json.dumps(s, separators=(",", ":")) for s in v["strokes"])
        items.append(f'  {json.dumps(ch, ensure_ascii=False)}:{{"strokes":[\n    {strokes}\n  ]}}')
    lines.append(",\n".join(items))
    lines.append("}}\n")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    json.loads(path.read_text(encoding="utf-8"))  # 妥当性確認


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", type=Path, default=ROOT / ".cache" / "kanjivg" / E.ZIP_NAME)
    ap.add_argument("--grades", type=Path, default=ROOT / "src" / "text" / "kanji-grades.ts")
    ap.add_argument("--outdir", type=Path, default=ROOT / "src" / "packs" / "_data" / "strokes")
    ap.add_argument("--preview-dir", type=Path, default=ROOT / "scripts" / "strokes")
    ap.add_argument("--step", type=float, default=E.STEP)
    a = ap.parse_args()

    grades = read_grades(a.grades)
    counts = {g: len(s) for g, s in grades.items()}
    print(f"[strokes-all] 配当表: {counts} 計 {sum(counts.values())}")
    zpath = E.ensure_zip(a.zip)
    sets = {"kana": HIRAGANA + KATAKANA}
    for g, s in grades.items():
        sets[f"g{g}"] = s

    all_missing = []
    with zipfile.ZipFile(zpath) as zf:
        for key, chars in sets.items():
            done, missing = extract_set(zf, chars, a.step, key)
            all_missing += [(key, *m) for m in missing]
            name = "kana" if key == "kana" else f"kanji-{key}"
            out = a.outdir / f"{name}.json"
            write_json(out, name, done)
            npts = sum(len(s) for v in done.values() for s in v["strokes"])
            nstr = sum(len(v["strokes"]) for v in done.values())
            print(f"[strokes-all] {out.name}: {out.stat().st_size} B  {len(done)} 字 {nstr} 画 {npts} 点")
            pv = {c: done[c] for c in PREVIEW[key] if c in done}
            E.write_preview(pv, a.preview_dir / f"preview-{key}.svg")
    if all_missing:
        print("[strokes-all] 不足した字:")
        for m in all_missing:
            print("   ", m)
        return 1
    print("[strokes-all] 不足なし")
    return 0


if __name__ == "__main__":
    sys.exit(main())
