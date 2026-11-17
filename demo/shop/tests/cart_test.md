---
url: http://localhost:8080
mode: testing
max_steps: 30
tags: [shop, cart]
---

# Cart: add an item and change its quantity

## Add an item to the cart
On the Shop page, click the "Add to cart" button on the "Wool Beanie" card.
Verify the cart count badge in the top navigation shows "1".

## Open the cart
Click the "Cart" link in the top navigation.
Verify the "Your cart" table has one row, "Wool Beanie", with quantity 1 and a line total of "$22.00".

## Increase the quantity
Click the "+" (increase quantity) button on the "Wool Beanie" row.
Verify the "Wool Beanie" row now shows quantity 2 and a line total of "$44.00", and the Subtotal reads "$44.00".

## Decrease the quantity
Click the "−" (decrease quantity) button on the "Wool Beanie" row.
Verify the "Wool Beanie" row shows quantity 1 again and the Subtotal reads "$22.00".
