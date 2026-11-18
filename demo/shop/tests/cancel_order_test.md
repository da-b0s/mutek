---
url: http://localhost:8080
mode: testing
max_steps: 30
tags: [shop, orders, cancel]
---

# Cancel order: cancel the order that is still "Placed"

## Open My orders
Click the "My orders" link in the top navigation.
Verify order "#1002" has status "Placed" with a "Cancel" button, and order "#1001" has status "Delivered".

## Cancel the placed order
Click the "Cancel" button on the "#1002" row, then in the "Cancel order #1002?" dialog click "Yes, cancel order".
Verify the "#1002" row now shows status "Cancelled" and no longer has a "Cancel" button, and "#1001" still shows status "Delivered".

## Check only my orders are listed
Verify the My orders table lists exactly 2 orders, "#1002" and "#1001", and no other order rows (for example, no "#91002").
