// Interface: a navigation link points to a different page of the same app.
import { controls, mutant } from './_util.js';
import { domMutant } from './hide-control.js';

export default {
  name: 'wrong-link',
  family: 'interface',
  summary: 'A navigation link points to a different page.',
  generate(profile) {
    const links = controls(profile).filter((c) => c.role === 'link' && c.href && !/^(mailto:|tel:|javascript:)/.test(c.href));
    const hrefs = [...new Set(links.map((l) => l.href))];
    const out = [];
    for (const l of links.filter((x) => x.clicked)) {
      const other = hrefs.find((h) => h !== l.href && h.split('/').length === l.href.split('/').length) || hrefs.find((h) => h !== l.href);
      if (!other) continue;
      out.push(mutant({
        id: `wrong-link:"${l.text}"->${other}`,
        family: 'interface', operator: 'wrong-link',
        match: { document: true },
        action: domMutant('relink', l, { href: other }),
        touches_tests: l.tests,
        describe: `The "${l.text}" link goes to ${other} instead of ${l.href}`,
        expect: 'After following a link the test checks where it landed'
      }));
    }
    return out;
  }
};
