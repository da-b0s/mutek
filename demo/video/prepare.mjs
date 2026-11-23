#!/usr/bin/env node
// Builds demo/video/shop: a throwaway copy of the shop project with the agent's ORIGINAL first-draft
// tests and recordings (before any `mutek fix`), so a video can show bugs surviving and then a
// live fix. Run it again before every take; it starts clean each time. Needs the shop running
// (npm run shop) and the global `mutek` (npm install -g mutek).
//
//   node demo/video/prepare.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FIRST_DRAFT = '31454e7'; // "Add the agent-written first-draft Kane suite for the demo shop"
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const out = path.join(here, 'shop');
const git = (...args) => execFileSync('git', args, { cwd: repo, maxBuffer: 1 << 26 });

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// every file under demo/shop/tests as it was at the first-draft commit (tests + Kane recordings)
const files = git('ls-tree', '-r', '--name-only', FIRST_DRAFT, '--', 'demo/shop/tests').toString().split('\n').filter(Boolean);
for (const f of files) {
  const dest = path.join(out, path.relative('demo/shop', f));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, git('show', `${FIRST_DRAFT}:${f}`));
}
for (const f of ['mutek.config.json', 'ACCEPTANCE.md']) fs.copyFileSync(path.join(repo, 'demo/shop', f), path.join(out, f));

console.log(`Ready: ${path.relative(repo, out)} (${files.length} files, first-draft suite from ${FIRST_DRAFT})`);
console.log('Scene commands, from that folder:');
console.log('  mutek run --only number-drift,wrong-owner --no-heal-check');
console.log('  mutek fix --only "wrong-owner:GET /api/orders:$.orders"');
