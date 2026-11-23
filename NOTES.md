# Build notes

Kane CLI version: 0.10.5 (`npm install -g @testmuai/kane-cli`), Node 24, Windows 11.

## First-hour checks (run 17 Nov 2026 on `demo/probe/probe_test.md`, 3 steps)

| # | Check | Result | Finding |
|---|-------|--------|---------|
| 1 | Replay cost | **measured** | First run (authoring): 131 s, ~51 credits. Replay: 39 s, ~2 credits. Replay is not free: each "analyze" check is re-evaluated live (~0.7 credits each). A replay that fails costs ~5 credits and ~130 s because Kane triages the failure. |
| 2 | A replay that should fail, fails | **yes** | Changing the asserted "Your cart is empty." text: exit 1 at the asserting step, mutant fired. Replay re-checks asserted values; it does not skip them. |
| 3 | Replay through the proxy | **yes** | Recorded and replayed at `http://localhost:8080`; no URL override needed. |
| 4 | Heal behaviour | **visible** | NDJSON has `test_md_adaptive_heal` (shrink count, re-author boundary). Hiding the clicked Cart link: healing re-authored the step, still failed (not masked). Cost ~15 credits, 225 s. **A heal run rewrites `output-<stem>/` even when it fails**, so Mutek restores the recording after every mutant run. |
| 5 | Inverted policy | **works, with a fix** | A failed replay assertion was recorded in the pack as `broken` (not `failed`) because Kane's triage called it an automation bug (`locator_rot`). The mutant policy uses `expr: totals.failed + totals.broken >= 1`; the clean policy also requires `totals.broken == 0`. Verified on real packs both ways. |
| 6 | Batch runs | not needed | Baseline runs one file at a time so the proxy can attribute traffic to each test. |
| 7 | Evidence pack contents | **confirmed** | Zip with `run.yaml`, `tests/<id>/result.yaml`, per-step screenshots, HAR and console logs. `result.yaml` contains the account email: never commit raw packs; publish screenshots, verdicts and the report instead. Recordings (`output-*/.internal`) hold only numeric account ids. |

Other observations:
- Kane triages every failed replay (`test_md_bug_verdict`). For mutants it said "automation bug / locator rot" with 0.96 to 0.98 confidence: from inside one run, a broken app and an outdated test look the same. Mutek knows which it was. The report shows Kane's triage next to the planted bug.
- One run ended with exit 2, `TMS did not return an org_id` (transient, on a flaky connection). The runner retries exit 2 and 3 once and never counts them as kills.
- Kane's optional Windows packages (~100 MB) failed to download silently on the first install. Fix: `npm install -g @testmuai/kane-cli-win-x64@0.10.5 @testmuai/kane-cli-node-win-x64@24.22.2 @testmuai/kane-cli-assurance-win-x64@0.10.5`.

## What the real runs found (18 to 19 Nov 2026)

**Default healing passed a bug Kane's own triage had just diagnosed.** TodoMVC, with the "Buy milk"
row hidden by CSS. Strict replay failed, and Kane's triage said: application issue, major, 0.96,
"The page says there are 3 items left but shows only 'Walk the dog' and 'Read a book'; the
expected 'Buy milk' item is missing." With healing on, Kane re-authored the check, extracted
"Buy milk, Walk the dog, Read a book" (the hidden row is still in the DOM) and passed. Happened
twice (Buy milk, Walk the dog). On the shop, a one-off 401 during cancel was masked the same way.

**A replayed "exactly three items" check passed with four rows on screen.** TodoMVC, "Read a book"
duplicated. The evidence-pack screenshot shows four rows and "3 items left"; the replayed
assertion still passed. The log does not show what it extracted, so the cause is not known.

**Triage is right sometimes and wrong sometimes.** On the hidden row it correctly said "product
bug". On a changed confirmation text it said "automation bug / locator rot" (0.96). Mutek is
the outside reference that knows which it was; the report shows each triage next to the bug.

**Leftover Kane browsers corrupt shared state.** Kane's private headless Chrome
(`kane-clean-*` profile) can outlive a run killed from outside. Three of them, up to two days old,
added an item to the shop's shared cart and broke a green baseline. `mutek doctor --kill`
stops them; `mutek run` warns about any older than two hours.

**Kane service hiccups.** `TMS did not return an org_id` and `Token refresh failed` happen before
any step runs (no browser, no credits). Twelve mutants errored in a row once. Mutek now waits
them out (15, 45, 90 s) and offers `--retry-errors`; errors are never counted.

**Write-response mutants are often equivalent.** The saboteur put several bugs in write responses
(coupon, quantity change, place order). The shop re-reads the data after every write, so the
rewritten numbers never reach the screen and the tests are right to pass. Mutek now keeps the
recorder on during mutant runs and flags a survivor whose pages never showed anything new as a
*suspected equivalent*; a person decides, and only then does it leave the score.

**The agent that writes tests also breaks its own runs.** The fresh agent that wrote the shop suite
ran curl experiments against the shared shop while its own Kane run was in progress, and its
coupon test failed for that reason (the network log shows a stray item removed and a reset).

## Credits actually spent

| Item | Credits |
|------|---------|
| First-hour checks (probe) | ~75 |
| Shop suite written and recorded by the fresh agent (incl. its reruns) | ~590 |
| First shop run, 40 mutants with 10 heal checks | ~400 |
| `mutek fix`, 8 attempts across 7 survivors | ~200 |
| TodoMVC suite recorded (6 tests) | ~440 |
| TodoMVC run, 18 mutants | ~60 |
| Measured re-run of the strengthened shop suite (50 mutants) | in progress |

A passing replay costs about 0.7 credits per test; a failing one about 5 (Kane investigates it);
a heal check 15 to 35; recording a new step about 15 to 25.

## Design decisions made while building

- **Edits re-author everything after them.** Kane re-records the edited step and every later step
  of the file. `mutek fix` therefore appends a new final assertion step instead of editing an
  existing one, so only one step costs authoring credits.
- **Masked means killed-strict, passed-with-heal.** A survivor already passed replay, so healing
  never triggers on it. The meaningful case is a mutant that strict replay catches but Kane's
  default healing re-authors around. That is what the heal check measures.
- **Heal runs can overwrite recordings.** A run that passes after a heal commits the re-authored
  steps. The runner snapshots `output-<stem>/` before every heal run and restores it after.
- **The proxy records what each test saw.** In baseline mode it injects a small recorder script
  (controls, clicks, page text). Data mutants only change values that were on screen, and
  interface mutants target controls by visible text. Live counts ("Cart 2") become one pattern.
- **Caching and CSP are stripped** by the proxy so a 304 or a content security policy never
  silently disables a mutant.
- **Reset between runs.** Every run starts from `POST /api/__reset` (configurable as a URL or a
  shell command) so results do not depend on test order.
- **Apps without a JSON API get in-page data mutants.** rendered-number-drift, rendered-item-drop
  and rendered-item-dup change what the page shows directly; unlabelled controls (icon buttons,
  checkboxes) are identified as `[tag.class]` with their row. Links to other sites are never mutated.
- **Proven fixes supersede survivors in the same run**, marked `fixed`, because appending a step
  cannot un-catch any other mutant. A full re-run of the strengthened suite then measures the
  result independently.
- **Recordings are restored after every mutant run**, not only heal runs: Kane rewrote recordings
  even during failed runs.
- **A proxy built from different code is refused.** The proxy reports a fingerprint of its code;
  a long-running proxy with an old in-page script once silently ignored a new mutant type.

## Known Kane issues steered around

- #207 `testmd run` can hang on a login page and ignore `--timeout`: no login in the demo, and the
  runner has its own kill timer (timeout + 60 s, whole process tree).
- #215, #216 API steps unreliable: not used.
- #24 use npm, not pnpm.
