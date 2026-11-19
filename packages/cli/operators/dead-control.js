// Interface: a control the test clicks no longer does anything. If the test passes anyway,
// it never checked the effect of the click.
import { controls, mutant, labelOf } from './_util.js';
import { domMutant } from './hide-control.js';

export default {
  name: 'dead-control',
  family: 'interface',
  summary: 'The click handler of a control is disabled by an injected script.',
  generate(profile) {
    return controls(profile)
      .filter((c) => (c.role === 'button' || c.role === 'checkbox') && c.clicked)
      .map((c) => mutant({
        id: `dead-control:${c.role}:"${c.text}"`,
        family: 'interface', operator: 'dead-control',
        match: { document: true },
        action: domMutant('dead', c),
        touches_tests: c.tests,
        describe: `${c.role === 'checkbox' ? 'Ticking' : 'Clicking'} ${labelOf(c)} does nothing`,
        expect: `The test checks what "${c.text}" is supposed to change`
      }));
  }
};
