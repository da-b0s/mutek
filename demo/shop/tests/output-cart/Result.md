---
test: ../cart_test.md
status: passed
started: 2026-11-18T13:22:45.547Z
duration_s: 56
session_id: 4af6470f-113b-4eb9-9b7a-8d52d2951ed8
---

# Cart: add an item and change its quantity — Result

## Add an item to the cart ✓ passed (2.75s)
md5: 90111cdf68d47e4f9a4c3e1ec947a380
On the Shop page, click the "Add to cart" button on the "Wool Beanie" card.
Verify the cart count badge in the top navigation shows "1".

## Open the cart ✓ passed (9.36s)
md5: c455ced1e7779d8d1376e29ebd9e0815
Click the "Cart" link in the top navigation.
Verify the "Your cart" table has one row, "Wool Beanie", with quantity 1 and a line total of "$22.00".

## Increase the quantity ✓ passed (2.09s)
md5: 9d76d7074f62725fbde8a0ecdf5f21a8
Click the "+" (increase quantity) button on the "Wool Beanie" row.
Verify the "Wool Beanie" row now shows quantity 2 and a line total of "$44.00", and the Subtotal reads "$44.00".

## Decrease the quantity ✓ passed (1.88s)
md5: 736c358dc658882bff2a3d5355b0f164
Click the "−" (decrease quantity) button on the "Wool Beanie" row.
Verify the "Wool Beanie" row shows quantity 1 again and the Subtotal reads "$22.00".

## Check the quantity button labels ✓ passed (27.3s)
md5: 30309a495b1838ac3822c4d0a83ae09c
On the "Wool Beanie" row, verify the button immediately to the left of the quantity shows the text "−" and the button immediately to the right of the quantity shows the text "+".
