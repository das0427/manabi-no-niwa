#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""まなびのにわ ローカル配信（Python 3 標準ライブラリのみ）

  python3 serve.py                 127.0.0.1:8765 で dist を配信する
  python3 serve.py --dir PATH      配信するフォルダを指定する
  python3 serve.py --port N        ポートを変える（非推奨。下記）
  python3 serve.py --self-test     この置き場の中身と配信を自己検査して終わる（0 が成功。更新の入れ替え前に使う）
  python3 serve.py --check-update  GitHub の最新の版の情報を 1 回取得して JSON で表示する（保守用）

- 待ち受けは 127.0.0.1 だけ。同じ PC のブラウザからしか開けない（IN-03）。
- ポート番号はブラウザの「オリジン」の一部。変えると学習データ（IndexedDB）が別扱いになる。
  そのため 8765 から変えない（--port はテスト用）。
- ポートが使用中のときは、別のポートへ逃げずに終了する（終了コード 3）。
- アクセスログは出さない。
- /__manabi/health は {"app":"manabi-no-niwa","version":...} を返す。
  別のアプリがポートを使っていないかを、起動スクリプトが確認するために使う。
- /__manabi/update/ は更新の窓口（deploy/zorin/mnwupdate/。docs/expansion/updater-design.md）。
  導入された置き場（~/.local/share/manabi-no-niwa/app）から動いているときだけ有効で、
  外へ通信するのは更新の確認と取得のときだけ（GitHub のこのリポジトリ）。
"""
import sys

sys.dont_write_bytecode = True  # 置き場に __pycache__ を作らない

import argparse  # noqa: E402
import functools  # noqa: E402
import http.client  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import signal  # noqa: E402
import subprocess  # noqa: E402
import threading  # noqa: E402
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
try:  # 読み込みに失敗しても配信は続ける（更新の仕組みだけ止める）
    from mnwupdate import api, common, fetch, install, manifest, service as service_mod

    IMPORT_ERROR = None
except Exception as _e:  # noqa: BLE001
    api = common = fetch = install = manifest = service_mod = None
    IMPORT_ERROR = "%s: %s" % (type(_e).__name__, _e)

HOST = "127.0.0.1"
DEFAULT_PORT = 8765
APP_NAME = "manabi-no-niwa"
HEALTH_PATH = "/__manabi/health"
UPDATE_PREFIX = "/__manabi/update/"
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
        self._nosniff_sent = False
        super().send_response(code, message)

    def send_header(self, keyword, value):
        name = keyword.lower()
        if name == "cache-control":
            self._cache_sent = True
        elif name == "x-content-type-options":
            self._nosniff_sent = True
        super().send_header(keyword, value)

    def end_headers(self):
        if not getattr(self, "_cache_sent", False):
            # エラー応答はキャッシュさせない。成功した応答はパスで決める
            status = getattr(self, "_status", 200)
            super().send_header("Cache-Control", self.cache_control() if status < 400 else "no-cache")
        if not getattr(self, "_nosniff_sent", False):
            self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        # ほかのサイトの枠（iframe）に入れさせない（クリックジャッキングで「更新する」などを押させない）。
        # index.html の CSP は meta なので frame-ancestors が効かず、見出しで送る（ほかの決まりは meta のまま）
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "frame-ancestors 'none'")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        super().end_headers()

    def send_head(self):
        if self.is_update_request():
            return self.handle_update()
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

    # ---- 更新の窓口 -------------------------------------------------------

    def is_update_request(self):
        return self.path.split("?", 1)[0].split("#", 1)[0].startswith(UPDATE_PREFIX)

    def do_POST(self):
        if self.is_update_request():
            self.handle_update()
        else:
            self.send_error(405, "Method Not Allowed")

    def other_method(self):
        if self.is_update_request():
            self.handle_update()
        else:
            self.send_error(501, "Unsupported method (%r)" % self.command)

    do_PUT = do_DELETE = do_PATCH = do_OPTIONS = other_method

    def handle_update(self):
        updater = getattr(self.server, "update_service", None)
        port = self.server.server_address[1]
        try:
            if self.command == "POST":
                self.connection.settimeout(15)  # 本文を送ってこない相手で止まらない
            if updater is not None and api is not None:
                data = api.read_body(self.headers, self.rfile) if self.command == "POST" else None
                status, body = api.respond(updater, self.command, self.path, self.headers, data, port)
            else:
                reason = getattr(self.server, "update_reason", None) or "updater-error"
                status, body = self.unsupported_update(reason, port)
        except Exception as e:  # noqa: BLE001
            status = 500
            body = {"ok": False, "error": {"code": "internal", "detail": type(e).__name__}}
        self.send_json(status, body)
        return None

    def unsupported_update(self, reason, port):
        """更新の仕組みが動かない置き場の窓口: status は supported:false、POST は 404 unsupported"""

        def error(status, code):
            return status, {"ok": False, "error": {"code": code, "detail": reason}}

        host = self.headers.get("Host")
        if not host or host.lower() not in ("127.0.0.1:%d" % port, "localhost:%d" % port):
            return error(403, "forbidden")
        if self.command not in ("GET", "POST"):
            return error(405, "method-not-allowed")
        site = self.headers.get("Sec-Fetch-Site")
        if site is not None and site.lower() not in (
            ("same-origin", "none") if self.command == "GET" else ("same-origin",)
        ):
            return error(403, "forbidden")
        if self.command == "POST":
            return error(404, "unsupported")
        if self.path.split("?", 1)[0] != UPDATE_PREFIX + "status":
            return error(404, "not-found")
        return 200, {"schema": 1, "supported": False, "reason": reason}

    def send_json(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)


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


# ---- --self-test ------------------------------------------------------------


def self_test(dir_arg):
    """更新の入れ替えの前に、新しい serve.py が動くかを別のプロセスで確かめる。ネットにつながない・書かない"""
    problems = []
    if IMPORT_ERROR is not None:
        problems.append("mnwupdate を読み込めません: %s" % IMPORT_ERROR)
    else:
        try:
            import importlib
            import pkgutil

            for info in pkgutil.iter_modules(sys.modules["mnwupdate"].__path__):
                importlib.import_module("mnwupdate." + info.name)
        except Exception as e:  # noqa: BLE001
            problems.append("mnwupdate のモジュールを読み込めません: %s: %s" % (type(e).__name__, e))
        try:
            install.verify_tree(os.path.dirname(os.path.dirname(HERE)))
        except common.UpdateError as e:
            problems.append("置き場の中身が正しくありません: %s" % e.detail)
        except Exception as e:  # noqa: BLE001
            problems.append("置き場の中身を確かめられません: %s: %s" % (type(e).__name__, e))
    directory = os.path.abspath(dir_arg) if dir_arg else default_directory()
    server = None
    started = False
    try:
        server = QuietServer((HOST, 0), functools.partial(Handler, directory=directory))
        port = server.server_address[1]
        threading.Thread(target=server.serve_forever, daemon=True).start()
        started = True
        for path, check in (
            (HEALTH_PATH, lambda status, data: status == 200 and json.loads(data).get("app") == APP_NAME),
            ("/", lambda status, data: status == 200),
        ):
            conn = http.client.HTTPConnection(HOST, port, timeout=10)
            try:
                conn.request("GET", path)
                resp = conn.getresponse()
                if not check(resp.status, resp.read().decode("utf-8", "replace")):
                    problems.append("GET %s が正しく答えません (HTTP %d)" % (path, resp.status))
            finally:
                conn.close()
    except Exception as e:  # noqa: BLE001
        problems.append("配信を試せません: %s: %s" % (type(e).__name__, e))
    finally:
        if server is not None:
            if started:
                server.shutdown()
            server.server_close()
    for problem in problems:
        sys.stderr.write("self-test: %s\n" % problem)
    return 1 if problems else 0


# ---- --check-update ---------------------------------------------------------


def check_update():
    """版の情報を 1 回取得して要約を JSON で標準出力へ。成功・版の情報なしは 0、失敗は 1"""

    def emit(latest, error):
        text = json.dumps({"latest": latest, "error": error}, ensure_ascii=False, indent=2) + "\n"
        sys.stdout.flush()
        sys.stdout.buffer.write(text.encode("utf-8"))
        sys.stdout.buffer.flush()

    if IMPORT_ERROR is not None:
        emit(None, {"code": "updater-error", "detail": IMPORT_ERROR})
        return 1
    try:
        raw = fetch.Fetcher(fetch.endpoint_from_env()).fetch_manifest()
        if raw is None:
            emit(None, None)
            return 0
        m = manifest.parse_manifest(raw)
    except common.UpdateError as e:
        emit(None, e.to_dict())
        return 1
    emit(
        {
            "schema": m.schema,
            "version": m.version,
            "tag": m.tag,
            "date": m.date,
            "minVersion": m.min_version,
            "notes": m.notes,
            "parts": [
                {
                    "kind": p.kind,
                    "name": p.name,
                    "bytes": p.bytes,
                    "sha256": p.sha256,
                    "contentId": p.content_id,
                    "files": p.files,
                    "unpackedBytes": p.unpacked_bytes,
                }
                for p in m.parts
            ],
        },
        None,
    )
    return 0


# ---- 更新の仕組みの起動と、再起動 --------------------------------------------


def start_updater(server, args, directory, argv=()):
    """-> (UpdateService か None, 動かない理由か None)。argv は再起動で渡す引数（自己検査にも使う）"""
    if IMPORT_ERROR is not None:
        sys.stderr.write("[更新] 更新の仕組みを読み込めませんでした: %s\n" % IMPORT_ERROR)
        return None, "updater-error"
    try:
        layout, reason = common.detect_layout(
            os.path.abspath(__file__), directory, args.dir is not None, port=args.port
        )
        if layout is None:
            if reason == "bad-test-origin":
                sys.stderr.write("[更新] MANABI_UPDATE_TEST_ORIGIN（試験用）があるため、更新の仕組みを止めました\n")
            return None, reason
        endpoint = fetch.endpoint_from_env()
        updater = service_mod.UpdateService(layout, fetch.Fetcher(endpoint))
        if not updater.acquire_process_lock():
            sys.stderr.write("[更新] 同じ置き場の配信がほかに動いているため、更新の仕組みを使いません\n")
            return None, "another-server"
        if endpoint.test:
            sys.stderr.write("[更新] 試験用の取得先 %s を使います（GitHub にはつなぎません）\n" % endpoint.origin)
        updater.shutdown_callback = server.shutdown
        updater.restart_args = list(argv)
        updater.start()
        return updater, None
    except Exception as e:  # noqa: BLE001
        sys.stderr.write("[更新] 更新の仕組みを始められませんでした: %s: %s\n" % (type(e).__name__, e))
        return None, "updater-error"


def _inheritable(stream):
    try:
        stream.fileno()
        return stream
    except Exception:  # noqa: BLE001
        return subprocess.DEVNULL


def restart_process(layout, argv):
    """入れ替えのあと、新しい serve.py で自分を起動し直す。Linux は exec（PID 不変）、Windows は別プロセス。
    起動し直せなければ終了コード 1（systemd なら Restart=on-failure、手で起動したなら次にアイコンを開いたとき）"""
    try:
        python = sys.executable or "python3"
        command = [python, layout.serve_py] + list(argv)
        sys.stdout.flush()
        sys.stderr.flush()
        if os.name == "nt":  # Windows は試験だけ。標準出力・標準エラーは引き継ぎ、窓は開かない
            subprocess.Popen(
                command,
                stdin=subprocess.DEVNULL,
                stdout=_inheritable(sys.stdout),
                stderr=_inheritable(sys.stderr),
                close_fds=True,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            return 0
        os.execv(python, command)
    except Exception as e:  # noqa: BLE001
        try:
            sys.stderr.write("[更新] 配信を起動し直せませんでした: %s: %s\n" % (type(e).__name__, e))
        except Exception:  # noqa: BLE001
            pass
    return 1


def main(argv=None):
    parser = argparse.ArgumentParser(description="まなびのにわ ローカル配信（127.0.0.1 のみ）")
    parser.add_argument("--dir", default=None, help="配信するフォルダ（既定: ../../dist）")
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help="ポート（既定 %d。変えると学習データが別扱いになるため非推奨）" % DEFAULT_PORT,
    )
    parser.add_argument("--self-test", action="store_true", help="この置き場を自己検査して終わる")
    parser.add_argument("--check-update", action="store_true", help="最新の版の情報を取得して表示する")
    args = parser.parse_args(argv)
    if args.self_test:
        return self_test(args.dir)
    if args.check_update:
        return check_update()

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

    # ポートを取れてから始める（取れなかった側が、動いている側の作業用フォルダを片付けないように）
    restart_argv = sys.argv[1:] if argv is None else list(argv)
    updater, reason = start_updater(server, args, directory, restart_argv)
    server.update_service = updater
    server.update_reason = reason

    def stop(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGINT, stop)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, stop)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, stop)

    interrupted = False
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        interrupted = True
    finally:
        server.server_close()
        if updater is not None:
            updater.stop()
    if updater is not None and updater.restart_event.is_set() and not interrupted:
        return restart_process(updater.layout, restart_argv)
    return 0


if __name__ == "__main__":
    sys.exit(main())
