---
url: http://localhost:8180
mode: testing
max_steps: 30
tags: [todomvc, edit]
---

# Edit a todo

## Add a todo
Type "Buy milk" into the "What needs to be done?" input and press Enter.
Verify the todo list shows "Buy milk".

## Edit the todo by double-clicking it
Double-click the "Buy milk" todo text to enter edit mode.
Clear the edit field, type "Buy oat milk" and press Enter.
Verify the todo list shows "Buy oat milk" and no longer shows "Buy milk".
Verify the footer item counter reads "1 item left".

## Check the list holds exactly one todo
Without typing anything or adding, editing or re-entering any todo, verify the todo list shows exactly 1 visible row, that this row reads "Buy oat milk", and that there is no other row below it above the footer.
