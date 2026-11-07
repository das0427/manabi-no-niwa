# -*- coding: utf-8 -*-
"""版の情報・部品の印・版の比較・計画（設計 3 章・5.6 節）"""
import copy
import json
import os
import unittest

from helpers import Release, SandboxCase, install_app
from mnwupdate import common, manifest
from mnwupdate.common import UpdateError

H = "a" * 64


def good():
    return {
        "schema": 1,
        "app": "manabi-no-niwa",
        "version": "2.2.0",
        "tag": "v2.2.0",
        "date": "2026-11-20",
        "minVersion": "2.1.0",
        "notes": ["小学4年の算数に「がい数」を足しました", "おえかきの消しゴムが太くなりました"],
        "parts": [
            {
                "kind": "main",
                "name": "manabi-no-niwa-2.2.0.zip",
                "bytes": 1000,
                "sha256": H,
                "contentId": "b" * 64,
                "files": 10,
                "unpackedBytes": 2000,
            },
            {
                "kind": "audio-g1-g2",
                "name": "manabi-no-niwa-2.2.0-audio-g1-g2.zip",
                "bytes": 5000,
                "sha256": "c" * 64,
                "contentId": "d" * 64,
                "files": 20,
                "unpackedBytes": 6000,
            },
        ],
    }


def parse(value):
    return manifest.parse_manifest(json.dumps(value, ensure_ascii=False))


def changed(path, value):
    """good() の path（['parts', 0, 'bytes'] など）を value にしたもの。value が KeyError なら欄を消す"""
    data = good()
    node = data
    for key in path[:-1]:
        node = node[key]
    if value is KeyError:
        del node[path[-1]]
    else:
        node[path[-1]] = value
    return data


class ParseManifestTest(unittest.TestCase):
    def test_good_manifest(self):
        m = parse(good())
        self.assertEqual((m.schema, m.version, m.tag, m.date, m.min_version), (1, "2.2.0", "v2.2.0", "2026-11-20", "2.1.0"))
        self.assertEqual([p.kind for p in m.parts], ["main", "audio-g1-g2"])
        self.assertEqual(m.parts[1].name, "manabi-no-niwa-2.2.0-audio-g1-g2.zip")
        self.assertEqual((m.parts[0].bytes, m.parts[0].files, m.parts[0].unpacked_bytes), (1000, 10, 2000))
        self.assertFalse(m.blocked_schema)

    def test_each_wrong_field_is_bad_manifest(self):
        wrong = {
            "schema missing": (["schema"], KeyError),
            "schema string": (["schema"], "1"),
            "schema bool": (["schema"], True),
            "schema zero": (["schema"], 0),
            "app": (["app"], "other-app"),
            "version short": (["version"], "2.2"),
            "version long": (["version"], "2.2.0.1"),
            "version prerelease": (["version"], "2.2.0-beta"),
            "version prefix": (["version"], "v2.2.0"),
            "version newline": (["version"], "2.2.0\n"),
            "version digits": (["version"], "12345.0.0"),
            "tag": (["tag"], "2.2.0"),
            "tag other": (["tag"], "v2.2.1"),
            "date format": (["date"], "2026/11/20"),
            "date impossible": (["date"], "2026-13-40"),
            "date missing": (["date"], KeyError),
            "minVersion bad": (["minVersion"], "2.1"),
            "minVersion newer": (["minVersion"], "2.3.0"),
            "notes not list": (["notes"], "text"),
            "notes six": (["notes"], ["a"] * 6),
            "notes not str": (["notes"], [1]),
            "parts empty": (["parts"], []),
            "parts not list": (["parts"], {}),
            "kind upper": (["parts", 1, "kind"], "Audio"),
            "kind leading dash": (["parts", 1, "kind"], "-audio"),
            "kind too long": (["parts", 1, "kind"], "a" * 41),
            "name mismatch main": (["parts", 0, "name"], "manabi-no-niwa-2.2.0-main.zip"),
            "name mismatch audio": (["parts", 1, "name"], "manabi-no-niwa-2.2.0-audio-g3-g4.zip"),
            "name path": (["parts", 0, "name"], "../manabi-no-niwa-2.2.0.zip"),
            "bytes zero": (["parts", 0, "bytes"], 0),
            "bytes too large": (["parts", 0, "bytes"], 2147483649),
            "bytes bool": (["parts", 0, "bytes"], True),
            "bytes float": (["parts", 0, "bytes"], 10.5),
            "sha256 upper": (["parts", 0, "sha256"], "A" * 64),
            "sha256 short": (["parts", 0, "sha256"], "a" * 63),
            "sha256 newline": (["parts", 0, "sha256"], "a" * 64 + "\n"),
            "contentId bad": (["parts", 0, "contentId"], "z" * 64),
            "files zero": (["parts", 0, "files"], 0),
            "files too many": (["parts", 0, "files"], 65535),
            "unpacked negative": (["parts", 0, "unpackedBytes"], -1),
            "unpacked too large": (["parts", 0, "unpackedBytes"], 4294967296),
            "part not object": (["parts", 1], "x"),
        }
        for label, (path, value) in wrong.items():
            with self.subTest(label):
                with self.assertRaises(UpdateError) as caught:
                    parse(changed(path, value))
                self.assertEqual(caught.exception.code, "bad-manifest")

    def test_parts_structure(self):
        data = good()
        data["parts"][1]["kind"] = "main"
        data["parts"][1]["name"] = "manabi-no-niwa-2.2.0.zip"
        with self.assertRaises(UpdateError):  # main が 2 つ・kind が重なる
            parse(data)
        data = good()
        del data["parts"][0]
        with self.assertRaises(UpdateError):  # main が無い
            parse(data)
        data = good()
        data["parts"] = [copy.deepcopy(data["parts"][0])] + [
            dict(copy.deepcopy(data["parts"][1]), kind="k%d" % i, name="manabi-no-niwa-2.2.0-k%d.zip" % i)
            for i in range(8)
        ]
        with self.assertRaises(UpdateError):  # 9 個
            parse(data)

    def test_size_and_syntax(self):
        for raw in (b"", b"not json", b"[]", b"null", b'{"schema": NaN}', b"\xff\xfe"):
            with self.subTest(raw):
                with self.assertRaises(UpdateError) as caught:
                    manifest.parse_manifest(raw)
                self.assertEqual(caught.exception.code, "bad-manifest")
        data = good()
        data["notes"] = ["x" * 100] * 5
        data["pad"] = "y" * 70000
        with self.assertRaises(UpdateError):
            parse(data)
        data["pad"] = "y" * 1000
        parse(data)  # 知らない欄は無視する

    def test_deeply_nested_json_is_bad_manifest_not_recursion_error(self):
        # 64KiB 以内の深い入れ子は json.loads が RecursionError を投げる。決まったコード（bad-manifest）にする（fetch-3）
        deep = b'{"x":' + b"[" * 30000 + b"]" * 30000 + b"}"
        self.assertLessEqual(len(deep), manifest.MAX_MANIFEST_BYTES)
        with self.assertRaises(UpdateError) as caught:
            manifest.parse_manifest(deep)
        self.assertEqual(caught.exception.code, "bad-manifest")
        # 状態・設定・印の読み取りも「読めない」として扱える（ValueError）
        with self.assertRaises(ValueError):
            common.strict_loads(deep.decode("utf-8"))
        self.assertEqual(common.strict_loads('{"a": [1]}'), {"a": [1]})

    def test_notes_are_cleaned(self):
        data = good()
        data["notes"] = ["a\x00b\x1b[31m\nc‮d e", "z" * 300, "   ", "<b>x</b>"]
        notes = parse(data).notes
        self.assertEqual(notes[0], "ab[31mcde")
        self.assertEqual(len(notes[1]), 120)
        self.assertEqual(notes[2], "<b>x</b>")  # HTML として解釈しない（文字のまま）
        self.assertEqual(len(notes), 3)  # 空になった行は捨てる

    def test_future_schema_is_blocked_but_readable(self):
        data = good()
        data["schema"] = 2
        data["parts"] = "new format"
        data["minVersion"] = "new format"
        m = parse(data)
        self.assertTrue(m.blocked_schema)
        latest = manifest.summarize_latest(m, "2.1.0", {})
        self.assertEqual((latest["newer"], latest["installable"], latest["blockedReason"]), (True, False, "schema"))
        self.assertEqual(latest["version"], "2.2.0")
        data["app"] = "other"
        with self.assertRaises(UpdateError):
            parse(data)


class VersionTest(unittest.TestCase):
    def test_compare(self):
        compare = common.compare_versions
        self.assertEqual(compare("2.10.0", "2.9.9"), 1)
        self.assertEqual(compare("2.9.9", "2.10.0"), -1)
        self.assertEqual(compare("2.1.0", "2.1.0"), 0)
        self.assertEqual(compare("10.0.0", "9.99.99"), 1)
        self.assertEqual(compare("2.0.10", "2.0.9"), 1)
        for bad in ("2.1", "x", "2.1.0-b", "", None):
            with self.assertRaises(ValueError):
                compare(bad, "2.1.0")
        self.assertIsNone(common.parse_version("2.1.0\n"))
        self.assertIsNone(common.parse_version("２.１.０"))  # 全角の数字は受け付けない


class SummaryTest(SandboxCase):
    def setUp(self):
        super().setUp()
        self.old = Release("2.1.0")
        self.new = Release("2.2.0", g34="b", notes=["a"])
        install_app(self.data, self.old)
        self.installed = manifest.load_installed_marks(self.app)

    def latest(self, current="2.1.0", release=None, installed=None):
        m = manifest.parse_manifest((release or self.new).manifest_bytes)
        return manifest.summarize_latest(m, current, self.installed if installed is None else installed)

    def test_changed_parts_by_content_id(self):
        latest = self.latest()
        changed_flags = {p["kind"]: p["changed"] for p in latest["parts"]}
        self.assertEqual(changed_flags, {"main": True, "audio-g1-g2": False, "audio-g3-g4": True})
        self.assertEqual(
            latest["downloadBytes"],
            sum(self.new.part(k).bytes for k in ("main", "audio-g3-g4")),
        )
        self.assertTrue(latest["newer"] and latest["installable"])
        self.assertIsNone(latest["blockedReason"])
        self.assertEqual(latest["notes"], ["a"])

    def test_need_bytes_formula(self):
        latest = self.latest()
        fetch_parts = [self.new.part("main"), self.new.part("audio-g3-g4")]
        expect = (
            sum(p.bytes for p in fetch_parts)
            + sum(p.unpacked_bytes for p in fetch_parts)
            + 256 * 1024 * 1024
        )
        self.assertEqual(latest["needBytes"], expect)
        plans = manifest.plan_parts(manifest.parse_manifest(self.new.manifest_bytes), self.installed)
        copied = self.new.part("audio-g1-g2").unpacked_bytes
        self.assertEqual(manifest.estimate_need(plans, link_ok=False), expect + copied)
        self.assertEqual(manifest.estimate_need(plans, True, remaining=lambda p: 0), expect - sum(p.bytes for p in fetch_parts))

    def test_nothing_installed_fetches_everything(self):
        latest = self.latest(installed={})
        self.assertTrue(all(p["changed"] for p in latest["parts"]))

    def test_newer_and_blocked(self):
        self.assertFalse(self.latest(current="2.2.0")["newer"])
        self.assertFalse(self.latest(current="2.10.0")["newer"])
        self.assertIsNone(self.latest(current="2.2.0")["blockedReason"])
        newer = Release("2.10.0", min_version="2.9.9")
        latest = self.latest(current="2.9.9", release=newer)
        self.assertTrue(latest["installable"])  # 2.10.0 > 2.9.9
        blocked = self.latest(current="2.0.2", release=self.new)
        self.assertEqual((blocked["newer"], blocked["installable"], blocked["blockedReason"]), (True, False, "min-version"))

    def test_plan_walks_roots_when_asked(self):
        m = manifest.parse_manifest(self.new.manifest_bytes)
        plans = {p.part.kind: p.action for p in manifest.plan_parts(m, self.installed, app=self.app)}
        self.assertEqual(plans, {"main": "fetch", "audio-g1-g2": "copy", "audio-g3-g4": "fetch"})
        # 音声が 1 本足りない → 印と合わないので取得に回す
        os.unlink(os.path.join(self.app, "dist", "audio", "g1-kokugo", "q2.mp3"))
        plans = {p.part.kind: p.action for p in manifest.plan_parts(m, self.installed, app=self.app)}
        self.assertEqual(plans["audio-g1-g2"], "fetch")
        # 大きさが違う
        install_app(self.data, self.old)
        with open(os.path.join(self.app, "dist", "audio", "g2-kokugo", "q1.mp3"), "ab") as f:
            f.write(b"x")
        plans = {p.part.kind: p.action for p in manifest.plan_parts(m, self.installed, app=self.app)}
        self.assertEqual(plans["audio-g1-g2"], "fetch")

    def test_plan_without_mark_or_with_other_content_id(self):
        m = manifest.parse_manifest(self.new.manifest_bytes)
        os.unlink(os.path.join(self.app, "parts", "audio-g1-g2.json"))
        marks = manifest.load_installed_marks(self.app)
        self.assertNotIn("audio-g1-g2", marks)
        self.assertEqual({p.part.kind: p.action for p in manifest.plan_parts(m, marks)}["audio-g1-g2"], "fetch")
        with open(os.path.join(self.app, "parts", "audio-g3-g4.json"), "w") as f:
            f.write("{broken")
        self.assertNotIn("audio-g3-g4", manifest.load_installed_marks(self.app))

    def test_plan_rejects_links_in_roots(self):
        link = os.path.join(self.app, "dist", "audio", "g1-kokugo", "link.mp3")
        try:
            os.symlink(os.path.join(self.app, "dist", "index.html"), link)
        except (OSError, NotImplementedError):
            self.skipTest("symlink を作れない環境")
        m = manifest.parse_manifest(self.new.manifest_bytes)
        plans = {p.part.kind: p.action for p in manifest.plan_parts(m, self.installed, app=self.app)}
        self.assertEqual(plans["audio-g1-g2"], "fetch")


class PartMarkTest(unittest.TestCase):
    def mark(self, **kw):
        base = {
            "schema": 1,
            "app": "manabi-no-niwa",
            "kind": "audio-g1-g2",
            "version": "2.2.0",
            "contentId": H,
            "files": 3,
            "unpackedBytes": 30,
            "roots": ["dist/audio/g1-kokugo"],
        }
        base.update(kw)
        return base

    def test_good_and_bad_marks(self):
        m = manifest.parse_part_mark(self.mark(), "audio-g1-g2")
        self.assertEqual((m.kind, m.files, m.roots), ("audio-g1-g2", 3, ["dist/audio/g1-kokugo"]))
        bad = {
            "kind": self.mark(kind="audio-g3-g4"),
            "schema": self.mark(schema=2),
            "app": self.mark(app="x"),
            "version": self.mark(version="2"),
            "contentId": self.mark(contentId="g" * 64),
            "files": self.mark(files=-1),
            "unpacked": self.mark(unpackedBytes="1"),
            "root outside dist": self.mark(roots=["deploy/zorin"]),
            "root dist itself": self.mark(roots=["dist"]),
            "root dotdot": self.mark(roots=["dist/../x"]),
            "root absolute": self.mark(roots=["/dist/x"]),
            "root backslash": self.mark(roots=["dist\\x"]),
            "root colon": self.mark(roots=["dist/C:"]),
            "root trailing slash": self.mark(roots=["dist/audio/"]),
            "root duplicated": self.mark(roots=["dist/a", "dist/a"]),
            "roots not list": self.mark(roots="dist/a"),
            "main with roots": self.mark(kind="main", roots=["dist/audio/x"]),
        }
        for label, value in bad.items():
            with self.subTest(label):
                with self.assertRaises(UpdateError):
                    manifest.parse_part_mark(value, "audio-g1-g2" if label != "main with roots" else "main")
        manifest.parse_part_mark(self.mark(kind="main", roots=[]), "main")


if __name__ == "__main__":
    unittest.main()
