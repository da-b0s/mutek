# Assertion patterns that caught real bugs in this repo

- The displayed price is checked against the expected value (caught: number-drift; I appended one step that goes back to the shop list and checks that the "Canvas Tote Bag" card shows "$18.00". The broken app would show "$19.80" there. I haven)
- The test checks exactly which records are listed (caught: wrong-owner; I added a final step to `tests/cancel_order_test.md` that checks the My orders table shows exactly 2 orders, "#1002" and "#1001", with no other rows such as "#9)
- The test checks that "Keep order" is offered (caught: hide-control; `npx tripwire check` exiting 0 confirms it's done. If a `tripwire fix` run is still waiting on my earlier reply, let it finish first.)
- The test checks the outcome of the button it pressed (caught: label-swap; I added a step checking the "Wool Beanie" row shows "−" left of the quantity and "+" to its right.)
- The list length or a named item is checked (caught: item-drop; Alternatively, allow `npx tripwire` in the project's permissions and start me again.)
- The list length or a named item is checked (caught: item-drop; I added a final step to `tests/checkout_test.md` that clicks "View order" and checks that the "Order #1003" page lists exactly one item row: "Canvas Tote Bag", )
