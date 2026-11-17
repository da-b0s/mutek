// The closed loop with a fake agent and fake kane: survivor -> agent edit -> two-run proof.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startShop, freePort } from './helpers.js';
import run from '../src/commands/run.js';
import fix, { appendOnly, buildPrompt } from '../src/commands/fix.js';
import { readLedger, latest, lastRunId } from '../src/ledger.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let shop, work, cwd0;
const TOTAL_ID = 'number-drift:GET /api/cart:$.total';

before(async () => {
  shop = await startShop();
  const port = await freePort();
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-fix-'));
  cwd0 = process.cwd();
  process.chdir(work);
  process.env.TRIPWIRE_KANE = `"${process.execPath}" "${path.join(here, 'fake-kane.mjs')}"`;
  process.env.TRIPWIRE_AGENT_CMD = `"${process.execPath}" "${path.join(here, 'fake-agent.mjs')}"`;
  process.env.FAKE_BASE = `http://localhost:${port}`;
  fs.writeFileSync('tripwire.config.json', JSON.stringify({ app: shop.url, port, reset: { url: shop.url + '/api/__reset' }, healCheck: false, tests: 'tests/*_test.md' }));
  fs.mkdirSync('tests');
  fs.writeFileSync('tests/cart_test.md', '## Add\nAdd the pour-over set to the cart.\n');
  fs.writeFileSync('tests/cart_test.fake.json', JSON.stringify({ expectTotal: 39.49, steps: [
    { method: 'POST', path: '/api/cart/items', body: { productId: 'p2', qty: 1 }, expect: { status: 200 } },
    { path: '/api/cart' }
  ] }));
  assert.equal(await run(['--only', 'number-drift'], parseArgs), 0);
});

after(() => { process.chdir(cwd0); shop.stop(); delete process.env.TRIPWIRE_KANE; delete process.env.TRIPWIRE_AGENT_CMD; delete process.env.FAKE_AGENT_MODE; });

const rowFor = (id) => latest(readLedger('.tripwire'), lastRunId(readLedger('.tripwire'))).find((r) => r.id === id);
const fixes = () => fs.readFileSync('.tripwire/fixes.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('appendOnly accepts one new step and nothing else', () => {
  const base = '---\nurl: x\n---\n## A\nDo a.\n';
  assert.equal(appendOnly(base, base + '\n## B\nVerify b.\n'), null);
  assert.match(appendOnly(base, base.replace('Do a.', 'Do less.') + '\n## B\nVerify b.\n'), /changed/);
  assert.match(appendOnly(base, base), /nothing/);
  assert.match(appendOnly(base, base + '\n## B\nx\n## C\ny\n'), /exactly one/);
});

test('prompt carries the bug, the change and the rules', () => {
  const p = buildPrompt({ m: { describe: 'Total shows 43.44 instead of 39.49', expect: 'The displayed total is checked' }, test: 't_test.md', testText: '## A', change: '$.total: 39.49 -> 43.44' });
  assert.match(p, /still PASSED/);
  assert.match(p, /APPENDING exactly one new step/);
  assert.match(p, /Do not change any application code/);
});

test('the baseline suite lets the total drift survive', () => {
  assert.equal(rowFor(TOTAL_ID).status, 'survived');
});

test('a test edit that rewrites existing steps is rejected and reverted', async () => {
  process.env.FAKE_AGENT_MODE = 'cheat';
  const before = fs.readFileSync('tests/cart_test.md', 'utf8');
  assert.equal(await fix(['--only', TOTAL_ID, '--max-attempts', '1'], parseArgs), 1);
  assert.equal(fs.readFileSync('tests/cart_test.md', 'utf8'), before);
  assert.equal(fixes().at(-1).result, 'gave-up');
});

test('an assertion that does not observe the bug fails the proof and is reverted', async () => {
  process.env.FAKE_AGENT_MODE = 'weak';
  const before = fs.readFileSync('tests/cart_test.md', 'utf8');
  assert.equal(await fix(['--only', TOTAL_ID, '--max-attempts', '1'], parseArgs), 1);
  assert.equal(fs.readFileSync('tests/cart_test.md', 'utf8'), before, 'test restored');
});

test('a real assertion is proven: passes on the real app, fails on the broken one', async () => {
  // reset the fake spec (the weak attempt's sidecar edit is not part of the test file revert)
  const spec = JSON.parse(fs.readFileSync('tests/cart_test.fake.json', 'utf8'));
  spec.steps = spec.steps.slice(0, 2);
  fs.writeFileSync('tests/cart_test.fake.json', JSON.stringify(spec));
  process.env.FAKE_AGENT_MODE = 'good';
  assert.equal(await fix(['--only', TOTAL_ID], parseArgs), 0);
  const f = fixes().at(-1);
  assert.equal(f.result, 'killed');
  assert.equal(f.proof.clean.code, 0);
  assert.equal(f.proof.mutant.code, 1);
  assert.match(fs.readFileSync('tests/cart_test.md', 'utf8'), /## Check the total/);
  assert.match(fs.readFileSync('.tripwire/lessons.md', 'utf8'), /displayed total/);
  // and a fresh run now kills it
  assert.equal(await run(['--only', 'number-drift'], parseArgs), 0);
  assert.equal(rowFor(TOTAL_ID).status, 'killed');
});
