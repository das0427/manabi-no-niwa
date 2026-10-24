#!/usr/bin/env bash
# まなびのにわ 音声ビルド (Linux / macOS / Git Bash)
#   npm run voice:build:sh         -> public/audio を差分生成
# 追加引数は generate.py にそのまま渡す (--force / --script / --out / --dry-run ...)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
VENV="$ROOT/.venv"
REQ="$HERE/requirements.txt"

if [ -x "$VENV/bin/python" ]; then
  VPY="$VENV/bin/python"
elif [ -x "$VENV/Scripts/python.exe" ]; then   # Git Bash on Windows
  VPY="$VENV/Scripts/python.exe"
else
  PY="${PYTHON:-}"
  if [ -z "$PY" ]; then
    for c in python3.12 python3 python; do
      if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
    done
  fi
  [ -n "$PY" ] || { echo "Python 3.12 が見つかりません" >&2; exit 1; }
  echo "[voice] venv 作成: $VENV (python: $PY)"
  "$PY" -m venv "$VENV"
  VPY="$VENV/bin/python"
fi

STAMP="$VENV/.requirements.sha1"
if command -v sha1sum >/dev/null 2>&1; then HASH="$(sha1sum "$REQ" | cut -d' ' -f1)"; else HASH="$(shasum "$REQ" | cut -d' ' -f1)"; fi
if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$HASH" ]; then
  echo "[voice] pip install -r requirements.txt"
  "$VPY" -m pip install --disable-pip-version-check -r "$REQ"
  printf '%s' "$HASH" > "$STAMP"
fi

PYTHONUTF8=1 exec "$VPY" -I "$HERE/generate.py" "$@"
