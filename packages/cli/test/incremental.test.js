// Incremental mode compares changed test files with the paths mutants touch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { changedTests, normalizePath } from '../src/commands/run.js';

test('changedTests keeps only test files, in touches_tests form', () => {
  const s = changedTests('tests/add_todos_test.md\r\nREADME.md\ntests\\edit_todo_test.md\n');
  assert.deepEqual([...s].sort(), ['tests/add_todos_test.md', 'tests/edit_todo_test.md']);
  assert.equal(normalizePath('./tests/a_test.md'), 'tests/a_test.md');
});

test('git diff --relative from a subfolder gives paths that match touches_tests', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-inc-'));
  const run = (c, cwd = repo) => execSync(c, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  run('git init -q');
  run('git config user.email t@t && git config user.name t');
  fs.mkdirSync(path.join(repo, 'demo/app/tests'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'demo/app/tests/a_test.md'), '## A\n');
  fs.writeFileSync(path.join(repo, 'demo/app/tests/b_test.md'), '## B\n');
  run('git add -A && git commit -q -m one');
  const base = run('git rev-parse HEAD').trim();
  fs.appendFileSync(path.join(repo, 'demo/app/tests/a_test.md'), '## A2\n');
  run('git commit -qam two');
  const changed = changedTests(run(`git diff --name-only --relative ${base} --`, path.join(repo, 'demo/app')));
  assert.deepEqual([...changed], ['tests/a_test.md'], 'repo-root paths would never match "tests/a_test.md"');
});
