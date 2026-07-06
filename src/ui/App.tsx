import chalk from 'chalk';
import { Box, Text, useApp, useInput, useStdin, useStdout } from 'ink';
import { useEffect, useState } from 'react';
import { renderChart } from '../chart.js';
import { fromHosts, insertHosts, UNKNOWN_DATE, type DatasetStore } from '../datasets.js';
import { addDays } from '../dates.js';
import { fmtTime, fmtValue } from '../format.js';
import type { HostData, Metric } from '../model.js';
import { initialView, moveCursor, resetZoom, zoomIn, zoomOut, type View } from '../viewport.js';

const SIDEBAR_W = 14;
const YLABEL_W = 9;
// 凡例マーカー用の色名と chalk 関数は同じ並びにしておく（yellow はカーソル専用）
const PALETTE_NAMES = ['cyan', 'magenta', 'green', 'blue'] as const;
const PALETTE = [chalk.cyan, chalk.magenta, chalk.green, chalk.blue];

function useTermSize() {
  const { stdout } = useStdout();
  const read = () => ({ cols: stdout?.columns ?? 80, rows: stdout?.rows ?? 24 });
  const [size, setSize] = useState(read);
  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setSize(read());
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);
  return size;
}

function overlay(base: string[], pos: number, text: string): void {
  for (let i = 0; i < text.length && pos + i < base.length; i++) {
    if (pos + i >= 0) base[pos + i] = text[i];
  }
}

interface PanelProps {
  metric: Metric;
  instanceIdx: number;
  view: View;
  timeLabels: string[];
  width: number;
  height: number;
}

function ChartPanel({ metric, instanceIdx, view, timeLabels, width, height }: PanelProps) {
  const instance = metric.instances[Math.min(instanceIdx, metric.instances.length - 1)];
  const span = Math.max(1, view.end - view.start);
  const cursorCol = Math.round(((view.cursor - view.start) / span) * (width - 1));

  const { lines, min, max } = renderChart(
    instance.channels.map((ch, i) => ({
      values: ch.values.slice(view.start, view.end + 1),
      paint: PALETTE[i % PALETTE.length],
    })),
    { width, height, cursorCol, cursorPaint: chalk.yellow },
  );

  const yLabel = (v: number) => fmtValue(v, metric.unit).padStart(YLABEL_W - 1);
  const gutter = ' '.repeat(YLABEL_W - 1);
  const mid = Math.floor((height - 1) / 2);
  const rows = lines.map((line, r) => {
    const label =
      r === 0 ? yLabel(max) : r === height - 1 ? yLabel(min) : r === mid ? yLabel((max + min) / 2) : gutter;
    const sep = r === 0 || r === height - 1 || r === mid ? '┤' : '│';
    return chalk.dim(label + sep) + line;
  });

  const axis = new Array<string>(width).fill(' ');
  overlay(axis, 0, fmtTime(timeLabels[view.start]));
  const endLabel = fmtTime(timeLabels[view.end]);
  overlay(axis, width - endLabel.length, endLabel);
  const curLabel = `┴${timeLabels[view.cursor]}`;
  overlay(axis, Math.min(cursorCol, width - curLabel.length), curLabel);

  const instanceInfo =
    metric.instances.length > 1 ? ` — ${instance.name} (${instanceIdx + 1}/${metric.instances.length})` : '';

  return (
    <Box flexDirection="column">
      <Text bold>
        {metric.label} [{metric.unit}]{instanceInfo}
      </Text>
      {rows.map((row, i) => (
        <Text key={i}>{row}</Text>
      ))}
      <Text dimColor>{gutter + '└' + axis.join('')}</Text>
      <Box>
        <Text>{gutter} </Text>
        {instance.channels.map((ch, i) => (
          <Text key={ch.name} color={PALETTE_NAMES[i % PALETTE_NAMES.length]}>
            {'● '}
            {ch.name} {fmtValue(ch.values[view.cursor], metric.unit)}
            {'  '}
          </Text>
        ))}
        <Text color="yellow">┃ {timeLabels[view.cursor]}</Text>
      </Box>
    </Box>
  );
}

const KEYBINDINGS: [string, string][] = [
  ['↑/↓  k/j', 'select metric'],
  ['←/→  h/l', 'move time cursor'],
  ['H/L', 'move cursor fast'],
  ['Tab  [ ]', 'switch instance (CPU/NIC/disk)'],
  ['< / >  , .', 'previous / next day'],
  ['+ / -', 'zoom in / out around cursor'],
  ['0', 'reset zoom'],
  ['g / G', 'jump to window start / end'],
  ['n', 'next host (multi-host JSON)'],
  ['?', 'toggle this help'],
  ['q', 'quit'],
];

function HelpOverlay() {
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text bold>Keybindings</Text>
      {KEYBINDINGS.map(([keys, desc]) => (
        <Text key={keys}>
          <Text color="cyan">{keys.padEnd(12)}</Text> {desc}
        </Text>
      ))}
    </Box>
  );
}

export interface AppProps {
  hosts: HostData[];
  /** 端の日付を越えて移動しようとしたとき、その日のデータを取得する（--host等） */
  loadDate?: (date: string) => Promise<HostData[]>;
}

export function App({ hosts: initialHosts, loadDate }: AppProps) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const { cols, rows } = useTermSize();

  const [store, setStore] = useState<DatasetStore>(() => fromHosts(initialHosts));
  const [currentDate, setCurrentDate] = useState(() => store.dates[store.dates.length - 1]);
  const [hostIdx, setHostIdx] = useState(0);
  const [metricIdx, setMetricIdx] = useState(0);
  const [instanceSel, setInstanceSel] = useState<Record<string, number>>({});
  const [help, setHelp] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dates = store.dates;
  const dateIdx = Math.max(0, dates.indexOf(currentDate));
  const hostsForDate = store.byDate[dates[dateIdx]] ?? initialHosts;
  const host = hostsForDate[Math.min(hostIdx, hostsForDate.length - 1)];
  const n = host.timeLabels.length;

  const [view, setView] = useState<View>(() => initialView(n));
  // 日付・ホストが変わるとサンプル数も変わるのでビューを初期化する
  useEffect(() => {
    setView(initialView(n));
  }, [host]);

  const metric = host.metrics[Math.min(metricIdx, host.metrics.length - 1)];
  const instanceIdx = Math.min(instanceSel[metric.id] ?? 0, metric.instances.length - 1);
  const winSize = view.end - view.start + 1;
  const bigStep = Math.max(1, Math.round(winSize / 10));

  const cycleInstance = (dir: number) => {
    const count = metric.instances.length;
    if (count < 2) return;
    setInstanceSel((sel) => ({ ...sel, [metric.id]: (instanceIdx + dir + count) % count }));
  };

  const gotoDate = (dir: -1 | 1) => {
    const target = dateIdx + dir;
    if (target >= 0 && target < dates.length) {
      setCurrentDate(dates[target]);
      return;
    }
    if (!loadDate) {
      if (dates.length === 1) {
        setNotice('one day loaded — pass multiple files or use --host to browse days');
      }
      return;
    }
    if (loading) return;
    const cur = dates[dateIdx];
    const targetDate = cur === UNKNOWN_DATE ? undefined : addDays(cur, dir);
    if (!targetDate) {
      setNotice('cannot compute adjacent date (input has no file-date)');
      return;
    }
    setLoading(targetDate);
    loadDate(targetDate)
      .then((newHosts) => {
        setStore((s) => insertHosts(s, newHosts));
        setCurrentDate(newHosts[0]?.fileDate ?? targetDate);
      })
      .catch((e) => setNotice(`${targetDate}: ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => setLoading(null));
  };

  // 高速連打時は Ink が複数キーを1チャンク（例: "jjj"）で渡すため1文字ずつ処理する
  useInput(
    (chunk, key) => {
      for (const input of chunk.length > 1 ? [...chunk] : [chunk]) handleKey(input, key);
    },
    { isActive: isRawModeSupported },
  );

  function handleKey(input: string, key: Parameters<Parameters<typeof useInput>[0]>[1]) {
    if (notice) setNotice(null);
    if (input === 'q') return exit();
    if (input === '?') return setHelp((h) => !h);
    if (key.downArrow || input === 'j') return setMetricIdx((i) => Math.min(host.metrics.length - 1, i + 1));
    if (key.upArrow || input === 'k') return setMetricIdx((i) => Math.max(0, i - 1));
    if (key.leftArrow || input === 'h') return setView((v) => moveCursor(v, key.shift ? -bigStep : -1, n));
    if (key.rightArrow || input === 'l') return setView((v) => moveCursor(v, key.shift ? bigStep : 1, n));
    if (input === 'H') return setView((v) => moveCursor(v, -bigStep, n));
    if (input === 'L') return setView((v) => moveCursor(v, bigStep, n));
    if ((key.tab && !key.shift) || input === ']') return cycleInstance(1);
    if ((key.tab && key.shift) || input === '[') return cycleInstance(-1);
    if (input === ',' || input === '<') return gotoDate(-1);
    if (input === '.' || input === '>') return gotoDate(1);
    if (input === '+' || input === '=') return setView((v) => zoomIn(v, n));
    if (input === '-') return setView((v) => zoomOut(v, n));
    if (input === '0') return setView((v) => resetZoom(v, n));
    if (input === 'g') return setView((v) => ({ ...v, cursor: v.start }));
    if (input === 'G') return setView((v) => ({ ...v, cursor: v.end }));
    if (input === 'n' && hostsForDate.length > 1) {
      setHostIdx((i) => (i + 1) % hostsForDate.length);
    }
  }

  const chartW = Math.max(10, cols - SIDEBAR_W - YLABEL_W - 3);
  const chartH = Math.max(4, rows - 6);
  const zoomed = winSize < n;

  const hostInfo = [
    host.sysname && host.release ? `${host.sysname} ${host.release}` : host.sysname,
    host.machine,
    host.cpuCount !== undefined ? `${host.cpuCount} CPU` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  const dateInfo =
    dates[dateIdx] === UNKNOWN_DATE
      ? undefined
      : `${dates[dateIdx]}${dates.length > 1 || loadDate ? ` (${dateIdx + 1}/${dates.length})` : ''}`;

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">
          sadf-view{' '}
        </Text>
        <Text bold>{host.nodename}</Text>
        {hostsForDate.length > 1 && (
          <Text dimColor>
            {' '}
            ({hostIdx + 1}/{hostsForDate.length})
          </Text>
        )}
        <Text dimColor>
          {' '}
          {[hostInfo, dateInfo, `${n} samples`].filter(Boolean).join(' · ')}
          {zoomed ? ` · zoom ${fmtTime(host.timeLabels[view.start])}–${fmtTime(host.timeLabels[view.end])}` : ''}
        </Text>
      </Box>
      <Box>
        <Box width={SIDEBAR_W} flexDirection="column" marginRight={1}>
          {host.metrics.map((m, i) => (
            <Text key={m.id} color={i === metricIdx ? 'cyan' : undefined} bold={i === metricIdx} dimColor={i !== metricIdx}>
              {i === metricIdx ? '❯ ' : '  '}
              {m.label}
            </Text>
          ))}
        </Box>
        {help ? (
          <HelpOverlay />
        ) : (
          <ChartPanel
            metric={metric}
            instanceIdx={instanceIdx}
            view={view}
            timeLabels={host.timeLabels}
            width={chartW}
            height={chartH}
          />
        )}
      </Box>
      {loading ? (
        <Text color="yellow">⏳ loading {loading}…</Text>
      ) : notice ? (
        <Text color="yellow">{notice}</Text>
      ) : (
        <Text dimColor>↑↓ metric · ←→ cursor · Tab inst · &lt;&gt; day · +/- zoom · 0 reset · ? help · q quit</Text>
      )}
    </Box>
  );
}
