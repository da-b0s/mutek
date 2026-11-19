// Injected by the Tripwire proxy during the baseline run only.
// Reports which controls and texts each page showed and which ones the test clicked,
// so mutants can target things a test saw (visible) but never interacted with.
(function () {
  if (window.__twRecorder) return;
  window.__twRecorder = true;
  var ENDPOINT = '/_tw/dom';
  var clean = function (s) { return (s || '').replace(/\s+/g, ' ').trim().slice(0, 120); };
  var roleOf = function (el) {
    var t = el.tagName;
    if (t === 'BUTTON' || el.getAttribute('role') === 'button' || (t === 'INPUT' && /submit|button/.test(el.type))) return 'button';
    if (t === 'A' && el.hasAttribute('href')) return 'link';
    if (/^H[1-3]$/.test(t)) return 'heading';
    if (t === 'INPUT' && el.type === 'checkbox') return 'checkbox';
    return 'text';
  };
  var visible = function (el) {
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  // A control without visible text (icon button, checkbox) is identified by tag and first class:
  // "[input.toggle]". The mutator finds it again the same way.
  var anonKey = function (el) {
    var c = (typeof el.className === 'string' && el.className.trim().split(/\s+/)[0]) || '';
    return '[' + el.tagName.toLowerCase() + (c ? '.' + c : '') + ']';
  };
  var textOf = function (el) {
    if (el.tagName === 'INPUT' && /checkbox|radio/.test(el.type)) return clean(el.getAttribute('aria-label') || el.title) || anonKey(el);
    return clean(el.innerText || (el.tagName === 'INPUT' ? el.value : '') || el.getAttribute('aria-label') || el.title) || (el.tagName === 'BUTTON' ? anonKey(el) : '');
  };
  var describe = function (el) {
    var row = el.closest('tr, li');
    return {
      role: roleOf(el),
      text: textOf(el),
      row: row ? clean((row.innerText || '').split(/\n/)[0]).slice(0, 60) : undefined,
      // the words around a short text ("3" inside "3 items left"), for readable descriptions
      ctx: (el.parentElement && clean(el.innerText).length < 12) ? clean(el.parentElement.innerText).slice(0, 60) : undefined,
      label: clean(el.getAttribute('aria-label')),
      href: el.getAttribute('href') || undefined,
      inRow: !!el.closest('tr, li'),
      tag: el.tagName.toLowerCase(),
      cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 60) : undefined
    };
  };
  var SELECTOR = 'button, [role=button], a[href], input[type=submit], input[type=checkbox], label, h1, h2, h3, [role=status], .status, .badge, .tag, strong';
  var queue = [];
  var timer = null;
  function snapshot() {
    var controls = [];
    var seen = {};
    document.querySelectorAll(SELECTOR).forEach(function (el) {
      if (el.closest('#__tw')) return;
      if (!visible(el)) return;
      var d = describe(el);
      if (!d.text) return;
      var k = d.role + '|' + d.text;
      seen[k] = (seen[k] || 0) + 1;
      d.count = seen[k];
      controls.push(d);
    });
    queue.push({ kind: 'page', url: location.pathname + location.search + location.hash, controls: controls, text: clean(document.body ? document.body.innerText : '').length ? (document.body.innerText || '').slice(0, 20000) : '' });
    flushSoon();
  }
  function flushSoon() {
    clearTimeout(timer);
    timer = setTimeout(flush, 300);
  }
  function flush() {
    if (!queue.length) return;
    var batch = queue.splice(0, queue.length);
    var body = JSON.stringify({ events: batch });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      else fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, headers: { 'content-type': 'application/json' } });
    } catch (e) { /* recording must never break the page */ }
  }
  var snapTimer = null;
  function scheduleSnapshot() { clearTimeout(snapTimer); snapTimer = setTimeout(snapshot, 250); }
  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest && ev.target.closest(SELECTOR);
    if (!el) return;
    var d = describe(el);
    queue.push({ kind: 'click', url: location.pathname + location.search + location.hash, control: d });
    flushSoon();
  }, true);
  window.addEventListener('hashchange', scheduleSnapshot);
  window.addEventListener('pagehide', function () { snapshot(); flush(); });
  var start = function () {
    scheduleSnapshot();
    new MutationObserver(scheduleSnapshot).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
