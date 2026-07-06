<p align="center">
  <img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/logo.png" width="420" alt="svy — system viewer for sar">
</p>

<p align="center">
  <b>s</b>ystem <b>v</b>iewer for sar — 在终端里交互式浏览 sysstat 历史数据的图表工具。<br>
  可以说是「面向过去的 btop」。
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.ja.md">日本語</a> | 简体中文
</p>

---

每台 Linux 服务器上，`sar` 都在默默积累着宝贵的性能历史数据。但要「看」这些数据，
要么盯着纯文本表格，要么用 `sadf -g` 生成 SVG 文件再拷贝到本地。每次故障复盘都
从同样的杂务开始。

**svy** 把这些数据变成交互式 TUI：在时间轴上滑动光标、放大故障时段、跨天翻阅、
在 CPU / 内存 / 网络 / 磁盘之间切换——一切都在数据所在的终端里完成。不生成任何
文件，不需要 GUI，也不用在服务器上安装任何 agent。

<p align="center"><img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/shot-cpu.png" width="880" alt="svy — CPU view with braille chart"></p>

*（`svy --demo` 的真实终端输出）*

## 10 秒上手（无需 sysstat）

```sh
npx @svy-tui/svy --demo
```

演示数据包含多天内容——按 `<` 即可回到过去（历史日期会即时合成）。

> 还没发布到 npm？请[从源码安装](#安装)后运行 `svy --demo`。

## 特性

- **8 组指标** — CPU（按核心）、内存、平均负载、网络（按网卡）、
  磁盘 I/O（按设备）、磁盘利用率、IO tps、分页
- **时间光标与缩放** — 用 `←`/`→` 滑动，用 `+` 以光标为中心放大，
  图例实时显示光标处的精确数值
- **跨天浏览** — 用 `<`/`>` 翻阅 sar 的每日文件；配合 `--host` 时，
  相邻日期会通过 ssh 按需拉取
- **实例切换** — 用 `Tab` 在 CPU 核心、网卡、磁盘设备之间循环
- **远程优先** — 在笔记本上查看服务器的历史数据；只有产生数据的机器才需要 sysstat
- **零文件残留** — 从管道读取 JSON，用盲文点阵画图，不向磁盘写任何东西

## 界面一览

**网络视图** — 每个网卡显示 rx/tx 两条彩色曲线，`Tab` 切换网卡，
纵轴单位自动进位：

<p align="center"><img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/shot-network.png" width="880" alt="svy — network view, rx/tx per interface"></p>

**放大故障时段** — 按 `+` 以光标为中心收窄窗口，标题栏显示缩放范围。
傍晚的流量尖峰一目了然：

<p align="center"><img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/shot-zoom.png" width="880" alt="svy — zoomed into an evening traffic spike"></p>

**帮助** — 按 `?` 无需离开应用即可查看所有快捷键：

<p align="center"><img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/shot-help.png" width="880" alt="svy — keybindings help overlay"></p>

## 用法

```sh
# 在 Linux 服务器上：查看今天的全部活动数据
sadf -j -- -A | svy

# 查看某一天
sadf -j /var/log/sysstat/sa05 -- -A | svy

# 在笔记本（macOS/Windows）上查看远程服务器
ssh web01 'sadf -j -- -A' | svy
svy --host web01                      # 等价的简写
svy --host web01 /var/log/sysstat/sa05

# 从保存的文件查看 — 传入多天的文件，用 < / > 翻阅
sadf -j -- -A > today.json
sadf -j -1 -- -A > yesterday.json
svy today.json yesterday.json
```

### 跨天浏览

sar 每天保存一个数据文件。使用 `--host` 时，在已加载数据的边缘继续按
`<` / `>` 会按需拉取相邻日期（远程执行 `sadf -j -N -- -A`，因此不受各发行版
`saDD` 文件存放路径差异的影响）。使用本地文件时，传入的每个文件都是可以
翻阅的一天。

> **Windows 注意事项：** 使用管道（`… | svy`）时因为无法重新打开 `/dev/tty`，
> 键盘输入会被禁用。请改用文件参数或 `--host`。

## 快捷键

| 按键 | 动作 |
|---|---|
| `↑`/`↓` 或 `k`/`j` | 选择指标 |
| `←`/`→` 或 `h`/`l` | 移动时间光标（`H`/`L` 大步移动） |
| `Tab` / `[` `]` | 切换实例（CPU 核心、网卡、磁盘设备） |
| `<` / `>` 或 `,` `.` | 前一天 / 后一天 |
| `+` / `-` | 以光标为中心放大 / 缩小 |
| `0` | 重置缩放 |
| `g` / `G` | 跳到窗口开头 / 结尾 |
| `n` | 下一台主机（多主机 JSON 时） |
| `?` | 帮助 |
| `q` | 退出 |

## 工作原理

svy 唯一的输入契约是 **`sadf -j`**（sysstat 自带）输出的 JSON。它从不自行解析
二进制 `sa` 文件，因此不受 sysstat 版本和架构差异的影响——解析的责任留在
它本来的归属：sysstat 那边。

这个契约也划定了角色分工：sysstat 在服务器上**采集**，svy 在任何能运行
Node.js ≥ 18.18 的地方**查看**（Linux / macOS / Windows Terminal）。
你的笔记本不需要安装 sysstat。

输入中缺失的指标不会显示；多主机 JSON 也能正常工作，用 `n` 切换主机。

## 与同类工具对比

| | 交互性 | sar 历史数据 | 无文件残留 | 笔记本远程查看 |
|---|---|---|---|---|
| **svy** | TUI | ✓ | ✓ | ✓（ssh / `--host`） |
| `sar` 文本输出 | – | ✓ | ✓ | 经 ssh，仅表格 |
| `sadf -g`（SVG） | 静态图片 | ✓ | 生成文件 | 需来回拷贝文件 |
| kSar | Java GUI | ✓ | – | 需导出/X11 |
| atop -r | TUI | 仅自有格式 | ✓ | – |
| btop / htop | TUI | 仅实时 | ✓ | – |

## 安装

```sh
npm install -g @svy-tui/svy    # 安装后命令为 `svy`
```

从源码安装（需要 Node.js ≥ 18.18）：

```sh
git clone https://github.com/svy-tui/svy && cd svy
npm install && npm run build && npm link
svy --demo
```

## 开发

```sh
npm install
npm test        # vitest — 解析器、图表渲染、视口、UI 交互
npm run build   # tsc → dist/
node dist/cli.js --demo
```

图表渲染器是手写的盲文点阵画布（不依赖图表库），sadf JSON 解析器以声明式方式
吸收 sysstat 各版本间字段名的差异，所有导航逻辑都是带测试的纯函数。

## 许可证

[MIT](LICENSE)
