# Assertion patterns that caught real bugs in this repo

- The test checks which rows are listed, or how many (caught: rendered-item-drop; I added a final step that tells Kane not to add, edit or re-enter any todo, then checks that the list shows exactly 3 visible rows and that the first one reads )
- The test checks which rows are listed, or how many (caught: rendered-item-drop; I appended a step that checks, without typing anything or changing any todo, that the second visible row, directly below "Buy milk" and directly above "Read a b)
- The test checks how many rows are listed (caught: rendered-item-dup; The screenshot shows why the earlier "exactly 3 rows" checks didn't catch this: the extra "Read a book" row is fourth, and the footer still says "3 items left",)
- The test checks how many rows are listed (caught: rendered-item-dup; I added a final step, "Check the list holds exactly one todo": without typing anything or changing any todo, it checks that the list shows exactly 1 visible row)
