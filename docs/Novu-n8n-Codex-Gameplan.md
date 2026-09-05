# Novu community node implementation gameplan

Prepared for Chris Nelson / Black Swamp AI on September 5, 2026. This repository copy is the controlling product and batch handoff. For resolved endpoint details, use `API_COVERAGE.md`.

## Product decision and release boundary

Build and maintain an independent n8n community node for Novu's notification platform. Keygen and Unkey are outside this project. Working repository: `BlackSwampAI/n8n-nodes-novu`; working npm name: `n8n-nodes-novu`. Recheck the name before publication. Never call the project official, approved, or verified unless n8n later confirms that outcome.

The first release contains one regular Novu action node and one API credential. “Trigger Workflow” is an action that starts a Novu workflow, not an n8n trigger node.

Proposed operations:

| Resource              | Operations                                      |
| --------------------- | ----------------------------------------------- |
| Subscriber            | Create or Update, Get, Get Many, Update, Delete |
| Notification          | Trigger Workflow, Cancel Execution              |
| Subscriber Preference | Get, Update                                     |
| Topic                 | Create or Update, Get, Get Many, Update, Delete |
| Topic Subscription    | Create, Get Many, Delete                        |
| Workflow              | Get, Get Many                                   |

Defer webhook triggers; broadcast/bulk APIs; workflow/step/template/layout/translation editing; providers, channel credentials, device tokens and attachment UIs; Inbox/realtime/client JWT features; Novu Connect/ACI/agents/MCP/ACP; raw requests; and automatic legacy fallback.

## Required engineering behavior

- Authenticate with `Authorization: ApiKey <secret>`. Credentials offer US, EU, and Custom without regional failover. Store no API version in the base; each operation owns `/v1` or `/v2`.
- Use the repository's current n8n TypeScript toolchain, supported request helpers, no runtime dependencies, and one lockfile.
- Treat external subscriber IDs, internal IDs, topic keys, relationship identifiers, workflow identifiers, and transaction IDs as distinct.
- Resolve expressions per input item. Validate expression-capable JSON without losing arrays, booleans, numbers, or nested values.
- PATCH only explicitly selected fields. Preserve false, zero, and intentional empty values; omission must not become an empty string.
- Map response envelopes per endpoint. Get Many emits one linked item per resource and no fabricated item for an empty list. Respect n8n continuation and pairing behavior.
- Search/paginate dynamic workflow/topic choices while retaining manual identifiers. Dropdown failure must not prevent execution.
- Never describe trigger acknowledgment as delivery. Mutation acknowledgments must preserve actual upstream results without inventing resources.
- Expose separate idempotency key and transaction ID inputs where supported. Retry safe reads and verified-idempotent writes only, honor `Retry-After`, and never resend an ambiguous trigger timeout without stable idempotency protection.
- Use deterministic mocked contract tests in CI. Keep live tests opt-in, bounded to owner-controlled development resources, sanitized, and precisely labeled. Cleanup only exact test-prefixed resources.

## Small-batch delivery plan

Each batch is one reviewable PR-sized boundary. Split only if it grows into unrelated work; do not broaden product scope.

1. **API contract, scope, and scaffold:** buildable private package, coverage matrix, architecture record, node/credential registration, metadata, README/status, CI; no usable operations.
2. **Credentials and shared transport:** US/EU/custom validation, read-only credential test, URLs, transport/errors, and only resolved paging helpers.
3. **Subscriber lifecycle:** Create or Update, Get, Get Many, Update, Delete with multi-item, JSON, omission, encoding, limits, pagination, and linkage tests.
4. **First notification:** trigger one existing workflow for one subscriber per item, optional transaction/idempotency keys, safe retry behavior, and acceptance-versus-delivery evidence.
5. **Preferences:** read and update supported global/workflow settings with unchanged/enabled/disabled semantics and unrelated-setting preservation.
6. **Topics:** full lifecycle, strict-create only if supported, duplicate behavior, cursors, encoding, partial update, empty/missing behavior.
7. **Subscriptions and topic delivery:** modern v2 create/list/delete, partial outcomes, richer relationships respected, and documented topic recipient triggering.
8. **Workflow discovery and cancellation:** v2 get/list and searchable selection with manual fallback; transaction cancellation of eligible delayed work.
9. **Release-candidate qualification:** full checks, inspect/install packed tarball in clean supported n8n, Playwright editor validation, bounded Cloud and pinned self-hosted evidence where available, complete docs/examples/changelog/submission materials.
10. **Human release checkpoint:** present name/version/operations/evidence/limits/release notes/checklist. Publish, tag, release, submit, or merge only after Chris explicitly authorizes each external action.

## Batch gates

Batch 1 resolves every proposed REST contract without guessing. Batch 2 distinguishes credential failures and protects secrets. Batch 3 proves subscriber lifecycle and item correctness. Batch 4 is the first useful live milestone. Batch 5 proves preference preservation. Batch 6 proves topic lifecycle. Batch 7 proves two subscribers join a test topic and one can be removed without assuming relationship uniqueness. Batch 8 proves identifier selection and cancellation of delayed pending work without claiming recall. Batch 9 proves the packed artifact, actual n8n UI, documentation, and only compatibility actually exercised. Batch 10 remains human-controlled.

### Detailed acceptance criteria

**Batch 1:** Read repository/release/template instructions and preserve user work. Recheck naming, current n8n verification guidance, Novu docs, and upstream/OpenAPI where ambiguous. Coverage must include method/path, identifier, shapes, pagination, idempotency, edition/version limits, source and evidence state. Resolve subscription deletion, workflow discovery, preference targeting, and cancellation before committing UI contracts. Build successfully; CI covers pull requests and main; uncertainty stays explicit; no unimplemented operation appears usable and no placeholder test creates a green count. Default MIT unless local precedent conflicts.

**Batch 2:** Implement host selection, credential authentication/test, URL construction, request helpers and categorized errors; add paging helpers only for resolved contracts. Test US, EU, custom, reverse-proxy prefixes, no doubled versions, and no secret leakage. Distinguish 401, 403, 404/version, 429 and network failures. Valid and invalid credentials produce useful different results. Missing credentials block live evidence only.

**Batch 3:** Implement subscriber ID, first/last name, email, phone, avatar, locale, timezone and supported custom data; exclude channel credentials. Live lifecycle creates, upserts same ID, retrieves, lists and deletes a test profile. Tests cover two per-item expressions, omission, false/zero nested data, invalid JSON, encoded IDs, not-found, multiple pages, limits and pairing. Do not guess data merge/replacement.

**Batch 4:** Trigger one subscriber per input item using workflow identifier, subscriber ID, payload, optional transaction ID and idempotency key. A real n8n execution syncs a test subscriber and triggers a development-only workflow. Preserve acknowledgment/transaction ID; inspect Novu activity/Inbox or owner-controlled inbox to distinguish acceptance from delivery. Test malformed payload, unknown workflow, error bodies, 429, timeout, exhaustion, and unchanged idempotency key/body over retry. Do not add billing/CRM dependencies for a demo.

**Batch 5:** Read/update global or workflow preferences. Tri-state controls distinguish unchanged, enabled and disabled; omit server-enforced/read-only flags. Disable then restore a test preference, preserve unrelated channel settings, read it back, and where practical observe its controlled notification effect. Do not claim a preference update cancels queued work.

**Batch 6:** Implement topic key versus display name correctly and expose strict create only if `failIfExists` is verified. Exercise full test-topic lifecycle, duplicate keys, cursors, encoded keys, partial updates, empty lists and delete-missing. Never infer successful deletion after upstream failure.

**Batch 7:** Implement current v2 ordinary subscription relationships; defer conditional rules and complex relationship preferences. UI deletion uses the actual selector contract. Add Topic recipient mode using Novu's documented representation rather than broadcast or client-side fan-out. Two test subscribers join, receive a controlled topic trigger, then one is removed and does not receive the next. Cover duplicates and partial failures; do not assume one relationship per subscriber/topic.

**Batch 8:** Workflow selection resolves the trigger-facing workflow identifier rather than database ID. Retain manual entry and explain permission errors from discovery. Trigger a workflow with a deliberate delay, cancel eligible pending execution by transaction ID, and observe outcome without claiming recall of delivered messages. Test the workflow endpoint's offset pagination.

**Batch 9:** Run format, official lint, strict types, tests and build. Pack the actual artifact; install into a clean supported n8n; inspect contents, registrations, icons and secret absence. Playwright must inspect the rendered editor, not merely launch a browser. Exercise credentials, conditional fields, expressions/JSON, manual IDs, dropdowns, multi-item output, continuation, and imported examples. Complete Cloud tests and pinned self-hosted tests where available, recording precise versions/edition/evidence; unavailable environments block only corresponding claims. Finish README setup/operations/compatibility/pagination/errors/idempotency/limitations/troubleshooting, wrong-region and accepted-versus-delivered explanations, two sanitized importable examples, changelog, release notes, verification checklist and submission material. Every advertised operation has contract coverage and appropriate evidence or an explicit limitation.

**Batch 10:** Present final name/version, operations, evidence, limitations, release notes and submission checklist to Chris. Publication, tags and submission are separately authorized actions. After authorization follow `RELEASING.md`, verify npm installation and provenance, and never report verification until n8n confirms it.

## Qualification details

Run formatting, official lint, strict typecheck, Vitest, build, package audit, clean tarball installation, and real editor checks. UI checks cover credential conditions, JSON expressions, manual identifiers, dropdowns, multi-item output, continuation, and examples. Provide sanitized Manual Trigger + Edit Fields examples for customer onboarding and topic opt-in/out. Record exact n8n, package, Novu version, edition, and whether evidence is documented, mocked, UI-observed, or live-observed.

Start live work in a Novu Cloud development environment, ideally in-app or an owner-controlled test inbox. Claim self-hosted support only after a pinned release is exercised. Use resource prefixes such as `bsa-novu-test-<runId>`, track exact created IDs, never bulk-delete an environment, and never expose credentials or customer data.

### Test matrix

| Area          | Required valuable cases                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Requests      | Correct method/version/authentication/encoding and omission of optional fields                    |
| Items         | Per-item expressions, pairing, empty results and continuation after failure                       |
| Pagination    | At least two pages, explicit limit, repeated-cursor detection and malformed response              |
| Mutations     | Upsert versus PATCH, false/zero, empty success and partial success                                |
| Notifications | Wrong identifier, payload types, acknowledgment versus delivery and timeout without unsafe resend |
| Preferences   | False versus unchanged, global/workflow scope and preserved unrelated settings                    |
| Compatibility | US/EU/custom construction, pinned self-host and unsupported-route errors                          |
| Package       | Clean tarball installation, metadata/credential registration and actual editor execution          |

Fixtures derive from official contracts and sanitized development traffic. CI needs no production credential. Mock realistic boundaries rather than creating hundreds of live recipients. Respect documented page limits and fail usefully on a repeated cursor instead of silently truncating “Return All.”

## Working agreement

Read `AGENTS.md`, `RELEASING.md`, this file, and `docs/STATUS.md`. Work one requested batch at a time, preserve unrelated changes, verify locally, update status, and stop at the boundary. Missing credentials block only the relevant live gate. Do not reopen all product scope or re-audit unchanged sources each turn. The primary agent owns requirements/diff review/reporting; the configured single builder owns one bounded implementation assignment.

Recommended report: Batch/name; delivered capability; local/CI/UI/live validation distinguished; versions/editions actually exercised; specific open issues; branch/PR reality; next batch.

## Post-release roadmap

Prioritize real installation/API compatibility fixes. Add bulk only for demonstrated value with bounded sizes and per-entry results. Reconsider a webhook trigger only with suitable plan access and verified schemas, signing, raw body, replay/retry, and registration lifecycle. Consider provider credentials, attachments, richer subscriptions, and notification inspection based on demand. Treat Novu Connect/ACI as a separate product decision.
