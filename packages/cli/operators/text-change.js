// Interface: a heading, status badge or confirmation message shows the wrong words.
// The replacement is another real text of the same kind from the same app, so it is plausible.
import { controls, mutant } from './_util.js';
import { domMutant } from './hide-control.js';

export default {
  name: 'text-change',
  family: 'interface',
  summary: 'A heading, status badge or confirmation message is replaced.',
  generate(profile) {
    const all = controls(profile);
    // Page and section headings, not the titles of cards in a list (those are data).
    const headings = all.filter((c) => c.role === 'heading' && !c.inRow && !c.pattern);
    // Word statuses ("Placed", "Cancelled"); numeric badges are counts and belong to number-drift.
    const statuses = all.filter((c) => c.role === 'text' && /status|badge|tag/.test(c.cls || '') && c.text.length <= 30 && /[A-Za-z]/.test(c.text) && !c.pattern);
    const out = [];
    const pick = (pool, c, fallback) => (pool.find((o) => o.text !== c.text && !o.pages.some((p) => c.pages.includes(p))) || pool.find((o) => o.text !== c.text))?.text || fallback;
    for (const c of statuses) {
      out.push(mutant({
        id: `text-change:status:"${c.text}"`,
        family: 'interface', operator: 'text-change',
        match: { document: true },
        action: domMutant('replace-text', c, { replacement: pick(statuses, c, 'Pending') }),
        touches_tests: c.tests,
        describe: `The "${c.text}" status shows "${pick(statuses, c, 'Pending')}"`,
        expect: 'The test checks the status shown, not only that a row exists'
      }));
    }
    for (const c of headings.filter((h) => h.text.length <= 60)) {
      const replacement = pick(headings, c, 'Something went wrong');
      out.push(mutant({
        id: `text-change:heading:"${c.text}"`,
        family: 'interface', operator: 'text-change',
        match: { document: true },
        action: domMutant('replace-text', c, { replacement }),
        touches_tests: c.tests,
        describe: `The heading "${c.text}" reads "${replacement}"`,
        expect: 'The test checks it reached the right page or message'
      }));
    }
    return out;
  }
};
