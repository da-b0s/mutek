// A survivor that never changed anything on screen is flagged as a suspected equivalent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baselineLines, showedSomethingNew } from '../src/commands/run.js';

const profile = { tests: [{ test: 't', pages: [{ url: '/#/cart', text: 'Your cart\nSubtotal\n$34.50\nTotal\n$39.49' }] }] };

test('the same page text is not a visible change', () => {
  const lines = baselineLines(profile, 't');
  assert.equal(showedSomethingNew([{ kind: 'page', text: 'Your cart\n Subtotal \n$34.50\nTotal\n$39.49' }], lines), false);
});

test('a different number on the page is a visible change', () => {
  const lines = baselineLines(profile, 't');
  assert.equal(showedSomethingNew([{ kind: 'page', text: 'Your cart\nSubtotal\n$37.95\nTotal\n$42.94' }], lines), true);
});

test('clicks and other events are ignored', () => {
  assert.equal(showedSomethingNew([{ kind: 'click', control: { text: 'Apply' } }], baselineLines(profile, 't')), false);
});
