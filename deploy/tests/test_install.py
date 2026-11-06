# -*- coding: utf-8 -*-
"""zip の検査と展開・写し・中身の確かめ・自己検査・空き・入れ替え（設計 5.6〜5.9 節）"""
import collections
import errno
import io
import json
import os
import shutil
import stat
import sys
import threading
import unittest
import warnings
import zipfile
from unittest import mock

from helpers import Release, SandboxCase, install_app, tree
from mnwupdate import common, install, manifest
from mnwupdate.common import Cancelled, Layout, UpdateError

PREFIX = "manabi-no-niwa/"


def raw_zip(entries):
    """entries: [(名前, 中身, 追加の指定 {attr, method, flag})]。名前をそのまま書く"""
    buf = io.BytesIO()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # 同じ名前の警告
        with zipfile.ZipFile(buf, "w") as zf:
            for name, data, opts in entries:
                info = zipfile.ZipInfo(name, (2026, 11, 20, 0, 0, 0))
                info.filename = name  # Windows では ZipInfo が \ を / に直すので、そのまま書き直す
                info.compress_type = opts.get("method", zipfile.ZIP_DEFLATED)
                info.external_attr = opts.get("attr", 0o644 << 16)
                zf.writestr(info, data)
                zf.filelist[-1].flag_bits |= opts.get("flag", 0)
    return buf.getvalue()


def base_entries():
    return [
        (PREFIX + "dist/index.html", b"<html>", {}),
        (PREFIX + "dist/sw.js", b"// sw", {}),
        (PREFIX + "deploy/zorin/serve.py", b"print(1)", {}),
        (PREFIX + "deploy/zorin/manabi.sh", b"#!/bin/sh", {}),
        (PREFIX + "README.md", b"readme", {}),
    ]


def make(entries, kind="main", roots=None, mark=None, with_mark=True, files_delta=0, unpacked=None):
    """-> (ZipFile, Part)。件数と大きさが合う zip を作り、1 か所だけ誤らせる試験に使う"""
    regular = [e for e in entries if not e[0].endswith("/")]
    size = sum(len(e[1]) for e in regular)
    cid = "e" * 64
    value = {
        "schema": 1,
        "app": "manabi-no-niwa",
        "kind": kind,
        "version": "2.2.0",
        "contentId": cid,
        "files": len(regular),
        "unpackedBytes": size,
        "roots": roots or [],
    }
    value.update(mark or {})
    everything = list(entries)
    if with_mark:
        everything.append((PREFIX + "parts/%s.json" % kind, json.dumps(value).encode(), {}))
    zf = zipfile.ZipFile(io.BytesIO(raw_zip(everything)))
    count = len(regular) + files_delta - (0 if with_mark else 1)
    part = manifest.Part(kind, "x.zip", 1000, "a" * 64, cid, count, size if unpacked is None else unpacked)
    return zf, part


class InspectZipTest(unittest.TestCase):
    def reject(self, label, detail, **kwargs):
        entries = kwargs.pop("entries", None)
        zf, part = make(entries if entries is not None else base_entries(), **kwargs)
        with self.subTest(label):
            with self.assertRaises(UpdateError) as caught:
                install.inspect_zip(zf, part)
            self.assertEqual(caught.exception.code, "unsafe-zip")
            self.assertIn(detail, caught.exception.detail)

    def with_extra(self, name, data=b"x", **opts):
        return base_entries() + [(name, data, opts)]

    def test_good_zip_passes(self):
        entries = base_entries() + [(PREFIX, b"", {"attr": 0o755 << 16 | 0x10}), (PREFIX + "dist/", b"", {})]
        zf, part = make(entries)
        found, mark = install.inspect_zip(zf, part)
        self.assertEqual(mark.kind, "main")
        self.assertEqual(sorted(rel for _, rel, is_dir in found if not is_dir)[0], "README.md")

    def test_dangerous_names(self):
        for label, name, detail in (
            ("dotdot at top", "../x", "prefix"),
            ("absolute", "/etc/x", "prefix"),
            ("no prefix", "dist/index.html", "prefix"),
            ("other prefix", "manabi/dist/x", "prefix"),
            ("drive", "C:/x", "prefix"),
            ("dotdot after prefix", PREFIX + "../x", "bad path"),
            ("dotdot in the middle", PREFIX + "a/../../x", "bad path"),
            ("dot", PREFIX + "./a", "bad path"),
            ("empty piece", PREFIX + "a//b", "bad path"),
            ("colon", PREFIX + "C:/x", "bad name"),
            ("control", PREFIX + "a\x01b", "control"),
            ("delete", PREFIX + "a\x7fb", "control"),
            ("too long", PREFIX + "a" * 400, "bad name"),
        ):
            self.reject(label, detail, entries=self.with_extra(name))

    def test_backslash_in_name(self):
        # Windows の zipfile は読むときに \ を / に直すので、読んだあとの名前を書き換えて確かめる
        zf, part = make(self.with_extra(PREFIX + "aXb"))
        for info in zf.infolist():
            info.filename = info.filename.replace("aXb", "a\\b")
        with self.assertRaises(UpdateError) as caught:
            install.inspect_zip(zf, part)
        self.assertIn("bad name", caught.exception.detail)

    def test_dangerous_types(self):
        for label, attr, detail in (
            ("symlink", (stat.S_IFLNK | 0o777) << 16, "file type"),
            ("fifo", (stat.S_IFIFO | 0o644) << 16, "file type"),
            ("char device", (stat.S_IFCHR | 0o644) << 16, "file type"),
            ("socket", (stat.S_IFSOCK | 0o644) << 16, "file type"),
        ):
            self.reject(label, detail, entries=self.with_extra(PREFIX + "dist/link", attr=attr))
        self.reject("encrypted", "encrypted", entries=self.with_extra(PREFIX + "dist/e", flag=0x1))
        self.reject("bzip2", "compression", entries=self.with_extra(PREFIX + "dist/b", method=zipfile.ZIP_BZIP2))
        self.reject("lzma", "compression", entries=self.with_extra(PREFIX + "dist/l", method=zipfile.ZIP_LZMA))

    def test_duplicates(self):
        self.reject("same name", "duplicated", entries=self.with_extra(PREFIX + "dist/index.html"))
        self.reject("case only", "duplicated", entries=self.with_extra(PREFIX + "Dist/Index.HTML"))
        self.reject(
            "file and folder",
            "duplicated",
            entries=self.with_extra(PREFIX + "dist/sw.js/", b""),
        )

    def test_counts_and_sizes(self):
        self.reject("one file too many", "file count", files_delta=-1)
        self.reject("one file too few", "file count", files_delta=1)
        self.reject("larger than declared", "size", entries=self.with_extra(PREFIX + "big.bin", b"z" * 100000), unpacked=10)
        zf, part = make(base_entries(), unpacked=0)
        part.unpacked_bytes = sum(i.file_size for i in zf.infolist()) - 64 * 1024 + 10  # 余裕の中なら通る
        install.inspect_zip(zf, part)
        flood = base_entries() + [(PREFIX + "d%d/" % i, b"", {}) for i in range(100)]
        self.reject("flood of folders", "too many entries", entries=flood)

    def test_marks(self):
        self.reject("no mark", "missing parts/main.json", with_mark=False)
        self.reject("content id", "contentId", mark={"contentId": "f" * 64})
        self.reject("kind", "mark:", mark={"kind": "audio-g1-g2"})
        self.reject("roots", "mark:", kind="audio-g1-g2", roots=["../x"])
        self.reject("not json", "mark", entries=base_entries() + [(PREFIX + "parts/main.json", b"{", {})], with_mark=False)
        self.reject("other mark", "unexpected", entries=self.with_extra(PREFIX + "parts/other.json", b"{}"))
        zf, part = make(base_entries() + [(PREFIX + "dist/audio/g3/x.mp3", b"x", {})], kind="audio-g1-g2", roots=["dist/audio/g1"])
        with self.assertRaises(UpdateError) as caught:
            install.inspect_zip(zf, part)
        self.assertIn("outside roots", caught.exception.detail)


class ExtractTest(SandboxCase):
    def extract(self, entries, **kwargs):
        zf, part = make(entries, **kwargs)
        found, _mark = install.inspect_zip(zf, part)
        os.makedirs(os.path.join(self.tmp, "next"), exist_ok=True)
        return install.extract_zip(zf, found, os.path.join(self.tmp, "next"), threading.Event())

    def test_extracts_into_app_next_only(self):
        before = tree(self.tmp)
        written = self.extract(base_entries())
        after = tree(self.tmp) - before
        self.assertGreater(written, sum(len(e[1]) for e in base_entries()))  # 部品の印の分
        self.assertTrue(all(p.startswith("next/") for p in after))
        self.assertIn("next/dist/index.html", after)
        self.assertIn("next/parts/main.json", after)
        with open(os.path.join(self.tmp, "next", "dist", "index.html"), "rb") as f:
            self.assertEqual(f.read(), b"<html>")

    @unittest.skipIf(os.name == "nt", "Windows には実行権限が無い")
    def test_permissions_ignore_the_zip(self):
        entries = [(n, d, {"attr": 0o777 << 16}) for n, d, _ in base_entries()]
        self.extract(entries)
        mode = lambda rel: stat.S_IMODE(os.stat(os.path.join(self.tmp, "next", *rel.split("/"))).st_mode)  # noqa: E731
        self.assertEqual(mode("deploy/zorin/serve.py"), 0o755)
        self.assertEqual(mode("deploy/zorin/manabi.sh"), 0o755)
        self.assertEqual(mode("dist/index.html"), 0o644)
        self.assertEqual(mode("README.md"), 0o644)

    def test_overlap_between_parts_is_content_check(self):
        self.extract(base_entries())
        with self.assertRaises(UpdateError) as caught:
            self.extract(base_entries())
        self.assertEqual(caught.exception.code, "content-check")

    def test_file_and_folder_conflict(self):
        with self.assertRaises(UpdateError) as caught:
            self.extract(base_entries() + [(PREFIX + "a", b"1", {}), (PREFIX + "a/b", b"2", {})])
        self.assertEqual(caught.exception.code, "content-check")

    def test_bad_crc_is_unsafe_zip(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zf:
            zf.writestr(PREFIX + "dist/index.html", b"AAAAAAAA")
            zf.writestr(PREFIX + "parts/main.json", json.dumps({
                "schema": 1, "app": "manabi-no-niwa", "kind": "main", "version": "2.2.0",
                "contentId": "e" * 64, "files": 1, "unpackedBytes": 8, "roots": []}))
        data = buf.getvalue().replace(b"AAAAAAAA", b"AAAABAAA")
        zf = zipfile.ZipFile(io.BytesIO(data))
        part = manifest.Part("main", "x.zip", 100, "a" * 64, "e" * 64, 1, 8)
        found, _ = install.inspect_zip(zf, part)
        with self.assertRaises(UpdateError) as caught:
            install.extract_zip(zf, found, os.path.join(self.tmp, "next"), threading.Event())
        self.assertEqual(caught.exception.code, "unsafe-zip")

    def test_cancel(self):
        zf, part = make(base_entries())
        found, _ = install.inspect_zip(zf, part)
        cancel = threading.Event()
        cancel.set()
        with self.assertRaises(Cancelled):
            install.extract_zip(zf, found, os.path.join(self.tmp, "next"), cancel)


class CopyAndVerifyTest(SandboxCase):
    def setUp(self):
        super().setUp()
        self.old = Release("2.1.0")
        install_app(self.data, self.old)
        self.mark = manifest.load_installed_marks(self.app)["audio-g1-g2"]
        self.next = os.path.join(self.base, "app.next")
        os.makedirs(self.next)

    def copy(self, link_ok=True):
        return install.copy_part(self.app, self.next, self.mark, link_ok, threading.Event())

    def test_hard_links(self):
        self.assertEqual(self.copy(), 0)  # 書いた分の大きさ 0（ハードリンクだけ）
        src = os.path.join(self.app, "dist", "audio", "g1-kokugo", "q1.mp3")
        dst = os.path.join(self.next, "dist", "audio", "g1-kokugo", "q1.mp3")
        self.assertTrue(os.path.samefile(src, dst))
        self.assertTrue(os.path.isfile(os.path.join(self.next, "parts", "audio-g1-g2.json")))
        self.assertEqual(len(tree(self.next)), self.mark.files + 1)

    def test_falls_back_to_copy_when_links_fail(self):
        with mock.patch.object(os, "link", side_effect=OSError(errno.EXDEV, "cross-device")) as link:
            copied = self.copy()
        self.assertEqual(link.call_count, 1)  # 1 回失敗したら以後は試さない
        self.assertEqual(copied, self.mark.unpacked_bytes)
        src = os.path.join(self.app, "dist", "audio", "g2-kokugo", "q1.mp3")
        dst = os.path.join(self.next, "dist", "audio", "g2-kokugo", "q1.mp3")
        self.assertFalse(os.path.samefile(src, dst))
        with open(dst, "rb") as f:
            self.assertEqual(f.read(), b"g2 q1")

    def test_check_link_support(self):
        self.assertTrue(install.check_link_support(os.path.join(self.base, "update")))
        self.assertEqual(os.listdir(os.path.join(self.base, "update")), [])
        with mock.patch.object(os, "link", side_effect=OSError("no")):
            self.assertFalse(install.check_link_support(os.path.join(self.base, "update")))
        self.assertEqual(os.listdir(os.path.join(self.base, "update")), [])

    def test_count_mismatch_and_overlap_are_content_check(self):
        os.unlink(os.path.join(self.app, "dist", "audio", "g1-kokugo", "q2.mp3"))
        with self.assertRaises(UpdateError) as caught:
            self.copy()
        self.assertEqual(caught.exception.code, "content-check")
        shutil.rmtree(self.next)
        install_app(self.data, self.old)
        os.makedirs(os.path.join(self.next, "dist", "audio", "g1-kokugo"))
        with open(os.path.join(self.next, "dist", "audio", "g1-kokugo", "q1.mp3"), "wb") as f:
            f.write(b"already here")
        with self.assertRaises(UpdateError) as caught:
            self.copy()
        self.assertEqual(caught.exception.code, "content-check")

    def test_verify_tree(self):
        new = Release("2.2.0")
        app = install_app(os.path.join(self.tmp, "other"), new)
        parsed = manifest.parse_manifest(new.manifest_bytes)
        install.verify_tree(app)
        install.verify_tree(app, parsed)
        # .desktop のアイコンと、install.sh が案内する取り消しのスクリプトも（版をまたいで変えない約束のパス）
        self.assertIn("dist/icons/icon-192.png", install.REQUIRED_FILES)
        self.assertIn("deploy/zorin/uninstall.sh", install.REQUIRED_FILES)
        for rel in install.REQUIRED_FILES:
            with self.subTest("missing " + rel):
                path = os.path.join(app, *rel.split("/"))
                os.rename(path, path + ".x")
                try:
                    with self.assertRaises(UpdateError) as caught:
                        install.verify_tree(app)
                    self.assertEqual(caught.exception.code, "content-check")
                finally:
                    os.rename(path + ".x", path)

    def test_verify_tree_mismatches(self):
        new = Release("2.2.0")
        app = install_app(os.path.join(self.tmp, "other"), new)
        parsed = manifest.parse_manifest(new.manifest_bytes)
        stale = manifest.parse_manifest(Release("2.3.0").manifest_bytes)
        with self.assertRaises(UpdateError):
            install.verify_tree(app, stale)  # parts/main.json の版が違う
        other = manifest.parse_manifest(Release("2.2.0", g34="b").manifest_bytes)
        with self.assertRaises(UpdateError):
            install.verify_tree(app, other)  # 部品の contentId が違う
        version_json = os.path.join(app, "dist", "version.json")
        with open(version_json, "w") as f:
            json.dump({"version": "x", "appVersion": "9.9.9"}, f)
        with self.assertRaises(UpdateError):
            install.verify_tree(app, parsed)  # appVersion が parts/main.json と違う
        with open(version_json, "w") as f:
            json.dump({"version": "x"}, f)
        install.verify_tree(app, parsed)  # appVersion が無ければ確かめない
        os.unlink(os.path.join(app, "dist", "audio", "g3-kokugo", "q1.mp3"))
        with self.assertRaises(UpdateError) as caught:
            install.verify_tree(app, parsed)  # packs.json の files が足りない
        self.assertIn("g3-kokugo", caught.exception.detail)

    def test_assemble_builds_the_next_tree(self):
        new = Release("2.2.0", g34="b")
        parsed = manifest.parse_manifest(new.manifest_bytes)
        plans = manifest.plan_parts(parsed, manifest.load_installed_marks(self.app), app=self.app)
        fetch = [p for p in plans if p.action == "fetch"]
        downloads = os.path.join(self.base, "update", "downloads")
        os.makedirs(downloads)
        for plan in fetch:
            with open(os.path.join(downloads, plan.part.name), "wb") as f:
                f.write(new.zips[plan.part.name])
        layout = Layout(self.app, os.path.join(self.config, "x.json"))
        seen = []
        install.assemble(layout, plans, fetch, True, threading.Event(), lambda *a: seen.append(a))
        install.verify_tree(layout.app_next, parsed)
        self.assertEqual(
            sorted(p.action for p in plans), ["copy", "fetch", "fetch"]
        )
        self.assertEqual(seen[0][0], 0)
        self.assertEqual(seen[-1][0], seen[-1][1])  # 全部書いた
        self.assertTrue(all(a[0] <= a[1] for a in seen))
        self.assertEqual(seen[-1][4], 3)
        with open(os.path.join(layout.app_next, "dist", "audio", "g3-kokugo", "q1.mp3"), "rb") as f:
            self.assertEqual(f.read(), b"g3 q1 b" * 40)
        self.assertTrue(
            os.path.samefile(
                os.path.join(self.app, "dist", "audio", "g1-kokugo", "q1.mp3"),
                os.path.join(layout.app_next, "dist", "audio", "g1-kokugo", "q1.mp3"),
            )
        )

    def test_packs_json_may_wrap_the_packs(self):
        app = install_app(os.path.join(self.tmp, "other"), Release("2.2.0"))
        path = os.path.join(app, "dist", "packs.json")
        with open(path, encoding="utf-8") as f:
            packs = json.load(f)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"packs": packs}, f)
        install.verify_tree(app)
        os.unlink(os.path.join(app, "dist", "audio", "g1-kokugo", "q1.mp3"))
        with self.assertRaises(UpdateError):
            install.verify_tree(app)

    def test_self_test_runner(self):
        script = os.path.join(self.next, "deploy", "zorin", "serve.py")
        os.makedirs(os.path.dirname(script))

        def write(source):
            with open(script, "w") as f:
                f.write(source)

        write("import sys\nsys.exit(0)\n")
        install.run_self_test(self.next)
        write("import sys\nsys.stderr.write('broken')\nsys.exit(1)\n")
        with self.assertRaises(UpdateError) as caught:
            install.run_self_test(self.next)
        self.assertEqual(caught.exception.code, "self-test")
        self.assertIn("broken", caught.exception.detail)
        write("import time\ntime.sleep(30)\n")
        with mock.patch.object(install, "SELF_TEST_TIMEOUT", 1):
            with self.assertRaises(UpdateError) as caught:
                install.run_self_test(self.next)
        self.assertIn("timeout", caught.exception.detail)

    def test_self_test_gets_the_restart_arguments_without_dir(self):
        # 再起動で渡す引数をそのまま付ける（新しい版が知らない引数なら、入れ替えの前に止まる）。--dir は除く
        script = os.path.join(self.next, "deploy", "zorin", "serve.py")
        os.makedirs(os.path.dirname(script))
        with open(script, "w") as f:
            f.write("import sys\nsys.stderr.write(repr(sys.argv[1:]))\nsys.exit(1)\n")
        with self.assertRaises(UpdateError) as caught:
            install.run_self_test(self.next, ["--port", "4801", "--dir", "/x/dist", "--dir=/y"])
        self.assertIn("['--port', '4801', '--self-test']", caught.exception.detail)
        self.assertEqual(install.self_test_args(None), [])
        self.assertEqual(install.self_test_args(["--dir"]), [])


class SpaceAndSwapTest(SandboxCase):
    def test_check_space(self):
        usage = collections.namedtuple("usage", "total used free")
        with mock.patch.object(shutil, "disk_usage", return_value=usage(10**12, 0, 1000)):
            with self.assertRaises(UpdateError) as caught:
                install.check_space(self.tmp, 1001)
            self.assertEqual(caught.exception.code, "disk-full")
            self.assertEqual(caught.exception.to_dict()["needBytes"], 1001)
            install.check_space(self.tmp, 1000)
            self.assertEqual(install.free_bytes(self.tmp), 1000)

    def make_dirs(self, with_prev=False):
        for name, text in (("app", "old"), ("app.next", "new")) + ((("app.prev", "stale"),) if with_prev else ()):
            os.makedirs(os.path.join(self.base, name))
            with open(os.path.join(self.base, name, "v.txt"), "w") as f:
                f.write(text)
        return Layout(self.app, os.path.join(self.config, "x.json"))

    def read(self, name):
        with open(os.path.join(self.base, name, "v.txt")) as f:
            return f.read()

    def swap_without_renameat2(self, layout):
        with mock.patch.object(install, "_renameat2_exchange", side_effect=OSError(errno.ENOSYS, "no")):
            install.swap_in(layout)

    def test_fallback_swap(self):
        layout = self.make_dirs(with_prev=True)
        self.swap_without_renameat2(layout)
        self.assertEqual((self.read("app"), self.read("app.prev")), ("new", "old"))
        self.assertFalse(os.path.exists(layout.app_next))

    def test_failed_second_rename_restores_the_old_version(self):
        layout = self.make_dirs(with_prev=True)
        real = os.rename

        def rename(src, dst):
            if os.path.basename(src) == "app.next":
                raise OSError(errno.EACCES, "denied")
            return real(src, dst)

        with mock.patch.object(install, "_sleep"), mock.patch.object(os, "rename", rename):
            with self.assertRaises(UpdateError) as caught:
                self.swap_without_renameat2(layout)
        self.assertEqual(caught.exception.code, "switch-failed")
        self.assertEqual((self.read("app"), self.read("app.next")), ("old", "new"))
        self.assertFalse(os.path.exists(layout.app_prev))

    def test_failed_first_rename_changes_nothing(self):
        layout = self.make_dirs()
        with mock.patch.object(install, "_sleep"), mock.patch.object(os, "rename", side_effect=OSError(errno.EACCES, "denied")):
            with self.assertRaises(UpdateError) as caught:
                self.swap_without_renameat2(layout)
        self.assertEqual(caught.exception.code, "switch-failed")
        self.assertEqual((self.read("app"), self.read("app.next")), ("old", "new"))

    def test_other_renameat2_errors_are_switch_failed(self):
        layout = self.make_dirs()
        with mock.patch.object(sys, "platform", "linux"):
            with mock.patch.object(install, "_renameat2_exchange", side_effect=OSError(errno.EPERM, "no")):
                with self.assertRaises(UpdateError) as caught:
                    install.swap_in(layout)
        self.assertEqual(caught.exception.code, "switch-failed")
        self.assertEqual(self.read("app"), "old")

    @unittest.skipUnless(os.name == "nt", "Windows だけ 0.5 秒あけて 10 回まで試す")
    def test_windows_retries_renames(self):
        layout = self.make_dirs()
        real, calls = os.rename, []

        def flaky(src, dst):
            calls.append(src)
            if len(calls) <= 3:
                raise PermissionError(13, "in use")
            return real(src, dst)

        with mock.patch.object(install, "_sleep") as sleep, mock.patch.object(os, "rename", flaky):
            install.swap_in(layout)
        self.assertEqual(sleep.call_count, 3)
        self.assertEqual((self.read("app"), self.read("app.prev")), ("new", "old"))

    @unittest.skipUnless(sys.platform.startswith("linux"), "renameat2 は Linux だけ")
    def test_renameat2_exchange(self):
        layout = self.make_dirs(with_prev=True)
        install.swap_in(layout)
        self.assertEqual((self.read("app"), self.read("app.prev")), ("new", "old"))
        self.assertFalse(os.path.exists(layout.app_next))

    def test_failed_rollback_is_switch_broken_and_keeps_both_versions(self):
        # 2 つ目の名前の変更も、元に戻すのも失敗した: どちらの版も消さない（画面は「元の版のまま」と言わない）
        layout = self.make_dirs()
        real = os.rename

        def rename(src, dst):
            if os.path.basename(src) in ("app.next", "app.prev"):
                raise OSError(errno.EACCES, "denied", src)
            return real(src, dst)

        with mock.patch.object(install, "_sleep"), mock.patch.object(os, "rename", rename):
            with self.assertRaises(UpdateError) as caught:
                self.swap_without_renameat2(layout)
        self.assertEqual(caught.exception.code, "switch-broken")
        self.assertNotIn(self.tmp, caught.exception.detail)
        self.assertFalse(os.path.exists(layout.app))
        self.assertEqual((self.read("app.prev"), self.read("app.next")), ("old", "new"))
        # 次の入れ替えは、まず前の版を app に戻してから行う（残っていた唯一の版を消さない）
        self.swap_without_renameat2(layout)
        self.assertEqual((self.read("app"), self.read("app.prev")), ("new", "old"))

    def test_recover_app(self):
        layout = self.make_dirs()
        os.rename(layout.app, layout.app_prev)
        with mock.patch.object(install, "_sleep"), mock.patch.object(os, "rename", side_effect=OSError(errno.EACCES, "denied")):
            with self.assertRaises(UpdateError) as caught:
                install.recover_app(layout)
        self.assertEqual(caught.exception.code, "switch-broken")
        self.assertEqual(self.read("app.prev"), "old")  # 消さない
        install.recover_app(layout)
        self.assertEqual(self.read("app"), "old")
        self.assertFalse(os.path.exists(layout.app_prev))
        install.recover_app(layout)  # app があれば何もしない
        self.assertEqual(self.read("app"), "old")

    def test_swap_without_any_app_is_switch_broken(self):
        layout = self.make_dirs()
        common.remove_tree(layout.app)
        with self.assertRaises(UpdateError) as caught:
            self.swap_without_renameat2(layout)
        self.assertEqual(caught.exception.code, "switch-broken")
        self.assertEqual(self.read("app.next"), "new")

    def test_prune_downloads(self):
        folder = os.path.join(self.base, "update", "downloads")
        os.makedirs(folder)
        for name in ("a.zip", "a.zip.part", "a.zip.part.json", "b.zip", "old.zip.part", "junk"):
            with open(os.path.join(folder, name), "w") as f:
                f.write("x")
        install.prune_downloads(folder, ["a.zip"])
        self.assertEqual(sorted(os.listdir(folder)), ["a.zip", "a.zip.part", "a.zip.part.json"])


if __name__ == "__main__":
    unittest.main()
