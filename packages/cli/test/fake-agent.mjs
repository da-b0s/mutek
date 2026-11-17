#!/usr/bin/env node
// A stand-in coding agent for the fix-loop test. Reads the prompt on stdin and appends one
// assertion step to the test, plus the matching expectation in its .fake.json for fake-kane.
// FAKE_AGENT_MODE=good  -> asserts the cart total (catches number-drift on $.total)
// FAKE_AGENT_MODE=weak  -> appends a step that checks nothing new (must be rejected by the proof)
// FAKE_AGENT_MODE=cheat -> rewrites an existing step (must be rejected as not append-only)
import fs from 'node:fs';

let prompt = '';
for await (const c of process.stdin) prompt += c;
const test = prompt.match(/^Test file: (.+)$/m)[1].trim();
const mode = process.env.FAKE_AGENT_MODE || 'good';
const fakeFile = test.replace(/_test\.md$/, '_test.fake.json');
const spec = JSON.parse(fs.readFileSync(fakeFile, 'utf8'));
if (mode === 'cheat') {
  fs.writeFileSync(test, fs.readFileSync(test, 'utf8').replace('##', '## Changed'));
} else {
  fs.appendFileSync(test, '\n## Check the total\nOpen the cart and verify the total.\n');
  spec.steps.push(mode === 'good' ? { path: '/api/cart', expect: { path: '$.total', equals: spec.expectTotal } } : { path: '/api/cart' });
  fs.writeFileSync(fakeFile, JSON.stringify(spec));
}
console.log(`Added a check of the cart total (${mode}).`);
