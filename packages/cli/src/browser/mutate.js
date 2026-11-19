// Injected by the Tripwire proxy when an interface mutant is armed.
// window.__TW_MUTANT = { id, op, target: { role, text, count? }, ... } is set just before this script.
// The change is re-applied whenever the page re-renders, and the proxy is told once it really fired.
(function () {
  var M = window.__TW_MUTANT;
  if (!M || window.__twMutating) return;
  window.__twMutating = true;
  var fired = false;
  var clean = function (s) { return (s || '').replace(/\s+/g, ' ').trim(); };
  var ROLE_SEL = {
    button: 'button, [role=button], input[type=submit], input[type=button]',
    link: 'a[href]',
    heading: 'h1, h2, h3',
    text: '[role=status], .status, .badge, .tag, strong, label, p, span, td, dd, h1, h2, h3',
    checkbox: 'input[type=checkbox]'
  };
  function report() {
    if (fired) return;
    fired = true;
    try { navigator.sendBeacon('/_tw/fired', new Blob([JSON.stringify({ id: M.id })], { type: 'application/json' })); } catch (e) { /* ignore */ }
  }
  function find(target) {
    // "[tag.class]" targets a control that has no visible text
    var anon = /^\[([a-z0-9-]+)(?:\.([\w-]+))?\]$/i.exec(target.text || '');
    if (anon) {
      var els = Array.prototype.slice.call(document.querySelectorAll(anon[1] + (anon[2] ? '.' + anon[2] : '')));
      return target.count ? (els[target.count - 1] ? [els[target.count - 1]] : []) : els;
    }
    var all = Array.prototype.slice.call(document.querySelectorAll(ROLE_SEL[target.role] || ROLE_SEL.text));
    var re = target.pattern ? new RegExp(target.pattern) : null;
    var hits = all.filter(function (el) {
      var t = clean(el.innerText || el.value);
      return re ? re.test(t) : t === target.text;
    });
    if (target.role === 'text') hits = hits.filter(function (el) { return !hits.some(function (o) { return o !== el && el.contains(o); }); });
    if (target.count) return hits[target.count - 1] ? [hits[target.count - 1]] : [];
    return hits;
  }
  function setText(el, text) {
    if (el.tagName === 'INPUT') { el.value = text; return; }
    // keep child elements (icons, badges) when the label is a single text node
    var nodes = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3 && clean(n.nodeValue); });
    if (nodes.length === 1 && el.children.length) nodes[0].nodeValue = text; else el.textContent = text;
  }
  var ops = {
    'hide': function () {
      find(M.target).forEach(function (el) {
        if (el.dataset.twDone) return;
        el.dataset.twDone = '1';
        el.style.setProperty('display', 'none', 'important');
        report();
      });
    },
    'dead': function () {
      find(M.target).forEach(function (el) {
        if (el.dataset.twDone) return;
        el.dataset.twDone = '1';
        report();
      });
    },
    'swap-labels': function () {
      var a = find(M.target), b = find(M.other);
      a.forEach(function (el) { if (!el.dataset.twDone) { el.dataset.twDone = '1'; setText(el, M.other.text); report(); } });
      b.forEach(function (el) { if (!el.dataset.twDone) { el.dataset.twDone = '1'; setText(el, M.target.text); report(); } });
    },
    'replace-text': function () {
      find(M.target).forEach(function (el) {
        if (el.dataset.twDone) return;
        el.dataset.twDone = '1';
        setText(el, M.replacement);
        report();
      });
    },
    'relink': function () {
      find(M.target).forEach(function (el) {
        if (el.dataset.twDone) return;
        el.dataset.twDone = '1';
        el.setAttribute('href', M.href);
        report();
      });
    },
    // A number shown on the page is off by one (works without any JSON API: SSR, local state).
    // Re-applied after every re-render, but never twice to the same rendered value.
    'drift-number': function () {
      find(M.target).forEach(function (el) {
        var t = clean(el.innerText || el.value);
        if (el.dataset.twWrote === t) return;
        // +1 unit, keeping the decimals ("2" -> "3", "18.00" -> "19.00")
        var next = t.replace(/\d+(?:\.\d+)?/, function (n) {
          return (Number(n) + 1).toFixed((n.split('.')[1] || '').length);
        });
        if (next === t) return;
        setText(el, next);
        el.dataset.twWrote = clean(el.innerText || el.value);
        report();
      });
    },
    // A list row the user saw disappears, or shows twice (the in-page form of item-drop/item-dup).
    'hide-row': function () {
      var el = find(M.target)[0];
      var row = el && el.closest('li, tr');
      if (!row || row.dataset.twDone) return;
      row.dataset.twDone = '1';
      row.style.setProperty('display', 'none', 'important');
      report();
    },
    'dup-row': function () {
      var el = find(M.target)[0];
      var row = el && el.closest('li, tr');
      if (!row || row.dataset.twDone) return;
      row.dataset.twDone = '1';
      var copy = row.cloneNode(true);
      row.parentNode.insertBefore(copy, row.nextSibling);
      report();
    },
    'remove-row-action': function () {
      var rows = document.querySelectorAll('tr, li');
      for (var i = 0; i < rows.length; i++) {
        var els = Array.prototype.filter.call(rows[i].querySelectorAll(ROLE_SEL[M.target.role] || ROLE_SEL.button), function (el) { return clean(el.innerText || el.value) === M.target.text; });
        if (!els.length) continue;
        if (rows[i].dataset.twDone) return;
        rows[i].dataset.twDone = '1';
        els.forEach(function (el) { el.remove(); });
        report();
        return; // first matching row only
      }
    }
  };
  if (M.op === 'dead') {
    // swallow clicks on the dead control before the app's own handlers run
    var swallow = function (ev) {
      var el = ev.target && ev.target.closest && ev.target.closest('[data-tw-done]');
      if (el && find(M.target).indexOf(el) !== -1) { ev.preventDefault(); ev.stopImmediatePropagation(); }
    };
    window.addEventListener('click', swallow, true);
    window.addEventListener('submit', function (ev) {
      var btn = ev.submitter;
      if (btn && btn.dataset && btn.dataset.twDone) { ev.preventDefault(); ev.stopImmediatePropagation(); }
    }, true);
  }
  var apply = ops[M.op];
  if (!apply) return;
  var busy = false;
  var run = function () {
    if (busy) return;
    busy = true;
    try { apply(); } finally { busy = false; }
  };
  var start = function () {
    run();
    new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
