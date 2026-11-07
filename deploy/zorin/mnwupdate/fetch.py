# -*- coding: utf-8 -*-
"""取得: 取得先（GitHub／試験用）・転送先の確認・版の情報と zip の取得（設計 3.3・3.4・5.6 節）

外へ通信するのはこのファイルだけ。URL はここで固定し、版の情報からは受け取らない。
"""
from __future__ import annotations

import contextlib
import errno
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

from .common import Cancelled, UpdateError, os_error_text, override_origin_from_env, strict_loads
from .manifest import MAX_MANIFEST_BYTES

GITHUB_ORIGIN = "https://github.com"
REPO_PATH = "/das0427/manabi-no-niwa/releases"
# リポジトリの番号（GitHub の API の id）。配布用ホストの URL の 2 番目の部分に入る。
# 名前（das0427/manabi-no-niwa）を取り直して作ったリポジトリは別の番号になるので、ここで止まる（設計 3.4 節）
REPO_ID = "1431752170"
ALLOWED_HOSTS = frozenset(
    {"github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"}
)
MANIFEST_NAME = "manabi-no-niwa-update.json"
USER_AGENT = "manabi-no-niwa-updater"
MAX_REDIRECTS = 5
CHUNK = 1 << 20
READ_TIMEOUT = 60
MANIFEST_TIMEOUT = 30
MANIFEST_DEADLINE = 60  # 版の情報の取得の全体の期限（少しずつ送られ続けても終わらせる）
STALL_WINDOW = 120  # この秒数で STALL_MIN_BYTES より少なければ、遅すぎる（offline）として続きから取り直す
STALL_MIN_BYTES = 16 * 1024
RETRY_DELAYS = (5, 15, 30)
PROGRESS_INTERVAL = 0.25

_VERSION_TAG = r"v[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,6}"
_TAG_RE = re.compile(_VERSION_TAG)
_NAME_RE = re.compile(r"manabi-no-niwa-[0-9.]+(-[a-z0-9-]+)?\.zip")
_RANGE_RE = re.compile(r"bytes ([0-9]{1,12})-([0-9]{1,12})/([0-9]{1,12}|\*)")
# github.com で行ってよいのは、このリポジトリのリリースの取得の道だけ
_GITHUB_PATH_RE = re.compile(
    re.escape(REPO_PATH)
    + r"/(?:latest/download|download/" + _VERSION_TAG + r")/[A-Za-z0-9][A-Za-z0-9._-]{0,200}"
)
# 配布用ホストは /<置き場の名前>/<リポジトリの番号>/<…>（各部分は . で始まらない。% は使わない）
_ASSET_PATH_RE = re.compile(r"/[A-Za-z0-9-]{1,100}/" + REPO_ID + r"(?:/[A-Za-z0-9_-][A-Za-z0-9._-]{0,200}){1,4}")
# latest/download の転送先: どのリリースの版の情報か（manifest の tag と比べる）
_RELEASE_MANIFEST_RE = re.compile(
    re.escape(REPO_PATH) + r"/download/(" + _VERSION_TAG + r")/" + re.escape(MANIFEST_NAME)
)


def _is_digits(text):
    return text is not None and text.isascii() and text.isdigit() and len(text) <= 15


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
        """この URL へ行ってよいか。だめなら redirect-host。
        本番はホストに加えてパスも確かめる: github.com はこのリポジトリのリリースの道だけ、配布用ホストは
        このリポジトリの番号の道だけ（リポジトリの名前が取り直されたときに、他人のリリースへ行かない）。
        試験用の取得先（127.0.0.1）は、その origin だけ（パスは偽の GitHub の作りに任せる）"""
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
            if ok and host == "github.com":
                ok = _GITHUB_PATH_RE.fullmatch(parts.path) is not None
            elif ok:
                ok = _ASSET_PATH_RE.fullmatch(parts.path) is not None
        if not ok:
            raise UpdateError("redirect-host", "not allowed: %s://%s" % (parts.scheme, host))

    def release_tag_of(self, url):
        """url が latest/download の転送先（…/releases/download/<tag>/manabi-no-niwa-update.json）なら tag"""
        try:
            parts = urllib.parse.urlsplit(url)
            same = (parts.hostname, parts.port) == (self.host, self.port)
        except ValueError:
            return None
        match = _RELEASE_MANIFEST_RE.fullmatch(parts.path) if same else None
        return match.group(1) if match else None


def endpoint_from_env(env=None):
    """MANABI_UPDATE_TEST_ORIGIN が正しい形ならその origin、無ければ GitHub。形が違えば bad-test-origin"""
    try:
        origin = override_origin_from_env(env)
    except ValueError:
        raise UpdateError("bad-test-origin", "MANABI_UPDATE_TEST_ORIGIN") from None
    return Endpoint(origin, True) if origin else Endpoint(GITHUB_ORIGIN)


class _CheckedRedirect(urllib.request.HTTPRedirectHandler):
    """転送のたびに転送先を確かめる（5 回まで）。

    - 転送の応答の本文は読まない（大きな本文を全部メモリに読んでから転送をたどる、を防ぐ）。
    - 308 も 301・302・303・307 と同じに扱う（Python 3.10 の urllib は 308 をたどらず、3.11 からたどる。
      どちらの版でも同じ動きにする）。新しい要求は GET で、見出し（Range を含む）を引き継ぐ。
    - たどった URL を要求の redirect_log に残す（版の情報がどのリリースから来たかを確かめるため）。
    """

    max_redirections = MAX_REDIRECTS

    def __init__(self, endpoint):
        self.endpoint = endpoint

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.endpoint.check_url(newurl)
        method = req.get_method()
        if code not in (301, 302, 303, 307, 308) or method not in ("GET", "HEAD"):
            raise urllib.error.HTTPError(req.full_url, code, msg, headers, fp)
        fp.close()  # 呼び出し元（http_error_302）の fp.read() は、閉じていれば b"" を返す
        kept = {k: v for k, v in req.headers.items() if k.lower() not in ("content-length", "content-type")}
        new = urllib.request.Request(
            newurl.replace(" ", "%20"),
            method="HEAD" if method == "HEAD" else "GET",
            headers=kept,
            origin_req_host=req.origin_req_host,
            unverifiable=True,
        )
        log = getattr(req, "redirect_log", None)
        if log is not None:
            log.append(newurl)
            new.redirect_log = log
        return new

    def http_error_302(self, req, fp, code, msg, headers):
        try:
            return urllib.request.HTTPRedirectHandler.http_error_302(self, req, fp, code, msg, headers)
        except ValueError:
            # 形の壊れた Location（例: http://[127.0.0.1/x）は urllib の中で ValueError になる。転送先が使えない
            # ものとして、internal ではなく redirect-host にする
            raise UpdateError("redirect-host", "bad redirect URL") from None

    # 基底クラスは 301・303・307 を基底の http_error_302 に結んでいるので、こちらの関数に結び直す
    http_error_301 = http_error_303 = http_error_307 = http_error_308 = http_error_302


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
    """例外 -> UpdateError（設計 5.3 節の表）。ここへ来る OSError は通信のものだけ
    （手元のファイルの失敗は _local_io で disk-full か internal にしてから来る）"""
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


@contextlib.contextmanager
def _local_io(what, need_bytes=0):
    """手元のファイルの読み書き。空きが無い（ENOSPC・EDQUOT）は disk-full、ほかは internal（パスは出さない）。
    通信の失敗（offline）と取り違えない（取り直しても直らないので）"""
    try:
        yield
    except OSError as e:
        if e.errno in (errno.ENOSPC, getattr(errno, "EDQUOT", errno.ENOSPC)):
            raise UpdateError("disk-full", "%s: %s" % (what, os_error_text(e)), need_bytes=need_bytes) from None
        raise UpdateError("internal", "%s: %s" % (what, os_error_text(e))) from None


def file_sha256(path, cancel=None):
    digest = hashlib.sha256()
    with _local_io("read"), open(path, "rb") as f:
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


def _write_meta(meta, want):
    try:
        with _local_io("write .part.json", want["bytes"]), open(meta, "w", encoding="utf-8") as f:
            json.dump(want, f)
    except UpdateError:
        _unlink(meta)  # 書きかけ（空き不足で途中まで）を残さない
        raise


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


def _read1(resp, size):
    """受信 1 回分だけ読む（1 MiB たまるのを待たない。中止・期限・進み具合を受信ごとに確かめるため）"""
    read = getattr(resp, "read1", None)
    return read(size) if read is not None else resp.read(size)


class Fetcher:
    def __init__(self, endpoint=None, opener=None, clock=time.monotonic):
        self.endpoint = endpoint or endpoint_from_env()
        self.opener = opener or build_opener(self.endpoint)
        self.clock = clock

    def _open(self, url, timeout, range_from=0, redirect_log=None):
        self.endpoint.check_url(url)
        headers = {"Accept-Encoding": "identity"}
        if range_from:
            headers["Range"] = "bytes=%d-" % range_from
        req = urllib.request.Request(url, headers=headers)
        if redirect_log is not None:
            req.redirect_log = redirect_log
        return self.opener.open(req, timeout=timeout)

    def fetch_manifest(self):
        """版の情報の中身（bytes）。最新のリリースに無い（404）ときは None。
        latest/download の転送先から分かるリリースの tag と、版の情報の tag が違えば bad-manifest
        （古い版の情報を新しいリリースに上げてしまった、などを入れない）"""
        hops = []
        deadline = self.clock() + MANIFEST_DEADLINE
        try:
            with self._open(self.endpoint.manifest_url(), MANIFEST_TIMEOUT, redirect_log=hops) as resp:
                length = resp.headers.get("Content-Length")
                if _is_digits(length) and int(length) > MAX_MANIFEST_BYTES:
                    raise UpdateError("bad-manifest", "too large")
                chunks, size = [], 0
                while True:
                    if self.clock() > deadline:
                        raise UpdateError("offline", "manifest took longer than %d s" % MANIFEST_DEADLINE)
                    chunk = _read1(resp, 16384)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > MAX_MANIFEST_BYTES:
                        raise UpdateError("bad-manifest", "too large")
                    chunks.append(chunk)
        except urllib.error.HTTPError as e:
            e.close()
            if e.code == 404:
                return None
            raise classify(e) from None
        except Exception as e:  # noqa: BLE001
            raise classify(e) from e
        data = b"".join(chunks)
        tags = [t for t in (self.endpoint.release_tag_of(u) for u in hops) if t]
        if tags:
            try:
                declared = strict_loads(data.decode("utf-8")).get("tag")
            except (ValueError, UnicodeDecodeError, AttributeError):
                declared = None  # 形の誤りは parse_manifest が見つける
            if isinstance(declared, str) and declared != tags[0]:
                raise UpdateError("bad-manifest", "tag %s is not the release %s" % (declared[:20], tags[0]))
        return data

    # ---- zip の取得 --------------------------------------------------------

    def download_part(self, part, tag, downloads, cancel, progress=None):
        """部品の zip を取得して確かめる。-> 確かめ済みの zip のパス"""
        url = self.endpoint.part_url(tag, part.name)
        with _local_io("mkdir", part.bytes):
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
            _write_meta(meta, want)
        retries = 0
        sha_retried = False
        while True:
            try:
                self._transfer(url, part, partial, cancel, progress)
            except Cancelled:
                raise
            except Exception as e:  # noqa: BLE001
                error = classify(e)
                if error.code in ("size-mismatch", "disk-full"):
                    # 大きさが合わない部分も、空きが尽きた部分も、続きから取り直さない。捨てて空きを返す
                    # （残すと、確認でも起動し直しでも消えず、ディスクが満杯のまま残る）
                    self._discard(partial, meta)
                if error.code != "offline" or retries >= len(RETRY_DELAYS):
                    raise error from None
                if cancel.wait(RETRY_DELAYS[retries]):
                    raise Cancelled() from None
                retries += 1
                continue
            size = os.path.getsize(partial) if os.path.isfile(partial) else -1
            if size != part.bytes:
                self._discard(partial, meta)
                raise UpdateError("size-mismatch", "size is not %d" % part.bytes)
            if file_sha256(partial, cancel) == part.sha256:
                with _local_io("rename"):
                    os.replace(partial, final)
                _unlink(meta)
                return final
            self._discard(partial, meta)
            if sha_retried:
                raise UpdateError("sha256-mismatch", part.name)
            sha_retried = True
            _write_meta(meta, want)
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
                    if _is_digits(length) and int(length) != part.bytes:
                        raise UpdateError("size-mismatch", "Content-Length %s" % length)
                    size = 0
                else:
                    raise UpdateError("http", "HTTP %d" % resp.status)
                self._write_body(resp, partial, size, append, part, cancel, progress)
            return
        # 最初から頼み直しても、続きの位置が合わない応答だった
        raise UpdateError("http", "bad Content-Range")

    def _write_body(self, resp, partial, size, append, part, cancel, progress):
        written = size
        last = window_start = self.clock()
        window_bytes = 0
        # 通信の失敗は中で offline にする。ここから出る OSError は手元のファイル（空きが無いなど）だけ
        with _local_io("write .part", part.bytes - size), open(partial, "ab" if append else "wb") as out:
            while True:
                if cancel.is_set():
                    raise Cancelled()
                try:
                    chunk = _read1(resp, CHUNK)
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
                window_bytes += len(chunk)
                if now - window_start >= STALL_WINDOW:
                    if window_bytes < STALL_MIN_BYTES:
                        out.flush()  # ここまでの分は .part に残し、続きから取り直す
                        raise UpdateError(
                            "offline", "too slow: %d bytes in %d s" % (window_bytes, now - window_start)
                        )
                    window_start, window_bytes = now, 0
                if progress and now - last >= PROGRESS_INTERVAL:
                    last = now
                    progress(written)
            out.flush()
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
