import type { Unit } from './model.js';

function fmtKilo(kb: number, suffix: string): string {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GB${suffix}`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB${suffix}`;
  return `${Math.round(kb)} kB${suffix}`;
}

export function fmtValue(v: number | null, unit: Unit): string {
  if (v === null || !Number.isFinite(v)) return '—';
  switch (unit) {
    case '%':
      return `${v.toFixed(1)}%`;
    case 'load':
      return v.toFixed(2);
    case '/s':
      return `${v.toFixed(1)}/s`;
    case 'kB':
      return fmtKilo(v, '');
    case 'kB/s':
      return fmtKilo(v, '/s');
  }
}

export function fmtTime(label: string): string {
  return label.split(':').slice(0, 2).join(':');
}
