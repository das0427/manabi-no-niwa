# -*- coding: utf-8 -*-
"""取得先の確かめ・転送先の許可リスト・偽の GitHub での取得（設計 3.3・3.4・5.6 節）"""
import errno
import hashlib
import os
import socket
import threading
import time
import unittest
from unittest import mock

from helpers import MANIFEST_PATH, FakeGitHub, Release, SandboxCase
from mnwupdate import fetch, manifest
from mnwupdate.common import Cancelled, UpdateError


def code_of(callable_, *args, **kwargs):
    with unittest.TestCase().assertRaises(UpdateError) as caught:
        callable_(*args, **kwargs)
    return caught.exception.code


class TestOriginTest(unittest.TestCase):
    def test_accepted_forms(self):
        for value in ("http://127.0.0.1:4801", "http://127.0.0.1:1", "http://127.0.0.1:65535"):
            with self.subTest(value):
                endpoint = fetch.endpoint_from_env({"MANABI_UPDATE_TEST_ORIGIN": value})
                self.assertTrue(endpoint.test)
                self.assertEqual(endpoint.origin, value)

    def test_rejected_forms(self):
        for value in (
            "http://localhost:4801",
            "http://127.0.0.2:4801",
            "https://127.0.0.1:4801",
            "http://127.0.0.1:0",
            "http://127.0.0.1:70000",
            "http://127.0.0.1:65536",
            "http://127.0.0.1",
            "http://127.0.0.1:4801/",
            "http://127.0.0.1:4801/x",
            "http://user@127.0.0.1:4801",
            "http://127.0.0.1:4801@evil.example",
            "http://[::1]:4801",
            "http://127.0.0.1:48a1",
            " http://127.0.0.1:4801",
            "http://127.0.0.1:4801\n",
            "http://127.0.0.1:123456",
        ):
            with self.subTest(value):
                self.assertEqual(
                    code_of(fetch.endpoint_from_env, {"MANABI_UPDATE_TEST_ORIGIN": value}),
                    "bad-test-origin",
                )

    def test_empty_means_github(self):
        for env in ({}, {"MANABI_UPDATE_TEST_ORIGIN": ""}):
            endpoint = fetch.endpoint_from_env(env)
            self.assertFalse(endpoint.test)
            self.assertEqual(endpoint.origin, "https://github.com")

    def test_urls(self):
        endpoint = fetch.endpoint_from_env({})
        self.assertEqual(
            endpoint.manifest_url(),
            "https://github.com/das0427/manabi-no-niwa/releases/latest/download/manabi-no-niwa-update.json",
        )
        self.assertEqual(
            endpoint.part_url("v2.2.0", "manabi-no-niwa-2.2.0-audio-g1-g2.zip"),
            "https://github.com/das0427/manabi-no-niwa/releases/download/v2.2.0/manabi-no-niwa-2.2.0-audio-g1-g2.zip",
        )
        for tag, name in (("v2.2.0/../x", "manabi-no-niwa-2.2.0.zip"), ("v2.2.0", "../x.zip"), ("2.2.0", "a.zip")):
            self.assertEqual(code_of(endpoint.part_url, tag, name), "bad-manifest")
        test = fetch.endpoint_from_env({"MANABI_UPDATE_TEST_ORIGIN": "http://127.0.0.1:4801"})
        self.assertEqual(
            test.manifest_url(),
            "http://127.0.0.1:4801/das0427/manabi-no-niwa/releases/latest/download/manabi-no-niwa-update.json",
        )


class AllowListTest(unittest.TestCase):
    def test_github_allow_list(self):
        endpoint = fetch.endpoint_from_env({})
        for url in (
            "https://github.com/das0427/manabi-no-niwa/releases/download/v1.0.0/a.zip",
            "https://github.com/das0427/manabi-no-niwa/releases/latest/download/manabi-no-niwa-update.json",
            # 本物の転送の形（2026-11-07 に GitHub で確かめた。1431752170 はこのリポジトリの番号）
            "https://release-assets.githubusercontent.com/github-production-release-asset/1431752170/"
            "75d6a830-0344-4f88-ad97-f2ddb925435c?sp=r&sv=2018-11-09&sig=x",
            "https://objects.githubusercontent.com/github-production-release-asset-2e65be/1431752170/abc-def?X=1",
            "https://GITHUB.COM/das0427/manabi-no-niwa/releases/download/v2.2.0/a.zip",
            "https://github.com:443/das0427/manabi-no-niwa/releases/download/v2.2.0/a.zip",
            endpoint.manifest_url(),
            endpoint.part_url("v2.2.0", "manabi-no-niwa-2.2.0-audio-g5-g6.zip"),
        ):
            with self.subTest(url):
                endpoint.check_url(url)
        for url in (
            # ホストは合っているが、このリポジトリのリリースの道でない（リポジトリの名前を取り直された場合など）
            "https://github.com/x",
            "https://github.com/login",
            "https://github.com/someone-else/evil/releases/download/v2.2.0/manabi-no-niwa-2.2.0.zip",
            "https://github.com/das0427/manabi-no-niwa-evil/releases/download/v2.2.0/a.zip",
            "https://github.com/das0427/manabi-no-niwa/releases/download/v2.2.0/../../../evil/a.zip",
            "https://github.com/das0427/manabi-no-niwa/releases/download/v2.2.0/%2e%2e/a.zip",
            "https://github.com/das0427/manabi-no-niwa/releases/download/2.2.0/a.zip",
            "https://github.com/das0427/manabi-no-niwa/releases/tag/v2.2.0",
            "https://github.com/das0427/manabi-no-niwa/archive/refs/heads/main.zip",
            "https://release-assets.githubusercontent.com/x/y",
            "https://release-assets.githubusercontent.com/github-production-release-asset/999/uuid",
            "https://release-assets.githubusercontent.com/github-production-release-asset/14317521700/uuid",
            "https://release-assets.githubusercontent.com/github-production-release-asset/1431752170",
            "https://release-assets.githubusercontent.com/github-production-release-asset/1431752170/../x",
            "https://release-assets.githubusercontent.com/github-production-release-asset/1431752170/%2e/x",
            "https://objects.githubusercontent.com/github-production-release-asset/1?X=1",
        ):
            with self.subTest(url):
                self.assertEqual(code_of(endpoint.check_url, url), "redirect-host")
        for url in (
            "https://github.com.evil.example/x",
            "https://evilgithub.com/x",
            "https://notobjects.githubusercontent.com/x",
            "https://githubusercontent.com/x",
            "https://evil.example/x",
            "http://github.com/x",
            "https://github.com:8443/x",
            "https://u@github.com/x",
            "https://u:p@github.com/x",
            "https://github.com@evil.example/x",
            "https://evil.example@github.com/x",
            "ftp://github.com/x",
            "file:///etc/passwd",
            "https://127.0.0.1/x",
            "https://[::1]/x",
            "//github.com/x",
            "/relative",
        ):
            with self.subTest(url):
                self.assertEqual(code_of(endpoint.check_url, url), "redirect-host")

    def test_test_origin_allows_only_itself(self):
        endpoint = fetch.endpoint_from_env({"MANABI_UPDATE_TEST_ORIGIN": "http://127.0.0.1:4801"})
        endpoint.check_url("http://127.0.0.1:4801/anything")
        for url in (
            "http://127.0.0.1:4802/x",
            "http://127.0.0.2:4801/x",
            "https://127.0.0.1:4801/x",
            "https://github.com/x",
            "http://localhost:4801/x",
            "http://u@127.0.0.1:4801/x",
        ):
            with self.subTest(url):
                self.assertEqual(code_of(endpoint.check_url, url), "redirect-host")


class FakeCase(SandboxCase):
    def setUp(self):
        super().setUp()
        patcher = mock.patch.object(fetch, "RETRY_DELAYS", (0, 0, 0))
        patcher.start()
        self.addCleanup(patcher.stop)
        self.fake = FakeGitHub()
        self.addCleanup(self.fake.stop)
        self.release = Release("2.2.0")
        self.fake.set_release(self.release)
        self.fetcher = fetch.Fetcher(fetch.Endpoint(self.fake.origin, True))
        self.downloads = os.path.join(self.tmp, "downloads")
        self.cancel = threading.Event()

    def download(self, kind="main", progress=None, release=None):
        release = release or self.release
        part = manifest.parse_manifest(release.manifest_bytes).parts
        part = next(p for p in part if p.kind == kind)
        return part, self.fetcher.download_part(part, "v" + release.version, self.downloads, self.cancel, progress)


class FetchManifestTest(FakeCase):
    def test_follows_two_redirects_and_sends_only_an_agent_name(self):
        data = self.fetcher.fetch_manifest()
        self.assertEqual(data, self.release.manifest_bytes)
        self.assertEqual(
            [r["path"] for r in self.fake.log],
            [MANIFEST_PATH, "/hop1/manifest", "/hop2/manifest", "/blob/manifest"],
        )
        for record in self.fake.log:
            self.assertEqual(record["ua"], "manabi-no-niwa-updater")
            self.assertIsNone(record["cookie"])
            self.assertNotIn("?", record["path"])

    def test_not_found_means_no_manifest(self):
        self.fake.manifest = None
        self.assertIsNone(self.fetcher.fetch_manifest())

    def test_redirect_to_other_host_is_refused(self):
        for target in ("http://127.0.0.2:%d/x" % self.fake.port, "https://github.com/x", "http://evil.example/x"):
            with self.subTest(target):
                self.fake.redirect_to = target
                self.fake.log.clear()
                self.assertEqual(code_of(self.fetcher.fetch_manifest), "redirect-host")
                self.assertEqual(len(self.fake.log), 1)  # 転送先へは行かない

    def test_too_many_redirects(self):
        self.fake.hops = 5  # 最初の要求の転送を入れて 6 回
        self.assertEqual(code_of(self.fetcher.fetch_manifest), "redirect-host")
        self.fake.hops = 4  # 5 回までは辿る
        self.assertEqual(self.fetcher.fetch_manifest(), self.release.manifest_bytes)

    def test_http_error_and_offline(self):
        self.fake.force_status[MANIFEST_PATH] = 503
        self.assertEqual(code_of(self.fetcher.fetch_manifest), "http")
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            closed = s.getsockname()[1]
        offline = fetch.Fetcher(fetch.Endpoint("http://127.0.0.1:%d" % closed, True))
        self.assertEqual(code_of(offline.fetch_manifest), "offline")

    def test_oversized_manifest(self):
        self.fake.manifest = b"{" + b" " * 70000 + b"}"
        self.assertEqual(code_of(self.fetcher.fetch_manifest), "bad-manifest")

    def test_deeply_nested_manifest_is_bad_manifest_not_recursion_error(self):
        # 64KiB 以内の深い入れ子は json.loads が RecursionError を投げる。転送先のタグと比べる道でも、
        # 版の情報を確かめる道でも、決まったコード（bad-manifest）にする（fetch-3）
        deep = b'{"tag":"v2.2.0","x":' + b"[" * 30000 + b"]" * 30000 + b"}"
        self.assertLessEqual(len(deep), manifest.MAX_MANIFEST_BYTES)
        self.fake.tag_redirect = True
        self.fake.manifest = deep
        self.assertEqual(self.fetcher.fetch_manifest(), deep)  # 形の誤りは parse_manifest が見つける
        self.assertEqual(code_of(manifest.parse_manifest, deep), "bad-manifest")


class DownloadTest(FakeCase):
    def test_download_and_verify(self):
        seen = []
        part, path = self.download("audio-g1-g2", progress=seen.append)
        with open(path, "rb") as f:
            self.assertEqual(hashlib.sha256(f.read()).hexdigest(), part.sha256)
        self.assertEqual(seen[-1], part.bytes)
        self.assertEqual(seen, sorted(seen))
        self.assertEqual(sorted(os.listdir(self.downloads)), [part.name])  # .part と .part.json は残さない
        requests = self.fake.requests_for(part.name)
        self.assertEqual(len(requests), 4)  # 元の URL・転送 2 回・本体
        self.assertEqual(self.download("audio-g1-g2")[1], path)  # 確かめ済みなら取得しない
        self.assertEqual(len(self.fake.requests_for(part.name)), 4)

    def start_partial(self, kind, size):
        part = next(p for p in manifest.parse_manifest(self.release.manifest_bytes).parts if p.kind == kind)
        os.makedirs(self.downloads, exist_ok=True)
        final = os.path.join(self.downloads, part.name)
        with open(final + ".part", "wb") as f:
            f.write(self.release.zips[part.name][:size])
        with open(final + ".part.json", "w") as f:
            f.write('{"sha256": "%s", "bytes": %d}' % (part.sha256, part.bytes))
        return part

    def test_resume_with_range_206(self):
        part = self.start_partial("main", 300)
        _, path = self.download("main")
        with open(path, "rb") as f:
            self.assertEqual(f.read(), self.release.zips[part.name])
        ranges = [r["range"] for r in self.fake.requests_for(part.name)]
        self.assertEqual(ranges, ["bytes=300-"] * 4)  # 転送先にも Range が付く

    def test_server_that_ignores_range_restarts_from_the_beginning(self):
        part = self.start_partial("main", 300)
        self.fake.support_range = False
        _, path = self.download("main")
        with open(path, "rb") as f:
            self.assertEqual(f.read(), self.release.zips[part.name])

    def test_416_goes_to_verification(self):
        part = self.start_partial("main", 300)
        self.fake.force_status["/blob/" + part.name] = 416
        self.assertEqual(code_of(self.download, "main"), "size-mismatch")
        self.assertFalse(os.path.exists(os.path.join(self.downloads, part.name + ".part")))

    def test_part_for_another_release_is_discarded(self):
        part = self.start_partial("main", 300)
        meta = os.path.join(self.downloads, part.name + ".part.json")
        with open(meta, "w") as f:
            f.write('{"sha256": "%s", "bytes": %d}' % ("0" * 64, part.bytes))
        self.download("main")
        self.assertIsNone(self.fake.requests_for(part.name)[0]["range"])
        self.start_partial("audio-g1-g2", 10)
        os.unlink(os.path.join(self.downloads, part.name))

    def test_oversized_part_file_is_discarded(self):
        part = self.start_partial("main", 10)
        with open(os.path.join(self.downloads, part.name + ".part"), "ab") as f:
            f.write(b"x" * (part.bytes + 5))
        _, path = self.download("main")
        self.assertEqual(os.path.getsize(path), part.bytes)

    def test_size_mismatch(self):
        name = self.release.part("main").name
        self.fake.blobs[name] = self.release.zips[name][:-10]
        self.assertEqual(code_of(self.download, "main"), "size-mismatch")
        self.assertEqual(os.listdir(self.downloads), [])

    def test_sha256_mismatch_retries_once_from_the_beginning(self):
        name = self.release.part("main").name
        self.fake.corrupt[name] = 1
        _, path = self.download("main")
        with open(path, "rb") as f:
            self.assertEqual(f.read(), self.release.zips[name])
        self.assertEqual(len([r for r in self.fake.requests_for(name) if r["path"].startswith("/blob/")]), 2)

    def test_sha256_mismatch_twice_fails(self):
        name = self.release.part("main").name
        self.fake.corrupt[name] = 5
        self.assertEqual(code_of(self.download, "main"), "sha256-mismatch")
        self.assertEqual(len([r for r in self.fake.requests_for(name) if r["path"].startswith("/blob/")]), 2)
        self.assertEqual(os.listdir(self.downloads), [])

    def test_http_errors(self):
        name = self.release.part("main").name
        self.fake.blobs.pop(name)
        self.assertEqual(code_of(self.download, "main"), "not-found")
        self.fake.force_status["/blob/" + name] = 500
        self.assertEqual(code_of(self.download, "main"), "http")

    def test_cancel_keeps_the_partial_file(self):
        name = self.release.part("main").name
        self.fake.blobs[name] = b"z" * 20000
        part = self.release.part("main")
        self.fake.manifest = self.release.manifest_bytes
        calls = []

        def stop_early(done):
            calls.append(done)
            self.cancel.set()

        patched = manifest.Part(part.kind, part.name, 20000, hashlib.sha256(b"z" * 20000).hexdigest(), part.content_id, 1, 1)
        with mock.patch.object(fetch, "CHUNK", 1000), mock.patch.object(fetch, "PROGRESS_INTERVAL", 0):
            with self.assertRaises(Cancelled):
                self.fetcher.download_part(patched, "v2.2.0", self.downloads, self.cancel, stop_early)
        self.assertEqual(len(calls), 1)
        size = os.path.getsize(os.path.join(self.downloads, name + ".part"))
        self.assertTrue(0 < size < 20000)
        self.cancel.clear()  # 続きから
        path = self.fetcher.download_part(patched, "v2.2.0", self.downloads, self.cancel)
        self.assertEqual(os.path.getsize(path), 20000)

    def test_connection_cut_resumes_from_where_it_stopped(self):
        name = self.release.part("main").name
        self.fake.cut_after[name] = [500, 1]
        _, path = self.download("main")
        with open(path, "rb") as f:
            self.assertEqual(f.read(), self.release.zips[name])
        blobs = [r for r in self.fake.requests_for(name) if r["path"].startswith("/blob/")]
        self.assertEqual([r["range"] for r in blobs], [None, "bytes=500-"])

    def test_gives_up_after_three_retries(self):
        name = self.release.part("main").name
        self.fake.cut_after[name] = [100, 99]
        self.assertEqual(code_of(self.download, "main"), "offline")
        blobs = [r for r in self.fake.requests_for(name) if r["path"].startswith("/blob/")]
        self.assertEqual(len(blobs), 4)  # 最初 + 3 回
        # 切れた分は .part に残っていて、あとで続きから取れる
        self.assertTrue(os.path.getsize(os.path.join(self.downloads, name + ".part")) >= 100)

    def test_remaining_bytes(self):
        part = self.start_partial("main", 300)
        self.assertEqual(fetch.remaining_bytes(self.downloads, part), part.bytes - 300)
        other = next(p for p in manifest.parse_manifest(self.release.manifest_bytes).parts if p.kind == "audio-g1-g2")
        self.assertEqual(fetch.remaining_bytes(self.downloads, other), other.bytes)
        self.download("main")
        self.assertEqual(fetch.remaining_bytes(self.downloads, part), 0)

    def test_download_all_reports_totals(self):
        parts = [p for p in manifest.parse_manifest(self.release.manifest_bytes).parts if p.kind != "audio-g3-g4"]
        seen = []
        fetch.download_all(self.fetcher, "v2.2.0", parts, self.downloads, self.cancel, lambda *a: seen.append(a))
        total = sum(p.bytes for p in parts)
        self.assertEqual(seen[-1], (total, total, "audio-g1-g2", 2, 2))
        self.assertTrue(all(a[1] == total for a in seen))


class RedirectHandlingTest(FakeCase):
    """転送の扱い（点検で見つかったことの直し）"""

    def test_redirect_body_is_not_read(self):
        # 転送の応答に 50 MB の本文があると言われても、読まずに転送先へ行く（読むと止まったまま待たされる）
        self.fake.redirect_body_stall = True
        started = time.monotonic()
        with mock.patch.object(fetch, "MANIFEST_TIMEOUT", 4):
            data = self.fetcher.fetch_manifest()
        self.assertEqual(data, self.release.manifest_bytes)
        self.assertLess(time.monotonic() - started, 3)

    def test_308_is_followed_like_302_and_keeps_range(self):
        # Python 3.10 の urllib は 308 をたどらない。どの版でも同じに 308 をたどる
        self.fake.redirect_status = 308
        self.assertEqual(self.fetcher.fetch_manifest(), self.release.manifest_bytes)
        part = DownloadTest.start_partial(self, "main", 300)
        _, path = self.download("main")
        with open(path, "rb") as f:
            self.assertEqual(f.read(), self.release.zips[part.name])
        self.assertEqual([r["range"] for r in self.fake.requests_for(part.name)], ["bytes=300-"] * 4)

    def test_manifest_from_another_release_is_refused(self):
        # 本物と同じく latest/download → releases/download/<tag>/ と転送させる
        self.fake.tag_redirect = True
        self.assertEqual(self.fetcher.fetch_manifest(), self.release.manifest_bytes)
        self.assertEqual(
            self.fake.log[1]["path"], "/das0427/manabi-no-niwa/releases/download/v2.2.0/manabi-no-niwa-update.json"
        )
        # 古い版の情報（v2.1.0）を、新しいリリース（v2.2.0）に上げてしまった
        self.fake.manifest = Release("2.1.0").manifest_bytes
        self.assertEqual(code_of(self.fetcher.fetch_manifest), "bad-manifest")
        # 転送が無い形（タグが分からない）ときは確かめない
        self.fake.tag_redirect = False
        self.assertEqual(self.fetcher.fetch_manifest(), self.fake.manifest)

    def test_malformed_location_is_redirect_host_whatever_the_redirect_status(self):
        # 形の壊れた Location は urllib の中で ValueError になる。internal ではなく redirect-host（fetch-3）。
        # 301・303・307 も 302・308 と同じ関数に結ぶ（基底クラスの結びのままだと素通りする）
        for status in (301, 302, 303, 307, 308):
            for location in ("http://[127.0.0.1/x", "http://[::1/x"):
                with self.subTest("%d %s" % (status, location)):
                    self.fake.redirect_status = status
                    self.fake.redirect_to = location
                    self.assertEqual(code_of(self.fetcher.fetch_manifest), "redirect-host")
                    self.assertEqual(code_of(self.download, "main"), "redirect-host")

    def test_release_tag_of(self):
        endpoint = fetch.endpoint_from_env({})
        base = "https://github.com/das0427/manabi-no-niwa/releases/download/"
        self.assertEqual(endpoint.release_tag_of(base + "v2.2.0/manabi-no-niwa-update.json"), "v2.2.0")
        for url in (
            base + "v2.2.0/manabi-no-niwa-2.2.0.zip",
            "https://evil.example/das0427/manabi-no-niwa/releases/download/v9.0.0/manabi-no-niwa-update.json",
            "https://release-assets.githubusercontent.com/github-production-release-asset/1431752170/x",
        ):
            self.assertIsNone(endpoint.release_tag_of(url), url)


class OddResponseTest(FakeCase):
    """取得先がおかしな応答を返しても、決まった失敗のコードになる（internal・FileNotFoundError にしない）"""

    def test_wrong_content_range_twice_is_http(self):
        part = DownloadTest.start_partial(self, "main", 300)
        self.fake.bad_range[part.name] = "bytes 7-9/%d" % part.bytes
        self.assertEqual(code_of(self.download, "main"), "http")

    def test_huge_content_range_numbers_are_not_trusted(self):
        part = DownloadTest.start_partial(self, "main", 300)
        self.fake.bad_range[part.name] = "bytes 300-%s/%d" % ("9" * 5000, part.bytes)
        self.assertEqual(code_of(self.download, "main"), "http")

    def test_non_ascii_digit_content_length_is_ignored(self):
        # '²' は isdigit() が真なのに int() にできない
        name = self.release.part("main").name
        self.fake.content_length[name] = "\u00b2"
        self.fake.content_length["manifest"] = "\u00b2"
        self.assertEqual(self.fetcher.fetch_manifest(), self.release.manifest_bytes)
        _, path = self.download("main")
        with open(path, "rb") as f:
            self.assertEqual(f.read(), self.release.zips[name])


class _FullDisk:
    """書いた量が limit を超えると ENOSPC を投げるファイル"""

    def __init__(self, real, limit):
        self.real, self.limit = real, limit

    def write(self, data):
        if self.real.tell() + len(data) > self.limit:
            raise OSError(errno.ENOSPC, "No space left on device", "C:\\Users\\someone\\secret.part")
        return self.real.write(data)

    def __getattr__(self, name):
        return getattr(self.real, name)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.real.close()


class DiskAndSpeedTest(FakeCase):
    def test_disk_full_while_writing_is_disk_full_and_not_retried(self):
        name = self.release.part("main").name
        real_open = open

        def fake_open(path, mode="r", *args, **kwargs):
            f = real_open(path, mode, *args, **kwargs)
            return _FullDisk(f, 200) if str(path).endswith(".part") and "b" in mode else f

        with mock.patch("builtins.open", fake_open):
            with self.assertRaises(UpdateError) as caught:
                self.download("main")
        self.assertEqual(caught.exception.code, "disk-full")
        self.assertIsNotNone(caught.exception.need_bytes)
        self.assertNotIn("secret", caught.exception.detail)  # パスは出さない
        self.assertIn("ENOSPC", caught.exception.detail)
        blobs = [r for r in self.fake.requests_for(name) if r["path"].startswith("/blob/")]
        self.assertEqual(len(blobs), 1)  # 取り直さない（ネットの失敗ではない）

    def full_disk_open(self, limit, ending=".part", mode="b"):
        real_open = open

        def fake_open(path, mode_="r", *args, **kwargs):
            f = real_open(path, mode_, *args, **kwargs)
            return _FullDisk(f, limit) if str(path).endswith(ending) and mode in mode_ else f

        return mock.patch("builtins.open", fake_open)

    def test_disk_full_discards_the_part_files_to_give_the_space_back(self):
        # 空きが尽きたら、書きかけの .part と .part.json を捨てる（残すと満杯のまま、確認でも起動し直しでも消えない）
        with self.full_disk_open(200):
            self.assertEqual(code_of(self.download, "main"), "disk-full")
        self.assertEqual(os.listdir(self.downloads), [])

    def test_disk_full_while_resuming_discards_the_old_part_too(self):
        part = DownloadTest.start_partial(self, "main", 300)
        self.assertTrue(os.path.exists(os.path.join(self.downloads, part.name + ".part")))
        with self.full_disk_open(400):
            self.assertEqual(code_of(self.download, "main"), "disk-full")
        self.assertEqual(os.listdir(self.downloads), [])

    def test_disk_full_while_writing_the_meta_leaves_nothing(self):
        with self.full_disk_open(0, ending=".part.json", mode="w"):
            self.assertEqual(code_of(self.download, "main"), "disk-full")
        self.assertEqual(os.listdir(self.downloads), [])

    def test_other_failures_keep_the_part_to_resume(self):
        # 切れた（offline）ときは、続きから取り直すために .part を残す
        name = self.release.part("main").name
        self.fake.trickle[name] = (50, 0.05)
        with mock.patch.object(fetch, "STALL_WINDOW", 0.3), mock.patch.object(fetch, "STALL_MIN_BYTES", 10**6):
            self.assertEqual(code_of(self.download, "main"), "offline")
        self.assertEqual(sorted(os.listdir(self.downloads)), [name + ".part", name + ".part.json"])

    def test_too_slow_download_gives_up_and_keeps_what_it_got(self):
        name = self.release.part("main").name
        self.fake.trickle[name] = (50, 0.05)
        with mock.patch.object(fetch, "STALL_WINDOW", 0.3), mock.patch.object(fetch, "STALL_MIN_BYTES", 10**6):
            with self.assertRaises(UpdateError) as caught:
                self.download("main")
        self.assertEqual(caught.exception.code, "offline")
        self.assertIn("too slow", caught.exception.detail)
        blobs = [r for r in self.fake.requests_for(name) if r["path"].startswith("/blob/")]
        self.assertEqual(len(blobs), 4)  # 最初 + 3 回（続きから）
        self.assertTrue(all(r["range"] for r in blobs[1:]))
        self.assertGreater(os.path.getsize(os.path.join(self.downloads, name + ".part")), 0)

    def test_cancel_works_while_data_trickles_in(self):
        name = self.release.part("main").name
        self.fake.blobs[name] = b"z" * 20000
        part = self.release.part("main")
        patched = manifest.Part(part.kind, part.name, 20000, hashlib.sha256(b"z" * 20000).hexdigest(), part.content_id, 1, 1)
        self.fake.trickle[name] = (100, 0.05)  # 全部で 10 秒かかる
        result = {}

        def run():
            try:
                self.fetcher.download_part(patched, "v2.2.0", self.downloads, self.cancel)
            except Cancelled:
                result["cancelled"] = time.monotonic()

        worker = threading.Thread(target=run)
        worker.start()
        time.sleep(0.5)
        pressed = time.monotonic()
        self.cancel.set()
        worker.join(5)
        self.assertIn("cancelled", result)
        self.assertLess(result["cancelled"] - pressed, 1.5)

    def test_manifest_has_an_overall_deadline(self):
        self.fake.trickle["manifest"] = (10, 0.05)
        started = time.monotonic()
        with mock.patch.object(fetch, "MANIFEST_DEADLINE", 0.5):
            self.assertEqual(code_of(self.fetcher.fetch_manifest), "offline")
        self.assertLess(time.monotonic() - started, 3)


if __name__ == "__main__":
    unittest.main()
