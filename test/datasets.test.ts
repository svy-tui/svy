import { describe, expect, it } from 'vitest';
import { fromHosts, insertHosts } from '../src/datasets.js';
import type { HostData } from '../src/model.js';

const host = (nodename: string, fileDate?: string): HostData => ({
  nodename,
  fileDate,
  timeLabels: ['00:10:00'],
  epochs: [0],
  metrics: [],
});

describe('datasets', () => {
  it('fileDateごとにグループ化し昇順に並べる', () => {
    const store = fromHosts([host('a', '2026-07-06'), host('a', '2026-07-05')]);
    expect(store.dates).toEqual(['2026-07-05', '2026-07-06']);
    expect(store.byDate['2026-07-06']).toHaveLength(1);
  });

  it('同一日の複数ホストは同じデータセットに入る', () => {
    const store = fromHosts([host('a', '2026-07-05'), host('b', '2026-07-05')]);
    expect(store.dates).toEqual(['2026-07-05']);
    expect(store.byDate['2026-07-05'].map((h) => h.nodename)).toEqual(['a', 'b']);
  });

  it('fileDate不明はunknownとして末尾に置く', () => {
    const store = fromHosts([host('a'), host('a', '2026-07-05')]);
    expect(store.dates).toEqual(['2026-07-05', 'unknown']);
  });

  it('insertHostsは新しい日付をソート位置に挿入する', () => {
    const store = fromHosts([host('a', '2026-07-05')]);
    const next = insertHosts(store, [host('a', '2026-07-04')]);
    expect(next.dates).toEqual(['2026-07-04', '2026-07-05']);
    expect(store.dates).toEqual(['2026-07-05']); // 元は不変
  });

  it('insertHostsは同一日・同一ホストを置き換える', () => {
    const store = fromHosts([host('a', '2026-07-05')]);
    const updated = { ...host('a', '2026-07-05'), timeLabels: ['00:20:00'] };
    const next = insertHosts(store, [updated]);
    expect(next.byDate['2026-07-05']).toHaveLength(1);
    expect(next.byDate['2026-07-05'][0].timeLabels).toEqual(['00:20:00']);
  });
});
