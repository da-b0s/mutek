// tripwire sabotage: the coding agent in its second role. It reads the acceptance criteria, the
// tests and the traffic the suite produced, and proposes domain-specific bugs ("coupon applied
// twice", "free shipping one cent too early") as mutant definitions in .tripwire/saboteur.json.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, findTests } from '../config.js';
import { runAgent } from '../agent.js';
import { loadSaboteur } from '../../operators/agent-proposed.js';

const HELP = `tripwire sabotage [options]

  --agent claude|codex   which agent proposes mutants (default from config)
  --criteria <file>      acceptance criteria / spec to read (default: README.md, docs/*.md if present)
  --count <n>            how many mutants to ask for (default 8)
  --dir <path>           state directory (default .tripwire)`;

function trafficDigest(profile) {
  const seen = new Map();
  for (const t of profile.tests) for (const e of t.traffic) {
    const k = `${e.method} ${e.path}`;
    if (seen.has(k) || e.type !== 'json') continue;
    seen.set(k, `${k} -> ${e.status}${e.req ? `  request ${JSON.stringify(e.req).slice(0, 200)}` : ''}${e.json !== undefined ? `\n    response ${JSON.stringify(e.json).slice(0, 600)}` : ''}`);
  }
  return [...seen.values()].join('\n');
}

export default async function sabotage(argv, parseArgs) {
  const { values } = parseArgs({ args: argv, options: { agent: { type: 'string' }, criteria: { type: 'string' }, count: { type: 'string' }, dir: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) { console.log(HELP); return 0; }
  const cfg = loadConfig();
  const dir = path.resolve(values.dir || cfg.dir);
  const agent = values.agent || cfg.agent || 'claude';
  const trafficFile = path.join(dir, 'traffic.json');
  if (!fs.existsSync(trafficFile)) throw new Error('no baseline yet: run `tripwire run --baseline-only` first');
  const profile = JSON.parse(fs.readFileSync(trafficFile, 'utf8'));
  const tests = findTests(cfg.tests);
  const criteriaFiles = values.criteria ? [values.criteria] : ['ACCEPTANCE.md', 'README.md'].filter((f) => fs.existsSync(f));
  const out = path.join(dir, 'saboteur.json');
  const count = Number(values.count || 8);

  const prompt = `You are the saboteur. Propose ${count} realistic, domain-specific bugs for the web app below, the kind a developer could really ship, that break a business rule a user would notice. Express each one as a Tripwire mutant: a rewrite of one HTTP response the app already sends (the app code is never changed).

Write a JSON array to ${out} (create or overwrite the file). Each element:
{
  "id": "short-kebab-name",
  "describe": "One sentence a user would notice, e.g. 'The 10% coupon takes 20% off'",
  "expect": "What a good test would check",
  "match": { "method": "GET", "path": "/api/..." },
  "action": <one of>
     { "type": "json", "ops": [ { "op": "set"|"add"|"scale"|"remove-index"|"dup-index"|"swap"|"push", "path": "$.field.or[0].nested", "value": ..., "index": 0, "a": "k1", "b": "k2" } ] }
     { "type": "respond", "status": 200, "body": { ...a whole fake response... } }
     { "type": "status-map", "from": [422], "to": 200 }
}
Use only routes and JSON paths that appear in the traffic below. Make every change consistent and visible (for a wrong discount, also set the total the page shows). Prefer rules from the acceptance criteria: discounts, thresholds, limits, ownership, state transitions.

${criteriaFiles.map((f) => `----- ${f} -----\n${fs.readFileSync(f, 'utf8').slice(0, 8000)}`).join('\n\n')}

----- Tests -----
${tests.map((t) => `# ${t}\n${fs.readFileSync(t, 'utf8')}`).join('\n\n').slice(0, 12000)}

----- Traffic recorded while the tests ran -----
${trafficDigest(profile).slice(0, 15000)}

When done, reply with the number of mutants written.`;
  fs.writeFileSync(path.join(dir, 'sabotage_prompt.txt'), prompt);
  console.log(`Asking ${agent} for ${count} domain-specific mutants...`);
  const r = await runAgent(agent, prompt);
  if (r.code === 127) throw new Error(`could not start the ${agent} CLI: ${r.stderr.trim()}`);
  fs.writeFileSync(path.join(dir, 'sabotage_reply.txt'), `${r.stdout}\n----- stderr -----\n${r.stderr}`);
  // Some agents answer with the JSON instead of writing the file: take the largest JSON array.
  if (!fs.existsSync(out)) {
    const arrays = [...r.stdout.matchAll(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/g)].map((x) => x[1]);
    const whole = r.stdout.indexOf('['), last = r.stdout.lastIndexOf(']');
    if (whole >= 0 && last > whole) arrays.push(r.stdout.slice(whole, last + 1));
    for (const a of arrays.sort((x, y) => y.length - x.length)) {
      try { const parsed = JSON.parse(a); if (Array.isArray(parsed) && parsed.length) { fs.writeFileSync(out, JSON.stringify(parsed, null, 2)); break; } } catch { /* try the next */ }
    }
  }
  if (!fs.existsSync(out)) console.log(`The agent did not produce mutants. Its reply is in ${path.join(dir, 'sabotage_reply.txt')}`);
  const { mutants, rejected } = loadSaboteur(dir);
  for (const m of mutants) console.log(`  + ${m.id}: ${m.describe}`);
  for (const x of rejected) console.log(`  - rejected ${x.id}: ${x.errors.join('; ')}`);
  console.log(`${mutants.length} saboteur mutants ready in ${out}. They run first in the next \`tripwire run\`.`);
  return mutants.length ? 0 : 1;
}
