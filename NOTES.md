# Build notes

Kane CLI version: 0.10.5 (`npm install -g @testmuai/kane-cli`), Node 24, Windows 11.

## First-hour checks (run 17 Nov 2026 on `demo/probe/probe_test.md`, 3 steps)

| # | Check | Result | Finding |
|---|-------|--------|---------|
| 1 | Replay cost | **measured** | First run (authoring): 131 s, ~51 credits. Replay: 39 s, ~2 credits. Replay is not free: each "analyze" check is re-evaluated live (~0.7 credits each). A replay that fails costs ~5 credits and ~130 s because Kane triages the failure. |
| 2 | A replay that should fail, fails | **yes** | Changing the asserted "Your cart is empty." text: exit 1 at the asserting step, mutant fired. Replay re-checks asserted values; it does not skip them. |
| 3 | Replay through the proxy | **yes** | Recorded and replayed at `http://localhost:8080`; no URL override needed. |
| 4 | Heal behaviour | **visible** | NDJSON has `test_md_adaptive_heal` (shrink count, re-author boundary). Hiding the clicked Cart link: healing re-authored the step, still failed (not masked). Cost ~15 credits, 225 s. **A heal run rewrites `output-<stem>/` even when it fails**, so Tripwire restores the recording after every mutant run. |
| 5 | Inverted policy | **works, with a fix** | A failed replay assertion was recorded in the pack as `broken` (not `failed`) because Kane's triage called it an automation bug (`locator_rot`). The mutant policy uses `expr: totals.failed + totals.broken >= 1`; the clean policy also requires `totals.broken == 0`. Verified on real packs both ways. |
| 6 | Batch runs | not needed | Baseline runs one file at a time so the proxy can attribute traffic to each test. |
| 7 | Evidence pack contents | **confirmed** | Zip with `run.yaml`, `tests/<id>/result.yaml`, per-step screenshots, HAR and console logs. `result.yaml` contains the account email: never commit raw packs; publish screenshots, verdicts and the report instead. Recordings (`output-*/.internal`) hold only numeric account ids. |

Other observations:
- Kane triages every failed replay (`test_md_bug_verdict`). For mutants it said "automation bug / locator rot" with 0.96 to 0.98 confidence: from inside one run, a broken app and an outdated test look the same. Tripwire knows which it was. The report shows Kane's triage next to the planted bug.
- One run ended with exit 2, `TMS did not return an org_id` (transient, on a flaky connection). The runner retries exit 2 and 3 once and never counts them as kills.
- Kane's optional Windows packages (~100 MB) failed to download silently on the first install. Fix: `npm install -g @testmuai/kane-cli-win-x64@0.10.5 @testmuai/kane-cli-node-win-x64@24.22.2 @testmuai/kane-cli-assurance-win-x64@0.10.5`.

## Credit budget (from the measurements)

| Item | Estimate |
|------|----------|
| Author the demo suite (6 tests, ~4 steps) | ~400 |
| Baseline replay | ~15 |
| 40 mutants (~2 touching tests, ~3 credits each) | ~250 |
| Heal checks (5 × ~15) | ~75 |
| `tripwire fix` (~8 survivors × ~1.5 attempts × ~25) | ~300 |
| Third-party app suite + run | ~300 |
| **Total** | **~1,350** (balance after checks: 1,127) |

## Design decisions made while building

- **Edits re-author everything after them.** Kane re-records the edited step and every later step
  of the file. `tripwire fix` therefore appends a new final assertion step instead of editing an
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

## Known Kane issues steered around

- #207 `testmd run` can hang on a login page and ignore `--timeout`: no login in the demo, and the
  runner has its own kill timer (timeout + 60 s, whole process tree).
- #215, #216 API steps unreliable: not used.
- #24 use npm, not pnpm.
