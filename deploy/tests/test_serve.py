# -*- coding: utf-8 -*-
"""serve.py: --self-test・--check-update・更新の仕組みが動かない置き場・読み込み失敗でも配信する（設計 5.1・5.8 節）"""
import io
import json
import os
import subprocess
import sys
import tempfile
import types
import unittest
from unittest import mock

from helpers import (
    ZORIN,
    FakeGitHub,
    Release,
    SandboxCase,
    free_port,
    http_call,
    install_app,
    not_root,
    remove_dir,
    tree,
    wait_until,
)
import serve
from mnwupdate import common

SERVE = os.path.join(ZORIN, "serve.py")
ENV = {"PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1"}


class ServeCase(SandboxCase):
    def setUp(self):
        super().setUp()
        self.release = Release("2.1.0")
        install_app(self.data, self.release)
        self.script = os.path.join(self.app, "deploy", "zorin", "serve.py")
        self.logs = tempfile.mkdtemp(prefix="mnwlog-")
        self.addCleanup(remove_dir, self.logs)

    def run_script(self, script, *args, env=None):
        merged = dict(os.environ, **ENV, **(env or {}))
        done = subprocess.run(
            [sys.executable, "-B", script, *args],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=90,
            env=merged,
        )
        return done.returncode, done.stdout.decode("utf-8"), done.stderr.decode("utf-8")

    def start(self, script, *args, env=None):
        """serve.py を空きポートで起動して health が答えるまで待つ。-> (port, Popen, 標準エラーのパス)"""
        port = free_port()
        err_path = os.path.join(self.logs, "err%d.txt" % port)
        err = open(err_path, "wb")
        proc = subprocess.Popen(
            [sys.executable, "-B", script, "--port", str(port), *args],
            stdin=subprocess.DEVNULL,
            stdout=err,
            stderr=err,
            env=dict(os.environ, **ENV, **(env or {})),
        )

        def stop():
            if proc.poll() is None:
                proc.terminate()
            proc.wait(15)
            err.close()

        self.addCleanup(stop)

        def healthy():
            if proc.poll() is not None:
                raise AssertionError("serve.py が終了しました: %r" % open(err_path, encoding="utf-8").read())
            try:
                return http_call(port, "GET", "/__manabi/health", host="127.0.0.1:%d" % port)[0] == 200
            except OSError:
                return False

        wait_until(healthy, 20, message="serve.py の起動を待てません")
        return port, proc, err_path

    def update_status(self, port):
        status, headers, raw = http_call(port, "GET", "/__manabi/update/status", host="127.0.0.1:%d" % port)
        return status, json.loads(raw)

    def stderr_of(self, path):
        with open(path, encoding="utf-8") as f:
            return f.read()


class SelfTestTest(ServeCase):
    def test_good_place_passes_quietly_and_writes_nothing(self):
        before = tree(self.base)
        code, out, err = self.run_script(self.script, "--self-test")
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(tree(self.base), before)  # __pycache__ も作らない
        self.assertEqual(tree(self.home) | tree(self.config) | tree(self.state), set())

    def break_and_run(self, rel, new_text=None, expect=None):
        path = os.path.join(self.app, *rel.split("/"))
        if new_text is None:
            os.unlink(path)
        else:
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_text)
        code, _, err = self.run_script(self.script, "--self-test")
        self.assertEqual(code, 1, err)
        if expect:
            self.assertIn(expect, err)

    def test_missing_files_fail(self):
        self.break_and_run("dist/sw.js", expect="sw.js")

    def test_missing_main_mark_fails(self):
        self.break_and_run("parts/main.json", expect="main.json")

    def test_broken_module_fails(self):
        self.break_and_run("deploy/zorin/mnwupdate/service.py", "raise RuntimeError('broken')\n", expect="mnwupdate")

    def test_mismatching_app_version_fails(self):
        self.break_and_run("dist/version.json", json.dumps({"version": "x", "appVersion": "9.9.9"}), expect="appVersion")

    def test_missing_pack_file_fails(self):
        self.break_and_run("dist/audio/g3-kokugo/q1.mp3", expect="g3-kokugo")

    def test_empty_directory_fails(self):
        empty = os.path.join(self.tmp, "empty")
        os.makedirs(empty)
        code, _, err = self.run_script(self.script, "--self-test", "--dir", empty)
        self.assertEqual(code, 1)
        self.assertIn("GET /", err)

    def test_works_wherever_the_app_folder_is_called(self):
        moved = os.path.join(self.base, "app.next")
        os.rename(self.app, moved)
        code, _, err = self.run_script(os.path.join(moved, "deploy", "zorin", "serve.py"), "--self-test")
        self.assertEqual((code, err), (0, ""))


class ReasonsTest(ServeCase):
    def assert_reason(self, reason, script=None, args=(), env=None):
        port, _proc, err = self.start(script or self.script, *args, env=env)
        status, body = self.update_status(port)
        self.assertEqual((status, body), (200, {"schema": 1, "supported": False, "reason": reason}))
        result = http_call(
            port, "POST", "/__manabi/update/check", {"Origin": "http://127.0.0.1:%d" % port, "Content-Type": "application/json"}, "{}", host="127.0.0.1:%d" % port
        )
        self.assertEqual(result[0], 404)
        self.assertEqual(json.loads(result[2])["error"]["code"], "unsupported")
        self.assertEqual(http_call(port, "GET", "/", host="127.0.0.1:%d" % port)[0], 200)  # 配信は続く
        return err

    def test_not_installed(self):
        err = self.assert_reason("not-installed", SERVE, ["--dir", os.path.join(self.app, "dist")])
        self.assertEqual(self.stderr_of(err), "")  # 静か

    def test_custom_dir(self):
        other = os.path.join(self.tmp, "other-dist")
        os.makedirs(other)
        with open(os.path.join(other, "index.html"), "w") as f:
            f.write("<html></html>")
        err = self.assert_reason("custom-dir", args=["--dir", other])
        self.assertEqual(self.stderr_of(err), "")

    @not_root
    def test_same_dir_given_explicitly_is_not_custom(self):
        port, _, _ = self.start(self.script, "--dir", os.path.join(self.app, "dist"))
        self.assertTrue(self.update_status(port)[1]["supported"])

    def test_no_parts(self):
        os.unlink(os.path.join(self.app, "parts", "main.json"))
        self.assertEqual(self.stderr_of(self.assert_reason("no-parts")), "")

    @not_root
    def test_bad_test_origin_stops_the_updater_but_not_the_serving(self):
        err = self.assert_reason("bad-test-origin", env={"MANABI_UPDATE_TEST_ORIGIN": "http://localhost:4801"})
        lines = [x for x in self.stderr_of(err).splitlines() if x.strip()]
        self.assertEqual(len(lines), 1)
        self.assertIn("MANABI_UPDATE_TEST_ORIGIN", lines[0])

    @not_root
    def test_test_origin_is_refused_on_the_production_port(self):
        # 本番の 8765 では、試験用の取得先が環境に残っていても使わない（8765 は試験で使わないので、判定だけを試す）
        dist = os.path.join(self.app, "dist")
        env = {"MANABI_UPDATE_TEST_ORIGIN": "http://127.0.0.1:4801"}
        self.assertEqual(common.detect_layout(self.script, dist, False, env, port=8765), (None, "bad-test-origin"))
        self.assertIsNotNone(common.detect_layout(self.script, dist, False, env, port=4901)[0])
        self.assertIsNotNone(common.detect_layout(self.script, dist, False, {}, port=8765)[0])

    @not_root
    def test_test_origin_is_announced_and_shown_in_the_status(self):
        port, _proc, err = self.start(self.script, env={"MANABI_UPDATE_TEST_ORIGIN": "http://127.0.0.1:4801"})
        status, body = self.update_status(port)
        self.assertEqual((status, body["supported"], body["testOrigin"]), (200, True, True))
        self.assertIn("http://127.0.0.1:4801", self.stderr_of(err))

    @not_root
    def test_a_second_server_of_the_same_place_does_not_use_the_updater(self):
        # 鍵（flock）は Linux だけなので、偽の fcntl で 2 つの配信の始まりを試す
        from test_service import FakeFcntl
        from mnwupdate import service

        args = types.SimpleNamespace(dir=None, port=4901)
        dist = os.path.join(self.app, "dist")
        server = types.SimpleNamespace(shutdown=mock.Mock())
        closed = {"MANABI_UPDATE_TEST_ORIGIN": "http://127.0.0.1:9"}  # 外へは決してつながない
        with mock.patch.object(serve, "__file__", self.script), mock.patch.object(service, "fcntl", FakeFcntl()), mock.patch.dict(os.environ, closed):
            err = io.StringIO()
            with mock.patch.object(sys, "stderr", err):
                first, reason = serve.start_updater(server, args, dist, ["--port", "4901"])
                self.assertIsNotNone(first, err.getvalue())
                self.addCleanup(first.stop)
                self.addCleanup(os.close, first._process_lock_fd)
                self.assertEqual(first.restart_args, ["--port", "4901"])
                second, reason = serve.start_updater(server, args, dist, ["--port", "4902"])
        self.assertEqual((second, reason), (None, "another-server"))
        self.assertIn("同じ置き場の配信", err.getvalue())

    def test_updater_that_cannot_be_imported_does_not_stop_serving(self):
        with open(os.path.join(self.app, "deploy", "zorin", "mnwupdate", "__init__.py"), "w") as f:
            f.write("def broken(:\n")
        err = self.assert_reason("updater-error")
        lines = [x for x in self.stderr_of(err).splitlines() if x.strip()]
        self.assertEqual(len(lines), 1)
        self.assertIn("[更新]", lines[0])

    @not_root
    def test_installed_place_is_supported_and_port_conflict_keeps_the_other_alone(self):
        port, proc, _ = self.start(self.script)
        status, body = self.update_status(port)
        self.assertEqual((status, body["supported"], body["current"]["version"]), (200, True, "2.1.0"))
        leftover = os.path.join(self.base, "app.next")
        os.makedirs(leftover)
        second = subprocess.run(
            [sys.executable, "-B", self.script, "--port", str(port)],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30,
            env=dict(os.environ, **ENV),
        )
        self.assertEqual(second.returncode, 3)
        self.assertIn("別のポートへは自動で切り替えません", second.stderr.decode("utf-8", "replace"))
        self.assertTrue(os.path.isdir(leftover))  # ポートを取れなかった側は、作業用のフォルダに触らない
        self.assertIsNone(proc.poll())

    @not_root
    def test_root_is_refused(self):
        layout, reason = common.detect_layout(self.script, os.path.join(self.app, "dist"), False)
        self.assertEqual((reason, layout.app), (None, self.app))
        with mock.patch.object(os, "geteuid", create=True, return_value=0):
            self.assertEqual(common.detect_layout(self.script, os.path.join(self.app, "dist"), False), (None, "root"))

    @not_root
    def test_detect_layout_shapes(self):
        dist = os.path.join(self.app, "dist")
        wrong = os.path.join(self.tmp, "else", "app", "deploy", "zorin", "serve.py")
        self.assertEqual(common.detect_layout(wrong, dist, False)[1], "not-installed")
        wrong = os.path.join(self.base, "app2", "deploy", "zorin", "serve.py")
        self.assertEqual(common.detect_layout(wrong, dist, False)[1], "not-installed")
        self.assertEqual(common.detect_layout(SERVE, dist, False)[1], "not-installed")
        self.assertEqual(common.detect_layout(self.script, os.path.join(self.tmp, "x"), True)[1], "custom-dir")
        for bad in ('{"version": "2.1"}', "{", '{"version": 2}'):
            with open(os.path.join(self.app, "parts", "main.json"), "w") as f:
                f.write(bad)
            self.assertEqual(common.detect_layout(self.script, dist, False)[1], "no-parts", bad)
        env = {"MANABI_UPDATE_TEST_ORIGIN": "http://127.0.0.1:0"}
        with open(os.path.join(self.app, "parts", "main.json"), "w") as f:
            json.dump(self.release.marks["main"], f)
        self.assertEqual(common.detect_layout(self.script, dist, False, env)[1], "bad-test-origin")
        env = dict(os.environ, MANABI_UPDATE_TEST_ORIGIN="http://127.0.0.1:4801")
        layout = common.detect_layout(self.script, dist, False, env)[0]
        self.assertEqual(layout.base, self.base)
        self.assertEqual(layout.config_file, os.path.join(self.config, "manabi-no-niwa", "updater.json"))


class FrameHeadersTest(ServeCase):
    """ほかのサイトの枠（iframe）に入れさせない見出しを、どの応答にも付ける（クリックジャッキング）"""

    @not_root
    def test_every_response_refuses_to_be_framed(self):
        port, _proc, _err = self.start(self.script)
        host = "127.0.0.1:%d" % port
        token = self.update_status(port)[1]["token"]
        requests = [
            ("GET", "/", None, {}),
            ("GET", "/sw.js", None, {}),
            ("GET", "/__manabi/health", None, {}),
            ("GET", "/__manabi/update/status", None, {}),
            ("GET", "/nothing-here", None, {}),
            ("POST", "/__manabi/update/check", "{}", {"Origin": "http://evil.example", "Content-Type": "application/json"}),
            (
                "POST",
                "/__manabi/update/settings",
                '{"autoCheck": true}',
                {"Origin": "http://" + host, "Content-Type": "application/json", "X-Manabi-Token": token},
            ),
            ("OPTIONS", "/__manabi/update/status", None, {}),
        ]
        for method, path, body, headers in requests:
            with self.subTest(method + " " + path):
                status, got, _ = http_call(port, method, path, headers, body, host=host)
                names = {k.lower(): v for k, v in got}
                self.assertEqual(names.get("x-frame-options"), "DENY", status)
                self.assertEqual(names.get("content-security-policy"), "frame-ancestors 'none'", status)
                self.assertEqual(names.get("cross-origin-opener-policy"), "same-origin", status)
                self.assertNotIn("access-control-allow-origin", names)


class RestartTest(unittest.TestCase):
    layout = types.SimpleNamespace(serve_py="/home/u/.local/share/manabi-no-niwa/app/deploy/zorin/serve.py")

    def test_linux_replaces_the_process_with_the_new_serve_py(self):
        fake_os = types.SimpleNamespace(name="posix", execv=mock.Mock())
        with mock.patch.object(serve, "os", fake_os):
            serve.restart_process(self.layout, ["--port", "4900"])
        fake_os.execv.assert_called_once_with(
            sys.executable, [sys.executable, self.layout.serve_py, "--port", "4900"]
        )

    def test_failure_is_exit_code_1_with_a_message(self):
        fake_os = types.SimpleNamespace(name="posix", execv=mock.Mock(side_effect=OSError("no exec")))
        err = io.StringIO()
        with mock.patch.object(serve, "os", fake_os), mock.patch.object(sys, "stderr", err):
            self.assertEqual(serve.restart_process(self.layout, []), 1)
        self.assertIn("no exec", err.getvalue())

    def test_windows_starts_another_process_and_exits_0(self):
        fake_os = types.SimpleNamespace(name="nt", execv=mock.Mock())
        with mock.patch.object(serve, "os", fake_os), mock.patch.object(serve.subprocess, "Popen") as popen:
            self.assertEqual(serve.restart_process(self.layout, ["--port", "4900"]), 0)
        self.assertEqual(popen.call_args[0][0], [sys.executable, self.layout.serve_py, "--port", "4900"])
        fake_os.execv.assert_not_called()


class CheckUpdateTest(ServeCase):
    def setUp(self):
        super().setUp()
        self.fake = FakeGitHub()
        self.addCleanup(self.fake.stop)
        self.new = Release("2.2.0", notes=["a"])
        self.fake.set_release(self.new)

    def check(self, origin=None):
        env = {"MANABI_UPDATE_TEST_ORIGIN": origin or self.fake.origin}
        code, out, err = self.run_script(SERVE, "--check-update", env=env)
        return code, json.loads(out), err

    def test_prints_a_summary(self):
        code, out, _ = self.check()  # 置き場が無い開発用の serve.py でも動く
        self.assertEqual(code, 0)
        self.assertIsNone(out["error"])
        self.assertEqual((out["latest"]["version"], out["latest"]["tag"], out["latest"]["notes"]), ("2.2.0", "v2.2.0", ["a"]))
        self.assertEqual([p["kind"] for p in out["latest"]["parts"]], ["main", "audio-g1-g2", "audio-g3-g4"])
        self.assertEqual(out["latest"]["parts"][0]["name"], "manabi-no-niwa-2.2.0.zip")
        self.assertEqual({r["ua"] for r in self.fake.log}, {"manabi-no-niwa-updater"})

    def test_no_manifest_is_success_with_null(self):
        self.fake.manifest = None
        self.assertEqual(self.check()[:2], (0, {"latest": None, "error": None}))

    def test_failures_are_exit_1_with_a_code(self):
        self.fake.manifest = b'{"schema": 1}'
        code, out, _ = self.check()
        self.assertEqual((code, out["latest"], out["error"]["code"]), (1, None, "bad-manifest"))
        self.fake.redirect_to = "http://127.0.0.2:%d/x" % self.fake.port
        code, out, _ = self.check()
        self.assertEqual((code, out["error"]["code"]), (1, "redirect-host"))
        closed = FakeGitHub()
        origin = closed.origin
        closed.stop()
        code, out, _ = self.check(origin)
        self.assertEqual((code, out["error"]["code"]), (1, "offline"))

    def test_bad_test_origin(self):
        code, out, _ = self.check("http://localhost:4801")
        self.assertEqual((code, out["error"]["code"]), (1, "bad-test-origin"))
        self.assertEqual(self.fake.log, [])


if __name__ == "__main__":
    unittest.main()
