// Data, in the page: a number the user sees (a count, an amount) is off by one, changed in the
// rendered page itself. Covers apps whose data never travels as JSON: server-rendered pages,
// local state, websockets. On JSON apps it complements number-drift.
import { controls, mutant, targetOf } from './_util.js';

export default {
  name: 'rendered-number-drift',
  family: 'data',
  summary: 'A number shown on the page (a count, an amount) is off by one, changed in the page itself.',
  generate(profile) {
    return controls(profile)
      .filter((c) => c.role === 'text' && (c.pattern || /\d/.test(c.text)) && c.text.length <= 40)
      .slice(0, 8)
      .map((c) => mutant({
        id: `rendered-number-drift:"${c.text}"`,
        family: 'data', operator: 'rendered-number-drift',
        match: { document: true },
        action: { type: 'dom', dom: { op: 'drift-number', target: targetOf(c) } },
        touches_tests: c.tests,
        describe: `The number shown in "${c.text}" is off by one`,
        expect: 'The test checks the exact number shown, not just that the element is there'
      }));
  }
};
