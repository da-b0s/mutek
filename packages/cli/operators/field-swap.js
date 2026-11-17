// Data: two displayed string fields of one record are exchanged (first/last name, from/to, name/email).
import { jsonReads, walk, rendered, testText, touchingRoute, mutant, nice } from './_util.js';

const ID_LIKE = /^(id|_id|uuid|.*Id|.*_id|sku|slug|key|ref)$/;

export default {
  name: 'field-swap',
  family: 'data',
  summary: 'Two displayed string fields of one record are exchanged.',
  generate(profile) {
    const out = [];
    for (const t of profile.tests) {
      const text = testText(t);
      for (const e of jsonReads(t)) {
        let perRoute = 0;
        walk(e.json, (p, v) => {
          if (perRoute >= 2 || !v || typeof v !== 'object' || Array.isArray(v)) return;
          // human-readable fields only: swapping an id or code into a label is not a mix-up users meet
          const shown = Object.entries(v).filter(([k, x]) => typeof x === 'string' && !ID_LIKE.test(k) && /[A-Za-z]{2}/.test(x) && rendered(x, text, k));
          for (let i = 0; i < shown.length && perRoute < 2; i++) {
            for (let j = i + 1; j < shown.length && perRoute < 2; j++) {
              if (shown[i][1] === shown[j][1]) continue;
              const [a, av] = shown[i];
              const [b, bv] = shown[j];
              perRoute++;
              out.push(mutant({
                id: `field-swap:${e.method} ${e.path}:${p}.${a}<->${b}`,
                family: 'data', operator: 'field-swap',
                match: { method: e.method, path: e.path },
                action: { type: 'json', ops: [{ op: 'swap', path: p, a, b }] },
                touches_tests: touchingRoute(profile, e.method, e.path),
                describe: `${nice(a)} and ${nice(b)} are swapped ("${av}" shows as ${nice(b)})`,
                expect: `The ${nice(a)} shown is checked, not just that something is shown`
              }));
            }
          }
        });
      }
    }
    return out;
  }
};
