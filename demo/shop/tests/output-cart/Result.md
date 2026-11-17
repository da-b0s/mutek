---
test: ../cart_test.md
status: passed
started: 2026-11-17T13:55:57.772Z
duration_s: 161
session_id: f48d4596-5332-4ee4-8489-dd70193b529e
---

# Cart: add an item and change its quantity — Result

## Add an item to the cart ✓ passed (39.2s)
md5: 90111cdf68d47e4f9a4c3e1ec947a380
On the Shop page, click the "Add to cart" button on the "Wool Beanie" card.
Verify the cart count badge in the top navigation shows "1".

## Open the cart ✓ passed (47.1s)
md5: c455ced1e7779d8d1376e29ebd9e0815
Click the "Cart" link in the top navigation.
Verify the "Your cart" table has one row, "Wool Beanie", with quantity 1 and a line total of "$22.00".

## Increase the quantity ✓ passed (31.4s)
md5: 9d76d7074f62725fbde8a0ecdf5f21a8
Click the "+" (increase quantity) button on the "Wool Beanie" row.
Verify the "Wool Beanie" row now shows quantity 2 and a line total of "$44.00", and the Subtotal reads "$44.00".

## Decrease the quantity ✓ passed (31.2s)
md5: 736c358dc658882bff2a3d5355b0f164
Click the "−" (decrease quantity) button on the "Wool Beanie" row.
Verify the "Wool Beanie" row shows quantity 1 again and the Subtotal reads "$22.00".
