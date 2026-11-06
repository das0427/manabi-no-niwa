# -*- coding: utf-8 -*-
"""状態・設定・自動の確認の予定・更新の作業（別スレッド）・再起動の合図（設計 5.2・5.5・5.10〜5.12 節）"""
from __future__ import annotations

import copy
import errno
import os
import secrets
import threading
import time
import zipfile

from . import fetch as fetch_mod
from . import install
from .common import (
    PHASES,
    SCHEMA,
    Cancelled,
    UpdateError,
    compare_versions,
    iso_utc,
    load_autocheck,
    load_state,
    log,
    read_main_version,
    remove_tree,
    save_autocheck,
    write_json_atomic,
)
from .manifest import (
    estimate_need,
    load_installed_marks,
    parse_manifest,
    plan_parts,
    summarize_latest,
)

try:
    import fcntl
except ImportError:  # Windows では鍵を取らない
    fcntl = None

FIRST_CHECK_DELAY = 15
RECHECK_AFTER_OK = 12 * 3600
RECHECK_AFTER_FAIL = 30 * 60
RECHECK_AFTER_ENABLE = 5
MANUAL_COOLDOWN = 10
MAX_RESUME = 3
ACTIVE_PHASES = PHASES[1:6]


def _idle_update():
    return {
        "phase": "idle",
        "targetVersion": None,
        "progress": None,
        "error": None,
        "startedAt": None,
        "finishedAt": None,
    }


class UpdateService:
    def __init__(self, layout, fetcher, clock=time.monotonic):
        self.layout = layout
        self.fetcher = fetcher
        self._clock = clock
        self._lock = threading.RLock()
        self.token = secrets.token_hex(16)
        self.started_at = iso_utc()
        self.restart_event = threading.Event()
        self.shutdown_callback = None
        self._cancel = threading.Event()
        self._stop = threading.Event()
        self.current_version = read_main_version(layout.app)
        self.auto_check = True
        self._check = {"state": "never", "at": None, "error": None}
        self._latest = None
        self._update = _idle_update()
        self._from = None
        self._resume_count = 0
        self._last_applied = None
        self._op = None  # None か 'check' か 'apply'
        self._next_check = None
        self._last_check_end = None
        self._resume_target = None
        self._log_key = None
        self._background = []
        self._worker = None
        self._checker = None

    # ---- 起動・停止 --------------------------------------------------------

    def start(self):
        self.startup()
        thread = threading.Thread(target=self._loop, name="mnw-update-schedule", daemon=True)
        thread.start()

    def stop(self):
        self._stop.set()

    def _loop(self):
        while not self._stop.wait(1.0):
            try:
                self.tick()
            except Exception as e:  # noqa: BLE001
                log("予定の処理で例外: %s" % type(e).__name__)

    def startup(self):
        """設定と state.json を読み、前回の止まり方に応じて片付ける（設計 5.11 節）"""
        self.auto_check = load_autocheck(self.layout.config_file)
        state = load_state(self.layout.state_file)
        self._check = state["check"]
        self._latest = state["latest"]
        self._refresh_latest()
        self._last_applied = state["lastApplied"]
        self._resume_count = state["resumeCount"]
        self._from = state["fromVersion"]
        target = state["targetVersion"]
        update = _idle_update()
        for key in ("phase", "targetVersion", "error", "startedAt", "finishedAt"):
            update[key] = state[key]
        self._update = update
        self._startup_cleanup(update["phase"], target)
        if self.auto_check:
            self._next_check = self._clock() + FIRST_CHECK_DELAY
        self._save_state()

    def _startup_cleanup(self, phase, target):
        lay = self.layout
        if phase in ("restarting", "switching"):
            if target and self.current_version == target:
                self._finish_done(target)
            elif phase == "restarting":
                self._mark_failed(
                    UpdateError("switch-failed", "running %s, expected %s" % (self.current_version, target))
                )
                self._purge([lay.app_next])
            else:
                self._mark_failed(UpdateError("interrupted", "stopped while switching"))
                self._purge([lay.app_next, lay.app_prev])
        elif phase in ("downloading", "extracting", "testing"):
            self._mark_failed(UpdateError("interrupted", "stopped while %s" % phase))
            self._purge([lay.app_next])
            if self.auto_check and target and self._resume_count < MAX_RESUME:
                self._resume_target = target
        else:
            self._purge([lay.app_next, lay.app_prev])

    def _finish_done(self, target):
        with self._lock:
            now = iso_utc()
            self._update.update(phase="done", progress=None, error=None, finishedAt=now)
            self._last_applied = {"version": target, "from": self._from or "", "at": now}
            self._resume_count = 0
        self._purge([self.layout.app_next, self.layout.app_prev], clear_downloads=True)
        log("版 %s に更新しました" % target)

    def _mark_failed(self, error):
        with self._lock:
            self._update.update(
                phase="failed", progress=None, error=error.to_dict(), finishedAt=iso_utc()
            )
        log("更新できませんでした: %s %s" % (error.code, error.detail))

    def _purge(self, paths, clear_downloads=False):
        """重い削除は別スレッド"""

        def work():
            for path in paths:
                remove_tree(path)
            if clear_downloads:
                try:
                    names = os.listdir(self.layout.downloads)
                except OSError:
                    names = []
                for name in names:
                    remove_tree(os.path.join(self.layout.downloads, name))

        thread = threading.Thread(target=work, name="mnw-update-purge", daemon=True)
        self._background.append(thread)
        thread.start()

    def wait_background(self, timeout=None):
        for thread in list(self._background):
            thread.join(timeout)

    def join(self, timeout=None):
        """確認・更新の作業のスレッドの終わりを待つ（試験用）"""
        for thread in (self._checker, self._worker):
            if thread is not None:
                thread.join(timeout)

    # ---- 状態 -------------------------------------------------------------

    def _refresh_latest(self):
        latest = self._latest
        if not latest or not self.current_version:
            return
        newer = compare_versions(latest["version"], self.current_version) > 0
        blocked = None
        if newer:
            if latest["blockedReason"] == "schema":
                blocked = "schema"
            elif latest["minVersion"] and compare_versions(self.current_version, latest["minVersion"]) < 0:
                blocked = "min-version"
        latest.update(newer=newer, blockedReason=blocked, installable=newer and blocked is None)

    def status(self):
        with self._lock:
            latest = copy.deepcopy(self._latest)
            if latest:
                del latest["minVersion"]  # 内部の欄（state.json にだけ持つ）
            update = copy.deepcopy(self._update)
            return {
                "schema": SCHEMA,
                "supported": True,
                "reason": None,
                "token": self.token,
                "server": {"pid": os.getpid(), "startedAt": self.started_at},
                "current": {"version": self.current_version},
                "settings": {"autoCheck": self.auto_check},
                "disk": {"freeBytes": install.free_bytes(self.layout.base)},
                "check": dict(self._check),
                "latest": latest,
                "update": update,
                "lastApplied": dict(self._last_applied) if self._last_applied else None,
            }

    def _save_state(self, fsync=False):
        with self._lock:
            u = self._update
            state = {
                "schema": SCHEMA,
                "phase": u["phase"],
                "targetVersion": u["targetVersion"],
                "fromVersion": self._from,
                "startedAt": u["startedAt"],
                "finishedAt": u["finishedAt"],
                "error": u["error"],
                "resumeCount": self._resume_count,
                "lastApplied": self._last_applied,
                "check": self._check,
                "latest": self._latest,
            }
            try:
                write_json_atomic(self.layout.state_file, state, fsync=fsync)
            except OSError as e:
                log("状態を書けませんでした: %s" % e)

    def _set_phase(self, phase, fsync=False):
        with self._lock:
            self._update["phase"] = phase
            self._update["progress"] = None
            self._save_state(fsync)
        log("更新: %s" % phase)

    def _progress(self, done, total, part, index, count):
        with self._lock:
            self._update["progress"] = {
                "doneBytes": int(done),
                "totalBytes": int(total),
                "part": part,
                "partIndex": index,
                "partCount": count,
            }

    def is_busy(self):
        return self._op is not None or self._update["phase"] in ACTIVE_PHASES

    # ---- 設定 -------------------------------------------------------------

    def set_autocheck(self, flag):
        try:
            save_autocheck(self.layout.config_file, flag)
        except OSError as e:
            raise UpdateError("internal", "cannot write settings: %s" % e) from None
        with self._lock:
            changed = flag != self.auto_check
            self.auto_check = flag
            if not flag:
                self._next_check = None
            elif changed or self._next_check is None:
                self._next_check = self._clock() + RECHECK_AFTER_ENABLE

    # ---- 確認 -------------------------------------------------------------

    def tick(self):
        """予定の時刻になっていれば確認する。確認したら True（試験では時計を差し替えて呼ぶ）"""
        with self._lock:
            if (
                self._stop.is_set()
                or not self.auto_check
                or self.is_busy()
                or self._next_check is None
                or self._clock() < self._next_check
            ):
                return False
            self._begin_check()
        self._do_check()
        return True

    def request_check(self):
        """今すぐ確かめる（別スレッド）。確認中か直前なら新しくしない"""
        with self._lock:
            if self.is_busy() and self._op != "check":
                raise UpdateError("busy", "an update is in progress")
            if self._op == "check":
                return
            if self._last_check_end is not None and self._clock() - self._last_check_end < MANUAL_COOLDOWN:
                return
            self._begin_check()
        self._checker = threading.Thread(target=self._do_check, name="mnw-update-check", daemon=True)
        self._checker.start()

    def _begin_check(self):
        self._op = "check"
        self._check = {"state": "checking", "at": self._check["at"], "error": None}

    def _do_check(self):
        latest, error = None, None
        try:
            raw = self.fetcher.fetch_manifest()
            if raw is not None:
                manifest = parse_manifest(raw)
                latest = summarize_latest(
                    manifest, self.current_version, load_installed_marks(self.layout.app)
                )
        except UpdateError as e:
            error = e
        except Exception as e:  # noqa: BLE001
            error = UpdateError("internal", "%s: %s" % (type(e).__name__, e))
        with self._lock:
            if error is None:
                self._check = {"state": "ok", "at": iso_utc(), "error": None}
                self._latest = latest
                delay = RECHECK_AFTER_OK
            else:
                name = "offline" if error.code == "offline" else "error"
                self._check = {"state": name, "at": iso_utc(), "error": error.to_dict()}
                delay = RECHECK_AFTER_FAIL
            self._next_check = self._clock() + delay if self.auto_check else None
            self._last_check_end = self._clock()
            self._op = None
            self._save_state()
        self._log_check(error, latest)
        if error is None:
            self._maybe_resume()

    def _log_check(self, error, latest):
        key = (error.code, error.detail[:40]) if error else ("ok", latest and latest["version"])
        if key == self._log_key:
            return
        self._log_key = key
        if error is not None:
            log("新しい版を確かめられませんでした: %s" % error.code)
        elif latest and latest["newer"]:
            log("新しい版 %s があります" % latest["version"])
        else:
            log("新しい版はありません")

    def _maybe_resume(self):
        """前回、途中で止まった更新を、最初の確認の成功で自動的に続きから始める"""
        target, self._resume_target = self._resume_target, None
        latest = self._latest
        if not target or not latest or latest["version"] != target or not latest["installable"]:
            return
        with self._lock:
            if self._resume_count >= MAX_RESUME or self.is_busy():
                return
            self._resume_count += 1
            count = self._resume_count
            self._start_apply(target)
        log("途中で止まった更新を続きから始めます（%d 回目）" % count)

    # ---- 更新 -------------------------------------------------------------

    def request_apply(self, version):
        """受け付けの確かめだけをして、作業を別スレッドで始める"""
        with self._lock:
            if self.is_busy():
                raise UpdateError("busy", "an update or a check is in progress")
            latest = self._latest
            if not latest or latest["version"] != version:
                raise UpdateError("not-newer", "version is not the latest found")
            if not latest["newer"]:
                raise UpdateError("not-newer", "not newer than %s" % self.current_version)
            if not latest["installable"]:
                raise UpdateError("blocked", latest["blockedReason"] or "blocked")
            self._resume_count = 0
            self._start_apply(version)

    def _start_apply(self, target):
        latest = self._latest
        changed = [p for p in latest["parts"] if p["changed"]]
        self._op = "apply"
        self._cancel.clear()
        self._from = self.current_version
        self._update = {
            "phase": "downloading",
            "targetVersion": target,
            "progress": {
                "doneBytes": 0,
                "totalBytes": sum(p["bytes"] for p in changed),
                "part": changed[0]["kind"] if changed else "",
                "partIndex": 1 if changed else 0,
                "partCount": len(changed),
            },
            "error": None,
            "startedAt": iso_utc(),
            "finishedAt": None,
        }
        self._save_state()
        log("更新を始めます: %s -> %s" % (self._from, target))
        self._worker = threading.Thread(
            target=self._run_apply, args=(target,), name="mnw-update-apply", daemon=True
        )
        self._worker.start()

    def request_cancel(self):
        with self._lock:
            if self._op != "apply" or self._update["phase"] not in ("downloading", "extracting"):
                raise UpdateError("not-cancellable", "phase is %s" % self._update["phase"])
            self._cancel.set()

    def _run_apply(self, target):
        lay = self.layout
        lock_fd = None
        owner = False  # 鍵を取れた（ほかの更新の app.next を消さないため）
        try:
            self.wait_background()
            lock_fd = self._take_lock()
            owner = True
            manifest = self._refetch(target)
            plans = plan_parts(manifest, load_installed_marks(lay.app), app=lay.app)
            fetch = [p for p in plans if p.action == "fetch"]
            install.prune_downloads(lay.downloads, [p.part.name for p in fetch])
            link_ok = install.check_link_support(lay.update_dir)
            install.check_space(
                lay.base,
                estimate_need(plans, link_ok, lambda part: fetch_mod.remaining_bytes(lay.downloads, part)),
            )
            fetch_mod.download_all(
                self.fetcher,
                manifest.tag,
                [p.part for p in fetch],
                lay.downloads,
                self._cancel,
                self._progress,
            )
            install.check_space(lay.base, estimate_need(plans, link_ok, lambda part: 0))
            self._set_phase("extracting")
            install.assemble(lay, plans, fetch, link_ok, self._cancel, self._progress)
            self._set_phase("testing")
            install.verify_tree(lay.app_next, manifest)
            install.run_self_test(lay.app_next)
            self._set_phase("switching", fsync=True)
            install.swap_in(lay)
            self._set_phase("restarting", fsync=True)
            self.restart_event.set()
            callback = self.shutdown_callback
            if callback is not None:
                callback()
        except Cancelled:
            if owner:
                remove_tree(lay.app_next)
            with self._lock:
                self._update.update(phase="cancelled", progress=None, finishedAt=iso_utc())
                self._save_state()
            log("更新を中止しました")
        except BaseException as e:  # noqa: BLE001
            if owner:
                remove_tree(lay.app_next)
            self._mark_failed(self._to_error(e))
            with self._lock:
                self._save_state()
        finally:
            if lock_fd is not None:
                os.close(lock_fd)
            with self._lock:
                self._op = None

    @staticmethod
    def _to_error(exc):
        if isinstance(exc, UpdateError):
            return exc
        if isinstance(exc, OSError) and exc.errno == errno.ENOSPC:
            return UpdateError("disk-full", str(exc))
        if isinstance(exc, zipfile.BadZipFile):
            return UpdateError("unsafe-zip", "not a valid zip: %s" % exc)
        return UpdateError("internal", "%s: %s" % (type(exc).__name__, exc))

    def _take_lock(self):
        if fcntl is None:
            return None
        os.makedirs(self.layout.update_dir, exist_ok=True)
        fd = os.open(self.layout.lock_file, os.O_RDWR | os.O_CREAT, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            os.close(fd)
            raise UpdateError("busy", "another updater holds the lock") from None
        return fd

    def _refetch(self, target):
        """版の情報を取り直す。押したあとに新しい版が出ていたら version-changed"""
        raw = self.fetcher.fetch_manifest()
        if raw is None:
            raise UpdateError("not-found", "update manifest is gone")
        manifest = parse_manifest(raw)
        latest = summarize_latest(
            manifest, self.current_version, load_installed_marks(self.layout.app)
        )
        with self._lock:
            self._latest = latest
            self._check = {"state": "ok", "at": iso_utc(), "error": None}
        if manifest.version != target:
            raise UpdateError("version-changed", "the latest is now %s" % manifest.version)
        if not latest["newer"]:
            raise UpdateError("not-newer", "not newer than %s" % self.current_version)
        if not latest["installable"]:
            raise UpdateError("blocked", latest["blockedReason"] or "blocked")
        return manifest
