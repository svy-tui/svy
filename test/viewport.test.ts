import { describe, expect, it } from 'vitest';
import { initialView, moveCursor, resetZoom, zoomIn, zoomOut } from '../src/viewport.js';

const N = 100;

describe('viewport', () => {
  it('初期状態は全範囲・カーソル末尾', () => {
    expect(initialView(N)).toEqual({ start: 0, end: 99, cursor: 99 });
  });

  it('カーソル移動は範囲内にクランプされる', () => {
    const v = initialView(N);
    expect(moveCursor(v, 10, N).cursor).toBe(99);
    expect(moveCursor(v, -10, N).cursor).toBe(89);
    expect(moveCursor({ ...v, cursor: 0 }, -1, N).cursor).toBe(0);
  });

  it('ズームインはカーソル中心に窓を半分にする', () => {
    const v = zoomIn({ start: 0, end: 99, cursor: 50 }, N);
    expect(v.end - v.start + 1).toBe(50);
    expect(v.cursor).toBe(50);
    expect(v.start).toBeLessThanOrEqual(50);
    expect(v.end).toBeGreaterThanOrEqual(50);
  });

  it('端でズームインしても窓は範囲外に出ない', () => {
    const v = zoomIn({ start: 0, end: 99, cursor: 0 }, N);
    expect(v.start).toBe(0);
    expect(v.end - v.start + 1).toBe(50);
  });

  it('ズームは最小8サンプルで止まる', () => {
    let v = initialView(N);
    for (let i = 0; i < 20; i++) v = zoomIn(v, N);
    expect(v.end - v.start + 1).toBe(8);
  });

  it('ズーム中にカーソルが窓の外へ出ると窓がパンする', () => {
    const zoomed = { start: 40, end: 59, cursor: 40 };
    const v = moveCursor(zoomed, -5, N);
    expect(v.cursor).toBe(35);
    expect(v.start).toBe(35);
    expect(v.end - v.start).toBe(19);
  });

  it('ズームアウトで窓が倍になり全範囲でクランプ', () => {
    const v = zoomOut({ start: 40, end: 59, cursor: 50 }, N);
    expect(v.end - v.start + 1).toBe(40);
    expect(zoomOut(initialView(N), N)).toEqual(initialView(N));
  });

  it('リセットで全範囲に戻る（カーソル位置は維持）', () => {
    expect(resetZoom({ start: 40, end: 59, cursor: 45 }, N)).toEqual({
      start: 0,
      end: 99,
      cursor: 45,
    });
  });
});
