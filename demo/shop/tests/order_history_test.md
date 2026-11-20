---
url: http://localhost:8080
mode: testing
max_steps: 30
tags: [shop, orders]
---

# Order history: see past orders on the My orders page

## Open My orders
Click the "My orders" link in the top navigation.
Verify the "My orders" table lists two orders: "#1002" with 2 items, total "$38.74" and status "Placed", and "#1001" with 2 items, total "$23.99" and status "Delivered".
Verify "#1002" has a "Cancel" button and "#1001" has none.

## Open a past order
Click the "#1001" order link.
Verify the page heading reads "Order #1001" with the status "Delivered", the items table shows "Notebook, Dot Grid" with quantity 2 and a line total of "$19.00", and the Total reads "$23.99".

## Check the order summary
On the "Order #1001" page, verify the summary below the items table shows Subtotal "$19.00" and Shipping "$4.99".

## Count the order's item rows
On the "Order #1001" page, count the rows under the "Item / Price / Quantity / Total" header. Verify there is exactly 1 row, the text "Notebook, Dot Grid" appears exactly once on the whole page, and the "Subtotal" line comes directly after that single row.
