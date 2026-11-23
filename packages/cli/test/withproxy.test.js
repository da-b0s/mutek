// withProxy reuses a matching proxy, refuses a stale or mis-targeted one, and explains a busy port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { freePort } from './helpers.js';
import { withProxy } from '../src/commands/run.js';
import { createProxy } from '../src/proxy.js';

test('reuses a running proxy built from the same code', async () => {
  const port = await freePort();
  const p = createProxy({ target: 'http://localhost:3999', port });
  await p.listen();
  try {
    const started = await withProxy({ port, app: 'http://localhost:3999' }, async (tw, base, own) => own);
    assert.equal(started, false);
  } finally { await p.close(); }
});

test('refuses a proxy that points at another app', async () => {
  const port = await freePort();
  const p = createProxy({ target: 'http://localhost:3999', port });
  await p.listen();
  try {
    await assert.rejects(withProxy({ port, app: 'http://localhost:4000' }, async () => 0), /points at/);
  } finally { await p.close(); }
});

test('refuses a proxy from different code', async () => {
  const port = await freePort();
  const fake = http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, target: 'http://localhost:3999', code: 'old' })); });
  await new Promise((r) => fake.listen(port, r));
  try {
    await assert.rejects(withProxy({ port, app: 'http://localhost:3999' }, async () => 0), /different code/);
  } finally { await new Promise((r) => fake.close(r)); }
});

test('explains a port taken by something else', async () => {
  const port = await freePort();
  const other = http.createServer((req, res) => res.end('not mutek'));
  await new Promise((r) => other.listen(port, r));
  try {
    await assert.rejects(withProxy({ port, app: 'http://localhost:3999' }, async () => 0), /not a mutek proxy/);
  } finally { await new Promise((r) => other.close(r)); }
});
