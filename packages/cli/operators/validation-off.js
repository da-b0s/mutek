// Behaviour: a 400 or 422 validation error is turned into 200, so invalid input looks accepted.
// It only fires when a test actually submits invalid input; if none does, the mutant is reported
// as "not reached", which is itself a finding: no test covers validation on that route.
import { writes, touchingRoute, mutant } from './_util.js';

export default {
  name: 'validation-off',
  family: 'behaviour',
  summary: 'A 400 or 422 response is turned into 200. Invalid input appears to be accepted.',
  generate(profile) {
    return profile.tests.flatMap((t) => writes(t).filter((e) => e.method !== 'DELETE').map((e) => mutant({
      id: `validation-off:${e.method} ${e.path}`,
      family: 'behaviour', operator: 'validation-off',
      match: { method: e.method, path: e.path },
      action: { type: 'status-map', from: [400, 422], to: 200 },
      touches_tests: touchingRoute(profile, e.method, e.path),
      describe: `Invalid input to ${e.method} ${e.path} is treated as a success`,
      expect: 'A test submits invalid input and checks the error message'
    })));
  }
};
