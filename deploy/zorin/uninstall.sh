#!/usr/bin/env bash
# まなびのにわ 取り消しスクリプト（install.sh が行ったことを元に戻します。sudo は使いません）
#
#   bash uninstall.sh        内容を表示して y/N で確認してから実行
#   bash uninstall.sh --yes  確認を省く
#
# 学習データ（記録・作品・設定）はブラウザの中にあり、このスクリプトでは消えません。
# 消したいときは、保護者画面の「データ」から消すか、ブラウザの設定
# （サイトのデータの削除。http://127.0.0.1:8765 のデータ）で消してください。
set -euo pipefail

ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    -h|--help)
      # 先頭のコメント（最初のコメントでない行まで）を表示する
      awk 'NR > 1 { if ($0 !~ /^#/) exit; sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) echo "不明な指定: $arg（--yes / --help が使えます）" >&2; exit 1 ;;
  esac
done

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
BASE_DIR="$DATA_HOME/manabi-no-niwa"
APP_DIR="$BASE_DIR/app"
APP_NEXT="$BASE_DIR/app.next"
APP_PREV="$BASE_DIR/app.prev"
UPDATE_DIR="$BASE_DIR/update"
UPDATER_CONFIG_DIR="$CONFIG_HOME/manabi-no-niwa"
DESKTOP_FILE="$DATA_HOME/applications/manabi-no-niwa.desktop"
SERVICE_FILE="$CONFIG_HOME/systemd/user/manabi-no-niwa.service"
STATE_DIR="$STATE_HOME/manabi-no-niwa"
DESKTOP_DIR=""
if command -v xdg-user-dir >/dev/null 2>&1; then DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || true)"; fi
if [ -z "$DESKTOP_DIR" ] || [ "$DESKTOP_DIR" = "$HOME" ]; then DESKTOP_DIR="$HOME/Desktop"; fi
SHORTCUT_FILE="$DESKTOP_DIR/manabi-no-niwa.desktop"

echo "=== まなびのにわ 取り消し ==="
echo "これから次のことを行います（sudo・管理者権限は使いません）。"
echo
echo "  1. 自動起動を無効にして、サービスファイルを削除:  $SERVICE_FILE"
echo "  2. 動いている まなびのにわの配信を止める（$APP_DIR/deploy/zorin/serve.py のプロセスだけ）"
echo "  3. アプリ一覧とデスクトップのアイコンを削除:"
echo "       $DESKTOP_FILE"
echo "       $SHORTCUT_FILE"
echo "  4. 配置したアプリ本体と、更新で使ったものを削除:"
echo "       $APP_DIR"
echo "       $APP_PREV（前の版の控え）"
echo "       $APP_NEXT（組み立て中の新しい版）"
echo "       $UPDATE_DIR（更新の作業用）"
echo "       $UPDATER_CONFIG_DIR（更新の設定 updater.json）"
echo "       （配信の記録 $STATE_DIR も削除）"
echo
echo "ブラウザの中の学習データ（記録・作品・設定）は消えません。"
echo "消すには、保護者画面の「データ」から、またはブラウザの設定でサイトのデータを削除してください。"
echo

if [ "$ASSUME_YES" -ne 1 ]; then
  # 端末から入力する。入力が得られない（標準入力が空）ときは「いいえ」として中止する
  read -r -p "実行しますか？ [y/N] " answer || answer=""
  case "$answer" in
    y|Y|yes|YES) ;;
    *) echo "中止しました。何も変更していません。"; exit 0 ;;
  esac
fi

# 1. 自動起動
if command -v systemctl >/dev/null 2>&1 && [ -f "$SERVICE_FILE" ]; then
  systemctl --user disable --now manabi-no-niwa.service 2>/dev/null || true
fi
if [ -f "$SERVICE_FILE" ]; then
  rm -f "$SERVICE_FILE"
  if command -v systemctl >/dev/null 2>&1; then systemctl --user daemon-reload 2>/dev/null || true; fi
  echo "[1/4] 自動起動を取り消しました"
else
  echo "[1/4] 自動起動は設定されていませんでした"
fi

# 2. 配信を止める（この配置先の serve.py だけ。pkill -f の対象は正規表現なので、パスの記号をエスケープする）
if command -v pkill >/dev/null 2>&1; then
  SERVE_PATTERN="$(printf '%s' "$APP_DIR/deploy/zorin/serve.py" | sed 's/[][\.*^$+?(){}|]/\\&/g')"
  pkill -u "$(id -u)" -f "$SERVE_PATTERN" 2>/dev/null || true
fi
echo "[2/4] 動いている配信を止めました（動いていなければ何もしていません）"

# 3. アイコン
rm -f "$DESKTOP_FILE" "$SHORTCUT_FILE"
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$DATA_HOME/applications" 2>/dev/null || true; fi
echo "[3/4] アプリ一覧とデスクトップのアイコンを削除しました"

# 4. 本体・前の版の控え・組み立て中・更新の作業用・更新の設定
#    （意図しない場所を消さないよう、パスが …/manabi-no-niwa/… の形であることを確かめてから消す）
remove_under_base() {
  case "$1" in
    ?*/manabi-no-niwa/app|?*/manabi-no-niwa/app.prev|?*/manabi-no-niwa/app.next|?*/manabi-no-niwa/update)
      if [ -e "$1" ] || [ -L "$1" ]; then rm -rf "$1"; fi
      ;;
    *) echo "不正な配置先のため、削除は行いませんでした: $1" >&2 ;;
  esac
}
for d in "$APP_DIR" "$APP_PREV" "$APP_NEXT" "$UPDATE_DIR"; do
  remove_under_base "$d"
done
case "$UPDATER_CONFIG_DIR" in
  ?*/manabi-no-niwa)
    if [ "$UPDATER_CONFIG_DIR" = "$BASE_DIR" ]; then
      # 設定の置き場と配置先が同じフォルダのとき（XDG_CONFIG_HOME と XDG_DATA_HOME が同じ）は、設定のファイルだけ消す
      rm -f "$UPDATER_CONFIG_DIR/updater.json"
    elif [ -e "$UPDATER_CONFIG_DIR" ]; then
      rm -rf "$UPDATER_CONFIG_DIR"
    fi
    ;;
  *) echo "不正な設定の置き場のため、削除は行いませんでした: $UPDATER_CONFIG_DIR" >&2 ;;
esac
case "$BASE_DIR" in
  ?*/manabi-no-niwa) rmdir "$BASE_DIR" 2>/dev/null || true ;;
  *) echo "不正な配置先のため、フォルダの片付けは行いませんでした: $BASE_DIR" >&2 ;;
esac
rm -rf "$STATE_DIR"
echo "[4/4] アプリ本体と、更新で使ったもの（前の版の控え・作業用のフォルダ・更新の設定）を削除しました"

echo
echo "取り消しました。ブラウザの中の学習データは残っています（消すには保護者画面かブラウザの設定から）。"
