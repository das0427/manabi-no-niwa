#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""声のパラメータ比較用サンプルを scripts/voice/samples/ に書き出す(後で丸ごと削除してよい)。
ファイル名: <phrase>__s<speed>_h<half_tone>_c<voice_scale>.mp3  と  index.txt(一覧)"""
import itertools
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import generate as g  # noqa: E402

PHRASES = {
    "a": "りんご、ぜんぶで、さんこ。",
    "b": "すごいね、ひとつずつ かぞえられたね。",
}
SPEEDS = [1.0, 0.85, 0.7]
HALF_TONES = [0.0, 2.0, 4.0]
SCALES = [1.0, 1.12]


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    if not g.DEFAULT_VOICE.exists():
        g.fetch_voice(g.DEFAULT_VOICE)
    out = HERE / "samples"
    out.mkdir(exist_ok=True)
    g.CBR_LEVEL = g.calibrate_cbr(g.MP3_BITRATE_KBPS, g.TARGET_SR)
    g.ENC_DELAY = g.measure_encoder_delay(g.TARGET_SR)
    synth = g.Synth(g.DEFAULT_VOICE)
    factor = synth.voice_sr // g.TARGET_SR
    lines = []
    for (pk, text), s, h, c in itertools.product(PHRASES.items(), SPEEDS, HALF_TONES, SCALES):
        x = synth.render(text, s, h, c)
        x = g.trim_and_normalize(g.lowpass_decimate(x, factor), g.TARGET_SR)
        x = x[min(g.ENC_DELAY, int(g.TARGET_SR * g.KEEP_MS / 1000) - 100):]
        name = f"{pk}__s{s}_h{h:g}_c{c}.mp3"
        g.encode_mp3(out / name, x, g.TARGET_SR)
        lines.append(f"{name}\t{text}")
    (out / "index.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{len(lines)} files -> {out}")


if __name__ == "__main__":
    main()
