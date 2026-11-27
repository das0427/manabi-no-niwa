# -*- coding: utf-8 -*-
"""状態・設定・予定・起動時の片付け・apply の受け付けと各段・中止（設計 5.2・5.3・5.5・5.11・5.12 節）"""
import errno
import json
import os
import threading
import unittest
from unittest import mock

from helpers import ISO, FakeGitHub, Release, ServiceCase, install_app, tree
from mnwupdate import common, fetch, install, service
from mnwupdate.common import Cancelled, UpdateError

class StatusAndSettingsTest(ServiceCase):
    def test_status_has_every_field(self):
        status = self.make().status()
        json.dumps(status)
        self.assertEqual(
            set(status),
            {"schema", "supported", "reason", "token", "server", "testOrigin", "current", "settings", "disk", "check", "latest", "update", "lastApplied"},
        )
        self.assertIs(status["testOrigin"], False)
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

    def test_disk_full_while_downloading_gives_the_space_back(self):
        # 取得の途中で空きが尽きたら、この更新の取得物（確かめ済みの zip も、途中の .part も）を捨てて空きを返す（fetch-2）
        svc = self.checked()

        def hook(part, folder, cancel):
            if part.kind == "audio-g3-g4":  # 1 つめは取得し終え、2 つめの途中で空きが尽きた
                for suffix in (".part", ".part.json"):
                    with open(os.path.join(folder, part.name + suffix), "wb") as f:
                        f.write(b"x" * 100)
                raise UpdateError("disk-full", "write .part: ENOSPC", need_bytes=1)

        self.fetcher.hook = hook
        status = self.assert_failed("disk-full", svc)
        self.assertGreater(status["update"]["error"]["needBytes"], 256 * 1024 * 1024)
        self.assertEqual(self.fetcher.downloaded, ["main", "audio-g3-g4"])
        self.assertEqual(os.listdir(self.layout().downloads), [])

    def test_disk_full_while_assembling_gives_the_space_back_too(self):
        # 組み立ての途中の満杯にも効く: 取得した zip を残さず、app.next も消す
        svc = self.checked()
        self.patched("assemble", side_effect=OSError(errno.ENOSPC, "No space left on device"))
        self.assert_failed("disk-full", svc)
        self.assertEqual(self.fetcher.downloaded, ["main", "audio-g3-g4"])
        self.assertEqual(os.listdir(self.layout().downloads), [])

    def test_need_bytes_after_giving_the_space_back_counts_the_discarded_zips(self):
        # 満杯で捨てた zip（取り終えた main）は、次に押したときは取り直す。needBytes は、捨てる前の見積もり
        # （確かめ済みの zip を 0 と数える）ではなく、捨てたあとの見積もり（全部を取り直す）にする。
        # そうしないと、保護者画面の「あと約 N GB 必要です」が、捨てた zip の大きさの分だけ少なく出る
        svc = self.checked()
        self.patched("check_link_support", return_value=True)
        full = svc.status()["latest"]["needBytes"]  # 確認のときの全体の見積もり（取得する部品を全部数える）

        def hook(part, folder, cancel):
            if part.kind == "audio-g3-g4":  # main は取得し終え、2 つめの途中で空きが尽きた
                raise UpdateError("disk-full", "write .part: ENOSPC", need_bytes=1)

        self.fetcher.hook = hook
        status = self.assert_failed("disk-full", svc)
        self.assertEqual(os.listdir(self.layout().downloads), [])
        need = status["update"]["error"]["needBytes"]
        self.assertEqual(need, full)
        self.assertGreater(self.new.part("main").bytes, 0)  # 捨てる前の見積もりは、これだけ少ない

    def test_need_bytes_when_full_before_extracting_counts_the_zips_to_fetch_again(self):
        # 取り終えたあと・組み立ての前に満杯と分かったときも同じ: 取得した zip を捨てるので、全部を取り直す見積もり
        svc = self.checked()
        self.patched("check_link_support", return_value=True)
        full = svc.status()["latest"]["needBytes"]
        self.patched("free_bytes", side_effect=[10**12, 5, 5, 5])
        status = self.assert_failed("disk-full", svc)
        self.assertEqual(self.fetcher.downloaded, ["main", "audio-g3-g4"])
        self.assertEqual(os.listdir(self.layout().downloads), [])
        self.assertEqual(status["update"]["error"]["needBytes"], full)

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


class DiskFullWithRealFetcherTest(ServiceCase):
    """本物の取得役と偽の GitHub で、書き込みが ENOSPC になったあとに .part が残らない（fetch-2）"""

    def test_nothing_is_left_after_the_disk_fills_up(self):
        from test_fetch import _FullDisk

        fake = FakeGitHub()
        self.addCleanup(fake.stop)
        fake.set_release(self.new)
        self.fetcher = fetch.Fetcher(fetch.Endpoint(fake.origin, True))
        svc = self.checked()
        self.assertEqual(svc.status()["check"]["state"], "ok")
        real_open = open

        def fake_open(path, mode="r", *args, **kwargs):
            f = real_open(path, mode, *args, **kwargs)
            return _FullDisk(f, 200) if str(path).endswith(".part") and "b" in mode else f

        with mock.patch("builtins.open", fake_open):
            status = self.apply(svc)
        self.assertEqual((status["update"]["phase"], status["update"]["error"]["code"]), ("failed", "disk-full"))
        self.assertGreater(status["update"]["error"]["needBytes"], 0)
        self.assertEqual(os.listdir(self.layout().downloads), [])
        self.assertFalse(os.path.exists(self.layout().app_next))
        # 次の確認でも、起動し直しでも、何も戻ってこない
        svc._last_check_end = None
        svc.request_check()
        svc.join(10)
        self.assertEqual(os.listdir(self.layout().downloads), [])
        self.make()
        self.assertEqual(os.listdir(self.layout().downloads), [])


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

    def test_stopped_before_recording_the_switch_but_already_switched_is_done(self):
        # 入れ替えは済んでいるのに、段の記録（switching・restarting）を書けなかった
        for phase in ("downloading", "extracting", "testing"):
            with self.subTest(phase):
                svc, layout = self.prepare(phase, installed="2.2.0")
                status = svc.status()
                self.assertEqual(status["update"]["phase"], "done")
                self.assertEqual(status["lastApplied"]["version"], "2.2.0")

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
        deep = '{"schema": 1, "x": ' + "[" * 30000 + "]" * 30000 + "}"  # RecursionError になる深い入れ子（fetch-3）
        for text in ("{broken", "[]", '{"schema": 2, "phase": "downloading"}', '{"schema": 1, "phase": "nope"}', deep):
            with open(self.layout().state_file, "w") as f:
                f.write(text)
            self.assertEqual(self.make().status()["update"]["phase"], "idle", text[:40])


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


class FakeFcntl:
    """鍵のファイル 1 つだけの flock の代わり（Windows でも鍵の動きを試すため）"""

    LOCK_EX, LOCK_NB, LOCK_UN = 2, 4, 8

    def __init__(self):
        self.holder = None
        self.calls = 0

    def flock(self, fd, operation):
        self.calls += 1
        if operation & self.LOCK_UN:
            if self.holder == fd:
                self.holder = None
            return
        if self.holder not in (None, fd):
            raise BlockingIOError(errno.EAGAIN, "locked")
        self.holder = fd


class HardeningTest(ServiceCase):
    """点検（攻撃の目）で見つかったことの直し"""

    def test_status_says_whether_the_test_origin_is_used(self):
        svc = self.make()
        self.assertIs(svc.status()["testOrigin"], False)
        svc.fetcher = fetch.Fetcher(fetch.Endpoint("http://127.0.0.1:4801", True))
        self.assertIs(svc.status()["testOrigin"], True)
        svc.fetcher = fetch.Fetcher(fetch.Endpoint(fetch.GITHUB_ORIGIN))
        self.assertIs(svc.status()["testOrigin"], False)

    def test_process_lock_keeps_a_second_server_out(self):
        fake = FakeFcntl()
        with mock.patch.object(service, "fcntl", fake):
            first, second = self.make(), self.make()
            self.assertTrue(first.acquire_process_lock())
            self.addCleanup(os.close, first._process_lock_fd)
            self.assertFalse(second.acquire_process_lock())
            self.assertIsNone(second._process_lock_fd)
            calls = fake.calls
            self.assertIsNone(first._take_lock())  # 持っている鍵で足りる（同じプロセスで二重に取らない）
            self.assertEqual(fake.calls, calls)
            self.checked(first)
            status = self.apply(first)
            self.assertEqual(status["update"]["phase"], "restarting", status["update"])

    def test_cancel_accepted_at_the_end_of_extracting_installs_nothing(self):
        svc = self.checked()
        real = install.assemble

        def assemble_then_cancel(*args, **kwargs):
            real(*args, **kwargs)
            svc.request_cancel()  # 段が extracting のうちに受け付けられる

        with mock.patch.object(install, "assemble", assemble_then_cancel):
            with mock.patch.object(install, "run_self_test") as self_test:
                svc.request_apply("2.2.0")
                svc.join(60)
        self.assertEqual(svc.status()["update"]["phase"], "cancelled")
        self_test.assert_not_called()
        self.assertFalse(svc.restart_event.is_set())
        self.assertFalse(os.path.exists(self.layout().app_next))
        with open(os.path.join(self.app, "dist", "index.html"), "rb") as f:
            self.assertIn(b"2.1.0", f.read())

    def test_switching_that_cannot_be_recorded_does_not_switch(self):
        svc = self.checked()
        real = common.write_json_atomic

        def full_at_switching(path, value, fsync=False):
            if isinstance(value, dict) and value.get("phase") == "switching":
                raise OSError(errno.ENOSPC, "No space left on device", path)
            return real(path, value, fsync=fsync)

        with mock.patch.object(service, "write_json_atomic", full_at_switching):
            with mock.patch.object(install, "swap_in") as swap:
                status = self.apply(svc)
        swap.assert_not_called()
        self.assertEqual((status["update"]["phase"], status["update"]["error"]["code"]), ("failed", "disk-full"))
        self.assertNotIn(self.tmp, status["update"]["error"]["detail"])
        self.assertFalse(os.path.exists(self.layout().app_next))
        self.assertEqual(self.state_file()["phase"], "failed")

    def test_disk_full_while_downloading_reports_the_whole_need(self):
        svc = self.checked()
        self.fetcher.hook = mock.Mock(side_effect=UpdateError("disk-full", "write .part: ENOSPC", need_bytes=1))
        status = self.apply(svc)
        error = status["update"]["error"]
        self.assertEqual(error["code"], "disk-full")
        self.assertGreater(error["needBytes"], 256 * 1024 * 1024)  # 取得の残り＋展開＋予備

    def test_errors_do_not_show_paths(self):
        secret = os.path.join(self.tmp, "someone-secret", "updater.json")
        with mock.patch.object(service, "save_autocheck", side_effect=OSError(errno.EACCES, "Permission denied", secret)):
            with self.assertRaises(UpdateError) as caught:
                self.make().set_autocheck(False)
        self.assertEqual(caught.exception.detail, "cannot write settings: EACCES: Permission denied")
        error = service.UpdateService._to_error(FileExistsError(errno.EEXIST, "File exists", secret))
        self.assertEqual((error.code, error.detail), ("internal", "EEXIST: File exists"))
        error = service.UpdateService._to_error(OSError(errno.ENOSPC, "No space left on device", secret))
        self.assertEqual(error.code, "disk-full")
        self.assertNotIn("secret", error.detail)
        if hasattr(errno, "EDQUOT"):
            self.assertEqual(service.UpdateService._to_error(OSError(errno.EDQUOT, "Disk quota exceeded")).code, "disk-full")

    def test_check_removes_downloads_of_other_versions(self):
        downloads = self.layout().downloads
        os.makedirs(downloads)
        keep = self.new.part("main").name
        names = ["manabi-no-niwa-2.1.5.zip", "manabi-no-niwa-2.1.5.zip.part", "manabi-no-niwa-2.1.5.zip.part.json", keep + ".part", keep + ".part.json"]
        for name in names:
            with open(os.path.join(downloads, name), "wb") as f:
                f.write(b"x")
        self.checked()
        self.assertEqual(sorted(os.listdir(downloads)), sorted([keep + ".part", keep + ".part.json"]))
        # 確認が失敗したときは消さない
        with open(os.path.join(downloads, "manabi-no-niwa-2.1.5.zip"), "wb") as f:
            f.write(b"x")
        self.fetcher.error = UpdateError("offline", "x")
        self.clock.now += 100
        self.checked()
        self.assertIn("manabi-no-niwa-2.1.5.zip", os.listdir(downloads))

    def test_self_test_gets_the_restart_arguments(self):
        svc = self.checked()
        svc.restart_args = ["--port", "4801"]
        with mock.patch.object(install, "run_self_test") as self_test:
            svc.request_apply("2.2.0")
            svc.join(60)
        self_test.assert_called_once_with(self.layout().app_next, ["--port", "4801"])

    def test_switch_that_cannot_be_rolled_back_keeps_both_versions_and_retry_recovers(self):
        # 名前の変更 2 回の入れ替え（renameat2 が使えないファイルシステム）で、2 つ目も元に戻すのも失敗した
        svc = self.checked()
        lay = self.layout()
        real = install._rename_retry

        def flaky(src, dst):
            if dst == lay.app and src in (lay.app_next, lay.app_prev):
                raise PermissionError(errno.EACCES, "Permission denied", src)
            return real(src, dst)

        no_exchange = mock.patch.object(install, "_renameat2_exchange", side_effect=OSError(errno.EINVAL, "Invalid argument"))
        with no_exchange, mock.patch.object(install, "_rename_retry", flaky):
            status = self.apply(svc)
        self.assertEqual((status["update"]["phase"], status["update"]["error"]["code"]), ("failed", "switch-broken"))
        self.assertNotIn(self.tmp, status["update"]["error"]["detail"])
        self.assertFalse(os.path.exists(lay.app))
        with open(os.path.join(lay.app_prev, "dist", "index.html"), "rb") as f:
            self.assertIn(b"2.1.0", f.read())  # 前の版は消さない
        with open(os.path.join(lay.app_next, "dist", "index.html"), "rb") as f:
            self.assertIn(b"2.2.0", f.read())  # 新しい版も消さない
        self.assertFalse(svc.restart_event.is_set())
        # 「もう一度ためす」: まず前の版を app に戻し、それから普通に入れる
        status = self.apply(svc)
        self.assertEqual(status["update"]["phase"], "restarting", status["update"])
        with open(os.path.join(lay.app, "dist", "index.html"), "rb") as f:
            self.assertIn(b"2.2.0", f.read())
        with open(os.path.join(lay.app_prev, "dist", "index.html"), "rb") as f:
            self.assertIn(b"2.1.0", f.read())
        self.assertEqual(self.fetcher.downloaded.count("audio-g1-g2"), 0)  # 戻した版から写せた

    def test_missing_app_that_cannot_be_recovered_touches_nothing(self):
        svc = self.checked()
        lay = self.layout()
        os.rename(lay.app, lay.app_prev)
        with mock.patch.object(install, "_rename_retry", side_effect=PermissionError(errno.EACCES, "Permission denied")):
            status = self.apply(svc)
        self.assertEqual((status["update"]["phase"], status["update"]["error"]["code"]), ("failed", "switch-broken"))
        self.assertTrue(os.path.isdir(lay.app_prev))
        self.assertEqual(self.fetcher.downloaded, [])


if __name__ == "__main__":
    unittest.main()
