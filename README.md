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

On the demo shop, with a 6-test suite written by a fresh Claude Code session that was never told
about Tripwire (run of 18 Nov 2026, Kane CLI 0.10.5):

| | Score | Killed | Survived | Masked by heal | Not reached |
|---|---|---|---|---|---|
| Agent's first-draft suite | **83.3%** | 25 | 4 | 1 | 2 |
| After `tripwire fix` (2 tests strengthened) | **90%** | 27 | 2 | 1 | 2 |

Bugs the first-draft suite walked past, all green in Kane:

- **Another customer's order (#91002) listed in "My orders".** Fixed: `cancel_order_test.md` now
  checks the list holds exactly the user's own orders.
- **A product price shown 10% too high** ($19.80 instead of $18.00). Fixed: `browse_test.md` now
  checks a price in the product grid.
- The "Keep order" button missing from the cancel dialog.
- The "+" and "−" quantity buttons swapping labels (the test presses them by accessibility name,
  so it never looks at what the user sees).

Masked by healing: a one-off "session expired" (401) during cancel. Strict replay failed; with
Kane's default adaptive healing the test re-authored itself past the sign-in page and passed.

Each fix was proven on the first attempt by two Kane runs: pass on the real app, fail with the bug
armed. Score = killed ÷ (killed + survived + masked) over 32 of 40 selected mutants; the remaining
8 are queued (`tripwire run --resume`). The full [report](demo/shop/.tripwire/report/index.html)
has a screenshot of every broken page the suite passed on, and Kane's own triage of every failure.

**Cost:** baseline replay of 6 tests ≈ 4 credits; mutant runs ≈ 1 to 5 credits each (a failing
replay costs more because Kane investigates it); a heal check ≈ 15 to 35; each proven fix ≈ 25.

## Quickstart

You need Node 18+, Chrome, and a [TestMu AI](https://www.testmuai.com) account (free credits).

```bash
npm install -g @testmuai/kane-cli tripwire-e2e
kane-cli login
```

Point your `*_test.md` files at the proxy (`url: http://localhost:8080` in the frontmatter), start
your app, then:

```bash
tripwire run      # baseline, generate mutants, replay, score, report
tripwire fix      # hand each survivor to your agent; Kane proves every new assertion
tripwire check    # exit 1 below the threshold (for hooks and CI)
```

Try it on the bundled demo shop:

```bash
git clone https://github.com/da-b0s/tripwire && cd tripwire && npm install
npm run shop &                      # the app, on :3000
cd demo/shop && npx tripwire run    # starts the proxy on :8080 itself
```

## What a score means

| Status | Meaning | Counted |
|---|---|---|
| **killed** | at least one test failed while the bug was live | yes |
| **survived** | the bug fired and every test still passed | yes, against you |
| **masked** | strict replay caught it, but with Kane's default healing the test re-authored itself and passed on the broken app | yes, against you |
| **not reached** | the bug never fired in any test (e.g. no test submits invalid input) | no, listed separately |

Score = killed ÷ (killed + survived + masked). Kane exit codes 2 and 3 (errors, timeouts) are
retried once and never counted as kills. Mutants are only excluded as "equivalent" with a
human-written reason in `.tripwire/equivalents.json`, and every exclusion is listed in the report.

## The operators

Generated from the traffic and the pages your suite actually produced, so every mutant is
relevant to at least one test. Data mutants only change values that were on screen, and interface
mutants target controls by their visible text.

| Family | Operator | What breaks |
|---|---|---|
| data | number-drift | a price, total or count is off by one unit or 10% |
| data | item-drop / item-dup | a list loses or repeats an element |
| data | field-swap | two displayed fields of a record are exchanged |
| data | stale-read | a read after a write returns the old data |
| data | wrong-owner | another user's record appears in a list |
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
- **Memory**: `.tripwire/lessons.md` collects assertion patterns that caught real bugs; the agent
  reads it before writing new tests, so first drafts get stronger.

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
- Server-rendered pages carry data in HTML, not JSON; data operators work on JSON APIs, interface
  operators work on any page. Websockets and static assets pass through untouched.
- A Kane replay re-evaluates its AI checks, so it is cheap but not free (measured: ~2 credits per
  3-step replay). See [NOTES.md](NOTES.md) for every measurement.
- Only run it against apps you own or run locally.

## For judges

- Everything runs locally against the demo shop; you only need a Kane login.
- The demo suite in `demo/shop/tests/` was written by a separate Claude Code session that was never
  told about Tripwire; its full transcript is in `demo/shop/agent-session.jsonl` and the prompt in
  [WRITE_TESTS_PROMPT.md](demo/shop/WRITE_TESTS_PROMPT.md).
- If you cannot run it: the committed report, ledger and screenshots in `demo/shop/.tripwire/`
  are the record of the runs shown in the video.

## License

MIT
