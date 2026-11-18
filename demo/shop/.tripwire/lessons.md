# Assertion patterns that caught real bugs in this repo

- The displayed price is checked against the expected value (caught: number-drift; I appended one step that goes back to the shop list and checks that the "Canvas Tote Bag" card shows "$18.00". The broken app would show "$19.80" there. I haven)
- The test checks exactly which records are listed (caught: wrong-owner; I added a final step to `tests/cancel_order_test.md` that checks the My orders table shows exactly 2 orders, "#1002" and "#1001", with no other rows such as "#9)
