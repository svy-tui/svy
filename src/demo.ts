// sadf -j と同じ形状の合成 JSON を生成する。
// sysstat が無い環境（macOS/Windows）でも即座に試せるようにするためのもの。
// シード固定の PRNG で毎回同じデータになる（テスト・GIF撮影の再現性のため）。

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pad = (n: number) => String(n).padStart(2, '0');

// 中心 mu・幅 sigma のガウス山（0..1 の1日周期に対して）
const bump = (frac: number, mu: number, sigma: number) =>
  Math.exp(-((frac - mu) ** 2) / (2 * sigma ** 2));

export function generateDemoJson(samples = 1440, intervalSec = 60): string {
  const rnd = mulberry32(42);
  const date = '2026-07-05';
  const statistics: unknown[] = [];
  let load1 = 0.3;
  let load5 = 0.3;
  let load15 = 0.3;

  for (let i = 0; i < samples; i++) {
    const sec = i * intervalSec;
    const time = `${pad(Math.floor(sec / 3600) % 24)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
    const frac = (sec % 86400) / 86400;

    // CPU: 日中に山、まれにスパイク
    const daily = 6 + 38 * bump(frac, 0.55, 0.16) + 12 * bump(frac, 0.45, 0.04);
    const spike = rnd() < 0.015 ? 35 * rnd() : 0;
    const user = clamp(daily * (0.75 + 0.5 * rnd()) + spike, 0.2, 92);
    const system = clamp(user * 0.35 * (0.7 + 0.6 * rnd()), 0.1, 40);
    const iowait = clamp(1.2 * rnd() + (rnd() < 0.01 ? 18 * rnd() : 0), 0, 30);
    const idle = Math.max(0, 100 - user - system - iowait);
    const cpuRow = (mult: number) => {
      const u = clamp(user * mult, 0, 95);
      const s = clamp(system * mult, 0, 40);
      return { user: r2(u), nice: 0, system: r2(s), iowait: r2(iowait), steal: 0, idle: r2(Math.max(0, 100 - u - s - iowait)) };
    };

    // Load: CPU busy に追従する EMA
    const target = ((user + system) / 100) * 8 * (0.8 + 0.4 * rnd());
    load1 += (target - load1) * 0.3;
    load5 += (load1 - load5) * 0.1;
    load15 += (load5 - load15) * 0.03;

    // メモリ: じわじわ増えて時々解放される
    const leak = 38 + 24 * frac + 4 * Math.sin(frac * Math.PI * 6);
    const gcDip = i % 210 < 4 ? 9 : 0;
    const memUsed = clamp(leak - gcDip + 2 * rnd(), 10, 95);

    // ネットワーク: 業務時間帯に増える + バーストあり
    const rxBase = 80 + 2800 * bump(frac, 0.5, 0.18) * (0.6 + 0.8 * rnd());
    const rxBurst = rnd() < 0.02 ? 20000 * rnd() : 0;
    const rx = rxBase + rxBurst;

    // ディスク: 定期バッチで書き込みバースト
    const batch = i % 240 < 8 ? 6000 * (0.5 + rnd()) : 0;
    const sdaW = 40 + 200 * rnd() + batch;
    const sdaR = 25 + 150 * rnd() + (rnd() < 0.03 ? 3000 * rnd() : 0);
    const nvmeR = 100 + 800 * bump(frac, 0.55, 0.2) * rnd();
    const nvmeW = 60 + 300 * rnd();

    statistics.push({
      timestamp: { date, time, utc: 1, interval: intervalSec },
      'cpu-load': [
        { cpu: 'all', ...cpuRow(1) },
        { cpu: '0', ...cpuRow(1.15) },
        { cpu: '1', ...cpuRow(0.85) },
      ],
      io: {
        tps: r2((sdaR + sdaW + nvmeR + nvmeW) / 64),
        'io-reads': { rtps: r2((sdaR + nvmeR) / 32), bread: r2((sdaR + nvmeR) * 2) },
        'io-writes': { wtps: r2((sdaW + nvmeW) / 32), bwrtn: r2((sdaW + nvmeW) * 2) },
      },
      memory: {
        'memused-percent': r2(memUsed),
        'commit-percent': r2(clamp(memUsed * 1.3, 0, 160)),
        'swpused-percent': r2(clamp(2 + (memUsed > 60 ? (memUsed - 60) * 0.5 : 0), 0, 40)),
      },
      paging: {
        pgpgin: r2(sdaR * 0.8),
        pgpgout: r2(sdaW * 0.8),
        fault: r2(200 + 400 * rnd()),
        majflt: r2(rnd() < 0.05 ? 5 * rnd() : 0.1),
      },
      queue: {
        'runq-sz': Math.round(load1 * (0.5 + rnd())),
        'plist-sz': 200 + Math.round(30 * rnd()),
        'ldavg-1': r2(load1),
        'ldavg-5': r2(load5),
        'ldavg-15': r2(load15),
        blocked: rnd() < 0.05 ? 1 : 0,
      },
      disk: [
        { 'disk-device': 'sda', tps: r2((sdaR + sdaW) / 40), 'rkB/s': r2(sdaR), 'wkB/s': r2(sdaW), 'util-percent': r2(clamp((sdaR + sdaW) / 90, 0, 100)) },
        { 'disk-device': 'nvme0n1', tps: r2((nvmeR + nvmeW) / 40), 'rkB/s': r2(nvmeR), 'wkB/s': r2(nvmeW), 'util-percent': r2(clamp((nvmeR + nvmeW) / 250, 0, 100)) },
      ],
      network: {
        'net-dev': [
          { iface: 'eth0', rxkB: r2(rx), txkB: r2(rx * 0.35), 'ifutil-percent': r2(clamp(rx / 1250, 0, 100)) },
          { iface: 'eth1', rxkB: r2(3 + 12 * rnd()), txkB: r2(2 + 8 * rnd()), 'ifutil-percent': 0 },
        ],
      },
    });
  }

  return JSON.stringify({
    sysstat: {
      hosts: [
        {
          nodename: 'demo-host',
          sysname: 'Linux',
          release: '6.8.0-demo',
          machine: 'x86_64',
          'number-of-cpus': 8,
          'file-date': date,
          'file-utc-time': '00:00:00',
          timezone: 'UTC',
          statistics,
        },
      ],
    },
  });
}
