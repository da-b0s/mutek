# Tripwire

**Break the app on purpose to find out whether a green Kane suite means anything.**

Coding agents write the app and its tests, and they are very good at writing tests that pass.
A passing end-to-end test only matters if it would have failed when the app was broken, and
nobody checks that. Tripwire does.

A proxy sits between the browser and your app and breaks it in one small, realistic way at a time:
a wrong total, a failed save reported as success, a missing button, another user's order in your
list. It never touches your code. [Kane CLI](https://github.com/LambdaTest/kane-cli) replays your
suite against each broken version with healing off. Every bug the suite walks past goes to your
coding agent, which adds one plain-English assertion, and Kane proves it: the strengthened test
**passes on the real app and fails on the broken one**.

![tripwire score](demo/shop/.tripwire/report/badge.svg)

## Results

Two apps, each with a suite written by a fresh Claude Code session that was never told about
Tripwire (Kane CLI 0.10.5, 18 to 20 Nov 2026). Every fix below was proven by two Kane runs: the
strengthened test passes on the real app and fails with the bug armed.

**Demo shop** (`demo/shop`, 6 tests, JSON API)

| Run | Mutants | Score | Killed | Survived | Masked by heal | Not reached |
|---|---|---|---|---|---|---|
| First-draft suite | 40 | **78.4%** | 29 | 7 | 1 | 3 |
| After `tripwire fix` (5 proven fixes) | 40 | **91.9%** | 34 | 2 | 1 | 3 |
| Fresh measured re-run of the strengthened suite, harder set (adds 8 saboteur bugs and the in-page operators) | 50 | **78.7%** | 37 | 10 | 0 | 3 |
| After 3 more proven fixes | 50 | **85.1%** | 40 | 7 | 0 | 3 |

5 of the 7 remaining survivors are flagged *suspected equivalent*: the bug fired but no page ever
showed anything different (mostly saboteur bugs placed in write responses that the shop ignores
because it re-reads the data). They stay in the score: only a person can exclude a mutant.

**TodoMVC** (`demo/third-party`, the unmodified JavaScript ES5 example, 6 tests, no backend)

| Run | Mutants | Score | Killed | Survived | Masked by heal |
|---|---|---|---|---|---|
| First-draft suite | 18 | **77.8%** | 14 | 2 | 2 |
| After `tripwire fix` (4 proven fixes, including both masked bugs) | 18 | **100%** | 18 | 0 | 0 |
| Incremental re-check of the strengthened suite (`--since`, corrected operators) | 17 | **94.1%** | 16 | 1 | 0 |
| After 1 more proven fix | 17 | **100%** | 17 | 0 | 0 |

**What the runs found**

- **Another customer's order (#91002) in "My orders"**, and a product price 10% too high, both green
  in the first-draft shop suite. Both now caught by one appended step each.
- **Default healing passed a bug Kane's own triage had just diagnosed.** With a TodoMVC row hidden,
  strict replay failed and Kane's triage said "application issue, major: the page says 3 items left
  but shows only 'Walk the dog' and 'Read a book'". With healing on, Kane re-authored the check,
  read the hidden row from the DOM, and passed. For masked bugs the agent learned to write checks
  that forbid re-entering data, and those failed on the broken app even with healing on.
- **A replayed "exactly three items" check passed with four rows on screen** (screenshot in the
  report). The appended fix pins the row to directly above the footer.
- **Coverage, with a third state.** Of the shop's 21 acceptance criteria: 7 proven and guarded,
  4 *proven but unguarded* (tests check them, a bug that broke them got past), 3 untouched by any
  mutant, 7 owed (no test checks them).

Website: https://da-b0s.github.io/tripwire/ · Reports: [shop](https://da-b0s.github.io/tripwire/shop/) · [TodoMVC](https://da-b0s.github.io/tripwire/todomvc/)
(each survivor with a screenshot of the broken page the suite passed on, Kane's triage of every
failure, every fix and lesson). Full measurements and findings: [NOTES.md](NOTES.md).

**Cost:** a passing replay ≈ 0.7 credits per test; a failing one ≈ 5 (Kane investigates it); a heal
check 15 to 35; each proven fix ≈ 25.

## Quickstart

You need Node 18+, Chrome, and a [TestMu AI](https://www.testmuai.com) account (free credits).

```bash
npm install -g @testmuai/kane-cli tripwire-e2e
kane-cli login
```

Point your `*_test.md` files at the proxy (`url: http://localhost:8080` in the frontmatter), start
your app, then:

```bash
tripwire run       # baseline, generate mutants, replay, score, report
tripwire fix       # hand each survivor to your agent; Kane proves every new assertion
tripwire check     # exit 1 below the threshold (for hooks and CI)
```

More: `tripwire sabotage` (your agent proposes domain bugs from your acceptance criteria),
`tripwire coverage` (criteria as owed / proven and guarded / proven but unguarded),
`tripwire run --since <ref>` (only mutants whose tests changed), `tripwire doctor` (checks
kane-cli, the login, and leftover Kane browsers that can change a shared app's state).

Try it on the bundled demo shop (its Kane suite and recordings are committed):

```bash
git clone https://github.com/da-b0s/tripwire && cd tripwire && npm install
npm run shop                        # terminal 1: the app, on :3000
```

```bash
cd demo/shop && npx tripwire run    # terminal 2: starts the proxy on :8080 itself
```

Without spending any credits you can inspect the committed results: `npx tripwire check`,
`npx tripwire list`, `npx tripwire run --dry-run` and `npx tripwire report` all work offline.

Long runs are safe to interrupt: `tripwire run --resume` continues from the last finished mutant,
`--retry-errors` re-runs only mutants that hit a Kane service error, and `--redo <id>` re-runs
named mutants. Kane service hiccups before a run starts are waited out automatically.

## What a score means

| Status | Meaning | Counted |
|---|---|---|
| **killed** | at least one test failed while the bug was live | yes |
| **survived** | the bug fired and every test still passed | yes, against you |
| **masked** | strict replay caught it, but with Kane's default healing the test re-authored itself and passed on the broken app | yes, against you |
| **not reached** | the bug never fired in any test (e.g. no test submits invalid input) | no, listed separately |

Score = killed ÷ (killed + survived + masked). Kane errors and timeouts are retried and never
counted. A survivor whose pages never showed anything different from the clean run is flagged as a
*suspected equivalent*; it is excluded only when a person adds it to `.tripwire/equivalents.json`
with a reason, and every exclusion is listed in the report. A gate can set flagged ones aside
without changing the score: `tripwire check --allow-suspected-equivalents` (this repo's CI does).

## The operators

Generated from the traffic and the pages your suite actually produced, so every mutant is
relevant to at least one test. Data mutants only change values that were on screen; interface
mutants target controls by their visible text, or by tag and class with their row for icon buttons
and checkboxes. Links to other sites are never mutated.

| Family | Operator | What breaks |
|---|---|---|
| data | number-drift | a price, total or count is off by one unit or 10% |
| data | item-drop / item-dup | a list loses or repeats an element |
| data | field-swap | two displayed fields of a record are exchanged |
| data | stale-read | a read after a write returns the old data |
| data | wrong-owner | another user's record appears in a list |
| data | rendered-number-drift | a number shown on the page is off by one, changed in the page (no JSON needed) |
| data | rendered-item-drop / -dup | a list row disappears or shows twice, changed in the page |
| behaviour | silent-fail | a write returns 500 and is dropped |
| behaviour | fake-success | a write answers with its usual success body but is never saved |
| behaviour | double-apply | a POST is applied twice |
| behaviour | validation-off | a 400/422 becomes 200 |
| behaviour | auth-drop | one request mid-flow returns 401 |
| interface | hide-control | a control the tests see but never use disappears |
| interface | dead-control | a control the tests click does nothing |
| interface | label-swap | two button labels are exchanged |
| interface | text-change | a heading or status shows the wrong words |
| interface | wrong-link | a link points to a different page |
| interface | missing-row-action | the first row loses its edit/delete/cancel action |
| saboteur | agent-proposed | domain rules broken on purpose, proposed by your agent (`tripwire sabotage`) |

## Use it in your agent

- **Claude Code Stop hook**: [hooks/stop-hook.mjs](hooks/stop-hook.mjs) blocks "done" while tests
  changed since the last run or the score is below the threshold, and names the bugs that got past.
  Merge [hooks/claude-settings.json](hooks/claude-settings.json) into `.claude/settings.json`.
- **Any agent**: copy [hooks/AGENTS.md](hooks/AGENTS.md).
- **CI**: [hooks/tripwire.yml](hooks/tripwire.yml) runs incrementally (`--since`) on pull requests.
- **Memory**: `.tripwire/lessons.md` records each bug with the exact step that was proven to catch
  it; the agent reads it before writing new tests (seen live in the hook session above).

## What Kane does here

| Kane feature | Role in Tripwire |
|---|---|
| `_test.md` replay | the suite runs once per mutant without re-authoring |
| `--no-adaptive-heal` and heal events | strict verdicts; then a healing-on rerun detects masked bugs |
| Policies and `evidence verdict` | an inverted policy (`failed + broken >= 1`) judges every mutant run; a clean policy gates the baseline |
| `metrics.tests_without_checks` | assertion-free tests are reported first |
| Evidence packs | screenshots of the broken page for the report and for the agent |
| NDJSON events, exit codes, failure triage | machine-readable verdicts; Kane's own triage is shown next to each planted bug |
| Official skill | the test-writing agent uses TestMu's skill; Tripwire checks the result |

## Limits

- Tripwire mutates traffic and the rendered page, not source code. It measures whether the suite
  notices breakage a user would see. It does not replace unit-level mutation testing.
- JSON operators need a JSON API; the in-page operators and interface operators work on any page.
  Websockets and static assets pass through untouched.
- Kane's checks are AI-judged and not perfectly repeatable: the same mutant was caught by a test in
  one run and survived it in another, and one check failed with `analyzer_failed` and passed on the
  next replay. Treat a single kill or survival as strong evidence, not proof.
- Equivalence is flagged by comparing page text, so it cannot see effects that never reach the
  page, and older baselines cannot see duplicated rows (duplicating mutants are never flagged then).
- A Kane replay re-evaluates its AI checks, so it is cheap but not free. See [NOTES.md](NOTES.md).
- Only run it against apps you own or run locally.

## For judges

- Everything runs locally against the two demos; you only need a Kane login.
- Both suites were written by separate Claude Code sessions in clean folders that never saw
  Tripwire; transcripts are in `demo/*/agent-session.jsonl`, prompts and what happened in
  `demo/*/WRITE_TESTS_PROMPT.md`.
- `demo/shop/stop-hook-session.jsonl` is a real Claude Code session blocked by the Stop hook.
- If you cannot run it: the committed reports, ledgers, fixes, lessons and screenshots in
  `demo/*/.tripwire/` are the record of every run.

## License

MIT
