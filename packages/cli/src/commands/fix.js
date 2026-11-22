// tripwire fix: the closed loop. Each surviving (or heal-masked) mutant goes to the coding agent,
// which appends one assertion step to one test. Kane then proves it twice:
//   app clean  -> the test must pass
//   app broken -> the test must fail
// Both hold: the edit is kept and the proof (two Kane sessions and packs) is recorded.
// Otherwise: the test and its recording are restored and the agent tries again with the reason.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { readLedger, latest, lastRunId, appendLedger } from '../ledger.js';
import { runTest } from '../kane.js';
import { runAgent } from '../agent.js';
import { lastScreenshot, imageExt } from '../report.js';
import { withProxy, resetApp, snapshotRecording } from './run.js';
import { generateAll } from '../../operators/index.js';
import { get } from '../jsonpath.js';

const HELP = `tripwire fix [options]

  --agent claude|codex   which coding agent strengthens the tests (default from config: claude)
  --max-attempts <n>     attempts per survivor (default 3)
  --only <id,...>        fix only these mutant ids (default: every survivor and masked mutant)
  --limit <n>            fix at most n mutants this time
  --dir <path>           state directory (default .tripwire)`;

const slug = (s) => s.replace(/[^\w.-]+/g, '_').slice(0, 80);

// What exactly changes on the page/response: the "before and after" for the agent.
export function beforeAfter(m, profile) {
  const a = m.action;
  const entry = profile?.tests.flatMap((t) => t.traffic).reverse().find((e) => e.method === m.match.method && e.path === m.match.path && e.json !== undefined);
  if (a.type === 'json' && entry) {
    return a.ops.map((op) => {
      const before = get(entry.json, op.path);
      const after = op.op === 'add' ? before + op.value : op.op === 'scale' ? Math.round(before * op.value * 100) / 100 : op.op === 'remove-index' ? `(list without item ${op.index}: ${before?.length - 1} items)` : op.op === 'dup-index' ? `(item ${op.index} repeated: ${before?.length + 1} items)` : op.op === 'swap' ? `(${op.a} and ${op.b} exchanged)` : op.op === 'push' ? '(an extra record owned by another user)' : JSON.stringify(op.value);
      return `${m.match.method} ${m.match.path} ${op.path}: real ${JSON.stringify(before)} -> broken ${typeof after === 'string' ? after : JSON.stringify(after)}`;
    }).join('\n');
  }
  if (a.type === 'respond') return `${m.match.method} ${m.match.path} answers ${a.status} without reaching the app${a.status < 400 ? ' (it looks successful, but nothing is saved)' : ''}`;
  if (a.type === 'forward-twice') return `${m.match.method} ${m.match.path} reaches the app twice`;
  if (a.type === 'status-map') return `${m.match.method} ${m.match.path}: a ${a.from.join('/')} validation error is turned into ${a.to}`;
  if (a.type === 'stale-read') return `GET ${m.match.path} returns what it returned before the latest change`;
  if (a.type === 'dom') return `On the page: ${JSON.stringify(a.dom)}`;
  return JSON.stringify(a);
}

export function buildPrompt({ m, test, testText, change, shotPath, lessons, previousFailure, masked }) {
  return `You are strengthening an end-to-end Kane CLI test (a *_test.md file). Do not change any application code.

This bug was live in the app and the test below still PASSED:
  ${m.describe}
What changed: ${change}
${masked ? `\nWith strict replay the test failed, but with Kane's default adaptive healing it re-authored its steps and passed on the broken app. The new assertion must state the expected outcome so plainly that no re-authored path can satisfy it on the broken app.\n` : ''}
A good test would: ${m.expect ? m.expect.charAt(0).toLowerCase() + m.expect.slice(1) : 'check the outcome a user relies on'}.
${shotPath ? `Screenshot of the broken page at the end of the test: ${shotPath}\n` : ''}
Test file: ${test}
----- current contents -----
${testText}
----- end -----

Edit ${test} by APPENDING exactly one new step at the very end of the file:
  ## <short heading>
  <one or two plain-English sentences: navigate if needed, then "Verify ..." with the exact expected value>

Rules:
- Only append. Do not modify, reorder, weaken or delete any existing line (Kane re-records every step after an edit, so editing earlier steps is expensive and is rejected).
- The new step must PASS on the real app and FAIL on the broken app described above.
- Use exact expected values a user would see (amounts with currency symbol, item names, counts, status words).
- Do not mention bugs, mutants or Tripwire in the test, and never name the broken value
  (the wrong number, the extra record): assert the correct state, so the check stays general.
${lessons ? `\nAssertion patterns that worked before in this repo:\n${lessons}\n` : ''}${previousFailure ? `\nYour previous attempt was rejected: ${previousFailure}\nTry a different assertion.\n` : ''}
Reply with one line describing the assertion you added.`;
}

// The agent may only append. Returns null when fine, or the reason it is not.
export function appendOnly(before, after) {
  const b = before.replace(/\r\n/g, '\n').trimEnd();
  const a = after.replace(/\r\n/g, '\n');
  if (!a.startsWith(b)) return 'existing lines were changed; only appending a new final step is allowed';
  const added = a.slice(b.length).trim();
  if (!added) return 'nothing was added to the test';
  if (!/^##\s+\S/m.test(added)) return 'the addition must be a new "## " step';
  if ((added.match(/^##\s/gm) || []).length > 1) return 'add exactly one step';
  if (/@import/.test(added)) return 'the new step must be prose, not an @import';
  return null;
}

// The step body (without its heading) that an agent appended.
export function addedStep(original, edited) {
  const added = edited.replace(/\r\n/g, '\n').slice(original.replace(/\r\n/g, '\n').trimEnd().length).trim();
  return added.replace(/^##[^\n]*\n?/, '').replace(/\s+/g, ' ').trim();
}

// A lesson is what a good test checks plus the assertion that proved it, never agent chatter.
export function appendLesson(dir, m, step) {
  const f = path.join(dir, 'lessons.md');
  const head = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '# Assertion patterns that caught real bugs in this repo\n\n';
  const lesson = `- ${m.expect || 'Check the visible outcome'} (${m.operator}). Proven step: "${step.slice(0, 220)}"\n`;
  if (!head.includes(lesson)) fs.writeFileSync(f, head + lesson);
}

export default async function fix(argv, parseArgs) {
  const { values } = parseArgs({
    args: argv,
    options: {
      agent: { type: 'string' }, 'max-attempts': { type: 'string' }, only: { type: 'string' },
      limit: { type: 'string' }, dir: { type: 'string' }, help: { type: 'boolean', short: 'h' }
    }
  });
  if (values.help) { console.log(HELP); return 0; }
  const cfg = loadConfig();
  const dir = path.resolve(values.dir || cfg.dir);
  const agent = values.agent || cfg.agent || 'claude';
  const maxAttempts = Number(values['max-attempts'] || 3);
  const rows = readLedger(dir);
  if (!rows.length) throw new Error('no ledger yet: run `tripwire run` first');
  const profile = JSON.parse(fs.readFileSync(path.join(dir, 'traffic.json'), 'utf8'));
  const defs = new Map(generateAll(profile, { dir }).candidates.map((m) => [m.id, m]));
  const only = values.only ? new Set(values.only.split(',')) : null;
  let todo = latest(rows, lastRunId(rows)).filter((r) => (r.status === 'survived' || r.status === 'masked') && (!only || only.has(r.id)));
  if (values.limit) todo = todo.slice(0, Number(values.limit));
  if (!todo.length) { console.log('Nothing to fix: no survivors in the latest run.'); return 0; }
  const fixDir = path.join(dir, 'fix');
  fs.mkdirSync(fixDir, { recursive: true });

  return withProxy(cfg, async (tw, base) => {
    let fixed = 0;
    for (const row of todo) {
      const m = defs.get(row.id);
      if (!m) { console.log(`skip ${row.id}: no longer generated from the current baseline`); continue; }
      const masked = row.status === 'masked';
      // strengthen the test that touched the mutant and passed anyway (the killing test for masked ones)
      const test = masked ? row.killed_by : (row.runs.find((x) => x.code === 0 && x.fired) || row.runs[0]).test;
      const passedRun = row.runs.find((x) => x.test === test && x.code === 0) || row.runs[0];
      const shot = lastScreenshot(passedRun?.pack);
      const shotPath = shot ? path.join(fixDir, `${slug(m.id)}.${imageExt(shot)}`) : null;
      if (shot) fs.writeFileSync(shotPath, shot);
      const lessonsFile = path.join(dir, 'lessons.md');
      const lessons = fs.existsSync(lessonsFile) ? fs.readFileSync(lessonsFile, 'utf8').split('\n').filter((l) => l.startsWith('- ')).slice(-12).join('\n') : '';

      console.log(`\n${masked ? 'MASKED ' : 'SURVIVED'} ${m.describe}\n  strengthening ${test} with ${agent}`);
      let previousFailure = null;
      let result = 'gave-up';
      let proof = null;
      let note = '';
      let attempt = 0;
      let added = '';
      for (attempt = 1; attempt <= maxAttempts; attempt++) {
        const original = fs.readFileSync(test, 'utf8');
        const restore = snapshotRecording(test);
        const prompt = buildPrompt({ m, test, testText: original, change: beforeAfter(m, profile), shotPath, lessons, previousFailure, masked });
        fs.writeFileSync(path.join(fixDir, `${slug(m.id)}_prompt_${attempt}.txt`), prompt);
        const a = await runAgent(agent, prompt);
        if (a.code === 127) throw new Error(`could not start the ${agent} CLI: ${a.stderr.trim()}`);
        note = a.stdout.trim().split('\n').slice(-1)[0] || '';
        const edited = fs.readFileSync(test, 'utf8');
        const bad = appendOnly(original, edited);
        if (bad) { restore(); previousFailure = bad; console.log(`  attempt ${attempt}: rejected (${bad})`); continue; }

        // proof 1: clean app, the new step is authored once and everything must pass
        await tw.disarm(); await resetApp(cfg, base); await tw.reset(test, false);
        const clean = await runTest(test, { timeout: cfg.timeout, logFile: path.join(fixDir, `${slug(m.id)}_clean_${attempt}.ndjson`) });
        if (clean.code !== 0) {
          restore();
          previousFailure = `on the REAL app the strengthened test failed (exit ${clean.code}${clean.failureReason ? `: ${clean.failureReason}` : ''}). The assertion must hold on the working app.`;
          console.log(`  attempt ${attempt}: clean run failed, reverted`);
          continue;
        }
        // proof 2: broken app, replay must fail (healing on for masked mutants: it must survive a heal too)
        await resetApp(cfg, base); await tw.reset(test, false); await tw.arm(m);
        // keep the recording the clean run just committed; whatever Kane writes while the app is
        // broken must not become the test's recording
        const keep = snapshotRecording(test);
        let broken;
        try {
          broken = await runTest(test, { heal: masked, timeout: cfg.timeout, logFile: path.join(fixDir, `${slug(m.id)}_mutant_${attempt}.ndjson`) });
        } finally { keep(); }
        const hits = (await tw.hit()).hits;
        await tw.disarm();
        if (broken.code === 1 && hits > 0) {
          result = 'killed';
          proof = { clean: { code: clean.code, session: clean.sessionId, pack: clean.pack }, mutant: { code: broken.code, session: broken.sessionId, pack: broken.pack, failure: broken.failureReason } };
          added = addedStep(original, edited);
          appendLesson(dir, m, added);
          // show the assertion that was proven, not the agent's own commentary
          console.log(`  attempt ${attempt}: proven. Real app: pass. Broken app: fail.\n  added: "${added}"`);
          break;
        }
        restore();
        previousFailure = broken.code === 0
          ? 'the strengthened test still PASSED on the broken app, so the assertion does not observe the bug. Assert the exact value or state that the bug changes.'
          : `the run on the broken app ended with exit ${broken.code} (${hits ? 'mutant fired' : 'mutant never fired'}), not a clean assertion failure.`;
        console.log(`  attempt ${attempt}: not proven (${previousFailure.split('.')[0]}), reverted`);
      }
      const rec = { at: new Date().toISOString(), id: m.id, describe: m.describe, operator: m.operator, status_before: row.status, test, agent, attempts: Math.min(attempt, maxAttempts), result, proof, note, added: added || undefined };
      fs.appendFileSync(path.join(dir, 'fixes.jsonl'), JSON.stringify(rec) + '\n');
      // The proof's mutant run is a Kane run in which the strengthened suite caught this bug.
      // Appending a step cannot un-catch any other mutant (earlier failures still fail first),
      // so the run's score is updated by a superseding ledger row, marked as a fix.
      if (result === 'killed') appendLedger(dir, { ...row, status: 'killed', killed_by: test, fixed: true, fix: { at: rec.at, attempts: rec.attempts, proof } });
      if (result === 'killed') fixed++;
    }
    console.log(`\n${fixed} of ${todo.length} survivors now caught, each proven by a passing clean run and a failing mutant run.`);
    console.log('Re-score with: tripwire run');
    const { writeReport } = await import('../report.js');
    writeReport(dir);
    return fixed === todo.length ? 0 : 1;
  });
}
