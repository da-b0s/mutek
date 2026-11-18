---
url: http://localhost:8180
mode: testing
max_steps: 30
tags: [todomvc, complete]
---

# Complete a todo

## Add two todos
Type "Buy milk" into the "What needs to be done?" input and press Enter.
Type "Walk the dog" into the "What needs to be done?" input and press Enter.
Verify the footer item counter reads "2 items left".

## Mark a todo as completed
Click the checkbox next to the "Buy milk" todo.
Verify the "Buy milk" todo is shown as completed (its checkbox is checked and its text is struck through).
Verify the "Walk the dog" todo is not completed.
Verify the footer item counter reads "1 item left".
