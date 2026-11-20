---
url: http://localhost:8080
mode: testing
max_steps: 30
tags: [shop, coupon]
---

# Coupon: apply SAVE10 in the cart

## Put an item in the cart
On the Shop page, click the "Add to cart" button on the "Ceramic Pour-Over Set" card, then click the "Cart" link in the top navigation.
Verify the cart shows "Ceramic Pour-Over Set" with quantity 1, the Subtotal reads "$34.50" and there is no Discount line.

## Apply the SAVE10 coupon
Type "SAVE10" into the "Coupon code" field and click "Apply coupon".
Verify the Coupon panel reads "Applied: SAVE10 (10% off your order)", the Discount line shows "−$3.45", the Subtotal still reads "$34.50", Shipping reads "$4.99" and the Total reads "$36.04".

## Remove the coupon
In the Coupon panel, click the "Remove coupon" button.
Verify the Coupon panel no longer reads "Applied: SAVE10", the "Coupon code" field is shown again, there is no Discount line and the Total reads "$39.49".
