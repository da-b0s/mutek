---
test: ../coupon_test.md
status: passed
started: 2026-11-17T14:18:46.399Z
duration_s: 120
session_id: 4005cd21-edaa-4e26-b1e6-4698596edce0
---

# Coupon: apply SAVE10 in the cart — Result

## Put an item in the cart ✓ passed (60.3s)
md5: b8af8a9b6d4169ba9b448b88868cab93
On the Shop page, click the "Add to cart" button on the "Ceramic Pour-Over Set" card, then click the "Cart" link in the top navigation.
Verify the cart shows "Ceramic Pour-Over Set" with quantity 1, the Subtotal reads "$34.50" and there is no Discount line.

## Apply the SAVE10 coupon ✓ passed (48.3s)
md5: f1a9e4184f2c35cae829e88bad18fb7f
Type "SAVE10" into the "Coupon code" field and click "Apply coupon".
Verify the Coupon panel reads "Applied: SAVE10 (10% off your order)", the Discount line shows "−$3.45", the Subtotal still reads "$34.50", Shipping reads "$4.99" and the Total reads "$36.04".
