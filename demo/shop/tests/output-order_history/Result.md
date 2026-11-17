---
test: ../order_history_test.md
status: passed
started: 2026-11-17T14:08:50.151Z
duration_s: 107
session_id: 7a4b3037-4b56-430d-a831-4c528351da4c
---

# Order history: see past orders on the My orders page — Result

## Open My orders ✓ passed (47.5s)
md5: e3e6443a65d0f3c4aaba5740134ae2f4
Click the "My orders" link in the top navigation.
Verify the "My orders" table lists two orders: "#1002" with 2 items, total "$38.74" and status "Placed", and "#1001" with 2 items, total "$23.99" and status "Delivered".
Verify "#1002" has a "Cancel" button and "#1001" has none.

## Open a past order ✓ passed (48.5s)
md5: 81f43d0f4c8d89c1705a777ac949b41b
Click the "#1001" order link.
Verify the page heading reads "Order #1001" with the status "Delivered", the items table shows "Notebook, Dot Grid" with quantity 2 and a line total of "$19.00", and the Total reads "$23.99".
