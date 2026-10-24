#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""まなびのにわ ローカル配信（Python 3 標準ライブラリのみ）

  python3 serve.py                 127.0.0.1:8765 で dist を配信する
  python3 serve.py --dir PATH      配信するフォルダを指定する
  python3 serve.py --port N        ポートを変える（非推奨。下記）

- 待ち受けは 127.0.0.1 だけ。同じ PC のブラウザからしか開けない（IN-03）。
- ポート番号はブラウザの「オリジン」の一部。変えると学習データ（IndexedDB）が別扱いになる。
  そのため 8765 から変えない（--port はテスト用）。
- ポートが使用中のときは、別のポートへ逃げずに終了する（終了コード 3）。
- アクセスログは出さない。
- /__manabi/health は {"app":"manabi-no-niwa","version":...} を返す。
  別のアプリがポートを使っていないかを、起動スクリプトが確認するために使う。
"""
import argparse
import functools
import json
import os
import signal
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
DEFAULT_PORT = 8765
APP_NAME = "manabi-no-niwa"
HEALTH_PATH = "/__manabi/health"
EXIT_PORT_IN_USE = 3

# 実行する OS の設定（Windows のレジストリ等）に左右されないよう、MIME は明示する
MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".map": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".mp3": "audio/mpeg",
    ".txt": "text/plain; charset=utf-8",
}

# 毎回確認させるもの（版の切り替えに関わるファイル）
NO_CACHE_NAMES = {"index.html", "sw.js", "version.json"}
NO_CACHE_SUFFIXES = (".webmanifest",)
IMMUTABLE = "public, max-age=31536000, immutable"


def read_version(directory):
    """dist/version.json の version。無ければ None"""
    try:
        with open(os.path.join(directory, "version.json"), "r", encoding="utf-8") as f:
            value = json.load(f).get("version")
        return value if isinstance(value, str) else None
    except (OSError, ValueError, AttributeError):
        return None


class Handler(SimpleHTTPRequestHandler):
    server_version = "ManabiServe"
    sys_version = ""

    def log_message(self, format, *args):  # noqa: A002 - 静かに動かす
        pass

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return MIME_TYPES.get(ext, "application/octet-stream")

    def list_directory(self, path):
        # ディレクトリ一覧は出さない
        self.send_error(404, "Not Found")
        return None

    def host_allowed(self):
        host = self.headers.get("Host")
        if not host:
            return True
        port = self.server.server_address[1]
        return host.lower() in ("127.0.0.1:%d" % port, "localhost:%d" % port)

    def cache_control(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        name = path.rsplit("/", 1)[-1]
        if path.endswith("/") or name in NO_CACHE_NAMES or name.endswith(NO_CACHE_SUFFIXES):
            return "no-cache"
        if path.startswith("/assets/"):
            return IMMUTABLE
        return "no-cache"

    def send_response(self, code, message=None):
        self._status = int(code)
        self._cache_sent = False
        super().send_response(code, message)

    def send_header(self, keyword, value):
        if keyword.lower() == "cache-control":
            self._cache_sent = True
        super().send_header(keyword, value)

    def end_headers(self):
        if not getattr(self, "_cache_sent", False):
            # エラー応答はキャッシュさせない。成功した応答はパスで決める
            status = getattr(self, "_status", 200)
            super().send_header("Cache-Control", self.cache_control() if status < 400 else "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def send_head(self):
        # DNS リバインディング対策: 127.0.0.1 / localhost 以外の Host 名には答えない
        if not self.host_allowed():
            self.send_error(403, "Forbidden")
            return None
        if self.path.split("?", 1)[0] == HEALTH_PATH:
            return self.send_health()
        if self.cache_control() == "no-cache":
            # 版に関わるファイルは、条件付き要求（If-Modified-Since）に 304 で答えない。
            # Last-Modified は 1 秒単位で、古い版へ戻す・同じ秒に差し替えるときに、ブラウザが更新を見落とすため
            for name in ("If-Modified-Since", "If-None-Match"):
                del self.headers[name]
        return super().send_head()

    def send_health(self):
        body = json.dumps(
            {"app": APP_NAME, "version": read_version(self.directory)}, ensure_ascii=False
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)
        return None


class QuietServer(ThreadingHTTPServer):
    daemon_threads = True
    # Windows では SO_REUSEADDR だと使用中のポートにも bind できてしまうため、Linux だけ有効にする
    allow_reuse_address = os.name != "nt"

    def handle_error(self, request, client_address):
        # ブラウザが接続を切った等は無視する（静かに動かす）
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionError, BrokenPipeError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def default_directory():
    here = os.path.dirname(os.path.abspath(__file__))
    for candidate in (
        os.path.join(here, "..", "..", "dist"),  # リポジトリ / 配置後の app/deploy/zorin から
        os.path.join(here, "dist"),
    ):
        candidate = os.path.normpath(candidate)
        if os.path.isfile(os.path.join(candidate, "index.html")):
            return candidate
    return os.path.normpath(os.path.join(here, "..", "..", "dist"))


def main(argv=None):
    parser = argparse.ArgumentParser(description="まなびのにわ ローカル配信（127.0.0.1 のみ）")
    parser.add_argument("--dir", default=None, help="配信するフォルダ（既定: ../../dist）")
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help="ポート（既定 %d。変えると学習データが別扱いになるため非推奨）" % DEFAULT_PORT,
    )
    args = parser.parse_args(argv)

    directory = os.path.abspath(args.dir) if args.dir else default_directory()
    if not os.path.isfile(os.path.join(directory, "index.html")):
        sys.stderr.write("エラー: %s に index.html がありません。配布物を正しく配置してください。\n" % directory)
        return 2

    handler = functools.partial(Handler, directory=directory)
    try:
        server = QuietServer((HOST, args.port), handler)
    except OSError as e:
        sys.stderr.write(
            "エラー: %s:%d を使えません（%s）。\n"
            "別のプログラムがこのポートを使っている可能性があります。"
            "別のポートへは自動で切り替えません（学習データが別扱いになるため）。\n"
            % (HOST, args.port, e.strerror or e)
        )
        return EXIT_PORT_IN_USE

    def stop(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGINT, stop)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, stop)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, stop)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
