// Smoke test for the demo shop API: starts its own server on a free port and stops it afterwards.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop } from './helpers.js';

let shop;
before(async () => { shop = await startShop(); });
after(() => shop.stop());

const call = async (method, path, body) => {
  const r = await fetch(shop.url + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};

test('cart, coupon, checkout and cancel behave', async () => {
  await call('POST', '/api/__reset');
  const products = (await call('GET', '/api/products')).body.products;
  assert.equal(products.length, 6);
  let r = await call('POST', '/api/cart/items', { productId: 'p2', qty: 2 });
  assert.equal(r.body.subtotal, 69);
  assert.equal(r.body.shipping, 0);
  r = await call('POST', '/api/cart/coupon', { code: 'save10' });
  assert.equal(r.body.discount, 6.9);
  assert.equal(r.body.total, 62.1);
  r = await call('POST', '/api/cart/coupon', { code: 'NOPE' });
  assert.equal(r.status, 422);
  r = await call('POST', '/api/orders', { name: 'A', email: 'x' });
  assert.equal(r.status, 422);
  assert.ok(r.body.fields.email);
  r = await call('POST', '/api/orders', { name: 'Ada L', email: 'a@b.co', address: '1 Long Street' });
  assert.equal(r.status, 201);
  assert.equal(r.body.total, 62.1);
  const id = r.body.id;
  r = await call('GET', '/api/orders');
  assert.equal(r.body.orders[0].id, id);
  r = await call('POST', `/api/orders/${id}/cancel`);
  assert.equal(r.body.status, 'cancelled');
  r = await call('POST', `/api/orders/${id}/cancel`);
  assert.equal(r.status, 409);
  r = await call('POST', '/api/cart/items', { productId: 'p6' });
  assert.equal(r.status, 422, 'out of stock item is refused');
});

test('serves the storefront', async () => {
  const r = await fetch(shop.url + '/');
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.match(await r.text(), /Fieldnote Goods/);
});
