#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成済み mp3 の検査: デコード可否・長さ(manifest との一致)・ピーク/RMS・先頭末尾の無音。
使い方: python verify.py [--dir public/audio]"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", type=Path, default=ROOT / "public" / "audio")
    a = ap.parse_args()
    man = json.loads((a.dir / "manifest.json").read_text(encoding="utf-8"))
    bad = 0
    tot = 0
    print(f"{'key':<26}{'ms':>6}{'bytes':>7}{'kbps':>6}{'peak':>7}{'rms':>7}{'lead':>6}{'tail':>6}")
    for k, v in man["entries"].items():
        p = a.dir / v["file"]
        if not p.exists():
            print(f"{k}: ファイル無し"); bad += 1; continue
        d, sr = sf.read(str(p), dtype="float32")
        info = sf.info(str(p))
        ms = len(d) * 1000 / sr
        pk = float(np.max(np.abs(d)))
        thr = pk * 10 ** (-45 / 20)
        idx = np.nonzero(np.abs(d) > thr)[0]
        lead = idx[0] * 1000 / sr
        tail = (len(d) - 1 - idx[-1]) * 1000 / sr
        rms = float(np.sqrt(np.mean(d[idx[0]:idx[-1] + 1] ** 2)))
        size = p.stat().st_size
        tot += size
        flag = ""
        if info.channels != 1:
            flag += " NOT-MONO"
        if abs(ms - v["ms"]) > 2:
            flag += f" MS-MISMATCH(manifest {v['ms']})"
            bad += 1
        print(f"{k:<26}{ms:>6.0f}{size:>7}{size * 8 / ms:>6.1f}{20 * np.log10(pk):>7.1f}{20 * np.log10(rms):>7.1f}{lead:>6.0f}{tail:>6.0f}{flag}")
    n = len(man["entries"])
    print(f"-- {n} 件 合計 {tot} B 平均 {tot / max(n, 1):.0f} B  sr={sr} Hz")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
