---
test: ../probe_test.md
status: passed
started: 2026-11-17T09:51:59.045Z
duration_s: 102
session_id: 4e548477-8582-4bda-801d-9afb4ce4b2d1
---

# First-hour probe: does replay re-check what it asserts? — Result

## Open the shop ✓ passed (22s)
md5: 28440cdf26a2e82184e44e2da59ba835
Open http://localhost:8080 and verify the page heading "Shop" is visible.

## Open the cart ✓ passed (32.3s)
md5: 1be0d516ed8b3ec1dd3a083f4ec40c16
Click the "Cart" link in the header. Verify the page heading reads "Your cart".

## Empty cart message ✓ passed (18.7s)
md5: a816c2df3c6376eda8112c2b900138ef
Verify the text "Your cart is empty." is shown on the page.
