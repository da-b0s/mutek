// Interface: a button or link the tests saw but never clicked disappears.
// Catches suites that never look at controls they do not use.
import { controls, mutant, targetOf } from './_util.js';

const domMutant = (op, c, extra = {}) => ({ type: 'dom', dom: { op, target: targetOf(c), ...extra } });

export default {
  name: 'hide-control',
  family: 'interface',
  summary: 'A button or link that the flow does not click is hidden.',
  generate(profile) {
    // Buttons first, then links outside lists (navigation, calls to action), then the rest.
    const rank = (c) => (c.role === 'button' ? 0 : c.inRow ? 2 : 1);
    return controls(profile)
      .filter((c) => (c.role === 'button' || c.role === 'link') && !c.clicked && c.text.length <= 40)
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 12)
      .map((c) => mutant({
        id: `hide-control:${c.role}:"${c.text}"`,
        family: 'interface', operator: 'hide-control',
        match: { document: true },
        action: domMutant('hide', c),
        touches_tests: c.tests,
        describe: `The "${c.text}" ${c.role} is missing`,
        expect: `The test checks that "${c.text}" is offered`
      }));
  }
};

export { domMutant };
