import { describe, expect, it } from 'vitest';
import { generateDemoJson } from '../src/demo.js';
import { parseSadfJson } from '../src/parse.js';

describe('generateDemoJson', () => {
  it('パーサでそのまま読める sadf 形状の JSON を生成する', () => {
    const hosts = parseSadfJson(generateDemoJson());
    expect(hosts).toHaveLength(1);
    const host = hosts[0];
    expect(host.nodename).toBe('demo-host');
    expect(host.timeLabels).toHaveLength(1440);
    expect(host.timeLabels[0]).toBe('00:00:00');
    expect(host.timeLabels[1439]).toBe('23:59:00');
  });

  it('主要メトリクスとインスタンスが揃っている', () => {
    const host = parseSadfJson(generateDemoJson())[0];
    const ids = host.metrics.map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining(['cpu', 'memory', 'load', 'network', 'disk', 'diskutil', 'io', 'paging']),
    );
    const cpu = host.metrics.find((m) => m.id === 'cpu')!;
    expect(cpu.instances.map((i) => i.name)).toEqual(['all', 'cpu0', 'cpu1']);
    const net = host.metrics.find((m) => m.id === 'network')!;
    expect(net.instances.map((i) => i.name)).toEqual(['eth0', 'eth1']);
    const cpuAll = cpu.instances[0].channels[0].values;
    expect(cpuAll.every((v) => v !== null && v >= 0 && v <= 100)).toBe(true);
  });

  it('シード固定で決定的に生成される', () => {
    expect(generateDemoJson(100)).toBe(generateDemoJson(100));
  });

  it('サンプル数を指定できる', () => {
    const host = parseSadfJson(generateDemoJson(60))[0];
    expect(host.timeLabels).toHaveLength(60);
  });
});
