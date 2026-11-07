#!/usr/bin/env bash
# まなびのにわ 起動スクリプト（デスクトップのアイコンから呼ばれる。コマンドを打つ必要はありません）
#
# 0. 起動を 1 本ずつにする（flock）。アイコンを続けて押しても、順に 1 回ずつ処理する
# 1. http://127.0.0.1:8765/__manabi/health を確認する
#      - まなびのにわの配信が動いている → そのまま次へ
#      - 何も動いていない               → serve.py を裏で起動して、起動を待つ
#      - 別のものがポートを使っている   → エラーを出して終わる（別のポートへは逃げない）
# 2. すでに開いている窓を前に出す（二重起動の防止）
#      使うブラウザを 3 と同じ決め方で先に決め（command -v で探すだけ。何も起動しない）、種類（chromium / firefox / other）を
#      --browser として mnwwindow.py に渡す（Chromium 系で開く端末では、Firefox の窓を前に出さないため）。
#      mnwwindow.py が、X11・XWayland で見える「まなびのにわ」の窓を探す。あれば前に出して全画面にして、
#      ここで終わる（新しい窓は開かない）。窓が見つからない・前に出せないときは 3 へ進む
#      （そのときはアプリの中で、画面が 1 つにまとまる）。
# 3. ブラウザで開く
#      MANABI_BROWSER があればそれを優先。なければ chromium / chromium-browser / google-chrome /
#      google-chrome-stable / brave-browser を「アプリ窓（--app）」で、無ければ firefox（通常のタブ）、無ければ xdg-open。
#      Wayland のセッションで Chromium 系を起動するときは、mnwwindow.py の答えしだいで
#      --ozone-platform=x11 を --app の前に付ける（窓を XWayland にして、2 で探せるようにするため）。
#      2 で窓が見つからなかったときだけ、開いたあと、窓が見えるまで最大 5 秒待つ（そのあいだ、0 の鍵を持ち続ける）。
#
# 環境変数（困ったとき・開発者向け）:
#      MANABI_BROWSER=コマンド    使うブラウザ
#      MANABI_SINGLE_INSTANCE=0   2 の前面化・--ozone-platform の指定・3 のあとの待ちをやめる
#      MANABI_OZONE=x11|native    --ozone-platform=x11 を付けるかを決める（mnwwindow.py が読む）
#      これらの値は、実行も展開もせず、そのままの文字として扱う。
#
# 重要: ブラウザのプロファイル（学習データの置き場所）は各ブラウザの既定のままにしています。
#       --user-data-dir を付けて別のプロファイルにすると、学習データ（IndexedDB）が別扱いになり、
#       それまでの記録が見えなくなります。また、アドレスは必ず http://127.0.0.1:8765/ です
#       （localhost や別のポートでも開けますが、データは別扱いになります）。
#
# 更新（保護者画面「このアプリについて」の「更新する」）との関係:
#       更新のとき、配信（serve.py）は 1 秒ほどのあいだ自分で起動し直します。そのあいだに
#       このスクリプトが動いても、下の「ほぼ同時に別の起動が先に動いた場合は、それを使う」で足ります
#       （どちらの配信も、更新後の app/deploy/zorin/serve.py です）。このスクリプトの動きは更新と関係なく同じです。
#       更新は app/ を入れ替えますが、このスクリプト・serve.py・app/dist/icons/icon-192.png のパスは変わりません。
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
WIN_PY="${HERE}/mnwwindow.py"
WIN_LOG="${STATE_DIR}/launch.log"

show_error() {
  local msg="$1"
  # 起動の鍵（fd 9）を先に外す。ダイアログが閉じられるまでこのスクリプトは終わらないので、
  # 持ったままだと、そのあいだに押された次の起動が 20 秒待って、何も出さずに終わってしまう。
  # show_error のあとは、どの呼び出し元もすぐ終わる（鍵が外れても困らない）。
  # 注意: ここに 2>/dev/null を付けない（exec のリダイレクトはシェルの標準エラーを恒久的に変えてしまう）。fd 9 が開いていなくても失敗しない
  exec 9>&-
  printf '%s: %s\n' "$TITLE" "$msg" >&2
  if command -v zenity >/dev/null 2>&1 && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    zenity --error --no-markup --title="$TITLE" --text="$msg" >/dev/null 2>&1 || true
  elif command -v notify-send >/dev/null 2>&1 && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    notify-send -u critical "$TITLE" "$msg" >/dev/null 2>&1 || true
  fi
}

PY="$(command -v python3 || true)"
if [ -z "$PY" ]; then
  show_error "python3 が見つかりません。端末で 'sudo apt install python3' を実行してください（保護者の作業）。"
  exit 1
fi

# ---- 0. 起動を 1 本ずつにする ----
# 鍵は fd 9 で持ち、このスクリプトが終わると外れる。
# 配信・ブラウザ・補助（mnwwindow.py）には 9>&- を付けて、鍵を渡さない
# （渡すと、ブラウザが動いているあいだ鍵が外れず、次の起動が待たされて何もせずに終わる）。
# flock が無い、または鍵を置く場所に書けないときは、鍵なしでそのまま進む。
mkdir -p "$STATE_DIR" 2>/dev/null || true
LOCK_FILE=""
for d in "${XDG_RUNTIME_DIR:-}" "$STATE_DIR"; do
  # 自分のフォルダだけ使う（ほかの利用者のフォルダに置かれた鍵で、起動を止められないように）
  if [ -n "$d" ] && [ -d "$d" ] && [ -w "$d" ] && [ -O "$d" ]; then
    LOCK_FILE="${d}/manabi-no-niwa-launch.lock"
    break
  fi
done
# 鍵のファイルが、リンクや、ほかの利用者のファイルなら使わない（鍵なしで進む）
if [ -n "$LOCK_FILE" ] && { [ -L "$LOCK_FILE" ] || { [ -e "$LOCK_FILE" ] && [ ! -O "$LOCK_FILE" ]; }; }; then
  LOCK_FILE=""
fi
# exec のリダイレクトが失敗するとシェルごと終わることがあるので、先にサブシェルで開けることを確かめる
if [ -n "$LOCK_FILE" ] && command -v flock >/dev/null 2>&1 && ( : >>"$LOCK_FILE" ) 2>/dev/null; then
  exec 9>>"$LOCK_FILE"
  lock_rc=0
  flock -w 20 9 || lock_rc=$?
  if [ "$lock_rc" -eq 1 ]; then
    # 20 秒たってもほかの起動が終わらない（時間切れ）。その起動に任せて、何もせずに終わる
    printf '%s: ほかの起動が終わるのを待ちきれませんでした。\n' "$TITLE" >&2
    exit 0
  elif [ "$lock_rc" -ne 0 ]; then
    # 時間切れ以外の失敗（鍵を使えない場所など）。起動できなくなるよりよいので、鍵なしで進む
    exec 9>&-
  fi
fi

# ---- すでに開いている窓を前に出す補助（mnwwindow.py。無い配置では、今までどおり動く）----
use_win() { [ "${MANABI_SINGLE_INSTANCE:-1}" != "0" ] && [ -f "$WIN_PY" ]; }
win() { "$PY" -I -B "$WIN_PY" --log "$WIN_LOG" "$@" 9>&- 2>/dev/null; }

# 戻り値: 0 = まなびのにわの配信 / 1 = 何も待ち受けていない / 2 = 別のものが答えている（それ以外の値も 2 と同じに扱う）
# -I : 今いるフォルダの json.py などを読み込まない（アイコンから開くと、今いるフォルダは HOME になる）
# alarm : 1 秒に 1 バイトずつ返すものがいても、6 秒で必ず終わる（urllib の timeout は 1 回ごとの期限のため）。鍵を持つ時間の上限にもなる
check_health() {
  "$PY" -I - "$HEALTH_URL" 9>&- <<'PYEOF'
import json, signal, sys, urllib.error, urllib.request
signal.signal(signal.SIGALRM, lambda *_: sys.exit(2))
signal.alarm(6)
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
そのプログラムを止めてから、もういちど開いてください。別のポートでは開きません。学習データが別扱いになるためです。"

check_health
status=$?
if [ "$status" -ne 0 ] && [ "$status" -ne 1 ]; then
  show_error "$PORT_BUSY_MSG"
  exit 1
fi

if [ "$status" -eq 1 ]; then
  mkdir -p "$STATE_DIR"
  : >"$LOG"
  if command -v setsid >/dev/null 2>&1; then
    nohup setsid "$PY" "$SERVE" >>"$LOG" 2>&1 9>&- &
  else
    nohup "$PY" "$SERVE" >>"$LOG" 2>&1 9>&- &
  fi
  SERVER_PID=$!
  disown "$SERVER_PID" 2>/dev/null || true

  started=0
  for _ in $(seq 1 50); do
    check_health
    s=$?
    if [ "$s" -eq 0 ]; then started=1; break; fi
    if [ "$s" -ne 1 ]; then show_error "$PORT_BUSY_MSG"; exit 1; fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      # 起動した配信が終わった。ほぼ同時に別の起動（自動起動など）が先に動いた場合は、それを使う
      # （更新で配信が起動し直しているあいだに開かれた場合も、ここで足りる）
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

# ---- 使うブラウザを決める（3 で開くブラウザ。2 の前に決めて、2 と 3 で同じ結果を使う）----
# command -v で探すだけで、何も起動しない。見つからない・MANABI_BROWSER のコマンドが無い、といったエラーは 3 で出す
#   BROWSER_CMD  : 起動するコマンド（MANABI_BROWSER のときは引数も入る）。見つからなければ空
#   BROWSER_KIND : chromium = Chromium 系 / firefox / other = xdg-open・見つからない・MANABI_BROWSER で種類が分からない
#                  mnwwindow.py の focus と wait に --browser で渡す（窓の探し方を、使うブラウザに合わせるため）
# MANABI_BROWSER の種類は、先頭の語の basename だけで見る（中身は実行も展開もしない）
is_chromium_family() {
  case "$(basename -- "$1")" in
    *chrom*|*brave*|*edge*|*vivaldi*|*opera*) return 0 ;;
    *) return 1 ;;
  esac
}

browser_kind() {
  if is_chromium_family "$1"; then
    echo chromium
  else
    case "$(basename -- "$1")" in
      *firefox*) echo firefox ;;
      *) echo other ;;
    esac
  fi
}

BROWSER_CMD=()
BROWSER_KIND="other"
pick_browser() {
  local b
  if [ -n "${MANABI_BROWSER:-}" ]; then
    read -r -a BROWSER_CMD <<<"$MANABI_BROWSER"
    BROWSER_KIND="$(browser_kind "${BROWSER_CMD[0]:-}")"
    return 0
  fi
  for b in chromium chromium-browser google-chrome google-chrome-stable brave-browser firefox xdg-open; do
    if command -v "$b" >/dev/null 2>&1; then
      BROWSER_CMD=("$b")
      BROWSER_KIND="$(browser_kind "$b")"
      return 0
    fi
  done
}
pick_browser

# ---- 2. すでに開いている窓があれば、前に出して全画面にして終わる ----
# 終わってよいのは focus が 0（前に出た）のときだけ。それ以外（窓が無い・前に出せない・X11 が使えない・補助の不具合）は、
# どれも今までどおり新しい窓を開く
# focus_rc : 3 = 窓が無い（このあと開く）。それ以外（前に出せなかった・X11 が使えない・補助の不具合）では、
# 開いたあとの wait をしない（古い窓を見つけて 0 秒で終わる、または失敗して待つだけになるため）
focus_rc=99
if use_win; then
  focus_rc=0
  win focus --browser "$BROWSER_KIND" >/dev/null || focus_rc=$?
  if [ "$focus_rc" -eq 0 ]; then
    exit 0
  fi
fi

# ---- 3. ブラウザで開く ----
launch() {
  # 9>&- : 鍵の fd をブラウザに渡さない
  if command -v setsid >/dev/null 2>&1; then
    nohup setsid "$@" >/dev/null 2>&1 9>&- &
  else
    nohup "$@" >/dev/null 2>&1 9>&- &
  fi
  disown 2>/dev/null || true
}

# Chromium 系の起動に足す指定を OZONE_FLAG に入れる（足さないときは空）。
# mnwwindow.py の答えが「--ozone-platform=x11」ちょうどのときだけ使い、ほかの文字は受け付けない。
# $1 = ブラウザのコマンド
set_ozone_flag() {
  OZONE_FLAG=""
  if use_win; then
    OZONE_FLAG="$(win ozone-flag "$1" || true)"
  fi
  if [ "$OZONE_FLAG" != "--ozone-platform=x11" ]; then OZONE_FLAG=""; fi
}

# ブラウザを起動したあと、窓が X11 に現れるまで（最大 5 秒）鍵を持ち続けて終わる（2 で窓が見つからなかったときだけ）。
# そのあいだに押された次の起動は、窓が出たあとで 2 の前面化に回る
finish_launch() {
  if use_win && [ "$focus_rc" -eq 3 ]; then win wait --timeout 5 --browser "$BROWSER_KIND" >/dev/null || true; fi
  exit 0
}

if [ -n "${MANABI_BROWSER:-}" ]; then
  if ! command -v "${BROWSER_CMD[0]}" >/dev/null 2>&1; then
    show_error "MANABI_BROWSER に指定されたブラウザ（${MANABI_BROWSER}）が見つかりません。"
    exit 1
  fi
  if [ "$BROWSER_KIND" = "chromium" ]; then
    set_ozone_flag "${BROWSER_CMD[0]}"
    # 保護者が自分で --ozone-platform（または --ozone-platform-hint）を書いていたら、それを優先する（後ろの指定が勝つため、足さない）
    for a in "${BROWSER_CMD[@]:1}"; do
      case "$a" in --ozone-platform=*|--ozone-platform-hint=*) OZONE_FLAG="" ;; esac
    done
    launch "${BROWSER_CMD[@]}" ${OZONE_FLAG:+"$OZONE_FLAG"} "--app=${URL}"
  else
    launch "${BROWSER_CMD[@]}" "$URL"
  fi
  finish_launch
fi

if [ "${#BROWSER_CMD[@]}" -eq 0 ]; then
  show_error "ブラウザが見つかりません。Chromium か Firefox を入れて、${URL} を開いてください。"
  exit 1
fi

# 見つかったブラウザ。Chromium 系は「アプリ窓（--app）」、Firefox・xdg-open は通常のタブ
if [ "$BROWSER_KIND" = "chromium" ]; then
  set_ozone_flag "${BROWSER_CMD[0]}"
  launch "${BROWSER_CMD[0]}" ${OZONE_FLAG:+"$OZONE_FLAG"} "--app=${URL}"
else
  launch "${BROWSER_CMD[0]}" "$URL"
fi
finish_launch
