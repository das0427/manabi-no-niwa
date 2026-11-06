# -*- coding: utf-8 -*-
"""取得先の確かめ・転送先の許可リスト・偽の GitHub での取得（設計 3.3・3.4・5.6 節）"""
import hashlib
import os
import socket
import threading
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
            "https://objects.githubusercontent.com/github-production-release-asset/1?X=1",
            "https://release-assets.githubusercontent.com/x/y",
            "https://GITHUB.COM/x",
            "https://github.com:443/x",
        ):
            with self.subTest(url):
                endpoint.check_url(url)
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


if __name__ == "__main__":
    unittest.main()
