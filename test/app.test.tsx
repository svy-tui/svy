import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { parseSadfJson } from '../src/parse.js';
import { App } from '../src/ui/App.js';

const hosts = parseSadfJson(
  readFileSync(join(import.meta.dirname, 'fixtures/sample.json'), 'utf8'),
);

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
