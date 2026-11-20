---
test: ../order_history_test.md
status: passed
started: 2026-11-20T02:10:19.950Z
duration_s: 66
session_id: 0c44417a-b01a-4c5e-95a9-2464f1f8dcaa
---

# Order history: see past orders on the My orders page — Result

## Open My orders ✓ passed (8.83s)
md5: e3e6443a65d0f3c4aaba5740134ae2f4
Click the "My orders" link in the top navigation.
Verify the "My orders" table lists two orders: "#1002" with 2 items, total "$38.74" and status "Placed", and "#1001" with 2 items, total "$23.99" and status "Delivered".
Verify "#1002" has a "Cancel" button and "#1001" has none.

## Open a past order ✓ passed (7.77s)
md5: 81f43d0f4c8d89c1705a777ac949b41b
Click the "#1001" order link.
Verify the page heading reads "Order #1001" with the status "Delivered", the items table shows "Notebook, Dot Grid" with quantity 2 and a line total of "$19.00", and the Total reads "$23.99".

## Check the order summary ✓ passed (0.98s)
md5: 8c0a85780e47bc3b9a97b2335b472f1c
On the "Order #1001" page, verify the summary below the items table shows Subtotal "$19.00" and Shipping "$4.99".

## Count the order's item rows ✓ passed (38.5s)
md5: 7f5fe52fbbeba8c7d7103a1d44eee6e4
On the "Order #1001" page, count the rows under the "Item / Price / Quantity / Total" header. Verify there is exactly 1 row, the text "Notebook, Dot Grid" appears exactly once on the whole page, and the "Subtotal" line comes directly after that single row.
