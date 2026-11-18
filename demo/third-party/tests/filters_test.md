---
url: http://localhost:8180
mode: testing
max_steps: 40
tags: [todomvc, filters]
---

# Filter todos

## Add todos and complete one
Type "Buy milk" into the "What needs to be done?" input and press Enter.
Type "Walk the dog" into the "What needs to be done?" input and press Enter.
Click the checkbox next to the "Buy milk" todo.
Verify the footer item counter reads "1 item left".

## Use the Active filter
Click the "Active" filter link in the footer.
Verify the todo list shows only "Walk the dog" and does not show "Buy milk".

## Use the Completed filter
Click the "Completed" filter link in the footer.
Verify the todo list shows only "Buy milk" and does not show "Walk the dog".

## Use the All filter
Click the "All" filter link in the footer.
Verify the todo list shows both "Buy milk" and "Walk the dog".
