#!/usr/bin/env node
// A stand-in for kane-cli used by the runner tests, so the loop can be tested without credits.
// `testmd run foo_test.md` reads foo_test.fake.json: { "steps": [ { "method", "path", "body", "expect": { "path", "equals" } } ] }
// and replays it against FAKE_BASE (the proxy). Exit 0 if every expectation holds, 1 otherwise.
import fs from 'node:fs';

const [cmd, sub, file] = process.argv.slice(2);
const emit = (o) => process.stdout.write(JSON.stringify(o) + '\n');

// FAKE_TRANSIENT=<counter file>:<n> fails the first n runs the way Kane does when Test Manager is down
if (process.env.FAKE_TRANSIENT && cmd === 'testmd') {
  const [file, n] = process.env.FAKE_TRANSIENT.split('|');
  const seen = fs.existsSync(file) ? Number(fs.readFileSync(file, 'utf8')) : 0;
  if (seen < Number(n)) {
    fs.writeFileSync(file, String(seen + 1));
    process.stderr.write('error: TMS did not return an org_id. Run `kane-cli login` again.\n');
    process.exitCode = 2;
    process.stdout.write('{"type":"stream_start"}\n');
    await new Promise((r) => setTimeout(r, 10));
    process.exit();
  }
}
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
if (!ok) emit({ type: 'test_md_bug_verdict', confirmed: false, family: 'automation_bug', category: 'locator_rot', confidence: 0.9, bug_title: 'stale assertion' });
if (!ok) emit({ type: 'test_md_step_end', step_index: 1, status: 'failed' });
emit({ type: 'test_md_done', overall_status: ok ? 'passed' : 'failed', session_id: 'fake-' + Date.now() });
process.exitCode = ok ? 0 : 1; // not process.exit(): it can abort on Windows while fetch sockets close
