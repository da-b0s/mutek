// Project configuration: tripwire.config.json in the working directory, overridden by flags.
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULTS = {
  app: 'http://localhost:3000',      // the real app, behind the proxy
  port: 8080,                         // the proxy port your tests point at (url: in frontmatter)
  tests: '**/*_test.md',
  reset: null,                        // { "url": "http://localhost:3000/api/__reset", "method": "POST" } or { "cmd": "npm run db:reset" }
  maxMutants: 40,
  timeout: 180,
  threshold: 80,
  healCheck: true,
  healBudget: 10,
  dir: '.tripwire',
  agent: 'claude'
};

export function loadConfig(cwd = process.cwd()) {
  const file = path.join(cwd, 'tripwire.config.json');
  if (!fs.existsSync(file)) return { ...DEFAULTS };
  return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
}

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

// Minimal glob for *_test.md discovery: **, * and ?.
export function findTests(pattern, cwd = process.cwd()) {
  const re = globToRegExp(pattern);
  const out = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.') || e.name.startsWith('output-') || e.name.startsWith('helper-output-')) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else if (e.name.endsWith('_test.md') && re.test(r)) out.push(r);
    }
  };
  walk(cwd, '');
  return out.sort();
}
