# -*- coding: utf-8 -*-
"""README の手順3の1行（配布 zip を確かめてから開く）の試験（公開の前の点検 R1）。

- 1行は README.md から取り出す（`cd ~ && python3 -I -c '…' && bash …install.sh`）。版は1行の `v="…"` から読む。
- `python3 -I -c` の中身だけを、いま試験を動かしている Python で動かす（bash は使わない。install.sh へは進まない）。
- 一時のフォルダを HOME（Windows では USERPROFILE も）にする。本物のホームには触らない。
- ネットワークにはつながない。

実行: py -3 -B -m unittest deploy/tests/test_readme_oneliner.py -v
"""

import io
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PREFIX = "cd ~ && python3 -I -c '"
SUFFIX = "' && bash ~/manabi-no-niwa/deploy/zorin/install.sh"


def readme_line() -> str:
    lines = [
        s.strip()
        for s in (REPO / "README.md").read_text(encoding="utf-8").splitlines()
        if s.strip().startswith(PREFIX)
    ]
    if len(lines) != 1:
        raise AssertionError(f"README の手順3の1行が {len(lines)} 本ある（1本のはず）")
    return lines[0]


LINE = readme_line()
CODE = LINE[len(PREFIX) : -len(SUFFIX)] if LINE.endswith(SUFFIX) else ""
VERSION = (re.search(r'v="([^"]+)"', LINE) or [None, ""])[1]
NAMES = [
    f"manabi-no-niwa-{VERSION}{s}.zip" for s in ("", "-audio-g1-g2", "-audio-g3-g4", "-audio-g5-g6")
]
KINDS = ["main", "audio-g1-g2", "audio-g3-g4", "audio-g5-g6"]


def make_zip(kind: str, extra: "tuple[str, int] | None" = None) -> bytes:
    """配布と同じ形（最上位が manabi-no-niwa/）の小さな zip。extra=(名前, 種類のビット) で項目を1つ足す"""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"manabi-no-niwa/parts/{kind}.json", "{}")
        z.writestr(f"manabi-no-niwa/dist/audio/{kind}/a.mp3", kind)
        if extra is not None:
            info = zipfile.ZipInfo(extra[0])
            info.create_system = 3
            info.external_attr = extra[1] << 16
            z.writestr(info, "/etc/passwd" if extra[1] == 0o120777 else "EVIL")
    return buf.getvalue()


class ReadmeOneLinerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.home = Path(tempfile.mkdtemp(prefix="mnw-readme-"))
        self.addCleanup(shutil.rmtree, self.home, True)
        (self.home / "manabi-no-niwa").mkdir()
        (self.home / "manabi-no-niwa" / "old.txt").write_text("old", encoding="utf-8")
        (self.home / ".bashrc").write_text("ORIGINAL", encoding="utf-8")

    def put(self, name: str, data: bytes, folder: str = "ダウンロード") -> None:
        d = self.home / folder
        d.mkdir(exist_ok=True)
        (d / name).write_bytes(data)

    def put_good(self, folder: str = "ダウンロード") -> None:
        for name, kind in zip(NAMES, KINDS):
            self.put(name, make_zip(kind), folder)

    def snapshot(self) -> "dict[str, bytes]":
        out = {}
        for p in self.home.rglob("*"):
            rel = p.relative_to(self.home).as_posix()
            if p.is_file() and not rel.startswith(("ダウンロード/", "Downloads/")):
                out[rel] = p.read_bytes()
        return out

    def run_line(self) -> subprocess.CompletedProcess:
        env = dict(os.environ, HOME=str(self.home), USERPROFILE=str(self.home))
        return subprocess.run(
            [sys.executable, "-I", "-X", "utf8", "-c", CODE],
            env=env,
            cwd=str(self.home),
            capture_output=True,
            timeout=120,
        )

    def assert_stops(self, message: str) -> str:
        before = self.snapshot()
        r = self.run_line()
        err = r.stderr.decode("utf-8", "replace")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn(message, err)
        self.assertIn("何も", err)
        self.assertNotIn("ひらいています", r.stdout.decode("utf-8", "replace"))
        self.assertEqual(self.snapshot(), before, "ホームに何か書いた・消した")
        return err

    def test_line_shape(self) -> None:
        # 1回のコピーと貼り付けで済む1行。シェルの単一引用符の中に単一引用符を入れない
        self.assertTrue(CODE, "1行の形が `cd ~ && python3 -I -c '…' && bash …install.sh` でない")
        self.assertNotIn("'", CODE)
        self.assertNotIn("\n", LINE)
        self.assertRegex(VERSION, r"^\d+\.\d+\.\d+$")
        # 名前の型（glob）で zip を集めない
        self.assertNotIn("*", LINE)

    def test_opens_four_zips(self) -> None:
        self.put_good("ダウンロード")
        r = self.run_line()
        self.assertEqual(r.returncode, 0, r.stderr.decode("utf-8", "replace"))
        self.assertEqual(r.stdout.decode("utf-8").count("ひらいています:"), 4)
        for kind in KINDS:
            self.assertTrue((self.home / "manabi-no-niwa/dist/audio" / kind / "a.mp3").is_file())
        self.assertFalse((self.home / "manabi-no-niwa/old.txt").exists())
        self.assertEqual((self.home / ".bashrc").read_text(encoding="utf-8"), "ORIGINAL")

    def test_downloads_folder_and_split(self) -> None:
        for i, (name, kind) in enumerate(zip(NAMES, KINDS)):
            self.put(name, make_zip(kind), "Downloads" if i % 2 else "ダウンロード")
        r = self.run_line()
        self.assertEqual(r.returncode, 0, r.stderr.decode("utf-8", "replace"))
        for kind in KINDS:
            self.assertTrue((self.home / "manabi-no-niwa/dist/audio" / kind / "a.mp3").is_file())

    def test_ignores_other_zips_matching_old_glob(self) -> None:
        self.put_good()
        self.put(f"manabi-no-niwa-{VERSION}-evil.zip", make_zip("x", (".bashrc", 0o100644)))
        self.put(f"manabi-no-niwa-{VERSION} (1).zip", make_zip("x", (".profile", 0o100644)))
        r = self.run_line()
        self.assertEqual(r.returncode, 0, r.stderr.decode("utf-8", "replace"))
        self.assertEqual((self.home / ".bashrc").read_text(encoding="utf-8"), "ORIGINAL")
        self.assertFalse((self.home / ".profile").exists())
        self.assertFalse((self.home / "manabi-no-niwa/dist/audio/x").exists())

    def test_stops_on_entries_outside_the_folder(self) -> None:
        bad = [
            (".bashrc", 0o100644),
            ("manabi-no-niwa/../x", 0o100644),
            ("../../x", 0o100644),
            ("/etc/x", 0o100644),
            ("manabi-no-niwa-evil/x", 0o100644),
            ("manabi-no-niwa", 0o100644),
            ("manabi-no-niwa\\..\\..\\x", 0o100644),
            ("manabi-no-niwa/a/../../x", 0o100644),
            ("manabi-no-niwa/link", 0o120777),
        ]
        for which in (0, 3):
            for name, mode in bad:
                with self.subTest(zip=NAMES[which], entry=name):
                    self.setUp()
                    self.put_good()
                    self.put(NAMES[which], make_zip(KINDS[which], (name, mode)))
                    err = self.assert_stops("manabi-no-niwa フォルダの外に書き込むおそれ")
                    self.assertIn(NAMES[which], err)

    def test_stops_when_a_zip_is_missing(self) -> None:
        self.put_good()
        (self.home / "ダウンロード" / NAMES[2]).unlink()
        self.assertIn(NAMES[2], self.assert_stops("次のファイルがありません"))

    def test_stops_on_broken_zip(self) -> None:
        self.put_good()
        self.put(NAMES[0], make_zip(KINDS[0])[:-30])
        self.assertIn(NAMES[0], self.assert_stops("zip として開けません"))


class InstallShIsolatedTest(unittest.TestCase):
    def test_install_sh_python_is_isolated(self) -> None:
        # 今いるフォルダ（README の手順ではホーム）の json.py などを読み込まない（公開の前の点検 R2）
        text = (REPO / "deploy/zorin/install.sh").read_text(encoding="utf-8")
        calls = re.findall(r"\$\(python3 [^\n]*", text)
        self.assertTrue(calls)
        for c in calls:
            self.assertTrue(c.startswith("$(python3 -I "), c)


if __name__ == "__main__":
    unittest.main()
