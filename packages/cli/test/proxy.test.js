import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, freePort } from './helpers.js';
import { createProxy, proxyClient } from '../src/proxy.js';

let shop, proxy, base, tw;
before(async () => {
  shop = await startShop();
  proxy = createProxy({ target: shop.url, port: await freePort() });
  const port = await proxy.listen();
  base = `http://localhost:${port}`;
  tw = proxyClient(base);
});
after(async () => { await proxy.close(); shop.stop(); });
beforeEach(async () => { await tw.disarm(); await fetch(base + '/api/__reset', { method: 'POST' }); await tw.reset('t', false); });

const call = async (method, path, body, headers = {}) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body) });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: r.status, json, text, headers: r.headers };
};

test('passes through when disarmed and records traffic', async () => {
  const r = await call('GET', '/api/cart');
  assert.equal(r.status, 200);
  assert.equal(r.json.total, 0);
  const traffic = await tw.traffic();
  assert.equal(traffic.length, 1);
  assert.equal(traffic[0].path, '/api/cart');
  assert.equal(traffic[0].test, 't');
});

test('number-drift changes one value and reports a hit', async () => {
  await call('POST', '/api/cart/items', { productId: 'p2', qty: 1 });
  await tw.arm({ id: 'nd', match: { method: 'GET', path: '/api/cart' }, action: { type: 'json', ops: [{ op: 'add', path: '$.total', value: 1 }] } });
  const r = await call('GET', '/api/cart');
  assert.equal(r.json.total, 40.49); // 34.50 + 4.99 shipping, drifted by 1
  assert.equal(r.json.subtotal, 34.5);
  assert.equal((await tw.hit()).hits, 1);
});

test('a mutant that never matches is not reached', async () => {
  await tw.arm({ id: 'x', match: { method: 'GET', path: '/api/nowhere' }, action: { type: 'json', ops: [{ op: 'add', path: '$.total', value: 1 }] } });
  await call('GET', '/api/cart');
  assert.equal((await tw.hit()).fired, false);
});

test('silent-fail drops the write and returns 500', async () => {
  await tw.arm({ id: 'sf', match: { method: 'POST', path: '/api/cart/items' }, action: { type: 'respond', status: 500 } });
  const r = await call('POST', '/api/cart/items', { productId: 'p1' });
  assert.equal(r.status, 500);
  await tw.disarm();
  assert.equal((await call('GET', '/api/cart')).json.count, 0, 'the app never saw the write');
});

test('fake-success returns a recorded body without forwarding', async () => {
  await tw.arm({ id: 'fs', match: { method: 'POST', path: '/api/cart/items' }, action: { type: 'respond', status: 200, body: { items: [], count: 1 } } });
  const r = await call('POST', '/api/cart/items', { productId: 'p1' });
  assert.equal(r.status, 200);
  await tw.disarm();
  assert.equal((await call('GET', '/api/cart')).json.count, 0);
});

test('double-apply forwards the write twice', async () => {
  await tw.arm({ id: 'da', match: { method: 'POST', path: '/api/cart/items' }, action: { type: 'forward-twice' } });
  const r = await call('POST', '/api/cart/items', { productId: 'p1', qty: 1 });
  assert.equal(r.json.count, 2);
});

test('validation-off turns 422 into 200', async () => {
  await tw.arm({ id: 'vo', match: { method: 'POST', path: '/api/cart/coupon' }, action: { type: 'status-map', from: [400, 422], to: 200 } });
  const r = await call('POST', '/api/cart/coupon', { code: 'BOGUS' });
  assert.equal(r.status, 200);
});

test('stale-read serves the body from before the last write', async () => {
  await tw.arm({ id: 'sr', match: { method: 'GET', path: '/api/cart' }, action: { type: 'stale-read' } });
  assert.equal((await call('GET', '/api/cart')).json.count, 0);
  await call('POST', '/api/cart/items', { productId: 'p1', qty: 1 });
  assert.equal((await call('GET', '/api/cart')).json.count, 0, 'still the old cart');
  assert.equal((await tw.hit()).hits, 1);
});

test('auth-drop with times: 1 fires once', async () => {
  await tw.arm({ id: 'ad', times: 1, match: { method: 'GET', path: '/api/orders' }, action: { type: 'respond', status: 401 } });
  assert.equal((await call('GET', '/api/orders')).status, 401);
  assert.equal((await call('GET', '/api/orders')).status, 200);
});

test('record mode injects the recorder; dom mutants inject the mutator', async () => {
  await tw.reset('t', true);
  let r = await call('GET', '/', null, { accept: 'text/html' });
  assert.match(r.text, /__tw-recorder/);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  await tw.reset('t', false);
  await tw.arm({ id: 'hc', match: { document: true }, action: { type: 'dom', dom: { op: 'hide', target: { role: 'button', text: 'Remove' } } } });
  r = await call('GET', '/', null, { accept: 'text/html' });
  assert.doesNotMatch(r.text, /__tw-recorder/);
  assert.match(r.text, /window.__TW_MUTANT=\{"id":"hc"/);
  // the page reports the hit itself
  await fetch(base + '/_tw/fired', { method: 'POST', body: JSON.stringify({ id: 'hc' }) });
  assert.equal((await tw.hit()).hits, 1);
});
