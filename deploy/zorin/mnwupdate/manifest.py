# -*- coding: utf-8 -*-
"""版の情報・部品の印の確かめ、版の比較、今の中身の読み取り、計画（設計 3 章・5.6 節）"""
from __future__ import annotations

import datetime
import os
import re
import unicodedata

from .common import (
    APP_NAME,
    SCHEMA,
    UpdateError,
    compare_versions,
    parse_version,
    read_json_file,
    strict_loads,
)

MAX_MANIFEST_BYTES = 64 * 1024
MAX_PART_BYTES = 2147483648
MAX_FILES = 65534
MAX_UNPACKED = 4294967295
RESERVE_BYTES = 256 * 1024 * 1024
MAX_NOTES = 5
NOTE_LENGTH = 120

_KIND_RE = re.compile(r"[a-z0-9][a-z0-9-]{0,39}")
_HEX64_RE = re.compile(r"[0-9a-f]{64}")
_DATE_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
_BIDI = set("‪‫‬‭‮⁦⁧⁨⁩")


class Part:
    """版の情報の parts[] の 1 つ"""

    def __init__(self, kind, name, size, sha256, content_id, files, unpacked_bytes):
        self.kind = kind
        self.name = name
        self.bytes = size
        self.sha256 = sha256
        self.content_id = content_id
        self.files = files
        self.unpacked_bytes = unpacked_bytes


class Manifest:
    def __init__(self, schema, version, tag, date, min_version, notes, parts):
        self.schema = schema
        self.version = version
        self.tag = tag
        self.date = date
        self.min_version = min_version
        self.notes = notes
        self.parts = parts

    @property
    def blocked_schema(self):
        return self.schema != SCHEMA


class PartMark:
    """部品の印 parts/<kind>.json"""

    def __init__(self, kind, version, content_id, files, unpacked_bytes, roots):
        self.kind = kind
        self.version = version
        self.content_id = content_id
        self.files = files
        self.unpacked_bytes = unpacked_bytes
        self.roots = roots


def _bad(detail):
    return UpdateError("bad-manifest", detail)


def _is_int(value, low, high):
    return isinstance(value, int) and not isinstance(value, bool) and low <= value <= high


def clean_note(text):
    """制御文字などを除いて 120 文字で切る"""
    kept = []
    for ch in text:
        if unicodedata.category(ch) in ("Cc", "Zl", "Zp") or ch in _BIDI:
            continue
        kept.append(ch)
    return "".join(kept)[:NOTE_LENGTH].strip()


def part_name(version, kind):
    if kind == "main":
        return "manabi-no-niwa-%s.zip" % version
    return "manabi-no-niwa-%s-%s.zip" % (version, kind)


def _parse_notes(value):
    if not isinstance(value, list) or len(value) > MAX_NOTES:
        raise _bad("notes")
    notes = []
    for item in value:
        if not isinstance(item, str):
            raise _bad("notes")
        cleaned = clean_note(item)
        if cleaned:
            notes.append(cleaned)
    return notes


def _parse_date(value):
    if not isinstance(value, str) or not _DATE_RE.fullmatch(value):
        raise _bad("date")
    try:
        datetime.date(int(value[:4]), int(value[5:7]), int(value[8:10]))
    except ValueError:
        raise _bad("date") from None
    return value


def _parse_part(item, version):
    if not isinstance(item, dict):
        raise _bad("parts")
    kind = item.get("kind")
    if not isinstance(kind, str) or not _KIND_RE.fullmatch(kind):
        raise _bad("parts.kind")
    if item.get("name") != part_name(version, kind):
        raise _bad("parts.name")
    if not _is_int(item.get("bytes"), 1, MAX_PART_BYTES):
        raise _bad("parts.bytes")
    for field in ("sha256", "contentId"):
        value = item.get(field)
        if not isinstance(value, str) or not _HEX64_RE.fullmatch(value):
            raise _bad("parts." + field)
    if not _is_int(item.get("files"), 1, MAX_FILES):
        raise _bad("parts.files")
    if not _is_int(item.get("unpackedBytes"), 0, MAX_UNPACKED):
        raise _bad("parts.unpackedBytes")
    return Part(
        kind,
        item["name"],
        item["bytes"],
        item["sha256"],
        item["contentId"],
        item["files"],
        item["unpackedBytes"],
    )


def parse_manifest(data):
    """版の情報（bytes か str）を確かめて Manifest にする。違えば bad-manifest"""
    if isinstance(data, str):
        data = data.encode("utf-8")
    if len(data) > MAX_MANIFEST_BYTES:
        raise _bad("too large")
    try:
        obj = strict_loads(data.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise _bad("not JSON") from None
    if not isinstance(obj, dict):
        raise _bad("not an object")
    schema = obj.get("schema")
    if not _is_int(schema, 1, 1 << 31):
        raise _bad("schema")
    if obj.get("app") != APP_NAME:
        raise _bad("app")
    version = obj.get("version")
    if parse_version(version) is None:
        raise _bad("version")
    date = _parse_date(obj.get("date"))
    if schema != SCHEMA:
        # 未来の形式: 版・公開日・変わった点だけを読んで、自動では入れない
        try:
            notes = _parse_notes(obj.get("notes", []))
        except UpdateError:
            notes = []
        tag = obj.get("tag") if obj.get("tag") == "v" + version else "v" + version
        min_version = obj.get("minVersion") if parse_version(obj.get("minVersion")) else version
        return Manifest(schema, version, tag, date, min_version, notes, [])
    if obj.get("tag") != "v" + version:
        raise _bad("tag")
    min_version = obj.get("minVersion")
    if parse_version(min_version) is None or compare_versions(min_version, version) > 0:
        raise _bad("minVersion")
    notes = _parse_notes(obj.get("notes"))
    items = obj.get("parts")
    if not isinstance(items, list) or not 1 <= len(items) <= 8:
        raise _bad("parts")
    parts = [_parse_part(item, version) for item in items]
    if len({p.kind for p in parts}) != len(parts):
        raise _bad("parts.kind duplicated")
    if sum(1 for p in parts if p.kind == "main") != 1:
        raise _bad("parts.main")
    return Manifest(schema, version, obj["tag"], date, min_version, notes, parts)


# ---- 部品の印 ----------------------------------------------------------------


def is_safe_rel_path(text, prefix=None):
    """zip の中・roots の相対パスとして安全か（/ 区切り。prefix 以下の 2 階層目以上）"""
    if not isinstance(text, str) or not 0 < len(text) <= 400:
        return False
    if "\\" in text or ":" in text or any(ord(c) < 0x20 or ord(c) == 0x7F for c in text):
        return False
    pieces = text.split("/")
    if any(p in ("", ".", "..") for p in pieces):
        return False
    return prefix is None or (pieces[0] == prefix and len(pieces) >= 2)


def parse_part_mark(obj, kind=None):
    """部品の印を確かめて PartMark にする。違えば bad-manifest"""
    if not isinstance(obj, dict) or obj.get("schema") != SCHEMA or obj.get("app") != APP_NAME:
        raise _bad("mark")
    mark_kind = obj.get("kind")
    if not isinstance(mark_kind, str) or not _KIND_RE.fullmatch(mark_kind):
        raise _bad("mark.kind")
    if kind is not None and mark_kind != kind:
        raise _bad("mark.kind mismatch")
    version = obj.get("version")
    if parse_version(version) is None:
        raise _bad("mark.version")
    content_id = obj.get("contentId")
    if not isinstance(content_id, str) or not _HEX64_RE.fullmatch(content_id):
        raise _bad("mark.contentId")
    if not _is_int(obj.get("files"), 0, MAX_FILES) or not _is_int(
        obj.get("unpackedBytes"), 0, MAX_UNPACKED
    ):
        raise _bad("mark.files")
    roots = obj.get("roots")
    if not isinstance(roots, list) or len(set(roots)) != len(roots):
        raise _bad("mark.roots")
    if not all(is_safe_rel_path(r, "dist") for r in roots):
        raise _bad("mark.roots path")
    if mark_kind == "main" and roots:
        raise _bad("mark.roots main")
    return PartMark(
        mark_kind, version, content_id, obj["files"], obj["unpackedBytes"], list(roots)
    )


def load_installed_marks(app):
    """app/parts/*.json を読む。読めない・壊れた印は『無い』扱い。-> {kind: PartMark}"""
    marks = {}
    folder = os.path.join(app, "parts")
    try:
        names = sorted(os.listdir(folder))
    except OSError:
        return marks
    for name in names:
        if not name.endswith(".json"):
            continue
        try:
            marks[name[:-5]] = parse_part_mark(
                read_json_file(os.path.join(folder, name), 1 << 16), name[:-5]
            )
        except (OSError, ValueError, UpdateError):
            continue
    return marks


def scan_roots(app, roots):
    """roots の下のファイルの数と合計の大きさ。リンクがあるなど正しくなければ None"""
    files = 0
    total = 0
    for root in roots:
        top = os.path.join(app, *root.split("/"))
        if not os.path.isdir(top) or os.path.islink(top):
            continue
        for dirpath, dirnames, filenames in os.walk(top, followlinks=False):
            if any(os.path.islink(os.path.join(dirpath, d)) for d in dirnames):
                return None
            for name in filenames:
                path = os.path.join(dirpath, name)
                if os.path.islink(path):
                    return None
                try:
                    total += os.stat(path).st_size
                except OSError:
                    return None
                files += 1
    return files, total


# ---- 計画 --------------------------------------------------------------------


class PartPlan:
    def __init__(self, part, action, mark=None):
        self.part = part
        self.action = action  # 'fetch'（取得する）か 'copy'（今の版から写す）
        self.mark = mark


def plan_parts(manifest, installed, app=None):
    """部品ごとに取得か写しかを決める。app を渡すと、写す部品は roots の下を歩いて印と合うか確かめる"""
    plans = []
    for part in manifest.parts:
        mark = installed.get(part.kind)
        same = (
            part.kind != "main"
            and mark is not None
            and mark.content_id == part.content_id
            and mark.files == part.files
            and mark.unpacked_bytes == part.unpacked_bytes
        )
        if same and app is not None:
            same = scan_roots(app, mark.roots) == (mark.files, mark.unpacked_bytes)
        plans.append(PartPlan(part, "copy" if same else "fetch", mark if same else None))
    return plans


def estimate_need(plans, link_ok=True, remaining=None):
    """必要な空きの見積もり（設計 5.6 節）。remaining(part) は残りの取得の大きさ（無ければ全部）"""
    download = unpacked = copied = 0
    for plan in plans:
        if plan.action == "fetch":
            download += plan.part.bytes if remaining is None else remaining(plan.part)
            unpacked += plan.part.unpacked_bytes
        else:
            copied += plan.part.unpacked_bytes
    return download + unpacked + (0 if link_ok else copied) + RESERVE_BYTES


def summarize_latest(manifest, current_version, installed):
    """窓口の状態の latest（minVersion つき。ファイルは歩かない）"""
    plans = plan_parts(manifest, installed)
    newer = compare_versions(manifest.version, current_version) > 0
    blocked = None
    if newer:
        if manifest.blocked_schema:
            blocked = "schema"
        elif compare_versions(current_version, manifest.min_version) < 0:
            blocked = "min-version"
    fetch = [p for p in plans if p.action == "fetch"]
    return {
        "version": manifest.version,
        "date": manifest.date,
        "notes": list(manifest.notes),
        "newer": newer,
        "installable": newer and blocked is None,
        "blockedReason": blocked,
        "downloadBytes": sum(p.part.bytes for p in fetch),
        "needBytes": estimate_need(plans, True) if plans else 0,
        "parts": [
            {"kind": p.part.kind, "bytes": p.part.bytes, "changed": p.action == "fetch"}
            for p in plans
        ],
        "minVersion": manifest.min_version,
    }
