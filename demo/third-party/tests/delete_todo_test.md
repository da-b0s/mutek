---
url: http://localhost:8180
mode: testing
max_steps: 30
tags: [todomvc, delete]
---

# Delete a todo

## Add two todos
Type "Buy milk" into the "What needs to be done?" input and press Enter.
Type "Walk the dog" into the "What needs to be done?" input and press Enter.
Verify the footer item counter reads "2 items left".

## Delete a todo
Hover over the "Buy milk" todo and click its delete (×) button.
Verify the todo list shows only "Walk the dog" and no longer shows "Buy milk".
Verify the footer item counter reads "1 item left".
