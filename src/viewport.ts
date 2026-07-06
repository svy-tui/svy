// タイムカーソルとズーム窓の操作。すべて純粋関数。
// インデックスは statistics 配列に対する 0 始まりで start/end は両端含む。

export interface View {
  start: number;
  end: number;
  cursor: number;
}

const MIN_WINDOW = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function initialView(n: number): View {
  const last = Math.max(0, n - 1);
  return { start: 0, end: last, cursor: last };
}

export function moveCursor(view: View, delta: number, n: number): View {
  const cursor = clamp(view.cursor + delta, 0, n - 1);
  const size = view.end - view.start + 1;
  let { start, end } = view;
  if (cursor < start) {
    start = cursor;
    end = start + size - 1;
  } else if (cursor > end) {
    end = cursor;
    start = end - size + 1;
  }
  return { start, end, cursor };
}

function windowAround(cursor: number, size: number, n: number): View {
  const sz = clamp(size, Math.min(MIN_WINDOW, n), n);
  let start = cursor - Math.floor(sz / 2);
  let end = start + sz - 1;
  if (start < 0) {
    start = 0;
    end = sz - 1;
  }
  if (end > n - 1) {
    end = n - 1;
    start = end - sz + 1;
  }
  return { start, end, cursor };
}

export function zoomIn(view: View, n: number): View {
  const size = view.end - view.start + 1;
  return windowAround(view.cursor, Math.ceil(size / 2), n);
}

export function zoomOut(view: View, n: number): View {
  const size = view.end - view.start + 1;
  return windowAround(view.cursor, size * 2, n);
}

export function resetZoom(view: View, n: number): View {
  return { start: 0, end: Math.max(0, n - 1), cursor: view.cursor };
}
