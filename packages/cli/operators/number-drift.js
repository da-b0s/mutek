// Data: a price, total or count in a JSON response is off by one unit or by 10%.
import { jsonReads, walk, rendered, testText, touchingRoute, mutant, lastKey, isMoneyKey, isCountKey, fmtVal, nice } from './_util.js';

export default {
  name: 'number-drift',
  family: 'data',
  summary: 'A price, total or count in a JSON response is changed by one unit or 10%.',
  generate(profile) {
    const out = [];
    for (const t of profile.tests) {
      const text = testText(t);
      for (const e of jsonReads(t)) {
        const found = [];
        walk(e.json, (p, v) => {
          if (typeof v !== 'number') return;
          const key = lastKey(p);
          if (!rendered(v, text, key)) return;
          // totals matter most to users, then other money, then counts
          const score = /total/i.test(key) && !/line/i.test(key) ? 3 : isMoneyKey(key) ? 2 : isCountKey(key) ? 1 : 0;
          found.push({ p, v, key, score });
        });
        found.sort((a, b) => b.score - a.score);
        for (const { p, v, key } of found.slice(0, 4)) {
          const op = Number.isInteger(v) && !isMoneyKey(key) ? { op: 'add', path: p, value: 1 } : { op: 'scale', path: p, value: 1.1 };
          const after = op.op === 'add' ? v + 1 : Math.round(v * 110) / 100;
          out.push(mutant({
            id: `number-drift:${e.method} ${e.path}:${p}`,
            family: 'data', operator: 'number-drift',
            match: { method: e.method, path: e.path },
            action: { type: 'json', ops: [op] },
            touches_tests: touchingRoute(profile, e.method, e.path),
            describe: `${nice(key)} from ${e.path} shows ${fmtVal(after)} instead of ${fmtVal(v)}`,
            expect: `The displayed ${nice(key)} is checked against the expected value`
          }));
        }
      }
    }
    return out;
  }
};
