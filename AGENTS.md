# AGENTS.md — Project Coding Rules

These rules apply to **all code written in this project**, by any developer or AI agent.
They are not optional and not negotiable.

---

## 1. Code Quality Standards

Every piece of code must be:

- **Readable** — clear names, consistent formatting, no clever tricks.
- **Well-structured** — small, focused functions/modules, each with one clear responsibility.
- **Commented where logic is non-obvious** — explain *why*, not *what*. Obvious code needs no comment.
- **Easy for another developer to pick up and extend** — a newcomer must be able to locate and modify any feature without asking the original author.
- **Easy to understand for a beginner** — prefer the straightforward approach over the advanced one when both work.
- **Easy to maintain** — change one thing in one place; no tangled dependencies.
- **Easy to extend later** — open for extension without requiring rewrites.

## 2. Engineering Priorities

- **Performance: reduce queries.**
  Minimize database/API calls: batch requests, avoid N+1 patterns, fetch only what is needed, cache where it genuinely helps.

- **Prioritize security.**
  Validate all input, sanitize output, use parameterized queries, least-privilege defaults, never trust client-side data, never hardcode secrets, handle auth and errors defensively.

- **Always flag non-standard implementations.**
  Whenever code deviates from the standard/idiomatic pattern of the stack, mark it in a comment, e.g. `// NON-STANDARD: <what> — <why> — <standard alternative>`, and mention it in the walkthrough.

- **Do not patch — think long, then implement.**
  Scrutinize the architecture *before* writing code. No "it works now" shortcuts. If a fix would be a patch over a flawed design, redesign properly instead of layering hacks.

- **Always check and fix edge cases.**
  Cover null/empty/invalid input, boundary values, concurrency, network failure, permission errors — handle them or reject them explicitly. List the edge cases you covered.

## 3. Avoid

- **Over-engineering** — no speculative abstractions, no features nobody asked for. Solve the problem at hand, simply.
- **Magic values** — no unexplained literals in logic; use named constants with meaningful names.
- **Hard-coded assumptions** — nothing baked into logic about environment, paths, locales, data shape or scale; configure or derive such values.

## 4. Git Commit Rules

Commit identity is always:

- Name: `Daniel130me`
- Email: `kosokodaniel@gmail.com`

Commit messages follow **Conventional Commits**:

```
<type>(<scope>): <short imperative summary>

[optional body: what changed and why]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

Examples:

- `feat(auth): add password reset endpoint`
- `fix(api): handle empty payload in order creation`
- `perf(db): batch user lookups to cut query count`

Never use a UID, hash, or random string as the commit message.

## 5. Mandatory Post-Implementation Compliance Check

After **every** implementation — before declaring the task done — re-check the delivered code against every rule above and **include this check in the walkthrough**:

```
Compliance check:
- [x] Readable & well-structured
- [x] Comments where logic is non-obvious
- [x] Beginner-friendly, maintainable, extensible
- [x] Queries minimized (N+1 avoided / batched)
- [x] Security handled (input validated, etc.)
- [x] Non-standard choices flagged (none / listed below)
- [x] Architecture reviewed — no patch-style fixes
- [x] Edge cases covered (list them)
- [x] No over-engineering, magic values, or hard-coded assumptions
- [x] Commit authored as Daniel130me <kosokodaniel@gmail.com> with conventional message
```

Any unchecked box must be fixed before delivery — not excused.
