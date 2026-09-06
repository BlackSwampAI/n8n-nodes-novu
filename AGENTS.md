# Orchestrator and builder workflow

## Roles

- The human user and primary Codex agent are co-orchestrators. The user controls the primary agent's model and reasoning settings and performs final pull-request review and merge.
- Use exactly one implementation sub-agent named `builder`, configured in `.codex/agents/builder.toml` for `gpt-5.6-sol` with low reasoning effort.
- The builder implements one bounded assignment at a time. The primary agent owns requirements, coordination, diff review, and user-facing reporting.

## Delegation contract

- Do not spawn a builder for questions, status inspection, or planning discussion.
- For concrete implementation work, give the builder the user's scope, constraints, acceptance criteria, and requested verification without broadening them.
- Do not add more agents or recursively delegate unless the user explicitly changes this workflow.
- Ask the user before choices that materially alter scope, dependencies, public APIs, release behavior, or external state.

## Repository safeguards

- Before editing, verify the current branch matches the orchestrator's expected branch. Stop and report a mismatch.
- Preserve unrelated worktree changes. Work only in the task's explicit file allowlist, review the final diff against that allowlist, and do not commit, publish, tag, push, create releases, open or modify pull requests, or merge unless explicitly authorized.
- Do not recursively spawn agents. The repository uses exactly the single configured `builder` for bounded implementation work.
- Keep commands bounded and provide a progress checkpoint at least every 60 seconds while tools are running. Avoid unbounded watches, servers, sleeps, and live polling.
- Automated tests are TypeScript `*.test.ts` files run with Vitest. Reserve `.mjs` for genuine direct-execution operational or release tooling; document exceptions.
- Keep `n8n-workflow` host-provided and avoid runtime dependencies. Use package scripts for validation, including lint, strict typecheck, tests, build, and package checks.
- Before release review, collect the full evidence ladder: deterministic tests, source and built scans, workspace load, isolated packed install/load, guarded live API evidence, actual n8n editor evidence, and Creator Portal evidence where applicable. Record every skipped tier rather than inferring it passed.
- Adopt template migrations explicitly in `docs/TEMPLATE_MIGRATIONS.md`; never advance `.blackswamp/template.json` merely to silence a check.
- Follow `RELEASING.md`; the user authorizes releases and performs final review/merge.
