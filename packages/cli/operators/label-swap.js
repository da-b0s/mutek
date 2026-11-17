// Interface: two button labels on the same page are exchanged (Save/Cancel, Approve/Reject).
import { controls, mutant, targetOf } from './_util.js';
import { domMutant } from './hide-control.js';

export default {
  name: 'label-swap',
  family: 'interface',
  summary: 'Two button labels on the same page are exchanged.',
  generate(profile) {
    const buttons = controls(profile).filter((c) => c.role === 'button' && c.text.length <= 40 && !c.pattern);
    const out = new Map();
    for (const a of buttons) {
      for (const b of buttons) {
        if (a.text >= b.text) continue;
        if (!a.pages.some((p) => b.pages.includes(p))) continue;
        if (!a.clicked && !b.clicked) continue; // swapping two untouched labels is near-equivalent
        const id = `label-swap:"${a.text}"<->"${b.text}"`;
        out.set(id, mutant({
          id, family: 'interface', operator: 'label-swap',
          match: { document: true },
          action: domMutant('swap-labels', a, { other: targetOf(b) }),
          touches_tests: [...a.tests, ...b.tests],
          describe: `The "${a.text}" and "${b.text}" buttons have each other's labels`,
          expect: 'The test checks the outcome of the button it pressed'
        }));
      }
    }
    return [...out.values()].slice(0, 6);
  }
};
