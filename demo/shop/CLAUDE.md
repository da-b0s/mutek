# Tests must catch bugs, not just pass

This project checks its Kane CLI end-to-end tests with [Tripwire](https://github.com/da-b0s/tripwire).
A passing test only counts if it would fail when the app is broken.

When you write or change any `*_test.md` file:

1. Run `npx tripwire run --since HEAD`. It breaks the app one realistic way at a time through a
   proxy (wrong totals, failed saves reported as success, missing buttons) and replays the suite.
2. If the score is below the threshold in `tripwire.config.json` (default 80%), run
   `npx tripwire fix`. Each surviving bug is given to you to add one assertion, and Kane proves the
   new assertion passes on the real app and fails on the broken one.
3. The task is not complete while `npx tripwire check` exits non-zero.

When you write new tests, read `.tripwire/lessons.md` first: it lists assertion patterns that
caught real bugs in this repo.

Never weaken, delete or reorder existing test steps to raise the score, and never change
application code to make a mutant disappear.
