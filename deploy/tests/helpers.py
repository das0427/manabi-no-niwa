# -*- coding: utf-8 -*-
"""更新の仕組みの試験の共通部品（一時フォルダの中だけで動く。ネットにつながない）

- SandboxCase: HOME と XDG_* を一時フォルダに向ける
- Release: 小さな偽のリリース（zip と版の情報）を作る
- install_app: 一時フォルダに「導入された置き場」を作る
- FakeGitHub: 127.0.0.1 の空きポートで動く偽の GitHub（302・Range・切断・壊れた中身）
"""
import hashlib
import http.client
import io
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock

sys.dont_write_bytecode = True

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
ZORIN = os.path.join(os.path.dirname(os.path.dirname(TESTS_DIR)), "deploy", "zorin")
if ZORIN not in sys.path:
    sys.path.insert(0, ZORIN)

from mnwupdate import common, install, manifest, service  # noqa: E402

REPO_PATH = "/das0427/manabi-no-niwa/releases"
MANIFEST_PATH = REPO_PATH + "/latest/download/manabi-no-niwa-update.json"
IS_ROOT = hasattr(os, "geteuid") and os.geteuid() == 0
not_root = unittest.skipIf(IS_ROOT, "root で動かすと更新の仕組みを止める（設計 2 章）")
ISO = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z")
ENV_KEYS = ("HOME", "USERPROFILE", "XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_STATE_HOME")


def remove_dir(path):
    """フォルダを消す。Windows では終わったばかりのプロセスがまだファイルを放していないことがあるので、少し待って繰り返す"""
    for _ in range(50):
        common.remove_tree(path)
        if not os.path.exists(path):
            return
        time.sleep(0.1)


class SandboxCase(unittest.TestCase):
    """HOME と XDG_* を一時フォルダに向け、後で消す"""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="mnwtest-")
        self.addCleanup(remove_dir, self.tmp)
        self.home = os.path.join(self.tmp, "home")
        self.data = os.path.join(self.tmp, "data")
        self.config = os.path.join(self.tmp, "config")
        self.state = os.path.join(self.tmp, "state")
        for path in (self.home, self.data, self.config, self.state):
            os.makedirs(path)
        env = {
            "HOME": self.home,
            "USERPROFILE": self.home,
            "XDG_DATA_HOME": self.data,
            "XDG_CONFIG_HOME": self.config,
            "XDG_STATE_HOME": self.state,
        }
        patcher = mock.patch.dict(os.environ, env)
        patcher.start()
        self.addCleanup(patcher.stop)
        os.environ.pop(common.TEST_ORIGIN_ENV, None)
        self.base = os.path.join(self.data, "manabi-no-niwa")
        self.app = os.path.join(self.base, "app")

    def layout(self):
        return common.Layout(self.app, common.config_file_path())


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


class StubFetcher:
    """ネットを使わない取得役。release の zip をそのまま渡す"""

    def __init__(self, release):
        self.release = release
        self.error = None
        self.calls = 0
        self.downloaded = []
        self.hook = None

    def fetch_manifest(self):
        self.calls += 1
        if self.error:
            raise self.error
        return None if self.release is None else self.release.manifest_bytes

    def download_part(self, part, tag, downloads, cancel, progress=None):
        os.makedirs(downloads, exist_ok=True)
        self.downloaded.append(part.kind)
        if self.hook:
            self.hook(part, downloads, cancel)
        path = os.path.join(downloads, part.name)
        with open(path, "wb") as f:
            f.write(self.release.zips[part.name])
        if progress:
            progress(part.bytes // 2)
            progress(part.bytes)
        return path


class ServiceCase(SandboxCase):
    def setUp(self):
        super().setUp()
        self.old = Release("2.1.0")
        install_app(self.data, self.old)
        self.new = Release("2.2.0", g34="b", notes=["小学4年の算数に「がい数」を足しました"])
        self.fetcher = StubFetcher(self.new)
        self.clock = FakeClock()
        self.logs = []
        patcher = mock.patch.object(service, "log", self.logs.append)
        patcher.start()
        self.addCleanup(patcher.stop)

    def make(self):
        svc = service.UpdateService(self.layout(), self.fetcher, self.clock)
        svc.shutdown_callback = mock.Mock()
        svc.startup()
        self.addCleanup(svc.wait_background, 5)
        return svc

    def checked(self, svc=None):
        svc = svc or self.make()
        svc.request_check()
        svc.join(10)
        return svc

    def apply(self, svc, version="2.2.0", self_test=True):
        patches = [mock.patch.object(install, "run_self_test")] if self_test else []
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        svc.request_apply(version)
        svc.join(60)
        return svc.status()

    def state_file(self):
        with open(self.layout().state_file, encoding="utf-8") as f:
            return json.load(f)


# ---- 偽のリリース -----------------------------------------------------------


def content_id(files):
    """設計 3.2 節: 相対パスの順に '<パス>\\t<大きさ>\\t<sha256>\\n' をつないだものの sha256"""
    lines = []
    for rel in sorted(files):
        data = files[rel]
        lines.append("%s\t%d\t%s\n" % (rel, len(data), hashlib.sha256(data).hexdigest()))
    return hashlib.sha256("".join(lines).encode("utf-8")).hexdigest()


_SOURCES = {}


def _read(path):
    with open(path, "rb") as f:
        return f.read()


def _real_sources():
    """この作業ツリーの serve.py と mnwupdate/*.py（新しい版の serve.py が本当に動くように入れる）"""
    if not _SOURCES:
        _SOURCES["deploy/zorin/serve.py"] = _read(os.path.join(ZORIN, "serve.py"))
        folder = os.path.join(ZORIN, "mnwupdate")
        for name in sorted(os.listdir(folder)):
            if name.endswith(".py"):
                _SOURCES["deploy/zorin/mnwupdate/" + name] = _read(os.path.join(folder, name))
    return dict(_SOURCES)


def app_files(version, g12="a", g34="a", marker=""):
    """-> {kind: {相対パス: 中身}}（main・audio-g1-g2・audio-g3-g4）。g12・g34 を変えるとその部品の中身が変わる"""
    version_json = {"version": hashlib.sha256((version + marker).encode()).hexdigest()[:12]}
    version_json["appVersion"] = version
    main = {
        "dist/index.html": ("<html>%s %s</html>" % (version, marker)).encode(),
        "dist/sw.js": ("// sw %s %s" % (version, marker)).encode(),
        "dist/version.json": json.dumps(version_json).encode(),
        "dist/audio/num/n1.mp3": b"num-1",
        "dist/assets/packs/g1-kokugo/g1-kokugo.js": b"pack g1",
        "dist/assets/packs/g3-kokugo/g3-kokugo.js": b"pack g3",
        "dist/packs.json": json.dumps(
            {
                "g1-kokugo": {"files": ["assets/packs/g1-kokugo/g1-kokugo.js", "audio/g1-kokugo/q1.mp3"]},
                "g3-kokugo": {"files": ["assets/packs/g3-kokugo/g3-kokugo.js", "audio/g3-kokugo/q1.mp3"]},
            }
        ).encode(),
        "deploy/zorin/manabi.sh": b"#!/usr/bin/env bash\nexit 0\n",
        "README.md": ("readme %s" % version).encode(),
    }
    main.update(_real_sources())
    return {
        "main": main,
        "audio-g1-g2": {
            "dist/audio/g1-kokugo/q1.mp3": ("g1 q1 " + g12).encode() * 40,
            "dist/audio/g1-kokugo/q2.mp3": b"g1 q2",
            "dist/audio/g2-kokugo/q1.mp3": b"g2 q1",
        },
        "audio-g3-g4": {"dist/audio/g3-kokugo/q1.mp3": ("g3 q1 " + g34).encode() * 40},
    }


ROOTS = {
    "main": [],
    "audio-g1-g2": ["dist/audio/g1-kokugo", "dist/audio/g2-kokugo"],
    "audio-g3-g4": ["dist/audio/g3-kokugo"],
}


def mark_of(kind, version, files, roots):
    return {
        "schema": 1,
        "app": "manabi-no-niwa",
        "kind": kind,
        "version": version,
        "contentId": content_id(files),
        "files": len(files),
        "unpackedBytes": sum(len(v) for v in files.values()),
        "roots": roots,
    }


def zip_bytes(entries):
    """entries: [(名前, 中身 bytes か ZipInfo を返す関数)]。名前そのまま（接頭辞を自動では付けない）"""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in entries:
            info = zipfile.ZipInfo(name, (2026, 11, 20, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o644 << 16) | (0x10 if name.endswith("/") else 0)
            zf.writestr(info, data)
    return buf.getvalue()


class Release:
    """版 version の偽のリリース。zips: {zip 名: bytes}、manifest_bytes: 版の情報"""

    def __init__(self, version, files=None, min_version="2.1.0", notes=(), date="2026-11-20", **kwargs):
        self.version = version
        self.files = files or app_files(version, **kwargs)
        self.marks = {k: mark_of(k, version, f, ROOTS[k]) for k, f in self.files.items()}
        self.zips = {}
        parts = []
        for kind, files_of in self.files.items():
            name = manifest.part_name(version, kind)
            entries = [("manabi-no-niwa/" + rel, data) for rel, data in sorted(files_of.items())]
            entries.append(
                ("manabi-no-niwa/parts/%s.json" % kind, json.dumps(self.marks[kind]).encode())
            )
            self.zips[name] = zip_bytes(entries)
            parts.append(
                {
                    "kind": kind,
                    "name": name,
                    "bytes": len(self.zips[name]),
                    "sha256": hashlib.sha256(self.zips[name]).hexdigest(),
                    "contentId": self.marks[kind]["contentId"],
                    "files": len(files_of),
                    "unpackedBytes": sum(len(v) for v in files_of.values()),
                }
            )
        self.manifest = {
            "schema": 1,
            "app": "manabi-no-niwa",
            "version": version,
            "tag": "v" + version,
            "date": date,
            "minVersion": min_version,
            "notes": list(notes),
            "parts": parts,
        }

    @property
    def manifest_bytes(self):
        return json.dumps(self.manifest, ensure_ascii=False).encode("utf-8")

    def part(self, kind):
        return next(p for p in manifest.parse_manifest(self.manifest_bytes).parts if p.kind == kind)


def install_app(base, release, skip=()):
    """base/manabi-no-niwa/app に release の中身と部品の印を書く。-> app のパス"""
    app = os.path.join(base, "manabi-no-niwa", "app")
    for kind, files in release.files.items():
        if kind in skip:
            continue
        for rel, data in files.items():
            path = os.path.join(app, *rel.split("/"))
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(data)
        mark_path = os.path.join(app, "parts", kind + ".json")
        os.makedirs(os.path.dirname(mark_path), exist_ok=True)
        with open(mark_path, "w", encoding="utf-8") as f:
            json.dump(release.marks[kind], f)
    return app


def tree(path):
    """path の下の全ファイルの相対パス（/ 区切り）の集合"""
    found = set()
    for dirpath, _dirs, names in os.walk(path):
        for name in names:
            found.add(os.path.relpath(os.path.join(dirpath, name), path).replace(os.sep, "/"))
    return found


# ---- 偽の GitHub -------------------------------------------------------------


class FakeGitHub:
    """http.server の偽の GitHub。blobs: {名前: bytes}。log に要求の記録が残る"""

    def __init__(self, hops=2):
        self.hops = hops
        self.manifest = None  # bytes。None なら 404
        self.blobs = {}
        self.tag = None
        self.support_range = True
        self.cut_after = {}  # {名前: 回数つきの [バイト数, 残り回数]}
        self.corrupt = {}  # {名前: 残り回数}
        self.force_status = {}  # {パス: 状態}
        self.redirect_to = None  # 最初の転送先を差し替える（許可外のホスト）
        self.log = []
        self.lock = threading.Lock()
        fake = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *args):
                pass

            def do_GET(self):
                fake.handle(self)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        self.port = self.server.server_address[1]
        self.origin = "http://127.0.0.1:%d" % self.port
        threading.Thread(target=self.server.serve_forever, args=(0.02,), daemon=True).start()

    def stop(self):
        self.server.shutdown()
        self.server.server_close()

    def set_release(self, release):
        self.manifest = release.manifest_bytes
        self.blobs = dict(release.zips)
        self.tag = "v" + release.version

    def requests_for(self, name):
        return [r for r in self.log if r["path"].endswith("/" + name)]

    def _reply(self, h, status, body=b"", headers=()):
        h.send_response(status)
        for key, value in headers:
            h.send_header(key, value)
        h.send_header("Content-Length", str(len(body)))
        h.end_headers()
        if body:
            h.wfile.write(body)

    def handle(self, h):
        path = h.path
        with self.lock:
            self.log.append(
                {
                    "path": path,
                    "range": h.headers.get("Range"),
                    "ua": h.headers.get("User-Agent"),
                    "cookie": h.headers.get("Cookie"),
                }
            )
        if path in self.force_status:
            return self._reply(h, self.force_status[path])
        if path == MANIFEST_PATH or path.startswith(REPO_PATH + "/download/"):
            name = "manifest" if path == MANIFEST_PATH else path.rsplit("/", 1)[1]
            if name == "manifest" and self.manifest is None:
                return self._reply(h, 404)
            target = self.redirect_to or "/hop1/" + name
            return self._reply(h, 302, headers=[("Location", target)])
        for number in range(1, self.hops + 1):
            if path.startswith("/hop%d/" % number):
                name = path.rsplit("/", 1)[1]
                nxt = "/hop%d/%s" % (number + 1, name) if number < self.hops else "/blob/" + name
                return self._reply(h, 302, headers=[("Location", nxt)])
        if path.startswith("/blob/"):
            return self._blob(h, path.rsplit("/", 1)[1])
        self._reply(h, 404)

    def _blob(self, h, name):
        body = self.manifest if name == "manifest" else self.blobs.get(name)
        if body is None:
            return self._reply(h, 404)
        if self.corrupt.get(name, 0) > 0:
            self.corrupt[name] -= 1
            body = bytes([body[0] ^ 0xFF]) + body[1:]
        start, status = 0, 200
        spec = h.headers.get("Range")
        if spec and self.support_range and spec.startswith("bytes="):
            start = int(spec[6:].split("-")[0])
            if start >= len(body):
                return self._reply(h, 416, headers=[("Content-Range", "bytes */%d" % len(body))])
            status = 206
        chunk = body[start:]
        headers = []
        if status == 206:
            headers.append(("Content-Range", "bytes %d-%d/%d" % (start, len(body) - 1, len(body))))
        cut = self.cut_after.get(name)
        h.send_response(status)
        for key, value in headers:
            h.send_header(key, value)
        h.send_header("Content-Length", str(len(chunk)))
        h.end_headers()
        if cut and cut[1] > 0:
            cut[1] -= 1
            h.wfile.write(chunk[: cut[0]])
            h.wfile.flush()
            h.close_connection = True
            try:
                h.connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            return
        h.wfile.write(chunk)


# ---- HTTP・プロセス ----------------------------------------------------------


def free_port(low=4800, high=4999):
    """4800〜4999 の空きポート（8765・4299 は使わない）"""
    for port in range(low, high + 1):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("no free port")


def http_call(port, method, path, headers=None, body=None, host=None):
    """生の HTTP 要求。-> (状態, 見出し [(名前, 値)], 本文 bytes)"""
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
    try:
        conn.putrequest(method, path, skip_host=True)
        if host is not None:
            conn.putheader("Host", host)
        for key, value in (headers or {}).items():
            try:
                value.encode("latin-1")
            except UnicodeEncodeError:
                value = value.encode("utf-8")  # 日本語などはそのままのバイト列で送る
            conn.putheader(key, value)
        data = body if isinstance(body, bytes) else (body.encode() if body else b"")
        if body is not None and not any(k.lower() == "content-length" for k in (headers or {})):
            conn.putheader("Content-Length", str(len(data)))
        conn.endheaders(data if data else None)
        resp = conn.getresponse()
        return resp.status, resp.getheaders(), resp.read()
    finally:
        conn.close()


def wait_until(check, timeout=30.0, interval=0.1, message="timeout"):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        value = check()
        if value:
            return value
        time.sleep(interval)
    raise AssertionError(message)


def run_python(args, env=None, timeout=90, cwd=None):
    return subprocess.run(
        [sys.executable, "-B"] + list(args),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
        env=env,
        cwd=cwd,
    )
