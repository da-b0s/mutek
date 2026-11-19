// Interface: the edit/delete/cancel action is missing from one row of a list or table.
import { controls, mutant, labelOf } from './_util.js';
import { domMutant } from './hide-control.js';

export default {
  name: 'missing-row-action',
  family: 'interface',
  summary: 'The delete or edit action is removed from one row.',
  generate(profile) {
    // Row actions are buttons, or links that read like an action (a product name link is data).
    const ACTION = /^(edit|delete|remove|cancel|view|open|details|archive|approve|reject|undo|rename|manage)\b/i;
    return controls(profile)
      .filter((c) => c.inRow && (c.role === 'button' || (c.role === 'link' && ACTION.test(c.text))) && c.text.length <= 30)
      .map((c) => mutant({
        id: `missing-row-action:"${c.text}"`,
        family: 'interface', operator: 'missing-row-action',
        match: { document: true },
        action: domMutant('remove-row-action', c),
        touches_tests: c.tests,
        describe: `The first row loses ${labelOf({ ...c, row: undefined })}`,
        expect: `The test checks that each row offers "${c.text}"`
      }));
  }
};
