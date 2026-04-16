---
name: ship-changes
description: >-
  Runs npm test and npm run build, then commits and pushes the current branch
  with a clear conventional message. Use when the user asks to ship, release,
  test/build/commit/push, or merge-ready a Node/Next.js change set.
---

# Ship changes (test, build, commit, push)

## When to use

Apply this skill when the user wants changes verified and on the remote in one go (typical small/medium PRs or solo commits).

## Steps

1. **Run tests** from the repo root: `npm test` (or the project’s test script if different—check `package.json`).
2. **Run production build** (this project): `npm run build`. If either step fails, fix issues before committing; do not push a broken build unless the user explicitly overrides.
3. **Review** `git status` and `git diff` (staged scope). Stage only files that belong to the change; avoid unrelated edits.
4. **Commit** with a message that matches repo style. For this codebase, prefer:
   - `feat(scope): …` / `fix(scope): …` / `chore(scope): …`
   - Subject ≤ ~72 chars; body optional with what changed and why in short sentences.
5. **Push** current branch: `git push` (set upstream if needed: `git push -u origin <branch>`).

## Conventions

- Execute commands in the terminal; do not only suggest them.
- Request `git_write` and `network` permissions when committing and pushing from the agent environment.
- If nothing is staged, either stage intentional files or tell the user there is nothing to commit.

## Quick checklist

- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Commit message describes the change accurately
- [ ] `git push` succeeds
