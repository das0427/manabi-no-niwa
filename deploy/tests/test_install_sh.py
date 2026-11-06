"""deploy/zorin/install.sh・uninstall.sh の試験（bash があるときだけ。Windows では Git Bash）。

設計: docs/expansion/updater-design.md の 4 章・7 章・8 章。

- 一時フォルダを HOME・XDG_DATA_HOME・XDG_CONFIG_HOME・XDG_STATE_HOME にして実行する（本物の置き場には触らない）。
- python3 は、いま試験を動かしている Python を呼ぶ小さなシェルスクリプトで用意する（PATH の先頭に置く）。
- systemctl・pkill・pgrep・xdg-user-dir も同じ場所の偽物にする（開発機で動いている本物の配信を止めないため）。
  呼ばれた内容は記録（MNW_TEST_LOG）に残して確かめる。
- 偽の配布物は、本物の deploy/zorin のスクリプトに小さな dist・parts を足して作る。
- ネットワークにはつながない。

実行: py -3 -B -m unittest deploy/tests/test_install_sh.py -v
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ZORIN = REPO / "deploy" / "zorin"
IS_WINDOWS = sys.platform == "win32"

SCRIPT_FILES = [
    "install.sh",
    "uninstall.sh",
    "manabi.sh",
    "serve.py",
    "manabi-no-niwa.desktop",
    "manabi-no-niwa.service",
]
NO_PARTS_NOTICE = "保護者画面からの更新は使えません"


def to_posix(p: Path) -> str:
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


class Result:
    def __init__(self, cp):
        self.returncode = cp.returncode
        self.stdout = cp.stdout.decode("utf-8", errors="replace")
        self.stderr = cp.stderr.decode("utf-8", errors="replace")

    @property
    def out(self) -> str:
        return self.stdout + self.stderr


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


@unittest.skipIf(BASH is None, "bash（Git Bash など）が見つからないため、試験を飛ばします")
class InstallShTestBase(unittest.TestCase):
    def setUp(self):
        td = tempfile.TemporaryDirectory(prefix="mnw-inst-", ignore_cleanup_errors=True)
        self.addCleanup(td.cleanup)
        self.tmp = Path(td.name).resolve()
        self.home = self.tmp / "home"
        self.data = self.tmp / "data"
        self.config = self.tmp / "config"
        self.state = self.tmp / "state"
        self.bin = self.tmp / "stubs"
        self.log = self.tmp / "calls.log"
        for d in (self.home, self.data, self.config, self.state, self.bin):
            d.mkdir()
        self.base = self.data / "manabi-no-niwa"
        self.app = self.base / "app"
        self.updater_json = self.config / "manabi-no-niwa" / "updater.json"
        self.desktop_file = self.data / "applications" / "manabi-no-niwa.desktop"
        self.shortcut = self.home / "Desktop" / "manabi-no-niwa.desktop"
        self.service_file = self.config / "systemd" / "user" / "manabi-no-niwa.service"
        self._write_stubs()

    # ---- 偽のコマンド ----
    def write_stub(self, name: str, body: str) -> None:
        p = self.bin / name
        write_text(p, "#!/bin/sh\n" + body)
        if not IS_WINDOWS:
            p.chmod(0o755)

    def _write_stubs(self) -> None:
        py = Path(sys.executable).as_posix()
        self.write_stub("python3", f'exec "{py}" "$@"\n')
        self.write_stub(
            "systemctl",
            'echo "systemctl $*" >> "$MNW_TEST_LOG"\n'
            'case "$*" in\n'
            '  *is-active*) if [ "${MNW_TEST_UNIT_ACTIVE:-0}" = 1 ]; then exit 0; fi; exit 3 ;;\n'
            "esac\n"
            "exit 0\n",
        )
        self.write_stub("pkill", 'echo "pkill $*" >> "$MNW_TEST_LOG"\nexit 1\n')
        self.write_stub("pgrep", "exit 1\n")
        self.write_stub("xdg-user-dir", "exit 0\n")

    def calls(self):
        if not self.log.exists():
            return []
        return self.log.read_text(encoding="utf-8").splitlines()

    # ---- 実行 ----
    def env(self, **extra):
        env = {
            k: v
            for k, v in os.environ.items()
            if not (
                k.startswith("BASH_FUNC_")
                or k.startswith("XDG_")
                or k in ("HOME", "DISPLAY", "WAYLAND_DISPLAY", "MANABI_BROWSER")
            )
        }
        env.update(
            HOME=to_posix(self.home),
            XDG_DATA_HOME=to_posix(self.data),
            XDG_CONFIG_HOME=to_posix(self.config),
            XDG_STATE_HOME=to_posix(self.state),
            MNW_TEST_LOG=to_posix(self.log),
        )
        env.update(extra)
        return env

    def run_sh(self, script: Path, *args: str, stdin: str = "", env_extra=None) -> Result:
        # PATH の先頭に偽のコマンドの場所を置いてから、スクリプトを実行する
        cmd = [
            BASH,
            "-c",
            'PATH="$1:$PATH"; shift; exec bash "$@"',
            "mnw",
            to_posix(self.bin),
            to_posix(script),
            *args,
        ]
        # 標準入力はバイトで渡す（テキストにすると Windows で改行が CR LF になり、y/N の答えが合わなくなる）
        cp = subprocess.run(
            cmd,
            input=stdin.encode("utf-8"),
            capture_output=True,
            env=self.env(**(env_extra or {})),
            cwd=str(self.tmp),
            timeout=180,
        )
        return Result(cp)

    # ---- 偽の配布物 ----
    def make_release(
        self,
        name: str,
        version: str,
        *,
        parts: bool = True,
        missing_audio: bool = False,
    ) -> Path:
        """配布 zip を展開した形の manabi-no-niwa/ を作って、そのパスを返す。"""
        root = self.tmp / ("release-" + name) / "manabi-no-niwa"
        dist = root / "dist"
        write_text(dist / "index.html", f"<!doctype html><title>manabi {version}</title>\n")
        write_text(dist / "sw.js", f"// sw {version}\n")
        write_text(dist / "version.json", json.dumps({"version": "h-" + version, "appVersion": version}))
        write_text(dist / "icons" / "icon-192.png", "png " + version)
        write_text(
            dist / "packs.json",
            json.dumps(
                {"g1-kokugo": {"files": ["audio/g1-kokugo/q1.mp3"], "bytes": 3, "hash": "h"}}
            ),
        )
        if not missing_audio:
            write_text(dist / "audio" / "g1-kokugo" / "q1.mp3", "mp3 " + version)
        # 本物のスクリプト類
        zdir = root / "deploy" / "zorin"
        zdir.mkdir(parents=True)
        for f in SCRIPT_FILES:
            shutil.copy2(ZORIN / f, zdir / f)
        if (ZORIN / "mnwupdate").is_dir():
            shutil.copytree(
                ZORIN / "mnwupdate",
                zdir / "mnwupdate",
                ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
            )
        if not (zdir / "mnwupdate" / "__init__.py").exists():
            write_text(zdir / "mnwupdate" / "__init__.py", "")
        # 消えるはずのもの
        write_text(zdir / "__pycache__" / "serve.cpython-312.pyc", "junk")
        write_text(zdir / "mnwupdate" / "__pycache__" / "x.cpython-312.pyc", "junk")
        if parts:
            for kind in ("main", "audio-g1-g2"):
                write_text(
                    root / "parts" / (kind + ".json"),
                    json.dumps(
                        {
                            "schema": 1,
                            "app": "manabi-no-niwa",
                            "kind": kind,
                            "version": version,
                            "contentId": "0" * 64,
                            "files": 1,
                            "unpackedBytes": 1,
                            "roots": [] if kind == "main" else ["dist/audio/g1-kokugo"],
                        }
                    ),
                )
        write_text(root / "licenses" / "NOTICE.txt", "notice " + version)
        write_text(root / "README.md", "# readme " + version)
        write_text(root / "LICENSE", "license " + version)
        write_text(root / "DESINGN.md", "# design " + version)
        write_text(root / "docs" / "device-checklist.md", "# checklist " + version)
        return root

    def install(self, release: Path, *args: str, **kw) -> Result:
        return self.run_sh(release / "deploy" / "zorin" / "install.sh", "--yes", *args, **kw)

    # ---- 確かめ ----
    def assert_installed(self, version: str, release: Path) -> None:
        app = self.app
        for p in (
            "dist/index.html",
            "dist/sw.js",
            "dist/version.json",
            "dist/packs.json",
            "dist/icons/icon-192.png",
            "dist/audio/g1-kokugo/q1.mp3",
            "deploy/zorin/serve.py",
            "deploy/zorin/manabi.sh",
            "deploy/zorin/install.sh",
            "deploy/zorin/uninstall.sh",
            "deploy/zorin/manabi-no-niwa.desktop",
            "deploy/zorin/manabi-no-niwa.service",
            "deploy/zorin/mnwupdate/__init__.py",
            "parts/main.json",
            "parts/audio-g1-g2.json",
            "licenses/NOTICE.txt",
            "README.md",
            "LICENSE",
            "DESINGN.md",
            "docs/device-checklist.md",
        ):
            self.assertTrue((app / p).is_file(), p + " がありません")
        self.assertEqual(read_json(app / "parts" / "main.json")["version"], version)
        self.assertEqual(read_json(app / "dist" / "version.json")["appVersion"], version)
        # 更新の途中のもの・前の版の控えが残っていない
        for name in ("app.prev", "app.next", "update"):
            self.assertFalse((self.base / name).exists(), name + " が残っています")
        # __pycache__ を持ち込まない
        self.assertEqual([], list(app.rglob("__pycache__")))
        # deploy/zorin は配布物と同じ中身（フォルダごと）
        src = release / "deploy" / "zorin"
        want = sorted(
            str(p.relative_to(src)) for p in src.rglob("*") if p.is_file() and "__pycache__" not in p.parts
        )
        got = sorted(str(p.relative_to(app / "deploy" / "zorin")) for p in (app / "deploy" / "zorin").rglob("*") if p.is_file())
        self.assertEqual(want, got)
        for rel in want:
            self.assertEqual((src / rel).read_bytes(), (app / "deploy" / "zorin" / rel).read_bytes(), rel)
        if not IS_WINDOWS:
            for f in ("serve.py", "manabi.sh", "install.sh", "uninstall.sh"):
                self.assertTrue(os.access(app / "deploy" / "zorin" / f, os.X_OK), f + " に実行権限がありません")

    def assert_icons(self) -> None:
        app_posix = to_posix(self.app)
        for f in (self.desktop_file, self.shortcut):
            self.assertTrue(f.is_file(), str(f))
            text = f.read_text(encoding="utf-8")
            self.assertNotIn("@APP_DIR@", text)
            self.assertIn(f'Exec="{app_posix}/deploy/zorin/manabi.sh"', text)
            self.assertIn(f"Icon={app_posix}/dist/icons/icon-192.png", text)


class SyntaxTest(InstallShTestBase):
    def test_bash_syntax(self):
        for f in ("install.sh", "uninstall.sh", "manabi.sh"):
            with self.subTest(script=f):
                cp = subprocess.run([BASH, "-n", to_posix(ZORIN / f)], capture_output=True, text=True, encoding="utf-8", errors="replace")
                self.assertEqual(cp.returncode, 0, cp.stderr)

    def test_help_prints_header_only(self):
        for f in ("install.sh", "uninstall.sh"):
            with self.subTest(script=f):
                r = self.run_sh(ZORIN / f, "--help")
                self.assertEqual(r.returncode, 0, r.out)
                self.assertIn("bash " + f, r.stdout)
                self.assertNotIn("set -euo", r.stdout)
                self.assertFalse(self.base.exists())

    def test_unknown_option_is_rejected(self):
        r = self.run_sh(ZORIN / "install.sh", "--nope")
        self.assertEqual(r.returncode, 1)
        self.assertIn("不明な指定", r.stderr)


class InstallTest(InstallShTestBase):
    def test_fresh_install_builds_the_layout(self):
        rel = self.make_release("a", "2.1.0")
        r = self.install(rel)
        self.assertEqual(r.returncode, 0, r.out)
        self.assert_installed("2.1.0", rel)
        self.assert_icons()
        self.assertNotIn(NO_PARTS_NOTICE, r.out)
        # 決められた場所だけに書いている（自動起動は頼んでいないので systemd の単位も作らない）
        self.assertEqual({"Desktop"}, {p.name for p in self.home.iterdir()})
        self.assertEqual({"applications", "manabi-no-niwa"}, {p.name for p in self.data.iterdir()})
        self.assertEqual({"app"}, {p.name for p in self.base.iterdir()})
        self.assertEqual([], list(self.config.rglob("*")))
        self.assertEqual([], list(self.state.rglob("*")))
        self.assertFalse(self.service_file.exists())

    def test_reinstall_replaces_the_app_and_removes_leftovers(self):
        a = self.make_release("a", "2.1.0")
        self.assertEqual(self.install(a).returncode, 0)
        # 前回の更新の残り物と、古い版にだけあるファイル
        write_text(self.base / "update" / "downloads" / "manabi-no-niwa-2.2.0.zip.part", "part")
        write_text(self.base / "update" / "state.json", "{}")
        write_text(self.base / "update" / "lock", "")
        write_text(self.base / "app.prev" / "old.txt", "old")
        write_text(self.base / "app.next" / "deploy" / "zorin" / "serve.py", "half built")
        write_text(self.app / "dist" / "stale.txt", "stale")
        write_text(self.app / "parts" / "audio-g9-g9.json", "{}")
        write_text(self.app / "extra.txt", "extra")
        # 更新の設定は引き継ぐ
        write_text(self.updater_json, '{"schema":1,"autoCheck":false}')

        b = self.make_release("b", "2.2.0")
        r = self.install(b)
        self.assertEqual(r.returncode, 0, r.out)
        self.assert_installed("2.2.0", b)
        self.assertFalse((self.app / "dist" / "stale.txt").exists())
        self.assertFalse((self.app / "parts" / "audio-g9-g9.json").exists())
        self.assertFalse((self.app / "extra.txt").exists())
        self.assertEqual(self.updater_json.read_text(encoding="utf-8"), '{"schema":1,"autoCheck":false}')
        self.assertEqual("2.2.0", read_json(self.app / "parts" / "main.json")["version"])
        self.assert_icons()

    def test_old_2_0_x_layout_is_replaced_as_a_whole(self):
        # 2.0.x の配置: app/dist と app/deploy/zorin だけ（parts も mnwupdate も無い）
        write_text(self.app / "dist" / "index.html", "old")
        write_text(self.app / "dist" / "only-in-old.js", "old")
        write_text(self.app / "deploy" / "zorin" / "serve.py", "old serve")
        write_text(self.app / "deploy" / "zorin" / "only-in-old.sh", "old")
        rel = self.make_release("a", "2.1.0")
        r = self.install(rel)
        self.assertEqual(r.returncode, 0, r.out)
        self.assert_installed("2.1.0", rel)
        self.assertFalse((self.app / "dist" / "only-in-old.js").exists())
        self.assertFalse((self.app / "deploy" / "zorin" / "only-in-old.sh").exists())
        self.assertNotEqual("old serve", (self.app / "deploy" / "zorin" / "serve.py").read_text(encoding="utf-8"))

    def test_without_parts_it_continues_and_says_updates_are_unavailable(self):
        rel = self.make_release("a", "2.1.0", parts=False)
        r = self.install(rel)
        self.assertEqual(r.returncode, 0, r.out)
        self.assertIn(NO_PARTS_NOTICE, r.stdout)
        self.assertIn("配布 zip から入れたときだけ使えます", r.stdout)
        self.assertTrue((self.app / "dist" / "index.html").is_file())
        self.assertTrue((self.app / "deploy" / "zorin" / "mnwupdate" / "__init__.py").is_file())
        self.assertFalse((self.app / "parts").exists())
        self.assert_icons()

    def test_mnwupdate_is_required(self):
        rel = self.make_release("a", "2.1.0")
        (rel / "deploy" / "zorin" / "mnwupdate" / "__init__.py").unlink()
        r = self.install(rel)
        self.assertEqual(r.returncode, 1)
        self.assertIn("mnwupdate/__init__.py", r.stderr)
        self.assertFalse(self.base.exists())

    def test_missing_audio_stops_before_changing_anything(self):
        a = self.make_release("a", "2.1.0")
        self.assertEqual(self.install(a).returncode, 0)
        write_text(self.app / "marker.txt", "keep")
        b = self.make_release("b", "2.2.0", missing_audio=True)
        r = self.install(b)
        self.assertEqual(r.returncode, 1)
        self.assertIn("教材の音声が足りません", r.stderr)
        self.assertIn("audio-g1-g2", r.stderr)
        self.assertTrue((self.app / "marker.txt").is_file())
        self.assertEqual("2.1.0", read_json(self.app / "parts" / "main.json")["version"])
        self.assertFalse((self.base / "app.next").exists())

    def test_the_prompt_lists_what_will_happen_and_no_answer_changes_nothing(self):
        rel = self.make_release("a", "2.1.0")
        for stdin in ("n\n", "", "\n"):
            with self.subTest(stdin=stdin):
                r = self.run_sh(rel / "deploy" / "zorin" / "install.sh", stdin=stdin)
                self.assertEqual(r.returncode, 0, r.out)
                self.assertIn("中止しました", r.stdout)
                for phrase in (
                    "sudo",
                    "動いている配信",
                    "新しい版で始め直",
                    "前の版の控え・更新の作業用のフォルダ",
                    "app.prev",
                    "app.next",
                    "update",
                    "オフにできます",
                    "127.0.0.1:8765",
                ):
                    self.assertIn(phrase, r.stdout)
                self.assertFalse(self.base.exists())
                self.assertEqual([], list(self.home.iterdir()))

    def test_answering_yes_installs(self):
        rel = self.make_release("a", "2.1.0")
        r = self.run_sh(rel / "deploy" / "zorin" / "install.sh", stdin="y\n")
        self.assertEqual(r.returncode, 0, r.out)
        self.assert_installed("2.1.0", rel)

    def test_refuses_to_run_from_inside_the_install_place(self):
        rel = self.make_release("a", "2.1.0")
        places = {
            "app": self.base / "app",
            "app.prev": self.base / "app.prev",
            "app.next": self.base / "app.next",
            "update": self.base / "update" / "downloads" / "manabi-no-niwa",
        }
        for name, place in places.items():
            with self.subTest(place=name):
                if self.base.exists():
                    shutil.rmtree(self.base)
                shutil.copytree(rel, place)
                write_text(place / "marker.txt", "keep")
                r = self.run_sh(place / "deploy" / "zorin" / "install.sh", "--yes")
                self.assertEqual(r.returncode, 1, r.out)
                self.assertIn("中から実行しています", r.stderr)
                self.assertTrue((place / "marker.txt").is_file())
                self.assertEqual([], self.calls())

    def test_a_running_unit_is_stopped_then_started_again(self):
        rel = self.make_release("a", "2.1.0")
        r = self.install(rel, env_extra={"MNW_TEST_UNIT_ACTIVE": "1"})
        self.assertEqual(r.returncode, 0, r.out)
        calls = self.calls()
        unit = "manabi-no-niwa.service"
        is_active = calls.index(f"systemctl --user is-active --quiet {unit}")
        stop = calls.index(f"systemctl --user stop {unit}")
        pkill = [i for i, c in enumerate(calls) if c.startswith("pkill ")]
        start = calls.index(f"systemctl --user start {unit}")
        self.assertEqual(1, len(pkill), calls)
        self.assertTrue(is_active < stop < pkill[0] < start, calls)
        # 手で起動した配信は、この配置先の serve.py だけを自分のユーザーで止める（パスの記号はエスケープ）
        m = re.match(r"^pkill -u (\d+) -f (.+)$", calls[pkill[0]])
        self.assertIsNotNone(m, calls[pkill[0]])
        self.assertTrue(m.group(2).endswith(r"/manabi-no-niwa/app/deploy/zorin/serve\.py"), m.group(2))
        self.assertIn("始め直しました", r.stdout)
        self.assert_installed("2.1.0", rel)

    def test_no_running_unit_means_no_stop_and_no_start(self):
        rel = self.make_release("a", "2.1.0")
        r = self.install(rel)
        self.assertEqual(r.returncode, 0, r.out)
        calls = self.calls()
        self.assertIn("systemctl --user is-active --quiet manabi-no-niwa.service", calls)
        self.assertFalse([c for c in calls if " stop " in c or " start " in c or " enable " in c], calls)
        self.assertEqual(1, len([c for c in calls if c.startswith("pkill ")]))

    def test_autostart_writes_the_unit_pointing_at_app(self):
        rel = self.make_release("a", "2.1.0")
        r = self.install(rel, "--autostart", env_extra={"MNW_TEST_UNIT_ACTIVE": "1"})
        self.assertEqual(r.returncode, 0, r.out)
        text = self.service_file.read_text(encoding="utf-8")
        self.assertNotIn("@APP_DIR@", text)
        self.assertIn(f'serve.py"', text)
        self.assertIn(to_posix(self.app) + "/deploy/zorin/serve.py", text)
        calls = self.calls()
        self.assertIn("systemctl --user daemon-reload", calls)
        self.assertIn("systemctl --user enable --now manabi-no-niwa.service", calls)
        # 止めていた単位は、最後に始め直す
        self.assertEqual("systemctl --user start manabi-no-niwa.service", calls[-1])

    def test_a_failure_while_building_keeps_the_current_app_and_restarts_the_unit(self):
        a = self.make_release("a", "2.1.0")
        self.assertEqual(self.install(a).returncode, 0)
        write_text(self.app / "marker.txt", "keep")
        self.log.unlink()
        # cp が失敗する
        self.write_stub(
            "cp",
            'if [ -n "${MNW_TEST_FAIL_CP:-}" ]; then echo "cp: 試験のための失敗" >&2; exit 1; fi\n'
            'PATH="${PATH#*:}"\nexec cp "$@"\n',
        )
        b = self.make_release("b", "2.2.0")
        r = self.install(b, env_extra={"MNW_TEST_FAIL_CP": "1", "MNW_TEST_UNIT_ACTIVE": "1"})
        self.assertNotEqual(r.returncode, 0, r.out)
        self.assertIn("今までの版は、そのまま残してあります", r.stderr)
        self.assertTrue((self.app / "marker.txt").is_file())
        self.assertEqual("2.1.0", read_json(self.app / "parts" / "main.json")["version"])
        self.assertFalse((self.base / "app.next").exists())
        self.assertFalse((self.base / "app.prev").exists())
        # 止めた単位は、元の版のままでも始め直す
        self.assertEqual("systemctl --user start manabi-no-niwa.service", self.calls()[-1])


class UninstallTest(InstallShTestBase):
    def installed(self, *args: str) -> Path:
        rel = self.make_release("a", "2.1.0")
        r = self.install(rel, *args)
        self.assertEqual(r.returncode, 0, r.out)
        return rel

    def add_update_leftovers(self) -> None:
        write_text(self.base / "app.prev" / "old.txt", "old")
        write_text(self.base / "app.next" / "half.txt", "half")
        write_text(self.base / "update" / "downloads" / "z.part", "part")
        write_text(self.base / "update" / "state.json", "{}")
        write_text(self.updater_json, '{"schema":1,"autoCheck":true}')
        write_text(self.state / "manabi-no-niwa" / "serve.log", "log")

    def uninstall_script(self) -> Path:
        # README の案内どおり、入れたものの中の uninstall.sh を使う（自分自身も消える）
        return self.app / "deploy" / "zorin" / "uninstall.sh"

    def test_removes_the_app_the_update_leftovers_and_the_settings(self):
        self.installed("--autostart")
        self.add_update_leftovers()
        self.assertTrue(self.service_file.is_file())
        self.log.unlink()

        r = self.run_sh(self.uninstall_script(), "--yes")
        self.assertEqual(r.returncode, 0, r.out)
        for p in (
            self.app,
            self.base / "app.prev",
            self.base / "app.next",
            self.base / "update",
            self.base,  # 空になったので rmdir される
            self.config / "manabi-no-niwa",
            self.state / "manabi-no-niwa",
            self.desktop_file,
            self.shortcut,
            self.service_file,
        ):
            self.assertFalse(p.exists(), str(p) + " が残っています")
        calls = self.calls()
        self.assertIn("systemctl --user disable --now manabi-no-niwa.service", calls)
        self.assertEqual(1, len([c for c in calls if c.startswith("pkill ")]))
        self.assertIn("学習データ", r.stdout)

    def test_keeps_a_base_folder_that_is_not_empty(self):
        self.installed()
        write_text(self.base / "mine.txt", "not ours")
        r = self.run_sh(self.uninstall_script(), "--yes")
        self.assertEqual(r.returncode, 0, r.out)
        self.assertFalse(self.app.exists())
        self.assertTrue((self.base / "mine.txt").is_file())

    def test_the_prompt_lists_everything_and_no_answer_changes_nothing(self):
        self.installed()
        self.add_update_leftovers()
        r = self.run_sh(self.uninstall_script(), stdin="n\n")
        self.assertEqual(r.returncode, 0, r.out)
        for phrase in ("app.prev", "app.next", "update", "updater.json", "学習データ", "sudo"):
            self.assertIn(phrase, r.stdout)
        self.assertIn(to_posix(self.base) + "/app.prev", r.stdout)
        self.assertIn(to_posix(self.config) + "/manabi-no-niwa", r.stdout)
        self.assertIn("中止しました", r.stdout)
        for p in (self.app, self.base / "app.prev", self.base / "app.next", self.base / "update", self.updater_json):
            self.assertTrue(p.exists(), str(p))

    def test_uninstall_without_anything_installed_is_harmless(self):
        r = self.run_sh(ZORIN / "uninstall.sh", "--yes")
        self.assertEqual(r.returncode, 0, r.out)
        self.assertFalse(self.base.exists())


if __name__ == "__main__":
    unittest.main()
