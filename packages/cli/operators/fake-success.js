// Behaviour: a write answers with its usual success body but never reaches the app.
// The page looks right until anything re-reads the data.
import { writes, touchingRoute, mutant } from './_util.js';

export default {
  name: 'fake-success',
  family: 'behaviour',
  summary: 'A write returns its normal success response but is not forwarded, so after a reload the change is gone.',
  generate(profile) {
    return profile.tests.flatMap((t) => writes(t).filter((e) => e.status < 400 && e.json !== undefined).map((e) => mutant({
      id: `fake-success:${e.method} ${e.path}`,
      family: 'behaviour', operator: 'fake-success',
      match: { method: e.method, path: e.path },
      // replay the success body recorded at baseline: realistic, and the UI keeps working
      action: { type: 'respond', status: e.status, body: e.json },
      touches_tests: touchingRoute(profile, e.method, e.path),
      describe: `${e.method} ${e.path} reports success but the change is never saved`,
      expect: 'The test re-reads the data (reload or another page) after the change'
    })));
  }
};
