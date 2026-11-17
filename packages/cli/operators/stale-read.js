// Data: a read after a write returns the body from before the write.
import { WRITE, touchingRoute, mutant } from './_util.js';

export default {
  name: 'stale-read',
  family: 'data',
  summary: 'A GET after a write returns the previous body, so the page does not show the change just made.',
  generate(profile) {
    const out = new Map();
    for (const t of profile.tests) {
      const seen = new Set();
      let wroteAfter = new Set();
      for (const e of t.traffic) {
        if (e.type !== 'json' && e.method === 'GET') continue;
        if (WRITE.has(e.method) && e.status < 400) { wroteAfter = new Set(seen); continue; }
        if (e.method === 'GET' && e.status < 400) {
          if (wroteAfter.has(e.path) && !out.has(e.path)) {
            out.set(e.path, mutant({
              id: `stale-read:GET ${e.path}`,
              family: 'data', operator: 'stale-read',
              match: { method: 'GET', path: e.path },
              action: { type: 'stale-read' },
              touches_tests: touchingRoute(profile, 'GET', e.path),
              describe: `${e.path} keeps returning what it returned before the last change`,
              expect: 'The test checks that the change it just made is visible'
            }));
          }
          seen.add(e.path);
        }
      }
    }
    return [...out.values()];
  }
};
