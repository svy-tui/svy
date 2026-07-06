# README用デモGIF生成: vhs scripts/demo.tape
#
# 前提: brew install vhs（ttyd/ffmpegも入る）、Cascadia Code フォント、
#       svy がPATHにあること（npm link 済み or グローバルインストール）
# 個人情報対策: PS1を「$ 」に上書きし、表示されるのは合成デモデータのみ。
Output assets/demo.gif

Set Shell bash
Set FontSize 15
Set FontFamily "Cascadia Code"
Set Width 1100
Set Height 640
Set Padding 12
Set Framerate 20
Set TypingSpeed 80ms

Hide
Type `export PS1='$ ' && clear`
Enter
Show

Type "svy --demo"
Sleep 600ms
Enter
Sleep 2.5s

# メトリクスを巡回して Network へ
Type "j"
Sleep 800ms
Type "j"
Sleep 800ms
Type "j"
Sleep 1.5s

# NIC 切替
Tab
Sleep 1.2s
Tab
Sleep 1s

# タイムカーソルを動かしてズームイン
Type "hhhh"
Sleep 1s
Type "+"
Sleep 1s
Type "+"
Sleep 1.5s
Type "0"
Sleep 1s

# 日付切替（前日へ→今日へ）
Type ","
Sleep 1.5s
Type "."
Sleep 1.2s

# ヘルプを見せて終了
Type "?"
Sleep 2.2s
Type "?"
Sleep 800ms
Type "q"
Sleep 800ms
