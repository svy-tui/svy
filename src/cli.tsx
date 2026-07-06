#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import tty from 'node:tty';
import { render } from 'ink';
import { generateDemoJson } from './demo.js';
import { parseSadfJson } from './parse.js';
import { App } from './ui/App.js';

const HELP = `sadf-view — interactive terminal viewer for sysstat/sar data

Usage:
  sadf -j -- -A | sadf-view          view piped sadf JSON
  sadf-view <file.json>              view a saved sadf JSON file
  sadf-view --host <ssh-host> [saXX] run sadf -j on a remote host via ssh
  sadf-view --demo                   explore with synthetic demo data

Options:
  --demo          generate 24h of synthetic data (no sysstat required)
  --host <host>   ssh host; runs \`sadf -j [file] -- -A\` remotely
  -h, --help      show this help
  -V, --version   show version

Keys:
  ↑↓/kj metric · ←→/hl cursor · Tab/[] instance · +/- zoom · 0 reset · ? help · q quit`;

interface Args {
  file?: string;
  demo: boolean;
  host?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { demo: false };
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
    } else if (args.file) {
      fail('only one input file can be given');
    } else {
      args.file = a;
    }
  }
  return args;
}

function fail(msg: string): never {
  console.error(`sadf-view: ${msg}`);
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

function fetchViaSsh(host: string, file?: string): Promise<string> {
  const remoteCmd = file ? `sadf -j ${file} -- -A` : 'sadf -j -- -A';
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', [host, remoteCmd], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (c) => (out += c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`ssh ${host} "${remoteCmd}" exited with code ${code}`));
    });
  });
}

async function loadInput(args: Args): Promise<string> {
  if (args.demo) return generateDemoJson();
  if (args.host) return fetchViaSsh(args.host, args.file);
  if (args.file) return fs.readFileSync(args.file, 'utf8');
  if (!process.stdin.isTTY) return readAllStdin();
  fail(`no input\n\n${HELP}`);
}

// stdinがパイプに使われた場合、キー入力用に制御端末を開き直す
function interactiveStdin(): tty.ReadStream | undefined {
  if (process.stdin.isTTY) return undefined;
  try {
    return new tty.ReadStream(fs.openSync('/dev/tty', 'r'));
  } catch {
    console.error('sadf-view: /dev/tty unavailable — keyboard input disabled (pass a file argument instead of piping)');
    return undefined;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let text: string;
  try {
    text = await loadInput(args);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }

  let hosts;
  try {
    hosts = parseSadfJson(text);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }

  const stdin = interactiveStdin();
  const { waitUntilExit } = render(<App hosts={hosts} />, stdin ? { stdin } : undefined);
  await waitUntilExit();
  stdin?.destroy();
}

main();
