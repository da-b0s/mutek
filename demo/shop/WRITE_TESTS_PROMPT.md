# Prompt used to create the first-draft suite

The first-draft suite was written by a separate, fresh Claude Code session (`claude -p`, with the
official kane-cli skill installed via `kane-cli install skill`). It ran in a clean copy of this
app (`server.js`, `public/`, a neutral `package.json`) outside this repository, so it could not
see Tripwire, its config, or this file. The prompt does not mention Tripwire, mutation testing or
test strength, so the suite is the honest first draft an agent writes by default. The tests and
their recordings were then copied into `tests/` unchanged. The session transcript is in
`agent-session.jsonl`.

Allowed tools: Read, Write, Edit, Glob, Grep, and Bash limited to `kane-cli`, `curl` and `ls`.

Outcome: six tests, written in about 22 minutes, ~520 Kane credits (including the agent's own
reruns). Five passed. `coupon_test.md` failed during recording because the agent was running curl
experiments against the same shop (adding an item, resetting the data) while its Kane run was in
progress; the run's network log shows a stray item removed and the cart emptied from outside the
browser. The agent reported it as an app bug and left the test unchanged rather than weakening it.
The test text was not edited: it was re-recorded once with `kane-cli testmd run --author` from a
freshly reset shop, and passed. The transcript has the MCP and plugin list from its start-up header
and Test Manager share links removed; nothing else is changed.

The exact prompt, everything below the line:

---
You are working in this folder, a small web shop called Fieldnote Goods. It is already
running (`npm start`, port 3000). For end-to-end tests the app is reached through
`http://localhost:8080`, so every test's frontmatter must use `url: http://localhost:8080`.
Before running each test, reset the shop's data with `curl -s -X POST http://localhost:3000/api/__reset`
so every test starts from the same state.

Write a Kane CLI end-to-end suite for it in `tests/` using `_test.md` files,
following the kane-cli skill. Cover these user journeys, one test file each:

1. browse: the shop lists products and a product page can be opened
2. cart: add an item to the cart and change its quantity
3. coupon: apply the coupon code SAVE10 in the cart
4. checkout: check out with a name, email and delivery address
5. order_history: see past orders on the My orders page
6. cancel_order: cancel the order that is still in "Placed" status

Do not add a login step; there is no login. Run each test once with
`kane-cli testmd run <file> --agent` so it is recorded, and make sure all of them pass.
