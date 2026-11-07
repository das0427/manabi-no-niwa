# -*- coding: utf-8 -*-
"""窓口 /__manabi/update/… の守り・応答の見出し・supported:false（設計 5.3・5.4 節）"""
import functools
import json
import os
import threading
import unittest
from unittest import mock

from helpers import ServiceCase, http_call  # sys.path に deploy/zorin を足す（serve を読む前に）

import serve  # noqa: E402

PREFIX = "/__manabi/update/"


class ApiCase(ServiceCase):
    def setUp(self):
        super().setUp()
        self.svc = self.make()
        self.server = self.start(self.svc, None)
        self.port = self.server.server_address[1]

    def start(self, updater, reason):
        server = serve.QuietServer(
            ("127.0.0.1", 0), functools.partial(serve.Handler, directory=os.path.join(self.app, "dist"))
        )
        server.update_service = updater
        server.update_reason = reason
        threading.Thread(target=server.serve_forever, args=(0.02,), daemon=True).start()

        def stop():
            server.shutdown()
            server.server_close()

        self.addCleanup(stop)
        return server

    def call(self, method, path, body=None, headers=None, drop=(), host=True, port=None):
        """守りを全部満たす見出しを付け、headers で足し・変え、drop で外す"""
        port = port or self.port
        base = {"Sec-Fetch-Site": "same-origin"}
        data = None
        if method == "POST":
            base.update(
                {
                    "Origin": "http://127.0.0.1:%d" % port,
                    "Content-Type": "application/json",
                    "X-Manabi-Token": self.svc.token,
                }
            )
            data = json.dumps({} if body is None else body).encode("utf-8") if not isinstance(body, bytes) else body
        base.update(headers or {})
        for name in drop:
            base.pop(name, None)
        host_value = "127.0.0.1:%d" % port if host is True else (host or None)
        status, raw_headers, raw = http_call(port, method, path, base, data, host=host_value)
        try:
            parsed = json.loads(raw.decode("utf-8")) if raw else None
        except ValueError:
            parsed = None
        return status, parsed, raw_headers

    def error_code(self, result):
        return result[1]["error"]["code"] if result[1] and not result[1].get("ok", True) else None


class ResponseTest(ApiCase):
    def test_status_response_and_headers(self):
        status, body, headers = self.call("GET", PREFIX + "status")
        self.assertEqual(status, 200)
        self.assertEqual(body["token"], self.svc.token)
        self.assertEqual(body["current"]["version"], "2.1.0")
        names = [k.lower() for k, _ in headers]
        value = lambda n: [v for k, v in headers if k.lower() == n]  # noqa: E731
        self.assertEqual(value("content-type"), ["application/json; charset=utf-8"])
        self.assertEqual(value("cache-control"), ["no-store"])
        self.assertEqual(value("cross-origin-resource-policy"), ["same-origin"])
        self.assertEqual(value("x-content-type-options"), ["nosniff"])
        self.assertFalse([n for n in names if n.startswith("access-control-")])

    def test_error_response_shape_and_headers(self):
        status, body, headers = self.call("GET", PREFIX + "nothing")
        self.assertEqual(status, 404)
        self.assertEqual(body["ok"], False)
        self.assertEqual(set(body["error"]), {"code", "detail"})
        self.assertEqual([v for k, v in headers if k.lower() == "cache-control"], ["no-store"])
        self.assertFalse([k for k, _ in headers if k.lower().startswith("access-control-")])

    def test_query_string_is_ignored_but_the_path_must_match_exactly(self):
        self.assertEqual(self.call("GET", PREFIX + "status?x=1")[0], 200)
        for path in (PREFIX + "status/", PREFIX + "Status", PREFIX + "status%2f", PREFIX + "./status", PREFIX + "x/../status", PREFIX, PREFIX + "status;a"):
            self.assertEqual(self.call("GET", path)[0], 404, path)


class GuardTest(ApiCase):
    def test_host(self):
        for host in ("evil.example.com", "127.0.0.1", "127.0.0.1:1", "localhost", "127.0.0.2:%d" % self.port, "[::1]:%d" % self.port):
            result = self.call("GET", PREFIX + "status", host=host)
            self.assertEqual((result[0], self.error_code(result)), (403, "forbidden"), host)
        self.assertEqual(self.call("GET", PREFIX + "status", host=False)[0], 403)  # Host が無い要求も断る
        for host in ("localhost:%d" % self.port, "LOCALHOST:%d" % self.port, "127.0.0.1:%d" % self.port):
            self.assertEqual(self.call("GET", PREFIX + "status", host=host)[0], 200, host)

    def test_sec_fetch_site(self):
        for site in ("cross-site", "same-site", "weird"):
            self.assertEqual(self.call("GET", PREFIX + "status", headers={"Sec-Fetch-Site": site})[0], 403, site)
            self.assertEqual(self.call("POST", PREFIX + "check", headers={"Sec-Fetch-Site": site})[0], 403, site)
        self.assertEqual(self.call("GET", PREFIX + "status", headers={"Sec-Fetch-Site": "none"})[0], 200)
        self.assertEqual(self.call("GET", PREFIX + "status", drop=["Sec-Fetch-Site"])[0], 200)
        self.assertEqual(self.call("POST", PREFIX + "check", headers={"Sec-Fetch-Site": "none"})[0], 403)
        self.assertEqual(self.call("POST", PREFIX + "check", drop=["Sec-Fetch-Site"])[0], 202)

    def test_origin(self):
        for origin in ("http://127.0.0.1:%d" % (self.port + 1), "http://localhost:%d" % self.port, "https://127.0.0.1:%d" % self.port, "http://evil.example", "null", ""):
            result = self.call("POST", PREFIX + "check", headers={"Origin": origin})
            self.assertEqual((result[0], self.error_code(result)), (403, "forbidden"), origin)
        self.assertEqual(self.call("POST", PREFIX + "check", drop=["Origin"])[0], 403)
        localhost = "localhost:%d" % self.port
        result = self.call("POST", PREFIX + "check", host=localhost, headers={"Origin": "http://" + localhost})
        self.assertEqual(result[0], 202)
        result = self.call("POST", PREFIX + "check", host=localhost)  # Host は localhost、Origin は 127.0.0.1
        self.assertEqual(result[0], 403)

    def test_content_type(self):
        for ctype in ("text/plain", "application/x-www-form-urlencoded", "multipart/form-data", "application/jsonp", "text/json", ""):
            result = self.call("POST", PREFIX + "check", headers={"Content-Type": ctype})
            self.assertEqual((result[0], self.error_code(result)), (415, "unsupported-media-type"), ctype)
        self.assertEqual(self.call("POST", PREFIX + "check", drop=["Content-Type"])[0], 415)
        for ctype in ("application/json; charset=utf-8", "Application/JSON", "application/json;charset=UTF-8"):
            self.assertEqual(self.call("POST", PREFIX + "check", headers={"Content-Type": ctype})[0], 202, ctype)

    def test_token(self):
        for token in ("", "0" * 32, self.svc.token[:-1], self.svc.token + "0", self.svc.token.upper(), "あ" * 32):
            result = self.call("POST", PREFIX + "check", headers={"X-Manabi-Token": token})
            self.assertEqual((result[0], self.error_code(result)), (403, "forbidden"), token)
        self.assertEqual(self.call("POST", PREFIX + "check", drop=["X-Manabi-Token"])[0], 403)

    def test_content_length(self):
        base = {"Content-Length": "4097"}
        result = self.call("POST", PREFIX + "check", headers=base, body=None)
        self.assertEqual((result[0], self.error_code(result)), (413, "payload-too-large"))
        for length in ("abc", "-5", "+5", "1.5", "", "٣"):
            result = self.call("POST", PREFIX + "check", headers={"Content-Length": length}, body=None)
            self.assertEqual((result[0], self.error_code(result)), (400, "bad-request"), repr(length))
        status, _, _ = http_call(
            self.port,
            "POST",
            PREFIX + "check",
            {"Origin": "http://127.0.0.1:%d" % self.port, "Content-Type": "application/json", "X-Manabi-Token": self.svc.token},
            None,
            host="127.0.0.1:%d" % self.port,
        )
        self.assertEqual(status, 400)  # Content-Length が無い
        big = b'{"pad":"' + b"x" * 4000 + b'"}'
        self.assertEqual(self.call("POST", PREFIX + "check", body=big)[0], 202)  # 4096 以下なら通る

    def test_body(self):
        for body in (b"", b"not json", b"[]", b"1", b'"x"', b"null", b"{", b'{"a": NaN}', b"\xff\xfe"):
            result = self.call("POST", PREFIX + "check", body=body)
            self.assertEqual((result[0], self.error_code(result)), (400, "bad-request"), body)
        self.assertEqual(self.call("POST", PREFIX + "check", body={"unknown": [1, 2]})[0], 202)  # 知らない欄は無視
        for body in ({}, {"version": 5}, {"version": "2.2"}, {"version": "v2.2.0"}, {"version": "2.2.0\n"}, {"version": None}):
            result = self.call("POST", PREFIX + "apply", body=body)
            self.assertEqual((result[0], self.error_code(result)), (400, "bad-request"), body)
        for body in ({}, {"autoCheck": "yes"}, {"autoCheck": 1}, {"autoCheck": None}):
            result = self.call("POST", PREFIX + "settings", body=body)
            self.assertEqual((result[0], self.error_code(result)), (400, "bad-request"), body)

    def test_guards_are_checked_in_the_documented_order(self):
        bad_origin = {"Origin": "http://evil.example"}
        bad_type = {"Content-Type": "text/plain"}
        bad_token = {"X-Manabi-Token": "x"}
        huge = {"Content-Length": "99999"}
        self.assertEqual(self.call("POST", PREFIX + "check", headers={**bad_origin, **bad_type, **bad_token})[0], 403)
        self.assertEqual(self.call("POST", PREFIX + "check", headers={**bad_type, **bad_token, **huge}, body=None)[0], 415)
        self.assertEqual(self.call("POST", PREFIX + "check", headers={**bad_token, **huge}, body=None)[0], 403)
        self.assertEqual(self.call("POST", PREFIX + "check", headers=huge, body=None)[0], 413)
        self.assertEqual(self.call("GET", PREFIX + "status", headers={"Sec-Fetch-Site": "cross-site"}, host="evil.example")[0], 403)

    def test_other_methods_are_405_and_wrong_methods_for_a_path_too(self):
        for method in ("PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"):
            result = self.call(method, PREFIX + "status")
            self.assertEqual(result[0], 405, method)
            if method != "HEAD":
                self.assertEqual(self.error_code(result), "method-not-allowed")
            self.assertEqual(self.call(method, PREFIX + "check")[0], 405, method)
            self.assertEqual(self.call(method, PREFIX + "unknown")[0], 405, method)
        self.assertEqual(self.call("GET", PREFIX + "check")[0], 405)
        self.assertEqual(self.call("POST", PREFIX + "status")[0], 405)
        self.assertEqual(self.call("POST", PREFIX + "unknown")[0], 404)
        self.assertEqual(self.call("GET", PREFIX + "unknown")[0], 404)
        # プリフライトに許可を返さない
        _, _, headers = self.call("OPTIONS", PREFIX + "apply", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"})
        self.assertFalse([k for k, _ in headers if k.lower().startswith("access-control-")])


class EndpointTest(ApiCase):
    def test_check_apply_cancel_settings(self):
        status, body, _ = self.call("POST", PREFIX + "check")
        self.assertEqual((status, body["ok"]), (202, True))
        self.assertEqual(body["status"]["schema"], 1)
        self.svc.join(10)
        status, body, _ = self.call("GET", PREFIX + "status")
        self.assertEqual(body["check"]["state"], "ok")
        self.assertEqual(self.call("POST", PREFIX + "check")[0], 202)  # 10 秒以内でも 202（今の状態を返す）

        result = self.call("POST", PREFIX + "apply", body={"version": "2.9.0"})
        self.assertEqual((result[0], self.error_code(result)), (409, "not-newer"))
        result = self.call("POST", PREFIX + "cancel")
        self.assertEqual((result[0], self.error_code(result)), (409, "not-cancellable"))

        status, body, _ = self.call("POST", PREFIX + "settings", body={"autoCheck": False})
        self.assertEqual((status, body["ok"], body["status"]["settings"]["autoCheck"]), (200, True, False))
        self.assertFalse(self.svc.auto_check)

    def test_blocked_and_busy(self):
        self.fetcher.release = type(self.new)("2.2.0", min_version="2.2.0")
        self.svc.request_check()
        self.svc.join(10)
        result = self.call("POST", PREFIX + "apply", body={"version": "2.2.0"})
        self.assertEqual((result[0], self.error_code(result)), (409, "blocked"))
        self.svc._op = "apply"
        self.svc._update["phase"] = "downloading"
        result = self.call("POST", PREFIX + "check")
        self.assertEqual((result[0], self.error_code(result)), (409, "busy"))
        self.assertEqual(self.call("POST", PREFIX + "cancel")[0], 202)

    def test_apply_is_accepted_and_runs_in_the_background(self):
        self.svc.request_check()
        self.svc.join(10)
        with mock.patch("mnwupdate.install.run_self_test"):
            status, body, _ = self.call("POST", PREFIX + "apply", body={"version": "2.2.0"})
            self.assertEqual(status, 202)
            self.assertEqual(body["status"]["update"]["targetVersion"], "2.2.0")
            self.svc.join(60)
        self.assertEqual(self.call("GET", PREFIX + "status")[1]["update"]["phase"], "restarting")


class StaticAndUnsupportedTest(ApiCase):
    def test_static_serving_is_unchanged(self):
        self.assertEqual(http_call(self.port, "GET", "/index.html", host="127.0.0.1:%d" % self.port)[0], 200)
        status, _headers, raw = http_call(self.port, "GET", "/__manabi/health", host="127.0.0.1:%d" % self.port)
        self.assertEqual((status, json.loads(raw)["app"]), (200, "manabi-no-niwa"))
        self.assertEqual(http_call(self.port, "POST", "/index.html", host="127.0.0.1:%d" % self.port)[0], 405)
        self.assertEqual(http_call(self.port, "PUT", "/index.html", host="127.0.0.1:%d" % self.port)[0], 501)
        self.assertEqual(http_call(self.port, "GET", "/index.html", host="evil.example")[0], 403)

    def test_unsupported_place(self):
        server = self.start(None, "custom-dir")
        port = server.server_address[1]
        status, body, headers = self.call("GET", PREFIX + "status", port=port)
        self.assertEqual((status, body), (200, {"schema": 1, "supported": False, "reason": "custom-dir"}))
        self.assertEqual([v for k, v in headers if k.lower() == "cache-control"], ["no-store"])
        for path in ("check", "apply", "cancel", "settings", "anything"):
            result = self.call("POST", PREFIX + path, port=port, headers={"X-Manabi-Token": "none"})
            self.assertEqual((result[0], self.error_code(result)), (404, "unsupported"), path)
        self.assertEqual(self.call("GET", PREFIX + "other", port=port)[0], 404)
        self.assertEqual(self.call("OPTIONS", PREFIX + "status", port=port)[0], 405)
        self.assertEqual(self.call("GET", PREFIX + "status", port=port, host="evil.example")[0], 403)
        self.assertEqual(self.call("GET", PREFIX + "status", port=port, headers={"Sec-Fetch-Site": "cross-site"})[0], 403)
        self.assertEqual(self.call("GET", PREFIX + "status", port=port, host=False)[0], 403)


if __name__ == "__main__":
    unittest.main()
