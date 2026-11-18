---
test: ../cancel_order_test.md
status: passed
started: 2026-11-18T05:11:57.302Z
duration_s: 49
session_id: fe400583-bd98-4ceb-96a8-aa034658e542
---

# Cancel order: cancel the order that is still "Placed" — Result

## Open My orders ✓ passed (7.61s)
md5: c6bf335275b69a188b9eb5ab26456462
Click the "My orders" link in the top navigation.
Verify order "#1002" has status "Placed" with a "Cancel" button, and order "#1001" has status "Delivered".

## Cancel the placed order ✓ passed (2.7s)
md5: 16122dfa55dc830de4649b9bf40ad9c3
Click the "Cancel" button on the "#1002" row, then in the "Cancel order #1002?" dialog click "Yes, cancel order".
Verify the "#1002" row now shows status "Cancelled" and no longer has a "Cancel" button, and "#1001" still shows status "Delivered".

## Check only my orders are listed ✓ passed (28.5s)
md5: acc4c672545c13880fb42463dae6fcfd
Verify the My orders table lists exactly 2 orders, "#1002" and "#1001", and no other order rows (for example, no "#91002").
