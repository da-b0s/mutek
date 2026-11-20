// The Stop hook blocks "done" while tests changed since the last run or the score is too low.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const hook = path.resolve(here, '../../../hooks/stop-hook.mjs');
const cli = path.resolve(here, '../bin/tripwire.js');

function repo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-hook-'));
  execSync('git init -q', { cwd: d });
  fs.writeFileSync(path.join(d, 'tripwire.config.json'), JSON.stringify({ threshold: 80 }));
  return d;
}
const runHook = (cwd) => {
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd }), env: { ...process.env, TRIPWIRE_BIN: `"${process.execPath}" "${cli}"` }, cwd });
  return r.stdout.toString() ? JSON.parse(r.stdout.toString()) : null;
};
const ledgerRow = (status) => JSON.stringify({ run: 'r1', id: `m-${status}-${Math.random()}`, status, describe: `bug ${status}` });

test('allows stopping when the task touched no tests', () => {
  assert.equal(runHook(repo()), null);
});

test('blocks when a test changed after the last run', () => {
  const d = repo();
  fs.mkdirSync(path.join(d, '.tripwire'));
  fs.writeFileSync(path.join(d, '.tripwire/ledger.jsonl'), ledgerRow('killed') + '\n');
  const later = Date.now() / 1000 + 5;
  fs.writeFileSync(path.join(d, 'cart_test.md'), '## A\nDo a.\n');
  fs.utimesSync(path.join(d, 'cart_test.md'), later, later);
  const out = runHook(d);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /tripwire run --since HEAD/);
});

test('blocks below the threshold, allows above it', () => {
  const d = repo();
  fs.mkdirSync(path.join(d, '.tripwire'));
  fs.writeFileSync(path.join(d, '.tripwire/ledger.jsonl'), [ledgerRow('killed'), ledgerRow('survived'), ledgerRow('survived')].join('\n') + '\n');
  const out = runHook(d);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /33\.3%/);
  assert.match(out.reason, /bug survived/);
  fs.writeFileSync(path.join(d, '.tripwire/ledger.jsonl'), [ledgerRow('killed'), ledgerRow('killed'), ledgerRow('killed'), ledgerRow('killed'), ledgerRow('survived')].join('\n') + '\n');
  assert.equal(runHook(d), null);
});

test('agents launched by tripwire itself are never blocked', () => {
  const d = repo();
  fs.mkdirSync(path.join(d, '.tripwire'));
  fs.writeFileSync(path.join(d, '.tripwire/ledger.jsonl'), ledgerRow('survived') + '\n');
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: d }), env: { ...process.env, TRIPWIRE_AGENT: '1', TRIPWIRE_BIN: `"${process.execPath}" "${cli}"` }, cwd: d });
  assert.equal(r.stdout.toString(), '');
});
