// Data: one element of a list response is repeated.
import { touchingRoute, mutant, nice, lastKey } from './_util.js';
import { lists } from './item-drop.js';

export default {
  name: 'item-dup',
  family: 'data',
  summary: 'One element of a list response appears twice.',
  generate(profile) {
    return lists(profile).map(({ e, p, v, label }) => mutant({
      id: `item-dup:${e.method} ${e.path}:${p}[0]`,
      family: 'data', operator: 'item-dup',
      match: { method: e.method, path: e.path },
      action: { type: 'json', ops: [{ op: 'dup-index', path: p, index: 0 }] },
      touches_tests: touchingRoute(profile, e.method, e.path),
      describe: `"${label}" appears twice in the ${nice(lastKey(p) || 'list')} (${v.length} → ${v.length + 1} items)`,
      expect: 'The list length or uniqueness is checked'
    }));
  }
};
