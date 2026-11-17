// Applies a mutant's response-body action. Pure functions, unit-tested.
import { locate } from './jsonpath.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

// Apply a list of JSON ops to a parsed body. Returns { body, changed }.
export function applyJsonOps(body, ops) {
  const out = clone(body);
  let changed = false;
  for (const op of ops) {
    const at = locate(out, op.path);
    if (!at) continue;
    const { parent, key } = at;
    const cur = parent[key];
    switch (op.op) {
      case 'add': // number drift by a fixed amount
        if (typeof cur === 'number') { parent[key] = round(cur + op.value); changed = true; }
        break;
      case 'scale': // number drift by a factor (1.1 = +10%)
        if (typeof cur === 'number') { parent[key] = round(cur * op.value); changed = true; }
        break;
      case 'set':
        parent[key] = op.value; changed = true;
        break;
      case 'remove-index':
        if (Array.isArray(cur) && cur.length > op.index) { cur.splice(op.index, 1); changed = true; }
        break;
      case 'dup-index':
        if (Array.isArray(cur) && cur.length > op.index) { cur.splice(op.index + 1, 0, clone(cur[op.index])); changed = true; }
        break;
      case 'swap': { // swap two sibling string fields: path is the object, a/b are keys
        if (cur && typeof cur === 'object' && op.a in cur && op.b in cur) {
          [cur[op.a], cur[op.b]] = [cur[op.b], cur[op.a]]; changed = true;
        }
        break;
      }
      case 'push': // add a record to a list (wrong-owner)
        if (Array.isArray(cur)) { op.position === 'start' ? cur.unshift(clone(op.value)) : cur.push(clone(op.value)); changed = true; }
        break;
      default:
        throw new Error(`unknown json op: ${op.op}`);
    }
  }
  return { body: out, changed };
}

const round = (n) => Math.round(n * 100) / 100;

// Insert markup into an HTML document just before </head> (or at the start if absent).
export function injectHtml(html, snippet, where = 'head') {
  const tag = where === 'head' ? /<\/head\s*>/i : /<\/body\s*>/i;
  if (tag.test(html)) return html.replace(tag, (m) => snippet + m);
  return snippet + html;
}

export function replaceHtml(html, find, replace) {
  if (!html.includes(find)) return { html, changed: false };
  return { html: html.split(find).join(replace), changed: true };
}
