#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""まなびのにわ 英語音声生成パイプライン (Kokoro-82M / ONNX, オフライン)

voice/script-en.json  ->  public/audio/en/<key>.mp3 + public/audio/en/manifest.json

  {"version":1,
   "defaults": {"speed":0.85, "voice":"af_heart"},        # 任意。CLI > entry > script.defaults > 組み込み既定
   "entries":[{"key":"en.word.apple","text":"apple","speed":1.0}]}

- entry.speed は「基準話速に掛ける倍率」(1.0 = 基準のまま)。基準話速は既定 0.85(やや遅め。Kokoro の speed は 0.5〜2.0)。
- entry.say があればそれを合成(text は表示用。読み誤り対策。日本語側の yomi と同じ役割)。
- entry.phonemes があれば IPA 音素列をそのまま合成(say/text より優先。espeak-ng 風の IPA: 例 "ˈæpəl")。
- entry.voice で個別に声を変更できる(例 "af_bella")。一貫性のため通常は使わない。
- 後処理(無音トリム/RMS 正規化/mp3 エンコード)は日本語パイプライン generate.py と共通(関数を import して使う)。
- 差分生成: hash(合成文+パラメータ+モデル+パイプライン版)が変わったもの/無いものだけ再生成。
- script から消えたキーの mp3 は(前回 manifest にあったものに限り)削除。

使い方:  python generate_en.py [--script ..] [--out ..] [--voice af_heart] [--speed 0.85] [--force] [--dry-run]
モデル(kokoro-v1.0.onnx 約 310MiB / voices-v1.0.bin 約 27MiB)は初回に .cache/kokoro-en/ へ取得し SHA-256 を検証する。
生成物の mp3 だけをアプリに同梱する(モデルや espeak-ng は同梱しない)。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # `python -I` は script ディレクトリを sys.path に入れないので明示する
import generate as jp  # noqa: E402  日本語パイプライン(後処理・エンコード・定数を共有)

ROOT = jp.ROOT
EN_PIPELINE_VERSION = 1  # 英語固有の処理を変えたら上げる -> 英語音声を全再生成

KEY_RE = jp.KEY_RE

BUILTIN_DEFAULTS = {
    "speed": 0.85,          # 基準話速(1.0=標準)。子供向けに少し遅め
    "voice": "af_heart",    # American English, 女声, Kokoro 公式の最高評価(A)の声
    "lang": "en-us",        # espeak-ng の言語コード。米音声(af_/am_)には en-us、英音声(bf_/bm_)には en-gb
}

MODEL_DIR = ROOT / ".cache" / "kokoro-en"
MODEL_TAG = "model-files-v1.1"
_REL = f"https://github.com/thewh1teagle/kokoro-onnx/releases/download/{MODEL_TAG}"
MODEL_FILES = {
    "kokoro-v1.0.onnx": (f"{_REL}/kokoro-v1.0.onnx", 325505369,
                         "beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a"),
    "voices-v1.0.bin": (f"{_REL}/voices-v1.0.bin", 28214398,
                        "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d"),
}
MODEL_LABEL = ("Kokoro-82M v1.0 (hexgrad, Apache-2.0) via kokoro-onnx (MIT) / ONNX Runtime; "
               "phonemes by espeak-ng")


def log(*a):
    print(*a, flush=True)


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_model(model_dir: Path) -> tuple[Path, Path]:
    model_dir.mkdir(parents=True, exist_ok=True)
    for name, (url, size, sha) in MODEL_FILES.items():
        p = model_dir / name
        if p.exists() and p.stat().st_size == size and sha256_file(p) == sha:
            continue
        log(f"[voice-en] ダウンロード: {url} ({size / 1048576:.0f} MiB)")
        tmp = p.with_suffix(p.suffix + ".part")
        req = urllib.request.Request(url, headers={"User-Agent": "manabi-no-niwa-asset-pipeline"})
        with urllib.request.urlopen(req) as r, open(tmp, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        if sha256_file(tmp) != sha:
            tmp.unlink()
            raise RuntimeError(f"SHA-256 が一致しません: {name} (取得元が変わった可能性)")
        tmp.replace(p)
    return model_dir / "kokoro-v1.0.onnx", model_dir / "voices-v1.0.bin"


def load_script(path: Path) -> tuple[list[dict], dict]:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if data.get("version") != 1:
        raise ValueError("script-en.json: version は 1 のみ対応")
    entries = data.get("entries")
    if not isinstance(entries, list):
        raise ValueError("script-en.json: entries が配列でない")
    seen = set()
    for e in entries:
        k = e.get("key")
        if not isinstance(k, str) or not KEY_RE.match(k) or ".." in k:
            raise ValueError(f"不正な key: {k!r}")
        if k in seen:
            raise ValueError(f"key 重複: {k}")
        seen.add(k)
        if not isinstance(e.get("text"), str) or not e["text"].strip():
            raise ValueError(f"{k}: text が空")
    return entries, data.get("defaults", {})


def entry_params(e: dict, defaults: dict) -> dict:
    base = float(defaults.get("speed", BUILTIN_DEFAULTS["speed"]))
    speed = round(base * float(e.get("speed", 1.0)), 4)
    if not 0.5 <= speed <= 2.0:
        raise ValueError(f"{e['key']}: 実効話速 {speed} が 0.5〜2.0 の範囲外")
    return {
        "spoken": e.get("say") or e["text"],
        "phonemes": e.get("phonemes") or None,
        "speed": speed,
        "voice": e.get("voice") or defaults.get("voice", BUILTIN_DEFAULTS["voice"]),
        "lang": e.get("lang") or defaults.get("lang", BUILTIN_DEFAULTS["lang"]),
    }


def entry_hash(p: dict, model_id: str) -> str:
    payload = json.dumps(
        {"t": p["spoken"], "ph": p["phonemes"], "s": p["speed"], "v": p["voice"], "l": p["lang"],
         "m": model_id, "p": jp.PIPELINE_VERSION, "ep": EN_PIPELINE_VERSION,
         "sr": jp.TARGET_SR, "kbps": jp.MP3_BITRATE_KBPS},
        ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()[:12]


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser(description="まなびのにわ 英語音声生成 (Kokoro-82M)")
    ap.add_argument("--script", type=Path, default=ROOT / "voice" / "script-en.json")
    ap.add_argument("--out", type=Path, default=ROOT / "public" / "audio" / "en")
    ap.add_argument("--model-dir", type=Path, default=MODEL_DIR, help="kokoro-v1.0.onnx / voices-v1.0.bin の置き場")
    ap.add_argument("--voice", default=None, help="Kokoro の声名(既定 af_heart。script.defaults を上書き)")
    ap.add_argument("--speed", type=float, default=None, help="基準話速(既定 0.85。script.defaults を上書き)")
    ap.add_argument("--force", action="store_true", help="hash に関係なく全再生成")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    entries, defaults = load_script(a.script)
    defaults = dict(defaults)
    if a.speed is not None:
        defaults["speed"] = a.speed
    if a.voice is not None:
        defaults["voice"] = a.voice

    out: Path = a.out
    out.mkdir(parents=True, exist_ok=True)
    mpath = out / "manifest.json"
    old = {}
    if mpath.exists():
        try:
            old = json.loads(mpath.read_text(encoding="utf-8-sig")).get("entries", {})
        except Exception:
            old = {}

    # モデル同定子(ファイル名+サイズ。SHA-256 は取得時に検証済み)
    model_id = "kokoro-v1.0.onnx:%d+voices-v1.0.bin:%d" % (MODEL_FILES["kokoro-v1.0.onnx"][1],
                                                          MODEL_FILES["voices-v1.0.bin"][1])
    new_manifest: dict[str, dict] = {}
    todo = []
    for e in entries:
        p = entry_params(e, defaults)
        h = entry_hash(p, model_id)
        o = old.get(e["key"])
        f = out / f"{e['key']}.mp3"
        if not a.force and o and o.get("hash") == h and f.exists():
            new_manifest[e["key"]] = o
        else:
            todo.append((e, p, h))

    removed = [k for k in old if k not in {e["key"] for e in entries}]
    log(f"[voice-en] 全 {len(entries)} 件 / 生成 {len(todo)} 件 / 再利用 {len(entries) - len(todo)} 件 / 削除 {len(removed)} 件")
    if a.dry_run:
        return 0

    for k in removed:
        pth = out / old[k].get("file", f"{k}.mp3")
        if pth.exists():
            pth.unlink()
            log(f"[voice-en] 削除: {pth.name}")

    if todo:
        model_path, voices_path = ensure_model(a.model_dir)
        from kokoro_onnx import Kokoro  # 遅延 import(--dry-run で onnxruntime を読まない)
        jp.CBR_LEVEL = jp.calibrate_cbr(jp.MP3_BITRATE_KBPS, jp.TARGET_SR)
        jp.ENC_DELAY = jp.measure_encoder_delay(jp.TARGET_SR)
        log(f"[voice-en] mp3 CBR level={jp.CBR_LEVEL} encoder_delay={jp.ENC_DELAY} samples "
            f"({jp.ENC_DELAY * 1000 / jp.TARGET_SR:.0f}ms)")
        kokoro = Kokoro(str(model_path), str(voices_path))
        t0 = time.time()
        total_bytes = 0
        for i, (e, p, h) in enumerate(todo, 1):
            if p["voice"] not in kokoro.voices:
                raise ValueError(f"{e['key']}: 声 {p['voice']!r} が voices-v1.0.bin に無い")
            if p["phonemes"]:
                x, sr = kokoro.create(p["phonemes"], p["voice"], speed=p["speed"], is_phonemes=True, trim=True)
            else:
                x, sr = kokoro.create(p["spoken"], p["voice"], speed=p["speed"], lang=p["lang"], trim=True)
            if sr != jp.TARGET_SR:
                raise RuntimeError(f"Kokoro の出力 SR {sr} が TARGET_SR {jp.TARGET_SR} と異なる(リサンプル未対応)")
            x = np.asarray(x, dtype=np.float64)
            x = jp.trim_and_normalize(x, jp.TARGET_SR)
            # エンコーダ遅延ぶん先頭の(無音の)パディングを削る(日本語側と同じ)
            x = x[min(jp.ENC_DELAY, int(jp.TARGET_SR * jp.KEEP_MS / 1000) - 100):]
            f = out / f"{e['key']}.mp3"
            jp.encode_mp3(f, x, jp.TARGET_SR)
            ms = int(round(sf.info(str(f)).frames * 1000 / jp.TARGET_SR))
            total_bytes += f.stat().st_size
            new_manifest[e["key"]] = {"file": f.name, "hash": h, "ms": ms}
            shown = p["phonemes"] or p["spoken"]
            log(f"[voice-en] ({i}/{len(todo)}) {e['key']:<28} {ms:>5}ms {f.stat().st_size:>6}B  {shown}")
        dt = time.time() - t0
        log(f"[voice-en] 生成 {len(todo)} 件 {dt:.1f}s ({dt / len(todo):.2f}s/件) 平均 {total_bytes / len(todo):.0f}B/件")

    ordered = {e["key"]: new_manifest[e["key"]] for e in entries}
    voice_name = defaults.get("voice", BUILTIN_DEFAULTS["voice"])
    manifest = {"version": 1, "lang": "en-US", "voice": f"{MODEL_LABEL}; voice={voice_name}", "entries": ordered}
    mpath.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    log(f"[voice-en] manifest: {mpath}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
