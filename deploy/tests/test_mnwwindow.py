# -*- coding: utf-8 -*-
"""deploy/zorin/mnwwindow.py の試験（docs/expansion/single-instance-design.md 2.1・4.3・5.1 節）

- X に触れない所（判定・やり直し・wait・ozone-flag・記録）は、偽の X と偽の時計で確かめる（Windows でも動く）。
- 本物の CLI は子プロセスで動かす（Windows には libX11 が無いので focus は 5。DISPLAY が空でも 5）。
- ctypes の構造体の大きさ（64 ビット Linux で XEvent は 192 バイト）は Linux でだけ確かめる（Windows では skip）。
- 一時フォルダの中だけで動き、ネットにつながない。helpers.py は読み込まない。__init__.py は置かない。

実行: py -3 -B -m unittest deploy/tests/test_mnwwindow.py -v
"""
import ast
import ctypes
import glob
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
MODULE_PATH = os.path.join(os.path.dirname(os.path.dirname(TESTS_DIR)), "deploy", "zorin", "mnwwindow.py")


def load_module():
    spec = importlib.util.spec_from_file_location("mnwwindow_under_test", MODULE_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


mw = load_module()
C = ctypes
APP = "まなびのにわ"
LINUX64 = sys.platform.startswith("linux") and ctypes.sizeof(ctypes.c_long) == 8


class FakeClock:
    """ミリ秒の整数で数える偽の時計（足し算の誤差で予定の時刻がずれないように）"""

    def __init__(self):
        self.ms = 0
        self.on_sleep = None

    def now(self):
        return self.ms / 1000.0

    def sleep(self, seconds):
        self.ms += int(round(seconds * 1000))
        if self.on_sleep:
            self.on_sleep(self)


class FakeX:
    """偽の X。窓は下から上の順。前面化・全画面が効く条件を差し替えられる"""

    def __init__(self, clock):
        self.clock = clock
        self.order = []
        self.info = {}
        self.active_id = 0
        self.fs = set()
        self.sent = []  # (種類, 窓, 時刻 or None, 送った時の時計の秒)
        self.titles_read = []
        self.activate_n = 0
        self.fullscreen_n = 0
        self.activate_ok = lambda n, ts: True  # n = 何回目の前面化の要求か（1 から）
        self.fullscreen_ok = lambda n: True
        self.closed = False
        self.windows_calls = 0
        self.on_windows = None

    def add(self, w, res_name, res_class, title):
        self.order.append(w)
        self.info[w] = (res_name, res_class, title)

    def remove(self, w):
        self.order.remove(w)
        del self.info[w]

    def windows(self):
        self.windows_calls += 1
        if self.on_windows:
            self.on_windows(self)
        return list(self.order)

    def wm_class(self, w):
        return self.info[w][:2]

    def title(self, w):
        self.titles_read.append(w)
        return self.info[w][2]

    def active(self):
        return self.active_id

    def is_fullscreen(self, w):
        return w in self.fs

    def server_time(self):
        return 5000 + int(self.clock.now() * 1000)

    def activate(self, w, ts):
        self.sent.append(("active", w, ts, self.clock.now()))
        self.activate_n += 1
        if w in self.info and self.activate_ok(self.activate_n, ts):
            self.active_id = w

    def fullscreen(self, w):
        self.sent.append(("fullscreen", w, None, self.clock.now()))
        self.fullscreen_n += 1
        if w in self.info and self.fullscreen_ok(self.fullscreen_n):
            self.fs.add(w)

    def sync(self):
        pass

    def close(self):
        self.closed = True

    def kinds(self, kind):
        return [s for s in self.sent if s[0] == kind]


def app_x(clock, with_noise=True):
    """アプリの窓 0x300 ひとつ（と、ほかのアプリの窓）"""
    x = FakeX(clock)
    if with_noise:
        x.add(0x100, "gnome-terminal-server", "Gnome-terminal", "秘密のメモ - 個人の題名")
        x.add(0x200, "Navigator", "firefox", "Mozilla Firefox")
    x.add(0x300, "127.0.0.1", "Brave-browser", APP)
    return x


class MatchingTest(unittest.TestCase):
    def test_classify_title_rules(self):
        ok = [APP, APP + " — Mozilla Firefox", APP + " - Brave", APP + " – Firefox", APP + " - Chromium",
              APP + " - Google Chrome"]
        for t in ok:
            self.assertEqual(mw.classify("127.0.0.1", "Brave-browser", t), "strong", t)
            self.assertEqual(mw.classify("Navigator", "firefox", t), "weak", t)
        no = ["とじた がめん（" + APP + "）", APP + " - GitHub", APP + "2", "", " " + APP, APP + " - Brave - Brave",
              "x" + APP, APP + " Brave"]
        for t in no:
            self.assertIsNone(mw.classify("127.0.0.1", "Brave-browser", t), repr(t))
            self.assertIsNone(mw.classify("Navigator", "firefox", t), repr(t))

    def test_res_name_beats_res_class_and_unknown_class_is_not_weak(self):
        self.assertEqual(mw.classify("127.0.0.1", "SomethingElse", APP), "strong")
        self.assertEqual(mw.classify("Navigator", "Firefox", APP), "weak")  # 大文字小文字は問わない
        for cls in ("gedit", "Code", "Gnome-terminal", "", "firefoxy", "brave"):
            self.assertIsNone(mw.classify("x", cls, APP), cls)
        for cls in ("firefox", "firefox-esr", "Brave-browser", "Chromium", "chromium-browser", "Google-chrome"):
            self.assertEqual(mw.classify("x", cls, APP), "weak", cls)

    def test_chromium_class_is_weak_only_for_app_windows_without_a_browser_suffix(self):
        # Chromium 系は manabi.sh が必ず --app で開く。ふつうのタブ（題名の末尾にブラウザ名が付く）は選ばない
        for cls in ("brave-browser", "Chromium", "chromium-browser", "Google-chrome"):
            self.assertEqual(mw.classify("x", cls, APP), "weak", cls)
            for suffix in (" - Brave", " - Chromium", " - Google Chrome", " — Mozilla Firefox"):
                self.assertIsNone(mw.classify("x", cls, APP + suffix), cls + suffix)
        # Firefox は今までどおり（タブの窓。末尾を取り除いて比べる）
        for cls in ("firefox", "Firefox-esr"):
            self.assertEqual(mw.classify("x", cls, APP + " — Mozilla Firefox"), "weak", cls)
            self.assertEqual(mw.classify("x", cls, APP), "weak", cls)
        # 強い一致（res_name が 127.0.0.1）は、末尾が付いていても一致する
        self.assertEqual(mw.classify("127.0.0.1", "Brave-browser", APP + " - Brave"), "strong")

    def test_an_ordinary_chromium_tab_is_never_picked_but_the_app_window_is(self):
        x = FakeX(FakeClock())
        x.add(0x1, "127.0.0.1", "Brave-browser", APP)  # アプリ窓（強い）
        x.add(0x2, "brave-browser", "Brave-browser", APP + " - Brave")  # ふつうのタブ（上）
        self.assertEqual(mw.find_app_window(x), mw.Found(0x1, "Brave-browser", "strong"))
        y = FakeX(FakeClock())
        y.add(0x2, "brave-browser", "Brave-browser", APP + " - Brave")
        self.assertIsNone(mw.find_app_window(y))

    def test_top_of_stack_wins_among_equals(self):
        x = FakeX(FakeClock())
        x.add(0x1, "127.0.0.1", "Brave-browser", APP)
        x.add(0x2, "127.0.0.1", "Brave-browser", APP)
        x.add(0x3, "gedit", "Gedit", APP)
        self.assertEqual(mw.find_app_window(x), mw.Found(0x2, "Brave-browser", "strong"))
        y = FakeX(FakeClock())
        y.add(0x1, "Navigator", "firefox", APP + " — Mozilla Firefox")
        y.add(0x2, "Navigator", "firefox", APP + " — Mozilla Firefox")
        self.assertEqual(mw.find_app_window(y), mw.Found(0x2, "firefox", "weak"))

    def test_strong_beats_weak_even_when_lower(self):
        x = FakeX(FakeClock())
        x.add(0x1, "127.0.0.1", "Brave-browser", APP)  # 強い（下）
        x.add(0x2, "Navigator", "firefox", APP + " — Mozilla Firefox")  # 弱い（上）
        self.assertEqual(mw.find_app_window(x).window, 0x1)

    def test_nothing_found(self):
        self.assertIsNone(mw.find_app_window(FakeX(FakeClock())))
        x = FakeX(FakeClock())
        x.add(0x1, "gedit", "Gedit", APP)
        x.add(0x2, "127.0.0.1", "Brave-browser", "とじた がめん（" + APP + "）")
        self.assertIsNone(mw.find_app_window(x))

    def test_titles_of_unrelated_windows_are_not_even_read(self):
        x = app_x(FakeClock())
        mw.find_app_window(x)
        self.assertNotIn(0x100, x.titles_read)
        self.assertEqual(x.titles_read, [0x300])


class FocusTest(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.x = app_x(self.clock)

    def run_focus(self, **kw):
        return mw.run_focus(self.x, self.clock, **kw)

    def test_front_on_first_try(self):
        code, info = self.run_focus()
        self.assertEqual(code, 0)
        self.assertEqual(info["attempts"], 1)
        self.assertTrue(info["fullscreen"])
        self.assertEqual((info["window"], info["class"], info["match"]), ("0x300", "Brave-browser", "strong"))
        self.assertLessEqual(info["ms"], 300)
        act = self.x.kinds("active")
        self.assertEqual(len(act), 1)
        self.assertNotEqual(act[0][2], 0)  # 最初はサーバー時刻
        self.assertEqual(self.x.kinds("fullscreen")[0][1], 0x300)

    def test_messages_go_only_to_the_app_window(self):
        self.x.activate_ok = lambda n, ts: n >= 3
        self.run_focus()
        self.assertTrue(self.x.sent)
        self.assertEqual({s[1] for s in self.x.sent}, {0x300})

    def test_shell_grab_drops_first_three(self):
        self.x.activate_ok = lambda n, ts: n >= 4
        code, info = self.run_focus()
        self.assertEqual(code, 0)
        self.assertEqual(info["attempts"], 4)
        self.assertLessEqual(info["ms"], 2500)
        stamps = [s[2] for s in self.x.kinds("active")]
        self.assertEqual([s != 0 for s in stamps], [True, False, True, False])  # サーバー時刻 -> 0 -> サーバー時刻 -> 0
        self.assertEqual([round(s[3], 1) for s in self.x.kinds("active")], [0.0, 0.5, 1.2, 1.9])

    def test_clock_skew_only_refuses_nonzero_time(self):
        self.x.activate_ok = lambda n, ts: ts == 0
        code, info = self.run_focus()
        self.assertEqual(code, 0)
        self.assertEqual(info["attempts"], 2)
        self.assertEqual([s[2] == 0 for s in self.x.kinds("active")], [False, True])

    def test_fullscreen_resent_once_then_succeeds(self):
        self.x.fullscreen_ok = lambda n: n >= 2
        code, info = self.run_focus()
        self.assertEqual(code, 0)
        self.assertTrue(info["fullscreen"])
        self.assertEqual(len(self.x.kinds("fullscreen")), 2)
        self.assertEqual(len(self.x.kinds("active")), 1)  # 全画面だけを送り直す

    def test_fullscreen_never_applies_still_exit_zero(self):
        self.x.fullscreen_ok = lambda n: False
        code, info = self.run_focus()
        self.assertEqual(code, 0)
        self.assertIs(info["fullscreen"], False)
        self.assertEqual(len(self.x.kinds("fullscreen")), 2)  # 最初の1回と送り直しの1回だけ
        self.assertLessEqual(info["ms"], 1000)

    def test_never_comes_to_front_keeps_deadline(self):
        self.x.activate_ok = lambda n, ts: False
        code, info = self.run_focus()
        self.assertEqual(code, 4)
        self.assertEqual(info["attempts"], 4)
        self.assertGreaterEqual(self.clock.now(), 2.5)
        self.assertLessEqual(self.clock.now(), 2.7)
        self.assertNotIn("fullscreen", info)

    def test_custom_deadline(self):
        self.x.activate_ok = lambda n, ts: False
        code, info = self.run_focus(deadline=1.0)
        self.assertEqual(code, 4)
        self.assertEqual(info["attempts"], 2)  # 0 秒と 0.5 秒
        self.assertLessEqual(self.clock.now(), 1.2)

    def test_window_vanishes_and_no_other(self):
        self.x.activate_ok = lambda n, ts: False
        self.clock.on_sleep = lambda c: self.x.remove(0x300) if c.ms >= 300 and 0x300 in self.x.info else None
        code, info = self.run_focus()
        self.assertEqual(code, 3)
        self.assertLessEqual(self.clock.now(), 0.5)
        self.assertEqual(self.x.kinds("fullscreen")[-1][1], 0x300)

    def test_window_vanishes_and_another_is_chosen(self):
        self.x.add(0x250, "127.0.0.1", "Brave-browser", APP)  # 下の窓。0x300 が上なので最初は 0x300
        self.x.order.sort(key=lambda w: 0 if w == 0x250 else 1)
        self.x.activate_ok = lambda n, ts: self.x.sent[-1][1] != 0x300
        self.clock.on_sleep = lambda c: self.x.remove(0x300) if c.ms >= 300 and 0x300 in self.x.info else None
        code, info = self.run_focus()
        self.assertEqual(code, 0)
        self.assertEqual(info["window"], "0x250")
        last = self.x.kinds("active")[-1]
        self.assertEqual(last[1], 0x250)
        self.assertLessEqual(last[3], 0.5)  # 選び直したらすぐ送る
        self.assertEqual(self.x.active_id, 0x250)

    def test_no_window_sends_nothing(self):
        x = FakeX(self.clock)
        x.add(0x1, "gedit", "Gedit", "x")
        code, info = mw.run_focus(x, self.clock)
        self.assertEqual(code, 3)
        self.assertEqual(x.sent, [])
        self.assertEqual(info["attempts"], 0)

    def test_already_active_still_goes_fullscreen(self):
        self.x.active_id = 0x300
        code, info = self.run_focus()
        self.assertEqual(code, 0)
        self.assertEqual(info["attempts"], 1)
        self.assertTrue(info["fullscreen"])


class WaitTest(unittest.TestCase):
    def test_appears_on_nth_call(self):
        clock = FakeClock()
        x = FakeX(clock)
        x.on_windows = lambda fx: fx.add(0x9, "127.0.0.1", "Brave-browser", APP) if fx.windows_calls == 4 else None
        code, info = mw.run_wait(x, clock)
        self.assertEqual(code, 0)
        self.assertEqual(info["window"], "0x9")
        self.assertEqual(info["ms"], 300)
        self.assertEqual(x.sent, [])  # 何も送らない

    def test_already_there(self):
        clock = FakeClock()
        code, info = mw.run_wait(app_x(clock), clock)
        self.assertEqual((code, info["ms"]), (0, 0))

    def test_timeout(self):
        clock = FakeClock()
        x = FakeX(clock)
        code, info = mw.run_wait(x, clock, timeout=5.0)
        self.assertEqual(code, 3)
        self.assertGreaterEqual(clock.now(), 5.0)
        self.assertLessEqual(clock.now(), 5.2)
        short = FakeClock()
        code, _ = mw.run_wait(FakeX(short), short, timeout=1.0)
        self.assertEqual(code, 3)
        self.assertLessEqual(short.now(), 1.2)


class OzoneFlagTest(unittest.TestCase):
    X11 = "--ozone-platform=x11"

    def no_gsettings(self):
        raise AssertionError("この行では gsettings を読まない")

    def wayland(self, **extra):
        return dict({"XDG_SESSION_TYPE": "wayland", "DISPLAY": ":0"}, **extra)

    def test_rows_in_order(self):
        ng = self.no_gsettings
        # 1・2: MANABI_OZONE が最優先
        self.assertEqual(mw.decide_ozone("firefox", {"MANABI_OZONE": "x11"}, ng), (self.X11, 1))
        self.assertEqual(mw.decide_ozone("brave-browser", self.wayland(MANABI_OZONE="native"), ng), ("", 2))
        # 3: wayland でない
        for env in ({}, {"XDG_SESSION_TYPE": "x11", "DISPLAY": ":0"}, {"XDG_SESSION_TYPE": "tty"}):
            self.assertEqual(mw.decide_ozone("brave-browser", env, ng), ("", 3), env)
        # 4: Chromium 系でない
        for b in ("firefox", "xdg-open", "epiphany", "/usr/bin/firefox"):
            self.assertEqual(mw.decide_ozone(b, self.wayland(), ng), ("", 4), b)
        # 5: DISPLAY が空
        self.assertEqual(mw.decide_ozone("brave-browser", {"XDG_SESSION_TYPE": "wayland"}, ng), ("", 5))
        self.assertEqual(mw.decide_ozone("brave-browser", self.wayland(DISPLAY=""), ng), ("", 5))

    def test_chromium_family_names(self):
        for b in ("brave-browser", "chromium", "chromium-browser", "google-chrome", "google-chrome-stable",
                  "/usr/bin/brave-browser", "microsoft-edge", "vivaldi-stable", "opera"):
            self.assertEqual(mw.decide_ozone(b, self.wayland(), lambda: None), (self.X11, 7), b)

    def test_gsettings_rows(self):
        env = self.wayland()
        cases = [
            ("['scale-monitor-framebuffer']\n", ("", 6)),
            ("['scale-monitor-framebuffer', 'xwayland-native-scaling']\n", (self.X11, 7)),
            ("['xwayland-native-scaling']\n", (self.X11, 7)),
            ("@as []\n", (self.X11, 7)),
            ("", (self.X11, 7)),
            (None, (self.X11, 7)),  # gsettings が無い・時間切れ・失敗
        ]
        for text, want in cases:
            self.assertEqual(mw.decide_ozone("brave-browser", env, lambda t=text: t), want, text)

    def test_read_gsettings(self):
        ok = subprocess.CompletedProcess([], 0, stdout="['a']\n".encode(), stderr=b"")
        with mock.patch.object(mw.subprocess, "run", return_value=ok) as m:
            self.assertEqual(mw.read_gsettings(), "['a']\n")
            args, kwargs = m.call_args
            self.assertEqual(args[0], ["gsettings", "get", "org.gnome.mutter", "experimental-features"])
            self.assertEqual(kwargs["timeout"], 2)
            self.assertFalse(kwargs.get("shell"))
        bad = subprocess.CompletedProcess([], 1, stdout=b"x", stderr=b"")
        for effect in (FileNotFoundError(), subprocess.TimeoutExpired("gsettings", 2), PermissionError()):
            with mock.patch.object(mw.subprocess, "run", side_effect=effect):
                self.assertIsNone(mw.read_gsettings())
        with mock.patch.object(mw.subprocess, "run", return_value=bad):
            self.assertIsNone(mw.read_gsettings())

    def test_main_prints_only_the_flag(self):
        out = io.StringIO()
        env = self.wayland()
        with mock.patch.object(mw, "read_gsettings", return_value=None):
            self.assertEqual(mw.main(["ozone-flag", "brave-browser"], env=env, out=out), 0)
        self.assertEqual(out.getvalue(), self.X11 + "\n")
        out = io.StringIO()
        self.assertEqual(mw.main(["ozone-flag", "firefox"], env=env, out=out), 0)
        self.assertEqual(out.getvalue(), "")

    def test_main_survives_a_broken_gsettings(self):
        out = io.StringIO()
        with mock.patch.object(mw, "read_gsettings", side_effect=RuntimeError("x")):
            self.assertEqual(mw.main(["ozone-flag", "brave-browser"], env=self.wayland(), out=out), 0)
        self.assertEqual(out.getvalue(), "")  # 決められなければ何も出さない


class LogTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="mnwwin-")
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.log = os.path.join(self.tmp, "state", "launch.log")

    def lines(self):
        return self.raw().splitlines()

    def raw(self):
        with open(self.log, "rb") as f:
            return f.read().decode("utf-8", "replace")

    def test_one_json_line_per_write(self):
        mw.write_log(self.log, {"t": "2026-11-20T10:24:01", "cmd": "focus", "session": "wayland", "result": 0,
                                "window": "0x3a00004", "class": "Brave-browser", "match": "strong",
                                "fullscreen": True, "attempts": 1, "ms": 140})
        mw.write_log(self.log, {"cmd": "ozone-flag", "browser": "brave-browser", "flag": "--ozone-platform=x11",
                                "reason": 7})
        rows = [json.loads(s) for s in self.lines()]
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["window"], "0x3a00004")
        self.assertIs(rows[0]["fullscreen"], True)
        self.assertEqual(rows[1]["flag"], "--ozone-platform=x11")
        self.assertEqual(rows[1]["reason"], 7)

    def test_keeps_200_lines_dropping_the_oldest(self):
        for i in range(200):
            mw.write_log(self.log, {"cmd": "focus", "result": 0, "attempts": i})
        self.assertEqual(len(self.lines()), 200)
        mw.write_log(self.log, {"cmd": "focus", "result": 3, "attempts": 201})
        rows = [json.loads(s) for s in self.lines()]
        self.assertEqual(len(rows), 200)
        self.assertEqual(rows[0]["attempts"], 1)  # 0 番目の行が捨てられた
        self.assertEqual(rows[-1]["attempts"], 201)

    def test_unknown_keys_and_odd_characters_are_not_written(self):
        mw.write_log(self.log, {"cmd": "focus", "title": "ひみつ", "url": "http://x/", "class": "ぶらうざ\n\"x\"",
                                "match": ["list"], "ms": 5})
        text = self.raw()
        self.assertNotIn("ひみつ", text)
        self.assertNotIn("http", text)
        self.assertEqual(text.count("\n"), 1)
        row = json.loads(text)
        self.assertEqual(sorted(row), ["class", "cmd", "ms"])
        self.assertEqual(row["class"], "x")

    def test_survives_a_garbled_old_file(self):
        os.makedirs(os.path.dirname(self.log))
        with open(self.log, "wb") as f:
            f.write(b"\xff\xfe not json\n{\"cmd\":\"focus\"}")
        mw.write_log(self.log, {"cmd": "wait", "result": 0})
        rows = self.lines()
        self.assertEqual(len(rows), 3)
        self.assertEqual(json.loads(rows[-1])["cmd"], "wait")

    def test_a_linked_log_is_replaced_and_the_other_file_is_not_touched(self):
        # 記録がほかのファイルへのリンクでも、リンク先を書き換えない（リンクそのものを置き換える）
        os.makedirs(os.path.dirname(self.log))
        target = os.path.join(self.tmp, "important.txt")
        with open(target, "wb") as f:
            f.write(b"keep me\n" * 5)
        try:
            os.symlink(target, self.log)
            kind = "symlink"
        except (OSError, NotImplementedError, AttributeError):
            try:
                os.link(target, self.log)  # Windows など、シンボリックリンクを作れない環境ではハードリンクで確かめる
                kind = "hardlink"
            except OSError:
                self.skipTest("リンクを作れません")
        mw.write_log(self.log, {"cmd": "focus", "result": 0})
        with open(target, "rb") as f:
            self.assertEqual(f.read(), b"keep me\n" * 5, kind)
        self.assertFalse(os.path.islink(self.log))
        rows = self.lines()
        self.assertEqual(json.loads(rows[-1])["cmd"], "focus")
        if kind == "symlink":
            self.assertEqual(len(rows), 1)  # リンク先の中身は読まない

    def test_no_temporary_file_is_left_behind(self):
        mw.write_log(self.log, {"cmd": "focus", "result": 0})
        mw.write_log(self.log, {"cmd": "wait", "result": 0})
        self.assertEqual(os.listdir(os.path.dirname(self.log)), ["launch.log"])
        # 置き換えに失敗しても、一時のファイルを残さない
        with mock.patch.object(mw.os, "replace", side_effect=PermissionError("no")):
            mw.write_log(self.log, {"cmd": "focus", "result": 1})
        self.assertEqual(os.listdir(os.path.dirname(self.log)), ["launch.log"])
        self.assertEqual(len(self.lines()), 2)

    @unittest.skipIf(os.name == "nt", "ファイルの権限は POSIX だけ")
    def test_a_new_log_is_readable_only_by_the_owner(self):
        mw.write_log(self.log, {"cmd": "focus", "result": 0})
        self.assertEqual(os.stat(self.log).st_mode & 0o777, 0o600)
        self.assertEqual(os.stat(os.path.dirname(self.log)).st_mode & 0o777, 0o700)

    def test_a_huge_old_log_is_read_only_at_the_tail(self):
        os.makedirs(os.path.dirname(self.log))
        line = b'{"cmd":"focus","result":0,"attempts":%d}\n'
        with open(self.log, "wb") as f:
            for i in range(60000):  # 2 MiB を超える
                f.write(line % i)
        self.assertGreater(os.path.getsize(self.log), mw.LOG_READ_MAX)
        mw.write_log(self.log, {"cmd": "wait", "result": 0})
        rows = self.lines()
        self.assertEqual(len(rows), 200)
        self.assertEqual(json.loads(rows[-1])["cmd"], "wait")
        self.assertEqual(json.loads(rows[-2])["attempts"], 59999)
        for r in rows:
            json.loads(r)  # 途中で切れた行は入らない
        self.assertLess(os.path.getsize(self.log), 50000)

    def test_a_directory_in_place_of_the_log_changes_nothing(self):
        os.makedirs(self.log)  # launch.log という名前のフォルダ
        mw.write_log(self.log, {"cmd": "focus", "result": 0})  # 例外を出さない
        self.assertTrue(os.path.isdir(self.log))
        self.assertEqual(os.listdir(os.path.dirname(self.log)), ["launch.log"])

    @unittest.skipUnless(hasattr(os, "mkfifo"), "名前付きパイプは POSIX だけ")
    def test_a_pipe_in_place_of_the_log_does_not_block(self):
        os.makedirs(os.path.dirname(self.log))
        os.mkfifo(self.log)
        mw.write_log(self.log, {"cmd": "focus", "result": 0})  # 読み込みで固まらない
        self.assertEqual(self.lines()[-1].count("focus"), 1)

    def test_unwritable_place_changes_nothing(self):
        blocker = os.path.join(self.tmp, "afile")
        with open(blocker, "w") as f:
            f.write("x")
        bad = os.path.join(blocker, "sub", "launch.log")  # ファイルの下は作れない
        mw.write_log(bad, {"cmd": "focus"})  # 例外を出さない
        codes = []
        for argv in (["focus"], ["--log", bad, "focus"]):
            clock = FakeClock()
            x = app_x(clock)
            codes.append(mw.main(argv, env={}, backend_factory=lambda env, x=x: x, clock=clock, out=io.StringIO()))
        self.assertEqual(codes, [0, 0])  # 記録が書けなくても終了コードは変わらない
        self.assertFalse(os.path.exists(os.path.join(blocker, "sub")))

    def test_main_logs_focus_without_other_window_titles(self):
        clock = FakeClock()
        x = app_x(clock)
        x.activate_ok = lambda n, ts: n >= 2
        out = io.StringIO()
        code = mw.main(["--log", self.log, "focus"], env={"XDG_SESSION_TYPE": "wayland"},
                       backend_factory=lambda env: x, clock=clock, out=out)
        self.assertEqual(code, 0)
        self.assertTrue(x.closed)
        self.assertEqual(out.getvalue(), "")
        raw = self.raw()
        self.assertNotIn("秘密", raw)
        self.assertNotIn(APP, raw)
        row = json.loads(raw)
        self.assertEqual((row["cmd"], row["session"], row["result"]), ("focus", "wayland", 0))
        self.assertEqual((row["window"], row["class"], row["match"]), ("0x300", "Brave-browser", "strong"))
        self.assertEqual((row["fullscreen"], row["attempts"]), (True, 2))
        self.assertRegex(row["t"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$")
        self.assertIn("ms", row)

    def test_main_logs_ozone_flag(self):
        out = io.StringIO()
        with mock.patch.object(mw, "read_gsettings", return_value=None):
            mw.main(["--log", self.log, "ozone-flag", "/usr/bin/brave-browser"],
                    env={"XDG_SESSION_TYPE": "wayland", "DISPLAY": ":0"}, out=out)
        row = json.loads(self.lines()[0])
        self.assertEqual((row["cmd"], row["browser"], row["flag"], row["reason"], row["result"]),
                         ("ozone-flag", "brave-browser", "--ozone-platform=x11", 7, 0))

    def test_no_log_option_writes_nothing(self):
        clock = FakeClock()
        x = app_x(clock)
        mw.main(["wait"], env={}, backend_factory=lambda env: x, clock=clock, out=io.StringIO())
        self.assertFalse(os.path.exists(self.log))


class MainLogicTest(unittest.TestCase):
    def test_exit_codes_from_main(self):
        def code(argv, x, clock=None):
            return mw.main(argv, env={}, backend_factory=lambda env: x, clock=clock or FakeClock(), out=io.StringIO())

        clock = FakeClock()
        self.assertEqual(code(["focus"], app_x(clock), clock), 0)
        self.assertEqual(code(["wait"], app_x(FakeClock())), 0)
        self.assertEqual(code(["wait", "--timeout", "1"], FakeX(FakeClock())), 3)
        self.assertEqual(code(["focus"], FakeX(FakeClock())), 3)
        stuck = app_x(FakeClock())
        stuck.activate_ok = lambda n, ts: False
        self.assertEqual(code(["focus", "--deadline", "1"], stuck), 4)

    def test_x_unavailable_is_5_and_unexpected_failure_is_1(self):
        def no_x(env):
            raise mw.X11Unavailable("no-lib")

        self.assertEqual(mw.main(["focus"], env={}, backend_factory=no_x, out=io.StringIO()), 5)
        self.assertEqual(mw.main(["wait"], env={}, backend_factory=no_x, out=io.StringIO()), 5)

        class Broken(FakeX):
            def windows(self):
                raise ValueError("boom")

        x = Broken(FakeClock())
        self.assertEqual(mw.main(["focus"], env={}, backend_factory=lambda env: x, out=io.StringIO()), 1)
        self.assertTrue(x.closed)

    def test_usage_errors_are_2(self):
        err = io.StringIO()
        with mock.patch.object(sys, "stderr", err):
            for argv in ([], ["bogus"], ["focus", "--deadline", "abc"], ["focus", "--deadline", "0"],
                         ["wait", "--timeout", "30"], ["ozone-flag"], ["focus", "extra"]):
                self.assertEqual(mw.main(argv, env={}, out=io.StringIO()), 2, argv)

    def test_real_backend_open_reasons(self):
        for env in ({}, {"DISPLAY": ""}):
            with self.assertRaises(mw.X11Unavailable) as cm:
                mw.X11Backend.open(env)
            self.assertEqual(cm.exception.reason, "no-display")
        if sys.platform == "win32":
            with self.assertRaises(mw.X11Unavailable) as cm:
                mw.X11Backend.open({"DISPLAY": ":987"})
            self.assertEqual(cm.exception.reason, "no-lib")

    def test_backend_has_the_operations_the_logic_uses(self):
        names = ("windows", "wm_class", "title", "active", "is_fullscreen", "server_time", "activate",
                 "fullscreen", "sync", "close")
        for n in names:
            self.assertTrue(callable(getattr(mw.X11Backend, n, None)), n)
            self.assertTrue(callable(getattr(FakeX, n, None)), n)


class CliTest(unittest.TestCase):
    """本物の mnwwindow.py を、manabi.sh と同じ python3 -I -B で子プロセスとして動かす"""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="mnwwin-")
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def run_cli(self, *args, **env):
        base = {k: v for k, v in os.environ.items()
                if k not in ("DISPLAY", "WAYLAND_DISPLAY", "XDG_SESSION_TYPE") and not k.startswith("MANABI_")}
        base.update(env)
        done = subprocess.run([sys.executable, "-I", "-B", MODULE_PATH, *args], env=base, stdin=subprocess.DEVNULL,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
        return done.returncode, done.stdout.decode("utf-8"), done.stderr.decode("utf-8", "replace")

    def test_focus_without_display_is_5(self):
        for env in ({}, {"DISPLAY": ""}):
            code, out, _ = self.run_cli("focus", **env)
            self.assertEqual((code, out), (5, ""), env)

    def test_focus_and_wait_cannot_reach_x_is_5(self):
        # Windows: libX11.so.6 が無い。Linux: そんな番号のディスプレイは無い（unix ソケットだけ。ネットにはつながない）
        for cmd in ("focus", "wait"):
            code, out, _ = self.run_cli(cmd, DISPLAY=":987")
            self.assertEqual((code, out), (5, ""), cmd)

    def test_log_records_why_x_is_unavailable(self):
        log = os.path.join(self.tmp, "launch.log")
        code, _, _ = self.run_cli("--log", log, "focus")
        self.assertEqual(code, 5)
        with open(log, encoding="utf-8") as f:
            row = json.loads(f.read())
        self.assertEqual((row["cmd"], row["result"], row["reason"]), ("focus", 5, "no-display"))

    def test_unknown_command_is_2(self):
        for argv in (["bogus"], [], ["focus", "--nope"]):
            code, out, err = self.run_cli(*argv)
            self.assertEqual((code, out), (2, ""), argv)
            self.assertTrue(err.strip())

    def test_ozone_flag_through_the_real_cli(self):
        code, out, _ = self.run_cli("ozone-flag", "brave-browser", MANABI_OZONE="x11")
        self.assertEqual((code, out.replace("\r\n", "\n")), (0, "--ozone-platform=x11\n"))  # Windows の改行の変換を吸収
        code, out, _ = self.run_cli("ozone-flag", "brave-browser", MANABI_OZONE="native",
                                    XDG_SESSION_TYPE="wayland", DISPLAY=":0")
        self.assertEqual((code, out), (0, ""))
        code, out, _ = self.run_cli("ozone-flag", "firefox", XDG_SESSION_TYPE="wayland", DISPLAY=":0")
        self.assertEqual((code, out), (0, ""))
        code, out, _ = self.run_cli("ozone-flag", "brave-browser", XDG_SESSION_TYPE="x11")
        self.assertEqual((code, out), (0, ""))

    def test_no_pycache_left_next_to_the_script(self):
        self.run_cli("ozone-flag", "firefox")
        self.assertEqual(glob.glob(os.path.join(os.path.dirname(MODULE_PATH), "__pycache__", "mnwwindow*")), [])


class FakeLib:
    """libX11 の代わり（Windows でも動く）。プロパティの表を持ち、XFree・XSendEvent などの呼ばれ方を記録する。
    関数は普通の関数にする（ctypes の restype・argtypes を後から付けられるように）"""

    DISPLAY = 4242
    ROOT = 1

    def __init__(self):
        self.props = {}  # (窓, 名前の bytes) -> (型, 形式 8 か 32, bytes か数のリスト)
        self.bad_windows = set()
        self.atom_ids = {}
        self.allocated, self.freed, self.sent, self.calls, self.reads = [], [], [], [], []
        self.time_events = []  # XCheckWindowEvent が返す時刻。None = まだ届かない
        self.on_send = None
        self.error_handler = None
        self.open_result = self.DISPLAY
        self._keep = []
        lib = self

        def intern(d, name, only_if_exists):
            return lib.atom_ids.setdefault(name, 100 + len(lib.atom_ids))

        def get_property(d, w, prop, off, length, delete, req, actual, fmt, n, rest, pref):
            name = {v: k for k, v in lib.atom_ids.items()}[prop]
            lib.reads.append((w, name))
            entry = lib.props.get((w, name))
            if w in lib.bad_windows:
                return 3  # BadWindow（ポインターは NULL のまま）
            if entry is None:
                return 0
            typ, form, data = entry
            actual._obj.value, fmt._obj.value = typ, form
            if req and req != typ:
                return 0
            buf = (C.c_ulong * len(data))(*data) if form == 32 else C.create_string_buffer(bytes(data), len(data))
            lib._keep.append(buf)
            n._obj.value = len(data)
            src = C.cast(buf, C.POINTER(C.c_ubyte))
            C.memmove(C.addressof(pref._obj), C.addressof(src), C.sizeof(C.c_void_p))
            lib.allocated.append(C.addressof(buf))
            return 0

        def send_event(d, w, propagate, mask, ref):
            c = ref._obj.xclient
            row = (w, propagate, mask, c.type, c.window, c.message_type, c.format, list(c.l))
            lib.sent.append(row)
            if lib.on_send:
                lib.on_send(row)
            return 1

        def check_window_event(d, w, mask, ref):
            if not lib.time_events or lib.time_events[0] is None:
                if lib.time_events:
                    lib.time_events.pop(0)
                return 0
            ref._obj.xproperty.time = lib.time_events.pop(0)
            return 1

        def record(name, result=0):
            def call(*args):
                lib.calls.append((name,) + args)
                return result
            return call

        self.XInternAtom = intern
        self.XGetWindowProperty = get_property
        self.XSendEvent = send_event
        self.XCheckWindowEvent = check_window_event
        self.XFree = lambda ptr: lib.freed.append(C.cast(ptr, C.c_void_p).value)
        self.XOpenDisplay = lambda name: (lib.calls.append(("XOpenDisplay", name)), lib.open_result)[1]
        self.XDefaultRootWindow = lambda d: lib.ROOT
        self.XSetErrorHandler = lambda handler: setattr(lib, "error_handler", handler)
        self.XCreateSimpleWindow = record("XCreateSimpleWindow", 555)
        self.XSelectInput = record("XSelectInput")
        self.XChangeProperty = record("XChangeProperty")
        self.XDestroyWindow = record("XDestroyWindow")
        self.XSync = record("XSync")
        self.XCloseDisplay = record("XCloseDisplay")

    def atom(self, name):
        return self.atom_ids.setdefault(name, 100 + len(self.atom_ids))

    def put(self, w, name, typ, form, data):
        self.atom(name)
        self.props[(w, name)] = (typ, form, data)


class X11BackendTest(unittest.TestCase):
    """本物の X11Backend を、偽の libX11 の上で動かす（Python 側の読み書きの規則を確かめる。実機の X は別）"""

    def setUp(self):
        self.lib = FakeLib()
        self.be = mw.X11Backend(self.lib, self.lib.DISPLAY)

    def test_open_loads_signatures_and_installs_a_quiet_error_handler(self):
        lib = FakeLib()
        with mock.patch.object(mw.C, "CDLL", return_value=lib) as cdll:
            be = mw.X11Backend.open({"DISPLAY": ":7"})
        cdll.assert_called_once_with("libX11.so.6")
        self.assertIn(("XOpenDisplay", b":7"), lib.calls)
        self.assertIs(lib.XOpenDisplay.restype, mw.C.c_void_p)  # 64 ビットでポインターを int で受けない
        self.assertIs(lib.XDefaultRootWindow.restype, mw._XID)
        self.assertEqual(lib.XFree.argtypes, [mw.C.c_void_p])
        self.assertIsNotNone(lib.error_handler)
        self.assertEqual(lib.error_handler(None, None), 0)  # エラーは無視する
        self.assertIn(lib.error_handler, mw._keep_alive)  # 参照を保つ
        self.assertEqual((be.d, be.root), (lib.DISPLAY, lib.ROOT))

    def test_open_failed(self):
        lib = FakeLib()
        lib.open_result = 0
        with mock.patch.object(mw.C, "CDLL", return_value=lib):
            with self.assertRaises(mw.X11Unavailable) as cm:
                mw.X11Backend.open({"DISPLAY": ":7"})
        self.assertEqual(cm.exception.reason, "open-failed")

    def test_no_lib(self):
        with mock.patch.object(mw.C, "CDLL", side_effect=OSError("no")):
            with self.assertRaises(mw.X11Unavailable) as cm:
                mw.X11Backend.open({"DISPLAY": ":7"})
        self.assertEqual(cm.exception.reason, "no-lib")

    def test_reads_window_list_class_title_active_and_fullscreen(self):
        lib, be, root = self.lib, self.be, self.lib.ROOT
        lib.put(root, b"_NET_CLIENT_LIST_STACKING", 33, 32, [0x11, 0x22, 0x33])
        lib.put(root, b"_NET_CLIENT_LIST", 33, 32, [0x33])
        lib.put(root, b"_NET_ACTIVE_WINDOW", 33, 32, [0x22])
        lib.put(0x22, b"WM_CLASS", 31, 8, b"127.0.0.1\0Brave-browser\0")
        lib.put(0x22, b"_NET_WM_NAME", 7, 8, APP.encode("utf-8"))
        lib.atom(b"_NET_WM_STATE_FULLSCREEN")
        lib.put(0x22, b"_NET_WM_STATE", 4, 32, [lib.atom(b"_NET_WM_STATE_ABOVE"), lib.atom(b"_NET_WM_STATE_FULLSCREEN")])
        lib.put(0x33, b"_NET_WM_STATE", 4, 32, [lib.atom(b"_NET_WM_STATE_ABOVE")])
        self.assertEqual(be.windows(), [0x11, 0x22, 0x33])
        self.assertEqual(be.wm_class(0x22), ("127.0.0.1", "Brave-browser"))
        self.assertEqual(be.title(0x22), APP)
        self.assertEqual(be.active(), 0x22)
        self.assertTrue(be.is_fullscreen(0x22))
        self.assertFalse(be.is_fullscreen(0x33))
        self.assertFalse(be.is_fullscreen(0x44))
        self.assertEqual(sorted(lib.freed), sorted(lib.allocated))  # 読んだ戻りはすべて XFree した
        self.assertEqual(len(lib.freed), 6)  # 読めた6回ぶん（0x44 は無かった）

    def test_falls_back_to_client_list_and_handles_missing_or_odd_properties(self):
        lib, be, root = self.lib, self.be, self.lib.ROOT
        self.assertEqual(be.windows(), [])
        self.assertEqual(be.active(), 0)
        self.assertEqual(be.wm_class(0x9), ("", ""))
        self.assertEqual(be.title(0x9), "")
        lib.put(root, b"_NET_CLIENT_LIST", 33, 32, [0x5, 0x6])
        self.assertEqual(be.windows(), [0x5, 0x6])
        lib.put(0x5, b"WM_CLASS", 31, 8, b"only-name")  # class が無い
        self.assertEqual(be.wm_class(0x5), ("only-name", ""))
        lib.put(0x5, b"_NET_WM_NAME", 7, 8, b"\xff\xfe\xe3\x81\xbe")  # 壊れた UTF-8 でも落ちない
        self.assertIn("�", be.title(0x5))
        lib.put(0x6, b"WM_CLASS", 31, 32, [1, 2])  # 形式が違う -> 無いのと同じ。ただし戻りは XFree する
        self.assertEqual(be.wm_class(0x6), ("", ""))
        lib.bad_windows.add(0x7)  # 走査中に窓が閉じた（BadWindow）
        self.assertEqual(be.wm_class(0x7), ("", ""))
        self.assertEqual(be.title(0x7), "")
        self.assertEqual(sorted(lib.freed), sorted(lib.allocated))

    def test_type_mismatch_returns_nothing(self):
        lib = self.lib
        lib.put(lib.ROOT, b"_NET_ACTIVE_WINDOW", 6, 32, [0x22])  # 型が XA_WINDOW(33) でない
        self.assertEqual(self.be.active(), 0)
        self.assertEqual(sorted(lib.freed), sorted(lib.allocated))

    def test_activate_and_fullscreen_messages(self):
        lib, be = self.lib, self.be
        be.activate(0x22, 12345)
        be.fullscreen(0x22)
        be.sync()
        mask = (1 << 20) | (1 << 19)  # SubstructureRedirect | SubstructureNotify
        active, full = lib.sent
        full_atom = lib.atom_ids[b"_NET_WM_STATE_FULLSCREEN"]
        self.assertEqual(active, (lib.ROOT, 0, mask, 33, 0x22, lib.atom_ids[b"_NET_ACTIVE_WINDOW"], 32,
                                  [2, 12345, 0, 0, 0]))
        self.assertEqual(full, (lib.ROOT, 0, mask, 33, 0x22, lib.atom_ids[b"_NET_WM_STATE"], 32,
                                [1, full_atom, 0, 2, 0]))
        self.assertEqual([c[0] for c in lib.calls], ["XSync"])

    def test_server_time_from_property_notify_and_cleans_up(self):
        lib = self.lib
        lib.time_events = [None, None, 777]  # 2 回目まで届かない
        with mock.patch.object(mw.time, "sleep"):
            self.assertEqual(self.be.server_time(), 777)
        names = [c[0] for c in lib.calls]
        self.assertEqual(names[:4], ["XCreateSimpleWindow", "XSelectInput", "XChangeProperty", "XSync"])
        self.assertEqual(names[-1], "XDestroyWindow")
        change = [c for c in lib.calls if c[0] == "XChangeProperty"][0]
        self.assertEqual((change[5], change[6], change[8]), (8, 2, 0))  # 形式 8・PropModeAppend・0 個
        self.assertEqual(change[2], 555)  # 自分の小さな窓にだけ書く

    def test_server_time_gives_up_with_zero(self):
        with mock.patch.object(mw.time, "sleep"):
            self.assertEqual(self.be.server_time(), 0)
        self.assertEqual(self.lib.calls[-1][0], "XDestroyWindow")

    def test_close(self):
        self.be.close()
        self.assertEqual(self.lib.calls[-1], ("XCloseDisplay", self.lib.DISPLAY))

    def test_focus_end_to_end_over_the_fake_xlib(self):
        """本物の X11Backend と判定・やり直しをつなぐ。窓マネージャーの代わりに、送られた要求で表を書き換える"""
        lib, root = self.lib, self.lib.ROOT
        fs_atom, state_atom = lib.atom(b"_NET_WM_STATE_FULLSCREEN"), lib.atom(b"_NET_WM_STATE")
        active_atom = lib.atom(b"_NET_ACTIVE_WINDOW")
        lib.put(root, b"_NET_CLIENT_LIST_STACKING", 33, 32, [0x11, 0x22, 0x33])
        for w, rn, rc, title in ((0x11, "gnome-terminal-server", "Gnome-terminal", "秘密の題名"),
                                 (0x22, "127.0.0.1", "Brave-browser", APP),
                                 (0x33, "Navigator", "firefox", "別のページ - Mozilla Firefox")):
            lib.put(w, b"WM_CLASS", 31, 8, (rn + "\0" + rc + "\0").encode("latin-1"))
            lib.put(w, b"_NET_WM_NAME", 7, 8, title.encode("utf-8"))
        lib.put(root, b"_NET_ACTIVE_WINDOW", 33, 32, [0x33])
        lib.time_events = [900] * 5
        refused = []

        def window_manager(row):
            _, _, _, _, w, msg, _, data = row
            if msg == active_atom and data[1] != 0:
                refused.append(row)
                if len(refused) > 1:  # 最初の1回は断られる（Shell のつかみ）
                    lib.put(root, b"_NET_ACTIVE_WINDOW", 33, 32, [w])
            elif msg == state_atom and data[0] == 1 and data[1] == fs_atom:
                lib.put(w, b"_NET_WM_STATE", 4, 32, [fs_atom])

        lib.on_send = window_manager
        clock = FakeClock()
        code, info = mw.run_focus(self.be, clock)
        self.assertEqual(code, 0)
        self.assertEqual((info["window"], info["class"], info["match"], info["fullscreen"]),
                         ("0x22", "Brave-browser", "strong", True))
        self.assertEqual({row[4] for row in lib.sent}, {0x22})  # アプリの窓にだけ送った
        self.assertEqual(sorted(lib.freed), sorted(lib.allocated))
        self.assertNotIn((0x11, b"_NET_WM_NAME"), lib.reads)  # アプリらしくない class の窓の題名は読まない
        self.assertIn((0x22, b"_NET_WM_NAME"), lib.reads)
        self.assertEqual(self.be.active(), 0x22)


class SourceRulesTest(unittest.TestCase):
    def setUp(self):
        with open(MODULE_PATH, encoding="utf-8") as f:
            self.source = f.read()

    def test_python_310_syntax(self):
        tree = ast.parse(self.source, feature_version=(3, 10))
        self.assertFalse([n for n in ast.walk(tree) if type(n).__name__ == "Match"])
        self.assertFalse([n for n in ast.walk(tree) if isinstance(n, ast.Attribute) and n.attr == "UTC"])

    def test_only_standard_library_and_no_network_modules(self):
        allowed = {"argparse", "ctypes", "json", "os", "posixpath", "re", "signal", "stat", "subprocess", "sys",
                   "tempfile", "time", "collections", "datetime"}
        found = set()
        for n in ast.walk(ast.parse(self.source)):
            if isinstance(n, ast.Import):
                found.update(a.name.split(".")[0] for a in n.names)
            elif isinstance(n, ast.ImportFrom):
                found.add((n.module or "").split(".")[0])
        self.assertTrue(found <= allowed, found - allowed)
        for word in ("socket", "urllib", "http", "sudo", "shell=True"):
            self.assertNotIn(word, self.source.replace("http://127.0.0.1", ""), word)

    def test_stays_one_small_file(self):
        # NF-06: 概ね 400 行以内を目安。記録を安全に書く部分（リンクをたどらない・置き換えで書く）を足して 480 行ほどになった
        self.assertLessEqual(len(self.source.splitlines()), 500)


@unittest.skipUnless(LINUX64, "64 ビット Linux だけ（XEvent の大きさは LP64 の約束。Windows では確かめない）")
class StructLayoutTest(unittest.TestCase):
    def test_xevent_is_192_bytes(self):
        self.assertEqual(ctypes.sizeof(mw.XEvent), 192)

    def test_client_message_layout_matches_xlib(self):
        s = mw.XClientMessageEvent
        want = {"type": 0, "serial": 8, "send_event": 16, "display": 24, "window": 32, "message_type": 40,
                "format": 48, "l": 56}
        for name, offset in want.items():
            self.assertEqual(getattr(s, name).offset, offset, name)
        self.assertEqual(ctypes.sizeof(s), 96)
        self.assertEqual(ctypes.sizeof(ctypes.c_long), 8)  # format 32 の data は long（8 バイト）の並び

    def test_property_event_layout_matches_xlib(self):
        s = mw.XPropertyEvent
        want = {"type": 0, "serial": 8, "send_event": 16, "display": 24, "window": 32, "atom": 40, "time": 48,
                "state": 56}
        for name, offset in want.items():
            self.assertEqual(getattr(s, name).offset, offset, name)
        self.assertEqual(ctypes.sizeof(s), 64)

    def test_libx11_loads_and_signatures_apply(self):
        try:
            ctypes.CDLL("libX11.so.6")
        except OSError:
            self.skipTest("libX11.so.6 が無い")
        x = mw._load_xlib()
        self.assertIs(x.XOpenDisplay.restype, ctypes.c_void_p)
        self.assertGreaterEqual(len(mw._keep_alive), 1)


if __name__ == "__main__":
    unittest.main()
