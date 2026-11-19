// Data, in the page: a list row the user saw is shown twice. The in-page form of item-dup.
import { mutant, targetOf } from './_util.js';
import { rowLabels } from './rendered-item-drop.js';

export default {
  name: 'rendered-item-dup',
  family: 'data',
  summary: 'A list row the user saw appears twice on the page.',
  generate(profile) {
    return rowLabels(profile).slice(0, 4).map((c) => mutant({
      id: `rendered-item-dup:"${c.text}"`,
      family: 'data', operator: 'rendered-item-dup',
      match: { document: true },
      action: { type: 'dom', dom: { op: 'dup-row', target: targetOf(c) } },
      touches_tests: c.tests,
      describe: `The "${c.text}" row appears twice in the list`,
      expect: 'The test checks how many rows are listed'
    }));
  }
};
