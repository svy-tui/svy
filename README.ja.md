<p align="center">
  <img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/logo.png" width="420" alt="svy — system viewer for sar">
</p>

<p align="center">
  <b>s</b>ystem <b>v</b>iewer for sar — sysstat の過去データを端末でインタラクティブにグラフ表示。<br>
  いわば「過去が見える btop」。
</p>

<p align="center">
  <a href="README.md">English</a> | 日本語 | <a href="README.zh-CN.md">简体中文</a>
</p>


<p align="center">
  <a href="https://www.npmjs.com/package/@svy-tui/svy"><img src="https://img.shields.io/npm/v/@svy-tui/svy?color=cb3837&logo=npm" alt="npm version"></a>
  <img src="https://img.shields.io/node/v/@svy-tui/svy" alt="node version">
  <img src="https://img.shields.io/npm/l/@svy-tui/svy" alt="license">
</p>

---

`sar` はどの Linux サーバでも性能履歴という宝の山を黙々と集めています。
しかしそれを「見る」となると、テキストの表とにらめっこするか、`sadf -g` で
SVG を生成して手元にコピーして回すか。障害の振り返りのたびに同じ雑用が発生します。

**svy** はそのデータを対話的な TUI に変えます。時間をスクラブし、インシデントの
時間帯へズームし、日付をまたいで行き来し、CPU / メモリ / ネットワーク / ディスクを
切り替える——すべてデータがあるその端末の中で完結。ファイル生成なし、GUI 不要、
サーバへのエージェント導入も不要です。

<p align="center"><img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/shot-cpu.png" width="880" alt="svy — CPU view with braille chart"></p>

*（`svy --demo` の実際の端末出力）*

## 10秒で試す（sysstat 不要）

```sh
npx @svy-tui/svy --demo
```

デモには複数日分の合成データが入っています。`<` を押すと過去へ遡れます
（過去日はその場で合成されます）。

## 機能

- **8つのメトリクスグループ** — CPU（コア別）・メモリ・ロードアベレージ・
  ネットワーク（NIC別）・ディスクI/O（デバイス別）・ディスク使用率・IO tps・ページング
- **タイムカーソルとズーム** — `←`/`→` でスクラブ、`+` でカーソル中心にズームし、
  カーソル位置の正確な値を凡例で読める
- **日付ブラウズ** — sar の日次ファイルを `<`/`>` で行き来。`--host` なら隣の日を
  ssh 越しにオンデマンド取得
- **インスタンス切替** — `Tab` で CPU コア・NIC・ディスクデバイスを巡回
- **リモートファースト** — ラップトップからサーバの履歴を閲覧。sysstat が必要なのは
  データを記録した側だけ
- **ゴミファイルゼロ** — パイプから JSON を読み、braille でチャートを描き、
  ディスクには何も書かない

## 画面ツアー

**ネットワークビュー** — インターフェイスごとに rx/tx の2系列を色分け表示。
`Tab` で NIC を切替、y軸の単位は自動で繰り上がります：

<p align="center"><img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/shot-network.png" width="880" alt="svy — network view, rx/tx per interface"></p>

**インシデントへズーム** — `+` でカーソル周辺に窓を絞り込み。ヘッダにズーム範囲が
表示されます。夕方のスパイクが一目瞭然：

<p align="center"><img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/shot-zoom.png" width="880" alt="svy — zoomed into an evening traffic spike"></p>

**ヘルプ** — `?` でアプリを離れずに全キーバインドを確認：

<p align="center"><img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/shot-help.png" width="880" alt="svy — keybindings help overlay"></p>

## 使い方

```sh
# Linuxサーバ上で: 今日のデータを全アクティビティ込みで
sadf -j -- -A | svy

# 特定の日
sadf -j /var/log/sysstat/sa05 -- -A | svy

# 手元のラップトップ（macOS/Windows）からリモートサーバを見る
ssh web01 'sadf -j -- -A' | svy
svy --host web01                      # 同じことの短縮形
svy --host web01 /var/log/sysstat/sa05

# 保存済みファイルから — 複数日を渡して < / > で行き来
sadf -j -- -A > today.json
sadf -j -1 -- -A > yesterday.json
svy today.json yesterday.json
```

### 日付をまたいで見る

sar はデータファイルを1日1つ持ちます。`--host` 使用時に、読み込み済みの端を越えて
`<` / `>` を押すと、隣の日をオンデマンドで取得します（リモートで
`sadf -j -N -- -A` を実行するため、ディストリごとの `saDD` ファイルの置き場所の
違いに影響されません）。ローカルファイルの場合は、渡したファイルがそのまま
行き来できる日になります。

> **Windows での注意:** パイプ（`… | svy`）では `/dev/tty` を開き直せないため
> キー入力が無効になります。ファイル引数か `--host` を使ってください。

## キー操作

| キー | 動作 |
|---|---|
| `↑`/`↓` or `k`/`j` | メトリクス選択 |
| `←`/`→` or `h`/`l` | タイムカーソル移動（`H`/`L` で大きく） |
| `Tab` / `[` `]` | インスタンス切替（CPUコア・NIC・ディスク） |
| `<` / `>` or `,` `.` | 前日 / 翌日 |
| `+` / `-` | カーソル中心にズームイン / アウト |
| `0` | ズームリセット |
| `g` / `G` | 窓の先頭 / 末尾へジャンプ |
| `n` | 次のホスト（マルチホストJSON時） |
| `?` | ヘルプ |
| `q` | 終了 |

## 仕組み

svy の唯一の入力契約は **`sadf -j`**（sysstat 付属）が出力する JSON です。
バイナリの `sa` ファイルを自前でパースすることは決してありません。そのため
sysstat のバージョン差やアーキテクチャ差の影響を受けず、パースの責務は
本来の持ち主である sysstat 側に留まります。

この契約が役割分担も決めます。sysstat はサーバで**収集**し、svy は Node.js ≥ 18.18
が動く場所ならどこでも**閲覧**します（Linux / macOS / Windows Terminal）。
手元のマシンに sysstat は不要です。

入力に無いメトリクスは単に表示されません。マルチホストの JSON にも対応しており、
`n` でホストを切り替えられます。

## 類似ツールとの比較

| | 対話性 | sar過去データ | ファイル生成なし | ラップトップからリモート閲覧 |
|---|---|---|---|---|
| **svy** | TUI | ✓ | ✓ | ✓（ssh / `--host`） |
| `sar` テキスト出力 | – | ✓ | ✓ | ssh経由・表のみ |
| `sadf -g`（SVG） | 静的画像 | ✓ | ファイル生成あり | ファイルをコピーして回る |
| kSar | Java GUI | ✓ | – | エクスポート/X11が必要 |
| atop -r | TUI | 独自フォーマットのみ | ✓ | – |
| btop / htop | TUI | ライブのみ | ✓ | – |

## インストール

```sh
npm install -g @svy-tui/svy    # `svy` コマンドが入ります
```

ソースから（Node.js ≥ 18.18 が必要）：

```sh
git clone https://github.com/svy-tui/svy && cd svy
npm install && npm run build && npm link
svy --demo
```

## 開発

```sh
npm install
npm test        # vitest — パーサ・チャート描画・ビューポート・UI操作
npm run build   # tsc → dist/
node dist/cli.js --demo
```

README のスクリーンショット（`assets/shot-*.png`）は `./scripts/shots.sh` で
再生成できます。前提ツール（tmux・aha・Google Chrome・Cascadia Code フォント）は
スクリプト冒頭のコメントを参照してください。

チャート描画はチャートライブラリに依存しない自前の braille キャンバス、
sadf JSON パーサは sysstat バージョン間のフィールド名の揺れを宣言的に吸収、
ナビゲーションのロジックはすべてテスト付きの純粋関数です。

## ライセンス

[MIT](LICENSE)
