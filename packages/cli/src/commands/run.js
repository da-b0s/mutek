// tripwire run: baseline -> generate -> replay each mutant -> classify -> ledger -> report.
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createProxy, proxyClient, PROXY_CODE } from '../proxy.js';
import { loadConfig, findTests } from '../config.js';
import { runTest, verdict, metricFromVerdict, balance } from '../kane.js';
import { profileEntry, summarize } from '../profile.js';
import { generateAll, select } from '../../operators/index.js';
import { appendLedger, readLedger, latest, lastRunId, score } from '../ledger.js';
import { writeReport } from '../report.js';
import { findOrphanKaneBrowsers } from '../orphans.js';

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
  --resume              continue the last run: reuse its baseline, skip mutants already in the ledger
  --retry-errors        re-run only the mutants that hit a Kane error in the last run
  --redo <id,...>       re-run these mutants of the last run (e.g. after fixing an operator)
  -q, --quiet           one line per mutant, no per-replay progress
  --dir <path>          state directory (default .tripwire)`;

export const normalizePath = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '');
// Test files changed according to `git diff --name-only --relative` output.
export function changedTests(diffOutput) {
  return new Set(String(diffOutput || '').split(/\r?\n/).map((s) => normalizePath(s.trim())).filter((s) => s.endsWith('_test.md')));
}

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
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
  let h = null;
  try { h = await (await fetch(base + '/_tw/health')).json(); } catch { /* nothing tripwire-like on the port */ }
  if (h?.ok) {
    if (h.code !== PROXY_CODE) throw new Error(`a tripwire proxy from different code is already running on port ${cfg.port} (its code ${h.code || 'unknown'}, this one ${PROXY_CODE}). Stop it, or let tripwire start its own.`);
    if (h.target && h.target.replace(/\/$/, '') !== String(cfg.app).replace(/\/$/, '')) throw new Error(`the proxy on port ${cfg.port} points at ${h.target}, not ${cfg.app}`);
    return fn(proxyClient(base), base, false);
  }
  const p = createProxy({ target: cfg.app, port: Number(cfg.port), log: () => {} });
  await new Promise((resolve, reject) => {
    p.server.once('error', (e) => reject(e.code === 'EADDRINUSE' ? new Error(`port ${cfg.port} is in use by something that is not a tripwire proxy; set "port" in tripwire.config.json`) : e));
    p.listen().then(resolve, reject);
  });
  try { return await fn(proxyClient(base), base, true); } finally { await p.close(); }
}

export default async function run(argv, parseArgs) {
  const { values } = parseArgs({
    args: argv,
    options: {
      tests: { type: 'string' }, app: { type: 'string' }, port: { type: 'string' },
      'max-mutants': { type: 'string' }, only: { type: 'string' }, since: { type: 'string' },
      'no-heal-check': { type: 'boolean' }, 'heal-budget': { type: 'string' }, timeout: { type: 'string' },
      'baseline-only': { type: 'boolean' }, 'dry-run': { type: 'boolean' }, resume: { type: 'boolean' }, 'retry-errors': { type: 'boolean' }, redo: { type: 'string' }, quiet: { type: 'boolean', short: 'q' }, dir: { type: 'string' },
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
  // --retry-errors: re-run only the mutants that ended in a Kane error (exit 2/3) in the last run,
  // on that run's baseline. Their error rows are superseded by the new rows (latest row wins).
  // --redo <id,...>: the same, for named mutants (for example after fixing an operator).
  if (values['retry-errors'] || values.redo) {
    const rows = readLedger(dir);
    const last = lastRunId(rows);
    const redo = new Set((values.redo || '').split(',').map((s) => s.trim()).filter(Boolean));
    const again = (r) => (values['retry-errors'] && r.status === 'error') || redo.has(r.id);
    const errored = latest(rows, last).filter(again);
    const pending = readJson(path.join(dir, 'current-run.json'));
    if (redo.size && errored.length < redo.size) throw new Error(`not in the last run: ${[...redo].filter((id) => !errored.some((r) => r.id === id)).join(', ')}`);
    if (!errored.length && !(pending?.run === last)) { console.log('No errored mutants in the last run.'); return 0; }
    const kept = rows.filter((r) => !(r.run === last && again(r)));
    fs.writeFileSync(path.join(dir, 'ledger.jsonl'), kept.map((r) => JSON.stringify(r)).join('\n') + (kept.length ? '\n' : ''));
    // keep every mutant the run picked, including ones an interrupted run never reached
    const prev = readJson(path.join(dir, 'current-run.json'));
    const picked = [...new Set([...(prev?.run === last ? prev.picked : []), ...latest(rows, last).map((r) => r.id)])];
    fs.writeFileSync(path.join(dir, 'current-run.json'), JSON.stringify({ run: last, picked }));
    console.log(`Re-running ${errored.length} mutant(s) of run ${last}`);
    values.resume = true;
  }
  const resumeFrom = values.resume ? readJson(path.join(dir, 'current-run.json')) : null;
  if (values.resume && !resumeFrom) throw new Error('nothing to resume: no interrupted run found in ' + dir);
  const runId = resumeFrom?.run || stamp();
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

  const orphans = findOrphanKaneBrowsers(120);
  if (orphans.length) console.log(`warning: ${orphans.length} Kane browser(s) from earlier runs are still open (oldest ${Math.round(Math.max(...orphans.map((o) => o.ageMinutes)) / 60)} h). They can change a shared app's state mid-run. Stop them: tripwire doctor --kill`);
  const creditsBefore = await balance();
  return withProxy(cfg, async (tw, base) => {
    // ---------- 1. baseline (reused when resuming) ----------
    let profile = { tests: [], created: new Date().toISOString(), commit };
    let baseline = [];
    if (resumeFrom) {
      profile = readJson(path.join(dir, 'traffic.json'));
      baseline = readJson(path.join(dir, 'baseline.json'))?.tests || [];
      console.log(`\nResuming run ${runId}: baseline from ${profile.created}`);
    } else console.log(`\nBaseline: ${tests.length} test(s) through the proxy at ${base}, healing off`);
    for (const t of resumeFrom ? [] : tests) {
      await tw.disarm();
      await resetApp(cfg, base);
      await tw.reset(t, true);
      const r = await runTest(t, { timeout: cfg.timeout, logFile: path.join(runDir, `baseline_${slug(t)}.ndjson`), onRetry: hiccup });
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
    if (!resumeFrom) {
      fs.writeFileSync(path.join(dir, 'traffic.json'), JSON.stringify(profile, null, 1));
      fs.writeFileSync(path.join(dir, 'baseline.json'), JSON.stringify({ run: runId, commit, tests: baseline, routes: summarize(profile) }, null, 2));
    }
    const noChecks = baseline.filter((b) => b.testsWithoutChecks > 0);
    if (noChecks.length) console.log(`\n${noChecks.length} test(s) assert nothing at all: ${noChecks.map((b) => b.test).join(', ')}`);

    // ---------- 2. generate ----------
    const plan = plan_(profile, cfg, dir, values.only);
    const { candidates, excluded, counts } = plan;
    // when resuming, replay exactly the mutants the interrupted run had picked
    const picked = resumeFrom ? resumeFrom.picked.map((id) => candidates.find((m) => m.id === id)).filter(Boolean) : plan.picked;
    if (!values['baseline-only']) fs.writeFileSync(path.join(dir, 'current-run.json'), JSON.stringify({ run: runId, picked: picked.map((m) => m.id), since: values.since || null }, null, 2));
    fs.writeFileSync(path.join(runDir, 'mutants.json'), JSON.stringify({ counts, picked, excluded: excluded.map((m) => m.id) }, null, 2));
    console.log(`\nGenerated ${candidates.length} mutants; replaying ${picked.length}${excluded.length ? ` (${excluded.length} excluded as equivalent)` : ''}`);
    if (values['baseline-only']) return 0;

    // ---------- incremental ----------
    let carried = [];
    let todo = picked;
    if (values.since) {
      // --relative: paths relative to this folder, the same form touches_tests uses
      const diff = sh(`git diff --name-only --relative ${values.since} --`);
      if (diff === null) throw new Error(`--since ${values.since}: git diff failed (not a git repository, or unknown commit)`);
      const changed = changedTests(diff);
      const prev = new Map(latest(readLedger(dir)).map((r) => [r.id, r]));
      todo = [];
      for (const m of picked) {
        const p = prev.get(m.id);
        const touchedChanged = m.touches_tests.some((t) => changed.has(normalizePath(t)));
        if (p && p.status === 'killed' && !touchedChanged) carried.push({ ...p, run: runId, carried: true });
        else todo.push(m);
      }
      console.log(`Incremental since ${values.since}: ${changed.size} changed test(s); ${carried.length} earlier kills trusted, ${todo.length} to run`);
    }

    // ---------- 3. replay each mutant ----------
    const rows = [...carried];
    for (const r of carried) appendLedger(dir, r);
    let healChecks = 0;
    if (resumeFrom) {
      const done = latest(readLedger(dir), runId);
      const doneIds = new Set(done.map((r) => r.id));
      rows.push(...done);
      healChecks = done.filter((r) => r.healChecked).length;
      todo = todo.filter((m) => !doneIds.has(m.id));
      console.log(`${done.length} mutants already done, ${todo.length} to go`);
    }
    for (const [i, m] of todo.entries()) {
      if (!values.quiet) console.log(`  [${String(i + 1).padStart(2)}/${todo.length}] ${m.family} · ${m.operator}: ${m.describe}`);
      const row = await runMutant(m, { tw, cfg, base, runDir, profile, healAllowed: cfg.healCheck && healChecks < cfg.healBudget, progress: values.quiet ? undefined : (msg) => console.log(`          ${msg}`) });
      if (row.healChecked) healChecks++;
      Object.assign(row, { run: runId, commit, at: new Date().toISOString() });
      rows.push(row);
      appendLedger(dir, row);
      console.log(`  ${values.quiet ? `[${String(i + 1).padStart(2)}/${todo.length}] ` : '        → '}${values.quiet ? label(row.status) : label(row.status).trim()} ${values.quiet ? m.describe : ''}${row.killed_by ? `${values.quiet ? '  ' : ''}(by ${row.killed_by})` : ''}`);
    }
    await tw.disarm();
    fs.rmSync(path.join(dir, 'current-run.json'), { force: true });

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

const hiccup = (n, msg) => console.log(`    kane service hiccup (${msg}); waiting and retrying (${n}/3)`);

const label = (s) => ({ killed: 'killed     ', survived: 'SURVIVED   ', masked: 'MASKED     ', 'not-reached': 'not reached', error: 'error      ' }[s] || s);

// Lines of text the pages of one test showed in the clean baseline.
export function baselineLines(profile, test) {
  const t = profile?.tests?.find((x) => x.test === test);
  return new Set((t?.pages || []).flatMap((p) => (p.text || '').split(/\n/)).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean));
}

// Did any page of this mutant run show a line the clean run never showed?
export function showedSomethingNew(dom, lines) {
  for (const ev of dom) if (ev.kind === 'page') for (const l of (ev.text || '').split(/\n/)) {
    const x = l.replace(/\s+/g, ' ').trim();
    if (x && !lines.has(x)) return true;
  }
  return false;
}

// Arm one mutant, replay the tests that touch it (healing off) until one fails.
export async function runMutant(m, { tw, cfg, base, runDir, healAllowed, progress = () => {}, profile }) {
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
      // the recorder stays on so we can tell whether the bug ever changed what the user saw
      await tw.reset(t, true);
      await tw.arm(m);
      // Kane can rewrite a recording during any run against the broken app (observed even on
      // failed runs), so every mutant run gets the real recording back afterwards.
      const restore = snapshotRecording(t);
      progress(`replaying ${t}${attempt ? ' (retry)' : ''}`);
      try {
        r = await runTest(t, { timeout: cfg.timeout, logFile: path.join(mdir, `${slug(t)}_${attempt}.ndjson`), onRetry: hiccup });
      } finally { restore(); }
      hits = (await tw.hit()).hits;
      r.visibleChange = profile ? showedSomethingNew(await tw.dom(), baselineLines(profile, t)) : undefined;
      attempt++;
    } while ((r.code === 2 || r.code === 3) && attempt < 2); // infrastructure problem: retry once, never a kill
    const fired = hits > 0;
    row.fired = row.fired || fired;
    const v = r.code === 0 || r.code === 1 ? await verdict(r.pack, path.join(POLICY_DIR, 'tripwire.mutant.policy.yaml')) : { verdict: 'unknown' };
    row.runs.push({ test: t, code: r.code, fired, hits, durationMs: r.durationMs, pack: r.pack, session: r.sessionId, policy: v.verdict, visibleChange: r.visibleChange, failure: r.failureReason, failedStep: r.failedStep, kaneTriage: r.bugVerdict, credits: r.credits || undefined });
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
  // A survivor that fired but never changed a single line on any page is probably equivalent
  // (for example a write response the page ignores because it re-reads the data). Flag it for a
  // human; it still counts until someone adds it to equivalents.json with a reason.
  if (row.status === 'survived' && row.runs.length && row.runs.every((x) => x.visibleChange === false)) {
    row.suspectedEquivalent = 'The mutant fired, but no page showed anything the clean run did not show.';
  }
  // Heal check: would Kane's default healing have re-authored its way past this bug?
  if (row.status === 'killed' && healAllowed) {
    row.healChecked = true;
    progress(`caught by ${row.killed_by}; heal check: same bug with Kane's default healing on`);
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
