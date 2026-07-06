import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import { parseSadfJson } from '../src/parse.js';
import { App } from '../src/ui/App.js';

const fixtureText = readFileSync(join(import.meta.dirname, 'fixtures/sample.json'), 'utf8');
const hosts = parseSadfJson(fixtureText);
const onDate = (date: string) => parseSadfJson(fixtureText.replaceAll('2026-07-05', date));

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('App', () => {
  it('ホスト名とメトリクス一覧を表示し、初期選択はCPU', () => {
    const { lastFrame, unmount } = render(<App hosts={hosts} />);
    const frame = lastFrame()!;
    expect(frame).toContain('web01');
    expect(frame).toContain('CPU');
    expect(frame).toContain('Memory');
    expect(frame).toContain('❯ CPU');
    expect(frame).toContain('user');
    unmount();
  });

  it('初期カーソルは最終サンプルで、h/←で過去へ動く', async () => {
    const { lastFrame, stdin, unmount } = render(<App hosts={hosts} />);
    expect(lastFrame()).toContain('00:30:00');
    stdin.write('h');
    await tick();
    expect(lastFrame()).toContain('00:20:00');
    unmount();
  });

  it('j/kでメトリクスを切り替える', async () => {
    const { lastFrame, stdin, unmount } = render(<App hosts={hosts} />);
    stdin.write('j');
    await tick();
    expect(lastFrame()).toContain('❯ Memory');
    stdin.write('k');
    await tick();
    expect(lastFrame()).toContain('❯ CPU');
    unmount();
  });

  it(']でインスタンス（NIC等）を切り替える', async () => {
    const { lastFrame, stdin, unmount } = render(<App hosts={hosts} />);
    // CPU → Memory → Load avg → Network
    stdin.write('j');
    stdin.write('j');
    stdin.write('j');
    await tick();
    expect(lastFrame()).toContain('eth0');
    stdin.write(']');
    await tick();
    expect(lastFrame()).toContain('eth1');
    unmount();
  });

  it('連打で複数キーが1チャンクで届いても全て処理する', async () => {
    const { lastFrame, stdin, unmount } = render(<App hosts={hosts} />);
    stdin.write('jjj');
    await tick();
    expect(lastFrame()).toContain('❯ Network');
    unmount();
  });

  it('?でヘルプを表示・非表示できる', async () => {
    const { lastFrame, stdin, unmount } = render(<App hosts={hosts} />);
    stdin.write('?');
    await tick();
    expect(lastFrame()).toContain('Keybindings');
    stdin.write('?');
    await tick();
    expect(lastFrame()).not.toContain('Keybindings');
    unmount();
  });
});

describe('日付切り替え', () => {
  const multiDay = [...hosts, ...onDate('2026-07-06')];

  it('初期表示は最新日で、,と.で日付を行き来する', async () => {
    const { lastFrame, stdin, unmount } = render(<App hosts={multiDay} />);
    expect(lastFrame()).toContain('2026-07-06 (2/2)');
    stdin.write(',');
    await tick();
    expect(lastFrame()).toContain('2026-07-05 (1/2)');
    stdin.write('.');
    await tick();
    expect(lastFrame()).toContain('2026-07-06 (2/2)');
    unmount();
  });

  it('端を越えるとローダーで前日を取得して表示する', async () => {
    const loader = vi.fn(async (date: string) => onDate(date));
    const { lastFrame, stdin, unmount } = render(<App hosts={hosts} loadDate={loader} />);
    stdin.write(',');
    await tick();
    await tick();
    expect(loader).toHaveBeenCalledWith('2026-07-04');
    expect(lastFrame()).toContain('2026-07-04 (1/2)');
    unmount();
  });

  it('ローダー失敗はメッセージを表示して現在日に留まる', async () => {
    const loader = vi.fn(async () => {
      throw new Error('no data file');
    });
    const { lastFrame, stdin, unmount } = render(<App hosts={hosts} loadDate={loader} />);
    stdin.write(',');
    await tick();
    await tick();
    expect(lastFrame()).toContain('no data file');
    expect(lastFrame()).toContain('2026-07-05');
    unmount();
  });

  it('ローダーなしで端に達すると案内を表示する', async () => {
    const { lastFrame, stdin, unmount } = render(<App hosts={hosts} />);
    stdin.write(',');
    await tick();
    expect(lastFrame()).toContain('--host');
    unmount();
  });

  it('日付キーが1チャンクで連打されても全て効く', async () => {
    const threeDays = [...hosts, ...onDate('2026-07-06'), ...onDate('2026-07-07')];
    const { lastFrame, stdin, unmount } = render(<App hosts={threeDays} />);
    expect(lastFrame()).toContain('2026-07-07 (3/3)');
    stdin.write(',,');
    await tick();
    expect(lastFrame()).toContain('2026-07-05 (1/3)');
    unmount();
  });

  it('インスタンスキーが1チャンクで連打されても全て効く', async () => {
    // CPU は all / cpu0 / cpu1 の3インスタンス
    const { lastFrame, stdin, unmount } = render(<App hosts={hosts} />);
    stdin.write(']]');
    await tick();
    expect(lastFrame()).toContain('cpu1 (3/3)');
    unmount();
  });

  it('取得中に日付キーを連打しても多重フェッチしない', async () => {
    let resolve!: (h: ReturnType<typeof onDate>) => void;
    const loader = vi.fn(() => new Promise<ReturnType<typeof onDate>>((r) => (resolve = r)));
    const { lastFrame, stdin, unmount } = render(<App hosts={hosts} loadDate={loader} />);
    stdin.write(',,,');
    await tick();
    expect(loader).toHaveBeenCalledTimes(1);
    resolve(onDate('2026-07-04'));
    await tick();
    await tick();
    expect(lastFrame()).toContain('2026-07-04 (1/2)');
    unmount();
  });
});
