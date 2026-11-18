---
test: ../browse_test.md
status: passed
started: 2026-11-18T05:09:08.904Z
duration_s: 56
session_id: be0e9d30-44e2-4b86-9591-97bb58a10f6d
---

# Browse: the shop lists products and a product page opens — Result

## Check the product list ✓ passed (3.12s)
md5: 6acd3bae0e5e925bd2853eb64a7e2a09
Verify the page heading is "Shop" and the product grid shows these 6 products: "Canvas Tote Bag", "Ceramic Pour-Over Set", "Wool Beanie", "Desk Plant (Pothos)", "Notebook, Dot Grid" and "Insulated Bottle".
Verify "Insulated Bottle" is marked "Out of stock" and its "Add to cart" button is disabled.

## Open a product page ✓ passed (8.27s)
md5: 2bf47b3175cfca392441ce412067131e
Click the "Ceramic Pour-Over Set" product name.
Verify the product page heading is "Ceramic Pour-Over Set", the price shown is "$34.50", the description reads "Dripper, carafe and 40 paper filters." and the stock line reads "5 in stock".

## Check a price in the product list ✓ passed (34.2s)
md5: 8b7999260f1933c17a05f155ada830be
Click "← Back to shop" to return to the product list.
Verify the "Canvas Tote Bag" card in the product grid shows the price "$18.00".
