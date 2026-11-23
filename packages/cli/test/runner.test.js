// End-to-end runner test with a fake kane-cli: baseline, generate, replay, classify, ledger, report.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startShop, freePort } from './helpers.js';
import run from '../src/commands/run.js';
import check from '../src/commands/check.js';
import { readLedger } from '../src/ledger.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let shop, work, cwd0;
const run_ = (args) => run(args, parseArgs);

before(async () => {
  shop = await startShop();
  const port = await freePort();
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-run-'));
  cwd0 = process.cwd();
  process.chdir(work);
  process.env.MUTEK_KANE = `"${process.execPath}" "${path.join(here, 'fake-kane.mjs')}"`;
  process.env.FAKE_BASE = `http://localhost:${port}`;
  fs.writeFileSync('mutek.config.json', JSON.stringify({ app: shop.url, port, reset: { url: shop.url + '/api/__reset' }, maxMutants: 50, healCheck: false }));
  fs.mkdirSync('tests');
  // A weak test: adds to cart, only checks the request "worked".
  fs.writeFileSync('tests/weak_test.md', '## Add\nAdd an item.\n');
  fs.writeFileSync('tests/weak_test.fake.json', JSON.stringify({ steps: [
    { path: '/api/products' },
    { method: 'POST', path: '/api/cart/items', body: { productId: 'p2', qty: 1 } },
    { path: '/api/cart' }
  ] }));
  // A strong test: checks the totals it sees.
  fs.writeFileSync('tests/strong_test.md', '## Coupon\nApply a coupon.\n');
  fs.writeFileSync('tests/strong_test.fake.json', JSON.stringify({ steps: [
    { method: 'POST', path: '/api/cart/items', body: { productId: 'p2', qty: 2 }, expect: { status: 200 } },
    { path: '/api/cart', expect: { path: '$.subtotal', equals: 69 } },
    { method: 'POST', path: '/api/cart/coupon', body: { code: 'SAVE10' }, expect: { status: 200 } },
    { path: '/api/cart', expect: { path: '$.total', equals: 62.1 } }
  ] }));
});

after(() => { process.chdir(cwd0); shop.stop(); delete process.env.MUTEK_KANE; });

test('run classifies mutants and writes ledger and report', async () => {
  const code = await run([], parseArgs);
  assert.equal(code, 0);
  const rows = readLedger(path.join(work, '.mutek'));
  assert.ok(rows.length > 5);
  const by = (id) => rows.find((r) => r.id === id);
  // the strong test checks the total, so drifting it is caught
  assert.equal(by('number-drift:GET /api/cart:$.total').status, 'killed');
  assert.equal(by('number-drift:GET /api/cart:$.total').killed_by, 'tests/strong_test.md');
  // nobody re-reads after the coupon is applied with a failed write... silent-fail on coupon: strong test expects 200
  assert.equal(by('silent-fail:POST /api/cart/coupon').status, 'killed');
  // the weak test never checks anything, so a dropped add-to-cart from the weak test alone survives? both tests touch it;
  // strong test asserts status 200, so it is killed
  assert.equal(by('silent-fail:POST /api/cart/items').status, 'killed');
  // validation-off never fires because no test sends invalid input
  assert.equal(by('validation-off:POST /api/cart/coupon').status, 'not-reached');
  assert.ok(rows.some((r) => r.status === 'survived'), 'some mutants survive the weak suite');
  assert.ok(fs.existsSync(path.join(work, '.mutek/report/index.html')));
  assert.match(fs.readFileSync(path.join(work, '.mutek/report/badge.svg'), 'utf8'), /mutek/);
  const html = fs.readFileSync(path.join(work, '.mutek/report/index.html'), 'utf8');
  assert.match(html, /How Kane's triage read the planted bugs/);
  assert.match(html, /automation bug<\/strong> \/ locator rot/);
  assert.equal(by('number-drift:GET /api/cart:$.total').runs.find((x) => x.code === 1).kaneTriage.category, 'locator_rot');
  assert.ok(fs.existsSync(path.join(work, '.mutek/traffic.json')));
});

test('resume continues an interrupted run without redoing finished mutants', async () => {
  const dir = path.join(work, '.mutek');
  const rows = readLedger(dir);
  const run = rows.at(-1).run;
  const mine = rows.filter((r) => r.run === run);
  // pretend the run died after its first 3 mutants
  fs.writeFileSync(path.join(dir, 'ledger.jsonl'), rows.filter((r) => r.run !== run).concat(mine.slice(0, 3)).map((r) => JSON.stringify(r)).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'current-run.json'), JSON.stringify({ run, picked: mine.map((r) => r.id) }));
  assert.equal(await run_(['--resume']), 0);
  const after = readLedger(dir).filter((r) => r.run === run);
  assert.equal(after.length, mine.length, 'every picked mutant has exactly one row');
  assert.deepEqual(after.slice(0, 3).map((r) => r.at), mine.slice(0, 3).map((r) => r.at), 'finished mutants were not re-run');
  assert.ok(!fs.existsSync(path.join(dir, 'current-run.json')));
  await assert.rejects(run_(['--resume']), /nothing to resume/);
});

test('check fails below the threshold and passes above it', async () => {
  assert.equal(await check(['--threshold', '100'], parseArgs), 1);
  assert.equal(await check(['--threshold', '0'], parseArgs), 0);
});

test('the gate can set aside flagged suspected equivalents; the score still counts them', async () => {
  const { gateScore } = await import('../src/commands/check.js');
  const rows = [
    { id: 'a', status: 'killed' }, { id: 'b', status: 'killed' }, { id: 'c', status: 'killed' },
    { id: 'd', status: 'survived', suspectedEquivalent: 'no page changed' },
    { id: 'e', status: 'survived' }
  ];
  assert.equal(gateScore(rows, false).score, 60);
  const g = gateScore(rows, true);
  assert.equal(g.score, 75, 'only the flagged survivor is set aside');
  assert.equal(g.setAside, 1);
});
