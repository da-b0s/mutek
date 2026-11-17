---
url: http://localhost:8080
mode: testing
max_steps: 30
tags: [shop, checkout]
---

# Checkout: place an order with name, email and delivery address

## Put an item in the cart
On the Shop page, click the "Add to cart" button on the "Canvas Tote Bag" card, then click the "Cart" link in the top navigation.
Verify the cart shows "Canvas Tote Bag" with quantity 1 and the Total reads "$22.99".

## Go to checkout
Click "Go to checkout".
Verify the "Checkout" page shows an order summary with "1 × Canvas Tote Bag" and a Total of "$22.99".

## Fill in the details and place the order
Type "Ada Obi" into the "Full name" field, "ada@example.com" into the "Email" field and "7 Marina Street, Lagos" into the "Delivery address" field, then click "Place order".
Verify the confirmation page shows the heading "Thank you, Ada!", the text "Your order #1003 has been placed.", "Total charged: $22.99" and "We will email a receipt to ada@example.com."
