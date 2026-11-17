# Build notes

Kane CLI version: 0.10.5 (`npm install -g @testmuai/kane-cli`), Node 24, Windows 11.

## First-hour checks

| # | Check | Status | Finding |
|---|-------|--------|---------|
| 1 | Replay cost (time, credits) | needs login | |
| 2 | A replay that should fail, fails (`--no-adaptive-heal`) | needs login | Flag exists on `testmd run` and `testrun run` in 0.10.5. |
| 3 | Replay through the proxy | needs login | Tests point at the proxy (`url: http://localhost:8080`), so the URL never changes. `--override-start-url` exists as a fallback. |
| 4 | Heal behaviour visible | needs login | Catalog has `metrics.heal.healed_tests` and `metrics.heal.reauthored_steps`. |
| 5 | Policy: "at least one test failed" | **confirmed** | `kane-cli evidence lint-policy` accepts `metric: totals.failed, min: 1` (both Tripwire policies lint ok, no login needed). |
| 6 | Batch runs | not needed | Baseline runs one file at a time so the proxy can attribute traffic to each test. |
| 7 | Evidence pack contents | from docs | Pack is a zip: `tests/<id>/steps/<n>-<id>/screenshot.png`, `logs/<n>-network.har`. The report reads screenshots from it. |

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
