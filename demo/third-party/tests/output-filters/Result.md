---
test: ../filters_test.md
status: passed
started: 2026-11-18T13:14:16.647Z
duration_s: 186
session_id: bfba23a2-2317-4aac-ac71-b4fd5456af35
---

# Filter todos — Result

## Add todos and complete one ✓ passed (62.7s)
md5: 9181736f8daf2000deb026053bd4966a
Type "Buy milk" into the "What needs to be done?" input and press Enter.
Type "Walk the dog" into the "What needs to be done?" input and press Enter.
Click the checkbox next to the "Buy milk" todo.
Verify the footer item counter reads "1 item left".

## Use the Active filter ✓ passed (40.3s)
md5: 28ae08464735d16577ceb132b8c796c6
Click the "Active" filter link in the footer.
Verify the todo list shows only "Walk the dog" and does not show "Buy milk".

## Use the Completed filter ✓ passed (42.9s)
md5: b49a7f11c5b2ec108f4c3e3564fae2e8
Click the "Completed" filter link in the footer.
Verify the todo list shows only "Buy milk" and does not show "Walk the dog".

## Use the All filter ✓ passed (27.5s)
md5: fd7072aa29d2aa1723f50fde2e183eb0
Click the "All" filter link in the footer.
Verify the todo list shows both "Buy milk" and "Walk the dog".
