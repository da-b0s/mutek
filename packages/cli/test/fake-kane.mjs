#!/usr/bin/env node
// A stand-in for kane-cli used by the runner tests, so the loop can be tested without credits.
// `testmd run foo_test.md` reads foo_test.fake.json: { "steps": [ { "method", "path", "body", "expect": { "path", "equals" } } ] }
// and replays it against FAKE_BASE (the proxy). Exit 0 if every expectation holds, 1 otherwise.
import fs from 'node:fs';

const [cmd, sub, file] = process.argv.slice(2);
const emit = (o) => process.stdout.write(JSON.stringify(o) + '\n');

if (cmd === 'balance') { console.log('{"credits": 1000}'); process.exit(0); }
if (cmd === 'evidence' && sub === 'verdict') { process.exit(0); }
if (cmd !== 'testmd' || sub !== 'run') { console.error('fake-kane: unsupported'); process.exit(2); }

const spec = JSON.parse(fs.readFileSync(file.replace(/_test\.md$/, '_test.fake.json'), 'utf8'));
const base = process.env.FAKE_BASE;
const get = (o, p) => p.replace(/^\$\.?/, '').split('.').filter(Boolean).reduce((a, k) => (a == null ? a : a[k]), o);
let ok = true;
let reason;
const seen = [];
for (const s of spec.steps) {
  const r = await fetch(base + s.path, { method: s.method || 'GET', headers: { 'content-type': 'application/json', accept: s.accept || 'application/json' }, body: s.body ? JSON.stringify(s.body) : undefined });
  let json; try { json = await r.json(); } catch { json = null; }
  // pretend the page rendered every value it fetched, the way the browser recorder would report it
  JSON.stringify(json, (k, v) => { if (typeof v === 'number') seen.push(Number.isInteger(v) ? String(v) : v.toFixed(2)); else if (typeof v === 'string') seen.push(v); return v; });
  if (s.expect) {
    if (s.expect.status !== undefined && r.status !== s.expect.status) { ok = false; reason = `${s.path} status ${r.status}`; break; }
    if (s.expect.path && get(json, s.expect.path) !== s.expect.equals) { ok = false; reason = `${s.expect.path} was ${get(json, s.expect.path)}`; break; }
  }
}
await fetch(base + '/_tw/dom', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events: [{ kind: 'page', url: '/', controls: [], text: seen.join('\n') }] }) }).catch(() => {});
emit({ type: 'run_end', status: ok ? 'passed' : 'failed', failure_reason: reason });
emit({ type: 'test_md_done', overall_status: ok ? 'passed' : 'failed', session_id: 'fake-' + Date.now() });
process.exitCode = ok ? 0 : 1; // not process.exit(): it can abort on Windows while fetch sockets close
