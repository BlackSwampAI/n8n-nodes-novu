# Project status

## Batch 1: API contract, scope, and scaffold

- Status: complete and merged
- Branch: merged into `main`
- Pull request: [#1](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/1)
- Merge commit: `52a3992`
- Post-merge main CI: successful
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

## Batch 2: credentials and shared transport

- Status: implemented locally; awaiting orchestrator review
- Branch: `batch-2-credentials-transport`
- Pull request: none
- Package: remains `n8n-nodes-novu@0.1.0` with `private: true`

### Completed

- Added strict US/EU/Custom base resolution. Custom bases require HTTPS, preserve reverse-proxy prefixes, normalize whitespace/trailing slashes, and reject malformed URLs, embedded credentials, query strings, fragments, unknown regions, and final `/v1` or `/v2` segments.
- Added explicit v1/v2 route construction and per-segment URL encoding, with no regional failover or TLS-disable setting.
- Credential authentication validates the base/key and applies `Authorization: ApiKey <secret>` through n8n's credential mechanism.
- The low-volume credential test performs `GET /v2/workflows?limit=1` and gives specific guidance for 401, 403, 404, and 429.
- Added a shared transport using `httpRequestWithAuthentication`, with secret-safe execution errors for bad credentials/wrong region, permission denial, missing resource/unsupported route, rate limiting plus `Retry-After`, and network failure.
- Established one retry-policy seam with only `none`; no automatic retry, mutation retry, or notification resend was added.

### Evidence

- Documentation: official n8n credential/request-helper guidance and Novu authentication, workflow-list, errors, and rate-limit references reviewed September 5, 2026.
- Deterministic tests: URL selection/normalization/rejection, reverse-proxy joining, version ownership, path encoding, credential auth/test metadata, request-helper invocation, authorization override prevention, status/network mapping, `Retry-After`, and secret redaction.
- Local validation on Node 24.18.0: clean dependency install, format check, official n8n lint, strict typecheck, 38 Vitest tests, build, private package audit/dry-run boundary (21 files), and `git diff --check` passed. Vitest emitted non-failing warnings about missing upstream `n8n-workflow` sourcemap sources. As in Batch 1, the runner-injected `NO_COLOR` variable was unset for `n8n-node lint` because that CLI forces color.
- Mock transport only: authenticated helper calls and HTTP/network errors use local test doubles; no API response fixture claims live behavior.
- Live credential/API validation: not run because no Novu credentials were provided.
- n8n editor/package installation, Novu Cloud, and self-hosted Novu: not exercised; no compatibility claim added.

### Known limitation

n8n's declarative credential test supports response-code rules, used here for 401/403/404/429, but exposes standard n8n messages for DNS, connection, and TLS failures. The execution transport provides a Novu-specific network category. Exact credential-test rendering remains an n8n editor/live gate.

## Next batch

Batch 3: subscriber lifecycle. Implement Create or Update, Get, Get Many, Update, and Delete atop the validated transport, preserving per-item expressions, omission/null semantics, pagination, response envelopes, limits, pairing, and continuation behavior.
