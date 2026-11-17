// tripwire check: exit 1 when the latest score is below the threshold. Used by the Stop hook and CI.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { readLedger, latest, lastRunId, score } from '../ledger.js';

export default async function check(argv, parseArgs) {
  const { values } = parseArgs({ args: argv, options: { threshold: { type: 'string' }, dir: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) { console.log('tripwire check [--threshold 80] [--json]   exit 1 if the latest mutation score is below the threshold'); return 0; }
  const cfg = loadConfig();
  const dir = path.resolve(values.dir || cfg.dir);
  const threshold = Number(values.threshold ?? cfg.threshold);
  const rows = readLedger(dir);
  if (!rows.length) {
    console.log('tripwire: no runs yet. Run `tripwire run` first.');
    return 1;
  }
  const s = score(latest(rows, lastRunId(rows)));
  const survivors = latest(rows, lastRunId(rows)).filter((r) => r.status === 'survived' || r.status === 'masked');
  const ok = s.score !== null && s.score >= threshold;
  if (values.json) console.log(JSON.stringify({ ok, threshold, ...s, survivors: survivors.map((r) => r.describe) }));
  else {
    console.log(`tripwire: score ${s.score ?? '-'}% (threshold ${threshold}%) · killed ${s.killed} · survived ${s.survived} · masked ${s.masked}`);
    if (!ok) for (const r of survivors.slice(0, 8)) console.log(`  - not caught: ${r.describe}`);
  }
  if (fs.existsSync(path.join(dir, 'report', 'index.html')) && !values.json) console.log(`  report: ${path.join(dir, 'report', 'index.html')}`);
  return ok ? 0 : 1;
}
