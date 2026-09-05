# Project status

## Batch 1: API contract, scope, and scaffold

- Status: implemented locally; awaiting orchestrator review
- Branch: `main` (no branch created)
- Pull request: none
- Package: `n8n-nodes-novu@0.1.0`, deliberately `private: true`

### Completed

- Replaced the template examples with one registered Novu action-node scaffold and one Novu API credential.
- Established final working package/repository metadata and retained MIT licensing, strict Nodes API v1 settings, pinned Node/npm toolchain, host-provided `n8n-workflow`, zero runtime dependencies, PR/main CI, tag-only publication, and fail-closed release controls.
- Recorded every proposed first-release endpoint plus identifiers, request/response shape, pagination, idempotency, version/edition limits, official sources, and validation state in `docs/API_COVERAGE.md`.
- Resolved modern topic-subscription deletion, workflow get/list, preference global/workflow targeting, and transaction cancellation without exposing the later operations.
- Recorded the architecture decision and preserved the product/batch handoff in-repository.

### Evidence

- Documentation: official Novu and n8n sources reviewed September 5, 2026.
- Deterministic local checks on Node 24.18.0: dependency clean install, format check, official n8n lint, strict typecheck, 3 scaffold invariant tests, build, private package audit/dry-run boundary, and `git diff --check` pass. The shell-injected `NO_COLOR` variable had to be unset for `n8n-node lint` because that CLI forces color; direct ESLint also passed. No placeholder operation test is counted.
- Mock/API fixtures: none in Batch 1.
- Live Novu requests: none; no credentials or Novu instance were used.
- n8n editor/package installation: not exercised in Batch 1.
- Self-hosted Novu: unverified; no version compatibility claim.

### Open items

- Subscriber omitted/null/custom-data behavior, mutation response edge cases, permissions, error envelopes, rate limiting, and retries need fixtures and later live evidence.
- The scaffold credential test performs a read-only workflow list limited to one result. Custom URL normalization/rejection and useful diagnostic mapping are intentionally deferred to Batch 2.
- The package name appeared available in public searches but is not reserved; recheck before publication.
- `private: true` must remain until a future human-reviewed release candidate satisfies `RELEASING.md`.

## Next batch

Batch 2: implement credentials and shared transport, including US/EU/custom host validation, reverse-proxy prefixes, a low-volume read-only credential test, version-safe URL construction, categorized errors, and tests. Missing credentials block only live validation.
