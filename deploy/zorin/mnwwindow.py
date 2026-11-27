#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""まなびのにわ 窓の補助（起動中の窓を前に出して全画面にする。manabi.sh から呼ばれる）

使い方: python3 -I -B mnwwindow.py [--log FILE] <コマンド> [引数]

  focus [--deadline 2.5]     アプリの窓を探して前面化＋全画面にし、前に出たことを確かめる
  wait [--timeout 5]         アプリの窓が現れるまで待つ（何も送らない）
  ozone-flag <ブラウザ>      --ozone-platform=x11 を付けるべきなら、それだけを1行出す
focus と wait には --browser chromium|firefox|other も付けられる（manabi.sh が使うブラウザの種類。chromium では Firefox の窓を探さない。省略は other）。

終了コード: 0 = 成功（focus は前に出た）／1 = 予想外の失敗／2 = 使い方の誤り／3 = 窓が無い（wait は時間切れ）／
           4 = 窓はあるが期限内に前に出なかった／5 = X11 が使えない（DISPLAY が空・libX11.so.6 が読めない・接続できない）
ozone-flag は決まった結果ならいつも 0（引数が無いときだけ 2）。10 秒で必ず終わる（時間切れは終了コード 1・出力なし）。

守ること: 標準ライブラリと ctypes（libX11）だけ。外へ通信しない。X11 のメッセージは、判定でアプリの窓と決めた窓にだけ送る。
ほかの窓の題名は判定に（アプリらしい class の窓だけ）読み、記録にも出力にも出さない。
Python 3.10 で動く書き方（match 文・datetime.UTC を使わない）。設計: docs/expansion/single-instance-design.md 2.1 節。
"""
import argparse
import ctypes as C
import faulthandler
import json
import os
import posixpath
import re
import signal
import stat
import subprocess
import sys
import tempfile
import time
from collections import namedtuple
from datetime import datetime

APP_TITLE = "まなびのにわ"
STRONG_RES_NAME = "127.0.0.1"  # Chromium 系 --app=http://127.0.0.1:8765/ の窓の WM_CLASS res_name
# 弱い一致に使う res_class。Firefox はタブの窓（題名の末尾にブラウザ名が付く）。Chromium 系は manabi.sh が必ず --app で開くので、
# 末尾が付かない（アプリ窓の）題名だけを弱い一致にする（res_name の付き方が実機で違っていたときの保険）。--browser chromium では Firefox を外す
FIREFOX_CLASSES = frozenset(("firefox", "firefox-esr"))
CHROMIUM_CLASSES = frozenset(("brave-browser", "chromium", "chromium-browser", "google-chrome"))
WEAK_CLASSES = FIREFOX_CLASSES | CHROMIUM_CLASSES
_SUFFIX = re.compile(r"\s[—–-]\s(Mozilla Firefox|Firefox|Brave|Chromium|Google Chrome)$")
# (開始からの秒, 送る時刻の種類)。server = いまのサーバー時刻、zero = 0（CurrentTime）
SCHEDULE = ((0.0, "server"), (0.5, "zero"), (1.2, "server"), (1.9, "zero"))
POLL = 0.1
ALARM_SECONDS = 10
LOG_MAX_LINES = 200
LOG_READ_MAX = 1 << 20  # 記録を読む量の上限（末尾の 1 MiB）
LOG_KEYS = ("t", "cmd", "session", "result", "window", "class", "match", "fullscreen",
            "attempts", "ms", "browser", "flag", "reason", "error")
OZONE_X11 = "--ozone-platform=x11"
BROWSER_KINDS = ("chromium", "firefox", "other")  # --browser の値。manabi.sh が使うブラウザの種類
EXIT_OK, EXIT_ERROR, EXIT_USAGE, EXIT_NO_WINDOW, EXIT_NOT_FRONT, EXIT_NO_X11 = 0, 1, 2, 3, 4, 5

Found = namedtuple("Found", "window res_class match")


# ---------------------------------------------------------------- 判定（X に触れない）
def base_title(title):
    """題名の末尾のブラウザ名を1回だけ取り除く"""
    return _SUFFIX.sub("", title, count=1)


def class_kind(res_name, res_class, browser="other"):
    if res_name == STRONG_RES_NAME:
        return "strong"
    weak = CHROMIUM_CLASSES if browser == "chromium" else WEAK_CLASSES  # chromium のときは Firefox の窓を候補にしない
    return "weak" if res_class.lower() in weak else None


def title_matches(kind, res_class, title):
    """題名がアプリのものか。強い一致と Firefox は末尾のブラウザ名を取り除いて比べる。Chromium 系の弱い一致はちょうど一致だけ"""
    if kind == "strong" or res_class.lower() in FIREFOX_CLASSES:
        return base_title(title) == APP_TITLE
    return title == APP_TITLE


def classify(res_name, res_class, title, browser="other"):
    """-> 'strong' / 'weak' / None（アプリの窓ではない）"""
    kind = class_kind(res_name, res_class, browser)
    return kind if kind and title_matches(kind, res_class, title) else None


def find_app_window(be, browser="other"):
    """重なり順でいちばん上の強い一致、無ければ弱い一致。-> Found か None（class がアプリらしくない窓の題名は読まない）"""
    weak = None
    for w in reversed(be.windows()):  # windows() は下から上の順
        res_name, res_class = be.wm_class(w)
        kind = class_kind(res_name, res_class, browser)
        if kind is None or not title_matches(kind, res_class, be.title(w)):
            continue
        if kind == "strong":
            return Found(w, res_class, kind)
        if weak is None:
            weak = Found(w, res_class, kind)
    return weak


class RealClock:
    now = staticmethod(time.monotonic)
    sleep = staticmethod(time.sleep)


def _found_info(f):
    return {"window": "0x%x" % f.window, "class": f.res_class, "match": f.match}


def _settle_fullscreen(be, clock, w):
    """全画面になっているか。なっていなければ全画面だけを1回送り直し、最大 0.5 秒待つ"""
    if be.is_fullscreen(w):
        return True
    be.fullscreen(w)
    be.sync()
    for _ in range(5):
        clock.sleep(POLL)
        if be.is_fullscreen(w):
            return True
    return False


def run_focus(be, clock, deadline=2.5, schedule=SCHEDULE, browser="other"):
    """前面化＋全画面を送り、前に出たことを確かめる（途中で窓が消えたら選び直す）。-> (終了コード, 記録の項目)"""
    t0 = clock.now()
    info = {"attempts": 0}
    target, sent, idx, base = None, False, 0, 0.0
    while True:
        el = clock.now() - t0
        info["ms"] = int(el * 1000)
        found = find_app_window(be, browser)
        if found is None:
            return EXIT_NO_WINDOW, info
        if found.window != target:  # 最初、または選び直したとき。やり直しの予定も最初から
            target, sent, idx, base = found.window, False, 0, el
            info.update(_found_info(found))
        elif sent and be.active() == target:
            info["fullscreen"] = _settle_fullscreen(be, clock, target)
            info["ms"] = int((clock.now() - t0) * 1000)
            return EXIT_OK, info
        if idx < len(schedule) and el - base + 1e-9 >= schedule[idx][0]:
            be.activate(target, be.server_time() if schedule[idx][1] == "server" else 0)
            be.fullscreen(target)
            be.sync()
            info["attempts"] += 1
            sent, idx = True, idx + 1
        if el + 1e-9 >= deadline:
            return EXIT_NOT_FRONT, info
        clock.sleep(POLL)


def run_wait(be, clock, timeout=5.0, browser="other"):
    """アプリの窓が現れるまで 0.1 秒ごとに探す（何も送らない）"""
    t0 = clock.now()
    while True:
        found = find_app_window(be, browser)
        ms = int((clock.now() - t0) * 1000)
        if found:
            return EXIT_OK, dict(_found_info(found), ms=ms)
        if ms >= timeout * 1000:
            return EXIT_NO_WINDOW, {"ms": ms}
        clock.sleep(POLL)


# ---------------------------------------------------------------- ozone-flag
def is_chromium_family(cmd):
    """manabi.sh の is_chromium_family と同じ規則"""
    name = posixpath.basename(cmd)
    return any(k in name for k in ("chrom", "brave", "edge", "vivaldi", "opera"))


def read_gsettings():
    """gsettings の mutter 実験機能（2 秒で打ち切り。読むだけ）。-> 出力の文字列 / 読めなければ None"""
    try:
        done = subprocess.run(["gsettings", "get", "org.gnome.mutter", "experimental-features"],
                              stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                              timeout=2, check=False)
        return done.stdout.decode("utf-8", "replace") if done.returncode == 0 else None
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def decide_ozone(browser, env, gsettings=None):
    """設計 2.1.5 の表を上から順に見る。-> (出すもの または '', 当たった行の番号)"""
    mode = env.get("MANABI_OZONE", "").strip().lower()
    if mode == "x11":
        return OZONE_X11, 1
    if mode == "native":
        return "", 2
    if env.get("XDG_SESSION_TYPE", "").strip().lower() != "wayland":
        return "", 3
    if not is_chromium_family(browser):
        return "", 4
    if not env.get("DISPLAY"):
        return "", 5
    text = (gsettings or read_gsettings)() or ""
    if "scale-monitor-framebuffer" in text and "xwayland-native-scaling" not in text:
        return "", 6  # 分数スケーリングで XWayland の窓がぼやける
    return OZONE_X11, 7


# ---------------------------------------------------------------- 記録（launch.log）
def _clean(s):
    return re.sub(r"[^A-Za-z0-9._:=+/-]", "", s)[:64]


def session_name(env):
    return re.sub(r"[^a-z0-9]", "", env.get("XDG_SESSION_TYPE", "").lower())[:16] or "unknown"


def _read_log_lines(path):
    """記録の行を読む。リンクはたどらず、ふつうのファイルでなければ空とみなす。大きすぎれば末尾の LOG_READ_MAX バイトだけ"""
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_BINARY", 0)
    try:
        fd = os.open(path, flags)
    except OSError:  # 無い、リンク（ELOOP）、読めない
        return []
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode):
            return []
        with os.fdopen(fd, "rb", closefd=False) as f:
            if st.st_size > LOG_READ_MAX:
                f.seek(st.st_size - LOG_READ_MAX)
                data = f.read(LOG_READ_MAX)
                return data.split(b"\n", 1)[1].splitlines() if b"\n" in data else []  # 途中から始まる最初の行は捨てる
            return f.read(LOG_READ_MAX).splitlines()
    except OSError:
        return []
    finally:
        os.close(fd)


def write_log(path, rec, keep=LOG_MAX_LINES):
    """決まった項目だけを1行の JSON で足し、keep 行を超えた分を前から捨てる。書けなくても何も起こさない。
    同じフォルダに一時のファイル（0600）を作って置き換える（記録がリンクでも、リンク先は書き換えない。途中で打ち切られても半端な記録を残さない）"""
    row = {}
    for k in LOG_KEYS:
        v = rec.get(k)
        if isinstance(v, str):
            row[k] = _clean(v)
        elif isinstance(v, (bool, int)):
            row[k] = v
    tmp = None
    try:
        lines = _read_log_lines(path)
        lines.append(json.dumps(row, ensure_ascii=True, separators=(",", ":")).encode("ascii"))
        folder = os.path.dirname(path) or "."
        os.makedirs(folder, mode=0o700, exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix=".launch.log.", dir=folder)
        with os.fdopen(fd, "wb") as f:
            f.write(b"\n".join(lines[-keep:]) + b"\n")
        os.replace(tmp, path)
        tmp = None
    except OSError:
        pass
    finally:
        if tmp is not None:
            try:
                os.unlink(tmp)
            except OSError:
                pass


# ---------------------------------------------------------------- X11 の下まわり（ctypes）
class X11Unavailable(Exception):
    def __init__(self, reason):
        Exception.__init__(self, reason)
        self.reason = reason  # no-display / no-lib / open-failed


_XID, _DPY = C.c_ulong, C.c_void_p


class XClientMessageEvent(C.Structure):
    _fields_ = [("type", C.c_int), ("serial", C.c_ulong), ("send_event", C.c_int), ("display", _DPY),
                ("window", _XID), ("message_type", _XID), ("format", C.c_int), ("l", C.c_long * 5)]


class XPropertyEvent(C.Structure):
    _fields_ = [("type", C.c_int), ("serial", C.c_ulong), ("send_event", C.c_int), ("display", _DPY),
                ("window", _XID), ("atom", _XID), ("time", C.c_ulong), ("state", C.c_int)]


class XEvent(C.Union):  # 64 ビット Linux で 192 バイト（long 24 個）
    _fields_ = [("type", C.c_int), ("xclient", XClientMessageEvent), ("xproperty", XPropertyEvent),
                ("pad", C.c_long * 24)]


_ERRH = C.CFUNCTYPE(C.c_int, _DPY, C.c_void_p)
_keep_alive = []  # CFUNCTYPE の参照を保つ（GC されると落ちる）


def _load_xlib():
    try:
        x = C.CDLL("libX11.so.6")
    except OSError:
        raise X11Unavailable("no-lib")
    sigs = {  # 名前: (戻り値, 引数)
        "XOpenDisplay": (_DPY, [C.c_char_p]), "XCloseDisplay": (C.c_int, [_DPY]),
        "XDefaultRootWindow": (_XID, [_DPY]), "XInternAtom": (_XID, [_DPY, C.c_char_p, C.c_int]),
        "XGetWindowProperty": (C.c_int, [_DPY, _XID, _XID, C.c_long, C.c_long, C.c_int, _XID,
                                         C.POINTER(_XID), C.POINTER(C.c_int), C.POINTER(C.c_ulong),
                                         C.POINTER(C.c_ulong), C.POINTER(C.POINTER(C.c_ubyte))]),
        "XFree": (C.c_int, [C.c_void_p]), "XSendEvent": (C.c_int, [_DPY, _XID, C.c_int, C.c_long, C.POINTER(XEvent)]),
        "XCreateSimpleWindow": (_XID, [_DPY, _XID, C.c_int, C.c_int, C.c_uint, C.c_uint, C.c_uint, C.c_ulong, C.c_ulong]),
        "XSelectInput": (C.c_int, [_DPY, _XID, C.c_long]),
        "XChangeProperty": (C.c_int, [_DPY, _XID, _XID, _XID, C.c_int, C.c_int, C.c_char_p, C.c_int]),
        "XCheckWindowEvent": (C.c_int, [_DPY, _XID, C.c_long, C.POINTER(XEvent)]),
        "XDestroyWindow": (C.c_int, [_DPY, _XID]), "XSync": (C.c_int, [_DPY, C.c_int]),
        "XSetErrorHandler": (C.c_void_p, [_ERRH]),
    }
    for name, (restype, argtypes) in sigs.items():
        fn = getattr(x, name)
        fn.restype, fn.argtypes = restype, argtypes
    handler = _ERRH(lambda display, event: 0)  # 走査中に窓が閉じても落ちないよう、エラーは無視する
    _keep_alive.append(handler)
    x.XSetErrorHandler(handler)
    return x


class X11Backend:
    """判定とやり直しが使う操作。窓の一覧は下から上（重なり順）"""

    def __init__(self, x, d):
        self.x, self.d = x, d
        self.root = x.XDefaultRootWindow(d)
        self._atoms = {}

    @classmethod
    def open(cls, env):
        if not env.get("DISPLAY"):
            raise X11Unavailable("no-display")
        x = _load_xlib()
        d = x.XOpenDisplay(env["DISPLAY"].encode("utf-8"))
        if not d:
            raise X11Unavailable("open-failed")
        return cls(x, d)

    def atom(self, name):
        if name not in self._atoms:
            self._atoms[name] = self.x.XInternAtom(self.d, name, 0)
        return self._atoms[name]

    def _prop(self, w, name, req_type, fmt):
        """プロパティを読む（fmt 32 -> 数のリスト、fmt 8 -> bytes）。読めなければ None。戻りは必ず XFree する"""
        actual, actual_fmt, n, rest = _XID(), C.c_int(), C.c_ulong(), C.c_ulong()
        p = C.POINTER(C.c_ubyte)()
        status = self.x.XGetWindowProperty(self.d, w, self.atom(name), 0, 1 << 16, 0, req_type, C.byref(actual),
                                           C.byref(actual_fmt), C.byref(n), C.byref(rest), C.byref(p))
        if not p:
            return None
        try:
            if status != 0 or actual_fmt.value != fmt or n.value == 0:
                return None
            if fmt == 32:  # format 32 は C の long の並び（64 ビットでは 8 バイト）
                return list(C.cast(p, C.POINTER(C.c_ulong))[: n.value])
            return C.string_at(p, n.value)
        finally:
            self.x.XFree(p)

    def windows(self):
        for name in (b"_NET_CLIENT_LIST_STACKING", b"_NET_CLIENT_LIST"):
            v = self._prop(self.root, name, 33, 32)  # 33 = XA_WINDOW
            if v:
                return v
        return []

    def wm_class(self, w):
        parts = (self._prop(w, b"WM_CLASS", 31, 8) or b"").split(b"\0")  # 31 = XA_STRING
        return (parts[0].decode("latin-1"), parts[1].decode("latin-1") if len(parts) > 1 else "")

    def title(self, w):
        return (self._prop(w, b"_NET_WM_NAME", 0, 8) or b"").decode("utf-8", "replace")

    def active(self):
        v = self._prop(self.root, b"_NET_ACTIVE_WINDOW", 33, 32)
        return v[0] if v else 0

    def is_fullscreen(self, w):
        return self.atom(b"_NET_WM_STATE_FULLSCREEN") in (self._prop(w, b"_NET_WM_STATE", 4, 32) or [])  # 4 = XA_ATOM

    def server_time(self):
        """いまの X サーバー時刻（ICCCM: 自分の小さな窓に 0 バイト追記 -> PropertyNotify の時刻）。取れなければ 0"""
        x = self.x
        w = x.XCreateSimpleWindow(self.d, self.root, 0, 0, 1, 1, 0, 0, 0)
        stamp, ev = 0, XEvent()
        try:
            x.XSelectInput(self.d, w, 1 << 22)  # PropertyChangeMask
            x.XChangeProperty(self.d, w, self.atom(b"_MANABI_TS"), 31, 8, 2, b"", 0)  # PropModeAppend
            x.XSync(self.d, 0)
            for _ in range(50):
                if x.XCheckWindowEvent(self.d, w, 1 << 22, C.byref(ev)):
                    stamp = ev.xproperty.time
                    break
                time.sleep(0.01)
        finally:
            x.XDestroyWindow(self.d, w)
        return stamp

    def _send(self, w, message, data):
        ev = XEvent()
        c = ev.xclient
        c.type, c.display, c.window, c.format = 33, self.d, w, 32  # 33 = ClientMessage
        c.message_type = self.atom(message)
        for i, v in enumerate(data):
            c.l[i] = v
        self.x.XSendEvent(self.d, self.root, 0, (1 << 20) | (1 << 19), C.byref(ev))  # SubstructureRedirect|Notify

    def activate(self, w, stamp):
        self._send(w, b"_NET_ACTIVE_WINDOW", [2, stamp, 0, 0, 0])  # 2 = 利用者の操作の代わり（ページャー）

    def fullscreen(self, w):
        self._send(w, b"_NET_WM_STATE", [1, self.atom(b"_NET_WM_STATE_FULLSCREEN"), 0, 2, 0])  # 1 = ADD

    def sync(self):
        self.x.XSync(self.d, 0)

    def close(self):
        self.x.XCloseDisplay(self.d)


# ---------------------------------------------------------------- コマンド
class _Parser(argparse.ArgumentParser):
    def error(self, message):
        sys.stderr.write("mnwwindow: 使い方が違います（%s）\n" % message)
        sys.exit(EXIT_USAGE)


def _seconds(text):
    value = float(text)
    if not 0 < value <= 9:
        raise argparse.ArgumentTypeError("秒は 0 より大きく 9 以下")
    return value


def _parser():
    p = _Parser(prog="mnwwindow.py", description="まなびのにわ 窓の補助")
    p.add_argument("--log", metavar="FILE")
    sub = p.add_subparsers(dest="cmd", required=True, parser_class=_Parser)
    sub.add_parser("focus").add_argument("--deadline", type=_seconds, default=2.5)
    sub.add_parser("wait").add_argument("--timeout", type=_seconds, default=5.0)
    sub.add_parser("ozone-flag").add_argument("browser")
    for name in ("focus", "wait"):
        sub.choices[name].add_argument("--browser", choices=BROWSER_KINDS, default="other")
    return p


def main(argv=None, env=None, backend_factory=None, clock=None, out=None):
    """-> 終了コード。backend_factory(env)・clock・out は試験で差し替える"""
    env = os.environ if env is None else env
    out = sys.stdout if out is None else out
    try:
        args = _parser().parse_args(argv)
    except SystemExit as e:
        return e.code if isinstance(e.code, int) else EXIT_USAGE
    # browser: ozone-flag では渡されたコマンドの名前、focus・wait では --browser の種類
    rec = {"t": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"), "cmd": args.cmd, "session": session_name(env),
           "browser": posixpath.basename(args.browser)}
    try:
        if args.cmd == "ozone-flag":
            flag, reason = decide_ozone(args.browser, env)
            code, info = EXIT_OK, {"flag": flag, "reason": reason}
            if flag:
                out.write(flag + "\n")
        else:
            be = (backend_factory or X11Backend.open)(env)
            try:
                if args.cmd == "focus":
                    code, info = run_focus(be, clock or RealClock, args.deadline, browser=args.browser)
                else:
                    code, info = run_wait(be, clock or RealClock, args.timeout, browser=args.browser)
            finally:
                be.close()
    except X11Unavailable as e:
        code, info = EXIT_NO_X11, {"reason": e.reason}
    except Exception as e:  # 補助の不具合は「今までどおり開く」側に倒れるだけ。ozone-flag は何も出さず 0
        code, info = (EXIT_OK if args.cmd == "ozone-flag" else EXIT_ERROR), {"error": type(e).__name__}
    rec.update(info, result=code)
    if args.log:
        write_log(args.log, rec)
    return code


def _on_alarm(signum=None, frame=None):
    """時間切れ。その場で終わる（終了コード 1。バッファは流さないので、ozone-flag の出力は空のまま）"""
    os._exit(EXIT_ERROR)


def arm_timeout(seconds=ALARM_SECONDS):
    """seconds 秒で必ず終わる。SIGALRM の扱いを明示する（親が無視にして起動していても効く）。
    libX11 の中で固まると Python の handler は走れないので、別のスレッドの見張り（faulthandler）を 1 秒遅れで置く"""
    faulthandler.dump_traceback_later(seconds + 1, exit=True, file=open(os.devnull, "w"))
    if hasattr(signal, "alarm"):
        signal.signal(signal.SIGALRM, _on_alarm)
        signal.alarm(seconds)


if __name__ == "__main__":
    arm_timeout()
    sys.exit(main())
