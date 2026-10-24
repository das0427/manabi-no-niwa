#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""まなびのにわ 音声生成パイプライン

voice/script.json  ->  public/audio/<key>.mp3 + public/audio/manifest.json

  {"version":1,
   "defaults": {"speed":0.85, "half_tone":2.0},        # 任意。CLI > script.defaults > 組み込み既定
   "entries":[{"key":"item.ringo","text":"りんご","speed":1.0,"yomi":"りんご"}]}

- entry.speed は「基準話速に掛ける倍率」(1.0 = 基準のまま)。
- entry.yomi があればそれを合成(text は表示用/ハッシュ対象外ではなく両方記録)。
- entry.half_tone / entry.voice_scale で個別の音高オフセット(半音)・声道スケール(任意)。
- 差分生成: hash(合成文+パラメータ+パイプライン版)が変わったもの/無いものだけ再生成。
- script から消えたキーの mp3 は(前回 manifest にあったものに限り)削除。

使い方:  python generate.py [--script ..] [--out ..] [--voice ..] [--force] [--fetch-voice]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
PIPELINE_VERSION = 1  # 後処理(トリム/正規化/エンコード)を変えたら上げる -> 全再生成

KEY_RE = re.compile(r"^[a-z0-9._-]+$")

# ---- 既定パラメータ(4歳児向け: ゆっくり・やや高め) -------------------------
BUILTIN_DEFAULTS = {
    "speed": 0.85,        # 基準話速(1.0=標準, 小さいほど遅い)
    "half_tone": 1.0,     # 音高オフセット(半音)。Mei は元々高め(基本F0≈345Hz)なので控えめ
    "voice_scale": 1.0,   # 声道スケール(>1 で声が小さく=子供っぽく)。リサンプルで実現。音高・話速は保たれる
}
TARGET_SR = 24000          # 出力サンプリングレート(Hz)。48000/整数 であること
MP3_BITRATE_KBPS = 48      # おおよその目標。CBR
TARGET_RMS_DBFS = -18.0    # 有音部の RMS 目標
PEAK_LIMIT_DBFS = -1.0     # ピーク上限
SILENCE_THRESH_DB = -45.0  # ピーク基準でこれ未満は無音扱い(トリム判定)
KEEP_MS = 50               # 先頭/末尾に残す無音

VOICE_URL = ("https://sourceforge.net/projects/mmdagent/files/MMDAgent_Example/"
             "MMDAgent_Example-1.8/MMDAgent_Example-1.8.zip/download")
VOICE_ZIP_MEMBER = "MMDAgent_Example-1.8/Voice/mei/mei_normal.htsvoice"
DEFAULT_VOICE = ROOT / ".cache" / "mmdagent" / "mei_normal.htsvoice"
VOICE_LABEL = "mei_normal (MMDAgent Mei, CC BY 3.0 Nagoya Institute of Technology) via Open JTalk (pyopenjtalk-plus)"


def log(*a):
    print(*a, flush=True)


def fetch_voice(dest: Path) -> None:
    """MMDAgent_Example 公式配布 zip(約30MB)から mei_normal.htsvoice を取り出す。"""
    dest.parent.mkdir(parents=True, exist_ok=True)
    zpath = dest.parent / "MMDAgent_Example-1.8.zip"
    if not zpath.exists():
        log(f"[voice] ダウンロード: {VOICE_URL}")
        req = urllib.request.Request(VOICE_URL, headers={"User-Agent": "manabi-no-niwa-asset-pipeline"})
        with urllib.request.urlopen(req) as r, open(zpath, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
    with zipfile.ZipFile(zpath) as z:
        with z.open(VOICE_ZIP_MEMBER) as src, open(dest, "wb") as out:
            out.write(src.read())
        lic = dest.parent / "COPYRIGHT-mei.txt"
        with z.open("MMDAgent_Example-1.8/Voice/mei/COPYRIGHT.txt") as src, open(lic, "wb") as out:
            out.write(src.read())
    log(f"[voice] 取得完了: {dest}")


# ---- 音声処理 --------------------------------------------------------------
def lowpass_decimate(x: np.ndarray, factor: int) -> np.ndarray:
    """窓付き sinc FIR で LPF してから factor 分の1に間引く(numpy のみ)。"""
    if factor == 1:
        return x
    taps = 16 * factor * 2 + 1
    n = np.arange(taps) - (taps - 1) / 2
    fc = 0.5 / factor * 0.92  # 正規化遮断(ナイキストの92%)
    h = np.sinc(2 * fc * n) * np.blackman(taps)
    h /= h.sum()
    y = np.convolve(x, h, mode="same")
    return y[::factor]


def trim_and_normalize(x: np.ndarray, sr: int) -> np.ndarray:
    """x: float (-1..1)。先頭末尾の無音を KEEP_MS まで詰め、RMS 正規化+ピーク制限。"""
    peak = float(np.max(np.abs(x))) if x.size else 0.0
    if peak < 1e-6:
        return np.zeros(int(sr * KEEP_MS * 2 / 1000), dtype=np.float32)
    thr = peak * 10 ** (SILENCE_THRESH_DB / 20)
    idx = np.nonzero(np.abs(x) > thr)[0]
    start, end = int(idx[0]), int(idx[-1]) + 1
    keep = int(sr * KEEP_MS / 1000)
    pad_l = np.zeros(max(0, keep - start), dtype=x.dtype)
    pad_r = np.zeros(max(0, keep - (len(x) - end)), dtype=x.dtype)
    seg = x[max(0, start - keep): min(len(x), end + keep)]
    seg = np.concatenate([pad_l, seg, pad_r])
    # RMS(有音部のみ)を目標へ。ピークが -1dBFS を超えない範囲で。
    active = x[start:end]
    rms = float(np.sqrt(np.mean(active ** 2)))
    gain = 10 ** (TARGET_RMS_DBFS / 20) / max(rms, 1e-9)
    pk = float(np.max(np.abs(seg)))
    gain = min(gain, 10 ** (PEAK_LIMIT_DBFS / 20) / pk)
    return (seg * gain).astype(np.float32)


class Synth:
    def __init__(self, voice_path: Path):
        import pyopenjtalk
        self.pj = pyopenjtalk
        if not voice_path.exists():
            raise FileNotFoundError(f"htsvoice が無い: {voice_path}  (--fetch-voice で取得)")
        self.engine = pyopenjtalk.HTSEngine(str(voice_path).replace("\\", "/").encode("utf-8"))
        self.voice_sr = self.engine.get_sampling_frequency()
        if self.voice_sr % TARGET_SR != 0:
            raise RuntimeError(f"voice sr {self.voice_sr} が TARGET_SR {TARGET_SR} の整数倍でない")

    def render(self, text: str, speed: float, half_tone: float, scale: float = 1.0) -> np.ndarray:
        labels = self.pj.extract_fullcontext(text)
        # scale>1: 後段で scale 倍速で再生(=リサンプル)するので、話速と音高をあらかじめ補正しておく
        speed = speed / scale
        half_tone = half_tone - 12.0 * float(np.log2(scale))
        self.engine.set_speed(speed)
        # add_half_tone は累積ではなく「絶対値の設定」(実測確認: 3,3,3 で 410Hz 固定, 0 で元に戻る)
        self.engine.add_half_tone(half_tone)
        wav = self.engine.synthesize(labels)
        x = np.asarray(wav, dtype=np.float64) / 32768.0
        if scale != 1.0:
            n_out = int(len(x) / scale)
            x = np.interp(np.arange(n_out) * scale, np.arange(len(x)), x)
        return x


def encode_mp3(path: Path, x: np.ndarray, sr: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # libsndfile の compression_level: 0.0(高品質/大) .. <1.0(小)。CBR では離散ビットレートに対応する。
    with sf.SoundFile(str(path), "w", samplerate=sr, channels=1, format="MP3", subtype="MPEG_LAYER_III",
                      bitrate_mode="CONSTANT", compression_level=CBR_LEVEL) as f:
        f.write(x)


CBR_LEVEL = 0.75  # main() で calibrate_cbr により MP3_BITRATE_KBPS 近傍へ校正される
ENC_DELAY = 1105  # エンコーダ遅延(サンプル)。calibrate_cbr で実測して上書き


def measure_encoder_delay(sr: int) -> int:
    """短いバーストをエンコード→デコードし、先頭へ入る遅延サンプル数を相互相関で実測する。"""
    import tempfile
    rng = np.random.default_rng(1)
    sig = np.zeros(sr, dtype=np.float32)
    sig[sr // 4: sr // 4 + 2400] = (rng.standard_normal(2400) * 0.2).astype(np.float32)
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "d.mp3"
        encode_mp3(p, sig, sr)
        d, _ = sf.read(str(p), dtype="float32")
    n = min(len(d), len(sig))
    c = np.correlate(d[:n], sig[:n], "full")
    return max(0, int(np.argmax(c)) - (n - 1))


def calibrate_cbr(target_kbps: int, sr: int) -> float:
    """ホワイトノイズ 2 秒を各 level でエンコードし target に最も近い level を返す。"""
    import tempfile
    rng = np.random.default_rng(0)
    noise = (rng.standard_normal(sr * 2) * 0.1).astype(np.float32)
    best, best_err = 0.8, 1e9
    with tempfile.TemporaryDirectory() as td:
        for lv in [i / 20 for i in range(0, 20)]:
            p = Path(td) / "t.mp3"
            try:
                with sf.SoundFile(str(p), "w", samplerate=sr, channels=1, format="MP3", subtype="MPEG_LAYER_III",
                                  bitrate_mode="CONSTANT", compression_level=lv) as f:
                    f.write(noise)
            except Exception:
                continue
            kbps = p.stat().st_size * 8 / 2 / 1000
            err = abs(kbps - target_kbps)
            if err < best_err:
                best, best_err = lv, err
    return best


# ---- script / manifest ------------------------------------------------------
def load_script(path: Path) -> tuple[list[dict], dict]:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if data.get("version") != 1:
        raise ValueError("script.json: version は 1 のみ対応")
    entries = data.get("entries")
    if not isinstance(entries, list):
        raise ValueError("script.json: entries が配列でない")
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


def entry_params(e: dict, defaults: dict) -> tuple[str, float, float, float]:
    base = float(defaults.get("speed", BUILTIN_DEFAULTS["speed"]))
    speed = round(base * float(e.get("speed", 1.0)), 4)
    ht = float(e.get("half_tone", defaults.get("half_tone", BUILTIN_DEFAULTS["half_tone"])))
    scale = float(e.get("voice_scale", defaults.get("voice_scale", BUILTIN_DEFAULTS["voice_scale"])))
    spoken = e.get("yomi") or e["text"]
    return spoken, speed, ht, scale


def entry_hash(spoken: str, speed: float, ht: float, scale: float, voice_id: str) -> str:
    payload = json.dumps(
        {"t": spoken, "s": speed, "h": ht, "c": scale, "v": voice_id, "p": PIPELINE_VERSION,
         "sr": TARGET_SR, "kbps": MP3_BITRATE_KBPS},
        ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()[:12]


def main() -> int:
    global CBR_LEVEL, ENC_DELAY
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser(description="まなびのにわ 音声生成")
    ap.add_argument("--script", type=Path, default=ROOT / "voice" / "script.json")
    ap.add_argument("--out", type=Path, default=ROOT / "public" / "audio")
    ap.add_argument("--voice", type=Path, default=DEFAULT_VOICE, help="htsvoice ファイル")
    ap.add_argument("--speed", type=float, default=None, help="基準話速(script.defaults を上書き)")
    ap.add_argument("--half-tone", type=float, default=None, help="音高オフセット(半音)")
    ap.add_argument("--voice-scale", type=float, default=None, help="声道スケール(1.0=そのまま, 1.1 前後で子供っぽく)")
    ap.add_argument("--force", action="store_true", help="hash に関係なく全再生成")
    ap.add_argument("--fetch-voice", action="store_true", help="voice が無ければ公式配布から取得")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    if not a.voice.exists():
        if a.fetch_voice or a.voice == DEFAULT_VOICE:
            fetch_voice(a.voice)
        else:
            log(f"htsvoice が見つかりません: {a.voice}")
            return 2

    entries, defaults = load_script(a.script)
    defaults = dict(defaults)
    if a.speed is not None:
        defaults["speed"] = a.speed
    if a.half_tone is not None:
        defaults["half_tone"] = a.half_tone
    if a.voice_scale is not None:
        defaults["voice_scale"] = a.voice_scale

    out: Path = a.out
    out.mkdir(parents=True, exist_ok=True)
    mpath = out / "manifest.json"
    old = {}
    if mpath.exists():
        try:
            old = json.loads(mpath.read_text(encoding="utf-8-sig")).get("entries", {})
        except Exception:
            old = {}

    voice_id = f"{a.voice.name}:{a.voice.stat().st_size}"
    new_manifest: dict[str, dict] = {}
    todo = []
    for e in entries:
        spoken, speed, ht, scale = entry_params(e, defaults)
        h = entry_hash(spoken, speed, ht, scale, voice_id)
        o = old.get(e["key"])
        f = out / f"{e['key']}.mp3"
        if not a.force and o and o.get("hash") == h and f.exists():
            new_manifest[e["key"]] = o
        else:
            todo.append((e, spoken, speed, ht, scale, h))

    removed = [k for k in old if k not in {e["key"] for e in entries}]
    log(f"[voice] 全 {len(entries)} 件 / 生成 {len(todo)} 件 / 再利用 {len(entries) - len(todo)} 件 / 削除 {len(removed)} 件")
    if a.dry_run:
        return 0

    for k in removed:
        p = out / old[k].get("file", f"{k}.mp3")
        if p.exists():
            p.unlink()
            log(f"[voice] 削除: {p.name}")

    if todo:
        CBR_LEVEL = calibrate_cbr(MP3_BITRATE_KBPS, TARGET_SR)
        ENC_DELAY = measure_encoder_delay(TARGET_SR)
        log(f"[voice] mp3 CBR level={CBR_LEVEL} encoder_delay={ENC_DELAY} samples ({ENC_DELAY * 1000 / TARGET_SR:.0f}ms)")
        synth = Synth(a.voice)
        factor = synth.voice_sr // TARGET_SR
        t0 = time.time()
        total_bytes = 0
        for i, (e, spoken, speed, ht, scale, h) in enumerate(todo, 1):
            x = synth.render(spoken, speed, ht, scale)
            x = lowpass_decimate(x, factor)
            x = trim_and_normalize(x, TARGET_SR)
            # エンコーダ遅延ぶん先頭の(無音の)パディングを削り、デコード後の先頭無音が約 KEEP_MS になるようにする
            x = x[min(ENC_DELAY, int(TARGET_SR * KEEP_MS / 1000) - 100):]
            f = out / f"{e['key']}.mp3"
            encode_mp3(f, x, TARGET_SR)
            # ms はデコード後の実長(ヘッダ無し CBR mp3 では最終フレーム境界までのパディングを含む)
            ms = int(round(sf.info(str(f)).frames * 1000 / TARGET_SR))
            total_bytes += f.stat().st_size
            new_manifest[e["key"]] = {"file": f.name, "hash": h, "ms": ms}
            log(f"[voice] ({i}/{len(todo)}) {e['key']:<24} {ms:>5}ms {f.stat().st_size:>6}B  {spoken}")
        dt = time.time() - t0
        log(f"[voice] 生成 {len(todo)} 件 {dt:.1f}s ({dt / len(todo):.2f}s/件) 平均 {total_bytes / len(todo):.0f}B/件")

    ordered = {e["key"]: new_manifest[e["key"]] for e in entries}
    manifest = {"version": 1, "voice": VOICE_LABEL, "entries": ordered}
    mpath.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    log(f"[voice] manifest: {mpath}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
