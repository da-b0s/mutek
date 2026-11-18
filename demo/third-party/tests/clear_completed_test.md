---
url: http://localhost:8180
mode: testing
max_steps: 30
tags: [todomvc, clear-completed]
---

# Clear completed todos

## Add todos and complete one
Type "Buy milk" into the "What needs to be done?" input and press Enter.
Type "Walk the dog" into the "What needs to be done?" input and press Enter.
Click the checkbox next to the "Buy milk" todo.
Verify the "Clear completed" button is visible in the footer.

## Clear completed todos
Click the "Clear completed" button.
Verify the todo list shows only "Walk the dog" and no longer shows "Buy milk".
Verify the footer item counter reads "1 item left".
