// mutek check: exit 1 when the latest score is below the threshold. Used by the Stop hook and CI.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { readLedger, latest, lastRunId, score } from '../ledger.js';

const HELP = `mutek check [--threshold 80] [--json] [--allow-suspected-equivalents]

  exit 1 if the latest mutation score is below the threshold

  --allow-suspected-equivalents   for the pass/fail decision only, leave out survivors that Mutek
                                  flagged as suspected equivalents (they fired but no page ever
                                  changed). The reported score still counts them.`;

// The score the gate decides on: optionally without flagged suspected equivalents.
export function gateScore(rows, allowSuspected) {
  const kept = allowSuspected ? rows.filter((r) => !(r.status === 'survived' && r.suspectedEquivalent)) : rows;
  return { ...score(kept), setAside: rows.length - kept.length };
}

export default async function check(argv, parseArgs) {
  const { values } = parseArgs({ args: argv, options: { threshold: { type: 'string' }, dir: { type: 'string' }, json: { type: 'boolean' }, 'allow-suspected-equivalents': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) { console.log(HELP); return 0; }
  const cfg = loadConfig();
  const dir = path.resolve(values.dir || cfg.dir);
  const threshold = Number(values.threshold ?? cfg.threshold);
  const rows = readLedger(dir);
  if (!rows.length) {
    console.log('mutek: no runs yet. Run `mutek run` first.');
    return 1;
  }
  const current = latest(rows, lastRunId(rows));
  const s = score(current);
  const g = gateScore(current, values['allow-suspected-equivalents']);
  const survivors = current.filter((r) => r.status === 'survived' || r.status === 'masked');
  const ok = g.score !== null && g.score >= threshold;
  if (values.json) console.log(JSON.stringify({ ok, threshold, ...s, gateScore: g.score, setAside: g.setAside, survivors: survivors.map((r) => r.describe) }));
  else {
    console.log(`mutek: score ${s.score ?? '-'}% (threshold ${threshold}%) · killed ${s.killed} · survived ${s.survived} · masked ${s.masked}`);
    if (g.setAside) console.log(`  gate: ${g.score ?? '-'}% with ${g.setAside} suspected equivalent(s) set aside (--allow-suspected-equivalents)`);
    if (!ok) for (const r of survivors.filter((r) => !(values['allow-suspected-equivalents'] && r.suspectedEquivalent)).slice(0, 8)) console.log(`  - not caught: ${r.describe}`);
  }
  if (fs.existsSync(path.join(dir, 'report', 'index.html')) && !values.json) console.log(`  report: ${path.join(dir, 'report', 'index.html')}`);
  return ok ? 0 : 1;
}
