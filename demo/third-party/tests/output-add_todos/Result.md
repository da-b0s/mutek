---
test: ../add_todos_test.md
status: passed
started: 2026-11-19T22:20:56.298Z
duration_s: 81
session_id: 631bc2f7-5985-4b6a-ba41-21ec49dd0d85
---

# Add todos — Result

## Add three todos ✓ passed (5.02s)
md5: 82a7e175e50b91d6234f30feb3225d0d
Type "Buy milk" into the "What needs to be done?" input and press Enter.
Type "Walk the dog" into the "What needs to be done?" input and press Enter.
Type "Read a book" into the "What needs to be done?" input and press Enter.

## Verify the todos and item count ✓ passed (1.25s)
md5: 46a2ac8367c51c48635bb5cd69d22ae1
Verify the todo list shows exactly three items, in order: "Buy milk", "Walk the dog", "Read a book".
Verify the footer item counter reads "3 items left".

## Verify Buy milk is the first visible row ✓ passed (1.02s)
md5: d7b62ca49f18924c4b5b2fc06b1099ef
Without adding, editing or re-entering any todo, verify the todo list currently displays exactly 3 visible rows and that the first visible row's text is exactly "Buy milk".

## Verify Walk the dog is the second visible row ✓ passed (0.86s)
md5: 1a4398b075bf2f2cfc8046b56dd45553
Without typing anything or changing any todo, verify the second visible row of the todo list, directly below "Buy milk" and directly above "Read a book", reads exactly "Walk the dog".

## Verify Read a book is listed once and is the last row ✓ passed (60.2s)
md5: dc7b3cb0644fb5565e4dcbc72d22a9c1
Without typing anything or changing any todo, verify that exactly one row in the todo list reads "Read a book", that it is the last row of the list, and that the footer with "3 items left" sits directly below it with no other todo row in between.
