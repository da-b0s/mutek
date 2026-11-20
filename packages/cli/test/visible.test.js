// A survivor that never changed anything on screen is flagged as a suspected equivalent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baselineLines, showedSomethingNew } from '../src/commands/run.js';
import { profileEntry } from '../src/profile.js';

const page = (text) => ({ kind: 'page', url: '/#/cart', controls: [], text });
const profile = { tests: [profileEntry('t', [], [page('Your cart\nNotebook $9.50\nTotal\n$39.49'), page('Your cart\nNotebook $9.50\nTotal\n$39.49')])] };

test('the same page text is not a visible change', () => {
  const lines = baselineLines(profile, 't');
  assert.equal(lines.counted, true);
  assert.equal(showedSomethingNew([page('Your cart\n Notebook  $9.50 \nTotal\n$39.49')], lines), false);
});

test('a different number on the page is a visible change', () => {
  assert.equal(showedSomethingNew([page('Your cart\nNotebook $9.50\nTotal\n$42.94')], baselineLines(profile, 't')), true);
});

test('a duplicated row is a visible change, even though every line was seen before', () => {
  assert.equal(showedSomethingNew([page('Your cart\nNotebook $9.50\nNotebook $9.50\nTotal\n$39.49')], baselineLines(profile, 't')), true);
});

test('merged snapshots do not inflate counts', () => {
  // two identical snapshots of one page must not make "seen twice" look normal
  assert.equal(baselineLines(profile, 't').get('Notebook $9.50'), 1);
});

test('old baselines without counts cannot tell duplicates apart', () => {
  const old = { tests: [{ test: 't', pages: [{ url: '/', text: 'A\nB' }] }] };
  const lines = baselineLines(old, 't');
  assert.equal(lines.counted, false);
  assert.equal(showedSomethingNew([page('A\nB\nB')], lines), false);
  assert.equal(showedSomethingNew([page('A\nC')], lines), true);
});

test('clicks and other events are ignored', () => {
  assert.equal(showedSomethingNew([{ kind: 'click', control: { text: 'Apply' } }], baselineLines(profile, 't')), false);
});
