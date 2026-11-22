#!/usr/bin/env node
// Assembles docs/ (served by GitHub Pages) from the landing page in site/ and the two reports:
//   /          site/index.html and site/assets
//   /shop/     demo/shop/.tripwire/report
//   /todomvc/  demo/third-party/.tripwire/report
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(repo, 'docs');
const cli = path.join(repo, 'packages/cli/bin/tripwire.js');

for (const d of ['demo/shop/.tripwire', 'demo/third-party/.tripwire']) execFileSync(process.execPath, [cli, 'report', '--dir', path.join(repo, d)], { stdio: 'ignore' });

// empty docs/ rather than deleting it (Windows refuses to delete a folder another process is in)
fs.mkdirSync(docs, { recursive: true });
for (const f of fs.readdirSync(docs)) fs.rmSync(path.join(docs, f), { recursive: true, force: true });
fs.cpSync(path.join(repo, 'site'), docs, { recursive: true, filter: (src) => !src.endsWith('publish.mjs') });
fs.cpSync(path.join(repo, 'demo/shop/.tripwire/report'), path.join(docs, 'shop'), { recursive: true });
fs.cpSync(path.join(repo, 'demo/third-party/.tripwire/report'), path.join(docs, 'todomvc'), { recursive: true });
fs.writeFileSync(path.join(docs, '.nojekyll'), '');
console.log('docs/ assembled: / (landing), /shop/, /todomvc/');
