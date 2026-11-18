# Fieldnote Goods: acceptance criteria

A small web shop. One signed-in customer (Sam Rivera); no login step.

## Catalogue
- AC1. The shop page lists every product with its name, category, price and stock state.
- AC2. A product that is out of stock is marked "Out of stock" and cannot be added to the cart.
- AC3. A product page shows the name, price, description and how many are in stock.

## Cart
- AC4. Adding a product puts it in the cart with quantity 1, or raises its quantity by 1 if it is already there.
- AC5. A quantity is between 1 and 10 and never more than the stock; going below 1 removes the line.
- AC6. Each line total is price × quantity; the subtotal is the sum of the line totals.
- AC7. The header badge shows the number of items in the cart.
- AC8. Removing a line takes it out of the cart and the totals update at once.

## Coupons
- AC9. SAVE10 takes 10% off the subtotal.
- AC10. WELCOME5 takes $5 off, and only when the subtotal is at least $20.
- AC11. Only one coupon applies at a time; applying a new one replaces the old one.
- AC12. An unknown code is refused with a message and changes nothing.

## Shipping and totals
- AC13. Shipping is free when the subtotal after discount is $50 or more; otherwise it is $4.99.
- AC14. Total = subtotal − discount + shipping, shown to the cent.

## Checkout
- AC15. Checkout needs a full name, a valid email address and a delivery address; each missing or invalid field shows its own message.
- AC16. Placing an order empties the cart, reduces stock, and shows a confirmation with the order number and the total charged.
- AC17. Checkout with an empty cart is not possible.

## Orders
- AC18. "My orders" lists only the signed-in customer's orders, newest first, with date, item count, total and status.
- AC19. An order with status "Placed" can be cancelled after a confirmation; the status becomes "Cancelled" and the stock is returned.
- AC20. Delivered or already cancelled orders cannot be cancelled.
- AC21. An order page shows its items, subtotal, discount, shipping and total.
