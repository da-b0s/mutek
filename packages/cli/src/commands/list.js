// mutek list: the operator catalogue, and the mutants the last baseline would produce.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { OPERATORS, generateAll } from '../../operators/index.js';
import { loadSaboteur } from '../../operators/agent-proposed.js';

export default async function list(argv, parseArgs) {
  const { values } = parseArgs({ args: argv, options: { dir: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) { console.log('mutek list [--json]   operators, then candidate mutants from .mutek/traffic.json'); return 0; }
  const dir = path.resolve(values.dir || loadConfig().dir);
  const f = path.join(dir, 'traffic.json');
  const profile = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  const gen = profile ? generateAll(profile, { dir }) : null;
  if (values.json) { console.log(JSON.stringify(gen ? gen.candidates : [], null, 2)); return 0; }
  console.log('Operators');
  for (const op of OPERATORS) console.log(`  ${op.family.padEnd(10)} ${op.name.padEnd(19)} ${op.summary}${gen?.counts[op.name] ? `  (${gen.counts[op.name].generated ?? 0})` : ''}`);
  const sab = loadSaboteur(dir);
  if (sab.rejected.length) { console.log('\nRejected saboteur mutants'); for (const r of sab.rejected) console.log(`  ${r.id}: ${r.errors.join('; ')}`); }
  if (!gen) { console.log('\nNo baseline yet: run `mutek run --baseline-only` to see concrete mutants.'); return 0; }
  console.log(`\n${gen.candidates.length} candidate mutants from the last baseline`);
  for (const m of gen.candidates) console.log(`  ${m.operator.padEnd(19)} ${m.describe}`);
  return 0;
}
