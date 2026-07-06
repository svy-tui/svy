import { describe, expect, it } from 'vitest';
import { renderChart } from '../src/chart.js';

describe('renderChart', () => {
  it('フラットな0系列は最下段のドットだけになる', () => {
    const { lines } = renderChart([{ values: [0, 0, 0, 0] }], { width: 2, height: 1 });
    expect(lines).toEqual(['⣀⣀']);
  });

  it('単調増加の系列を対角線として描く', () => {
    const { lines } = renderChart([{ values: [0, 1, 2, 3] }], { width: 2, height: 1 });
    expect(lines).toEqual(['⣠⠞']);
  });

  it('nullは隙間になり、線は橋渡しされない', () => {
    const { lines } = renderChart([{ values: [0, null, null, 0] }], { width: 2, height: 1 });
    expect(lines).toEqual(['⡀⢀']);
  });

  it('行数=height、各行の表示幅=width になる', () => {
    const { lines } = renderChart([{ values: [0, 5, 2, 8, 3] }], { width: 10, height: 4 });
    expect(lines).toHaveLength(4);
    for (const line of lines) expect([...line]).toHaveLength(10);
  });

  it('スケールはデフォルトで0起点、maxはデータ最大', () => {
    const { min, max } = renderChart([{ values: [50, 100] }], { width: 4, height: 2 });
    expect(min).toBe(0);
    expect(max).toBe(100);
  });

  it('全て同値でもゼロ除算せず描ける', () => {
    const { lines, max } = renderChart([{ values: [0, 0] }], { width: 1, height: 1 });
    expect(max).toBeGreaterThan(0);
    expect(lines[0]).not.toBe(' ');
  });

  it('カーソル列は縦線に置き換わる', () => {
    const { lines } = renderChart([{ values: [0, 0, 0, 0] }], {
      width: 2,
      height: 1,
      cursorCol: 1,
    });
    expect(lines[0]).toBe('⣀│');
  });

  it('セルの色はドット数が多い系列が勝つ', () => {
    const paintA = (s: string) => `<A>${s}</A>`;
    const paintB = (s: string) => `<B>${s}</B>`;
    const { lines } = renderChart(
      [
        { values: [0, 0, 0, 0], paint: paintA },
        { values: [0, 0, 3, 3], paint: paintB },
      ],
      { width: 2, height: 1 },
    );
    // 左セルは同数タイ→先勝ちでA、右セルはBの縦線ドットが多いのでB
    expect(lines[0].indexOf('<A>')).toBeGreaterThanOrEqual(0);
    expect(lines[0].indexOf('<B>')).toBeGreaterThan(lines[0].indexOf('<A>'));
  });
});
