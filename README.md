# sadf-view

> Interactive terminal viewer for sysstat / sar historical data — like btop, but for the past.

`sar` collects a goldmine of historical performance data on every Linux server,
but looking at it means either squinting at text tables or generating SVG files
with `sadf -g` and shuffling them around. **sadf-view** renders that data as
interactive braille charts right in your terminal: scrub through time, zoom into
an incident window, and flip between CPU / memory / network / disk — no files
generated, no GUI, works over ssh.

```
sadf-view demo-host Linux 6.8.0-demo · x86_64 · 8 CPU · 2026-07-05 · 1440 samples
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
↑↓ metric · ←→ cursor · Tab instance · +/- zoom · 0 reset · ? help · q quit
```

*(actual terminal output of `sadf-view --demo`, 100×24 — charts are colored in a real terminal)*

## Try it in 10 seconds (no sysstat required)

```sh
npx sadf-view --demo
```

> Not on npm yet? Install [from source](#install) and run `sadf-view --demo`.

## Usage

The input contract is the JSON emitted by `sadf -j` (part of sysstat). sadf-view
never parses binary `sa` files itself, so it is immune to sysstat version and
architecture differences.

```sh
# On a Linux server: today's data, all activities
sadf -j -- -A | sadf-view

# A specific day
sadf -j /var/log/sysstat/sa05 -- -A | sadf-view

# From your laptop (macOS/Windows), viewing a remote server
ssh web01 'sadf -j -- -A' | sadf-view
sadf-view --host web01                      # same thing, shorthand
sadf-view --host web01 /var/log/sysstat/sa05

# From a saved file
sadf -j -- -A > snapshot.json
sadf-view snapshot.json
```

sysstat is only needed on the machine that *produced* the data. sadf-view
itself runs anywhere Node.js ≥ 18.18 runs (Linux, macOS, Windows Terminal).

> **Windows note:** piping (`… | sadf-view`) disables keyboard input because
> there is no `/dev/tty` to reopen. Use a file argument or `--host` instead.

## Keys

| Key | Action |
|---|---|
| `↑`/`↓` or `k`/`j` | select metric |
| `←`/`→` or `h`/`l` | move time cursor (`H`/`L` for big steps) |
| `Tab` / `[` `]` | switch instance (per-CPU, NIC, disk device) |
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
npm install -g sadf-view
```

From source (requires Node.js ≥ 18.18):

```sh
git clone <this repo> && cd sadf-view
npm install && npm run build && npm link
sadf-view --demo
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
