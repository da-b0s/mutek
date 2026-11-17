// Data: one element is removed from a list response.
import { jsonReads, walk, rendered, testText, touchingRoute, mutant, nice, lastKey } from './_util.js';

export function lists(profile) {
  const out = [];
  for (const t of profile.tests) {
    const text = testText(t);
    for (const e of jsonReads(t)) {
      walk(e.json, (p, v) => {
        if (!Array.isArray(v) || v.length === 0 || typeof v[0] !== 'object' || v[0] === null) return;
        const label = Object.entries(v[0]).find(([k, x]) => typeof x === 'string' && rendered(x, text, k));
        if (label) out.push({ e, p, v, label: label[1] });
      });
    }
  }
  return out;
}

const dropOp = {
  name: 'item-drop',
  family: 'data',
  summary: 'One element is removed from a list response.',
  generate(profile) {
    return lists(profile).map(({ e, p, v, label }) => mutant({
      id: `item-drop:${e.method} ${e.path}:${p}[0]`,
      family: 'data', operator: 'item-drop',
      match: { method: e.method, path: e.path },
      action: { type: 'json', ops: [{ op: 'remove-index', path: p, index: 0 }] },
      touches_tests: touchingRoute(profile, e.method, e.path),
      describe: `"${label}" is missing from the ${nice(lastKey(p) || 'list')} (${v.length} → ${v.length - 1} items)`,
      expect: 'The list length or a named item is checked'
    }));
  }
};

export default dropOp;
