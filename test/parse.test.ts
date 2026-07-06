import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSadfJson } from '../src/parse.js';

const fixture = readFileSync(join(import.meta.dirname, 'fixtures/sample.json'), 'utf8');

describe('parseSadfJson', () => {
  const hosts = parseSadfJson(fixture);
  const host = hosts[0];

  it('ホストのメタデータを取り出す', () => {
    expect(hosts).toHaveLength(1);
    expect(host.nodename).toBe('web01');
    expect(host.sysname).toBe('Linux');
    expect(host.release).toBe('6.8.0-45-generic');
    expect(host.machine).toBe('x86_64');
    expect(host.cpuCount).toBe(2);
    expect(host.fileDate).toBe('2026-07-05');
  });

  it('タイムスタンプをラベルとepoch秒に変換する', () => {
    expect(host.timeLabels).toEqual(['00:10:00', '00:20:00', '00:30:00']);
    expect(host.epochs[0]).toBe(Date.UTC(2026, 6, 5, 0, 10, 0) / 1000);
    expect(host.epochs[2] - host.epochs[1]).toBe(600);
  });

  it('CPUメトリクスを all + per-CPU のインスタンスで組み立てる', () => {
    const cpu = host.metrics.find((m) => m.id === 'cpu')!;
    expect(cpu.unit).toBe('%');
    expect(cpu.instances.map((i) => i.name)).toEqual(['all', 'cpu0', 'cpu1']);
    const all = cpu.instances[0];
    expect(all.channels.map((c) => c.name)).toEqual(['user', 'system', 'iowait']);
    expect(all.channels[0].values).toEqual([10.0, 20.0, 30.0]);
    expect(all.channels[1].values).toEqual([5.0, 10.0, 15.0]);
  });

  it('メモリメトリクスは used/commit/swap の%チャネルを持つ', () => {
    const mem = host.metrics.find((m) => m.id === 'memory')!;
    expect(mem.unit).toBe('%');
    expect(mem.instances).toHaveLength(1);
    const ch = mem.instances[0].channels;
    expect(ch.map((c) => c.name)).toEqual(['used', 'commit', 'swap']);
    expect(ch[0].values).toEqual([62.5, 65.0, 67.5]);
    expect(ch[2].values).toEqual([10.0, 12.0, 14.0]);
  });

  it('ロードアベレージと実行キューを1つのメトリクスにまとめる', () => {
    const load = host.metrics.find((m) => m.id === 'load')!;
    const ch = load.instances[0].channels;
    expect(ch.map((c) => c.name)).toEqual(['1min', '5min', '15min', 'runq']);
    expect(ch[0].values).toEqual([0.5, 0.8, 1.2]);
    expect(ch[3].values).toEqual([1, 2, 3]);
  });

  it('ネットワークはインスタンス=IF、途中から現れたIFは先頭をnull埋めする', () => {
    const net = host.metrics.find((m) => m.id === 'network')!;
    expect(net.unit).toBe('kB/s');
    expect(net.instances.map((i) => i.name)).toEqual(['eth0', 'eth1']);
    const eth0 = net.instances[0];
    expect(eth0.channels.map((c) => c.name)).toEqual(['rx', 'tx']);
    expect(eth0.channels[0].values).toEqual([512.0, 640.0, 768.0]);
    const eth1 = net.instances[1];
    expect(eth1.channels[0].values).toEqual([null, null, 32.0]);
  });

  it('ディスクI/Oは欠けたサンプルをnullにする', () => {
    const disk = host.metrics.find((m) => m.id === 'disk')!;
    const sda = disk.instances[0];
    expect(sda.name).toBe('sda');
    expect(sda.channels.map((c) => c.name)).toEqual(['read', 'write']);
    expect(sda.channels[0].values).toEqual([100.0, null, 300.0]);
  });

  it('ディスクutil%を独立メトリクスとして持つ', () => {
    const util = host.metrics.find((m) => m.id === 'diskutil')!;
    expect(util.unit).toBe('%');
    expect(util.instances[0].channels[0].values).toEqual([3.5, null, 9.5]);
  });

  it('IO tps と Paging を持つ', () => {
    const io = host.metrics.find((m) => m.id === 'io')!;
    expect(io.instances[0].channels.map((c) => c.name)).toEqual(['read', 'write']);
    expect(io.instances[0].channels[0].values).toEqual([4.0, 8.0, 12.0]);
    const paging = host.metrics.find((m) => m.id === 'paging')!;
    expect(paging.instances[0].channels[0].values).toEqual([50.0, 60.0, 70.0]);
  });

  it('statisticsが空ならエラーにする', () => {
    const empty = JSON.stringify({ sysstat: { hosts: [{ nodename: 'x', statistics: [] }] } });
    expect(() => parseSadfJson(empty)).toThrow(/no statistics/i);
  });

  it('sadf形式でないJSONはエラーにする', () => {
    expect(() => parseSadfJson('{"foo": 1}')).toThrow(/not sadf/i);
  });
});
