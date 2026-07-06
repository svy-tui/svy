<p align="center">
  <img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/logo.png" width="420" alt="svy — system viewer for sar">
</p>

<p align="center">
  <b>s</b>ystem <b>v</b>iewer for sar — interactive terminal charts for sysstat historical data.<br>
  Like btop, but for the past.
</p>

<p align="center">
  English | <a href="README.ja.md">日本語</a> | <a href="README.zh-CN.md">简体中文</a>
</p>

---

`sar` quietly collects a goldmine of performance history on every Linux server.
But *looking* at it means squinting at text tables, or generating SVG files with
`sadf -g` and shuffling them to your desktop. Every incident review starts with
the same chore.

**svy** turns that data into an interactive TUI: scrub through time, zoom into
an incident window, flip between days, and switch across CPU / memory / network
/ disk — right in the terminal where the data lives. No files generated, no GUI,
no agent to install on servers.

<p align="center"><img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/shot-cpu.png" width="880" alt="svy — CPU view with braille chart"></p>

*(actual `svy --demo` output in a 100×24 terminal)*

## Try it in 10 seconds (no sysstat required)

```sh
npx @svy-tui/svy --demo
```

The demo ships with multiple days of synthetic data — press `<` to travel back
in time; past days are synthesized on the fly.

> Not on npm yet? Install [from source](#install) and run `svy --demo`.

## Features

- **8 metric groups** — CPU (per-core), memory, load average, network (per NIC),
  disk I/O (per device), disk utilization, IO tps, paging
- **Time cursor & zoom** — scrub with `←`/`→`, zoom into an incident window with
  `+`, read exact values at the cursor
- **Day browsing** — flip through sar's daily files with `<`/`>`; with `--host`,
  adjacent days are fetched over ssh on demand
- **Instance switching** — cycle per-CPU cores, NICs, and disk devices with `Tab`
- **Remote-first** — view a server's history from your laptop; sysstat is only
  needed where the data was recorded
- **Zero artifacts** — reads JSON from a pipe, draws braille charts, writes
  nothing to disk

## Tour

**Network view** — two colored series (rx/tx) per interface, `Tab` switches NICs,
the y-axis scales units automatically:

<p align="center"><img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/shot-network.png" width="880" alt="svy — network view, rx/tx per interface"></p>

**Zoom into an incident** — `+` narrows the window around the cursor; the header
shows the zoomed range. That evening spike is suddenly obvious:

<p align="center"><img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/shot-zoom.png" width="880" alt="svy — zoomed into an evening traffic spike"></p>

**Help** — `?` shows every keybinding without leaving the app:

<p align="center"><img src="https://raw.githubusercontent.com/svy-tui/svy/main/assets/shot-help.png" width="880" alt="svy — keybindings help overlay"></p>

## Usage

```sh
# On a Linux server: today's data, all activities
sadf -j -- -A | svy

# A specific day
sadf -j /var/log/sysstat/sa05 -- -A | svy

# From your laptop (macOS/Windows), viewing a remote server
ssh web01 'sadf -j -- -A' | svy
svy --host web01                      # same thing, shorthand
svy --host web01 /var/log/sysstat/sa05

# From saved files — pass several days and flip through them with < / >
sadf -j -- -A > today.json
sadf -j -1 -- -A > yesterday.json
svy today.json yesterday.json
```

### Browsing across days

sar keeps one data file per day. With `--host`, pressing `<` / `>` past the
edge of the loaded data fetches the adjacent day on demand (running
`sadf -j -N -- -A` remotely, so it works regardless of where the distro stores
its `saDD` files). With local files, every file you pass becomes a day you can
flip through.

> **Windows note:** piping (`… | svy`) disables keyboard input because there is
> no `/dev/tty` to reopen. Use a file argument or `--host` instead.

## Keys

| Key | Action |
|---|---|
| `↑`/`↓` or `k`/`j` | select metric |
| `←`/`→` or `h`/`l` | move time cursor (`H`/`L` for big steps) |
| `Tab` / `[` `]` | switch instance (per-CPU, NIC, disk device) |
| `<` / `>` or `,` `.` | previous / next day |
| `+` / `-` | zoom in / out around the cursor |
| `0` | reset zoom |
| `g` / `G` | jump to window start / end |
| `n` | next host (multi-host JSON) |
| `?` | help |
| `q` | quit |

## How it works

svy's only input contract is the JSON emitted by **`sadf -j`** (part of
sysstat). It never parses binary `sa` files itself, which makes it immune to
sysstat version and architecture differences — the parsing burden stays with
sysstat, where it belongs.

That contract also defines the roles: sysstat **collects** on the server, svy
**views** anywhere Node.js ≥ 18.18 runs (Linux, macOS, Windows Terminal). Your
laptop never needs sysstat installed.

Metrics missing from the input are simply not shown; extra activities are
ignored. Multi-host JSON (e.g. concatenated from a fleet) works — cycle hosts
with `n`.

## Alternatives

| | interactive | historical sar data | file-less | remote from laptop |
|---|---|---|---|---|
| **svy** | TUI | ✓ | ✓ | ✓ (ssh / `--host`) |
| `sar` text output | – | ✓ | ✓ | via ssh, tables only |
| `sadf -g` (SVG) | static images | ✓ | generates files | copy files around |
| kSar | Java GUI | ✓ | – | needs export/X11 |
| atop -r | TUI | own log format only | ✓ | – |
| btop / htop | TUI | live only | ✓ | – |

## Install

```sh
npm install -g @svy-tui/svy    # installs the `svy` command
```

From source (requires Node.js ≥ 18.18):

```sh
git clone https://github.com/svy-tui/svy && cd svy
npm install && npm run build && npm link
svy --demo
```

## Development

```sh
npm install
npm test        # vitest — parser, chart renderer, viewport, UI interaction
npm run build   # tsc → dist/
node dist/cli.js --demo
```

The chart renderer is a hand-rolled braille canvas (no chart library), the
sadf JSON parser absorbs field-name differences between sysstat versions
declaratively, and all navigation logic is pure functions with tests.

## License

[MIT](LICENSE)
