// Minimal JSON path helpers for paths like $.items[0].price or $.orders[2].
// Enough for mutant definitions; not a full JSONPath implementation.

export function parsePath(p) {
  if (!p.startsWith('$')) throw new Error(`json path must start with $: ${p}`);
  const parts = [];
  const re = /\.([A-Za-z_$][\w$-]*)|\[(\d+)\]|\["([^"]+)"\]/g;
  let m;
  let pos = 1;
  while ((m = re.exec(p))) {
    if (m.index !== pos) throw new Error(`bad json path: ${p}`);
    parts.push(m[1] ?? (m[2] !== undefined ? Number(m[2]) : m[3]));
    pos = re.lastIndex;
  }
  if (pos !== p.length) throw new Error(`bad json path: ${p}`);
  return parts;
}

export function formatPath(parts) {
  return '$' + parts.map((k) => (typeof k === 'number' ? `[${k}]` : /^[A-Za-z_$][\w$-]*$/.test(k) ? `.${k}` : `["${k}"]`)).join('');
}

export function get(obj, p) {
  let cur = obj;
  for (const k of parsePath(p)) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

// Returns { parent, key } for the last segment, or null if the path does not exist.
export function locate(obj, p) {
  const parts = parsePath(p);
  if (parts.length === 0) return null;
  let cur = obj;
  for (const k of parts.slice(0, -1)) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[k];
  }
  if (cur == null || typeof cur !== 'object') return null;
  const key = parts[parts.length - 1];
  if (!(key in cur)) return null;
  return { parent: cur, key };
}

// Walk every leaf: cb(pathString, value, parentArrayPath?)
export function walk(obj, cb, parts = []) {
  if (Array.isArray(obj)) {
    cb(formatPath(parts), obj, parts);
    obj.forEach((v, i) => walk(v, cb, [...parts, i]));
  } else if (obj && typeof obj === 'object') {
    if (parts.length) cb(formatPath(parts), obj, parts);
    for (const [k, v] of Object.entries(obj)) walk(v, cb, [...parts, k]);
  } else {
    cb(formatPath(parts), obj, parts);
  }
}
