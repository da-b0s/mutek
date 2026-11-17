// tripwire run: baseline -> generate -> replay each mutant -> classify -> ledger -> report.
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createProxy, proxyClient } from '../proxy.js';
import { loadConfig, findTests } from '../config.js';
import { runTest, verdict, metricFromVerdict, balance } from '../kane.js';
import { profileEntry, summarize } from '../profile.js';
import { generateAll, select } from '../../operators/index.js';
import { appendLedger, readLedger, latest, score } from '../ledger.js';
import { writeReport } from '../report.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const POLICY_DIR = path.resolve(here, '../../policies');

const HELP = `tripwire run [options]

  --tests <glob>        test files (default from tripwire.config.json, else **/*_test.md)
  --app <url>           the real app behind the proxy (default http://localhost:3000)
  --port <n>            proxy port your tests point at (default 8080)
  --max-mutants <n>     cap on mutants replayed (default 40)
  --only <ops>          comma-separated operators or families (data, behaviour, interface, saboteur)
  --since <commit>      incremental: re-run only mutants whose tests changed; trust earlier kills
  --no-heal-check       skip the healing-on rerun that detects heal-masked mutants
  --heal-budget <n>     at most n heal checks per run (default 10)
  --timeout <s>         per-step kane timeout (default 180)
  --baseline-only       record the baseline and list mutants, replay nothing
  --dry-run             generate from the last baseline and print the plan
  --dir <path>          state directory (default .tripwire)`;

const sh = (cmd) => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; } };
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const slug = (s) => s.replace(/[^\w.-]+/g, '_').slice(0, 80);

export async function resetApp(cfg, base) {
  if (!cfg.reset) return;
  if (cfg.reset.cmd) {
    const r = spawnSync(cfg.reset.cmd, { shell: true, stdio: 'ignore' });
    if (r.status !== 0) throw new Error(`reset command failed: ${cfg.reset.cmd}`);
  } else if (cfg.reset.url) {
    // reset through the app directly, never through the proxy, so it is not recorded or mutated
    const url = cfg.reset.url.startsWith('http') ? cfg.reset.url : new URL(cfg.reset.url, base).toString();
    const r = await fetch(url, { method: cfg.reset.method || 'POST' });
    if (!r.ok) throw new Error(`reset ${url} returned ${r.status}`);
  }
}

export async function withProxy(cfg, fn) {
  // Reuse a proxy that is already running on the port (e.g. `tripwire proxy` in another terminal).
  const base = `http://localhost:${cfg.port}`;
  try {
    const h = await (await fetch(base + '/_tw/health')).json();
    if (h.ok) return fn(proxyClient(base), base, false);
  } catch { /* none running */ }
  const p = createProxy({ target: cfg.app, port: Number(cfg.port), log: () => {} });
  await p.listen();
  try { return await fn(proxyClient(base), base, true); } finally { await p.close(); }
}

export default async function run(argv, parseArgs) {
  const { values } = parseArgs({
    args: argv,
    options: {
      tests: { type: 'string' }, app: { type: 'string' }, port: { type: 'string' },
      'max-mutants': { type: 'string' }, only: { type: 'string' }, since: { type: 'string' },
      'no-heal-check': { type: 'boolean' }, 'heal-budget': { type: 'string' }, timeout: { type: 'string' },
      'baseline-only': { type: 'boolean' }, 'dry-run': { type: 'boolean' }, dir: { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    }
  });
  if (values.help) { console.log(HELP); return 0; }
  const cfg = loadConfig();
  for (const [k, v] of Object.entries({ tests: values.tests, app: values.app, port: values.port, dir: values.dir })) if (v) cfg[k] = v;
  if (values['max-mutants']) cfg.maxMutants = Number(values['max-mutants']);
  if (values.timeout) cfg.timeout = Number(values.timeout);
  if (values['heal-budget']) cfg.healBudget = Number(values['heal-budget']);
  if (values['no-heal-check']) cfg.healCheck = false;
  const dir = path.resolve(cfg.dir);
  fs.mkdirSync(dir, { recursive: true });
  const runId = stamp();
  const runDir = path.join(dir, 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });
  const commit = sh('git rev-parse --short HEAD');

  const tests = findTests(cfg.tests);
  if (!tests.length) throw new Error(`no *_test.md files match ${cfg.tests}`);

  if (values['dry-run']) {
    const profile = JSON.parse(fs.readFileSync(path.join(dir, 'traffic.json'), 'utf8'));
    const plan = plan_(profile, cfg, dir, values.only);
    for (const m of plan.picked) console.log(`${m.family.padEnd(10)} ${m.operator.padEnd(19)} ${m.describe}  [${m.touches_tests.join(', ')}]`);
    console.log(`\n${plan.picked.length} of ${plan.candidates.length} candidates selected (${plan.excluded.length} excluded as equivalent)`);
    return 0;
  }

  const creditsBefore = await balance();
  return withProxy(cfg, async (tw, base) => {
    // ---------- 1. baseline ----------
    console.log(`\nBaseline: ${tests.length} test(s) through the proxy at ${base}, healing off`);
    const profile = { tests: [], created: new Date().toISOString(), commit };
    const baseline = [];
    for (const t of tests) {
      await tw.disarm();
      await resetApp(cfg, base);
      await tw.reset(t, true);
      const r = await runTest(t, { timeout: cfg.timeout, logFile: path.join(runDir, `baseline_${slug(t)}.ndjson`) });
      const v = await verdict(r.pack, path.join(POLICY_DIR, 'tripwire.clean.policy.yaml'));
      const withoutChecks = metricFromVerdict(v.raw, 'metrics.tests_without_checks');
      baseline.push({ test: t, code: r.code, durationMs: r.durationMs, pack: r.pack, verdict: v.verdict, testsWithoutChecks: withoutChecks, session: r.sessionId });
      console.log(`  ${r.code === 0 ? 'pass' : 'FAIL'}  ${t}  ${(r.durationMs / 1000).toFixed(1)}s${withoutChecks ? '  (no assertions!)' : ''}`);
      if (r.code !== 0) {
        console.error(`\nThe baseline must be green: ${t} exited ${r.code}. ${r.failureReason || ''}\nLog: ${path.join(runDir, `baseline_${slug(t)}.ndjson`)}`);
        if (r.spawnError) console.error('Is kane-cli installed and on PATH? (npm install -g @testmuai/kane-cli)');
        return 2;
      }
      profile.tests.push(profileEntry(t, await tw.traffic(), await tw.dom()));
    }
    await tw.reset(null, false);
    fs.writeFileSync(path.join(dir, 'traffic.json'), JSON.stringify(profile, null, 1));
    fs.writeFileSync(path.join(dir, 'baseline.json'), JSON.stringify({ run: runId, commit, tests: baseline, routes: summarize(profile) }, null, 2));
    const noChecks = baseline.filter((b) => b.testsWithoutChecks > 0);
    if (noChecks.length) console.log(`\n${noChecks.length} test(s) assert nothing at all: ${noChecks.map((b) => b.test).join(', ')}`);

    // ---------- 2. generate ----------
    const { candidates, excluded, picked, counts } = plan_(profile, cfg, dir, values.only);
    fs.writeFileSync(path.join(runDir, 'mutants.json'), JSON.stringify({ counts, picked, excluded: excluded.map((m) => m.id) }, null, 2));
    console.log(`\nGenerated ${candidates.length} mutants; replaying ${picked.length}${excluded.length ? ` (${excluded.length} excluded as equivalent)` : ''}`);
    if (values['baseline-only']) return 0;

    // ---------- incremental ----------
    let carried = [];
    let todo = picked;
    if (values.since) {
      const changed = new Set((sh(`git diff --name-only ${values.since} --`) || '').split('\n').filter(Boolean));
      const prev = new Map(latest(readLedger(dir)).map((r) => [r.id, r]));
      todo = [];
      for (const m of picked) {
        const p = prev.get(m.id);
        const touchedChanged = m.touches_tests.some((t) => changed.has(t));
        if (p && p.status === 'killed' && !touchedChanged) carried.push({ ...p, run: runId, carried: true });
        else todo.push(m);
      }
      console.log(`Incremental since ${values.since}: ${carried.length} earlier kills trusted, ${todo.length} to run`);
    }

    // ---------- 3. replay each mutant ----------
    const rows = [...carried];
    for (const r of carried) appendLedger(dir, r);
    let healChecks = 0;
    for (const [i, m] of todo.entries()) {
      const row = await runMutant(m, { tw, cfg, base, runDir, healAllowed: cfg.healCheck && healChecks < cfg.healBudget });
      if (row.healChecked) healChecks++;
      Object.assign(row, { run: runId, commit, at: new Date().toISOString() });
      rows.push(row);
      appendLedger(dir, row);
      console.log(`  [${String(i + 1).padStart(2)}/${todo.length}] ${label(row.status)} ${m.describe}${row.killed_by ? `  (by ${row.killed_by})` : ''}`);
    }
    await tw.disarm();

    // ---------- 4. score + report ----------
    const creditsAfter = await balance();
    const s = score(rows);
    const meta = { run: runId, commit, creditsUsed: creditsBefore !== undefined && creditsAfter !== undefined ? Math.round((creditsBefore - creditsAfter) * 100) / 100 : null, baseline };
    fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify({ ...meta, score: s }, null, 2));
    const report = writeReport(dir);
    console.log(`\nScore ${s.score ?? '-'}%  killed ${s.killed} · survived ${s.survived} · masked by heal ${s.masked} · not reached ${s['not-reached']}${s.error ? ` · errors ${s.error}` : ''}`);
    if (meta.creditsUsed !== null) console.log(`Credits used: ${meta.creditsUsed}`);
    console.log(`Report: ${report}`);
    if (s.survived + s.masked > 0) console.log('Next: tripwire fix   (hands each survivor to your coding agent and proves the new assertion)');
    return 0;
  });
}

function plan_(profile, cfg, dir, only) {
  const eqFile = path.join(dir, 'equivalents.json');
  const excludedIds = new Set(fs.existsSync(eqFile) ? JSON.parse(fs.readFileSync(eqFile, 'utf8')).map((e) => e.id) : []);
  const { candidates, excluded, counts } = generateAll(profile, { dir, only: only ? only.split(',') : undefined, excluded: excludedIds });
  return { candidates, excluded, counts, picked: select(candidates, cfg.maxMutants) };
}

// output-<stem>/ next to foo_test.md holds the recordings kane replays.
export function recordingDir(testFile) {
  return path.join(path.dirname(testFile), 'output-' + path.basename(testFile).replace(/_test\.md$/, ''));
}

export function snapshotRecording(testFile) {
  const src = recordingDir(testFile);
  const md = fs.existsSync(testFile) ? fs.readFileSync(testFile) : null;
  if (!fs.existsSync(src)) return () => { if (md) fs.writeFileSync(testFile, md); };
  const tmp = fs.mkdtempSync(path.join(path.dirname(src), '.tw-snap-'));
  fs.cpSync(src, path.join(tmp, 'rec'), { recursive: true });
  return () => {
    fs.rmSync(src, { recursive: true, force: true });
    fs.cpSync(path.join(tmp, 'rec'), src, { recursive: true });
    fs.rmSync(tmp, { recursive: true, force: true });
    if (md) fs.writeFileSync(testFile, md);
  };
}

const label = (s) => ({ killed: 'killed     ', survived: 'SURVIVED   ', masked: 'MASKED     ', 'not-reached': 'not reached', error: 'error      ' }[s] || s);

// Arm one mutant, replay the tests that touch it (healing off) until one fails.
export async function runMutant(m, { tw, cfg, base, runDir, healAllowed }) {
  const row = { id: m.id, family: m.family, operator: m.operator, describe: m.describe, expect: m.expect, touches_tests: m.touches_tests, status: null, fired: false, runs: [] };
  const mdir = path.join(runDir, slug(m.id));
  fs.mkdirSync(mdir, { recursive: true });
  let infra = 0;
  for (const t of m.touches_tests) {
    let attempt = 0;
    let r;
    let hits;
    do {
      await tw.disarm();
      await resetApp(cfg, base);
      await tw.reset(t, false);
      await tw.arm(m);
      r = await runTest(t, { timeout: cfg.timeout, logFile: path.join(mdir, `${slug(t)}_${attempt}.ndjson`) });
      hits = (await tw.hit()).hits;
      attempt++;
    } while ((r.code === 2 || r.code === 3) && attempt < 2); // infrastructure problem: retry once, never a kill
    const fired = hits > 0;
    row.fired = row.fired || fired;
    const v = r.code === 0 || r.code === 1 ? await verdict(r.pack, path.join(POLICY_DIR, 'tripwire.mutant.policy.yaml')) : { verdict: 'unknown' };
    row.runs.push({ test: t, code: r.code, fired, hits, durationMs: r.durationMs, pack: r.pack, session: r.sessionId, policy: v.verdict, failure: r.failureReason, credits: r.credits || undefined });
    if (r.code === 2 || r.code === 3) { infra++; continue; }
    if (r.code === 1 && fired) {
      row.status = 'killed';
      row.killed_by = t;
      break;
    }
  }
  if (!row.status) {
    if (!row.fired) row.status = infra === m.touches_tests.length ? 'error' : 'not-reached';
    else row.status = infra && !row.runs.some((x) => x.code === 0) ? 'error' : 'survived';
  }
  // Heal check: would Kane's default healing have re-authored its way past this bug?
  if (row.status === 'killed' && healAllowed) {
    row.healChecked = true;
    await tw.disarm();
    await resetApp(cfg, base);
    await tw.reset(row.killed_by, false);
    await tw.arm(m);
    // A run that passes after a heal commits the re-authored steps. Those steps were recorded
    // against the broken app, so keep a copy of the real recording and put it back afterwards.
    const restore = snapshotRecording(row.killed_by);
    let h;
    try {
      h = await runTest(row.killed_by, { heal: true, timeout: cfg.timeout, logFile: path.join(mdir, `${slug(row.killed_by)}_heal.ndjson`) });
    } finally { restore(); }
    const hv = h.pack ? await verdict(h.pack, path.join(POLICY_DIR, 'tripwire.clean.policy.yaml')) : { raw: null };
    const healed = metricFromVerdict(hv.raw, 'metrics.heal.healed_tests');
    row.heal = { code: h.code, healedTests: healed, healEvents: h.healEvents, pack: h.pack, session: h.sessionId };
    if (h.code === 0 && (healed > 0 || h.healEvents > 0 || h.mentionsHeal)) row.status = 'masked';
  }
  await tw.disarm();
  return row;
}
