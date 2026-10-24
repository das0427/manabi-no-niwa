#!/usr/bin/env bash
# まなびのにわ 起動スクリプト（デスクトップのアイコンから呼ばれる。コマンドを打つ必要はありません）
#
# 1. http://127.0.0.1:8765/__manabi/health を確認する
#      - まなびのにわの配信が動いている → そのまま開く
#      - 何も動いていない               → serve.py を裏で起動して、起動を待つ
#      - 別のものがポートを使っている   → エラーを出して終わる（別のポートへは逃げない）
# 2. ブラウザで開く
#      MANABI_BROWSER があればそれを優先。なければ chromium / chromium-browser / google-chrome /
#      google-chrome-stable / brave-browser を「アプリ窓（--app）」で、無ければ firefox（通常のタブ）。
#
# 重要: ブラウザのプロファイル（学習データの置き場所）は各ブラウザの既定のままにしています。
#       --user-data-dir を付けて別のプロファイルにすると、学習データ（IndexedDB）が別扱いになり、
#       それまでの記録が見えなくなります。また、アドレスは必ず http://127.0.0.1:8765/ です
#       （localhost や別のポートでも開けますが、データは別扱いになります）。
set -u

HOST="127.0.0.1"
PORT="8765"
URL="http://${HOST}:${PORT}/"
HEALTH_URL="${URL}__manabi/health"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVE="${HERE}/serve.py"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/manabi-no-niwa"
LOG="${STATE_DIR}/serve.log"
TITLE="まなびのにわ"

show_error() {
  local msg="$1"
  printf '%s: %s\n' "$TITLE" "$msg" >&2
  if command -v zenity >/dev/null 2>&1 && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    zenity --error --no-markup --title="$TITLE" --text="$msg" >/dev/null 2>&1 || true
  elif command -v notify-send >/dev/null 2>&1 && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    notify-send -u critical "$TITLE" "$msg" >/dev/null 2>&1 || true
  fi
}

PY="$(command -v python3 || true)"
if [ -z "$PY" ]; then
  show_error "python3 が見つかりません。ターミナルで 'sudo apt install python3' を実行してください（保護者の作業）。"
  exit 1
fi

# 戻り値: 0 = まなびのにわの配信 / 1 = 何も待ち受けていない / 2 = 別のものが答えている
check_health() {
  "$PY" - "$HEALTH_URL" <<'PYEOF'
import json, sys, urllib.error, urllib.request
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))  # プロキシ設定は使わない
try:
    with opener.open(sys.argv[1], timeout=3) as r:
        data = json.load(r)
    sys.exit(0 if isinstance(data, dict) and data.get("app") == "manabi-no-niwa" else 2)
except urllib.error.HTTPError:
    sys.exit(2)
except urllib.error.URLError as e:
    sys.exit(1 if isinstance(e.reason, ConnectionRefusedError) else 2)
except Exception:
    sys.exit(2)
PYEOF
}

PORT_BUSY_MSG="ポート ${PORT} を、まなびのにわ以外のものが使っています。
そのプログラムを止めてから、もういちど開いてください（別のポートでは開きません。学習データが別扱いになるためです）。"

check_health
status=$?
if [ "$status" -eq 2 ]; then
  show_error "$PORT_BUSY_MSG"
  exit 1
fi

if [ "$status" -eq 1 ]; then
  mkdir -p "$STATE_DIR"
  : >"$LOG"
  if command -v setsid >/dev/null 2>&1; then
    nohup setsid "$PY" "$SERVE" >>"$LOG" 2>&1 &
  else
    nohup "$PY" "$SERVE" >>"$LOG" 2>&1 &
  fi
  SERVER_PID=$!
  disown "$SERVER_PID" 2>/dev/null || true

  started=0
  for _ in $(seq 1 50); do
    check_health
    s=$?
    if [ "$s" -eq 0 ]; then started=1; break; fi
    if [ "$s" -eq 2 ]; then show_error "$PORT_BUSY_MSG"; exit 1; fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      # 起動した配信が終わった。ほぼ同時に別の起動（自動起動など）が先に動いた場合は、それを使う
      sleep 0.3
      check_health && { started=1; break; }
      show_error "配信を起動できませんでした。
$(tail -n 5 "$LOG" 2>/dev/null)
（詳しい記録: ${LOG}）"
      exit 1
    fi
    sleep 0.2
  done
  if [ "$started" -ne 1 ]; then
    show_error "配信の起動を待ちましたが、応答がありません。（記録: ${LOG}）"
    exit 1
  fi
fi

# ---- ブラウザで開く ----
is_chromium_family() {
  case "$(basename -- "$1")" in
    *chrom*|*brave*|*edge*|*vivaldi*|*opera*) return 0 ;;
    *) return 1 ;;
  esac
}

launch() {
  if command -v setsid >/dev/null 2>&1; then
    nohup setsid "$@" >/dev/null 2>&1 &
  else
    nohup "$@" >/dev/null 2>&1 &
  fi
  disown 2>/dev/null || true
}

if [ -n "${MANABI_BROWSER:-}" ]; then
  read -r -a BROWSER_CMD <<<"$MANABI_BROWSER"
  if ! command -v "${BROWSER_CMD[0]}" >/dev/null 2>&1; then
    show_error "MANABI_BROWSER に指定されたブラウザ（${MANABI_BROWSER}）が見つかりません。"
    exit 1
  fi
  if is_chromium_family "${BROWSER_CMD[0]}"; then
    launch "${BROWSER_CMD[@]}" "--app=${URL}"
  else
    launch "${BROWSER_CMD[@]}" "$URL"
  fi
  exit 0
fi

for b in chromium chromium-browser google-chrome google-chrome-stable brave-browser; do
  if command -v "$b" >/dev/null 2>&1; then
    launch "$b" "--app=${URL}"
    exit 0
  fi
done

if command -v firefox >/dev/null 2>&1; then
  launch firefox "$URL"
  exit 0
fi

if command -v xdg-open >/dev/null 2>&1; then
  launch xdg-open "$URL"
  exit 0
fi

show_error "ブラウザが見つかりません。Chromium か Firefox を入れて、${URL} を開いてください。"
exit 1
