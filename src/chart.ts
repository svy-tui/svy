// braille (2x4ドット/文字) キャンバスによるラインチャート描画。
// 色は関数注入なので端末・テストの両方で同じロジックが走る。

export interface SeriesSpec {
  values: (number | null)[];
  paint?: (s: string) => string;
}

export interface ChartOptions {
  width: number; // 文字数
  height: number; // 行数
  min?: number; // 省略時は0起点（sar系データは非負が前提）
  max?: number; // 省略時はデータ最大
  cursorCol?: number; // この文字列をカーソル縦線に置き換える
  cursorPaint?: (s: string) => string;
}

export interface ChartResult {
  lines: string[];
  min: number;
  max: number;
}

// DOT_BITS[列][行] = braille ドットのビット（U+2800 からのオフセット）
const DOT_BITS = [
  [0x01, 0x02, 0x04, 0x40],
  [0x08, 0x10, 0x20, 0x80],
];

// 値列をドット列数にバケット平均でリサンプルする（null は無視、全nullはnull）
function resample(values: (number | null)[], dotCols: number): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(dotCols).fill(null);
  for (let c = 0; c < dotCols; c++) {
    const lo = Math.floor((c * n) / dotCols);
    const hi = Math.max(lo + 1, Math.floor(((c + 1) * n) / dotCols));
    let sum = 0;
    let cnt = 0;
    for (let i = lo; i < hi && i < n; i++) {
      const v = values[i];
      if (v !== null && Number.isFinite(v)) {
        sum += v;
        cnt++;
      }
    }
    out[c] = cnt > 0 ? sum / cnt : null;
  }
  return out;
}

export function renderChart(series: SeriesSpec[], opts: ChartOptions): ChartResult {
  const { width, height } = opts;
  const dotCols = width * 2;
  const dotRows = height * 4;

  const resampled = series.map((s) => resample(s.values, dotCols));

  const min = opts.min ?? 0;
  let max = opts.max ?? -Infinity;
  if (opts.max === undefined) {
    for (const r of resampled) {
      for (const v of r) if (v !== null && v > max) max = v;
    }
  }
  if (!(max > min)) max = min + 1;

  // 系列ごとのドットグリッド。前の列との間を縦に埋めて線を繋ぐ。
  const grids = resampled.map((r) => {
    const grid = new Uint8Array(dotRows * dotCols);
    let prev: number | null = null;
    for (let c = 0; c < dotCols; c++) {
      const v = r[c];
      if (v === null) {
        prev = null;
        continue;
      }
      const t = Math.min(1, Math.max(0, (v - min) / (max - min)));
      const d = dotRows - 1 - Math.round(t * (dotRows - 1));
      const from = prev === null ? d : Math.min(prev, d);
      const to = prev === null ? d : Math.max(prev, d);
      for (let y = from; y <= to; y++) grid[y * dotCols + c] = 1;
      prev = d;
    }
    return grid;
  });

  const lines: string[] = [];
  for (let row = 0; row < height; row++) {
    let line = '';
    let runPaint: ((s: string) => string) | undefined;
    let run = '';
    const flush = () => {
      if (run) {
        line += runPaint ? runPaint(run) : run;
        run = '';
      }
    };
    for (let col = 0; col < width; col++) {
      if (opts.cursorCol === col) {
        flush();
        runPaint = undefined;
        line += opts.cursorPaint ? opts.cursorPaint('│') : '│';
        continue;
      }
      let bits = 0;
      let bestIdx = -1;
      let bestCount = 0;
      for (let si = 0; si < grids.length; si++) {
        let cnt = 0;
        for (let dc = 0; dc < 2; dc++) {
          for (let dr = 0; dr < 4; dr++) {
            if (grids[si][(row * 4 + dr) * dotCols + (col * 2 + dc)]) {
              bits |= DOT_BITS[dc][dr];
              cnt++;
            }
          }
        }
        if (cnt > bestCount) {
          bestCount = cnt;
          bestIdx = si;
        }
      }
      const ch = bits ? String.fromCharCode(0x2800 + bits) : ' ';
      const paint = bestIdx >= 0 ? series[bestIdx].paint : undefined;
      if (paint !== runPaint) {
        flush();
        runPaint = paint;
      }
      run += ch;
    }
    flush();
    lines.push(line);
  }
  return { lines, min, max };
}
