import { describe, expect, it } from 'vitest';
import { fmtTime, fmtValue } from '../src/format.js';

describe('fmtValue', () => {
  it('パーセントは小数1桁', () => {
    expect(fmtValue(12.34, '%')).toBe('12.3%');
    expect(fmtValue(0, '%')).toBe('0.0%');
  });

  it('kB/sは単位を自動で繰り上げる', () => {
    expect(fmtValue(512, 'kB/s')).toBe('512 kB/s');
    expect(fmtValue(2048, 'kB/s')).toBe('2.0 MB/s');
    expect(fmtValue(3 * 1024 * 1024, 'kB/s')).toBe('3.0 GB/s');
  });

  it('loadは小数2桁', () => {
    expect(fmtValue(0.5, 'load')).toBe('0.50');
  });

  it('毎秒カウントは小数1桁+/s', () => {
    expect(fmtValue(12, '/s')).toBe('12.0/s');
  });

  it('nullは em dash', () => {
    expect(fmtValue(null, '%')).toBe('—');
  });
});

describe('fmtTime', () => {
  it('秒を落としてHH:MMにする', () => {
    expect(fmtTime('00:10:00')).toBe('00:10');
    expect(fmtTime('23:59')).toBe('23:59');
  });
});
