# Commit when a ticket closes

Closing a ticket commits its work and pushes it. `flow tickets done` runs last, after the push lands. A ticket never closes over uncommitted work.

The message: `<id>: <what the person now sees>`, then the session's attribution lines.

## Pick the path

1. **The project names its own way to commit** in its `CLAUDE.md`, a skill or a command → use it, then push. Hustle on the Mac: `/commit-from-shared-tree`. The Operator on the server: commit on `flow/<id>`, then `land`.
2. **The ticket has a worktree** → `worktrees.md` → `## Merging by hand`, steps 1 to 7, without waiting for the user's word.
3. **The main checkout** → `git status --short`.
   - Every changed file is the ticket's → `util git save "<message>"`.
   - Some files are another session's → `util git save -p <the ticket's paths> "<message>"`.
   - One file holds both → the project's own way from step 1. With none, stop as `## When it cannot finish` says.

Check: `git status --short` lists none of the ticket's files, and `git log origin/<branch> -1` shows the commit.

## A refused push

1. `git fetch`, then `git log --oneline HEAD..origin/<branch>`: the commits the push lacks.
2. In a worktree, or a checkout with no other session's edits: `git rebase origin/<branch>`. Each conflict: read both sides, keep what each side meant, `git add`, `git rebase --continue`.
3. A checkout holding another session's edits: the project's own way from step 1. With none, stop.
4. Run the full suite. Then push again.

## When it cannot finish

A conflict whose 2 sides want different things, a suite that fails after the rebase, or another session's edits in a file of the ticket with no way to split them:

- The ticket stays open. Its `## Tasks` gets one line: what stopped the commit, and the files.
- The reply names the files and what each side wanted.

Never force a push, commit another session's edits, or `git stash` in a checkout other sessions share.
