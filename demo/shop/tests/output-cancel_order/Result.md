---
test: ../cancel_order_test.md
status: passed
started: 2026-11-17T14:11:15.070Z
duration_s: 103
session_id: 05b59958-9789-4707-bd92-8c7d60084c6f
---

# Cancel order: cancel the order that is still "Placed" — Result

## Open My orders ✓ passed (49.4s)
md5: c6bf335275b69a188b9eb5ab26456462
Click the "My orders" link in the top navigation.
Verify order "#1002" has status "Placed" with a "Cancel" button, and order "#1001" has status "Delivered".

## Cancel the placed order ✓ passed (42.1s)
md5: 16122dfa55dc830de4649b9bf40ad9c3
Click the "Cancel" button on the "#1002" row, then in the "Cancel order #1002?" dialog click "Yes, cancel order".
Verify the "#1002" row now shows status "Cancelled" and no longer has a "Cancel" button, and "#1001" still shows status "Delivered".
