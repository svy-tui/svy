#!/usr/bin/env bash
# README用スクリーンショット生成（assets/shot-*.png を上書き）
#
# 仕組み: tmux上で --demo を操作 → ANSIキャプチャ(capture-pane -e)
#         → aha でHTML化 → ヘッドレスChromeでPNG化。
# GitHubのコードブロックはANSIカラーを描画できないため画像にしている。
#
# 前提（macOS）:
#   - npm run build 済みであること（node dist/cli.js を起動する）
#   - tmux
#   - aha                  … brew install aha
#   - Google Chrome        … /Applications に通常インストール
#   - Cascadia Code フォント … brew install --cask font-cascadia-code
#     （braille U+2800 を「塗りつぶしドットのみ」で描ける数少ないフォント。
#       JetBrains Mono はグリフ無し=豆腐、Apple Braille / DejaVu は
#       未設定ドットも薄く描くため点線調になり見た目が崩れる）
#
# 使い方: ./scripts/shots.sh
# デモデータはシード固定なので、UIを変えない限り同じ絵が再現される。
set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"; tmux kill-session -t svyshot 2>/dev/null || true' EXIT

tmux kill-session -t svyshot 2>/dev/null || true
tmux new-session -d -s svyshot -x 100 -y 24 'node dist/cli.js --demo; sleep 60'
sleep 2

snap() { tmux capture-pane -pe -t svyshot > "$WORK/$1.ansi"; }
snap cpu
tmux send-keys -t svyshot j j j && sleep 1 && snap network
tmux send-keys -t svyshot + + h h h h h && sleep 1 && snap zoom
tmux send-keys -t svyshot '?' && sleep 1 && snap help
tmux kill-session -t svyshot

for f in cpu network zoom help; do
  # 末尾の空行を除去
  sed -e :a -e '/^[[:space:]]*$/{$d;N;ba' -e '}' "$WORK/$f.ansi" > "$WORK/$f.trim"
  {
    printf '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#0d1117}pre{margin:0;padding:28px 32px;background:#0d1117;color:#c9d1d9;font:14px/1.25 "Cascadia Code","Menlo","Apple Braille",monospace;white-space:pre}</style><pre>'
    aha --black --no-header < "$WORK/$f.trim"
    printf '</pre>'
  } > "$WORK/$f.html"
  LINES=$(wc -l < "$WORK/$f.trim")
  "$CHROME" --headless --screenshot="$OUT/shot-$f.png" \
    --window-size=920,$((LINES * 18 + 68)) \
    --force-device-scale-factor=2 --hide-scrollbars \
    "file://$WORK/$f.html" 2>/dev/null
done
echo "wrote: $OUT/shot-{cpu,network,zoom,help}.png"
