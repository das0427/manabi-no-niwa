# -*- coding: utf-8 -*-
"""偽の GitHub と、一時の置き場の本物の serve.py（別プロセス）で、窓口だけを使って 2.1.0 → 2.2.0 を通す（設計 11.1 節）"""
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest

from helpers import (
    MANIFEST_PATH,
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


class Client:
    """窓口を使う側（アプリと同じ見出しを付ける）"""

    def __init__(self, port):
        self.port = port
        self.host = "127.0.0.1:%d" % port

    def status(self):
        status, _, raw = http_call(self.port, "GET", "/__manabi/update/status", {"Sec-Fetch-Site": "same-origin"}, host=self.host)
        assert status == 200, status
        return json.loads(raw)

    def post(self, name, body=None):
        headers = {
            "Sec-Fetch-Site": "same-origin",
            "Origin": "http://" + self.host,
            "Content-Type": "application/json",
            "X-Manabi-Token": self.status()["token"],
        }
        status, _, raw = http_call(self.port, "POST", "/__manabi/update/" + name, headers, json.dumps(body or {}), host=self.host)
        return status, json.loads(raw)

    def get(self, path):
        status, _, raw = http_call(self.port, "GET", path, host=self.host)
        return status, raw


@not_root
class IntegrationTest(SandboxCase):
    def setUp(self):
        super().setUp()
        self.old = Release("2.1.0")
        self.new = Release("2.2.0", g34="b", notes=["小学4年の算数に「がい数」を足しました"])
        install_app(self.data, self.old)
        self.fake = FakeGitHub()
        self.addCleanup(self.fake.stop)
        self.fake.set_release(self.new)
        self.logs = tempfile.mkdtemp(prefix="mnwlog-")
        self.addCleanup(remove_dir, self.logs)
        self.port = free_port()
        self.client = Client(self.port)
        self.pids = set()
        self.start()

    def start(self):
        log = open(os.path.join(self.logs, "serve.txt"), "wb")
        env = dict(os.environ, MANABI_UPDATE_TEST_ORIGIN=self.fake.origin, PYTHONIOENCODING="utf-8")
        self.proc = subprocess.Popen(
            [sys.executable, "-u", "-B", os.path.join(self.app, "deploy", "zorin", "serve.py"), "--port", str(self.port)],
            stdin=subprocess.DEVNULL, stdout=log, stderr=log, env=env,
        )
        self.addCleanup(self.cleanup, log)
        self.pids.add(self.proc.pid)
        wait_until(self.alive, 20, message="serve.py が起動しません: " + self.serve_log())

    def alive(self):
        try:
            return self.client.status()["supported"]
        except OSError:
            return False

    def serve_log(self):
        with open(os.path.join(self.logs, "serve.txt"), encoding="utf-8", errors="replace") as f:
            return f.read()

    def cleanup(self, log):
        try:
            self.pids.add(self.client.status()["server"]["pid"])  # 起動し直したあとの本物のプロセス
        except (OSError, AssertionError, ValueError, KeyError):
            pass
        for pid in self.pids:
            try:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/F", "/PID", str(pid)], capture_output=True)
                else:
                    os.kill(pid, 15)
            except OSError:
                pass
        try:
            self.proc.wait(15)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        time.sleep(0.3)
        log.close()

    def poll(self, check, timeout=60, message="timeout"):
        def safe():
            try:
                return check(self.client.status())
            except OSError:  # 起動し直しているあいだは答えない
                return False

        return wait_until(safe, timeout, 0.1, message + ": " + self.serve_log())

    def test_update_from_2_1_0_to_2_2_0(self):
        client = self.client
        status = client.status()
        self.assertEqual((status["supported"], status["current"]["version"], status["check"]["state"]), (True, "2.1.0", "never"))

        code, body = client.post("check")
        self.assertEqual(code, 202)
        status = self.poll(lambda s: s["check"]["state"] == "ok" and s)
        latest = status["latest"]
        self.assertEqual((latest["version"], latest["newer"], latest["installable"]), ("2.2.0", True, True))
        self.assertEqual({p["kind"]: p["changed"] for p in latest["parts"]}, {"main": True, "audio-g1-g2": False, "audio-g3-g4": True})
        self.assertEqual(latest["downloadBytes"], self.new.part("main").bytes + self.new.part("audio-g3-g4").bytes)

        code, body = client.post("apply", {"version": "2.2.0"})
        self.assertEqual((code, body["ok"]), (202, True))
        self.assertIn(body["status"]["update"]["phase"], ("downloading", "extracting", "testing", "switching", "restarting"))
        status = self.poll(lambda s: s["current"]["version"] == "2.2.0" and s, 90, "新しい serve.py に切り替わりません")

        self.assertEqual(status["update"]["phase"], "done", status["update"])
        self.assertEqual(status["update"]["targetVersion"], "2.2.0")
        self.assertEqual((status["lastApplied"]["version"], status["lastApplied"]["from"]), ("2.2.0", "2.1.0"))
        self.assertFalse(status["latest"]["newer"])
        layout = self.layout()
        wait_until(lambda: not os.path.exists(layout.app_prev) and not tree(layout.downloads), 20, message="控えと取得した zip が消えません")
        self.assertFalse(os.path.exists(layout.app_next))

        # 新しい版が配られている
        code, raw = client.get("/index.html")
        self.assertEqual(code, 200)
        self.assertIn(b"2.2.0", raw)
        self.assertEqual(json.loads(client.get("/__manabi/health")[1])["app"], "manabi-no-niwa")
        with open(os.path.join(self.app, "dist", "audio", "g3-kokugo", "q1.mp3"), "rb") as f:
            self.assertEqual(f.read(), b"g3 q1 b" * 40)
        with open(os.path.join(self.app, "parts", "main.json"), encoding="utf-8") as f:
            self.assertEqual(json.load(f)["version"], "2.2.0")
        for rel in ("dist/audio/g1-kokugo/q1.mp3", "dist/audio/g2-kokugo/q1.mp3"):  # 写した音声も使える
            self.assertEqual(client.get("/" + rel[5:])[0], 200)

        # 偽の GitHub に来た要求: 変わらない音声の部品は取得していない
        g12 = self.new.part("audio-g1-g2").name
        self.assertEqual(self.fake.requests_for(g12), [])
        for kind in ("main", "audio-g3-g4"):
            name = self.new.part(kind).name
            self.assertEqual(len([r for r in self.fake.requests_for(name) if r["path"].startswith("/blob/")]), 1, kind)
        self.assertGreaterEqual(len([r for r in self.fake.log if r["path"] == MANIFEST_PATH]), 2)  # 確認と、押したあとの取り直し
        self.assertEqual({r["ua"] for r in self.fake.log}, {"manabi-no-niwa-updater"})
        self.assertEqual({r["cookie"] for r in self.fake.log}, {None})

        # 設定を切り替えると、決められた場所に書く
        code, body = client.post("settings", {"autoCheck": False})
        self.assertEqual((code, body["status"]["settings"]["autoCheck"]), (200, False))
        self.assertEqual(self.new_process_keeps_setting(), False)

        # 書いたのは決められた場所だけ
        allowed = {"manabi-no-niwa/update/state.json", "manabi-no-niwa/update/lock"}
        found = tree(self.data)
        extra = {p for p in found if not p.startswith("manabi-no-niwa/app/") and p not in allowed}
        self.assertEqual(extra, set(), "置き場の外・決めた名前以外に書いた")
        self.assertFalse([p for p in found if "__pycache__" in p or p.endswith(".pyc")])
        self.assertEqual(tree(self.config), {"manabi-no-niwa/updater.json"})
        self.assertEqual(tree(self.home), set())
        self.assertEqual(tree(self.state), set())
        self.assertEqual(sorted(os.listdir(self.base)), ["app", "update"])

    def new_process_keeps_setting(self):
        return self.client.status()["settings"]["autoCheck"]

    def test_failed_update_leaves_the_running_version(self):
        self.fake.blobs[self.new.part("main").name] = b"x" * self.new.part("main").bytes  # sha256 が合わない
        self.client.post("check")
        self.poll(lambda s: s["check"]["state"] == "ok")
        self.assertEqual(self.client.post("apply", {"version": "2.2.0"})[0], 202)
        status = self.poll(lambda s: s["update"]["phase"] in ("failed", "done") and s)
        self.assertEqual((status["update"]["phase"], status["update"]["error"]["code"]), ("failed", "sha256-mismatch"))
        self.assertEqual(status["current"]["version"], "2.1.0")
        self.assertFalse(os.path.exists(self.layout().app_next))
        with open(os.path.join(self.app, "dist", "index.html"), "rb") as f:
            self.assertIn(b"2.1.0", f.read())
        self.assertEqual(self.client.get("/")[0], 200)  # 配信はそのまま


if __name__ == "__main__":
    unittest.main()
