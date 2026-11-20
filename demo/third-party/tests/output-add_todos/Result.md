---
test: ../add_todos_test.md
status: passed
started: 2026-11-20T01:50:29.893Z
duration_s: 40
session_id: c13e82f8-8790-4466-a3cc-3e42080bc82d
---

# Add todos — Result

## Add three todos ✓ passed (4.58s)
md5: 82a7e175e50b91d6234f30feb3225d0d
Type "Buy milk" into the "What needs to be done?" input and press Enter.
Type "Walk the dog" into the "What needs to be done?" input and press Enter.
Type "Read a book" into the "What needs to be done?" input and press Enter.

## Verify the todos and item count ✓ passed (1.55s)
md5: 46a2ac8367c51c48635bb5cd69d22ae1
Verify the todo list shows exactly three items, in order: "Buy milk", "Walk the dog", "Read a book".
Verify the footer item counter reads "3 items left".

## Verify Buy milk is the first visible row ✓ passed (1.42s)
md5: d7b62ca49f18924c4b5b2fc06b1099ef
Without adding, editing or re-entering any todo, verify the todo list currently displays exactly 3 visible rows and that the first visible row's text is exactly "Buy milk".

## Verify Walk the dog is the second visible row ✓ passed (1.14s)
md5: 1a4398b075bf2f2cfc8046b56dd45553
Without typing anything or changing any todo, verify the second visible row of the todo list, directly below "Buy milk" and directly above "Read a book", reads exactly "Walk the dog".

## Verify Read a book is listed once and is the last row ✓ passed (1.33s)
md5: dc7b3cb0644fb5565e4dcbc72d22a9c1
Without typing anything or changing any todo, verify that exactly one row in the todo list reads "Read a book", that it is the last row of the list, and that the footer with "3 items left" sits directly below it with no other todo row in between.

## Verify the page heading ✓ passed (19.9s)
md5: fdd08e7f67e81be7c01c1ca322843781
Without typing anything or changing any todo, verify the main page heading above the "What needs to be done?" input reads exactly "todos".
