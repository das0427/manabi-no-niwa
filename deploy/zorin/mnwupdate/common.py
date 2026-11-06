# -*- coding: utf-8 -*-
"""共通部品: エラー・置き場（Layout）・時刻・JSON の読み書き・設定・片付け（設計 4 章・5.1 節）"""
from __future__ import annotations

import datetime
import errno
import json
import os
import re
import stat
import sys
import tempfile

APP_NAME = "manabi-no-niwa"
SCHEMA = 1
VERSION_PATTERN = r"[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,6}"
TEST_ORIGIN_ENV = "MANABI_UPDATE_TEST_ORIGIN"
PRODUCTION_PORT = 8765  # 本番の待ち受け。この port では試験用の取得先を受け付けない
_TEST_ORIGIN_RE = re.compile(r"http://127\.0\.0\.1:([0-9]{1,5})")
_VERSION_RE = re.compile(VERSION_PATTERN)


class UpdateError(Exception):
    """窓口・状態に出すエラー（code は設計 5.3 節の表）"""

    def __init__(self, code, detail="", need_bytes=None):
        super().__init__("%s: %s" % (code, detail))
        self.code = code
        self.detail = str(detail)[:300]
        self.need_bytes = need_bytes

    def to_dict(self):
        value = {"code": self.code, "detail": self.detail}
        if self.need_bytes is not None:
            value["needBytes"] = int(self.need_bytes)
        return value


class Cancelled(Exception):
    """保護者が中止を押した"""


def os_error_text(exc):
    """OSError を「errno の名前: 説明」にする（ファイルのパス・利用者の名前を画面や状態に出さない）"""
    code = getattr(exc, "errno", None)
    name = errno.errorcode.get(code, type(exc).__name__) if isinstance(code, int) else type(exc).__name__
    reason = getattr(exc, "strerror", None) or type(exc).__name__
    return "%s: %s" % (name, reason)


# ---- 時刻 -------------------------------------------------------------------


def iso_utc(timestamp=None):
    """ISO 8601 UTC（Z 付き、秒まで）"""
    if timestamp is None:
        moment = datetime.datetime.now(datetime.timezone.utc)
    else:
        moment = datetime.datetime.fromtimestamp(timestamp, datetime.timezone.utc)
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def log(message):
    """標準エラーに 1 行（合言葉は渡さないこと）。書けなくても止まらない"""
    line = "[更新] %s %s\n" % (iso_utc(), message)
    try:
        sys.stderr.write(line)
        sys.stderr.flush()
    except UnicodeEncodeError:
        try:
            sys.stderr.write(line.encode("ascii", "replace").decode("ascii"))
            sys.stderr.flush()
        except Exception:  # noqa: BLE001
            pass
    except Exception:  # noqa: BLE001
        pass


# ---- 版 ---------------------------------------------------------------------


def parse_version(text):
    """'2.10.0' -> (2, 10, 0)。X.Y.Z でなければ None"""
    if not isinstance(text, str) or not _VERSION_RE.fullmatch(text):
        return None
    return tuple(int(x) for x in text.split("."))


def compare_versions(a, b):
    """a > b なら 1、同じなら 0、a < b なら -1（どちらかが X.Y.Z でなければ ValueError）"""
    pa, pb = parse_version(a), parse_version(b)
    if pa is None or pb is None:
        raise ValueError("bad version")
    return (pa > pb) - (pa < pb)


# ---- JSON -------------------------------------------------------------------


def _reject_constant(name):
    raise ValueError("invalid JSON constant: %s" % name)


def strict_loads(text):
    """NaN・Infinity を受け付けない json.loads"""
    return json.loads(text, parse_constant=_reject_constant)


def read_json_file(path, limit=1 << 20):
    """大きさの上限つきで JSON を読む。失敗は OSError か ValueError"""
    with open(path, "rb") as f:
        data = f.read(limit + 1)
    if len(data) > limit:
        raise ValueError("file too large")
    return strict_loads(data.decode("utf-8"))


def fsync_dir(path):
    if os.name == "nt":
        return
    try:
        fd = os.open(path, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(fd)
    except OSError:
        pass
    finally:
        os.close(fd)


def write_json_atomic(path, value, fsync=False):
    """一時ファイルに書いて os.replace（途中で止まっても壊れた JSON を残さない）"""
    folder = os.path.dirname(path)
    os.makedirs(folder, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp-", suffix=".json", dir=folder)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(json.dumps(value, ensure_ascii=False, indent=2).encode("utf-8"))
            f.write(b"\n")
            f.flush()
            if fsync:
                os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    if fsync:
        fsync_dir(folder)


# ---- 試験用の取得先 ----------------------------------------------------------


def override_origin_from_env(env=None):
    """MANABI_UPDATE_TEST_ORIGIN。空・無しは None、正しい形は 'http://127.0.0.1:<port>'、違えば ValueError"""
    value = (os.environ if env is None else env).get(TEST_ORIGIN_ENV, "")
    if value == "":
        return None
    match = _TEST_ORIGIN_RE.fullmatch(value)
    if not match or not 1 <= int(match.group(1)) <= 65535:
        raise ValueError("bad %s" % TEST_ORIGIN_ENV)
    return "http://127.0.0.1:%d" % int(match.group(1))


# ---- 置き場 -----------------------------------------------------------------


def config_file_path(env=None):
    """${XDG_CONFIG_HOME:-~/.config}/manabi-no-niwa/updater.json"""
    env = os.environ if env is None else env
    home = env.get("XDG_CONFIG_HOME", "")
    if not home or not os.path.isabs(home):
        home = os.path.join(os.path.expanduser("~"), ".config")
    return os.path.join(home, APP_NAME, "updater.json")


class Layout:
    """<…>/manabi-no-niwa/ の下の決まった場所（設計 4 章）。書いてよいのはここと設定ファイルだけ"""

    def __init__(self, app, config_file):
        self.app = os.path.abspath(app)
        self.base = os.path.dirname(self.app)
        self.app_next = os.path.join(self.base, "app.next")
        self.app_prev = os.path.join(self.base, "app.prev")
        self.update_dir = os.path.join(self.base, "update")
        self.downloads = os.path.join(self.update_dir, "downloads")
        self.state_file = os.path.join(self.update_dir, "state.json")
        self.lock_file = os.path.join(self.update_dir, "lock")
        self.config_file = config_file
        self.dist = os.path.join(self.app, "dist")
        self.serve_py = os.path.join(self.app, "deploy", "zorin", "serve.py")


def read_main_version(app):
    """app/parts/main.json の version（X.Y.Z）。読めなければ None"""
    try:
        value = read_json_file(os.path.join(app, "parts", "main.json"), 1 << 16)
    except (OSError, ValueError):
        return None
    version = value.get("version") if isinstance(value, dict) else None
    return version if parse_version(version) else None


def detect_layout(serve_py, directory, dir_given, env=None, port=None):
    """更新の仕組みが動く条件（設計 5.1 節）。-> (Layout, None) か (None, 理由)。
    port が本番（8765）のときは、試験用の取得先（MANABI_UPDATE_TEST_ORIGIN）を受け付けない（bad-test-origin。
    環境に残っていても、同じパソコンのほかの利用者の偽の配布元へ向かないように）"""
    env = os.environ if env is None else env
    path = os.path.abspath(serve_py)
    here = os.path.dirname(path)
    deploy = os.path.dirname(here)
    app = os.path.dirname(deploy)
    base = os.path.dirname(app)
    names = [os.path.basename(x) for x in (path, here, deploy, app, base)]
    if names != ["serve.py", "zorin", "deploy", "app", APP_NAME]:
        return None, "not-installed"
    if dir_given and os.path.normcase(os.path.abspath(directory)) != os.path.normcase(
        os.path.join(app, "dist")
    ):
        return None, "custom-dir"
    if read_main_version(app) is None:
        return None, "no-parts"
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        return None, "root"
    try:
        origin = override_origin_from_env(env)
    except ValueError:
        return None, "bad-test-origin"
    if origin and port == PRODUCTION_PORT:
        return None, "bad-test-origin"
    return Layout(app, config_file_path(env)), None


# ---- 設定（自動の確認のオン・オフ） -------------------------------------------


def load_autocheck(config_file):
    """無い・壊れているときはオン"""
    try:
        value = read_json_file(config_file, 1 << 16)
    except (OSError, ValueError):
        return True
    flag = value.get("autoCheck") if isinstance(value, dict) else None
    return flag if isinstance(flag, bool) else True


def save_autocheck(config_file, flag):
    write_json_atomic(config_file, {"schema": SCHEMA, "autoCheck": bool(flag)})


# ---- 片付け -----------------------------------------------------------------


def remove_tree(path):
    """フォルダを消す。リンクはたどらない。なければ何もしない。消せないものがあっても止まらない"""
    try:
        mode = os.lstat(path).st_mode
    except OSError:
        return
    if not stat.S_ISDIR(mode):
        _unlink(path)
        return
    try:
        entries = list(os.scandir(path))
    except OSError:
        entries = []
    for entry in entries:
        try:
            is_dir = entry.is_dir(follow_symlinks=False)
        except OSError:
            is_dir = False
        if is_dir:
            remove_tree(entry.path)
        else:
            _unlink(entry.path)
    try:
        os.rmdir(path)
    except OSError:
        try:
            os.chmod(path, 0o755)
            os.rmdir(path)
        except OSError:
            pass


def _unlink(path):
    try:
        os.unlink(path)
    except OSError:
        try:
            os.chmod(path, 0o644)
            os.unlink(path)
        except OSError:
            pass


# ---- state.json の読み取り（設計 5.11 節） --------------------------------------

PHASES = (
    "idle",
    "downloading",
    "extracting",
    "testing",
    "switching",
    "restarting",
    "done",
    "failed",
    "cancelled",
)
CHECK_STATES = ("never", "checking", "ok", "offline", "error")


def clean_error(value):
    """{code, detail[, needBytes]} の形ならそのまま、違えば None"""
    if (
        isinstance(value, dict)
        and isinstance(value.get("code"), str)
        and isinstance(value.get("detail"), str)
    ):
        result = {"code": value["code"], "detail": value["detail"]}
        if isinstance(value.get("needBytes"), int):
            result["needBytes"] = value["needBytes"]
        return result
    return None


def clean_latest(value):
    """state.json の latest を確かめる。形が違えば None"""
    try:
        if not isinstance(value, dict) or parse_version(value["version"]) is None:
            return None
        blocked = value["blockedReason"]
        return {
            "version": value["version"],
            "date": str(value["date"]),
            "notes": [str(n) for n in value["notes"]],
            "newer": bool(value["newer"]),
            "installable": bool(value["installable"]),
            "blockedReason": blocked if blocked in (None, "min-version", "schema") else None,
            "downloadBytes": int(value["downloadBytes"]),
            "needBytes": int(value["needBytes"]),
            "parts": [
                {"kind": str(p["kind"]), "bytes": int(p["bytes"]), "changed": bool(p["changed"])}
                for p in value["parts"]
            ],
            "minVersion": value["minVersion"] if parse_version(value["minVersion"]) else None,
        }
    except (KeyError, TypeError, ValueError):
        return None


def load_state(path):
    """update/state.json を読んで、壊れた欄を取り除いた dict にする（読めなければ空の状態）"""
    try:
        raw = read_json_file(path)
    except (OSError, ValueError):
        raw = {}
    if not isinstance(raw, dict) or raw.get("schema") != SCHEMA:
        raw = {}

    def text(key):
        return raw.get(key) if isinstance(raw.get(key), str) else None

    check = raw.get("check")
    if isinstance(check, dict) and check.get("state") in CHECK_STATES:
        name = "never" if check["state"] == "checking" else check["state"]
        check = {
            "state": name,
            "at": check.get("at") if isinstance(check.get("at"), str) else None,
            "error": clean_error(check.get("error")),
        }
    else:
        check = {"state": "never", "at": None, "error": None}
    applied = raw.get("lastApplied")
    keys = ("version", "from", "at")
    if not (isinstance(applied, dict) and all(isinstance(applied.get(k), str) for k in keys)):
        applied = None
    count = raw.get("resumeCount")
    return {
        "phase": raw.get("phase") if raw.get("phase") in PHASES else "idle",
        "targetVersion": text("targetVersion"),
        "fromVersion": text("fromVersion"),
        "startedAt": text("startedAt"),
        "finishedAt": text("finishedAt"),
        "error": clean_error(raw.get("error")),
        "resumeCount": count if isinstance(count, int) and not isinstance(count, bool) else 0,
        "lastApplied": {k: applied[k] for k in keys} if applied else None,
        "check": check,
        "latest": clean_latest(raw.get("latest")),
    }
