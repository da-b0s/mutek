// Saboteur: domain-specific mutants proposed by the coding agent from the acceptance criteria and
// test files ("coupon stacks", "free shipping off by one", "past dates accepted"), expressed in the
// same definition format as every other mutant. `mutek sabotage` writes them to .mutek/saboteur.json.
import fs from 'node:fs';
import path from 'node:path';
import { touchingRoute, touchingControl, mutant } from './_util.js';
import { validateMutant } from '../src/mutant.js';

export function loadSaboteur(dir) {
  const file = path.join(dir, 'saboteur.json');
  if (!fs.existsSync(file)) return { mutants: [], rejected: [] };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.mutants || [];
  const mutants = [];
  const rejected = [];
  for (const m of list) {
    const errors = validateMutant(m);
    if (errors.length) rejected.push({ id: m?.id, errors });
    else mutants.push(m);
  }
  return { mutants, rejected };
}

export default {
  name: 'agent-proposed',
  family: 'saboteur',
  summary: 'Domain rules from the acceptance criteria, broken on purpose and expressed as response rewrites.',
  generate(profile, ctx = {}) {
    const { mutants } = loadSaboteur(ctx.dir || '.mutek');
    return mutants.map((m) => {
      let touches = m.touches_tests;
      if (!touches || !touches.length) {
        touches = m.match.document
          ? touchingControl(profile, m.action.dom?.target?.role || 'button', m.action.dom?.target?.text || '')
          : touchingRoute(profile, m.match.method || 'GET', m.match.path);
        if (!touches.length && m.match.document) touches = profile.tests.map((t) => t.test);
      }
      return mutant({ ...m, id: m.id.startsWith('agent-proposed:') ? m.id : `agent-proposed:${m.id}`, family: 'saboteur', operator: 'agent-proposed', touches_tests: touches });
    });
  }
};
