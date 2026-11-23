// Mutek demo shop: a small API-driven store (no build step, no dependencies).
// The UI in public/ talks to the JSON API below, which is exactly the traffic
// Mutek mutates. State is in memory; POST /api/__reset restores the seed so
// every Kane run starts from the same place.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);

const PRODUCTS = [
  { id: 'p1', name: 'Canvas Tote Bag', price: 18.0, category: 'Bags', stock: 12, description: 'Heavy cotton tote with an inside pocket.' },
  { id: 'p2', name: 'Ceramic Pour-Over Set', price: 34.5, category: 'Kitchen', stock: 5, description: 'Dripper, carafe and 40 paper filters.' },
  { id: 'p3', name: 'Wool Beanie', price: 22.0, category: 'Apparel', stock: 20, description: 'Merino wool, one size.' },
  { id: 'p4', name: 'Desk Plant (Pothos)', price: 15.75, category: 'Home', stock: 8, description: 'Easy-care trailing plant in a 12 cm pot.' },
  { id: 'p5', name: 'Notebook, Dot Grid', price: 9.5, category: 'Stationery', stock: 40, description: 'A5, 160 pages, lay-flat binding.' },
  { id: 'p6', name: 'Insulated Bottle', price: 27.0, category: 'Kitchen', stock: 0, description: '750 ml, keeps drinks cold for 24 hours.' }
];

const COUPONS = {
  SAVE10: { code: 'SAVE10', kind: 'percent', amount: 10, label: '10% off your order' },
  WELCOME5: { code: 'WELCOME5', kind: 'fixed', amount: 5, minSubtotal: 20, label: '$5 off orders over $20' }
};

const FREE_SHIPPING_FROM = 50;
const SHIPPING_FEE = 4.99;
const CURRENT_USER = { id: 'u1', name: 'Sam Rivera' };

let state;
function seed() {
  state = {
    stock: Object.fromEntries(PRODUCTS.map((p) => [p.id, p.stock])),
    cart: [],
    coupon: null,
    nextOrder: 1003,
    orders: [
      order(1001, [{ productId: 'p5', qty: 2 }], null, 'Sam Rivera', 'sam@example.com', '12 Harbour Road, Lagos', 'delivered', '2026-11-02T10:15:00Z'),
      order(1002, [{ productId: 'p1', qty: 1 }, { productId: 'p4', qty: 1 }], null, 'Sam Rivera', 'sam@example.com', '12 Harbour Road, Lagos', 'placed', '2026-11-14T16:40:00Z')
    ]
  };
}

const money = (n) => Math.round(n * 100) / 100;
const product = (id) => PRODUCTS.find((p) => p.id === id);

function pricing(items, coupon) {
  const lines = items.map((i) => {
    const p = product(i.productId);
    return { productId: p.id, name: p.name, price: p.price, qty: i.qty, lineTotal: money(p.price * i.qty) };
  });
  const subtotal = money(lines.reduce((s, l) => s + l.lineTotal, 0));
  let discount = 0;
  if (coupon) {
    const c = COUPONS[coupon];
    if (c.kind === 'percent') discount = money((subtotal * c.amount) / 100);
    if (c.kind === 'fixed' && subtotal >= (c.minSubtotal || 0)) discount = Math.min(c.amount, subtotal);
  }
  const afterDiscount = money(subtotal - discount);
  const shipping = lines.length === 0 || afterDiscount >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  return { lines, subtotal, discount, shipping, total: money(afterDiscount + shipping) };
}

function order(id, items, coupon, name, email, address, status, createdAt) {
  const p = pricing(items, coupon);
  return {
    id: String(id), owner: CURRENT_USER.id, ownerName: name, email, address, status, createdAt,
    coupon, items: p.lines, subtotal: p.subtotal, discount: p.discount, shipping: p.shipping, total: p.total
  };
}

function cartView() {
  const p = pricing(state.cart, state.coupon);
  return {
    items: p.lines,
    count: p.lines.reduce((s, l) => s + l.qty, 0),
    subtotal: p.subtotal,
    coupon: state.coupon ? COUPONS[state.coupon] : null,
    discount: p.discount,
    shipping: p.shipping,
    freeShippingFrom: FREE_SHIPPING_FROM,
    total: p.total
  };
}

const productView = (p) => ({ ...p, stock: state.stock[p.id], inStock: state.stock[p.id] > 0 });
const orderSummary = (o) => ({ id: o.id, owner: o.owner, ownerName: o.ownerName, status: o.status, createdAt: o.createdAt, itemCount: o.items.reduce((s, i) => s + i.qty, 0), total: o.total });

// ---------- routing ----------
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('GET', '/api/me', () => [200, CURRENT_USER]);
route('GET', '/api/products', () => [200, { products: PRODUCTS.map(productView) }]);
route('GET', '/api/products/:id', ({ id }) => {
  const p = product(id);
  return p ? [200, productView(p)] : [404, { error: 'Product not found' }];
});

route('GET', '/api/cart', () => [200, cartView()]);
route('POST', '/api/cart/items', (_, body) => {
  const p = product(body.productId);
  const qty = Number.isInteger(body.qty) ? body.qty : 1;
  if (!p) return [404, { error: 'Product not found' }];
  if (qty < 1 || qty > 10) return [422, { error: 'Quantity must be between 1 and 10' }];
  const line = state.cart.find((l) => l.productId === p.id);
  const wanted = (line ? line.qty : 0) + qty;
  if (wanted > state.stock[p.id]) return [422, { error: state.stock[p.id] === 0 ? `${p.name} is out of stock` : `Only ${state.stock[p.id]} left in stock` }];
  if (line) line.qty = wanted; else state.cart.push({ productId: p.id, qty });
  return [200, cartView()];
});
route('PUT', '/api/cart/items/:id', ({ id }, body) => {
  const line = state.cart.find((l) => l.productId === id);
  if (!line) return [404, { error: 'That item is not in your cart' }];
  const qty = Number(body.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) return [422, { error: 'Quantity must be between 1 and 10' }];
  if (qty > state.stock[id]) return [422, { error: `Only ${state.stock[id]} left in stock` }];
  line.qty = qty;
  return [200, cartView()];
});
route('DELETE', '/api/cart/items/:id', ({ id }) => {
  state.cart = state.cart.filter((l) => l.productId !== id);
  return [200, cartView()];
});
route('POST', '/api/cart/coupon', (_, body) => {
  const code = String(body.code || '').trim().toUpperCase();
  const c = COUPONS[code];
  if (!c) return [422, { error: `"${body.code || ''}" is not a valid coupon code` }];
  const { subtotal } = pricing(state.cart, null);
  if (c.minSubtotal && subtotal < c.minSubtotal) return [422, { error: `${c.code} needs a subtotal of at least $${c.minSubtotal}` }];
  state.coupon = c.code; // one coupon at a time: a new code replaces the old one
  return [200, cartView()];
});
route('DELETE', '/api/cart/coupon', () => { state.coupon = null; return [200, cartView()]; });

route('GET', '/api/orders', () => [200, { orders: state.orders.filter((o) => o.owner === CURRENT_USER.id).map(orderSummary).reverse() }]);
route('GET', '/api/orders/:id', ({ id }) => {
  const o = state.orders.find((x) => x.id === id && x.owner === CURRENT_USER.id);
  return o ? [200, o] : [404, { error: 'Order not found' }];
});
route('POST', '/api/orders', (_, body) => {
  const errors = {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const address = String(body.address || '').trim();
  if (name.length < 2) errors.name = 'Enter your full name';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Enter a valid email address';
  if (address.length < 8) errors.address = 'Enter your delivery address';
  if (state.cart.length === 0) errors.cart = 'Your cart is empty';
  if (Object.keys(errors).length) return [422, { error: 'Please fix the highlighted fields', fields: errors }];
  const o = order(state.nextOrder++, state.cart, state.coupon, name, email, address, 'placed', new Date().toISOString());
  for (const l of state.cart) state.stock[l.productId] -= l.qty;
  state.orders.push(o);
  state.cart = [];
  state.coupon = null;
  return [201, o];
});
route('POST', '/api/orders/:id/cancel', ({ id }) => {
  const o = state.orders.find((x) => x.id === id && x.owner === CURRENT_USER.id);
  if (!o) return [404, { error: 'Order not found' }];
  if (o.status !== 'placed') return [409, { error: `Order #${o.id} is ${o.status} and can no longer be cancelled` }];
  o.status = 'cancelled';
  for (const l of o.items) state.stock[l.productId] += l.qty;
  return [200, o];
});
route('POST', '/api/__reset', () => { seed(); return [200, { ok: true }]; });

// ---------- server ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
  if (!file.startsWith(PUBLIC)) return send(res, 403, { error: 'Forbidden' });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

seed();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { return send(res, 400, { error: 'Request body must be JSON' }); }
    for (const r of routes) {
      const m = r.method === req.method && url.pathname.match(r.re);
      if (m) {
        const [status, out] = r.fn(m.groups || {}, body);
        return send(res, status, out);
      }
    }
    send(res, 404, { error: 'Not found' });
  });
});

server.listen(PORT, () => console.log(`shop listening on http://localhost:${PORT}`));
