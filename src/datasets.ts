// 読み込んだ HostData を日付（sadf の file-date）ごとに束ねるストア。
// 日付切替UIとレイジーロード（--host）の土台。すべて不変データとして扱う。

import type { HostData } from './model.js';

export const UNKNOWN_DATE = 'unknown';

export interface DatasetStore {
  /** 昇順。fileDate 不明のものは末尾に UNKNOWN_DATE として置く */
  dates: string[];
  byDate: Record<string, HostData[]>;
}

function sortDates(dates: string[]): string[] {
  return [...dates].sort((a, b) =>
    a === UNKNOWN_DATE ? 1 : b === UNKNOWN_DATE ? -1 : a.localeCompare(b),
  );
}

export function fromHosts(hosts: HostData[]): DatasetStore {
  return insertHosts({ dates: [], byDate: {} }, hosts);
}

export function insertHosts(store: DatasetStore, hosts: HostData[]): DatasetStore {
  const byDate = { ...store.byDate };
  for (const host of hosts) {
    const date = host.fileDate ?? UNKNOWN_DATE;
    const existing = byDate[date] ?? [];
    const idx = existing.findIndex((h) => h.nodename === host.nodename);
    byDate[date] =
      idx >= 0 ? existing.map((h, i) => (i === idx ? host : h)) : [...existing, host];
  }
  return { dates: sortDates(Object.keys(byDate)), byDate };
}
