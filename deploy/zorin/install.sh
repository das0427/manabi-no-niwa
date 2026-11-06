#!/usr/bin/env bash
# まなびのにわ 導入スクリプト（保護者が 1 回だけ実行します。sudo は使いません）
#
#   bash install.sh               アプリを配置し、アプリ一覧とデスクトップにアイコンを作る
#   bash install.sh --autostart   上に加えて、ログイン時に配信を自動で始める設定（systemd ユーザー単位）も行う
#   bash install.sh --yes         確認の質問を省く（上記の内容をそのまま実行）
#
# 実行の前に「何をするか」を表示して、y/N で確認します。
# 新しい版を手で入れ直すときは、新しい配布物を展開して、もういちどこのスクリプトを実行してください
# （2.1.0 以降は、保護者画面「このアプリについて」の「更新する」でも更新できます）。
# 学習データはブラウザの中にあるため、更新しても消えません。
#
# 置き場: ${XDG_DATA_HOME:-~/.local/share}/manabi-no-niwa/
#   app/        いまの版（dist・deploy/zorin・parts など）
#   app.next/   この入れ替えの途中だけある（組み立て中の新しい版）
#   app.prev/   更新の仕組みが前の版を控えるところ（このスクリプトは片付ける）
#   update/     更新の作業用（このスクリプトは片付ける）
set -euo pipefail

AUTOSTART=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --autostart) AUTOSTART=1 ;;
    -y|--yes) ASSUME_YES=1 ;;
    -h|--help)
      # 先頭のコメント（最初のコメントでない行まで）を表示する
      awk 'NR > 1 { if ($0 !~ /^#/) exit; sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *)
      echo "不明な指定: $arg（--autostart / --yes / --help が使えます）" >&2
      exit 1
      ;;
  esac
done

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
ROOT_REAL="$(cd "$ROOT" && pwd -P)"
DIST_SRC="$ROOT/dist"
PARTS_SRC="$ROOT/parts"

# パスの表記をそろえる（// を / に、/./ を / に）。更新で起動し直した配信のコマンドラインは
# Python の os.path.abspath で表記がそろうので、配信を止めるときの pkill の型と食い違わないように
normalize_path() {
  printf '%s' "$1" | sed -e 's#//*#/#g' -e ':a' -e 's#/\./#/#' -e 'ta' -e 's#/\.$##' -e 's#\(.\)/$#\1#'
}
DATA_HOME="$(normalize_path "${XDG_DATA_HOME:-$HOME/.local/share}")"
CONFIG_HOME="$(normalize_path "${XDG_CONFIG_HOME:-$HOME/.config}")"
BASE_DIR="$DATA_HOME/manabi-no-niwa"
APP_DIR="$BASE_DIR/app"
APP_NEXT="$BASE_DIR/app.next"
APP_PREV="$BASE_DIR/app.prev"
UPDATE_DIR="$BASE_DIR/update"
APPS_DIR="$DATA_HOME/applications"
SYSTEMD_DIR="$CONFIG_HOME/systemd/user"
DESKTOP_FILE="$APPS_DIR/manabi-no-niwa.desktop"
SERVICE_FILE="$SYSTEMD_DIR/manabi-no-niwa.service"
DESKTOP_DIR=""
if command -v xdg-user-dir >/dev/null 2>&1; then DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || true)"; fi
if [ -z "$DESKTOP_DIR" ] || [ "$DESKTOP_DIR" = "$HOME" ]; then DESKTOP_DIR="$HOME/Desktop"; fi
SHORTCUT_FILE="$DESKTOP_DIR/manabi-no-niwa.desktop"

# 配置先（app・app.next・app.prev・update）の中から実行していないか。
# 入れ替えのときにこれらを消すので、中から実行すると自分の足場を消してしまう
is_inside() {
  case "$1" in
    "$2"|"$2"/*) return 0 ;;
  esac
  return 1
}
BASE_REAL=""
if [ -d "$BASE_DIR" ]; then BASE_REAL="$(cd "$BASE_DIR" && pwd -P)"; fi
for name in app app.next app.prev update; do
  for b in "$BASE_DIR" "$BASE_REAL"; do
    if [ -z "$b" ]; then continue; fi
    if is_inside "$ROOT" "$b/$name" || is_inside "$ROOT_REAL" "$b/$name"; then
      echo "エラー: 配置先（$b/$name）の中から実行しています。展開した配布物のフォルダから実行してください。" >&2
      exit 1
    fi
  done
done

if [ ! -f "$DIST_SRC/index.html" ]; then
  echo "エラー: $DIST_SRC/index.html がありません。配布物（dist フォルダ入り）を展開した場所の deploy/zorin から実行してください。" >&2
  exit 1
fi
for f in serve.py manabi.sh mnwwindow.py uninstall.sh manabi-no-niwa.desktop manabi-no-niwa.service mnwupdate/__init__.py; do
  if [ ! -f "$HERE/$f" ]; then echo "エラー: $HERE/$f がありません。" >&2; exit 1; fi
done
if ! command -v python3 >/dev/null 2>&1; then
  echo "エラー: python3 が見つかりません。ターミナルで 'sudo apt install python3' を実行してから、もういちど試してください。" >&2
  exit 1
fi

# 教材パックのファイル（学年ごとの音声 zip を含む）がそろっているか。足りないと、その学年の教材を準備できない
MISSING=$(python3 - "$DIST_SRC" <<'PY'
import json, os, sys
d = sys.argv[1]
try:
    j = json.load(open(os.path.join(d, "packs.json"), encoding="utf-8"))
    packs = {k: v for k, v in j.items() if isinstance(v, dict) and "files" in v}
except Exception:
    packs = {}
import re
def zip_of(pid):
    # scripts/package-release.ts の分け方と同じ（学年ごとの音声 zip）
    m = re.match(r"^g(\d)-", pid) or re.search(r"-g(\d)", pid)
    n = 5 if pid == "prog-g16" else int(m.group(1)) if m else 0
    return "audio-g1-g2" if n <= 2 else "audio-g3-g4" if n <= 4 else "audio-g5-g6"
need = set()
for pid, p in sorted(packs.items()):
    if any(not os.path.isfile(os.path.join(d, f)) for f in p.get("files", [])):
        need.add(zip_of(pid))
for z in sorted(need):
    print(f"  manabi-no-niwa-<版>-{z}.zip")
PY
)
if [ -n "$MISSING" ]; then
  echo "エラー: 教材の音声が足りません（ダウンロードした zip が足りないか、途中で止まっています）。" >&2
  echo "次の zip をダウンロードし直して、ほかの zip と同じ場所に置いてから、もういちど同じ手順を行ってください:" >&2
  echo "$MISSING" >&2
  exit 1
fi

# 部品の印（parts/main.json）が無い入れ方（リポジトリから直接入れたなど）では、保護者画面からの更新が使えない。止めずに知らせる
HAS_PARTS=0
if [ -f "$PARTS_SRC/main.json" ]; then HAS_PARTS=1; fi
NO_PARTS_MSG="この入れ方では、保護者画面からの更新は使えません（配布 zip から入れたときだけ使えます）。"

echo "=== まなびのにわ 導入 ==="
echo "これから次のことを行います（sudo・管理者権限は使いません）。"
echo
echo "  1. アプリ本体をコピー:   $DIST_SRC"
echo "                         と deploy/zorin の起動用ファイルなど  →  $APP_DIR"
echo "       ・動いている配信（まなびのにわのものだけ）を止めて、新しい版で始め直します"
echo "       ・今の版があれば、新しい版に置き換えます（$APP_NEXT に組み立ててから入れ替えます）"
echo "       ・前の版の控え・更新の作業用のフォルダ（app.prev・app.next・update）を片付けます"
echo "         （$BASE_DIR の中）"
echo "  2. アプリ一覧に登録:     $DESKTOP_FILE"
echo "  3. デスクトップにアイコン: $SHORTCUT_FILE"
if [ "$AUTOSTART" -eq 1 ]; then
  echo "  4. 自動起動を設定:       $SERVICE_FILE を作り、"
  echo "                         systemctl --user enable --now manabi-no-niwa.service を実行"
  echo "                         （ログインすると配信が自動で始まります。127.0.0.1 だけで待ち受けます）"
else
  echo "  （自動起動は設定しません。設定する場合は --autostart を付けて実行してください）"
fi
echo
echo "配信は 127.0.0.1:8765 だけで待ち受けます（同じパソコンのブラウザからしか開けません）。"
echo "学習データはブラウザの中に保存され、このスクリプトは触りません。"
if [ "$HAS_PARTS" -eq 1 ]; then
  echo "新しい版があるかは、配信が起動したときにインターネットにつながっていれば GitHub（github.com）に確かめます。"
  echo "確かめるだけで、入れるのは保護者画面で「更新する」を押したときだけです。"
  echo "保護者画面「このアプリについて」で、この自動の確認をオフにできます。"
else
  echo "※ $NO_PARTS_MSG"
fi
echo

if [ "$ASSUME_YES" -ne 1 ]; then
  # 端末から入力する。入力が得られない（標準入力が空）ときは「いいえ」として中止する
  read -r -p "実行しますか？ [y/N] " answer || answer=""
  case "$answer" in
    y|Y|yes|YES) ;;
    *) echo "中止しました。何も変更していません。"; exit 0 ;;
  esac
fi

# ---- 途中で止まったときの後始末 ----
# 組み立て中の app.next を消す。入れ替えの途中で止まったら app を元に戻す。
# このスクリプトが止めた自動起動の配信は、元の版のままでも始め直す
NEXT_ACTIVE=0   # 1: app.next を組み立て中
SWAP_ACTIVE=0   # 1: app と app.next の入れ替えの途中
SWAPPED=0       # 1: 新しい版への入れ替えが終わった
STOPPED_UNIT=0  # 1: このスクリプトが systemd の単位を止めた
on_exit() {
  local rc=$?
  trap - EXIT
  if [ "$SWAP_ACTIVE" -eq 1 ] && [ ! -d "$APP_DIR" ] && [ -d "$APP_PREV" ]; then
    mv "$APP_PREV" "$APP_DIR" 2>/dev/null || true
  fi
  if [ "$NEXT_ACTIVE" -eq 1 ]; then rm -rf "$APP_NEXT" 2>/dev/null || true; fi
  if [ "$rc" -ne 0 ]; then
    if [ "$SWAPPED" -eq 1 ]; then
      echo "エラー: 途中で止まりました（終了コード $rc）。アプリ本体は新しい版に入れ替わっています。" >&2
    else
      echo "エラー: 途中で止まりました（終了コード $rc）。今までの版は、そのまま残してあります。" >&2
    fi
  fi
  if [ "$STOPPED_UNIT" -eq 1 ]; then
    systemctl --user start manabi-no-niwa.service 2>/dev/null || true
  fi
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

# ---- 0. 動いている配信を止める ----
# systemd の単位が動いていれば止める（あとで始め直す）。手で起動したものは pkill で止める。
# どちらのコマンドも無い環境（Git Bash など）では何もしない。
# pkill -f の対象は正規表現なので、パスの記号をエスケープする
SERVE_PATTERN="$(printf '%s' "$APP_DIR/deploy/zorin/serve.py" | sed 's/[][\.*^$+?(){}|]/\\&/g')"
TRIED_STOP=0
if command -v systemctl >/dev/null 2>&1 && systemctl --user is-active --quiet manabi-no-niwa.service 2>/dev/null; then
  TRIED_STOP=1
  if systemctl --user stop manabi-no-niwa.service 2>/dev/null; then
    STOPPED_UNIT=1
  else
    echo "自動起動の配信を止められませんでした。手で起動した配信と同じ方法で止めます。" >&2
  fi
fi
if command -v pkill >/dev/null 2>&1; then
  TRIED_STOP=1
  pkill -u "$(id -u)" -f "$SERVE_PATTERN" 2>/dev/null || true
  # 止まるまで少し待つ（新しい配信が始まるときに、ポートが空いているように）
  if command -v pgrep >/dev/null 2>&1; then
    for _ in $(seq 1 25); do
      pgrep -u "$(id -u)" -f "$SERVE_PATTERN" >/dev/null 2>&1 || break
      sleep 0.2
    done
  fi
fi
if [ "$TRIED_STOP" -eq 1 ]; then
  echo "[準備] 動いている配信を止めました（動いていなければ何もしていません）"
fi

# ---- 1. アプリ本体 ----
# app.next に新しい版を組み立ててから、app と入れ替える（途中で失敗しても、今の版は残る）
NEXT_ACTIVE=1
rm -rf "$APP_NEXT"
mkdir -p "$APP_NEXT/deploy"
cp -R "$DIST_SRC" "$APP_NEXT/dist"
cp -R "$HERE" "$APP_NEXT/deploy/zorin"
find "$APP_NEXT/deploy/zorin" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true
if [ -d "$PARTS_SRC" ]; then cp -R "$PARTS_SRC" "$APP_NEXT/parts"; fi
if [ -d "$ROOT/licenses" ]; then cp -R "$ROOT/licenses" "$APP_NEXT/licenses"; fi
for f in README.md LICENSE DESINGN.md; do
  if [ -f "$ROOT/$f" ]; then cp "$ROOT/$f" "$APP_NEXT/$f"; fi
done
if [ -f "$ROOT/docs/device-checklist.md" ]; then
  mkdir -p "$APP_NEXT/docs"
  cp "$ROOT/docs/device-checklist.md" "$APP_NEXT/docs/device-checklist.md"
fi
chmod +x "$APP_NEXT/deploy/zorin/"*.sh "$APP_NEXT/deploy/zorin/serve.py"
for f in dist/index.html dist/icons/icon-192.png deploy/zorin/serve.py deploy/zorin/manabi.sh deploy/zorin/mnwwindow.py deploy/zorin/uninstall.sh deploy/zorin/mnwupdate/__init__.py; do
  if [ ! -f "$APP_NEXT/$f" ]; then
    echo "エラー: 新しい版の組み立てに失敗しました（$APP_NEXT/$f がありません）。" >&2
    exit 1
  fi
done

# 入れ替え。2.0.x の配置（app/dist と app/deploy/zorin だけ）も、丸ごと新しい形になる
SWAP_ACTIVE=1
rm -rf "$APP_PREV"
if [ -d "$APP_DIR" ]; then mv "$APP_DIR" "$APP_PREV"; fi
mv "$APP_NEXT" "$APP_DIR"
SWAP_ACTIVE=0
NEXT_ACTIVE=0
SWAPPED=1
rm -rf "$APP_PREV" "$UPDATE_DIR" || echo "前の版の控え・更新の作業用のフォルダを片付けられませんでした（$APP_PREV $UPDATE_DIR）。あとで手で消してかまいません。" >&2
echo "[1/4] アプリ本体を配置しました: $APP_DIR"

# ---- テンプレートの @APP_DIR@ を置き換えて書き出す ----
render_template() {
  local src="$1" dest="$2" content
  content="$(cat "$src")"
  content="${content//@APP_DIR@/$APP_DIR}"
  printf '%s\n' "$content" >"$dest"
}

# ---- 2. アプリ一覧 ----
mkdir -p "$APPS_DIR"
render_template "$HERE/manabi-no-niwa.desktop" "$DESKTOP_FILE"
chmod 644 "$DESKTOP_FILE"
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$APPS_DIR" 2>/dev/null || true; fi
echo "[2/4] アプリ一覧に登録しました: $DESKTOP_FILE"

# ---- 3. デスクトップ ----
if mkdir -p "$DESKTOP_DIR" 2>/dev/null; then
  render_template "$HERE/manabi-no-niwa.desktop" "$SHORTCUT_FILE"
  chmod +x "$SHORTCUT_FILE"
  # GNOME 系は、起動を許可（信頼）しないとデスクトップのアイコンが開けないことがある
  if command -v gio >/dev/null 2>&1; then gio set "$SHORTCUT_FILE" metadata::trusted true 2>/dev/null || true; fi
  echo "[3/4] デスクトップにアイコンを作りました: $SHORTCUT_FILE"
  echo "      （初めて開くときに「起動を許可する」が出たら、許可してください）"
else
  echo "[3/4] デスクトップのフォルダを作れなかったため、アイコンは作りませんでした（アプリ一覧からは開けます）"
fi

# ---- 4. 自動起動 ----
if [ "$AUTOSTART" -eq 1 ]; then
  mkdir -p "$SYSTEMD_DIR"
  render_template "$HERE/manabi-no-niwa.service" "$SERVICE_FILE"
  if command -v systemctl >/dev/null 2>&1 && systemctl --user daemon-reload 2>/dev/null; then
    if systemctl --user enable --now manabi-no-niwa.service; then
      echo "[4/4] 自動起動を設定しました（ログインすると配信が始まります）"
      echo "      すでに手動で配信を始めていてポートが使用中の場合、自動起動の配信は止まります。"
      echo "      その場合は、いちどログアウトするか、手動の配信を止めてから"
      echo "      systemctl --user restart manabi-no-niwa.service を実行してください。"
    else
      echo "[4/4] サービスの有効化に失敗しました。$SERVICE_FILE は配置済みです。" >&2
    fi
  else
    echo "[4/4] systemctl --user が使えないため、サービスファイルの配置だけ行いました: $SERVICE_FILE" >&2
  fi
else
  echo "[4/4] 自動起動は設定していません"
fi

# ---- 0 で止めた自動起動の配信を、新しい版で始め直す ----
if [ "$STOPPED_UNIT" -eq 1 ]; then
  STOPPED_UNIT=0
  if systemctl --user start manabi-no-niwa.service 2>/dev/null; then
    echo "[完了] 止めていた自動起動の配信を、新しい版で始め直しました"
  else
    echo "止めていた自動起動の配信を始め直せませんでした。デスクトップのアイコンから開いてください。" >&2
  fi
fi

echo
echo "完了しました。デスクトップの「まなびのにわ」アイコン（またはアプリ一覧）から開けます。"
if [ "$HAS_PARTS" -eq 1 ]; then
  echo "新しい版が出たときは、保護者画面「このアプリについて」の「更新する」で入れられます。"
else
  echo "$NO_PARTS_MSG"
fi
echo "取り消すとき: bash \"$APP_DIR/deploy/zorin/uninstall.sh\""
