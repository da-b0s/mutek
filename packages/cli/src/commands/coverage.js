// tripwire coverage: a third state on top of Kane's "proven vs owed".
//   owed                  no test checks the criterion
//   proven                its tests pass on the real app and caught every mutant that broke it
//   proven but unguarded  its tests pass, but a mutant that broke the criterion got past them
// The agent maps criteria to tests and mutants to criteria (written to .tripwire/criteria.json,
// reviewable and editable); the states are computed from the ledger. When the project has a Kane
// assurance store (.context/), Kane's own per-criterion status is shown alongside.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, findTests } from '../config.js';
import { readLedger, latest, lastRunId } from '../ledger.js';
import { runAgent } from '../agent.js';
import { runKane } from '../kane.js';
import { writeReport } from '../report.js';

const HELP = `tripwire coverage [options]

  --criteria <file>      acceptance criteria with ids like AC1, AC2 (default ACCEPTANCE.md)
  --remap                ask the agent to rebuild .tripwire/criteria.json
  --agent claude|codex   which agent maps criteria (default from config)
  --dir <path>           state directory (default .tripwire)`;

export function parseCriteria(md) {
  const out = [];
  for (const m of md.matchAll(/^\s*[-*]?\s*(AC\d+)[.:)]\s*(.+)$/gm)) out.push({ id: m[1], text: m[2].trim() });
  return out;
}

// Pure: compute each criterion's state from the mapping and the ledger rows.
export function computeCoverage(criteria, mapping, rows, kaneStatus = {}) {
  const testsFor = mapping.criteria || {};
  const mutantsFor = {};
  for (const [mid, acs] of Object.entries(mapping.mutants || {})) for (const ac of [].concat(acs)) (mutantsFor[ac] ||= []).push(mid);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return criteria.map((c) => {
    const tests = testsFor[c.id] || [];
    const related = (mutantsFor[c.id] || []).map((id) => byId.get(id)).filter(Boolean).filter((r) => r.status !== 'not-reached' && r.status !== 'error');
    const escaped = related.filter((r) => r.status === 'survived' || r.status === 'masked');
    const caught = related.filter((r) => r.status === 'killed');
    let state;
    if (!tests.length) state = 'owed';
    else if (escaped.length) state = 'proven but unguarded';
    else if (caught.length) state = 'proven and guarded';
    else state = 'proven, untested by mutants';
    return {
      id: c.id, criterion: `${c.id}. ${c.text}`, tests, state,
      kane: kaneStatus[c.id] || (tests.length ? 'green (tests pass)' : 'owed'),
      caught: caught.map((r) => r.describe), escaped: escaped.map((r) => r.describe)
    };
  });
}

async function kaneCover(cwd) {
  if (!fs.existsSync(path.join(cwd, '.context'))) return {};
  const r = await runKane(['cover', '--json'], { cwd, killAfterMs: 120000 });
  const status = {};
  try {
    const doc = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
    JSON.stringify(doc, (k, v) => { if (v && typeof v === 'object' && /^AC\d+$/i.test(v.ac_ref || v.ref || '') && v.execution) status[(v.ac_ref || v.ref).toUpperCase()] = v.execution; return v; });
  } catch { /* no usable Kane coverage */ }
  return status;
}

export default async function coverage(argv, parseArgs) {
  const { values } = parseArgs({ args: argv, options: { criteria: { type: 'string' }, remap: { type: 'boolean' }, agent: { type: 'string' }, dir: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) { console.log(HELP); return 0; }
  const cfg = loadConfig();
  const dir = path.resolve(values.dir || cfg.dir);
  const critFile = values.criteria || 'ACCEPTANCE.md';
  if (!fs.existsSync(critFile)) throw new Error(`no acceptance criteria at ${critFile}`);
  const criteria = parseCriteria(fs.readFileSync(critFile, 'utf8'));
  if (!criteria.length) throw new Error(`${critFile} has no criteria in the form "AC1. ..."`);
  const rowsAll = readLedger(dir);
  if (!rowsAll.length) throw new Error('no ledger yet: run `tripwire run` first');
  const rows = latest(rowsAll, lastRunId(rowsAll));
  const mapFile = path.join(dir, 'criteria.json');

  if (values.remap || !fs.existsSync(mapFile)) {
    const tests = findTests(cfg.tests);
    const prompt = `Map acceptance criteria to end-to-end tests and to planted bugs. Write JSON to ${mapFile}:
{ "criteria": { "AC1": ["tests/x_test.md", ...], ... }, "mutants": { "<mutant id>": ["AC3", ...], ... } }
- criteria: for each AC, the test files that contain a step which actually CHECKS that criterion (a "Verify ..." of its outcome). A test that only passes through a page does not count. Use [] when no test checks it.
- mutants: for each mutant id below, the ACs that the bug breaks. Use [] when it breaks none.
Be strict and literal. Do not edit any other file.

----- Acceptance criteria -----
${criteria.map((c) => `${c.id}. ${c.text}`).join('\n')}

----- Tests -----
${tests.map((t) => `# ${t}\n${fs.readFileSync(t, 'utf8')}`).join('\n\n')}

----- Mutants (id: what breaks) -----
${rows.map((r) => `${r.id}: ${r.describe}`).join('\n')}

Reply with "done" when the file is written.`;
    fs.writeFileSync(path.join(dir, 'coverage_prompt.txt'), prompt);
    console.log(`Asking ${values.agent || cfg.agent} to map ${criteria.length} criteria to tests and mutants...`);
    const r = await runAgent(values.agent || cfg.agent, prompt);
    if (r.code === 127) throw new Error(`could not start the agent CLI: ${r.stderr.trim()}`);
    if (!fs.existsSync(mapFile)) throw new Error(`the agent did not write ${mapFile}; its reply: ${r.stdout.slice(-500)}`);
  }
  const mapping = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  const result = computeCoverage(criteria, mapping, rows, await kaneCover(process.cwd()));
  fs.writeFileSync(path.join(dir, 'coverage.json'), JSON.stringify(result, null, 2));
  const count = (s) => result.filter((x) => x.state === s).length;
  for (const x of result) console.log(`  ${x.state.padEnd(28)} ${x.criterion.slice(0, 90)}${x.escaped.length ? `\n${' '.repeat(32)}got past: ${x.escaped.join('; ')}` : ''}`);
  console.log(`\n${criteria.length} criteria: ${count('proven and guarded')} proven and guarded · ${count('proven but unguarded')} proven but unguarded · ${count('proven, untested by mutants')} proven, no mutant touched them · ${count('owed')} owed`);
  writeReport(dir);
  return 0;
}
