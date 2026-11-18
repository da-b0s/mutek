---
url: http://localhost:8080
mode: testing
max_steps: 30
tags: [shop, browse]
---

# Browse: the shop lists products and a product page opens

## Check the product list
Verify the page heading is "Shop" and the product grid shows these 6 products: "Canvas Tote Bag", "Ceramic Pour-Over Set", "Wool Beanie", "Desk Plant (Pothos)", "Notebook, Dot Grid" and "Insulated Bottle".
Verify "Insulated Bottle" is marked "Out of stock" and its "Add to cart" button is disabled.

## Open a product page
Click the "Ceramic Pour-Over Set" product name.
Verify the product page heading is "Ceramic Pour-Over Set", the price shown is "$34.50", the description reads "Dripper, carafe and 40 paper filters." and the stock line reads "5 in stock".

## Check a price in the product list
Click "← Back to shop" to return to the product list.
Verify the "Canvas Tote Bag" card in the product grid shows the price "$18.00".
