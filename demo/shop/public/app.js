// Fieldnote Goods front end: hash routes, every view rendered from the JSON API.
const $app = document.getElementById('app');
const $count = document.getElementById('cart-count');
const fmt = (n) => '$' + Number(n).toFixed(2);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401) {
    const err = new Error('Your session has expired. Please sign in again.');
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Something went wrong (${res.status}). Please try again.`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

let toastTimer;
function toast(msg, kind = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 4000);
}

function confirmModal(title, body) {
  const m = document.getElementById('modal');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  m.hidden = false;
  return new Promise((resolve) => {
    const done = (v) => { m.hidden = true; ok.onclick = cancel.onclick = null; resolve(v); };
    const ok = document.getElementById('modal-ok');
    const cancel = document.getElementById('modal-cancel');
    ok.onclick = () => done(true);
    cancel.onclick = () => done(false);
  });
}

async function refreshCount() {
  try { const c = await api('GET', '/api/cart'); $count.textContent = c.count; } catch { /* leave as is */ }
}

function showError(err) {
  if (err.status === 401) {
    $app.innerHTML = `<section class="panel"><h1>Please sign in</h1><p>${esc(err.message)}</p><a class="button" href="#/">Sign in again</a></section>`;
  } else {
    toast(err.message, 'error');
  }
}

// ---------- views ----------
async function viewShop() {
  const { products } = await api('GET', '/api/products');
  $app.innerHTML = `
    <h1>Shop</h1>
    <p class="lede">Free shipping on orders of $50 or more.</p>
    <ul class="grid">${products.map((p) => `
      <li class="card" data-product="${p.id}">
        <span class="category">${esc(p.category)}</span>
        <h2><a href="#/product/${p.id}">${esc(p.name)}</a></h2>
        <p class="price">${fmt(p.price)}</p>
        <p class="stock ${p.inStock ? 'in' : 'out'}">${p.inStock ? 'In stock' : 'Out of stock'}</p>
        <button data-add="${p.id}" ${p.inStock ? '' : 'disabled'}>Add to cart</button>
      </li>`).join('')}
    </ul>`;
  $app.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addToCart(b.dataset.add, 1)));
}

async function addToCart(productId, qty) {
  try {
    const cart = await api('POST', '/api/cart/items', { productId, qty });
    $count.textContent = cart.count;
    const line = cart.items.find((i) => i.productId === productId);
    toast(`Added ${line ? line.name : 'item'} to your cart`);
  } catch (e) { showError(e); }
}

async function viewProduct(id) {
  const p = await api('GET', '/api/products/' + id);
  $app.innerHTML = `
    <a class="back" href="#/">← Back to shop</a>
    <section class="panel product">
      <span class="category">${esc(p.category)}</span>
      <h1>${esc(p.name)}</h1>
      <p class="price big">${fmt(p.price)}</p>
      <p>${esc(p.description)}</p>
      <p class="stock ${p.inStock ? 'in' : 'out'}">${p.inStock ? `${p.stock} in stock` : 'Out of stock'}</p>
      <label>Quantity <input id="qty" type="number" min="1" max="10" value="1"></label>
      <button id="add" ${p.inStock ? '' : 'disabled'}>Add to cart</button>
    </section>`;
  document.getElementById('add').onclick = () => addToCart(p.id, Number(document.getElementById('qty').value));
}

async function viewCart() {
  const c = await api('GET', '/api/cart');
  $count.textContent = c.count;
  if (c.items.length === 0) {
    $app.innerHTML = `<h1>Your cart</h1><section class="panel empty"><p>Your cart is empty.</p><a class="button" href="#/">Browse the shop</a></section>`;
    return;
  }
  const toFree = c.freeShippingFrom - (c.subtotal - c.discount);
  $app.innerHTML = `
    <h1>Your cart</h1>
    <table class="lines">
      <thead><tr><th>Item</th><th>Price</th><th>Quantity</th><th>Total</th><th><span class="sr">Actions</span></th></tr></thead>
      <tbody>${c.items.map((l) => `
        <tr data-line="${l.productId}">
          <td>${esc(l.name)}</td>
          <td>${fmt(l.price)}</td>
          <td class="qty">
            <button class="icon" data-dec="${l.productId}" aria-label="Decrease quantity of ${esc(l.name)}">−</button>
            <span>${l.qty}</span>
            <button class="icon" data-inc="${l.productId}" aria-label="Increase quantity of ${esc(l.name)}">+</button>
          </td>
          <td>${fmt(l.lineTotal)}</td>
          <td><button class="link" data-remove="${l.productId}">Remove</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="cart-bottom">
      <section class="panel coupon">
        <h2>Coupon</h2>
        ${c.coupon
          ? `<p>Applied: <strong>${esc(c.coupon.code)}</strong> (${esc(c.coupon.label)}) <button class="link" id="coupon-remove">Remove coupon</button></p>`
          : `<form id="coupon-form"><label>Coupon code <input id="coupon" autocomplete="off"></label><button>Apply coupon</button></form>`}
      </section>
      <section class="panel summary">
        <dl>
          <dt>Subtotal</dt><dd id="subtotal">${fmt(c.subtotal)}</dd>
          ${c.discount ? `<dt>Discount</dt><dd id="discount">−${fmt(c.discount)}</dd>` : ''}
          <dt>Shipping</dt><dd id="shipping">${c.shipping === 0 ? 'Free' : fmt(c.shipping)}</dd>
          <dt class="total">Total</dt><dd class="total" id="total">${fmt(c.total)}</dd>
        </dl>
        ${c.shipping > 0 ? `<p class="hint">Add ${fmt(toFree)} more for free shipping.</p>` : ''}
        <a class="button" href="#/checkout">Go to checkout</a>
        <a class="back" href="#/">Continue shopping</a>
      </section>
    </div>`;
  const line = (id) => c.items.find((l) => l.productId === id);
  const setQty = async (id, qty) => {
    try {
      if (qty < 1) await api('DELETE', '/api/cart/items/' + id);
      else await api('PUT', '/api/cart/items/' + id, { qty });
      render();
    } catch (e) { showError(e); }
  };
  $app.querySelectorAll('[data-inc]').forEach((b) => (b.onclick = () => setQty(b.dataset.inc, line(b.dataset.inc).qty + 1)));
  $app.querySelectorAll('[data-dec]').forEach((b) => (b.onclick = () => setQty(b.dataset.dec, line(b.dataset.dec).qty - 1)));
  $app.querySelectorAll('[data-remove]').forEach((b) => (b.onclick = async () => {
    try { await api('DELETE', '/api/cart/items/' + b.dataset.remove); toast(`Removed ${line(b.dataset.remove).name}`); render(); } catch (e) { showError(e); }
  }));
  const form = document.getElementById('coupon-form');
  if (form) form.onsubmit = async (ev) => {
    ev.preventDefault();
    try { const r = await api('POST', '/api/cart/coupon', { code: document.getElementById('coupon').value }); toast(`Coupon ${r.coupon.code} applied`); render(); } catch (e) { showError(e); }
  };
  const rm = document.getElementById('coupon-remove');
  if (rm) rm.onclick = async () => { try { await api('DELETE', '/api/cart/coupon'); toast('Coupon removed'); render(); } catch (e) { showError(e); } };
}

async function viewCheckout() {
  const c = await api('GET', '/api/cart');
  if (c.items.length === 0) { location.hash = '#/cart'; return; }
  $app.innerHTML = `
    <h1>Checkout</h1>
    <div class="checkout">
      <form id="checkout" class="panel" novalidate>
        <label>Full name <input name="name" autocomplete="name"></label><p class="field-error" data-for="name"></p>
        <label>Email <input name="email" type="email" autocomplete="email"></label><p class="field-error" data-for="email"></p>
        <label>Delivery address <textarea name="address" rows="3" autocomplete="street-address"></textarea></label><p class="field-error" data-for="address"></p>
        <p class="field-error" data-for="cart"></p>
        <button id="place">Place order</button>
      </form>
      <section class="panel summary">
        <h2>Order summary</h2>
        <ul class="mini">${c.items.map((l) => `<li>${l.qty} × ${esc(l.name)} <span>${fmt(l.lineTotal)}</span></li>`).join('')}</ul>
        <dl>
          <dt>Subtotal</dt><dd>${fmt(c.subtotal)}</dd>
          ${c.discount ? `<dt>Discount (${esc(c.coupon.code)})</dt><dd>−${fmt(c.discount)}</dd>` : ''}
          <dt>Shipping</dt><dd>${c.shipping === 0 ? 'Free' : fmt(c.shipping)}</dd>
          <dt class="total">Total</dt><dd class="total">${fmt(c.total)}</dd>
        </dl>
      </section>
    </div>`;
  const form = document.getElementById('checkout');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    form.querySelectorAll('.field-error').forEach((p) => (p.textContent = ''));
    const data = Object.fromEntries(new FormData(form));
    try {
      const o = await api('POST', '/api/orders', data);
      $count.textContent = '0';
      location.hash = '#/confirmation/' + o.id;
    } catch (e) {
      if (e.status === 422 && e.data && e.data.fields) {
        for (const [k, msg] of Object.entries(e.data.fields)) {
          const p = form.querySelector(`[data-for="${k}"]`);
          if (p) p.textContent = msg;
        }
        toast(e.message, 'error');
      } else showError(e);
    }
  };
}

async function viewConfirmation(id) {
  const o = await api('GET', '/api/orders/' + id);
  $app.innerHTML = `
    <section class="panel confirm">
      <h1>Thank you, ${esc(o.ownerName.split(' ')[0])}!</h1>
      <p>Your order <strong>#${o.id}</strong> has been placed.</p>
      <p>Total charged: <strong id="order-total">${fmt(o.total)}</strong></p>
      <p>We will email a receipt to ${esc(o.email)}.</p>
      <a class="button" href="#/orders/${o.id}">View order</a>
      <a class="back" href="#/">Continue shopping</a>
    </section>`;
}

const badge = (s) => `<span class="status ${s}">${s[0].toUpperCase() + s.slice(1)}</span>`;
const date = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

async function cancelOrder(o) {
  const yes = await confirmModal(`Cancel order #${o.id}?`, `The ${fmt(o.total)} charge will be refunded to your card.`);
  if (!yes) return;
  try { await api('POST', `/api/orders/${o.id}/cancel`); toast(`Order #${o.id} cancelled`); render(); } catch (e) { showError(e); }
}

async function viewOrders() {
  const { orders } = await api('GET', '/api/orders');
  $app.innerHTML = `
    <h1>My orders</h1>
    ${orders.length === 0 ? '<section class="panel empty"><p>You have not placed any orders yet.</p></section>' : `
    <table class="lines orders">
      <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th><span class="sr">Actions</span></th></tr></thead>
      <tbody>${orders.map((o) => `
        <tr data-order="${o.id}">
          <td><a href="#/orders/${o.id}">#${o.id}</a></td>
          <td>${date(o.createdAt)}</td>
          <td>${o.itemCount}</td>
          <td>${fmt(o.total)}</td>
          <td>${badge(o.status)}</td>
          <td>${o.status === 'placed' ? `<button class="link danger" data-cancel="${o.id}">Cancel</button>` : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>`}`;
  $app.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = () => cancelOrder(orders.find((o) => o.id === b.dataset.cancel))));
}

async function viewOrder(id) {
  const o = await api('GET', '/api/orders/' + id);
  $app.innerHTML = `
    <a class="back" href="#/orders">← All orders</a>
    <section class="panel">
      <h1>Order #${o.id} ${badge(o.status)}</h1>
      <p>Placed ${date(o.createdAt)} · Deliver to ${esc(o.address)}</p>
      <table class="lines">
        <thead><tr><th>Item</th><th>Price</th><th>Quantity</th><th>Total</th></tr></thead>
        <tbody>${o.items.map((l) => `<tr><td>${esc(l.name)}</td><td>${fmt(l.price)}</td><td>${l.qty}</td><td>${fmt(l.lineTotal)}</td></tr>`).join('')}</tbody>
      </table>
      <dl class="summary-inline">
        <dt>Subtotal</dt><dd>${fmt(o.subtotal)}</dd>
        ${o.discount ? `<dt>Discount</dt><dd>−${fmt(o.discount)}</dd>` : ''}
        <dt>Shipping</dt><dd>${o.shipping === 0 ? 'Free' : fmt(o.shipping)}</dd>
        <dt class="total">Total</dt><dd class="total">${fmt(o.total)}</dd>
      </dl>
      ${o.status === 'placed' ? '<button id="cancel-order" class="danger">Cancel order</button>' : ''}
    </section>`;
  const b = document.getElementById('cancel-order');
  if (b) b.onclick = () => cancelOrder(o);
}

// ---------- router ----------
const ROUTES = [
  [/^#?\/?$/, viewShop, 'shop'],
  [/^#\/product\/([\w-]+)$/, viewProduct, 'shop'],
  [/^#\/cart$/, viewCart, 'cart'],
  [/^#\/checkout$/, viewCheckout, 'cart'],
  [/^#\/confirmation\/(\w+)$/, viewConfirmation, 'orders'],
  [/^#\/orders$/, viewOrders, 'orders'],
  [/^#\/orders\/(\w+)$/, viewOrder, 'orders']
];

async function render() {
  const hash = location.hash || '#/';
  for (const [re, view, nav] of ROUTES) {
    const m = hash.match(re);
    if (!m) continue;
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
    try { await view(...m.slice(1)); } catch (e) { showError(e); }
    return;
  }
  $app.innerHTML = '<section class="panel"><h1>Page not found</h1><a class="button" href="#/">Back to the shop</a></section>';
}

window.addEventListener('hashchange', render);
render();
refreshCount();
