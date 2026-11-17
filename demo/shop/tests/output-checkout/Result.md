---
test: ../checkout_test.md
status: passed
started: 2026-11-17T14:04:55.537Z
duration_s: 193
session_id: 4f697bbf-519e-4675-ac74-6ee649cc5ad0
---

# Checkout: place an order with name, email and delivery address — Result

## Put an item in the cart ✓ passed (62s)
md5: bd9a9001aeb39da69dbcf1931324a43d
On the Shop page, click the "Add to cart" button on the "Canvas Tote Bag" card, then click the "Cart" link in the top navigation.
Verify the cart shows "Canvas Tote Bag" with quantity 1 and the Total reads "$22.99".

## Go to checkout ✓ passed (47.5s)
md5: d10797604bf8b54fa5ac211cc47fdb38
Click "Go to checkout".
Verify the "Checkout" page shows an order summary with "1 × Canvas Tote Bag" and a Total of "$22.99".

## Fill in the details and place the order ✓ passed (71.3s)
md5: e0045912451869aa533e7043e6e665b8
Type "Ada Obi" into the "Full name" field, "ada@example.com" into the "Email" field and "7 Marina Street, Lagos" into the "Delivery address" field, then click "Place order".
Verify the confirmation page shows the heading "Thank you, Ada!", the text "Your order #1003 has been placed.", "Total charged: $22.99" and "We will email a receipt to ada@example.com."
