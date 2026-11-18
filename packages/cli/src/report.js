// Static HTML report and README badge, built from .tripwire/ state. No server, no external assets.
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { readLedger, latest, lastRunId, score, perTest } from './ledger.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => s.replace(/[^\w.-]+/g, '_').slice(0, 80);
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const readLines = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

// The last screenshot of a test inside an evidence pack (the page as it was when the run ended).
export function lastScreenshot(pack) {
  if (!pack || !fs.existsSync(pack)) return null;
  try {
    const zip = new AdmZip(pack);
    // Kane writes steps/<ordinal>-<id>/screenshot.jpg (older packs: .png)
    const shots = zip.getEntries().map((e) => e.entryName).filter((n) => /\/steps\/[^/]+\/screenshot\.(png|jpe?g)$/.test(n));
    if (!shots.length) return null;
    const ord = (n) => Number((n.match(/\/steps\/(\d+)/) || [])[1] || 0);
    shots.sort((a, b) => ord(a) - ord(b));
    return zip.getEntry(shots[shots.length - 1]).getData();
  } catch { return null; }
}

// File extension from the image's magic bytes.
export const imageExt = (buf) => (buf[0] === 0x89 && buf[1] === 0x50 ? 'png' : 'jpg');

export function badge(scoreValue) {
  const label = 'tripwire';
  const value = scoreValue === null || scoreValue === undefined ? 'n/a' : `${Math.round(scoreValue)}%`;
  const color = scoreValue === null || scoreValue === undefined ? '#9f9f9f' : scoreValue >= 80 ? '#2e7d32' : scoreValue >= 60 ? '#b26a00' : '#c62828';
  const lw = 58, vw = 8 + value.length * 7.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + vw}" height="20" role="img" aria-label="${label}: ${value}"><title>${label}: ${value}</title><rect width="${lw}" height="20" fill="#444"/><rect x="${lw}" width="${vw}" height="20" fill="${color}"/><g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle"><text x="${lw / 2}" y="14">${label}</text><text x="${lw + vw / 2}" y="14">${value}</text></g></svg>`;
}

export function writeReport(dir) {
  const out = path.join(dir, 'report');
  const shotsDir = path.join(out, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  const all = readLedger(dir);
  const runId = lastRunId(all);
  const rows = latest(all, runId);
  const s = score(rows);
  const tests = perTest(rows);
  const baseline = readJson(path.join(dir, 'baseline.json'), { tests: [] });
  const summary = readJson(path.join(dir, 'runs', runId || '-', 'summary.json'), {});
  const fixes = readLines(path.join(dir, 'fixes.jsonl'));
  const equivalents = readJson(path.join(dir, 'equivalents.json'), []);
  const lessons = fs.existsSync(path.join(dir, 'lessons.md')) ? fs.readFileSync(path.join(dir, 'lessons.md'), 'utf8') : '';
  const coverage = readJson(path.join(dir, 'coverage.json'), null);

  // score history: one point per run (first-draft vs now)
  const runs = [...new Set(all.map((r) => r.run))];
  const history = runs.map((r) => ({ run: r, ...score(latest(all, r)) })).filter((h) => h.score !== null);

  const shot = (row) => {
    const run = row.status === 'killed' ? row.runs?.find((x) => x.code === 1) : row.status === 'masked' ? null : row.runs?.find((x) => x.code === 0 && x.fired);
    const buf = lastScreenshot(run?.pack);
    if (!buf) return '';
    const name = `${slug(row.id)}.${imageExt(buf)}`;
    fs.writeFileSync(path.join(shotsDir, name), buf);
    return `<figure><img src="shots/${esc(name)}" alt="The broken page as the test left it" loading="lazy"><figcaption>The broken app at the end of ${esc(run.test)}. The test still passed.</figcaption></figure>`;
  };

  // Kane triages each failed replay on its own. Tripwire knows the app was broken on purpose,
  // so it can show how that triage read a real product bug.
  const triage = (r) => {
    const t = r.runs?.find((x) => x.kaneTriage)?.kaneTriage;
    if (!t) return '';
    const product = t.family === 'product_bug' || t.confirmed;
    return `<p class="triage">Kane's triage of the failure: <strong>${esc((t.family || '').replace(/_/g, ' '))}</strong>${t.category ? ` / ${esc(t.category.replace(/_/g, ' '))}` : ''}${t.confidence ? ` (${Math.round(t.confidence * 100)}%)` : ''}. ${product ? 'It identified a product bug.' : 'The app really was broken: this was a product bug.'}</p>`;
  };
  const triaged = rows.filter((r) => r.status === 'killed' && r.runs?.some((x) => x.kaneTriage));
  const triagedAsTest = triaged.filter((r) => { const t = r.runs.find((x) => x.kaneTriage).kaneTriage; return !(t.family === 'product_bug' || t.confirmed); });

  const byStatus = (st) => rows.filter((r) => r.status === st);
  const fixFor = new Map(fixes.filter((f) => f.result === 'killed').map((f) => [f.id, f]));
  const card = (r, withShot) => `
    <article class="mutant ${r.status}">
      <header><span class="pill ${r.status}">${esc(r.status.replace('-', ' '))}</span><span class="op">${esc(r.family)} · ${esc(r.operator)}</span></header>
      <h3>${esc(r.describe)}</h3>
      ${r.expect ? `<p class="expect">A good test would: ${esc(r.expect.charAt(0).toLowerCase() + r.expect.slice(1))}.</p>` : ''}
      <p class="meta">Tests that walked past it: ${(r.touches_tests || []).map((t) => `<code>${esc(t)}</code>`).join(' ')}</p>
      ${r.status === 'masked' ? `<p class="warn">With healing off, <code>${esc(r.killed_by)}</code> failed. With Kane's default healing it re-authored its steps and <strong>passed on the broken app</strong>.</p>` : ''}
      ${triage(r)}
      ${fixFor.has(r.id) ? `<p class="fixed">Fixed by <code>tripwire fix</code>: clean run passed, mutant run failed (${esc(fixFor.get(r.id).proof?.clean?.session || '')} / ${esc(fixFor.get(r.id).proof?.mutant?.session || '')}).</p>` : ''}
      ${withShot ? shot(r) : ''}
      <details><summary>Mutant id</summary><code>${esc(r.id)}</code></details>
    </article>`;

  const pct = (v) => (v === null || v === undefined ? '–' : `${v}%`);
  const minutes = Math.round(rows.reduce((a, r) => a + (r.runs || []).reduce((b, x) => b + (x.durationMs || 0), 0), 0) / 600) / 100;
  const perMutant = rows.length ? Math.round((minutes * 60) / rows.length) : 0;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tripwire report</title>
<style>
:root{--bg:#f6f5f1;--surface:#fff;--ink:#1c1b19;--muted:#66625b;--line:#e2ded5;--killed:#2e7d32;--survived:#c62828;--masked:#8e24aa;--nr:#6d6d6d;--accent:#2f5d50}
@media (prefers-color-scheme:dark){:root{--bg:#141412;--surface:#1d1c1a;--ink:#ecebe7;--muted:#a19d95;--line:#33312d;--killed:#66bb6a;--survived:#ef5350;--masked:#ce93d8;--nr:#9e9e9e;--accent:#7fb7a5}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1040px;margin:0 auto;padding:32px 16px 80px}h1{font-size:1.5rem;margin:0}h2{font-size:1.15rem;margin:40px 0 12px}h3{font-size:1rem;margin:8px 0}
.top{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:24px}
.score{font-size:3.5rem;font-weight:700;line-height:1}.sub{color:var(--muted)}
.counts{display:flex;flex-wrap:wrap;gap:8px}.count{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:8px 14px;min-width:110px}.count b{display:block;font-size:1.4rem}
.count.killed b{color:var(--killed)}.count.survived b{color:var(--survived)}.count.masked b{color:var(--masked)}.count.nr b{color:var(--nr)}
table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow:hidden}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:.85rem;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.mutant{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--nr);border-radius:8px;padding:14px}
.mutant.survived{border-left-color:var(--survived)}.mutant.masked{border-left-color:var(--masked)}.mutant.killed{border-left-color:var(--killed)}
.pill{font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-right:8px}.pill.survived{color:var(--survived)}.pill.masked{color:var(--masked)}.pill.killed{color:var(--killed)}.pill.not-reached,.pill.error{color:var(--nr)}
.op{font-size:.8rem;color:var(--muted)}.expect,.meta{color:var(--muted);font-size:.9rem;margin:4px 0}.warn{color:var(--masked);font-size:.9rem}.triage{font-size:.85rem;color:var(--muted);border-left:2px solid var(--line);padding-left:8px}.fixed{color:var(--killed);font-size:.9rem}
figure{margin:10px 0 0}img{max-width:100%;border:1px solid var(--line);border-radius:6px}figcaption{font-size:.8rem;color:var(--muted)}
details{margin-top:8px;font-size:.8rem;color:var(--muted)}code{font-family:ui-monospace,Consolas,monospace;font-size:.85em;word-break:break-all}
.bar{height:8px;background:var(--line);border-radius:4px;overflow:hidden;min-width:80px}.bar i{display:block;height:100%;background:var(--killed)}
.history{display:flex;gap:16px;flex-wrap:wrap}.history div{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:8px 14px}
.lessons{white-space:pre-wrap;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px;font-size:.9rem}
.note{color:var(--muted);font-size:.9rem;max-width:70ch}
</style></head><body><main>
<section class="top">
  <div><h1>Tripwire</h1><p class="sub">Would the tests fail if the app were broken? Run ${esc(runId || '–')}${summary.commit ? ` · commit ${esc(summary.commit)}` : ''}</p>
  <div class="score" aria-label="mutation score">${pct(s.score)}</div><p class="sub">of reachable bugs caught (killed ÷ killed + survived + masked)</p></div>
  <div class="counts">
    <div class="count killed"><b>${s.killed}</b>killed</div>
    <div class="count survived"><b>${s.survived}</b>survived</div>
    <div class="count masked"><b>${s.masked}</b>masked by heal</div>
    <div class="count nr"><b>${s['not-reached']}</b>not reached</div>
  </div>
</section>

${history.length > 1 ? `<h2>Score over time</h2><div class="history">${history.map((h, i) => `<div><b>${pct(h.score)}</b><br><span class="sub">${i === 0 ? 'first run' : esc(h.run.slice(5, 16).replace('T', ' '))}</span></div>`).join('')}</div>` : ''}

<h2>Bugs the suite walked past (${s.survived})</h2>
${s.survived ? `<div class="grid">${byStatus('survived').map((r) => card(r, true)).join('')}</div>` : '<p class="note">None. Every mutant that fired was caught.</p>'}

<h2>Masked by healing (${s.masked})</h2>
<p class="note">Strict replay caught these, but Kane's default adaptive healing re-authored the failing steps and the run passed on the broken app. Run suites that guard releases with <code>--no-adaptive-heal</code>, or gate on <code>metrics.heal.healed_tests</code>.</p>
${s.masked ? `<div class="grid">${byStatus('masked').map((r) => card(r, false)).join('')}</div>` : ''}

<h2>Per test</h2>
<table><thead><tr><th>Test</th><th>Mutants touched</th><th>Killed</th><th>Walked past</th><th>Score</th><th>Assertions</th></tr></thead><tbody>
${tests.map((t) => { const b = baseline.tests?.find((x) => x.test === t.test); return `<tr><td><code>${esc(t.test)}</code></td><td>${t.touched}</td><td>${t.killed}</td><td>${t.survivedPast + t.masked}</td><td><div class="bar" title="${t.score ?? '–'}%"><i style="width:${t.score ?? 0}%"></i></div>${t.score ?? '–'}%</td><td>${b?.testsWithoutChecks ? '<strong style="color:var(--survived)">none</strong>' : 'yes'}</td></tr>`; }).join('')}
</tbody></table>

${coverage ? `<h2>Acceptance criteria</h2><table><thead><tr><th>Criterion</th><th>Kane cover</th><th>Tripwire</th></tr></thead><tbody>${coverage.map((c) => `<tr><td>${esc(c.criterion)}</td><td>${esc(c.kane)}</td><td>${esc(c.state)}</td></tr>`).join('')}</tbody></table><p class="note"><b>Proven but unguarded</b>: the linked tests pass, but none of them caught a mutant that touched them.</p>` : ''}

${triaged.length ? `<h2>How Kane's triage read the planted bugs</h2>
<p class="note">Every mutant below was a real break in the app. Kane triaged ${triaged.length} of the failing runs; it attributed <strong>${triagedAsTest.length}</strong> of them to the test rather than the product (typically "locator rot": the page changed, so the recording looks stale). From inside a single run a broken app and an outdated test look alike; Tripwire is the outside reference that tells them apart. Treat a triage of "automation bug" on a release branch as a prompt to look, not as a reason to re-record.</p>` : ''}

<h2>Caught (${s.killed})</h2>
<details><summary>Show all ${s.killed} killed mutants</summary><div class="grid">${byStatus('killed').map((r) => card(r, false)).join('')}</div></details>

<h2>Not reached (${s['not-reached']})</h2>
<p class="note">The mutant never fired during any test, so it says nothing about the assertions. It usually means no test exercises that path (for example, no test ever submits invalid input). Not counted in the score.</p>
<details><summary>Show</summary><ul>${byStatus('not-reached').map((r) => `<li>${esc(r.describe)}</li>`).join('')}</ul></details>

${byStatus('error').length ? `<h2>Errors (${byStatus('error').length})</h2><p class="note">Kane exited 2 (error) or 3 (timeout) twice. Never counted as kills.</p><ul>${byStatus('error').map((r) => `<li>${esc(r.describe)}</li>`).join('')}</ul>` : ''}

<h2>Excluded as equivalent (${equivalents.length})</h2>
${equivalents.length ? `<ul>${equivalents.map((e) => `<li><code>${esc(e.id)}</code> – ${esc(e.reason)}${e.approvedBy ? ` (approved by ${esc(e.approvedBy)})` : ''}</li>`).join('')}</ul>` : '<p class="note">None. Mutants are excluded only with a human-approved reason in <code>.tripwire/equivalents.json</code>.</p>'}

${fixes.length ? `<h2>Strengthened tests (${fixes.filter((f) => f.result === 'killed').length} of ${fixes.length} attempts)</h2><table><thead><tr><th>Mutant</th><th>Test</th><th>Result</th><th>Attempts</th></tr></thead><tbody>${fixes.map((f) => `<tr><td>${esc(f.describe)}</td><td><code>${esc(f.test || '')}</code></td><td>${esc(f.result)}</td><td>${f.attempts}</td></tr>`).join('')}</tbody></table>` : ''}

${lessons ? `<h2>Lessons for the test-writing agent</h2><div class="lessons">${esc(lessons)}</div>` : ''}

<h2>Cost</h2>
<p>${rows.length} mutants · ${minutes} minutes of Kane runs (${perMutant}s per mutant)${summary.creditsUsed !== null && summary.creditsUsed !== undefined ? ` · ${summary.creditsUsed} credits` : ''}. Replays run from Kane's cache with healing off.</p>

<h2>What this does not measure</h2>
<p class="note">Tripwire mutates traffic and the rendered page, not source code. It tells you whether the suite notices breakage a user would see. It does not replace unit-level mutation testing, and it cannot see server-side effects that never reach the browser.</p>
</main></body></html>`;

  fs.writeFileSync(path.join(out, 'index.html'), html);
  fs.writeFileSync(path.join(out, 'badge.svg'), badge(s.score));
  fs.writeFileSync(path.join(out, 'score.json'), JSON.stringify({ run: runId, ...s }, null, 2));
  return path.join(out, 'index.html');
}
