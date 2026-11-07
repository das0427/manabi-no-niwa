"""deploy/zorin/manabi.sh（起動スクリプト）の試験（bash があるときだけ。Windows では Git Bash）。

設計: docs/expansion/single-instance-design.md 2.1.1・2.1.6・2.1.7・5.1。

- 一時フォルダを HOME・XDG_STATE_HOME・XDG_RUNTIME_DIR にして動かす（本物の置き場には触らない）。
- manabi.sh は一時フォルダに写して動かす（隣の mnwwindow.py があるか・無いかを変えるため）。
- PATH は「偽のコマンドの置き場」と「必要な道具の置き場」の 2 つだけにする。
  この端末に本物のブラウザ・flock・setsid があっても、結果が変わらないようにするため。
- 偽の python3 が、配信の確かめ（FAKE_HEALTH）・mnwwindow.py（focus は FAKE_FOCUS、ozone-flag は FAKE_OZONE、
  wait は FAKE_WAIT）・serve.py を受け持つ。偽のブラウザ・flock も同じ。
  どれも「呼ばれた引数」と「fd 9（鍵）が開いているか」を記録する。
- 本物の mnwwindow.py は使わない（中身は別の試験）。ネットワークにはつながない。

実行: py -3 -B -m unittest deploy/tests/test_manabi_sh.py -v
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from collections import namedtuple
from pathlib import Path

sys.dont_write_bytecode = True

REPO = Path(__file__).resolve().parents[2]
ZORIN = REPO / "deploy" / "zorin"
IS_WINDOWS = sys.platform == "win32"
URL = "http://127.0.0.1:8765/"
APP_ARG = "--app=" + URL
OZONE = "--ozone-platform=x11"
BROWSER_NAMES = (
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
    "brave-browser",
    "firefox",
    "xdg-open",
)
# manabi.sh が使う外部の道具（これ以外は PATH に置かない）
TOOLS = ("dirname", "basename", "seq", "sleep", "tail", "mkdir", "nohup")


def focus_call(kind):
    """manabi.sh が mnwwindow.py の focus に渡す引数（kind = chromium / firefox / other）。"""
    return ["focus", "--browser", kind]


def wait_call(kind):
    """開いたあとの wait に渡す引数。"""
    return ["wait", "--timeout", "5", "--browser", kind]


def to_posix(p) -> str:
    """bash から見えるパスにする（Git Bash では C:\\a\\b → /c/a/b）。"""
    s = str(Path(p).resolve())
    if IS_WINDOWS:
        m = re.match(r"^([A-Za-z]):[\\/](.*)$", s)
        if m:
            return "/" + m.group(1).lower() + "/" + m.group(2).replace("\\", "/")
        return s.replace("\\", "/")
    return s


def _bash_works(path: str) -> bool:
    try:
        r = subprocess.run([path, "-c", "echo mnw-ok"], capture_output=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return False
    return r.returncode == 0 and b"mnw-ok" in r.stdout


def find_bash():
    """使う bash を探す。無ければ None。Windows では WSL の bash（System32）ではなく Git Bash を使う。"""
    cands = []
    if os.environ.get("MNW_TEST_BASH"):
        cands.append(os.environ["MNW_TEST_BASH"])
    if IS_WINDOWS:
        git = shutil.which("git")
        if git:
            g = Path(git).resolve()
            for root in (g.parent.parent, g.parent.parent.parent):
                cands.append(str(root / "bin" / "bash.exe"))
                cands.append(str(root / "usr" / "bin" / "bash.exe"))
        for pf in (os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)")):
            if pf:
                cands.append(str(Path(pf) / "Git" / "bin" / "bash.exe"))
        found = shutil.which("bash")
        if found and "system32" not in found.lower():
            cands.append(found)
    else:
        found = shutil.which("bash")
        if found:
            cands.append(found)
    for c in cands:
        if Path(c).is_file() and _bash_works(c):
            return c
    return None


BASH = find_bash()
_TOOL_PATHS = None


def tool_paths() -> dict:
    """TOOLS と flock の、bash から見た本物のパス（見つかったものだけ）。"""
    global _TOOL_PATHS
    if _TOOL_PATHS is None:
        found = {}
        for name in TOOLS + ("flock",):
            cp = subprocess.run([BASH, "-c", "command -v " + name], capture_output=True, timeout=60)
            path = cp.stdout.decode("utf-8", errors="replace").strip()
            if cp.returncode == 0 and path.startswith("/"):
                found[name] = path
        _TOOL_PATHS = found
    return _TOOL_PATHS


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


# 偽のコマンドの先頭に置く共通部分。
#   F9   : 起動された時点で fd 9（鍵）が開いていれば open、閉じていれば closed
#   rec  : 「名前・F9・引数」をタブ区切りで 1 行、記録に足す。
#          裏で動く別のコマンド（配信・ブラウザ）と同時に書いても行が混ざらないように、1 行を作ってから 1 回で書く
STUB_HEAD = r"""
if ( true >&9 ) 2>/dev/null; then F9=open; else F9=closed; fi
rec() {
  _t="$(printf '\t')"
  _l="$1$_t$F9"; shift
  for _a in "$@"; do _l="$_l$_t$_a"; done
  printf '%s\n' "$_l" >>"$MNW_TEST_LOG"
}
"""

# 偽の python3。呼ばれ方で受け持ちを分ける。
#   python3 -I - URL                  … 配信の確かめ（manabi.sh の check_health。-I は今いるフォルダの .py を読まないため）
#   python3 -I -B mnwwindow.py ...    … 窓の補助
#   python3 serve.py                  … 配信の起動
FAKE_PYTHON3 = (
    STUB_HEAD
    + r"""
case "${1:-}" in
  -I)
    if [ "${2:-}" = "-" ]; then
      rec python3-health "$@"
      if [ -e "$MNW_TEST_DIR/served" ]; then exit 0; fi
      exit "${FAKE_HEALTH:-0}"
    fi
    rec python3-win "$@"
    cmd=""; seen=0; skip=0
    for a in "$@"; do
      if [ "$seen" -eq 0 ]; then
        case "$a" in *mnwwindow.py) seen=1 ;; esac
        continue
      fi
      if [ "$skip" -eq 1 ]; then skip=0; continue; fi
      if [ "$a" = "--log" ]; then skip=1; continue; fi
      cmd="$a"; break
    done
    if [ -n "${FAKE_PROBE_LOCK:-}" ]; then
      if ( flock -n 8 ) 8>>"$FAKE_PROBE_LOCK" 2>/dev/null; then P=free; else P=held; fi
      rec lockprobe "$cmd" "$P"
    fi
    case "$cmd" in
      focus) exit "${FAKE_FOCUS:-3}" ;;
      ozone-flag) printf '%b\n' "${FAKE_OZONE:-}"; exit 0 ;;
      wait) exit "${FAKE_WAIT:-0}" ;;
    esac
    exit 2
    ;;
  *)
    rec python3-serve "$@"
    : > "$MNW_TEST_DIR/served"
    exit 0
    ;;
esac
"""
)


def fake_browser(name: str) -> str:
    return (
        STUB_HEAD
        + f'rec {name} "$@"\n'
        + 'if [ -n "${FAKE_BROWSER_SLEEP:-}" ]; then sleep "$FAKE_BROWSER_SLEEP"; fi\n'
        + "exit 0\n"
    )


FAKE_FLOCK = STUB_HEAD + 'rec flock "$@"\nexit "${FAKE_FLOCK:-0}"\n'
FAKE_SETSID = 'exec "$@"\n'

Rec = namedtuple("Rec", "name fd9 args")


class Result:
    def __init__(self, cp):
        self.returncode = cp.returncode
        self.stdout = cp.stdout.decode("utf-8", errors="replace")
        self.stderr = cp.stderr.decode("utf-8", errors="replace")

    @property
    def out(self) -> str:
        return self.stdout + self.stderr


@unittest.skipIf(BASH is None, "bash（Git Bash など）が見つからないため、試験を飛ばします")
class ManabiShTestBase(unittest.TestCase):
    def setUp(self):
        td = tempfile.TemporaryDirectory(prefix="mnw-msh-", ignore_cleanup_errors=True)
        self.addCleanup(td.cleanup)
        self.tmp = Path(td.name).resolve()
        self.home = self.tmp / "home"
        self.state = self.tmp / "state"  # XDG_STATE_HOME（manabi-no-niwa/ はスクリプトが作る）
        self.runtime = self.tmp / "run"  # XDG_RUNTIME_DIR（鍵を置く場所）
        self.stubs = self.tmp / "stubs"
        self.tools = self.tmp / "tools"
        self.zorin = self.tmp / "zorin"  # 写した manabi.sh と偽の mnwwindow.py・serve.py
        self.work = self.tmp / "work"  # MNW_TEST_DIR（配信が起動したかの印）
        self.cwd = self.tmp / "cwd"
        self.log = self.tmp / "calls.log"
        for d in (self.home, self.state, self.runtime, self.stubs, self.tools, self.zorin, self.work, self.cwd):
            d.mkdir()
        self.script = self.zorin / "manabi.sh"
        shutil.copyfile(ZORIN / "manabi.sh", self.script)
        write_text(self.zorin / "mnwwindow.py", "# 偽の窓の補助（中身は使わない。有無だけ見られる）\n")
        write_text(self.zorin / "serve.py", "# 偽の配信（中身は使わない）\n")
        self.lock_file = self.runtime / "manabi-no-niwa-launch.lock"
        self.state_lock_file = self.state / "manabi-no-niwa" / "manabi-no-niwa-launch.lock"
        self.launch_log = self.state / "manabi-no-niwa" / "launch.log"
        self._write_tools()
        self.write_stub("python3", FAKE_PYTHON3)
        self.write_stub("setsid", FAKE_SETSID)
        self.write_stub("flock", FAKE_FLOCK)

    # ---- 偽のコマンド ----
    def write_stub(self, name: str, body: str) -> None:
        p = self.stubs / name
        write_text(p, "#!/bin/sh\n" + body)
        if not IS_WINDOWS:
            p.chmod(0o755)

    def remove_stub(self, name: str) -> None:
        (self.stubs / name).unlink()

    def write_exec(self, path: Path, body: str) -> None:
        """PATH の外の置き場に、偽のコマンドを置く。"""
        write_text(path, "#!/bin/sh\n" + body)
        if not IS_WINDOWS:
            path.chmod(0o755)

    def add_browsers(self, *names: str) -> None:
        for n in names:
            self.write_stub(n, fake_browser(n))

    def _write_tools(self) -> None:
        paths = tool_paths()
        for name in TOOLS:
            self.assertIn(name, paths, name + " が bash の中に見つかりません")
            p = self.tools / name
            write_text(p, f'#!/bin/sh\nexec "{paths[name]}" "$@"\n')
            if not IS_WINDOWS:
                p.chmod(0o755)

    # ---- 実行 ----
    def env(self, **extra):
        env = {
            k: v
            for k, v in os.environ.items()
            if not (
                k.startswith("BASH_FUNC_")
                or k.startswith("XDG_")
                or k.startswith("MANABI_")
                or k.startswith("FAKE_")
                or k.startswith("MNW_TEST_")
                or k in ("HOME", "DISPLAY", "WAYLAND_DISPLAY")
            )
        }
        env.update(
            HOME=to_posix(self.home),
            XDG_STATE_HOME=to_posix(self.state),
            XDG_RUNTIME_DIR=to_posix(self.runtime),
            MNW_TEST_LOG=to_posix(self.log),
            MNW_TEST_DIR=to_posix(self.work),
        )
        for k, v in extra.items():
            if v is None:
                env.pop(k, None)
            else:
                env[k] = v
        return env

    def run_manabi(self, *, expect_browser: bool, **env_extra) -> Result:
        """manabi.sh を動かす。expect_browser: ブラウザの記録が現れるまで待つか（True）、起動しないことを確かめるために少し待つか（False）。"""
        # PATH は「偽のコマンド」と「道具」の 2 つだけにして、bash を絶対パスで動かす
        path = to_posix(self.stubs) + ":" + to_posix(self.tools)
        cmd = [BASH, "-c", 'PATH="$1"; shift; exec "$@"', "mnw", path, to_posix(BASH), to_posix(self.script)]
        cp = subprocess.run(
            cmd,
            capture_output=True,
            env=self.env(**env_extra),
            cwd=str(self.cwd),
            timeout=120,
        )
        # ブラウザは裏で起動されるので、記録が書かれるまで待つ（起動しないことを確かめるときは、遅れて書かれる分を待つ）
        if expect_browser:
            self.wait_for(lambda: any(r.name in BROWSER_NAMES for r in self.records()))
        else:
            time.sleep(0.6)
        return Result(cp)

    @staticmethod
    def wait_for(pred, timeout: float = 15.0) -> bool:
        end = time.time() + timeout
        while time.time() < end:
            if pred():
                return True
            time.sleep(0.05)
        return False

    # ---- 記録 ----
    def records(self):
        if not self.log.exists():
            return []
        out = []
        for line in self.log.read_text(encoding="utf-8").splitlines():
            parts = line.split("\t")
            out.append(Rec(parts[0], parts[1] if len(parts) > 1 else "", parts[2:]))
        return out

    def clear_records(self) -> None:
        if self.log.exists():
            self.log.unlink()
        served = self.work / "served"
        if served.exists():
            served.unlink()

    def named(self, name: str):
        return [r for r in self.records() if r.name == name]

    def browser_starts(self):
        return [r for r in self.records() if r.name in BROWSER_NAMES]

    def win_calls(self):
        """mnwwindow.py に渡した「コマンドと引数」（共通の前置き -I -B <mnwwindow.py> --log <記録> を除いたもの）。"""
        calls = []
        for r in self.named("python3-win"):
            self.assertEqual(r.args[0:2], ["-I", "-B"], r.args)
            self.assertTrue(r.args[2].endswith("/mnwwindow.py"), r.args)
            self.assertEqual("--log", r.args[3], r.args)
            self.assertTrue(r.args[4].endswith("/manabi-no-niwa/launch.log"), r.args)
            calls.append(r.args[5:])
        return calls

    def order(self):
        return [r.name for r in self.records()]


class SyntaxTest(ManabiShTestBase):
    def test_bash_syntax(self):
        for f in ("manabi.sh", "install.sh"):
            with self.subTest(script=f):
                cp = subprocess.run(
                    [BASH, "-n", to_posix(ZORIN / f)],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                )
                self.assertEqual(cp.returncode, 0, cp.stderr)


class FocusTest(ManabiShTestBase):
    """mnwwindow.py focus の結果で、ブラウザを開くか・開かないか。"""

    def test_focus_success_ends_without_starting_a_browser(self):
        self.add_browsers("brave-browser", "firefox", "xdg-open")
        r = self.run_manabi(expect_browser=False, FAKE_FOCUS="0", FAKE_OZONE=OZONE)
        self.assertEqual(r.returncode, 0, r.out)
        self.assertEqual([], self.browser_starts())
        # focus だけ。ozone-flag も wait も呼ばない
        self.assertEqual([focus_call("chromium")], self.win_calls())

    def test_any_other_focus_result_opens_the_app_window(self):
        self.add_browsers("brave-browser")
        for rc in ("1", "2", "3", "4", "5", "99"):
            with self.subTest(focus=rc):
                self.clear_records()
                r = self.run_manabi(expect_browser=True, FAKE_FOCUS=rc)
                self.assertEqual(r.returncode, 0, r.out)
                starts = self.browser_starts()
                self.assertEqual(1, len(starts), self.records())
                self.assertEqual(("brave-browser", [APP_ARG]), (starts[0].name, starts[0].args))
                # 開いたあとの wait は、窓が無かった（3）ときだけ。窓はあるが前に出せなかった（4）・X11 が使えない（5）・
                # 補助の不具合（1・2・その他）では、古い窓を見つけて 0 秒で終わる、または失敗して待つだけになるため呼ばない
                expected = [focus_call("chromium"), ["ozone-flag", "brave-browser"]]
                if rc == "3":
                    expected.append(wait_call("chromium"))
                self.assertEqual(expected, self.win_calls())

    def test_focus_comes_after_the_server_is_confirmed(self):
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=True, FAKE_FOCUS="3")
        self.assertEqual(r.returncode, 0, r.out)
        order = self.order()
        self.assertLess(order.index("python3-health"), order.index("python3-win"), order)

    def test_the_helper_is_given_the_log_in_the_state_dir(self):
        self.add_browsers("brave-browser")
        self.run_manabi(expect_browser=True)
        first = self.named("python3-win")[0]
        # bash の種類によってドライブ文字の書き方が違うので、末尾だけ比べる
        self.assertTrue(first.args[4].endswith("/state/manabi-no-niwa/launch.log"), first.args)
        self.assertTrue(self.launch_log.parent.is_dir())

    def test_a_missing_helper_script_starts_as_before(self):
        (self.zorin / "mnwwindow.py").unlink()
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=True, FAKE_FOCUS="0", FAKE_OZONE=OZONE)
        self.assertEqual(r.returncode, 0, r.out)
        starts = self.browser_starts()
        self.assertEqual([APP_ARG], starts[0].args)
        self.assertEqual([], self.named("python3-win"))

    def test_single_instance_off_calls_none_of_focus_ozone_flag_and_wait(self):
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=True, MANABI_SINGLE_INSTANCE="0", FAKE_FOCUS="0", FAKE_OZONE=OZONE)
        self.assertEqual(r.returncode, 0, r.out)
        starts = self.browser_starts()
        self.assertEqual(1, len(starts))
        self.assertEqual([APP_ARG], starts[0].args)
        self.assertEqual([], self.named("python3-win"))

    def test_single_instance_on_by_default_and_with_1(self):
        self.add_browsers("brave-browser")
        for value in (None, "1"):
            with self.subTest(value=value):
                self.clear_records()
                r = self.run_manabi(expect_browser=False, MANABI_SINGLE_INSTANCE=value, FAKE_FOCUS="0")
                self.assertEqual(r.returncode, 0, r.out)
                self.assertEqual([focus_call("chromium")], self.win_calls())
                self.assertEqual([], self.browser_starts())


class OzoneFlagTest(ManabiShTestBase):
    """--ozone-platform=x11 は Chromium 系の --app の前に、答えがちょうどのときだけ付く。"""

    def test_the_flag_goes_before_app_for_the_chromium_family(self):
        for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "brave-browser"):
            with self.subTest(browser=name):
                for stub in BROWSER_NAMES:
                    p = self.stubs / stub
                    if p.exists():
                        p.unlink()
                self.clear_records()
                self.add_browsers(name)
                r = self.run_manabi(expect_browser=True, FAKE_OZONE=OZONE)
                self.assertEqual(r.returncode, 0, r.out)
                starts = self.browser_starts()
                self.assertEqual(1, len(starts), self.records())
                self.assertEqual((name, [OZONE, APP_ARG]), (starts[0].name, starts[0].args))
                self.assertIn(["ozone-flag", name], self.win_calls())

    def test_only_the_exact_answer_is_used(self):
        self.add_browsers("brave-browser")
        answers = [
            "",
            "--ozone-platform=wayland",
            "--ozone-platform=x11 --no-sandbox",
            "--ozone-platform=x11\\nsecond",
            " --ozone-platform=x11",
            "--ozone-platform=x11 ",
            "--ozone-platform=X11",
            "--ozone-platform=x11;",
            "x11",
            "$(touch PWNED)",
            "`touch PWNED`",
            "; touch PWNED",
        ]
        for answer in answers:
            with self.subTest(answer=answer):
                self.clear_records()
                r = self.run_manabi(expect_browser=True, FAKE_OZONE=answer)
                self.assertEqual(r.returncode, 0, r.out)
                starts = self.browser_starts()
                self.assertEqual(1, len(starts), self.records())
                self.assertEqual([APP_ARG], starts[0].args)
                self.assertFalse((self.cwd / "PWNED").exists())
                self.assertFalse((self.tmp / "PWNED").exists())

    def test_firefox_gets_no_flag_and_is_not_asked(self):
        self.add_browsers("firefox")
        r = self.run_manabi(expect_browser=True, FAKE_OZONE=OZONE)
        self.assertEqual(r.returncode, 0, r.out)
        starts = self.browser_starts()
        self.assertEqual(("firefox", [URL]), (starts[0].name, starts[0].args))
        self.assertEqual([focus_call("firefox"), wait_call("firefox")], self.win_calls())

    def test_xdg_open_gets_no_flag_and_is_not_asked(self):
        self.add_browsers("xdg-open")
        r = self.run_manabi(expect_browser=True, FAKE_OZONE=OZONE)
        self.assertEqual(r.returncode, 0, r.out)
        starts = self.browser_starts()
        self.assertEqual(("xdg-open", [URL]), (starts[0].name, starts[0].args))
        self.assertEqual([focus_call("other"), wait_call("other")], self.win_calls())

    def test_the_chromium_family_is_preferred_over_firefox(self):
        self.add_browsers("firefox", "brave-browser")
        r = self.run_manabi(expect_browser=True, FAKE_OZONE=OZONE)
        self.assertEqual(r.returncode, 0, r.out)
        starts = self.browser_starts()
        self.assertEqual([("brave-browser", [OZONE, APP_ARG])], [(s.name, s.args) for s in starts])

    def test_manabi_browser_in_the_chromium_family(self):
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=True, MANABI_BROWSER="brave-browser --foo", FAKE_OZONE=OZONE)
        self.assertEqual(r.returncode, 0, r.out)
        starts = self.browser_starts()
        self.assertEqual(("brave-browser", ["--foo", OZONE, APP_ARG]), (starts[0].name, starts[0].args))
        self.assertIn(["ozone-flag", "brave-browser"], self.win_calls())
        # 答えが空なら足さない
        self.clear_records()
        r = self.run_manabi(expect_browser=True, MANABI_BROWSER="brave-browser --foo", FAKE_OZONE="")
        starts = self.browser_starts()
        self.assertEqual(["--foo", APP_ARG], starts[0].args)

    def test_an_explicit_ozone_platform_in_manabi_browser_is_respected(self):
        # 後ろの指定が勝つので、足すと保護者が書いた指定が黙って無視される。足さない
        self.add_browsers("brave-browser")
        for extra in ("--ozone-platform=wayland", "--ozone-platform=x11", "--ozone-platform-hint=auto"):
            with self.subTest(arg=extra):
                self.clear_records()
                r = self.run_manabi(
                    expect_browser=True, MANABI_BROWSER="brave-browser --foo " + extra, FAKE_OZONE=OZONE
                )
                self.assertEqual(r.returncode, 0, r.out)
                self.assertEqual(["--foo", extra, APP_ARG], self.browser_starts()[0].args)
        # 似ているだけの指定には反応しない
        self.clear_records()
        r = self.run_manabi(expect_browser=True, MANABI_BROWSER="brave-browser --ozone-platformx", FAKE_OZONE=OZONE)
        self.assertEqual(["--ozone-platformx", OZONE, APP_ARG], self.browser_starts()[0].args)

    def test_manabi_browser_that_is_not_chromium_gets_the_plain_address(self):
        self.add_browsers("firefox", "brave-browser")
        r = self.run_manabi(expect_browser=True, MANABI_BROWSER="firefox -P kids", FAKE_OZONE=OZONE)
        self.assertEqual(r.returncode, 0, r.out)
        starts = self.browser_starts()
        self.assertEqual([("firefox", ["-P", "kids", URL])], [(s.name, s.args) for s in starts])
        self.assertEqual([focus_call("firefox"), wait_call("firefox")], self.win_calls())

    def test_manabi_browser_that_does_not_exist_is_an_error(self):
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=False, MANABI_BROWSER="no-such-browser")
        self.assertEqual(r.returncode, 1, r.out)
        self.assertIn("MANABI_BROWSER", r.stderr)
        self.assertEqual([], self.browser_starts())

    def test_values_of_environment_variables_are_never_evaluated(self):
        self.add_browsers("brave-browser")
        (self.cwd / "a.txt").write_text("a", encoding="utf-8")
        (self.cwd / "b.txt").write_text("b", encoding="utf-8")
        r = self.run_manabi(
            expect_browser=True,
            MANABI_BROWSER="brave-browser $(touch PWNED1) `touch PWNED2` * ?",
            FAKE_OZONE=OZONE,
        )
        self.assertEqual(r.returncode, 0, r.out)
        starts = self.browser_starts()
        self.assertEqual(
            ["$(touch", "PWNED1)", "`touch", "PWNED2`", "*", "?", OZONE, APP_ARG],
            starts[0].args,
        )
        for name in ("PWNED1", "PWNED2"):
            self.assertFalse((self.cwd / name).exists(), name)


class BrowserKindTest(ManabiShTestBase):
    """使うブラウザを focus の前に決めて、種類（chromium / firefox / other）を --browser として focus と wait に渡す
    （launcher-1: Chromium 系で開く端末で、Firefox の窓を弱い一致で前に出さないため）。"""

    def remove_browsers(self):
        for stub in BROWSER_NAMES:
            p = self.stubs / stub
            if p.exists():
                p.unlink()

    def window_calls(self):
        """窓の補助に渡した focus と wait（ozone-flag は種類ではなくコマンドを渡すので除く）。"""
        return [c for c in self.win_calls() if c[0] != "ozone-flag"]

    def test_the_kind_goes_to_focus_and_to_wait_for_every_way_of_choosing_the_browser(self):
        cases = [
            # (入れておくブラウザ, 環境変数, 期待する種類)
            (("chromium",), {}, "chromium"),
            (("chromium-browser",), {}, "chromium"),
            (("google-chrome",), {}, "chromium"),
            (("google-chrome-stable",), {}, "chromium"),
            (("brave-browser",), {}, "chromium"),
            (("firefox",), {}, "firefox"),
            (("xdg-open",), {}, "other"),
            (("firefox", "xdg-open"), {}, "firefox"),  # xdg-open より Firefox
            (("xdg-open", "firefox", "brave-browser"), {}, "chromium"),  # Chromium 系がいちばん先
            (("brave-browser", "firefox"), {"MANABI_BROWSER": "firefox"}, "firefox"),  # MANABI_BROWSER が先
            (("brave-browser", "firefox"), {"MANABI_BROWSER": "brave-browser --foo"}, "chromium"),
            (("firefox",), {"MANABI_BROWSER": "firefox -P kids"}, "firefox"),
            (("xdg-open",), {"MANABI_BROWSER": "xdg-open"}, "other"),
        ]
        for browsers, env, kind in cases:
            with self.subTest(browsers=browsers, env=env):
                self.remove_browsers()
                self.clear_records()
                self.add_browsers(*browsers)
                r = self.run_manabi(expect_browser=True, **env)
                self.assertEqual(r.returncode, 0, r.out)
                self.assertEqual([focus_call(kind), wait_call(kind)], self.window_calls())

    def test_nothing_found_is_other(self):
        r = self.run_manabi(expect_browser=False)
        self.assertEqual(r.returncode, 1, r.out)
        self.assertIn("ブラウザが見つかりません", r.stderr)
        self.assertEqual([focus_call("other")], self.win_calls())

    def test_the_kind_of_manabi_browser_comes_from_the_name_of_the_first_word_only(self):
        # 先頭の語の basename だけで見る。置き場のフォルダの名前や、あとの引数の語では決めない。分からなければ other
        for name in ("my-wrapper", "my-chrome-wrapper", "firefox-esr", "xdg-open"):
            self.write_stub(name, fake_browser(name))
        for sub in ("firefox", "chromium"):
            self.write_exec(self.tmp / sub / "mybrowser", fake_browser("mybrowser"))
        cases = [
            ("firefox-esr", "firefox"),
            ("my-chrome-wrapper", "chromium"),  # *chrom* にあたる名前
            ("my-wrapper", "other"),
            ("my-wrapper --profile firefox", "other"),  # あとの引数の語は見ない
            ("my-wrapper chromium", "other"),
            ("xdg-open", "other"),
            (to_posix(self.tmp / "firefox" / "mybrowser"), "other"),  # フォルダの名前は見ない
            (to_posix(self.tmp / "chromium" / "mybrowser"), "other"),
        ]
        for value, kind in cases:
            with self.subTest(value=value):
                self.clear_records()
                r = self.run_manabi(expect_browser=False, MANABI_BROWSER=value)
                self.assertEqual(r.returncode, 0, r.out)
                self.assertEqual([focus_call(kind), wait_call(kind)], self.window_calls())
                started = [x for x in self.records() if x.name not in ("flock", "python3-win", "python3-health")]
                self.assertEqual(1, len(started), self.records())  # 起動したのは MANABI_BROWSER の 1 つだけ

    def test_a_firefox_in_a_folder_named_chromium_is_firefox(self):
        self.write_exec(self.tmp / "chromium" / "firefox", fake_browser("firefox"))
        r = self.run_manabi(expect_browser=True, MANABI_BROWSER=to_posix(self.tmp / "chromium" / "firefox"))
        self.assertEqual(r.returncode, 0, r.out)
        self.assertEqual([focus_call("firefox"), wait_call("firefox")], self.window_calls())
        self.assertEqual([URL], self.browser_starts()[0].args)  # Firefox は通常のタブ（--app を付けない）

    def test_the_value_of_manabi_browser_is_never_evaluated_while_choosing(self):
        (self.cwd / "a.txt").write_text("a", encoding="utf-8")
        values = ("$(touch PWNED1) firefox", "`touch PWNED2` firefox", "firefox; touch PWNED3", "* firefox", "? chromium")
        for value in values:
            with self.subTest(value=value):
                self.clear_records()
                # コマンドが見つからない（エラー）ので、起動はしない。決めるときに評価されていないことだけ確かめる
                r = self.run_manabi(expect_browser=False, MANABI_BROWSER=value)
                self.assertEqual(r.returncode, 1, r.out)
                self.assertEqual([], self.browser_starts())
                for name in ("PWNED1", "PWNED2", "PWNED3"):
                    self.assertFalse((self.cwd / name).exists(), name)
                    self.assertFalse((self.tmp / name).exists(), name)
                self.assertEqual(1, len([c for c in self.win_calls() if c[0] == "focus"]))

    def test_a_missing_manabi_browser_does_not_stop_a_successful_focus(self):
        # 窓がすでにあれば前に出して終わる。MANABI_BROWSER のエラーは、新しい窓を開くときだけ（今までどおり）
        for value, kind in (("no-such-browser", "other"), ("no-such-firefox", "firefox"), ("no-such-chromium", "chromium")):
            with self.subTest(value=value):
                self.clear_records()
                r = self.run_manabi(expect_browser=False, MANABI_BROWSER=value, FAKE_FOCUS="0")
                self.assertEqual(r.returncode, 0, r.out)
                self.assertNotIn("MANABI_BROWSER", r.stderr)
                self.assertEqual([focus_call(kind)], self.win_calls())

    def test_a_blank_manabi_browser_does_not_break_the_focus(self):
        # 空白だけの指定でも、種類を決めるところで落ちて前面化まで届かない、ということにはしない
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=False, MANABI_BROWSER="   ", FAKE_FOCUS="0")
        self.assertEqual(r.returncode, 0, r.out)
        self.assertEqual([focus_call("other")], self.win_calls())

    def test_the_browser_is_decided_before_focus_and_nothing_is_started_by_deciding(self):
        self.add_browsers("brave-browser", "firefox", "xdg-open")
        r = self.run_manabi(expect_browser=False, FAKE_FOCUS="0")
        self.assertEqual(r.returncode, 0, r.out)
        self.assertEqual([], self.browser_starts())
        self.assertEqual([focus_call("chromium")], self.win_calls())
        # 開くとき（focus が 3）も、focus が先で、同じ種類を wait に渡す
        self.clear_records()
        r = self.run_manabi(expect_browser=True, FAKE_FOCUS="3")
        order = self.order()
        self.assertLess(order.index("python3-win"), order.index("brave-browser"), order)
        self.assertEqual([focus_call("chromium"), ["ozone-flag", "brave-browser"], wait_call("chromium")],
                         self.win_calls())

    def test_the_arguments_are_accepted_by_the_real_mnwwindow(self):
        # 使い方の誤り（2）になると、manabi.sh は黙って「今までどおり開く」側に倒れる。本物の mnwwindow.py が
        # 受け付けること（DISPLAY が無いので focus と wait は 5）を、manabi.sh が実際に渡した引数で確かめる
        env = {k: v for k, v in os.environ.items()
               if k not in ("DISPLAY", "WAYLAND_DISPLAY") and not k.startswith("MANABI_")}
        for browsers, kind in ((("brave-browser",), "chromium"), (("firefox",), "firefox"), (("xdg-open",), "other")):
            with self.subTest(kind=kind):
                self.remove_browsers()
                self.clear_records()
                self.add_browsers(*browsers)
                r = self.run_manabi(expect_browser=True)
                self.assertEqual(r.returncode, 0, r.out)
                calls = self.window_calls()
                self.assertEqual([focus_call(kind), wait_call(kind)], calls)
                for call in calls:
                    cp = subprocess.run([sys.executable, "-I", "-B", str(ZORIN / "mnwwindow.py"), *call], env=env,
                                        stdin=subprocess.DEVNULL, capture_output=True, timeout=60)
                    self.assertEqual(5, cp.returncode, (call, cp.stderr))


class WaitTest(ManabiShTestBase):
    def test_wait_is_called_with_timeout_5_after_every_kind_of_start(self):
        cases = {
            "chromium family": (("brave-browser",), {}, "chromium"),
            "firefox": (("firefox",), {}, "firefox"),
            "xdg-open": (("xdg-open",), {}, "other"),
            "MANABI_BROWSER": (("firefox",), {"MANABI_BROWSER": "firefox"}, "firefox"),
            "MANABI_BROWSER chromium": (("brave-browser",), {"MANABI_BROWSER": "brave-browser"}, "chromium"),
        }
        for label, (browsers, env, kind) in cases.items():
            with self.subTest(case=label):
                for stub in BROWSER_NAMES:
                    p = self.stubs / stub
                    if p.exists():
                        p.unlink()
                self.clear_records()
                self.add_browsers(*browsers)
                r = self.run_manabi(expect_browser=True, **env)
                self.assertEqual(r.returncode, 0, r.out)
                waits = [c for c in self.win_calls() if c[0] == "wait"]
                self.assertEqual([wait_call(kind)], waits)

    def test_a_failing_wait_does_not_matter(self):
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=True, FAKE_WAIT="3")
        self.assertEqual(r.returncode, 0, r.out)
        self.assertEqual(1, len(self.browser_starts()))

    def test_no_browser_means_no_wait(self):
        r = self.run_manabi(expect_browser=False)
        self.assertEqual(r.returncode, 1, r.out)
        self.assertIn("ブラウザが見つかりません", r.stderr)
        self.assertEqual([focus_call("other")], self.win_calls())


class ServeTest(ManabiShTestBase):
    def test_another_program_on_the_port_stops_before_anything_else(self):
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=False, FAKE_HEALTH="2", FAKE_FOCUS="0")
        self.assertEqual(r.returncode, 1, r.out)
        self.assertIn("8765", r.stderr)
        self.assertEqual([], self.named("python3-win"))
        self.assertEqual([], self.browser_starts())

    def test_the_health_check_runs_python_in_isolated_mode(self):
        # -I : 今いるフォルダ（アイコンから開くと HOME）の json.py などを読み込まない
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=True, FAKE_HEALTH="0")
        self.assertEqual(r.returncode, 0, r.out)
        health = self.named("python3-health")
        self.assertTrue(health)
        for h in health:
            self.assertEqual(["-I", "-", "http://127.0.0.1:8765/__manabi/health"], h.args)

    def test_any_unexpected_status_from_the_health_check_is_treated_as_another_program(self):
        # 0 でも 1 でもない値（強制終了など）は「配信あり」と見なして先へ進まず、エラーにする
        self.add_browsers("brave-browser")
        for status in ("2", "42", "137"):
            with self.subTest(status=status):
                self.clear_records()
                r = self.run_manabi(expect_browser=False, FAKE_HEALTH=status, FAKE_FOCUS="0")
                self.assertEqual(r.returncode, 1, r.out)
                self.assertIn("8765", r.stderr)
                self.assertEqual([], self.named("python3-win"))
                self.assertEqual([], self.browser_starts())

    def test_the_server_is_started_when_nothing_listens(self):
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=True, FAKE_HEALTH="1")
        self.assertEqual(r.returncode, 0, r.out)
        serves = self.named("python3-serve")
        self.assertEqual(1, len(serves), self.records())
        self.assertTrue(serves[0].args[0].endswith("/serve.py"), serves[0].args)
        # 配信の起動のあとで、窓を探す
        order = self.order()
        self.assertLess(order.index("python3-serve"), order.index("python3-win"), order)
        self.assertEqual(1, len(self.browser_starts()))

    def test_the_server_is_not_started_when_it_is_already_running(self):
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=True, FAKE_HEALTH="0")
        self.assertEqual(r.returncode, 0, r.out)
        self.assertEqual([], self.named("python3-serve"))


class LockTest(ManabiShTestBase):
    """flock による 1 本ずつの起動と、鍵の fd（9）を子に渡さないこと。"""

    def test_flock_is_called_with_w_20_on_fd_9_before_anything_else(self):
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=True)
        self.assertEqual(r.returncode, 0, r.out)
        flocks = self.named("flock")
        self.assertEqual([["-w", "20", "9"]], [f.args for f in flocks])
        self.assertEqual("flock", self.order()[0])
        self.assertTrue(self.lock_file.is_file(), "鍵のファイルが XDG_RUNTIME_DIR にありません")

    def test_the_lock_falls_back_to_the_state_dir(self):
        self.add_browsers("brave-browser")
        for label, value in (("unset", None), ("missing dir", to_posix(self.tmp / "no-such-dir"))):
            with self.subTest(runtime=label):
                if self.lock_file.exists():
                    self.lock_file.unlink()
                if self.state_lock_file.exists():
                    self.state_lock_file.unlink()
                self.clear_records()
                r = self.run_manabi(expect_browser=True, XDG_RUNTIME_DIR=value)
                self.assertEqual(r.returncode, 0, r.out)
                self.assertEqual([["-w", "20", "9"]], [f.args for f in self.named("flock")])
                self.assertTrue(self.state_lock_file.is_file())
                self.assertFalse(self.lock_file.exists())

    def test_a_symbolic_link_in_place_of_the_lock_file_is_not_used(self):
        # リンクの先にファイルを作られたり、ほかのファイルを巻き込んだりしないよう、鍵なしで進む
        target = self.tmp / "elsewhere"
        try:
            os.symlink(str(target), str(self.lock_file))
        except (OSError, NotImplementedError, AttributeError):
            self.skipTest("この環境ではシンボリックリンクを作れません")
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=True)
        self.assertEqual(r.returncode, 0, r.out)
        self.assertEqual([], self.named("flock"))
        self.assertFalse(target.exists())
        self.assertEqual([APP_ARG], self.browser_starts()[0].args)

    def test_a_timeout_ends_quietly_without_doing_anything(self):
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=False, FAKE_FLOCK="1", FAKE_FOCUS="0")
        self.assertEqual(r.returncode, 0, r.out)
        self.assertEqual(["flock"], self.order())
        self.assertEqual([], self.browser_starts())

    def test_a_flock_failure_other_than_a_timeout_goes_on_without_the_lock(self):
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=True, FAKE_FLOCK="71")
        self.assertEqual(r.returncode, 0, r.out)
        starts = self.browser_starts()
        self.assertEqual([APP_ARG], starts[0].args)

    def test_it_starts_without_flock_in_the_path(self):
        self.remove_stub("flock")
        self.add_browsers("brave-browser")
        r = self.run_manabi(expect_browser=True, FAKE_OZONE=OZONE)
        self.assertEqual(r.returncode, 0, r.out)
        self.assertEqual([], self.named("flock"))
        self.assertEqual([OZONE, APP_ARG], self.browser_starts()[0].args)
        self.assertFalse(self.lock_file.exists())

    def test_the_lock_fd_is_not_passed_to_children(self):
        # 鍵の fd を子に渡すと、ブラウザが動いているあいだ鍵が外れない
        setups = {
            "chromium family": (("brave-browser",), {}),
            "firefox": (("firefox",), {}),
            "xdg-open": (("xdg-open",), {}),
            "MANABI_BROWSER": (("firefox",), {"MANABI_BROWSER": "firefox"}),
        }
        for label, (browsers, env) in setups.items():
            with self.subTest(case=label):
                for stub in BROWSER_NAMES:
                    p = self.stubs / stub
                    if p.exists():
                        p.unlink()
                self.clear_records()
                self.add_browsers(*browsers)
                r = self.run_manabi(expect_browser=True, FAKE_HEALTH="1", FAKE_OZONE=OZONE, **env)
                self.assertEqual(r.returncode, 0, r.out)
                # 対照: flock は鍵の fd を持って呼ばれる（これが open でなければ、下の closed は何も示さない）
                self.assertEqual(["open"], [f.fd9 for f in self.named("flock")], self.records())
                children = [r for r in self.records() if r.name != "flock"]
                self.assertTrue(len(children) >= 5, self.records())  # health・serve・focus・ozone-flag/wait・browser
                for rec in children:
                    self.assertEqual("closed", rec.fd9, f"{rec.name} に鍵の fd が渡っています: {self.records()}")
                self.assertEqual(1, len(self.named("python3-serve")))

    def test_the_lock_fd_is_not_passed_to_the_helper_when_focus_succeeds(self):
        r = self.run_manabi(expect_browser=False, FAKE_FOCUS="0")
        self.assertEqual(r.returncode, 0, r.out)
        wins = self.named("python3-win")
        self.assertEqual(1, len(wins))
        self.assertEqual("closed", wins[0].fd9)

    def test_the_lock_is_released_before_an_error_dialog_is_shown(self):
        # ダイアログが閉じられるまでスクリプトは終わらない。鍵を持ったままだと、そのあいだに押された次の起動が
        # 20 秒待って何も出さずに終わってしまう。だから、ダイアログ（zenity）を出す前に鍵を外す
        self.write_stub("zenity", STUB_HEAD + 'rec zenity "$@"\nexit 0\n')
        cases = {
            "port used by another program": ({"FAKE_HEALTH": "2"}, "8765"),
            "no browser": ({}, "ブラウザが見つかりません"),
            "MANABI_BROWSER missing": ({"MANABI_BROWSER": "no-such-browser"}, "MANABI_BROWSER"),
        }
        for label, (env, text) in cases.items():
            with self.subTest(case=label):
                self.clear_records()
                r = self.run_manabi(expect_browser=False, DISPLAY=":0", **env)
                self.assertEqual(r.returncode, 1, r.out)
                self.assertIn(text, r.stderr)  # 標準エラーへの出力は今までどおり残る
                # 対照: flock は鍵の fd を持って呼ばれる（これが open でなければ、下の closed は何も示さない）
                self.assertEqual(["open"], [f.fd9 for f in self.named("flock")], self.records())
                dialogs = self.named("zenity")
                self.assertEqual(1, len(dialogs), self.records())
                self.assertEqual("closed", dialogs[0].fd9, "ダイアログを出すときに鍵の fd が開いたままです")

    @unittest.skipUnless(
        sys.platform.startswith("linux") and shutil.which("flock"),
        "本物の flock が使える Linux でだけ動かす",
    )
    def test_with_the_real_flock_the_lock_is_held_while_waiting_and_released_at_exit(self):
        import fcntl

        real = tool_paths().get("flock")
        self.assertIsNotNone(real, "bash から flock が見つかりません")
        self.write_stub("flock", f'exec "{real}" "$@"\n')
        self.add_browsers("brave-browser")
        # ブラウザは 3 秒生き続ける。鍵の fd を渡していれば、manabi.sh が終わっても鍵が外れない
        r = self.run_manabi(
            expect_browser=True,
            FAKE_BROWSER_SLEEP="3",
            FAKE_PROBE_LOCK=to_posix(self.lock_file),
        )
        self.assertEqual(r.returncode, 0, r.out)
        # focus と wait のあいだ、manabi.sh は鍵を持っている
        probes = [(p.args[0], p.args[1]) for p in self.named("lockprobe")]
        self.assertEqual([("focus", "held"), ("ozone-flag", "held"), ("wait", "held")], probes)
        # 終わったあとは、ブラウザが生きていても鍵は空いている
        with open(self.lock_file, "a+b") as f:
            try:
                fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError as e:  # 鍵がまだ誰かに持たれている
                self.fail("manabi.sh が終わったのに鍵が外れていません: " + str(e))
            fcntl.flock(f, fcntl.LOCK_UN)


def _health_python() -> str:
    """manabi.sh の check_health の中の Python を取り出す（<<'PYEOF' から PYEOF まで）。"""
    text = (ZORIN / "manabi.sh").read_text(encoding="utf-8")
    m = re.search(r"<<'PYEOF'\n(.*?)\nPYEOF\n", text, re.S)
    if not m:
        raise AssertionError("check_health の Python が見つかりません")
    return m.group(1) + "\n"


class HealthCheckCodeTest(unittest.TestCase):
    """check_health の Python を本物の python で動かす（127.0.0.1 の一時のポートだけを使い、外へは出ない）。"""

    # SIGALRM の無い環境（Windows）では、同じ動き（期限が来たら 2 で終わる）の代わりを前に足して動かす。Linux では本物をそのまま使う
    SIGALRM_SHIM = (
        "import signal as _s, threading as _t, os as _o\n"
        "if not hasattr(_s, 'SIGALRM'):\n"
        "    _s.SIGALRM = 14\n"
        "    _s.signal = lambda *a, **k: None\n"
        "    def _alarm(n):\n"
        "        t = _t.Timer(n, lambda: _o._exit(2))\n"
        "        t.daemon = True\n"
        "        t.start()\n"
        "    _s.alarm = _alarm\n"
    )

    def setUp(self):
        td = tempfile.TemporaryDirectory(prefix="mnw-health-", ignore_cleanup_errors=True)
        self.addCleanup(td.cleanup)
        self.tmp = Path(td.name).resolve()
        self.code = _health_python()
        self.servers = []

    def tearDown(self):
        for srv in self.servers:
            srv.close()

    def run_code(self, url, *, code=None, isolated=True, timeout=30):
        t0 = time.monotonic()
        cmd = [sys.executable, "-B"] + (["-I"] if isolated else []) + ["-", url]
        cp = subprocess.run(
            cmd,
            input=(self.SIGALRM_SHIM + (code or self.code)).encode("utf-8"),
            capture_output=True,
            cwd=str(self.tmp),
            timeout=timeout,
        )
        return cp.returncode, time.monotonic() - t0

    def serve(self, handler):
        """接続ごとに handler(conn) を別のスレッドで動かす一時の待ち受け。-> url"""
        import socket
        import threading

        srv = socket.socket()
        srv.bind(("127.0.0.1", 0))
        srv.listen(5)
        self.servers.append(srv)

        def loop():
            while True:
                try:
                    conn, _ = srv.accept()
                except OSError:
                    return
                threading.Thread(target=handler, args=(conn,), daemon=True).start()

        threading.Thread(target=loop, daemon=True).start()
        return "http://127.0.0.1:%d/__manabi/health" % srv.getsockname()[1]

    @staticmethod
    def reply(body: bytes):
        def handler(conn):
            try:
                conn.recv(4096)
                head = b"HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Length: %d\r\n\r\n" % len(body)
                conn.sendall(head + body)
            finally:
                conn.close()

        return handler

    def test_the_apps_server_is_0_another_program_is_2_and_nothing_listening_is_1(self):
        import socket

        self.assertEqual(0, self.run_code(self.serve(self.reply(b'{"app": "manabi-no-niwa"}')))[0])
        self.assertEqual(2, self.run_code(self.serve(self.reply(b'{"app": "something-else"}')))[0])
        self.assertEqual(2, self.run_code(self.serve(self.reply(b"not json")))[0])
        # 何も待ち受けていないポート
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        self.assertEqual(1, self.run_code("http://127.0.0.1:%d/__manabi/health" % port)[0])

    def test_a_server_that_answers_one_byte_at_a_time_cannot_keep_it_waiting(self):
        # urllib の timeout は 1 回の読み書きごとの期限。全体の期限（alarm）で必ず終わる。
        # 本物の期限は 6 秒（鍵を持つ時間の上限になる）。試験は短くするため 1 秒に縮めて動かす
        import threading

        self.assertIn("signal.alarm(6)", self.code)
        stop = threading.Event()

        def trickle(conn):
            try:
                conn.recv(4096)
                for b in b"HTTP/1.0 200 OK\r\nContent-Type: application/json\r\n\r\n" + b" " * 600:
                    if stop.is_set():
                        return
                    conn.sendall(bytes([b]))
                    time.sleep(0.5)
            except OSError:
                pass
            finally:
                conn.close()

        self.addCleanup(stop.set)
        url = self.serve(trickle)
        rc, elapsed = self.run_code(url, code=self.code.replace("signal.alarm(6)", "signal.alarm(1)"))
        self.assertEqual(2, rc)
        self.assertLess(elapsed, 5.0)

    def test_python_files_in_the_current_folder_are_not_run(self):
        # アイコンから開くと、今いるフォルダは HOME。そこに json.py があっても読み込まない（-I）
        marker = self.tmp / "PWNED"
        (self.tmp / "json.py").write_text(
            "import pathlib\npathlib.Path(%r).write_text('x')\nraise SystemExit(42)\n" % str(marker),
            encoding="utf-8",
        )
        url = self.serve(self.reply(b'{"app": "manabi-no-niwa"}'))
        rc, _ = self.run_code(url)
        self.assertFalse(marker.exists(), "今いるフォルダの json.py が実行されました")
        self.assertEqual(0, rc)
        # 対照: -I を付けなければ実行されてしまう（この試験が何かを確かめていることの印）
        rc, _ = self.run_code(url, isolated=False)
        self.assertTrue(marker.exists(), "対照: -I なしでは今いるフォルダの json.py が読み込まれるはず")


if __name__ == "__main__":
    unittest.main()
