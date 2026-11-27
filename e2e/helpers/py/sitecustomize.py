# -*- coding: utf-8 -*-
"""更新の通し試験（e2e/update.spec.ts）専用。serve.py を本物のまま動かして、空きが足りない状態を作る。

PYTHONPATH にこのフォルダを足すと、Python の起動時に自動で読み込まれる。環境変数
MNW_E2E_FREE_BYTES_FILE が指すファイルがあれば、その中の数を shutil.disk_usage の free として返す
（ファイルが無い・数でないときは本物の値）。試験が開くのは Windows の本物のディスクで、小さな
ディスクを作れない（管理者権限が要る）ため、空きの数だけを差し替える。serve.py や mnwupdate/ は変えない。
"""
import os
import shutil

_PATH = os.environ.get("MNW_E2E_FREE_BYTES_FILE")

if _PATH:
    _real = shutil.disk_usage

    def _disk_usage(path):
        usage = _real(path)
        try:
            with open(_PATH, "r", encoding="ascii") as f:
                free = int(f.read().strip())
        except (OSError, ValueError):
            return usage
        return type(usage)(usage.total, max(0, usage.total - free), free)

    shutil.disk_usage = _disk_usage
