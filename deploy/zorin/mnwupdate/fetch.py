# -*- coding: utf-8 -*-
"""取得: 取得先（GitHub／試験用）・転送先の確認・版の情報と zip の取得（設計 3.3・3.4・5.6 節）

外へ通信するのはこのファイルだけ。URL はここで固定し、版の情報からは受け取らない。
"""
from __future__ import annotations

import hashlib
import http.client
import json
import os
import re
import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

from .common import Cancelled, UpdateError, override_origin_from_env
from .manifest import MAX_MANIFEST_BYTES

GITHUB_ORIGIN = "https://github.com"
REPO_PATH = "/das0427/manabi-no-niwa/releases"
ALLOWED_HOSTS = frozenset(
    {"github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"}
)
MANIFEST_NAME = "manabi-no-niwa-update.json"
USER_AGENT = "manabi-no-niwa-updater"
MAX_REDIRECTS = 5
CHUNK = 1 << 20
READ_TIMEOUT = 60
MANIFEST_TIMEOUT = 30
RETRY_DELAYS = (5, 15, 30)
PROGRESS_INTERVAL = 0.25

_TAG_RE = re.compile(r"v[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,6}")
_NAME_RE = re.compile(r"manabi-no-niwa-[0-9.]+(-[a-z0-9-]+)?\.zip")
_RANGE_RE = re.compile(r"bytes ([0-9]+)-([0-9]+)/([0-9]+|\*)")


class Endpoint:
    """取得先。本番は GitHub、試験用は 127.0.0.1 の偽の GitHub だけ"""

    def __init__(self, origin, test=False):
        self.origin = origin
        self.test = test
        parts = urllib.parse.urlsplit(origin)
        self.scheme = parts.scheme
        self.host = parts.hostname
        self.port = parts.port

    def manifest_url(self):
        return "%s%s/latest/download/%s" % (self.origin, REPO_PATH, MANIFEST_NAME)

    def part_url(self, tag, name):
        if not _TAG_RE.fullmatch(tag) or not _NAME_RE.fullmatch(name):
            raise UpdateError("bad-manifest", "tag or name")
        return "%s%s/download/%s/%s" % (self.origin, REPO_PATH, tag, name)

    def check_url(self, url):
        """この URL へ行ってよいか。だめなら redirect-host"""
        try:
            parts = urllib.parse.urlsplit(url)
            host, port = parts.hostname, parts.port
        except ValueError:
            raise UpdateError("redirect-host", "bad URL") from None
        if parts.username is not None or parts.password is not None or "@" in parts.netloc:
            raise UpdateError("redirect-host", "userinfo in URL")
        if self.test:
            ok = parts.scheme == "http" and host == self.host and port == self.port
        else:
            ok = parts.scheme == "https" and host in ALLOWED_HOSTS and port in (None, 443)
        if not ok:
            raise UpdateError("redirect-host", "not allowed: %s://%s" % (parts.scheme, host))


def endpoint_from_env(env=None):
    """MANABI_UPDATE_TEST_ORIGIN が正しい形ならその origin、無ければ GitHub。形が違えば bad-test-origin"""
    try:
        origin = override_origin_from_env(env)
    except ValueError:
        raise UpdateError("bad-test-origin", "MANABI_UPDATE_TEST_ORIGIN") from None
    return Endpoint(origin, True) if origin else Endpoint(GITHUB_ORIGIN)


class _CheckedRedirect(urllib.request.HTTPRedirectHandler):
    """転送のたびに転送先を確かめる（5 回まで）"""

    max_redirections = MAX_REDIRECTS

    def __init__(self, endpoint):
        self.endpoint = endpoint

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.endpoint.check_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def build_opener(endpoint):
    """確認を切る設定は作らない。環境変数のプロキシは本番だけ使う。Cookie は持たない"""
    opener = urllib.request.OpenerDirector()
    if endpoint.test:
        opener.add_handler(urllib.request.ProxyHandler({}))
        opener.add_handler(urllib.request.HTTPHandler())
    else:
        opener.add_handler(urllib.request.ProxyHandler())
        opener.add_handler(urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    opener.add_handler(urllib.request.UnknownHandler())
    opener.add_handler(urllib.request.HTTPDefaultErrorHandler())
    opener.add_handler(_CheckedRedirect(endpoint))
    opener.add_handler(urllib.request.HTTPErrorProcessor())
    opener.addheaders = [("User-Agent", USER_AGENT)]
    return opener


def classify(exc):
    """例外 -> UpdateError（設計 5.3 節の表）"""
    if isinstance(exc, UpdateError):
        return exc
    if isinstance(exc, urllib.error.HTTPError):
        if 300 <= exc.code < 400:
            return UpdateError("redirect-host", "redirect not followed (HTTP %d)" % exc.code)
        if exc.code == 404:
            return UpdateError("not-found", "HTTP 404")
        return UpdateError("http", "HTTP %d" % exc.code)
    reason = exc.reason if isinstance(exc, urllib.error.URLError) else exc
    if isinstance(reason, ssl.SSLError):
        return UpdateError("tls", "%s" % reason)
    if isinstance(reason, (OSError, http.client.HTTPException, socket.timeout, TimeoutError)):
        return UpdateError("offline", "%s: %s" % (type(reason).__name__, reason))
    if isinstance(reason, ValueError):  # 不正な URL など
        return UpdateError("internal", "%s: %s" % (type(reason).__name__, reason))
    return UpdateError("offline", "%s" % type(reason).__name__)


def file_sha256(path, cancel=None):
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            if cancel is not None and cancel.is_set():
                raise Cancelled()
            chunk = f.read(CHUNK)
            if not chunk:
                return digest.hexdigest()
            digest.update(chunk)


def _unlink(path):
    try:
        os.unlink(path)
    except OSError:
        pass


def part_files(downloads, part):
    """(確かめ済みの zip, .part, .part.json) のパス"""
    final = os.path.join(downloads, part.name)
    return final, final + ".part", final + ".part.json"


def remaining_bytes(downloads, part):
    """この部品の残りの取得の大きさ（見積もり用。ファイルの中身は読まない）"""
    final, partial, meta = part_files(downloads, part)
    try:
        if os.path.getsize(final) == part.bytes:
            return 0
    except OSError:
        pass
    try:
        with open(meta, "r", encoding="utf-8") as f:
            ok = json.load(f) == {"sha256": part.sha256, "bytes": part.bytes}
        return max(0, part.bytes - os.path.getsize(partial)) if ok else part.bytes
    except (OSError, ValueError):
        return part.bytes


def _parse_content_range(value):
    match = _RANGE_RE.fullmatch((value or "").strip())
    if not match:
        return None
    total = None if match.group(3) == "*" else int(match.group(3))
    return int(match.group(1)), int(match.group(2)), total


class Fetcher:
    def __init__(self, endpoint=None, opener=None, clock=time.monotonic):
        self.endpoint = endpoint or endpoint_from_env()
        self.opener = opener or build_opener(self.endpoint)
        self.clock = clock

    def _open(self, url, timeout, range_from=0):
        self.endpoint.check_url(url)
        headers = {"Accept-Encoding": "identity"}
        if range_from:
            headers["Range"] = "bytes=%d-" % range_from
        return self.opener.open(urllib.request.Request(url, headers=headers), timeout=timeout)

    def fetch_manifest(self):
        """版の情報の中身（bytes）。最新のリリースに無い（404）ときは None"""
        try:
            with self._open(self.endpoint.manifest_url(), MANIFEST_TIMEOUT) as resp:
                length = resp.headers.get("Content-Length")
                if length is not None and length.isdigit() and int(length) > MAX_MANIFEST_BYTES:
                    raise UpdateError("bad-manifest", "too large")
                data = resp.read(MAX_MANIFEST_BYTES + 1)
        except urllib.error.HTTPError as e:
            e.close()
            if e.code == 404:
                return None
            raise classify(e) from None
        except Exception as e:  # noqa: BLE001
            raise classify(e) from e
        if len(data) > MAX_MANIFEST_BYTES:
            raise UpdateError("bad-manifest", "too large")
        return data

    # ---- zip の取得 --------------------------------------------------------

    def download_part(self, part, tag, downloads, cancel, progress=None):
        """部品の zip を取得して確かめる。-> 確かめ済みの zip のパス"""
        url = self.endpoint.part_url(tag, part.name)
        os.makedirs(downloads, exist_ok=True)
        final, partial, meta = part_files(downloads, part)
        if os.path.isfile(final):
            if os.path.getsize(final) == part.bytes and file_sha256(final, cancel) == part.sha256:
                if progress:
                    progress(part.bytes)
                return final
            _unlink(final)
        want = {"sha256": part.sha256, "bytes": part.bytes}
        try:
            with open(meta, "r", encoding="utf-8") as f:
                same = json.load(f) == want
        except (OSError, ValueError):
            same = False
        if not same:
            _unlink(partial)
            with open(meta, "w", encoding="utf-8") as f:
                json.dump(want, f)
        retries = 0
        sha_retried = False
        while True:
            try:
                self._transfer(url, part, partial, cancel, progress)
            except Cancelled:
                raise
            except Exception as e:  # noqa: BLE001
                error = classify(e)
                if error.code == "size-mismatch":
                    self._discard(partial, meta)
                if error.code != "offline" or retries >= len(RETRY_DELAYS):
                    raise error from None
                if cancel.wait(RETRY_DELAYS[retries]):
                    raise Cancelled() from None
                retries += 1
                continue
            if os.path.getsize(partial) != part.bytes:
                self._discard(partial, meta)
                raise UpdateError("size-mismatch", "size is not %d" % part.bytes)
            if file_sha256(partial, cancel) == part.sha256:
                os.replace(partial, final)
                _unlink(meta)
                return final
            self._discard(partial, meta)
            if sha_retried:
                raise UpdateError("sha256-mismatch", part.name)
            sha_retried = True
            with open(meta, "w", encoding="utf-8") as f:
                json.dump(want, f)
            if progress:
                progress(0)

    @staticmethod
    def _discard(partial, meta):
        _unlink(partial)
        _unlink(meta)

    def _transfer(self, url, part, partial, cancel, progress):
        """.part に続きから書く。全部そろえば戻る（確かめは呼び出し側）。切れたら offline を投げる"""
        size = os.path.getsize(partial) if os.path.exists(partial) else 0
        if size > part.bytes:
            _unlink(partial)
            size = 0
        if size == part.bytes:
            return
        for _ in range(2):
            if cancel.is_set():
                raise Cancelled()
            try:
                resp = self._open(url, READ_TIMEOUT, size)
            except urllib.error.HTTPError as e:
                e.close()
                if e.code == 416 and size > 0:
                    return  # 全部そろっているとみなして確かめへ
                raise
            with resp:
                append = False
                if resp.status == 206:
                    got = _parse_content_range(resp.headers.get("Content-Range"))
                    if got is None or got[0] != size or (got[2] not in (None, part.bytes)):
                        size = 0  # 続きとして信用できない: 最初から頼み直す
                        _unlink(partial)
                        continue
                    append = True
                elif resp.status == 200:
                    length = resp.headers.get("Content-Length")
                    if length is not None and length.isdigit() and int(length) != part.bytes:
                        raise UpdateError("size-mismatch", "Content-Length %s" % length)
                    size = 0
                else:
                    raise UpdateError("http", "HTTP %d" % resp.status)
                self._write_body(resp, partial, size, append, part, cancel, progress)
            return

    def _write_body(self, resp, partial, size, append, part, cancel, progress):
        written = size
        last = self.clock()
        with open(partial, "ab" if append else "wb") as out:
            while True:
                if cancel.is_set():
                    raise Cancelled()
                try:
                    chunk = resp.read(CHUNK)
                except (OSError, http.client.HTTPException) as e:
                    raise UpdateError("offline", "%s: %s" % (type(e).__name__, e)) from e
                if not chunk:
                    break
                written += len(chunk)
                if written > part.bytes:
                    out.close()
                    _unlink(partial)
                    raise UpdateError("size-mismatch", "more than %d bytes" % part.bytes)
                out.write(chunk)
                now = self.clock()
                if progress and now - last >= PROGRESS_INTERVAL:
                    last = now
                    progress(written)
        if progress:
            progress(written)
        if written < part.bytes:
            raise UpdateError("offline", "connection closed at %d of %d" % (written, part.bytes))


def download_all(fetcher, tag, parts, downloads, cancel, progress):
    """取得する部品を順に取得する。progress(取得した合計, 全体, 種類, 何番目, 全部で何個)"""
    total = sum(p.bytes for p in parts)
    done = 0
    for index, part in enumerate(parts, 1):

        def report(got, base=done, index=index, kind=part.kind):
            progress(base + got, total, kind, index, len(parts))

        fetcher.download_part(part, tag, downloads, cancel, report)
        done += part.bytes
        report(part.bytes)
