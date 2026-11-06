# -*- coding: utf-8 -*-
"""状態・設定・予定・起動時の片付け・apply の受け付けと各段・中止（設計 5.2・5.3・5.5・5.11・5.12 節）"""
import json
import os
import threading
import unittest
from unittest import mock

from helpers import ISO, Release, ServiceCase, install_app, tree
from mnwupdate import common, install
from mnwupdate.common import Cancelled, UpdateError

class StatusAndSettingsTest(ServiceCase):
    def test_status_has_every_field(self):
        status = self.make().status()
        json.dumps(status)
        self.assertEqual(
            set(status),
            {"schema", "supported", "reason", "token", "server", "current", "settings", "disk", "check", "latest", "update", "lastApplied"},
        )
        self.assertEqual((status["schema"], status["supported"], status["reason"]), (1, True, None))
        self.assertRegex(status["token"], r"^[0-9a-f]{32}$")
        self.assertEqual(status["server"]["pid"], os.getpid())
        self.assertRegex(status["server"]["startedAt"], ISO)
        self.assertEqual(status["current"], {"version": "2.1.0"})
        self.assertEqual(status["settings"], {"autoCheck": True})
        self.assertGreater(status["disk"]["freeBytes"], 0)
        self.assertEqual(status["check"], {"state": "never", "at": None, "error": None})
        self.assertIsNone(status["latest"])
        self.assertIsNone(status["lastApplied"])
        self.assertEqual(
            status["update"],
            {"phase": "idle", "targetVersion": None, "progress": None, "error": None, "startedAt": None, "finishedAt": None},
        )
        self.assertNotEqual(self.make().token, status["token"])

    def test_latest_has_every_field(self):
        latest = self.checked().status()["latest"]
        self.assertEqual(
            set(latest),
            {"version", "date", "notes", "newer", "installable", "blockedReason", "downloadBytes", "needBytes", "parts"},
        )
        self.assertEqual(latest["notes"], ["小学4年の算数に「がい数」を足しました"])
        self.assertEqual([p["kind"] for p in latest["parts"]], ["main", "audio-g1-g2", "audio-g3-g4"])
        self.assertEqual(set(latest["parts"][0]), {"kind", "bytes", "changed"})

    def test_settings_round_trip(self):
        svc = self.make()
        svc.set_autocheck(False)
        path = os.path.join(self.config, "manabi-no-niwa", "updater.json")
        with open(path, encoding="utf-8") as f:
            self.assertEqual(json.load(f), {"schema": 1, "autoCheck": False})
        self.assertFalse(svc.status()["settings"]["autoCheck"])
        self.assertFalse(self.make().auto_check)  # 次の起動でも
        svc.set_autocheck(True)
        self.assertTrue(self.make().auto_check)
        self.assertEqual(sorted(os.listdir(os.path.dirname(path))), ["updater.json"])  # 一時ファイルを残さない

    def test_missing_or_broken_settings_mean_on(self):
        path = common.config_file_path()
        self.assertTrue(self.make().auto_check)
        os.makedirs(os.path.dirname(path))
        for text in ("{broken", "[]", '{"autoCheck": "no"}', '{"autoCheck": 0}', ""):
            with open(path, "w", encoding="utf-8") as f:
                f.write(text)
            self.assertTrue(self.make().auto_check, text)

    def test_state_is_persisted_and_survives_restart(self):
        self.checked()
        saved = self.state_file()
        self.assertEqual(saved["schema"], 1)
        self.assertEqual(saved["latest"]["minVersion"], "2.1.0")
        again = self.make().status()
        self.assertEqual(again["check"]["state"], "ok")
        self.assertEqual(again["latest"]["version"], "2.2.0")
        self.assertNotIn("minVersion", again["latest"])
        self.assertTrue(again["latest"]["newer"])


class ScheduleTest(ServiceCase):
    def test_first_check_after_15_seconds_then_12_hours(self):
        svc = self.make()
        start = self.clock.now
        for delta in (0, 14.9):
            self.clock.now = start + delta
            self.assertFalse(svc.tick())
        self.clock.now = start + 15
        self.assertTrue(svc.tick())
        self.assertEqual(self.fetcher.calls, 1)
        self.assertEqual(svc.status()["check"]["state"], "ok")
        self.clock.now = start + 15 + 12 * 3600 - 1
        self.assertFalse(svc.tick())
        self.clock.now = start + 15 + 12 * 3600
        self.assertTrue(svc.tick())
        self.assertEqual(self.fetcher.calls, 2)

    def test_failure_retries_after_30_minutes_and_success_goes_back_to_12_hours(self):
        svc = self.make()
        self.fetcher.error = UpdateError("offline", "no network")
        self.clock.now += 15
        self.assertTrue(svc.tick())
        check = svc.status()["check"]
        self.assertEqual((check["state"], check["error"]["code"]), ("offline", "offline"))
        self.clock.now += 1799
        self.assertFalse(svc.tick())
        self.clock.now += 1
        self.assertTrue(svc.tick())
        self.fetcher.error = None
        self.clock.now += 1800
        self.assertTrue(svc.tick())
        self.clock.now += 1800
        self.assertFalse(svc.tick())

    def test_off_means_no_automatic_check_and_on_checks_after_5_seconds(self):
        svc = self.make()
        svc.set_autocheck(False)
        self.clock.now += 10**6
        self.assertFalse(svc.tick())
        self.assertEqual(self.fetcher.calls, 0)
        svc.set_autocheck(True)
        self.clock.now += 4.9
        self.assertFalse(svc.tick())
        self.clock.now += 0.1
        self.assertTrue(svc.tick())

    def test_off_at_startup(self):
        os.makedirs(os.path.join(self.config, "manabi-no-niwa"))
        with open(common.config_file_path(), "w") as f:
            f.write('{"schema":1,"autoCheck":false}')
        svc = self.make()
        self.clock.now += 10**6
        self.assertFalse(svc.tick())
        self.assertEqual(self.fetcher.calls, 0)
        svc.request_check()  # 押したときだけ確かめる
        svc.join(10)
        self.assertEqual(self.fetcher.calls, 1)

    def test_no_check_while_working(self):
        svc = self.make()
        svc._op = "apply"
        self.clock.now += 10**6
        self.assertFalse(svc.tick())

    def test_log_only_when_the_result_changes(self):
        svc = self.make()
        self.fetcher.error = UpdateError("offline", "no network")
        for _ in range(3):
            self.clock.now += 1800
            svc.tick()
        self.assertEqual(len(self.logs), 1)
        self.fetcher.error = None
        self.clock.now += 1800
        svc.tick()
        self.assertEqual(len(self.logs), 2)
        self.assertNotIn(svc.token, " ".join(self.logs))


class CheckTest(ServiceCase):
    def test_results(self):
        svc = self.checked()
        status = svc.status()
        self.assertEqual(status["check"]["state"], "ok")
        self.assertRegex(status["check"]["at"], ISO)
        self.assertTrue(status["latest"]["newer"] and status["latest"]["installable"])
        self.assertEqual(
            {p["kind"]: p["changed"] for p in status["latest"]["parts"]},
            {"main": True, "audio-g1-g2": False, "audio-g3-g4": True},
        )
        # 失敗しても前の結果を残す
        self.fetcher.error = UpdateError("offline", "x")
        self.clock.now += 100
        self.checked(svc)
        status = svc.status()
        self.assertEqual(status["check"]["state"], "offline")
        self.assertEqual(status["latest"]["version"], "2.2.0")
        # 版の情報が無い（404）のは成功。latest は null
        self.fetcher.error = None
        self.fetcher.release = None
        self.clock.now += 100
        self.checked(svc)
        status = svc.status()
        self.assertEqual((status["check"]["state"], status["check"]["error"]), ("ok", None))
        self.assertIsNone(status["latest"])

    def test_bad_manifest_is_an_error(self):
        self.fetcher.release = mock.Mock(manifest_bytes=b'{"schema": 1}')
        status = self.checked().status()
        self.assertEqual((status["check"]["state"], status["check"]["error"]["code"]), ("error", "bad-manifest"))

    def test_unexpected_exception_is_internal(self):
        self.fetcher.error = RuntimeError("boom")
        self.assertEqual(self.checked().status()["check"]["error"]["code"], "internal")

    def test_manual_check_is_deduplicated(self):
        svc = self.checked()
        svc.request_check()
        svc.join(10)
        self.assertEqual(self.fetcher.calls, 1)  # 10 秒以内
        self.clock.now += 11
        self.checked(svc)
        self.assertEqual(self.fetcher.calls, 2)

    def test_checking_state_is_visible_and_not_repeated(self):
        svc = self.make()
        release, blocker = threading.Event(), threading.Event()
        original = self.fetcher.fetch_manifest

        def slow():
            release.set()
            blocker.wait(10)
            return original()

        self.fetcher.fetch_manifest = slow
        svc.request_check()
        self.assertTrue(release.wait(10))
        self.assertEqual(svc.status()["check"]["state"], "checking")
        svc.request_check()  # 確認中は新しくしない
        blocker.set()
        svc.join(10)
        self.assertEqual(svc.status()["check"]["state"], "ok")

    def test_newer_flags_after_the_update_is_installed(self):
        self.checked()
        install_app(self.data, self.new)  # 別の経路で 2.2.0 になった
        again = self.make().status()
        self.assertEqual(again["current"]["version"], "2.2.0")
        self.assertFalse(again["latest"]["newer"])
        self.assertFalse(again["latest"]["installable"])


class ApplyTest(ServiceCase):
    def test_rejections(self):
        svc = self.make()
        for version, code in (("2.2.0", "not-newer"),):  # まだ確認していない
            with self.assertRaises(UpdateError) as caught:
                svc.request_apply(version)
            self.assertEqual(caught.exception.code, code)
        self.checked(svc)
        for version in ("2.1.9", "2.3.0", "2.1.0"):
            with self.assertRaises(UpdateError) as caught:
                svc.request_apply(version)
            self.assertEqual(caught.exception.code, "not-newer", version)

    def test_blocked_by_min_version(self):
        self.fetcher.release = Release("2.2.0", min_version="2.2.0")
        svc = self.checked()
        latest = svc.status()["latest"]
        self.assertEqual((latest["newer"], latest["installable"], latest["blockedReason"]), (True, False, "min-version"))
        with self.assertRaises(UpdateError) as caught:
            svc.request_apply("2.2.0")
        self.assertEqual(caught.exception.code, "blocked")

    def test_busy_while_working(self):
        svc = self.checked()
        started, go = threading.Event(), threading.Event()

        def hook(part, downloads, cancel):
            started.set()
            go.wait(10)

        self.fetcher.hook = hook
        with mock.patch.object(install, "run_self_test"):
            svc.request_apply("2.2.0")
            self.assertTrue(started.wait(10))
            status = svc.status()
            self.assertEqual((status["update"]["phase"], status["update"]["targetVersion"]), ("downloading", "2.2.0"))
            for call in (lambda: svc.request_apply("2.2.0"), svc.request_check):
                with self.assertRaises(UpdateError) as caught:
                    call()
                self.assertEqual(caught.exception.code, "busy")
            go.set()
            svc.join(30)

    def test_success_installs_and_asks_for_a_restart(self):
        svc = self.checked()
        seen = []
        self.fetcher.hook = lambda part, downloads, cancel: seen.append(svc.status()["update"])
        status = self.apply(svc)
        self.assertEqual(status["update"]["phase"], "restarting")
        self.assertTrue(svc.restart_event.is_set())
        svc.shutdown_callback.assert_called_once_with()
        self.assertEqual(self.fetcher.downloaded, ["main", "audio-g3-g4"])  # 変わらない音声は取得しない
        self.assertEqual(seen[0]["phase"], "downloading")
        self.assertEqual(seen[0]["progress"]["partCount"], 2)
        self.assertEqual(seen[0]["progress"]["part"], "main")
        with open(os.path.join(self.app, "dist", "index.html"), "rb") as f:
            self.assertIn(b"2.2.0", f.read())
        with open(os.path.join(self.base, "app.prev", "dist", "index.html"), "rb") as f:
            self.assertIn(b"2.1.0", f.read())
        self.assertFalse(os.path.exists(self.layout().app_next))
        self.assertTrue(
            os.path.samefile(
                os.path.join(self.app, "dist", "audio", "g1-kokugo", "q1.mp3"),
                os.path.join(self.base, "app.prev", "dist", "audio", "g1-kokugo", "q1.mp3"),
            )
        )
        saved = self.state_file()
        self.assertEqual((saved["phase"], saved["targetVersion"], saved["fromVersion"]), ("restarting", "2.2.0", "2.1.0"))
        # 新しい serve.py の起動: done になり、控えと取得した zip を消す
        fresh = self.make()
        fresh.wait_background(10)
        done = fresh.status()
        self.assertEqual(done["update"]["phase"], "done")
        self.assertEqual(done["current"]["version"], "2.2.0")
        self.assertEqual(done["lastApplied"]["version"], "2.2.0")
        self.assertEqual(done["lastApplied"]["from"], "2.1.0")
        self.assertRegex(done["lastApplied"]["at"], ISO)
        self.assertFalse(os.path.exists(self.layout().app_prev))
        self.assertEqual(tree(self.layout().downloads), set())

    def test_real_self_test_runs_the_new_serve_py(self):
        svc = self.checked()
        status = self.apply(svc, self_test=False)
        self.assertEqual(status["update"]["phase"], "restarting", status["update"])

    def test_version_changed(self):
        svc = self.checked()
        self.fetcher.release = Release("2.3.0")
        status = self.apply(svc)
        self.assertEqual(status["update"]["phase"], "failed")
        self.assertEqual(status["update"]["error"]["code"], "version-changed")
        self.assertEqual(status["latest"]["version"], "2.3.0")
        self.assertEqual(self.fetcher.downloaded, [])
        self.assertFalse(svc.restart_event.is_set())

    def patched(self, target, **kwargs):
        patcher = mock.patch.object(install, target, **kwargs)
        patcher.start()
        self.addCleanup(patcher.stop)

    def assert_failed(self, code, svc):
        """失敗して今の版のまま。次の操作は受け付ける"""
        status = self.apply(svc, self_test=False)
        self.assertEqual(status["update"]["phase"], "failed", status["update"])
        self.assertEqual(status["update"]["error"]["code"], code)
        self.assertRegex(status["update"]["finishedAt"], ISO)
        self.assertFalse(svc.restart_event.is_set())
        self.assertFalse(os.path.exists(self.layout().app_next))
        self.assertFalse(os.path.exists(self.layout().app_prev))
        with open(os.path.join(self.app, "dist", "index.html"), "rb") as f:
            self.assertIn(b"2.1.0", f.read())
        self.assertEqual(self.state_file()["phase"], "failed")
        self.assertFalse(svc.is_busy())
        return status

    def test_unsafe_zip_installs_nothing(self):
        from helpers import zip_bytes

        svc = self.checked()
        self.new.zips[self.new.part("main").name] = zip_bytes([("manabi-no-niwa/../evil.txt", b"x")])
        self.assert_failed("unsafe-zip", svc)
        self.assertFalse(os.path.exists(os.path.join(self.base, "evil.txt")))

    def test_disk_full_before_download(self):
        svc = self.checked()
        self.patched("free_bytes", return_value=1000)
        status = self.assert_failed("disk-full", svc)
        self.assertGreater(status["update"]["error"]["needBytes"], 256 * 1024 * 1024)
        self.assertEqual(self.fetcher.downloaded, [])

    def test_disk_full_before_extracting(self):
        svc = self.checked()
        self.patched("free_bytes", side_effect=[10**12, 5, 5, 5])
        status = self.assert_failed("disk-full", svc)
        self.assertGreater(status["update"]["error"]["needBytes"], 256 * 1024 * 1024)
        self.assertEqual(self.fetcher.downloaded, ["main", "audio-g3-g4"])

    def test_download_failure(self):
        svc = self.checked()
        self.fetcher.hook = mock.Mock(side_effect=UpdateError("sha256-mismatch", "x"))
        self.assert_failed("sha256-mismatch", svc)

    def test_self_test_failure_keeps_the_verified_zips(self):
        svc = self.checked()
        self.patched("run_self_test", side_effect=UpdateError("self-test", "x"))
        self.assert_failed("self-test", svc)
        names = {self.new.part("main").name, self.new.part("audio-g3-g4").name}
        self.assertEqual(set(os.listdir(self.layout().downloads)), names)

    def test_switch_failure(self):
        svc = self.checked()
        self.patched("run_self_test")
        self.patched("swap_in", side_effect=UpdateError("switch-failed", "x"))
        self.assert_failed("switch-failed", svc)

    def test_unexpected_exception_is_internal(self):
        svc = self.checked()
        self.patched("run_self_test", side_effect=RuntimeError("boom"))
        status = self.assert_failed("internal", svc)
        self.assertIn("RuntimeError", status["update"]["error"]["detail"])

    @unittest.skipIf(os.name == "nt", "鍵（flock）は Linux だけ")
    def test_another_updater_holding_the_lock_makes_it_busy(self):
        import fcntl

        svc = self.checked()
        os.makedirs(self.layout().update_dir, exist_ok=True)
        fd = os.open(self.layout().lock_file, os.O_RDWR | os.O_CREAT)
        self.addCleanup(os.close, fd)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        status = self.apply(svc)
        self.assertEqual((status["update"]["phase"], status["update"]["error"]["code"]), ("failed", "busy"))
        self.assertEqual(self.fetcher.downloaded, [])

    def test_status_is_a_copy(self):
        svc = self.checked()
        status = svc.status()
        status["latest"]["notes"].append("x")
        status["latest"]["parts"][0]["bytes"] = -1
        status["check"]["state"] = "never"
        fresh = svc.status()
        self.assertEqual(len(fresh["latest"]["notes"]), 1)
        self.assertGreater(fresh["latest"]["parts"][0]["bytes"], 0)
        self.assertEqual(fresh["check"]["state"], "ok")

    def test_cancel(self):
        svc = self.checked()
        started = threading.Event()

        def hook(part, downloads, cancel):
            with open(os.path.join(downloads, part.name + ".part"), "wb") as f:
                f.write(b"partial")
            started.set()
            if cancel.wait(10):
                raise Cancelled()

        self.fetcher.hook = hook
        with self.assertRaises(UpdateError) as caught:
            svc.request_cancel()
        self.assertEqual(caught.exception.code, "not-cancellable")
        with mock.patch.object(install, "run_self_test"):
            svc.request_apply("2.2.0")
            self.assertTrue(started.wait(10))
            svc.request_cancel()
            svc.join(30)
        status = svc.status()
        self.assertEqual(status["update"]["phase"], "cancelled")
        self.assertIsNone(status["update"]["error"])
        self.assertTrue(os.path.exists(os.path.join(self.layout().downloads, self.new.part("main").name + ".part")))
        self.assertFalse(os.path.exists(self.layout().app_next))
        self.assertFalse(svc.is_busy())
        self.fetcher.hook = None
        self.assertEqual(self.apply(svc)["update"]["phase"], "restarting")  # もう一度押せる

    def test_cannot_cancel_from_testing_on(self):
        svc = self.make()
        svc._op = "apply"
        for phase in ("testing", "switching", "restarting", "idle", "done", "failed", "cancelled"):
            svc._update["phase"] = phase
            with self.assertRaises(UpdateError) as caught:
                svc.request_cancel()
            self.assertEqual(caught.exception.code, "not-cancellable", phase)
        for phase in ("downloading", "extracting"):
            svc._update["phase"] = phase
            svc.request_cancel()


class StartupCleanupTest(ServiceCase):
    def prepare(self, phase, installed="2.1.0", target="2.2.0", **extra):
        common.remove_tree(self.base)
        install_app(self.data, self.new if installed == "2.2.0" else self.old)
        layout = self.layout()
        for path in (layout.app_next, layout.app_prev):
            os.makedirs(path)
            with open(os.path.join(path, "x"), "w") as f:
                f.write("x")
        os.makedirs(layout.downloads)
        for name in ("a.zip", "b.zip.part"):
            with open(os.path.join(layout.downloads, name), "w") as f:
                f.write("x")
        state = {"schema": 1, "phase": phase, "targetVersion": target, "fromVersion": "2.1.0", "startedAt": "2026-11-20T00:00:00Z", "finishedAt": None, "error": None, "resumeCount": 0, "lastApplied": None, "check": {"state": "never", "at": None, "error": None}, "latest": None}
        state.update(extra)
        common.write_json_atomic(layout.state_file, state)
        svc = self.make()
        svc.wait_background(10)
        return svc, layout

    def test_restarting(self):
        svc, layout = self.prepare("restarting", installed="2.2.0")
        status = svc.status()
        self.assertEqual(status["update"]["phase"], "done")
        self.assertEqual(status["lastApplied"]["version"], "2.2.0")
        self.assertEqual(status["lastApplied"]["from"], "2.1.0")
        self.assertFalse(os.path.exists(layout.app_prev) or os.path.exists(layout.app_next))
        self.assertEqual(os.listdir(layout.downloads), [])
        svc, layout = self.prepare("restarting", installed="2.1.0")
        status = svc.status()
        self.assertEqual((status["update"]["phase"], status["update"]["error"]["code"]), ("failed", "switch-failed"))
        self.assertIsNone(status["lastApplied"])

    def test_switching(self):
        svc, layout = self.prepare("switching", installed="2.2.0")
        self.assertEqual(svc.status()["update"]["phase"], "done")
        self.assertFalse(os.path.exists(layout.app_prev))
        svc, layout = self.prepare("switching", installed="2.1.0")
        status = svc.status()
        self.assertEqual((status["update"]["phase"], status["update"]["error"]["code"]), ("failed", "interrupted"))
        self.assertFalse(os.path.exists(layout.app_prev) or os.path.exists(layout.app_next))

    def test_stopped_while_working(self):
        for phase in ("downloading", "extracting", "testing"):
            with self.subTest(phase):
                svc, layout = self.prepare(phase)
                status = svc.status()
                self.assertEqual((status["update"]["phase"], status["update"]["error"]["code"]), ("failed", "interrupted"))
                self.assertFalse(os.path.exists(layout.app_next))
                self.assertEqual(sorted(os.listdir(layout.downloads)), ["a.zip", "b.zip.part"])  # 続きから使える

    def test_other_phases_stay_and_leftovers_go(self):
        for phase in ("idle", "done", "failed", "cancelled"):
            with self.subTest(phase):
                svc, layout = self.prepare(phase)
                self.assertEqual(svc.status()["update"]["phase"], phase)
                self.assertFalse(os.path.exists(layout.app_prev) or os.path.exists(layout.app_next))

    def test_unreadable_state_is_idle(self):
        common.remove_tree(self.base)
        install_app(self.data, self.old)
        os.makedirs(self.layout().update_dir)
        for text in ("{broken", "[]", '{"schema": 2, "phase": "downloading"}', '{"schema": 1, "phase": "nope"}'):
            with open(self.layout().state_file, "w") as f:
                f.write(text)
            self.assertEqual(self.make().status()["update"]["phase"], "idle", text)


class ResumeTest(StartupCleanupTest):
    def interrupted(self, count=0, installed_target="2.2.0"):
        latest = self.checked().status()["latest"]
        latest = dict(latest, minVersion="2.1.0")
        svc, layout = self.prepare("downloading", target=installed_target, resumeCount=count, latest=latest)
        return svc

    def first_check(self, svc):
        self.clock.now += 15
        self.assertTrue(svc.tick())
        svc.join(60)

    def test_resumes_after_the_first_successful_check(self):
        with mock.patch.object(install, "run_self_test"):
            svc = self.interrupted()
            self.assertEqual(svc.status()["update"]["phase"], "failed")
            self.first_check(svc)
            self.assertEqual(svc.status()["update"]["phase"], "restarting")
            self.assertEqual(self.state_file()["resumeCount"], 1)

    def test_does_not_resume_after_three_times(self):
        svc = self.interrupted(count=3)
        self.first_check(svc)
        self.assertEqual(svc.status()["update"]["phase"], "failed")
        self.assertEqual(self.fetcher.downloaded, [])

    def test_does_not_resume_for_another_version_or_when_auto_check_is_off(self):
        self.fetcher.release = Release("2.3.0")
        svc = self.interrupted(installed_target="2.2.0")
        self.first_check(svc)
        self.assertEqual(self.fetcher.downloaded, [])
        self.fetcher.release = self.new
        svc = self.interrupted()
        svc.set_autocheck(False)
        svc._resume_target = None  # 次の起動で自動の確認がオフなら、続きから始めない
        svc.request_check()
        svc.join(10)
        self.assertEqual(svc.status()["update"]["phase"], "failed")


if __name__ == "__main__":
    unittest.main()
