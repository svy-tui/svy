#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import tty from 'node:tty';
import { render } from 'ink';
import { addDays, daysBetween, todayISO } from './dates.js';
import { DEMO_BASE_DATE, loadDemoDay } from './demo.js';
import type { HostData } from './model.js';
import { parseSadfJson } from './parse.js';
import { App } from './ui/App.js';

const HELP = `svy — system viewer for sar (interactive terminal viewer for sysstat data)

Usage:
  sadf -j -- -A | svy          view piped sadf JSON
  svy <file.json>...           view saved sadf JSON files (multiple days ok)
  svy --host <ssh-host> [saXX] run sadf -j on a remote host via ssh
  svy --demo                   explore with synthetic demo data

Options:
  --demo          synthetic data, browsable across days (no sysstat required)
  --host <host>   ssh host; runs \`sadf -j [file] -- -A\` remotely.
                  < / > keys then fetch adjacent days on demand (sadf -j -N)
  -h, --help      show this help
  -V, --version   show version

Keys:
  ↑↓/kj metric · ←→/hl cursor · Tab/[] instance · <>/,. day · +/- zoom · ? help · q quit`;

interface Args {
  files: string[];
  demo: boolean;
  host?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { files: [], demo: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      console.log(HELP);
      process.exit(0);
    } else if (a === '-V' || a === '--version') {
      const pkg = createRequire(import.meta.url)('../package.json');
      console.log(pkg.version);
      process.exit(0);
    } else if (a === '--demo') {
      args.demo = true;
    } else if (a === '--host') {
      args.host = argv[++i];
      if (!args.host) fail('--host requires an argument');
    } else if (a.startsWith('-')) {
      fail(`unknown option: ${a}\n\n${HELP}`);
    } else {
      args.files.push(a);
    }
  }
  if (args.host && args.files.length > 1) fail('--host accepts at most one remote file');
  return args;
}

function fail(msg: string): never {
  console.error(`svy: ${msg}`);
  process.exit(1);
}

function readAllStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (buf += c));
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

function runSsh(host: string, remoteCmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // TUI表示中にも呼ばれるため、stderrは画面に流さずエラーメッセージに含める
    const child = spawn('ssh', [host, remoteCmd], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(err.trim().split('\n').pop() || `ssh exited with code ${code}`));
    });
  });
}

function parseFile(path: string): HostData[] {
  let text: string;
  try {
    text = fs.readFileSync(path, 'utf8');
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
  try {
    return parseSadfJson(text);
  } catch (e) {
    fail(`${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// sadf の「-N = N日前のデータファイル」指定を使うことで、
// saDD ファイルの置き場所（/var/log/sysstat, /var/log/sa 等）の差異を吸収する。
// 日数はビューア側のローカル日付基準なので、サーバとTZが大きくずれると1日ぶれうる。
function makeSshDateLoader(host: string): (date: string) => Promise<HostData[]> {
  return async (date) => {
    const offset = daysBetween(todayISO(), date);
    if (offset < 0) throw new Error('date is in the future');
    const remoteCmd = offset === 0 ? 'sadf -j -- -A' : `sadf -j -${offset} -- -A`;
    return parseSadfJson(await runSsh(host, remoteCmd));
  };
}

interface Loaded {
  hosts: HostData[];
  loadDate?: (date: string) => Promise<HostData[]>;
}

async function loadInput(args: Args): Promise<Loaded> {
  if (args.demo) {
    // 初期2日分 + 過去日はその場で合成（日付切替を --demo でも体験できるように）
    const yesterday = addDays(DEMO_BASE_DATE, -1)!;
    return {
      hosts: [...loadDemoDay(yesterday), ...loadDemoDay(DEMO_BASE_DATE)],
      loadDate: async (date) => loadDemoDay(date),
    };
  }
  if (args.host) {
    const file = args.files[0];
    const remoteCmd = file ? `sadf -j ${file} -- -A` : 'sadf -j -- -A';
    const text = await runSsh(args.host, remoteCmd);
    return { hosts: parseSadfJson(text), loadDate: makeSshDateLoader(args.host) };
  }
  if (args.files.length > 0) return { hosts: args.files.flatMap(parseFile) };
  if (!process.stdin.isTTY) return { hosts: parseSadfJson(await readAllStdin()) };
  fail(`no input\n\n${HELP}`);
}

// stdinがパイプに使われた場合、キー入力用に制御端末を開き直す
function interactiveStdin(): tty.ReadStream | undefined {
  if (process.stdin.isTTY) return undefined;
  try {
    return new tty.ReadStream(fs.openSync('/dev/tty', 'r'));
  } catch {
    console.error('svy: /dev/tty unavailable — keyboard input disabled (pass a file argument instead of piping)');
    return undefined;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let loaded: Loaded;
  try {
    loaded = await loadInput(args);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }

  const stdin = interactiveStdin();
  const { waitUntilExit } = render(
    <App hosts={loaded.hosts} loadDate={loaded.loadDate} />,
    stdin ? { stdin } : undefined,
  );
  await waitUntilExit();
  stdin?.destroy();
}

main();
