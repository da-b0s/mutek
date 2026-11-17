// Behaviour: a write returns 500 and is dropped. A test that never checks the outcome passes anyway.
import { writes, touchingRoute, mutant } from './_util.js';

export default {
  name: 'silent-fail',
  family: 'behaviour',
  summary: 'A POST, PUT, PATCH or DELETE returns 500 and the request is dropped.',
  generate(profile) {
    return profile.tests.flatMap((t) => writes(t).filter((e) => e.status < 400).map((e) => mutant({
      id: `silent-fail:${e.method} ${e.path}`,
      family: 'behaviour', operator: 'silent-fail',
      match: { method: e.method, path: e.path },
      action: { type: 'respond', status: 500, body: { error: 'Internal Server Error' } },
      touches_tests: touchingRoute(profile, e.method, e.path),
      describe: `${e.method} ${e.path} fails with a 500 and nothing is saved`,
      expect: 'The test checks the result of the action, not only that it clicked'
    })));
  }
};
