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
    -h|--help) sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "不明な指定: $arg（--yes / --help が使えます）" >&2; exit 1 ;;
  esac
done

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
BASE_DIR="$DATA_HOME/manabi-no-niwa"
APP_DIR="$BASE_DIR/app"
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
echo "  4. 配置したアプリ本体を削除:  $APP_DIR"
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

# 2. 配信を止める（この配置先の serve.py だけ）
if command -v pkill >/dev/null 2>&1; then
  pkill -u "$(id -u)" -f "$APP_DIR/deploy/zorin/serve.py" 2>/dev/null || true
fi
echo "[2/4] 動いている配信を止めました（動いていなければ何もしていません）"

# 3. アイコン
rm -f "$DESKTOP_FILE" "$SHORTCUT_FILE"
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$DATA_HOME/applications" 2>/dev/null || true; fi
echo "[3/4] アプリ一覧とデスクトップのアイコンを削除しました"

# 4. 本体（意図しない場所を消さないよう、パスを確かめる）
case "$APP_DIR" in
  */manabi-no-niwa/app)
    if [ -d "$APP_DIR" ]; then rm -rf "$APP_DIR"; fi
    rmdir "$BASE_DIR" 2>/dev/null || true
    ;;
  *) echo "不正な配置先のため、本体の削除は行いませんでした: $APP_DIR" >&2 ;;
esac
rm -rf "$STATE_DIR"
echo "[4/4] アプリ本体を削除しました"

echo
echo "取り消しました。ブラウザの中の学習データは残っています（消すには保護者画面かブラウザの設定から）。"
