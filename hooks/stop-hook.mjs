#!/usr/bin/env node
// Claude Code Stop hook: the agent may not finish while its Kane tests are weak.
//   - if any *_test.md changed after the last Mutek run, block: "run mutek run --since HEAD"
//   - if the latest mutation score is below the threshold, block: "run mutek fix"
// Install: copy hooks/claude-settings.json into .claude/settings.json (or merge the "hooks" block).
// Gives up after 4 consecutive blocks so a stuck agent cannot loop forever (it says so).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Agents that mutek itself launches (fix, sabotage, coverage) are already inside the loop.
if (process.env.MUTEK_AGENT === '1') process.exit(0);

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { /* no stdin */ }
const cwd = input.cwd || process.cwd();
const dir = path.join(cwd, '.mutek');
const counter = path.join(dir, '.stop-hook-blocks');
const threshold = Number(process.env.MUTEK_THRESHOLD || readConfig().threshold || 80);

function readConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(cwd, 'mutek.config.json'), 'utf8')); } catch { return {}; }
}
function allow() { try { fs.rmSync(counter, { force: true }); } catch { /* ignore */ } process.exit(0); }
function block(reason) {
  const n = (() => { try { return Number(fs.readFileSync(counter, 'utf8')) || 0; } catch { return 0; } })() + 1;
  if (n > 4) { process.stderr.write(`mutek: still below the bar after ${n - 1} attempts; letting the agent stop. ${reason}\n`); allow(); }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(counter, String(n));
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

const testFiles = (() => {
  try { return execSync('git ls-files -m -o --exclude-standard', { cwd }).toString().split('\n').filter((f) => f.endsWith('_test.md')); } catch { return []; }
})();
const ledger = path.join(dir, 'ledger.jsonl');
const ledgerTime = fs.existsSync(ledger) ? fs.statSync(ledger).mtimeMs : 0;
const changedSince = testFiles.filter((f) => { try { return fs.statSync(path.join(cwd, f)).mtimeMs > ledgerTime; } catch { return false; } });

if (!testFiles.length && !fs.existsSync(ledger)) allow(); // this task did not touch tests

if (changedSince.length) {
  block(`Kane tests changed since the last Mutek run (${changedSince.join(', ')}). Before finishing, run \`npx mutek run --since HEAD\` to check that these tests would fail if the app were broken, then \`npx mutek fix\` for any survivors. The task is not complete below ${threshold}%.`);
}

let check;
try {
  const bin = process.env.MUTEK_BIN || 'npx --no-install mutek';
  check = JSON.parse(execSync(`${bin} check --json --threshold ${threshold}`, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString());
} catch (e) {
  try { check = JSON.parse(e.stdout?.toString() || 'null'); } catch { check = null; }
}
if (!check || check.ok) allow();
block(`Mutek score is ${check.score}% (threshold ${threshold}%). These bugs were live and the tests still passed:\n${(check.survivors || []).slice(0, 6).map((s) => `- ${s}`).join('\n')}\nRun \`npx mutek fix\` to strengthen the tests (each fix is proven by Kane on the real and the broken app), then \`npx mutek run --since HEAD\`. Do not weaken or delete existing steps.`);
