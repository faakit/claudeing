// Time one command and the CPU its whole process tree uses (Chromium, the preview server, workers): the numbers
// behind agents/out/test-speed.md.
//
//   node scripts/measure.mjs <label> -- node scripts/e2e.mjs
//   node scripts/measure.mjs vitest -- node node_modules/vitest/vitest.mjs run
//
// Prints one line: wall s, CPU s (user + kernel, every descendant), average cores busy, peak processes and peak
// Chromium processes; appends it as JSON to agents/out/test-speed.jsonl and keeps the command's output in
// agents/out/measure/<label>.log. Windows samples the tree every 2 s through one PowerShell (a process that ends
// between two samples loses its last 2 s, so CPU reads a little low); elsewhere it reads `ps` the same way.
import { spawn } from 'node:child_process';
import { appendFileSync, createWriteStream, mkdirSync } from 'node:fs';

const sep = process.argv.indexOf('--');
const label = process.argv[2];
if (!label || sep < 0 || sep === process.argv.length - 1) {
  console.error('usage: node scripts/measure.mjs <label> -- <command> [args...]');
  process.exit(2);
}
const [cmd, ...args] = process.argv.slice(sep + 1);
mkdirSync('agents/out/measure', { recursive: true });
const log = createWriteStream(`agents/out/measure/${label.replace(/[^\w.-]+/g, '_')}.log`);

const t0 = Date.now();
const child = spawn(cmd === 'node' ? process.execPath : cmd, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });

/** pid -> { ppid, cpu (s), name } of the latest sample; cpu keeps the most seen per pid. */
const procs = new Map();
const cpuSeen = new Map();
let peak = 0;
let peakChrome = 0;

/**
 * pid -> belongs to the measured tree, decided when the pid is first seen: a process is ours only if it appeared
 * while its parent was ours. (A long-running process whose parent pid was later reused by one of ours is not.)
 */
const member = new Map();
function absorb(rows) {
  const live = new Map(rows.map((r) => [r.pid, r]));
  for (const pid of member.keys()) if (!live.has(pid)) member.delete(pid); // gone: its pid may be reused
  if (live.has(child.pid)) member.set(child.pid, true);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows)
      if (!member.has(r.pid) && member.get(r.ppid)) {
        member.set(r.pid, true);
        grew = true;
      }
  }
  for (const r of rows) if (!member.has(r.pid)) member.set(r.pid, false);
  const tree = [...member].filter(([, m]) => m).map(([pid]) => pid);
  let n = 0;
  let chrome = 0;
  for (const pid of tree) {
    const r = live.get(pid);
    if (!r) continue;
    n++;
    if (/chrome/i.test(r.name)) chrome++;
    // pids are reused: key by pid and name
    const k = `${pid}:${r.name}`;
    cpuSeen.set(k, Math.max(cpuSeen.get(k) ?? 0, r.cpu));
    procs.set(pid, r);
  }
  peak = Math.max(peak, n);
  peakChrome = Math.max(peakChrome, chrome);
}

let sampler;
if (process.platform === 'win32') {
  const ps = `while ($true) { Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId),$($_.ParentProcessId),$($_.UserModeTime + $_.KernelModeTime),$($_.Name)/$(if ($_.CommandLine -match '--type=([a-z-]+)') { $matches[1] } else { '' })" }; "---"; [Console]::Out.Flush(); Start-Sleep -Seconds 2 }`;
  sampler = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  let buf = '';
  let rows = [];
  sampler.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line === '---') {
        absorb(rows);
        rows = [];
      } else if (line) {
        const [pid, ppid, t, ...name] = line.split(',');
        rows.push({ pid: +pid, ppid: +ppid, cpu: Number(t) / 1e7, name: name.join(',') });
      }
    }
  });
} else {
  const tick = () => {
    const ps = spawn('ps', ['-eo', 'pid=,ppid=,cputimes=,comm='], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    ps.stdout.on('data', (d) => (out += d));
    ps.on('close', () =>
      absorb(
        out
          .trim()
          .split('\n')
          .map((l) => l.trim().split(/\s+/))
          .map(([pid, ppid, t, ...name]) => ({
            pid: +pid,
            ppid: +ppid,
            cpu: +t,
            name: name.join(' '),
          })),
      ),
    );
  };
  const id = setInterval(tick, 2000);
  sampler = { kill: () => clearInterval(id) };
}

const code = await new Promise((r) => child.on('close', r));
sampler.kill();
log.end();
const wall = (Date.now() - t0) / 1000;
const cpu = [...cpuSeen.values()].reduce((a, b) => a + b, 0);
const byKind = {};
for (const [k, v] of cpuSeen) {
  // 'chrome/renderer', 'chrome/gpu-process', 'chrome/' (the browser itself), 'node/'...
  const kind = k.slice(k.indexOf(':') + 1).replace(/\.exe\b/i, '');
  byKind[kind] = +((byKind[kind] ?? 0) + v).toFixed(1);
}
const row = {
  label,
  when: new Date().toISOString(),
  code,
  wall: +wall.toFixed(1),
  cpu: +cpu.toFixed(1),
  cores: +(cpu / wall).toFixed(2),
  peakProcs: peak,
  peakChrome,
  byKind,
};
appendFileSync('agents/out/test-speed.jsonl', JSON.stringify(row) + '\n');
console.log(
  `${label}: exit ${code}, ${row.wall} s wall, ${row.cpu} s CPU (${row.cores} cores), peak ${peak} processes (${peakChrome} Chromium)\n  CPU s by process: ${JSON.stringify(byKind)}`,
);
process.exit(code ?? 1);
