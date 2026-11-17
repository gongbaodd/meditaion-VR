#!/usr/bin/env node
/**
 * Memory soak test. Drives the running app through the IWSDK CLI: optionally enters
 * emulated XR, presses Shift+P (PerfProbeSystem's soak: every place, three rounds), then
 * waits for the `[perf] soak {...}` log line and checks it against the budget.
 *
 * Needs the managed dev server: `npx iwsdk dev up --headless` (CI) or `npm run dev`.
 *
 * Usage: node scripts/soak.mjs [--flat] [--max-mib=N] [--timeout=seconds]
 * Exit code 1 when memory keeps growing (> 10 % after the first switch) or exceeds --max-mib.
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const flat = args.includes('--flat');
const maxMiB = Number(args.find((a) => a.startsWith('--max-mib='))?.split('=')[1] ?? (flat ? 64 : 96));
const timeoutS = Number(args.find((a) => a.startsWith('--timeout='))?.split('=')[1] ?? 300);

function cli(...parts) {
  const out = execFileSync('npx', ['iwsdk', ...parts], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    return JSON.parse(out);
  } catch {
    return { ok: false, raw: out };
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

cli('runtime', 'wait', '--timeout', '90000');
cli('browser', 'reload', '--input-json', '{}');
await sleep(8000);
if (!flat) {
  const r = cli('xr', 'enter', '--input-json', '{}');
  if (!r.ok) console.warn('xr enter failed; continuing on the flat view', r.error ?? '');
  await sleep(4000);
}
const startedAt = Date.now();
cli('browser', 'interact', '--input-json', JSON.stringify({ steps: [{ action: 'press', key: 'Shift+P' }] }));
console.log(`soak started (${flat ? 'flat' : 'emulated XR'}); waiting up to ${timeoutS}s …`);

let result = null;
while (!result && Date.now() - startedAt < timeoutS * 1000) {
  await sleep(10000);
  const logs = cli('browser', 'logs', '--input-json', JSON.stringify({ count: 50, pattern: 'perf\\] (soak|switch)' }));
  for (const entry of logs.data?.result ?? []) {
    if (entry.timestamp < startedAt) continue;
    const m = /\[perf\] soak (\{.*\})/.exec(entry.message ?? '');
    if (m) result = JSON.parse(m[1]);
  }
}

if (!result) {
  console.error('No soak result: is the dev server running with the perf probe enabled?');
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
const problems = [];
if (!result.pass) problems.push(`memory grew ×${result.growth} after the first switch`);
if (result.finalMiB > maxMiB) problems.push(`${result.finalMiB} MiB of textures > budget ${maxMiB} MiB`);
if (problems.length) {
  console.error('SOAK FAILED: ' + problems.join('; '));
  process.exit(1);
}
console.log('SOAK OK');
