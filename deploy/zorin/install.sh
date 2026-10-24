#!/usr/bin/env bash
# まなびのにわ 導入スクリプト（保護者が 1 回だけ実行します。sudo は使いません）
#
#   bash install.sh               アプリを配置し、アプリ一覧とデスクトップにアイコンを作る
#   bash install.sh --autostart   上に加えて、ログイン時に配信を自動で始める設定（systemd ユーザー単位）も行う
#   bash install.sh --yes         確認の質問を省く（上記の内容をそのまま実行）
#
# 実行の前に「何をするか」を表示して、y/N で確認します。
# 更新するときは、新しい配布物を展開して、もういちどこのスクリプトを実行してください。
# 学習データはブラウザの中にあるため、更新しても消えません。
set -euo pipefail

AUTOSTART=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --autostart) AUTOSTART=1 ;;
    -y|--yes) ASSUME_YES=1 ;;
    -h|--help)
      sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
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
DIST_SRC="$ROOT/dist"

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
APP_DIR="$DATA_HOME/manabi-no-niwa/app"
APPS_DIR="$DATA_HOME/applications"
SYSTEMD_DIR="$CONFIG_HOME/systemd/user"
DESKTOP_FILE="$APPS_DIR/manabi-no-niwa.desktop"
SERVICE_FILE="$SYSTEMD_DIR/manabi-no-niwa.service"
DESKTOP_DIR=""
if command -v xdg-user-dir >/dev/null 2>&1; then DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || true)"; fi
if [ -z "$DESKTOP_DIR" ] || [ "$DESKTOP_DIR" = "$HOME" ]; then DESKTOP_DIR="$HOME/Desktop"; fi
SHORTCUT_FILE="$DESKTOP_DIR/manabi-no-niwa.desktop"

if [ "$ROOT" = "$APP_DIR" ]; then
  echo "エラー: 配置先（$APP_DIR）の中から実行しています。展開した配布物のフォルダから実行してください。" >&2
  exit 1
fi
if [ ! -f "$DIST_SRC/index.html" ]; then
  echo "エラー: $DIST_SRC/index.html がありません。配布物（dist フォルダ入り）を展開した場所の deploy/zorin から実行してください。" >&2
  exit 1
fi
for f in serve.py manabi.sh uninstall.sh manabi-no-niwa.desktop manabi-no-niwa.service; do
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
for pid, p in sorted(packs.items()):
    n = sum(1 for f in p.get("files", []) if not os.path.isfile(os.path.join(d, f)))
    if n:
        print(f"{pid}（{n} ファイル）")
PY
)
if [ -n "$MISSING" ]; then
  echo "エラー: 教材パックのファイルが足りません。配布 zip（本体と audio-g1-g2・audio-g3-g4・audio-g5-g6）をすべて同じ場所に展開してから、もういちど実行してください。" >&2
  echo "足りないパック:" >&2
  echo "$MISSING" >&2
  exit 1
fi

echo "=== まなびのにわ 導入 ==="
echo "これから次のことを行います（sudo・管理者権限は使いません）。"
echo
echo "  1. アプリ本体をコピー:   $DIST_SRC"
echo "                         と deploy/zorin の起動用ファイル  →  $APP_DIR"
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
echo

if [ "$ASSUME_YES" -ne 1 ]; then
  # 端末から入力する。入力が得られない（標準入力が空）ときは「いいえ」として中止する
  read -r -p "実行しますか？ [y/N] " answer || answer=""
  case "$answer" in
    y|Y|yes|YES) ;;
    *) echo "中止しました。何も変更していません。"; exit 0 ;;
  esac
fi

# ---- 1. アプリ本体 ----
mkdir -p "$APP_DIR/deploy/zorin"
rm -rf "$APP_DIR/dist.new"
cp -R "$DIST_SRC" "$APP_DIR/dist.new"
rm -rf "$APP_DIR/dist.old"
if [ -d "$APP_DIR/dist" ]; then mv "$APP_DIR/dist" "$APP_DIR/dist.old"; fi
mv "$APP_DIR/dist.new" "$APP_DIR/dist"
rm -rf "$APP_DIR/dist.old"
for f in serve.py manabi.sh install.sh uninstall.sh manabi-no-niwa.desktop manabi-no-niwa.service; do
  if [ -f "$HERE/$f" ]; then cp "$HERE/$f" "$APP_DIR/deploy/zorin/$f"; fi
done
chmod +x "$APP_DIR/deploy/zorin/serve.py" "$APP_DIR/deploy/zorin/manabi.sh" \
  "$APP_DIR/deploy/zorin/uninstall.sh"
if [ -f "$APP_DIR/deploy/zorin/install.sh" ]; then chmod +x "$APP_DIR/deploy/zorin/install.sh"; fi
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

echo
echo "完了しました。デスクトップの「まなびのにわ」アイコン（またはアプリ一覧）から開けます。"
echo "取り消すとき: bash \"$APP_DIR/deploy/zorin/uninstall.sh\""
