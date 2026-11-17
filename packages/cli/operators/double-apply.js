// Behaviour: a non-idempotent write is applied twice (double submit, retry without idempotency key).
import { writes, touchingRoute, mutant } from './_util.js';

export default {
  name: 'double-apply',
  family: 'behaviour',
  summary: 'A POST or PATCH is forwarded twice: two rows, or a doubled quantity.',
  generate(profile) {
    // PUT and DELETE are idempotent by contract, so applying them twice is an equivalent mutant.
    return profile.tests.flatMap((t) => writes(t).filter((e) => e.status < 400 && (e.method === 'POST' || e.method === 'PATCH')).map((e) => mutant({
      id: `double-apply:${e.method} ${e.path}`,
      family: 'behaviour', operator: 'double-apply',
      match: { method: e.method, path: e.path },
      action: { type: 'forward-twice' },
      touches_tests: touchingRoute(profile, e.method, e.path),
      describe: `${e.method} ${e.path} is applied twice`,
      expect: 'The test checks the exact quantity or number of records afterwards'
    })));
  }
};
