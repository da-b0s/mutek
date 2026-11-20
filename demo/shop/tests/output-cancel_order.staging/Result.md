---
test: ../cancel_order_test.md
status: passed
started: 2026-11-20T01:14:44.449Z
duration_s: 234
session_id: 8a3bda8a-f12b-4b1d-9420-f176a651c309
---

# Cancel order: cancel the order that is still "Placed" — Result

## Open My orders ✓ passed (40.1s)
md5: c6bf335275b69a188b9eb5ab26456462
Click the "My orders" link in the top navigation.
Verify order "#1002" has status "Placed" with a "Cancel" button, and order "#1001" has status "Delivered".

## Cancel the placed order ✓ passed (40.5s)
md5: 16122dfa55dc830de4649b9bf40ad9c3
Click the "Cancel" button on the "#1002" row, then in the "Cancel order #1002?" dialog click "Yes, cancel order".
Verify the "#1002" row now shows status "Cancelled" and no longer has a "Cancel" button, and "#1001" still shows status "Delivered".

## Check only my orders are listed ✓ passed (26s)
md5: acc4c672545c13880fb42463dae6fcfd
Verify the My orders table lists exactly 2 orders, "#1002" and "#1001", and no other order rows (for example, no "#91002").

## Keep an order from the cancel dialog ✓ passed (112.4s)
md5: 75c1d0f88b6924c72e8280c71555c2d2
Add the "Canvas Tote Bag" to the cart from the Shop, go to checkout, fill in Full name "Ada Lovelace", Email "ada@example.com" and Delivery address "12 Analytical Row, London", click "Place order", click "View order", then click "Cancel order".
Verify the cancel dialog offers a "Keep order" button next to "Yes, cancel order", click "Keep order", and verify the order still shows status "Placed".
