// Data, in the page: a list row the user saw disappears. The in-page form of item-drop, for apps
// whose lists never travel as JSON (local state, server-rendered pages).
import { controls, mutant, targetOf } from './_util.js';

export function rowLabels(profile) {
  const seen = new Set();
  return controls(profile).filter((c) => {
    if (!c.inRow || !(c.role === 'text' || c.role === 'heading') || c.pattern) return false;
    if (!/[A-Za-z]{2}/.test(c.text) || c.text.startsWith('[') || c.text.length > 60) return false;
    if (seen.has(c.text)) return false;
    seen.add(c.text);
    return true;
  });
}

export default {
  name: 'rendered-item-drop',
  family: 'data',
  summary: 'A list row the user saw disappears from the page.',
  generate(profile) {
    return rowLabels(profile).slice(0, 4).map((c) => mutant({
      id: `rendered-item-drop:"${c.text}"`,
      family: 'data', operator: 'rendered-item-drop',
      match: { document: true },
      action: { type: 'dom', dom: { op: 'hide-row', target: targetOf(c) } },
      touches_tests: c.tests,
      describe: `The "${c.text}" row is missing from the list`,
      expect: 'The test checks which rows are listed, or how many'
    }));
  }
};
