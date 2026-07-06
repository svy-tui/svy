#!/usr/bin/env bash
# README用スクリーンショット生成
# tmux上で --demo を操作 → ANSIキャプチャ → aha でHTML化 → ヘッドレスChromeでPNG化。
# コードブロック貼り付けではGitHub上で色が出ない（ANSI非対応）ため画像にする。
# braille を塗りつぶしドットで描けるフォントが必要:
#   brew install aha && brew install --cask font-cascadia-code
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
