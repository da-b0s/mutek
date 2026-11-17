# Prompt used to create the first-draft suite

This is the exact prompt given to a fresh coding-agent session (Claude Code, with the official
kane-cli skill installed via `kane-cli install skill`). It does not mention Tripwire, mutation
testing or test strength, so the suite is the honest first draft an agent writes by default.
The resulting tests are committed unchanged as the baseline.

---

You are working in `demo/shop`, a small web shop called Fieldnote Goods. It is already
running (`npm start`, port 3000). For end-to-end tests the app is reached through
`http://localhost:8080`, so every test's frontmatter must use `url: http://localhost:8080`.
Before running each test, reset the shop's data with `curl -s -X POST http://localhost:3000/api/__reset`
so every test starts from the same state.

Write a Kane CLI end-to-end suite for it in `demo/shop/tests/` using `_test.md` files,
following the kane-cli skill. Cover these user journeys, one test file each:

1. browse: the shop lists products and a product page can be opened
2. cart: add an item to the cart and change its quantity
3. coupon: apply the coupon code SAVE10 in the cart
4. checkout: check out with a name, email and delivery address
5. order_history: see past orders on the My orders page
6. cancel_order: cancel the order that is still in "Placed" status

Do not add a login step; there is no login. Run each test once with
`kane-cli testmd run <file> --agent` so it is recorded, and make sure all of them pass.
