# Prompt used to create the TodoMVC suite

Written by a separate, fresh Claude Code session (`claude -p`, with the official kane-cli skill)
in an empty folder outside this repository, so it could not see Mutek or this file. The app is
the unmodified TodoMVC "JavaScript ES5" example (github.com/tastejs/todomvc, MIT), served by
`serve.js`. The prompt does not mention Mutek, mutation testing or test strength. The tests and
recordings were copied into `tests/` unchanged.

Allowed tools: Read, Write, Edit, Glob, Grep, and Bash limited to `kane-cli` and `ls`.

Outcome: the agent wrote all six tests, but in that headless session every `kane-cli` call was
refused for needing an approval, so it could not record them. The tests were then recorded,
unedited, with `kane-cli testmd run <file> --agent --headless` (one run each, all six passed,
about 440 credits). The transcript is in `agent-session.jsonl`.

The exact prompt, everything below the line:

---
A TodoMVC todo-list app is running and reachable at `http://localhost:8180`. Every test's
frontmatter must use `url: http://localhost:8180`. The app keeps its todos in memory, so each
test starts from an empty list.

Write a Kane CLI end-to-end suite for it in `tests/` using `_test.md` files, following the
kane-cli skill. Cover these user journeys, one test file each:

1. add_todos: add three todos and see them listed with the right item count
2. complete_todo: mark a todo as completed
3. filters: use the All, Active and Completed filters
4. clear_completed: clear completed todos
5. edit_todo: edit a todo's text by double-clicking it
6. delete_todo: delete a todo

Run each test once with `kane-cli testmd run <file> --agent` so it is recorded, and make sure all
of them pass. Do not run any other commands against the app.
