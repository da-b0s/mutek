// Behaviour: one request in the middle of a flow returns 401 (an expired session).
// The user should see a sign-in prompt, not a blank or half-rendered page.
import { touchingRoute, mutant } from './_util.js';

export default {
  name: 'auth-drop',
  family: 'behaviour',
  summary: 'One request mid-flow returns 401. The user should see a sign-in prompt, not a blank page.',
  generate(profile) {
    const out = new Map();
    for (const t of profile.tests) {
      // skip the first JSON read of the test (that is the page load, not "mid-flow")
      const reads = t.traffic.filter((e) => e.type === 'json' && e.status < 400 && !e.mutated);
      for (const e of reads.slice(1)) {
        const id = `auth-drop:${e.method} ${e.path}`;
        if (out.has(id)) continue;
        out.set(id, mutant({
          id, family: 'behaviour', operator: 'auth-drop', times: 1,
          match: { method: e.method, path: e.path },
          action: { type: 'respond', status: 401, body: { error: 'Unauthorized' } },
          touches_tests: touchingRoute(profile, e.method, e.path),
          describe: `${e.method} ${e.path} returns 401 once, mid-flow`,
          expect: 'The test checks the page it lands on after each step'
        }));
      }
    }
    // keep this family small: up to 4, preferring writes (the riskiest place to lose a session)
    return [...out.values()].sort((a, b) => (a.match.method === 'GET') - (b.match.method === 'GET')).slice(0, 4);
  }
};
