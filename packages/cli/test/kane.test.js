// Transient Kane failures before a run starts are waited out, not counted as errors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTest, isTransient, summarizeEvents } from '../src/kane.js';

const here = path.dirname(fileURLToPath(import.meta.url));

test('isTransient: only pre-run failures that match known service errors', () => {
  const pre = { code: 2, events: [{ type: 'stream_start' }], stderr: 'error: TMS did not return an org_id. Run `kane-cli login` again.', stdout: '' };
  assert.equal(isTransient(pre), true);
  assert.equal(isTransient({ ...pre, code: 1 }), false, 'a test failure is never transient');
  assert.equal(isTransient({ ...pre, stderr: 'error: invalid flag --nope' }), false, 'a usage error is not transient');
  assert.equal(isTransient({ ...pre, events: [{ type: 'test_md_step_start' }] }), false, 'once steps ran, it is not retried');
});

test('runTest retries a transient failure with backoff, then runs the test', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-kane-'));
  fs.writeFileSync(path.join(dir, 'a_test.md'), '## A\nDo a.\n');
  fs.writeFileSync(path.join(dir, 'a_test.fake.json'), JSON.stringify({ steps: [] }));
  const counter = path.join(dir, 'count');
  process.env.MUTEK_KANE = `"${process.execPath}" "${path.join(here, 'fake-kane.mjs')}"`;
  process.env.FAKE_TRANSIENT = `${counter}|2`;
  process.env.FAKE_BASE = 'http://127.0.0.1:9';
  const retries = [];
  try {
    const r = await runTest('a_test.md', { cwd: dir, backoff: [10, 10, 10], onRetry: (n) => retries.push(n) });
    assert.deepEqual(retries, [1, 2]);
    assert.equal(r.code, 0);
    assert.equal(r.transient, false);
  } finally {
    delete process.env.FAKE_TRANSIENT; delete process.env.MUTEK_KANE;
  }
});

test('summarizeEvents reads the failing step and Kane triage', () => {
  const s = summarizeEvents([
    { type: 'run_end', status: 'passed', reason: 'replay completed' },
    { type: 'run_end', status: 'failed', reason: 'assertion_failed: @ step 2' },
    { type: 'test_md_step_end', step_index: 3, status: 'failed' },
    { type: 'test_md_bug_verdict', confirmed: false, family: 'automation_bug', category: 'locator_rot', confidence: 0.96 },
    { type: 'test_md_adaptive_heal', shrink_count: 1 },
    { type: 'test_md_done', overall_status: 'failed', session_id: 's1' }
  ]);
  assert.equal(s.failureReason, 'assertion_failed: @ step 2');
  assert.equal(s.failedStep, 3);
  assert.equal(s.bugVerdict.category, 'locator_rot');
  assert.equal(s.healEvents, 1);
  assert.equal(s.sessionId, 's1');
});

test('the whole-test safety timer allows every step its timeout', async () => {
  const { killAfterFor } = await import('../src/kane.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-timer-'));
  fs.writeFileSync(path.join(dir, 'x_test.md'), '## A\na\n## B\nb\n## C\nc\n');
  assert.equal(killAfterFor('x_test.md', 180, dir), (180 * 3 + 180) * 1000);
  assert.equal(killAfterFor('missing_test.md', 180, dir), (180 + 180) * 1000);
});
