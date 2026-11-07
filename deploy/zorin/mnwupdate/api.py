# -*- coding: utf-8 -*-
"""窓口 /__manabi/update/… の振り分けと守り（設計 5.3・5.4 節）

respond() は (HTTP の状態, 本文の dict) を返す。見出しを付けて書くのは serve.py の Handler。
"""
from __future__ import annotations

import hmac

from .common import UpdateError, parse_version, strict_loads

PREFIX = "/__manabi/update/"
STATUS_PATH = PREFIX + "status"
MAX_BODY = 4096
HTTP_STATUS = {
    "forbidden": 403,
    "unsupported-media-type": 415,
    "payload-too-large": 413,
    "bad-request": 400,
    "not-found": 404,
    "unsupported": 404,
    "method-not-allowed": 405,
    "busy": 409,
    "not-newer": 409,
    "blocked": 409,
    "not-cancellable": 409,
}


def path_of(target):
    """要求の行のパスから ? より前だけ（完全一致で振り分けるため、%エンコードは戻さない）"""
    return target.split("?", 1)[0].split("#", 1)[0]


def is_update_path(target):
    return path_of(target).startswith(PREFIX)


def failure(code, detail=""):
    return HTTP_STATUS.get(code, 500), {"ok": False, "error": {"code": code, "detail": detail}}


def host_ok(headers, port):
    """Host があり 127.0.0.1:<port> か localhost:<port>（DNS rebinding 対策。無い要求も断る）"""
    host = headers.get("Host")
    return bool(host) and host.lower() in ("127.0.0.1:%d" % port, "localhost:%d" % port)


def fetch_site_ok(headers, method):
    site = headers.get("Sec-Fetch-Site")
    if site is None:
        return True
    allowed = ("same-origin", "none") if method == "GET" else ("same-origin",)
    return site.lower() in allowed


def _declared_length(headers):
    length = headers.get("Content-Length")
    if length is None or not (length.isascii() and length.isdigit()):
        return None
    return int(length)


def read_body(headers, rfile):
    """POST の本文を先に読んでおく（守りで断るときも読み終えておかないと、TCP が切れてブラウザが返事を失う）。
    Content-Length が無い・数でない・大きすぎるときは読まない（None）"""
    size = _declared_length(headers)
    if size is None or size > MAX_BODY:
        return None
    try:
        data = rfile.read(size)
    except OSError:
        return None
    return data if len(data) == size else None


def _check_post(headers, token, body):
    """POST の守り 3〜6。通れば None、断るなら (状態, 本文)"""
    origin = headers.get("Origin")
    if origin is None or origin.lower() != "http://" + headers.get("Host", "").lower():
        return failure("forbidden", "origin")
    content_type = (headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
    if content_type != "application/json":
        return failure("unsupported-media-type", "Content-Type must be application/json")
    given = headers.get("X-Manabi-Token")
    if given is None or not hmac.compare_digest(given.encode("utf-8"), token.encode("utf-8")):
        return failure("forbidden", "token")
    size = _declared_length(headers)
    if size is None:
        return failure("bad-request", "Content-Length required")
    if size > MAX_BODY:
        return failure("payload-too-large", "body is larger than %d bytes" % MAX_BODY)
    if body is None:
        return failure("bad-request", "cannot read body")
    return None


def _json_object(data):
    try:
        value = strict_loads(data.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None
    return value if isinstance(value, dict) else None


def respond(service, method, target, headers, body, port):
    """窓口の 1 要求を処理する。body は read_body() の結果。-> (HTTP の状態, 本文の dict)"""
    if not host_ok(headers, port):
        return failure("forbidden", "host")
    if method not in ("GET", "POST"):
        return failure("method-not-allowed", method)
    if not fetch_site_ok(headers, method):
        return failure("forbidden", "Sec-Fetch-Site")
    if method == "POST":
        refused = _check_post(headers, service.token, body)
        if refused:
            return refused
    path = path_of(target)
    routes = {
        "status": "GET",
        "check": "POST",
        "apply": "POST",
        "cancel": "POST",
        "settings": "POST",
    }
    name = path[len(PREFIX):]
    if name not in routes:
        return failure("not-found", path)
    if routes[name] != method:
        return failure("method-not-allowed", method)
    if method == "GET":
        return 200, service.status()
    fields = _json_object(body)
    if fields is None:
        return failure("bad-request", "body must be a JSON object")
    try:
        if name == "apply":
            version = fields.get("version")
            if not isinstance(version, str) or parse_version(version) is None:
                return failure("bad-request", "version must be X.Y.Z")
            service.request_apply(version)
        elif name == "check":
            service.request_check()
        elif name == "cancel":
            service.request_cancel()
        else:
            flag = fields.get("autoCheck")
            if not isinstance(flag, bool):
                return failure("bad-request", "autoCheck must be a boolean")
            service.set_autocheck(flag)
            return 200, {"ok": True, "status": service.status()}
    except UpdateError as e:
        return failure(e.code, e.detail)
    except Exception as e:  # noqa: BLE001
        return failure("internal", type(e).__name__)
    return 202, {"ok": True, "status": service.status()}
