import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCriteria, computeCoverage } from '../src/commands/coverage.js';

const md = `# Shop
- AC1. The shop lists every product.
- AC2. SAVE10 takes 10% off.
- AC3. My orders lists only my orders.
- AC4. Delivered orders cannot be cancelled.`;

test('parseCriteria reads AC ids and text', () => {
  const c = parseCriteria(md);
  assert.deepEqual(c.map((x) => x.id), ['AC1', 'AC2', 'AC3', 'AC4']);
  assert.equal(c[1].text, 'SAVE10 takes 10% off.');
});

test('computeCoverage: owed, proven and guarded, proven but unguarded, untested by mutants', () => {
  const rows = [
    { id: 'm-price', status: 'killed', describe: 'price off' },
    { id: 'm-coupon', status: 'survived', describe: 'SAVE10 takes 20%' },
    { id: 'm-owner', status: 'masked', describe: "another user's order" },
    { id: 'm-never', status: 'not-reached', describe: 'never fired' }
  ];
  const mapping = {
    criteria: { AC1: ['tests/browse_test.md'], AC2: ['tests/coupon_test.md'], AC3: ['tests/cancel_order_test.md'], AC4: [] },
    mutants: { 'm-price': ['AC1'], 'm-coupon': ['AC2'], 'm-owner': ['AC3'], 'm-never': ['AC4'] }
  };
  const out = Object.fromEntries(computeCoverage(parseCriteria(md), mapping, rows).map((x) => [x.id, x]));
  assert.equal(out.AC1.state, 'proven and guarded');
  assert.equal(out.AC2.state, 'proven but unguarded');
  assert.deepEqual(out.AC2.escaped, ['SAVE10 takes 20%']);
  assert.equal(out.AC3.state, 'proven but unguarded', 'a heal-masked bug counts as unguarded');
  assert.equal(out.AC4.state, 'owed');
  const noMutants = computeCoverage(parseCriteria(md), { criteria: { AC1: ['t'] }, mutants: {} }, rows);
  assert.equal(noMutants[0].state, 'proven, untested by mutants');
});
