// Mutant definition validation. Used for generated, saboteur and hand-written mutants alike.
const ACTIONS = {
  json: (a) => Array.isArray(a.ops) && a.ops.length > 0 && a.ops.every((o) => typeof o.op === 'string' && typeof o.path === 'string' && o.path.startsWith('$')),
  respond: (a) => Number.isInteger(a.status),
  'forward-twice': () => true,
  'status-map': (a) => Array.isArray(a.from) && Number.isInteger(a.to),
  'stale-read': () => true,
  dom: (a) => a.dom && typeof a.dom.op === 'string' && a.dom.target && typeof a.dom.target.text === 'string',
  'inject-css': (a) => typeof a.css === 'string',
  'html-replace': (a) => typeof a.find === 'string' && typeof a.replace === 'string'
};
const DOM_OPS = ['hide', 'dead', 'swap-labels', 'replace-text', 'relink', 'remove-row-action', 'drift-number'];
const JSON_OPS = ['add', 'scale', 'set', 'remove-index', 'dup-index', 'swap', 'push'];

export function validateMutant(m) {
  const errors = [];
  if (!m || typeof m !== 'object') return ['mutant must be an object'];
  if (typeof m.id !== 'string' || !m.id) errors.push('id is required');
  if (typeof m.describe !== 'string' || !m.describe) errors.push('describe is required (one sentence a user would notice)');
  if (!m.match || (!m.match.document && !m.match.path)) errors.push('match needs a path (and method) or document: true');
  if (!m.action || !ACTIONS[m.action.type]) errors.push(`action.type must be one of ${Object.keys(ACTIONS).join(', ')}`);
  else if (!ACTIONS[m.action.type](m.action)) errors.push(`action is malformed for type ${m.action.type}`);
  if (m.action?.type === 'json') for (const o of m.action.ops || []) if (!JSON_OPS.includes(o.op)) errors.push(`unknown json op ${o.op}`);
  if (m.action?.type === 'dom' && !DOM_OPS.includes(m.action.dom?.op)) errors.push(`unknown dom op ${m.action.dom?.op}`);
  return errors;
}
