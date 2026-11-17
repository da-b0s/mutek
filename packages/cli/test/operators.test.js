// Operators run against a real recorded profile: the demo shop's cart flow captured through the proxy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { profileEntry } from '../src/profile.js';
import { generateAll, select, OPERATORS } from '../operators/index.js';
import { validateMutant } from '../src/mutant.js';
import { applyJsonOps } from '../src/actions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/manual_cart.json'), 'utf8'));
const profile = { tests: [profileEntry('tests/cart_test.md', fx.traffic, fx.dom)] };
const { candidates } = generateAll(profile, { dir: path.join(here, 'no-such-dir') });
const byOp = (op) => candidates.filter((m) => m.operator === op);

test('17 built-in operators plus the saboteur', () => {
  assert.equal(OPERATORS.length, 18);
  assert.equal(new Set(OPERATORS.map((o) => o.name)).size, 18);
});

test('every generated mutant is valid and touches a test', () => {
  assert.ok(candidates.length > 30);
  for (const m of candidates) {
    assert.deepEqual(validateMutant(m), [], m.id);
    assert.ok(m.touches_tests.length > 0, m.id);
  }
  assert.equal(new Set(candidates.map((m) => m.id)).size, candidates.length, 'ids are unique');
});

test('number-drift targets values the user actually saw, totals first', () => {
  const nd = byOp('number-drift');
  assert.ok(nd.some((m) => m.id === 'number-drift:GET /api/cart:$.total'));
  for (const m of nd) assert.ok(!/stock/.test(m.id), 'stock is never shown as a number, so drifting it is equivalent');
});

test('live counts become one pattern control, not one per value', () => {
  const cart = byOp('hide-control').filter((m) => /Cart/.test(m.id));
  assert.equal(cart.length, 1);
  assert.ok(cart[0].action.dom.target.pattern);
});

test('behaviour mutants come from the writes the suite made', () => {
  assert.deepEqual(byOp('silent-fail').map((m) => m.match.method + ' ' + m.match.path).sort(),
    ['POST /api/cart/coupon', 'POST /api/cart/items', 'PUT /api/cart/items/p2']);
  assert.ok(byOp('double-apply').every((m) => m.match.method === 'POST' || m.match.method === 'PATCH'), 'PUT is idempotent');
  const fake = byOp('fake-success').find((m) => m.match.path === '/api/cart/items');
  assert.equal(fake.action.body.count, 1, 'replays the recorded success body');
  assert.equal(byOp('stale-read')[0].match.path, '/api/cart');
});

test('select spreads across operators', () => {
  const picked = select(candidates, 15);
  assert.equal(picked.length, 15);
  assert.ok(new Set(picked.map((m) => m.operator)).size >= 12);
});

test('json ops', () => {
  const body = { items: [{ a: 1, n: 'x', m: 'y' }, { a: 2 }], total: 10 };
  assert.equal(applyJsonOps(body, [{ op: 'scale', path: '$.total', value: 1.1 }]).body.total, 11);
  assert.equal(applyJsonOps(body, [{ op: 'remove-index', path: '$.items', index: 0 }]).body.items.length, 1);
  assert.equal(applyJsonOps(body, [{ op: 'dup-index', path: '$.items', index: 0 }]).body.items.length, 3);
  assert.equal(applyJsonOps(body, [{ op: 'swap', path: '$.items[0]', a: 'n', b: 'm' }]).body.items[0].n, 'y');
  assert.equal(applyJsonOps(body, [{ op: 'add', path: '$.nope', value: 1 }]).changed, false);
  assert.equal(body.total, 10, 'input is not modified');
});
