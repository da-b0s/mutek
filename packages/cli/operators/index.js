// The operator registry and mutant selection.
import numberDrift from './number-drift.js';
import itemDrop from './item-drop.js';
import itemDup from './item-dup.js';
import fieldSwap from './field-swap.js';
import staleRead from './stale-read.js';
import wrongOwner from './wrong-owner.js';
import renderedNumberDrift from './rendered-number-drift.js';
import renderedItemDrop from './rendered-item-drop.js';
import renderedItemDup from './rendered-item-dup.js';
import silentFail from './silent-fail.js';
import fakeSuccess from './fake-success.js';
import doubleApply from './double-apply.js';
import validationOff from './validation-off.js';
import authDrop from './auth-drop.js';
import hideControl from './hide-control.js';
import deadControl from './dead-control.js';
import labelSwap from './label-swap.js';
import textChange from './text-change.js';
import wrongLink from './wrong-link.js';
import missingRowAction from './missing-row-action.js';
import agentProposed from './agent-proposed.js';

export const OPERATORS = [
  numberDrift, itemDrop, itemDup, fieldSwap, staleRead, wrongOwner, renderedNumberDrift, renderedItemDrop, renderedItemDup,
  silentFail, fakeSuccess, doubleApply, validationOff, authDrop,
  hideControl, deadControl, labelSwap, textChange, wrongLink, missingRowAction,
  agentProposed
];

// Generate every candidate, merge duplicates (same id from several tests), drop excluded equivalents.
export function generateAll(profile, { dir = '.mutek', only, excluded = new Set() } = {}) {
  const byId = new Map();
  const counts = {};
  for (const op of OPERATORS) {
    if (only && !only.includes(op.name) && !only.includes(op.family)) continue;
    let made = [];
    try { made = op.generate(profile, { dir }); } catch (err) { made = []; counts[op.name] = { error: err.message }; continue; }
    counts[op.name] = { generated: made.length };
    for (const m of made) {
      if (!m.touches_tests.length) continue;
      if (byId.has(m.id)) {
        const prev = byId.get(m.id);
        prev.touches_tests = [...new Set([...prev.touches_tests, ...m.touches_tests])].sort();
      } else byId.set(m.id, m);
    }
  }
  const all = [...byId.values()];
  return { candidates: all.filter((m) => !excluded.has(m.id)), excluded: all.filter((m) => excluded.has(m.id)), counts };
}

// Pick up to max mutants, spread across families, operators and tests (round robin), saboteur first.
export function select(candidates, max) {
  if (!max || candidates.length <= max) return candidates;
  const groups = new Map();
  for (const m of candidates) {
    const k = m.operator;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  // within an operator, alternate between the tests that are touched so no single test dominates
  for (const [k, list] of groups) {
    const byTest = new Map();
    for (const m of list) { const t = m.touches_tests[0]; if (!byTest.has(t)) byTest.set(t, []); byTest.get(t).push(m); }
    const queues = [...byTest.values()];
    const spread = [];
    while (queues.some((q) => q.length)) for (const q of queues) if (q.length) spread.push(q.shift());
    groups.set(k, spread);
  }
  // Saboteur mutants are domain rules written from the acceptance criteria: all of them run first.
  const picked = (groups.get('agent-proposed') || []).splice(0, max);
  const order = [...groups.keys()].filter((k) => k !== 'agent-proposed');
  while (picked.length < max && order.some((k) => groups.get(k).length)) {
    for (const k of order) {
      if (picked.length >= max) break;
      const g = groups.get(k);
      if (g.length) picked.push(g.shift());
    }
  }
  return picked;
}
