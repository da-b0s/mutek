// Shared helpers for operators. An operator receives the baseline profile:
//   profile.tests = [{ test, traffic: [entry], pages: [{url, controls, text}], clicks: [control] }]
// and returns concrete mutant definitions (see README "Mutant definition format").
import { walk, get } from '../src/jsonpath.js';

export const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const routeKey = (e) => `${e.method} ${e.path}`;
export const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const MONEYISH = /total|price|subtotal|amount|cost|discount|shipping|tax|fee|balance/i;
const COUNTISH = /count|qty|quantity|items?$|stock|number|seats|nights|guests/i;

export function testText(t) {
  return t.pages.map((p) => p.text || '').join('\n');
}

// Is this value something a user could actually see on one of the test's pages?
export function rendered(value, text, key = '') {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return false;
    const forms = Number.isInteger(value) ? [String(value), value.toFixed(2)] : [value.toFixed(2), String(value)];
    if (Number.isInteger(value) && Math.abs(value) < 10 && !COUNTISH.test(key) && !MONEYISH.test(key)) return false;
    return forms.some((f) => new RegExp(`(^|[^\\d.])${esc(f)}(?![\\d])`).test(text));
  }
  if (typeof value === 'string') {
    const v = value.trim();
    if (v.length < 3 || v.length > 200) return false;
    if (/^\d{4}-\d\d-\d\dT/.test(v)) return false; // timestamps are usually reformatted
    return text.includes(v);
  }
  return false;
}

export const isMoneyKey = (k) => MONEYISH.test(k);
export const isCountKey = (k) => COUNTISH.test(k);
export const lastKey = (p) => { const m = p.match(/(?:\.([\w$-]+)|\[(\d+)\])$/); return m ? (m[1] ?? m[2]) : ''; };

// Unique (method, path) JSON GET responses per test, keeping the last body seen.
export function jsonReads(t) {
  const by = new Map();
  for (const e of t.traffic) if (e.method === 'GET' && e.type === 'json' && e.status < 400 && e.json !== undefined && !e.mutated) by.set(routeKey(e), e);
  return [...by.values()];
}

export function writes(t) {
  const by = new Map();
  for (const e of t.traffic) if (WRITE.has(e.method) && !e.mutated) { if (!by.has(routeKey(e)) || e.status < 400) by.set(routeKey(e), e); }
  return [...by.values()];
}

// All tests whose baseline traffic touched this route.
export function touchingRoute(profile, method, path) {
  return profile.tests.filter((t) => t.traffic.some((e) => e.method === method && e.path === path)).map((t) => t.test);
}

// All tests that saw a control with this role and text.
export function touchingControl(profile, role, text) {
  return profile.tests.filter((t) => t.pages.some((p) => p.controls.some((c) => c.role === role && c.text === text))).map((t) => t.test);
}

export function clickedAnywhere(profile, role, text) {
  return profile.tests.some((t) => t.clicks.some((c) => c.role === role && c.text === text));
}

// A label with a live number in it ("Cart 2", "3 items") is one control, not several.
// A private-use character marks "a number was here", so a literal '#' in a label ("#1002") is kept.
const NUM = '';
const masked = (text) => text.replace(/\d+(?:[.,]\d+)?/g, NUM);
const patternFor = (text) => '^' + esc(masked(text)).split(NUM).join('\\d+(?:[.,]\\d+)?') + '$';

// Distinct visible controls across the suite:
// [{ role, text, pattern?, href, inRow, tag, cls, tests:[...], pages:[...], clicked }]
export function controls(profile) {
  const variants = new Map();
  for (const t of profile.tests) for (const p of t.pages) for (const c of p.controls) {
    const k = `${c.role}|${masked(c.text)}`;
    if (!variants.has(k)) variants.set(k, new Set());
    variants.get(k).add(c.text);
  }
  const keyOf = (c) => {
    const k = `${c.role}|${masked(c.text)}`;
    return variants.get(k) && variants.get(k).size > 1 ? k : `${c.role}|${c.text}`;
  };
  const by = new Map();
  for (const t of profile.tests) {
    for (const p of t.pages) for (const c of p.controls) {
      const k = keyOf(c);
      if (!by.has(k)) {
        const dynamic = k !== `${c.role}|${c.text}`;
        by.set(k, { ...c, ...(dynamic ? { pattern: patternFor(c.text), text: masked(c.text).split(NUM).join('N') } : {}), tests: new Set(), pages: new Set(), clicked: false });
      }
      by.get(k).tests.add(t.test);
      by.get(k).pages.add(p.url);
    }
    for (const c of t.clicks) { const k = keyOf(c); if (by.has(k)) by.get(k).clicked = true; }
  }
  return [...by.values()].map((c) => ({ ...c, tests: [...c.tests], pages: [...c.pages] }));
}

// The target a DOM mutant uses to find a control again in the page.
export const targetOf = (c) => (c.pattern ? { role: c.role, text: c.text, pattern: c.pattern } : { role: c.role, text: c.text });

export { walk, get };

export function mutant(fields) {
  const { id, family, operator, match, action, touches_tests, describe, times, expect } = fields;
  const m = { id, family, operator, match, action, touches_tests: [...new Set(touches_tests)].sort(), describe };
  if (times) m.times = times;
  if (expect) m.expect = expect; // what a good test should notice
  return m;
}

export const fmtVal = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : JSON.stringify(v));
export const nice = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').toLowerCase();
