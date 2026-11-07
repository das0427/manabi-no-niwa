# -*- coding: utf-8 -*-
"""入れる側: 空き容量・zip の検査と展開・写し・中身の確かめ・自己検査・入れ替え（設計 5.6〜5.9 節）"""
from __future__ import annotations

import contextlib
import ctypes
import errno
import os
import shutil
import stat
import subprocess
import sys
import time
import uuid
import zipfile
import zlib

from .common import Cancelled, UpdateError, os_error_text, read_json_file, remove_tree, strict_loads
from .manifest import is_safe_rel_path, parse_part_mark

PREFIX = "manabi-no-niwa/"
SLACK_BYTES = 64 * 1024
MAX_MARK_BYTES = 1 << 16
SELF_TEST_TIMEOUT = 60
# 版をまたいで変えない約束のパス（.desktop・systemd の単位・install.sh の案内が指す。設計 2 章）も含める
REQUIRED_FILES = (
    "dist/index.html",
    "dist/sw.js",
    "dist/version.json",
    "dist/icons/icon-192.png",
    "deploy/zorin/serve.py",
    "deploy/zorin/manabi.sh",
    "deploy/zorin/uninstall.sh",
    "deploy/zorin/mnwupdate/__init__.py",
    "parts/main.json",
)
_sleep = time.sleep
_O_FLAGS = (
    os.O_WRONLY
    | os.O_CREAT
    | os.O_EXCL
    | getattr(os, "O_NOFOLLOW", 0)
    | getattr(os, "O_BINARY", 0)
    | getattr(os, "O_CLOEXEC", 0)
)


# ---- 空き容量 ----------------------------------------------------------------


def free_bytes(path):
    try:
        return shutil.disk_usage(path).free
    except OSError:
        return 0


def check_space(path, need):
    if free_bytes(path) < need:
        raise UpdateError("disk-full", "need %d bytes" % need, need_bytes=need)


def check_link_support(folder):
    """update/ の中で小さなファイルを作ってハードリンクできるか試す"""
    os.makedirs(folder, exist_ok=True)
    name = os.path.join(folder, ".linktest-%s" % uuid.uuid4().hex[:8])
    try:
        with open(name, "wb") as f:
            f.write(b"x")
        os.link(name, name + ".l")
        return True
    except (OSError, NotImplementedError, AttributeError):
        return False
    finally:
        for path in (name + ".l", name):
            try:
                os.unlink(path)
            except OSError:
                pass


# ---- zip の検査（1 つでも違えば unsafe-zip）------------------------------------


def _unsafe(detail):
    return UpdateError("unsafe-zip", detail)


def _brief(exc):
    """失敗の短い説明（OSError はパスを出さない）"""
    if isinstance(exc, OSError):
        return os_error_text(exc)
    if isinstance(exc, UpdateError):
        return exc.detail
    return "%s: %s" % (type(exc).__name__, exc)


def _check_name(name):
    if not name.startswith(PREFIX):
        raise _unsafe("prefix: %r" % name[:60])
    if len(name) > 400 or "\\" in name or ":" in name:
        raise _unsafe("bad name: %r" % name[:60])
    if any(ord(c) < 0x20 or ord(c) == 0x7F for c in name):
        raise _unsafe("control char in name")
    rest = name[len(PREFIX):]
    if rest == "":
        return None  # 最上位のフォルダの項目（何も書かない）
    pieces = rest[:-1].split("/") if rest.endswith("/") else rest.split("/")
    if any(p in ("", ".", "..") for p in pieces):
        raise _unsafe("bad path: %r" % name[:60])
    return "/".join(pieces)


def inspect_zip(zf, part):
    """項目を全部確かめる。-> ([(info, 相対パス, フォルダか)], 部品の印）"""
    infos = zf.infolist()
    if len(infos) > 2 * (part.files + 1) + 64:
        raise _unsafe("too many entries")
    seen = set()
    entries = []
    total = 0
    mark_rel = "parts/%s.json" % part.kind
    for info in infos:
        rel = _check_name(info.filename)
        if rel is None:
            continue
        is_dir = info.filename.endswith("/")
        fmt = stat.S_IFMT(info.external_attr >> 16)
        if fmt not in (0, stat.S_IFREG, stat.S_IFDIR):
            raise _unsafe("file type: %s" % rel)
        if (fmt == stat.S_IFDIR and not is_dir) or (fmt == stat.S_IFREG and is_dir):
            raise _unsafe("file type mismatch: %s" % rel)
        if info.flag_bits & 0x41:
            raise _unsafe("encrypted: %s" % rel)
        if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            raise _unsafe("compression %d: %s" % (info.compress_type, rel))
        key = rel.casefold()
        if key in seen:
            raise _unsafe("duplicated: %s" % rel)
        seen.add(key)
        if not is_dir:
            total += info.file_size
        entries.append((info, rel, is_dir))
    files = [e for e in entries if not e[2]]
    if len(files) != part.files + 1:
        raise _unsafe("file count %d (expected %d)" % (len(files), part.files + 1))
    if total > part.unpacked_bytes + SLACK_BYTES:
        raise _unsafe("size %d (expected %d)" % (total, part.unpacked_bytes))
    mark_info = next((e[0] for e in files if e[1] == mark_rel), None)
    if mark_info is None or mark_info.file_size > MAX_MARK_BYTES:
        raise _unsafe("missing %s" % mark_rel)
    try:
        mark = parse_part_mark(_load_mark(zf, mark_info), part.kind)
    except UpdateError as e:
        raise _unsafe("mark: %s" % e.detail) from None
    if mark.content_id != part.content_id:
        raise _unsafe("contentId mismatch")
    for _, rel, is_dir in entries:
        if is_dir or rel == mark_rel:
            continue
        if rel.startswith("parts/"):
            raise _unsafe("unexpected %s" % rel)
        if part.kind != "main" and not any(rel.startswith(r + "/") for r in mark.roots):
            raise _unsafe("outside roots: %s" % rel)
    return entries, mark


def _load_mark(zf, info):
    try:
        return strict_loads(zf.read(info).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, zipfile.BadZipFile, RuntimeError, OSError, zlib.error):
        raise UpdateError("bad-manifest", "mark is not JSON") from None


def extract_zip(zf, entries, app_next, cancel, progress=None):
    """app.next の下へ展開する（O_EXCL。重なりは content-check）"""
    root = os.path.abspath(app_next)
    written_total = 0
    try:
        for info, rel, is_dir in entries:
            if cancel.is_set():
                raise Cancelled()
            dest = os.path.join(root, *rel.split("/"))
            if os.path.commonpath([root, os.path.abspath(dest)]) != root:
                raise _unsafe("escapes: %s" % rel)
            if is_dir:
                os.makedirs(dest, mode=0o755, exist_ok=True)
                continue
            os.makedirs(os.path.dirname(dest), mode=0o755, exist_ok=True)
            fd = os.open(dest, _O_FLAGS, 0o600)
            executable = rel.startswith("deploy/zorin/") and rel.endswith((".sh", ".py"))
            written = 0
            with os.fdopen(fd, "wb") as out, zf.open(info) as src:
                while True:
                    chunk = src.read(1 << 20)
                    if not chunk:
                        break
                    written += len(chunk)
                    if written > info.file_size:
                        raise _unsafe("larger than declared: %s" % rel)
                    out.write(chunk)
                    written_total += len(chunk)
                    if progress:
                        progress(written_total)
            os.chmod(dest, 0o755 if executable else 0o644)
    except (zipfile.BadZipFile, NotImplementedError, RuntimeError, EOFError, zlib.error) as e:
        # 壊れた deflate の中身は zlib.error（ほかの壊れ方と同じく unsafe-zip。sha256 は合っていても起こりうる）
        raise _unsafe("%s: %s" % ("zlib.error" if isinstance(e, zlib.error) else type(e).__name__, e)) from e
    except (FileExistsError, NotADirectoryError, IsADirectoryError) as e:
        raise UpdateError("content-check", "overlap or path conflict: %s: %s" % (rel, _brief(e))) from e
    return written_total


def copy_part(app, app_next, mark, link_ok, cancel, progress=None):
    """変わらない部品の roots の下を app.next へ写す（ハードリンク、だめならコピー）。-> 書いた分の大きさ"""
    use_link = link_ok
    files = total = copied = 0
    for root in mark.roots:
        src_top = os.path.join(app, *root.split("/"))
        dst_top = os.path.join(app_next, *root.split("/"))
        for dirpath, dirnames, filenames in os.walk(src_top, followlinks=False):
            rel_dir = os.path.relpath(dirpath, src_top)
            dst_dir = dst_top if rel_dir == "." else os.path.join(dst_top, rel_dir)
            os.makedirs(dst_dir, exist_ok=True)
            if any(os.path.islink(os.path.join(dirpath, d)) for d in dirnames):
                raise UpdateError("content-check", "symlink in %s" % root)
            for name in filenames:
                if cancel.is_set():
                    raise Cancelled()
                src, dst = os.path.join(dirpath, name), os.path.join(dst_dir, name)
                if os.path.islink(src):
                    raise UpdateError("content-check", "symlink in %s" % root)
                if os.path.lexists(dst):
                    raise UpdateError("content-check", "overlap: %s" % name)
                linked = False
                if use_link:
                    try:
                        os.link(src, dst)
                        linked = True
                    except OSError:
                        use_link = False
                if not linked:
                    shutil.copy2(src, dst)
                    copied += os.path.getsize(dst)
                    if progress:
                        progress(copied)
                files += 1
                total += os.path.getsize(dst)
    if (files, total) != (mark.files, mark.unpacked_bytes):
        raise UpdateError(
            "content-check",
            "%s: %d files %d bytes (expected %d, %d)"
            % (mark.kind, files, total, mark.files, mark.unpacked_bytes),
        )
    os.makedirs(os.path.join(app_next, "parts"), exist_ok=True)
    shutil.copy2(
        os.path.join(app, "parts", mark.kind + ".json"),
        os.path.join(app_next, "parts", mark.kind + ".json"),
    )
    return copied


def assemble(layout, plans, fetch, link_ok, cancel, progress):
    """app.next を作り直す。zip を全部検査してから展開し、変わらない部品を写す。
    progress(書いた大きさ, 全体の大きさ, 部品の種類, 何番目, 全部で何個)"""
    copies = [p for p in plans if p.action == "copy"]
    remove_tree(layout.app_next)
    os.makedirs(layout.app_next)
    count = len(plans)
    done = 0
    with contextlib.ExitStack() as stack:
        prepared = []
        for plan in fetch:  # 先に全部の zip を検査する（1 つでも違えば何も入れない）
            path = os.path.join(layout.downloads, plan.part.name)
            zf = stack.enter_context(zipfile.ZipFile(path))
            prepared.append((plan.part, zf, inspect_zip(zf, plan.part)[0]))
        total = sum(i.file_size for _, _, entries in prepared for i, _, is_dir in entries if not is_dir)
        if not link_ok:
            total += sum(p.part.unpacked_bytes for p in copies)
        progress(0, total, fetch[0].part.kind if fetch else "", 1, count)
        for index, (part, zf, entries) in enumerate(prepared, 1):

            def report(written, base=done, kind=part.kind, index=index):
                progress(base + written, total, kind, index, count)

            done += extract_zip(zf, entries, layout.app_next, cancel, report)
        for index, plan in enumerate(copies, len(prepared) + 1):

            def report(copied, base=done, kind=plan.part.kind, index=index):
                progress(base + copied, total, kind, index, count)

            done += copy_part(layout.app, layout.app_next, plan.mark, link_ok, cancel, report)


# ---- 中身の確かめと自己検査 ------------------------------------------------------


def verify_tree(root, manifest=None):
    """組み立てた（または今の）置き場の中身の確かめ。違えば content-check"""
    for rel in REQUIRED_FILES:
        if not os.path.isfile(os.path.join(root, *rel.split("/"))):
            raise UpdateError("content-check", "missing: %s" % rel)
    try:
        main = parse_part_mark(read_json_file(os.path.join(root, "parts", "main.json"), 1 << 16))
    except (OSError, ValueError, UpdateError) as e:
        raise UpdateError("content-check", "parts/main.json: %s" % _brief(e)) from None
    if main.kind != "main":
        raise UpdateError("content-check", "parts/main.json is not main")
    if manifest is not None:
        if main.version != manifest.version:
            raise UpdateError("content-check", "version %s != %s" % (main.version, manifest.version))
        for part in manifest.parts:
            try:
                mark = parse_part_mark(
                    read_json_file(os.path.join(root, "parts", part.kind + ".json"), 1 << 16),
                    part.kind,
                )
            except (OSError, ValueError, UpdateError) as e:
                raise UpdateError("content-check", "parts/%s.json: %s" % (part.kind, _brief(e))) from None
            if mark.content_id != part.content_id:
                raise UpdateError("content-check", "contentId of %s" % part.kind)
    dist = os.path.join(root, "dist")
    try:
        app_version = read_json_file(os.path.join(dist, "version.json"), 1 << 16).get("appVersion")
    except (OSError, ValueError, AttributeError):
        app_version = None
    if app_version is not None and app_version != main.version:
        raise UpdateError("content-check", "appVersion %s != %s" % (app_version, main.version))
    _check_packs(dist)


def _check_packs(dist):
    path = os.path.join(dist, "packs.json")
    if not os.path.isfile(path):
        return
    try:
        packs = read_json_file(path, 64 << 20)
    except (OSError, ValueError) as e:
        raise UpdateError("content-check", "packs.json: %s" % _brief(e)) from None
    if not isinstance(packs, dict):
        raise UpdateError("content-check", "packs.json")
    if isinstance(packs.get("packs"), dict):  # scripts/package-release.ts は {packs: {…}} の形も読む
        packs = packs["packs"]
    for pack_id, pack in sorted(packs.items()):
        if not isinstance(pack, dict) or "files" not in pack:
            continue
        files = pack["files"]
        if not isinstance(files, list):
            raise UpdateError("content-check", "packs.json: %s" % pack_id)
        for rel in files:
            if not is_safe_rel_path(rel) or not os.path.isfile(os.path.join(dist, *rel.split("/"))):
                raise UpdateError("content-check", "pack %s: missing %s" % (pack_id, rel))


def self_test_args(argv):
    """再起動で渡す引数（serve.py の sys.argv[1:]）から、自己検査に渡す分。--dir は除く
    （自己検査は自分の置き場の dist を見る。--dir を渡すと今の版の dist を見てしまうため）"""
    out, skip = [], False
    for arg in argv or ():
        if skip:
            skip = False
            continue
        if arg == "--dir":
            skip = True
            continue
        if arg.startswith("--dir="):
            continue
        out.append(arg)
    return out


def hide_paths(text, app_next):
    """自己検査の出力の中の、置き場の親（app_next の親）を <DATA> に、ホームを ~ に置き換える。
    利用者のログイン名を含むフルパス（traceback・ImportError の文）が、状態の窓口と保護者画面に出ないように。
    同じパスの書き方の違い（そのまま・絶対パス・実体のパス・区切りの違い・repr の中の二重の区切り）も置き換える"""

    def forms(path):
        found = set()
        for base in (path, os.path.abspath(path), os.path.realpath(path)):
            for variant in (base, base.replace("\\", "/"), base.replace("/", "\\")):
                found.add(variant)
                found.add(variant.replace("\\", "\\\\"))
        return found

    pairs = []
    data = os.path.dirname(app_next.rstrip("/\\"))
    if data and os.path.dirname(data) != data:  # 最上位（/ など）は置き換えない
        pairs.extend((form, "<DATA>") for form in forms(data))
    home = os.path.expanduser("~")
    if home not in ("", "~") and os.path.dirname(home) != home:
        pairs.extend((form, "~") for form in forms(home))
    for form, token in sorted(pairs, key=lambda pair: len(pair[0]), reverse=True):
        text = text.replace(form, token)
    return text


def run_self_test(app_next, argv=()):
    """新しい serve.py を別のプロセスで --self-test する（0 が成功）。
    再起動で渡すのと同じ引数も付ける（新しい版で引数の名前が変わって起動できない、を入れ替えの前に見つける）"""
    script = os.path.join(app_next, "deploy", "zorin", "serve.py")
    try:
        done = subprocess.run(
            [sys.executable, "-B", script] + self_test_args(argv) + ["--self-test"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=SELF_TEST_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        raise UpdateError("self-test", "timeout") from None
    except OSError as e:
        raise UpdateError("self-test", "cannot run: %s" % _brief(e)) from None
    if done.returncode != 0:
        text = hide_paths(done.stdout.decode("utf-8", "replace"), app_next)
        tail = text.strip().splitlines()[-3:]
        raise UpdateError("self-test", "exit %d: %s" % (done.returncode, " / ".join(tail)))


# ---- 入れ替え ---------------------------------------------------------------


def _renameat2_exchange(first, second):
    """Linux の renameat2(RENAME_EXCHANGE)。使えなければ OSError(ENOSYS/EINVAL) か AttributeError"""
    libc = ctypes.CDLL(None, use_errno=True)
    function = libc.renameat2
    function.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    function.restype = ctypes.c_int
    if function(-100, os.fsencode(first), -100, os.fsencode(second), 2) != 0:
        code = ctypes.get_errno()
        raise OSError(code, os.strerror(code))


def _rename_retry(src, dst):
    """Windows ではウイルス対策などで一時的に失敗するので 0.5 秒あけて 10 回まで"""
    attempts = 10 if os.name == "nt" else 1
    for number in range(attempts):
        try:
            os.rename(src, dst)
            return
        except OSError:
            if number == attempts - 1:
                raise
            _sleep(0.5)


def recover_app(layout):
    """app が無く app.prev だけがある（前の入れ替えで元に戻せなかった）なら、app.prev を app に戻す。
    戻せなければ switch-broken（app.prev は消さない。唯一残っている版のため）"""
    if os.path.isdir(layout.app) or not os.path.isdir(layout.app_prev):
        return
    try:
        _rename_retry(layout.app_prev, layout.app)
    except OSError as e:
        raise UpdateError("switch-broken", "app is missing and app.prev cannot be restored: %s" % _errno_name(e)) from None


def _errno_name(exc):
    return os_error_text(exc)


def swap_in(layout):
    """app と app.next を入れ替える。前の版は app.prev。失敗したら元に戻して switch-failed。
    元に戻すこともできず app が無くなったときは switch-broken（そのとき app.next・app.prev は消さない）"""
    recover_app(layout)
    if not os.path.isdir(layout.app):
        raise UpdateError("switch-broken", "app is missing")
    remove_tree(layout.app_prev)
    if sys.platform.startswith("linux"):
        try:
            _renameat2_exchange(layout.app_next, layout.app)
        except (AttributeError, OSError) as e:
            if isinstance(e, OSError) and e.errno not in (errno.EINVAL, errno.ENOSYS):
                raise UpdateError("switch-failed", "renameat2: %s" % _brief(e)) from None
        else:
            try:
                os.rename(layout.app_next, layout.app_prev)
            except OSError:
                pass  # 新しい版はもう app にある。控えの名前は次の片付けで消える
            return
    try:
        _rename_retry(layout.app, layout.app_prev)
    except OSError as e:
        raise UpdateError("switch-failed", "app -> app.prev: %s" % _errno_name(e)) from None
    try:
        _rename_retry(layout.app_next, layout.app)
    except OSError as e:
        try:
            _rename_retry(layout.app_prev, layout.app)
        except OSError as e2:
            raise UpdateError(
                "switch-broken", "app.next -> app: %s / rollback: %s" % (_errno_name(e), _errno_name(e2))
            ) from None
        raise UpdateError("switch-failed", "app.next -> app: %s" % _errno_name(e)) from None


# ---- 取得フォルダの片付け ---------------------------------------------------------


def prune_downloads(downloads, keep_names):
    """keep_names に無いものを消す（確かめ済みの zip・.part・.part.json）"""
    try:
        names = os.listdir(downloads)
    except OSError:
        return
    keep = set()
    for name in keep_names:
        keep.update((name, name + ".part", name + ".part.json"))
    for name in names:
        if name not in keep:
            remove_tree(os.path.join(downloads, name))
