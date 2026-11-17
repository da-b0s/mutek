// .tripwire/ledger.jsonl: one line per mutant run. The latest line per mutant id is its current status.
import fs from 'node:fs';
import path from 'node:path';

export const STATUSES = ['killed', 'survived', 'masked', 'not-reached', 'error'];

export function ledgerPath(dir) { return path.join(dir, 'ledger.jsonl'); }

export function appendLedger(dir, row) {
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(ledgerPath(dir), JSON.stringify(row) + '\n');
}

export function readLedger(dir) {
  const f = ledgerPath(dir);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// Latest row per mutant within the most recent run (or all runs for incremental mode).
export function latest(rows, runId) {
  const by = new Map();
  for (const r of rows) if (!runId || r.run === runId) by.set(r.id, r);
  return [...by.values()];
}

export function lastRunId(rows) {
  return rows.length ? rows[rows.length - 1].run : null;
}

// score = killed / (killed + survived + masked). Not-reached and errors are reported, never scored.
export function score(rows) {
  const c = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
  const denom = c.killed + c.survived + c.masked;
  return { ...c, total: rows.length, score: denom ? Math.round((c.killed / denom) * 1000) / 10 : null };
}

// Per-test view: which mutants each test killed, and which it walked past.
export function perTest(rows) {
  const by = new Map();
  const get = (t) => { if (!by.has(t)) by.set(t, { test: t, killed: 0, survivedPast: 0, masked: 0, touched: 0 }); return by.get(t); };
  for (const r of rows) {
    for (const t of r.touches_tests || []) {
      const e = get(t);
      e.touched++;
      if (r.status === 'survived') e.survivedPast++;
      if (r.status === 'masked') e.masked++;
    }
    if (r.status === 'killed' && r.killed_by) get(r.killed_by).killed++;
  }
  return [...by.values()].map((e) => ({ ...e, score: e.killed + e.survivedPast + e.masked ? Math.round((e.killed / (e.killed + e.survivedPast + e.masked)) * 100) : null }));
}
