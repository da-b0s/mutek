---
test: ../coupon_test.md
status: passed
started: 2026-11-20T02:00:14.173Z
duration_s: 72
session_id: 289c44e2-035e-493c-991a-2b2114d21a27
---

# Coupon: apply SAVE10 in the cart — Result

## Put an item in the cart ✓ passed (19.14s)
md5: b8af8a9b6d4169ba9b448b88868cab93
On the Shop page, click the "Add to cart" button on the "Ceramic Pour-Over Set" card, then click the "Cart" link in the top navigation.
Verify the cart shows "Ceramic Pour-Over Set" with quantity 1, the Subtotal reads "$34.50" and there is no Discount line.

## Apply the SAVE10 coupon ✓ passed (3.73s)
md5: f1a9e4184f2c35cae829e88bad18fb7f
Type "SAVE10" into the "Coupon code" field and click "Apply coupon".
Verify the Coupon panel reads "Applied: SAVE10 (10% off your order)", the Discount line shows "−$3.45", the Subtotal still reads "$34.50", Shipping reads "$4.99" and the Total reads "$36.04".

## Remove the coupon ✓ passed (38.8s)
md5: 989159c906669a217a9549b4f672f1f7
In the Coupon panel, click the "Remove coupon" button.
Verify the Coupon panel no longer reads "Applied: SAVE10", the "Coupon code" field is shown again, there is no Discount line and the Total reads "$39.49".
