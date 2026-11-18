---
test: ../cancel_order_test.md
status: passed
started: 2026-11-18T05:00:03.273Z
duration_s: 99
session_id: b18194d9-5fa7-4842-aa39-4a7a1e3b8817
---

# Cancel order: cancel the order that is still "Placed" — Result

## Open My orders ✓ passed (45.8s)
md5: c6bf335275b69a188b9eb5ab26456462
Click the "My orders" link in the top navigation.
Verify order "#1002" has status "Placed" with a "Cancel" button, and order "#1001" has status "Delivered".

## Cancel the placed order ✓ passed (41.3s)
md5: 16122dfa55dc830de4649b9bf40ad9c3
Click the "Cancel" button on the "#1002" row, then in the "Cancel order #1002?" dialog click "Yes, cancel order".
Verify the "#1002" row now shows status "Cancelled" and no longer has a "Cancel" button, and "#1001" still shows status "Delivered".
