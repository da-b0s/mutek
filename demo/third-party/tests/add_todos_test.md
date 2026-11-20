---
url: http://localhost:8180
mode: testing
max_steps: 30
tags: [todomvc, add]
---

# Add todos

## Add three todos
Type "Buy milk" into the "What needs to be done?" input and press Enter.
Type "Walk the dog" into the "What needs to be done?" input and press Enter.
Type "Read a book" into the "What needs to be done?" input and press Enter.

## Verify the todos and item count
Verify the todo list shows exactly three items, in order: "Buy milk", "Walk the dog", "Read a book".
Verify the footer item counter reads "3 items left".

## Verify Buy milk is the first visible row
Without adding, editing or re-entering any todo, verify the todo list currently displays exactly 3 visible rows and that the first visible row's text is exactly "Buy milk".

## Verify Walk the dog is the second visible row
Without typing anything or changing any todo, verify the second visible row of the todo list, directly below "Buy milk" and directly above "Read a book", reads exactly "Walk the dog".

## Verify Read a book is listed once and is the last row
Without typing anything or changing any todo, verify that exactly one row in the todo list reads "Read a book", that it is the last row of the list, and that the footer with "3 items left" sits directly below it with no other todo row in between.

## Verify the page heading
Without typing anything or changing any todo, verify the main page heading above the "What needs to be done?" input reads exactly "todos".
