import type { HostData, Metric, Unit } from './model.js';

// sadf -j の1サンプル分。sysstat のバージョンでキーが揺れるため any で受けて
// MetricDef 側で存在するフィールドだけを拾う。
type RawStat = Record<string, any>;

// instance名 → channel名 → 値
type Extracted = Record<string, Record<string, number>>;

interface MetricDef {
  id: string;
  label: string;
  unit: Unit;
  channels: string[];
  extract(stat: RawStat): Extracted | undefined;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

const SINGLE = 'all';

const METRIC_DEFS: MetricDef[] = [
  {
    id: 'cpu',
    label: 'CPU',
    unit: '%',
    channels: ['user', 'system', 'iowait'],
    extract(stat) {
      const rows = stat['cpu-load'] ?? stat['cpu-load-all'];
      if (!Array.isArray(rows)) return undefined;
      const out: Extracted = {};
      for (const row of rows) {
        const id = String(row.cpu ?? '');
        const name = id === 'all' || id === '-1' ? 'all' : `cpu${id}`;
        out[name] = {
          user: num(row.user) ?? num(row.usr) ?? 0,
          system: num(row.system) ?? num(row.sys) ?? 0,
          iowait: num(row.iowait) ?? 0,
        };
      }
      return out;
    },
  },
  {
    id: 'memory',
    label: 'Memory',
    unit: '%',
    channels: ['used', 'commit', 'swap'],
    extract(stat) {
      const m = stat.memory;
      if (!m) return undefined;
      return {
        [SINGLE]: {
          used: num(m['memused-percent']) ?? 0,
          commit: num(m['commit-percent']) ?? 0,
          swap: num(m['swpused-percent']) ?? 0,
        },
      };
    },
  },
  {
    id: 'load',
    label: 'Load avg',
    unit: 'load',
    channels: ['1min', '5min', '15min', 'runq'],
    extract(stat) {
      const q = stat.queue;
      if (!q) return undefined;
      return {
        [SINGLE]: {
          '1min': num(q['ldavg-1']) ?? 0,
          '5min': num(q['ldavg-5']) ?? 0,
          '15min': num(q['ldavg-15']) ?? 0,
          runq: num(q['runq-sz']) ?? 0,
        },
      };
    },
  },
  {
    id: 'network',
    label: 'Network',
    unit: 'kB/s',
    channels: ['rx', 'tx'],
    extract(stat) {
      const rows = stat.network?.['net-dev'];
      if (!Array.isArray(rows)) return undefined;
      const out: Extracted = {};
      for (const row of rows) {
        if (!row.iface) continue;
        out[String(row.iface)] = {
          rx: num(row.rxkB) ?? 0,
          tx: num(row.txkB) ?? 0,
        };
      }
      return out;
    },
  },
  {
    id: 'disk',
    label: 'Disk I/O',
    unit: 'kB/s',
    channels: ['read', 'write'],
    extract(stat) {
      const rows = stat.disk;
      if (!Array.isArray(rows)) return undefined;
      const out: Extracted = {};
      for (const row of rows) {
        const dev = row['disk-device'];
        if (!dev) continue;
        // 旧sysstatはセクタ/秒(rd_sec/s)。1セクタ=512B=0.5kB で換算する。
        const rd = num(row['rkB/s']) ?? (num(row['rd_sec/s']) !== undefined ? row['rd_sec/s'] / 2 : 0);
        const wr = num(row['wkB/s']) ?? (num(row['wr_sec/s']) !== undefined ? row['wr_sec/s'] / 2 : 0);
        out[String(dev)] = { read: rd, write: wr };
      }
      return out;
    },
  },
  {
    id: 'diskutil',
    label: 'Disk util',
    unit: '%',
    channels: ['util'],
    extract(stat) {
      const rows = stat.disk;
      if (!Array.isArray(rows)) return undefined;
      const out: Extracted = {};
      for (const row of rows) {
        const dev = row['disk-device'];
        if (!dev) continue;
        out[String(dev)] = { util: num(row['util-percent']) ?? 0 };
      }
      return out;
    },
  },
  {
    id: 'io',
    label: 'IO tps',
    unit: '/s',
    channels: ['read', 'write'],
    extract(stat) {
      const io = stat.io;
      if (!io) return undefined;
      return {
        [SINGLE]: {
          read: num(io['io-reads']?.rtps) ?? 0,
          write: num(io['io-writes']?.wtps) ?? 0,
        },
      };
    },
  },
  {
    id: 'paging',
    label: 'Paging',
    unit: 'kB/s',
    channels: ['in', 'out'],
    extract(stat) {
      const p = stat.paging;
      if (!p) return undefined;
      return {
        [SINGLE]: {
          in: num(p.pgpgin) ?? 0,
          out: num(p.pgpgout) ?? 0,
        },
      };
    },
  },
];

function toEpoch(ts: RawStat['timestamp']): number {
  const iso = `${ts.date}T${ts.time}${ts.utc ? 'Z' : ''}`;
  return Date.parse(iso) / 1000;
}

function buildMetric(def: MetricDef, samples: (Extracted | undefined)[]): Metric | undefined {
  // 出現順を保ちつつ全サンプル横断でインスタンスを集める（途中参加のIF等に対応）
  const instanceNames: string[] = [];
  for (const s of samples) {
    if (!s) continue;
    for (const name of Object.keys(s)) {
      if (!instanceNames.includes(name)) instanceNames.push(name);
    }
  }
  if (instanceNames.length === 0) return undefined;

  return {
    id: def.id,
    label: def.label,
    unit: def.unit,
    instances: instanceNames.map((name) => ({
      name,
      channels: def.channels.map((ch) => ({
        name: ch,
        values: samples.map((s) => s?.[name]?.[ch] ?? null),
      })),
    })),
  };
}

export function parseSadfJson(text: string): HostData[] {
  let root: any;
  try {
    root = JSON.parse(text);
  } catch {
    throw new Error('input is not valid JSON (expected output of `sadf -j`)');
  }
  const rawHosts = root?.sysstat?.hosts;
  if (!Array.isArray(rawHosts) || rawHosts.length === 0) {
    throw new Error('input is not sadf JSON: missing sysstat.hosts (run `sadf -j -- -A`)');
  }

  return rawHosts.map((h: any): HostData => {
    const stats: RawStat[] = (h.statistics ?? []).filter((s: RawStat) => s?.timestamp);
    if (stats.length === 0) {
      throw new Error(`host "${h.nodename ?? '?'}" has no statistics entries`);
    }
    const metrics = METRIC_DEFS.map((def) =>
      buildMetric(def, stats.map((s) => def.extract(s))),
    ).filter((m): m is Metric => m !== undefined);

    return {
      nodename: String(h.nodename ?? 'unknown'),
      sysname: h.sysname,
      release: h.release,
      machine: h.machine,
      cpuCount: num(h['number-of-cpus']),
      fileDate: h['file-date'],
      timeLabels: stats.map((s) => String(s.timestamp.time)),
      epochs: stats.map((s) => toEpoch(s.timestamp)),
      metrics,
    };
  });
}
