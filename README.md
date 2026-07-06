# svy

> **s**ystem **v**iewer for sar — interactive terminal charts for sysstat historical data. Like btop, but for the past.

`sar` collects a goldmine of historical performance data on every Linux server,
but looking at it means either squinting at text tables or generating SVG files
with `sadf -g` and shuffling them around. **svy** renders that data as
interactive braille charts right in your terminal: scrub through time, zoom into
an incident window, flip between days, and switch across CPU / memory / network
/ disk — no files generated, no GUI, works over ssh.

```
svy demo-host Linux 6.8.0-demo · x86_64 · 8 CPU · 2026-07-05 · 1440 samples
❯ CPU          CPU [%] — all (1/3)
  Memory          54.0%┤                                 ⣿ ⣀                                     │
  Load avg             │                                ⡤⠿⡄⡏⡇⢸⡇                                  │
  Network              │                                ⡇ ⠙⠃⠷⠋⡇    ⣀                             │
  Disk I/O             │                               ⡴⠃     ⠉⠓⠚⣇⢠⢿⣀⡟⡆                          │
  Disk util            │                              ⢰⠃         ⠈⣿ ⠈⠁⣇ ⢠⡄                       │
  IO tps               │                             ⢀⡏               ⠘⣆⡏⡇                       │
  Paging               │                            ⣤⢸                 ⠉ ⠓⡆                      │
                       │                           ⢀⡿⠞                    ⠉⠧⡄                    │
                  27.0%┤                           ⡞                        ⢹⣿⡀                  │
                       │                          ⡞⠁                        ⠘⠃⠷⡆                 │
                       │                        ⣠⠶⠇                            ⠹⠴⡆               │
                       │                      ⣀⣸⠁        ⣶⡀⣤ ⢀⡀                  ⢹ ⣤⣤            │
                       │                    ⢀⣠⠇       ⢀⣀⡏⠁⠓⠋⠓⠚⣇⣠⣄ ⢀⣠⣄⣰⡆ ⢀⡀       ⠈⠙⠛⢻            │
                       │                ⣶⣶⢠⠿⠞      ⢀⡀⢠⣼       ⠉⠉⠈⠉⠛ ⠉ ⠳⣄⡏⣷⡆⣀        ⠘⠋⠳⣄⣀        │
                       │             ⣀⣠⠤⠟⠋⠉       ⣀⡼⠹⠞                    ⠙⠛⢦⡤⠤⡄        ⠘⠛⣦⣄⣶    │
                       │⣀⣸⢧⣀⣤⣠⠤⠤⠤⠤⠖⠶⠋⠁        ⣀⡤⠴⠋⠁                            ⠳⠟⢦⣀⣀⣤       ⠈⠛⠹⠞⠳│
                       │ ⢀⡈⠁       ⣀⣀⣀⣠⣄⡶⠿⠴⠻⠞⠉⠁                                     ⠈⠉⠙⠲⠤⠤⣤⣤⢤⣀⣀⢀⣀│
                   0.0%┤⠭⠭⠭⠽⠯⠭⠭⠭⠭⠭⠭⠷⠤⠤⠤⠤⠤⠤⠤⢤⡤⠤⠤⠤⠤⠤⠤⠤⠤⠤⠤⠤⠤⠤⠤⠴⠲⠶⠤⠤⠤⠤⠤⠤⠤⠤⣤⠼⠧⠤⠤⢤⡶⠤⣤⠤⠤⠤⠤⠤⠤⠤⠼⢧⡤⠤⠤⠤⠶⠭⠬⠭⢿│
                       └00:00                                                            ┴23:59:00
                        ● user 7.1%  ● system 2.2%  ● iowait 1.1%  ┃ 23:59:00
↑↓ metric · ←→ cursor · Tab inst · <> day · +/- zoom · 0 reset · ? help · q quit
```

*(actual terminal output of `svy --demo`, 100×24 — charts are colored in a real terminal)*

## Try it in 10 seconds (no sysstat required)

```sh
npx @svy-tui/svy --demo
```

> Not on npm yet? Install [from source](#install) and run `svy --demo`.

## Usage

The input contract is the JSON emitted by `sadf -j` (part of sysstat). svy
never parses binary `sa` files itself, so it is immune to sysstat version and
architecture differences.

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

sysstat is only needed on the machine that *produced* the data. svy itself
runs anywhere Node.js ≥ 18.18 runs (Linux, macOS, Windows Terminal).

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

## Metrics

CPU (user/system/iowait, per-CPU) · Memory (%used/%commit/%swap) · Load average
(+ run queue) · Network (rx/tx per interface) · Disk I/O (read/write per device)
· Disk utilization · IO tps · Paging. Metrics missing from the input are simply
not shown.

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
npm test        # vitest
npm run build   # tsc → dist/
node dist/cli.js --demo
```

## License

[MIT](LICENSE)
