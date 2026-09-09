# Project status

## Batch 1: API contract, scope, and scaffold

- Status: complete and merged
- Branch: merged into `main`
- Pull request: [#1](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/1)
- Merge commit: `52a3992`
- Post-merge main CI: successful
- Package at the time: `n8n-nodes-novu@0.1.0`, deliberately `private: true`

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

- Status: complete and merged
- Branch: merged into `main`
- Pull request: [#2](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/2)
- Merge commit: `19974aa`
- Post-merge main CI: successful ([run 34002613032](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34002613032))
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

## Batch 3: subscriber lifecycle

- Status: complete and merged
- Branch: merged into `main`
- Pull request: [#3](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/3)
- Merge commit: `7c309cd`
- Post-merge main CI: successful ([run 34004387149](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34004387149))
- Package: remains private `n8n-nodes-novu@0.1.0`

### Delivered

- Subscriber Create or Update, Get, Get Many, Update, and Delete are the only exposed resource/operations.
- Common profile fields use typed optional inputs. Custom Data accepts an expression-capable JSON object or null. Explicit Clear Fields sends documented nulls; omission, empty string, false, zero, arrays nested inside data, and nested objects remain distinct.
- PATCH sends selected fields only and rejects no-op or conflicting update/clear selections locally with item context.
- Get Many supports documented filters, sorting options, Return All, exact Limit, forward `after` pagination, response-envelope validation, repeated/malformed cursor detection, empty lists, and per-input output pairing. Novu's pagination documentation defines cursor-list limits of 1 through 100 and uses `/v2/subscribers` as its example; requests use that documented maximum.
- Full subscriber resources are preserved without generic `data` unwrapping. Delete preserves the targeted external ID and documented result, with defensive boolean/empty mappings.
- Per-item continuation preserves earlier successes and pairing; no rollback or automatic retry is implied.

### Evidence and limitations

- Contract evidence: current official Novu v2 subscriber documentation, reviewed September 5–6, 2026.
- Deterministic mocks cover all methods/routes, ID encoding, filters/query/body omission, strict duplicate flag, distinct per-item parameters, typed/empty/null/custom-data behavior, invalid JSON/types, stop/continue behavior, single/multi-page lists, exact limits, empty lists, malformed/repeated cursors, pairing, and delete response variants.
- Local validation on Node 24.18.0: format check, official n8n lint, strict typecheck, 58 Vitest tests, build, private package audit/dry-run boundary, and `git diff --check` passed. The known non-failing upstream `n8n-workflow` missing-sourcemap warnings remain; `NO_COLOR` was unset for the CLI lint as in prior batches.
- No Novu credential, Cloud request, n8n editor execution, or self-hosted environment was used. Duplicate upsert behavior, actual custom-data merge/replacement, upstream null clearing, credential permissions, and live response/error shapes remain unverified.
- No notification, preference, topic, subscription, workflow, raw-request, webhook, bulk, channel-credential, or retry capability was added.

## Next batch

Batch 4: Trigger Workflow for one subscriber per input item, building on the proven subscriber and transport behavior while keeping API acknowledgment distinct from delivery and guarding ambiguous retries with separately verified idempotency.

## Batch 4: trigger a workflow for a subscriber

- Status: complete and merged
- Branch: merged into `main`
- Pull request: [#4](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/4)
- Merge commit: `d89d031`
- Post-merge main CI: successful ([run 34010280849](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34010280849))
- Package: remains private `n8n-nodes-novu@0.1.0`

### Delivered

- Notification exposes only Trigger Workflow. It posts `name`, string `to`, and object `payload` to `/v1/events/trigger`, with optional Transaction ID and Idempotency Key kept distinct.
- Required identifiers and payloads are validated per input item. Optional empty values are omitted, and full valid Novu acknowledgments are preserved without claiming channel delivery.
- The opt-in idempotent-trigger retry policy makes at most three total attempts for 408, 409 in-progress, 429, 500/502/503/504, and status-free network/timeout failures. Other 4xx responses, including changed-body key reuse at 422, are not retried.
- Numeric `Retry-After` is honored through a conservative 30-second package cap; a longer server interval surfaces an error instead of sleeping less than requested. Missing intervals use deterministic one- and two-second delays. Subscriber operations retain the default no-retry policy.

### Evidence and limitations

- Contract evidence: current official Novu event-trigger, idempotency, error, and rate-limit documentation reviewed September 5–6, 2026.
- Deterministic mocks cover v1 request construction, optional omission, distinct per-item values and pairing, JSON validation, acknowledgment schemas/statuses, terminal errors, continuation, all retry categories, Retry-After, the attempt ceiling, identical request reuse, and exhaustion.
- Local validation on Node 24.18.0: format check, official n8n lint, strict typecheck, 95 Vitest tests, build, private package audit/dry-run boundary, and `git diff --check` passed. Known non-failing upstream `n8n-workflow` missing-sourcemap warnings remain; `NO_COLOR` was unset for CLI lint.
- No Novu credential, Cloud request, n8n editor execution, provider inbox/activity inspection, or self-hosted environment was used. The first real end-to-end notification milestone remains blocked on an owner-controlled credential and development workflow. Acceptance versus actual channel delivery is therefore not observed.
- Novu API idempotency is not enabled for every organization. The 24-hour cache is finite, Transaction ID is not equivalent atomic/API-boundary deduplication, and users must not stack this package policy with n8n node-level retries.
- Topic recipients, bulk/broadcast, cancellation, workflow discovery, and all later resources remain unavailable.

## Next batch

Batch 5: Subscriber Preferences, preserving unchanged/enabled/disabled distinctions and unrelated settings.

## Batch 5: subscriber preferences

- Status: complete and merged
- Branch: merged into `main`
- Pull request: [#5](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/5)
- Merge commit: `99004ae`
- Post-merge main CI: successful ([run 34011885668](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34011885668))
- Package: remains private `n8n-nodes-novu@0.1.0`

### Delivered

- Subscriber Preference exposes only Get and Update through the encoded external subscriber ID preference route.
- Get supports optional criticality and context-key filters and preserves the full global/workflow envelope.
- Update selects Global or Workflow scope. Workflow scope requires an exact non-empty reference accepting the documented internal `_id`, identifier, or slug forms.
- All six currently documented channels—email, sms, in_app, push, chat, and tool—use Unchanged/Enabled/Disabled controls. Only changed booleans are sent, preserving unrelated settings and false values; all-unchanged updates fail locally.
- Schedule and context mutation remain deferred. No claim is made that preference changes cancel already queued work.

### Evidence and limitations

- Contract evidence: official Novu subscriber preference documentation reviewed September 6, 2026. The current six-channel schema adds `tool` relative to the five-channel project handoff and is recorded as documentation drift.
- Deterministic mocks cover metadata/display conditions, encoded GET/PATCH routes, optional query omission/inclusion, string-array context keys, full-envelope preservation, global/workflow bodies, all six tri-states, no-op and malformed inputs/responses, two input items, pairing, and continuation.
- Local validation on Node 24.18.0: format check, official n8n lint, strict typecheck, 110 Vitest tests, build, private package audit/dry-run boundary, and `git diff --check` passed. Known non-failing upstream `n8n-workflow` missing-sourcemap warnings remain; `NO_COLOR` was unset for CLI lint.
- No credentials, live Novu API request, n8n editor execution, Cloud environment, or pinned self-hosted environment was used. Upstream preference mutation/read-back behavior and its practical notification effect remain live-unverified.
- No retry or Idempotency-Key header is used for preference operations.

## Next batch

Batch 6: Topic lifecycle—Create or Update, Get, Get Many, Update, and Delete.

## Batch 6: topic lifecycle

- Status: complete and merged
- Branch: merged into `main`
- Pull request: [#6](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/6)
- Merge commit: `00de64b`
- Post-merge main CI: successful ([run 34014365414](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34014365414))
- Package: remains private `n8n-nodes-novu@0.1.0`

### Delivered

- Topic exposes only Create or Update, Get, Get Many, Update, and Delete. Public topic keys stay distinct from internal `_id` values and are encoded in path segments.
- Create preserves omission versus empty display name or null custom data, validates flat scalar/string-array data and the 64 KB bound, and optionally requests strict creation.
- Update sends the required display name only; data is not added to the current PATCH schema.
- Get Many implements key/name filters, ordering, exact Limit/Return All, forward `after` pagination at the documented 100-record maximum, envelope validation, repeated cursor detection, empty output, and pairing. Raw cursors and `includeCursor` are deliberately not exposed.
- Delete emits only the targeted topic key and Novu's actual boolean acknowledgment. No success is inferred from malformed responses; topic deletion's irreversible subscription removal is documented.

### Evidence and limitations

- Contract evidence: current official Novu Topic documentation reviewed September 6, 2026.
- Deterministic mocks cover metadata, all methods/routes, encoded keys, per-item values, omission/empty/null/flat data, false/zero/string arrays, invalid/nested/oversize data, strict create, name-only update, full responses, multi-page/limited/empty lists, filters/order, malformed/repeated cursors, delete booleans, missing topics, continuation, and pairing.
- Local validation on Node 24.18.0: format check, official n8n lint, strict typecheck, 123 Vitest tests, build, private package audit/dry-run boundary, and `git diff --check` passed. Known non-failing upstream `n8n-workflow` missing-sourcemap warnings remain; `NO_COLOR` was unset for CLI lint.
- No credentials, live API request, n8n editor execution, Cloud environment, or pinned self-hosted environment was used. Actual upsert/strict duplicate behavior, data persistence, deletion effects, and response shapes remain live-unverified.
- No Topic Subscription operation or Topic notification recipient mode was added. Topic operations use no automatic retries or Idempotency-Key header.

## Next batch

Batch 7: Topic subscriptions and topic notification delivery.

## Batch 7: topic subscriptions and topic delivery

- Status: complete and merged
- Branch: merged into `main`
- Baseline hardening: [PR #7](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/7), commit `510ec29`, merged to `main`; post-merge CI [run 34025348837](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34025348837) successful
- Batch 7 pull request: merged [#8](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/8)
- Merge commit: `363f514`
- Pull-request CI: successful ([run 34054449993](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34054449993))
- Post-merge main CI: successful ([run 34055128416](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34055128416))
- Package: private `@blackswampai/n8n-nodes-novu@0.1.0`

### Delivered

- Topic Subscription exposes only Create, Get Many, and Delete using the modern `subscriptions` request field, never deprecated `subscriberIds`.
- Create/Delete accept 1–100 relationship entries and preserve full mutation envelopes, including partial failures. Novu may auto-create a missing topic during Create.
- Subscriber-only Delete is explicitly labeled as removing all of that subscriber's relationships in the topic; identifier-only and combined selectors are supported.
- Get Many supports subscriber/context filters, ordering, exact limits, forward pagination, envelope/repeated-cursor validation, empty output, and input pairing without assuming subscriber/topic uniqueness.
- Trigger Workflow adds backward-compatible Subscriber/Topic recipient selection. Topic mode sends the exact Topic recipient object and relies on Novu fan-out; it is neither a client member loop nor broadcast-to-all.

### Evidence and limitations

- Contract evidence: official Novu Topic Subscription and event trigger documentation reviewed September 6, 2026.
- Deterministic mocks cover metadata, modern request shapes, encoded keys, 1/100 bounds, relationship selectors, partial results, query allowlists, multi-page limits, malformed/repeated cursors, pairing/continuation, backward-compatible subscriber recipients, exact Topic recipients, and identical idempotent retry requests.
- Local validation on Node 24.18.0: frozen install, formatting and format check, official n8n lint, strict typecheck, 140 Vitest tests, build, official source/built scan, private release audit, 51-file dry-run package boundary, workspace constructor/icon load, isolated packed install/load, and `git diff --check` passed. Known non-failing upstream `n8n-workflow` missing-sourcemap warnings and npm dependency deprecation/update notices remain development advisories; `NO_COLOR` was unset for CLI lint.
- No credentials, live API request, n8n editor execution, Cloud environment, provider delivery observation, or pinned self-hosted environment was used. Auto-create, relationship deletion effects, partial failures, topic fan-out, provider usage/billing, and actual delivery remain live-unverified.
- The scoped npm name returned `E404` on September 6, 2026; this is availability evidence, not a reservation, and must be rechecked before publication. The canonical homepage `https://blackswampai.com/n8n-nodes/novu/` currently returns HTTP 404 and is an external release blocker.
- Workspace constructor/icon loading and isolated packed install/load are local package checks, not actual n8n editor or Creator Portal visual evidence. Those visual gates remain pending.
- Context-scoped subscriptions, conditional/group preferences, and bulk/broadcast remain deferred.

## Next batch

Batch 8: Workflow discovery and pending execution cancellation.

## Batch 8: workflow discovery and pending execution cancellation

- Status: complete and merged
- Branch: merged into `main`
- Pull request: merged [#9](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/9)
- Merge commit: `76109a3`
- Base commit: `363f5140e129362fd8c1ed71a8d118a990fa8fef`
- Package: remains private `@blackswampai/n8n-nodes-novu@0.1.0`

### Delivered

- Workflow exposes Get and Get Many only. Get accepts saved string and From List/By ID locator shapes for the public trigger-facing `workflowId`; full workflow responses preserve internal `_id` as a distinct field.
- Get Many supports Return All/exact Limit, query/status/tag/order controls, offset/limit pages of at most 100, empty output, full workflow pairing, malformed-envelope validation, and no-progress protection.
- Trigger Workflow now uses the same searchable, paginated locator while preserving old saved string values. Search results use `workflowId`, never internal `_id`; manual entry remains executable if list permissions fail.
- Notification adds Cancel Execution by encoded transaction ID. It returns the target ID plus Novu's actual boolean and uses no retry or idempotency header. Only eligible active/pending work such as delays or digests can be cancelled; delivered messages cannot be recalled.

### Evidence and limitations

- Contract evidence: official Novu Workflow list/retrieve and event-cancellation documentation confirmed September 6, 2026.
- Deterministic mocks cover exact metadata, locator normalization and blank states, trigger selection, workflow retrieval, list filters/ordering/multipage limits/empty/malformed/no-progress behavior, per-item pairing/continuation, list-search filtering/tokens/results/errors, and cancellation true/false/encoding/errors.
- Local validation on Node 24.18.0: format/write and format check, official n8n lint, strict production/test typecheck, 159 Vitest tests across 11 files, build, official source/built scanner, private release audit, package boundary (57 files, 35,087 packed bytes, 187,983 unpacked bytes), workspace constructor/icon load, and `git diff --check` passed. The orchestrator ran `npm run smoke:install` outside the managed sandbox; compiled registration of exactly 1 node and 1 credential passed, followed by the isolated packed-package install/load. Known upstream `n8n-workflow` missing-sourcemap warnings remain non-failing advisories.
- No credentials, live Novu API request, actual n8n editor execution, Cloud or pinned self-hosted environment, delivery observation, or Creator Portal check was performed. Endpoint permissions, observed paging, cancellation eligibility, editor locator rendering, and self-hosted compatibility remain unverified.
- The scoped npm name still requires a prepublication recheck.

## Next batch

Batch 9: release-candidate qualification and documentation, including packed installation in a supported n8n instance plus guarded live/editor evidence when the owner supplies the required environment and credentials.

## Raw HTTP response-envelope hardening

- Status: complete and merged
- Pull request: merged [#10](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/10)
- Merge commit: `00e97fe`
- Scope: unwrap exactly one Novu ResponseInterceptor `{ data: payload }` layer at ordinary-response call sites for Subscriber, Subscriber Preference, Topic, Notification, and Workflow. Subscriber/Topic cursor lists and Topic Subscription list/mutation envelopes remain direct.
- User-observed Cloud evidence: live failures exposed a mismatch between the SDK-level payload shapes published in the API reference and raw Cloud HTTP responses wrapped by Novu's global response interceptor. Current Novu source confirms ordinary payload wrapping and the direct treatment of response objects that already contain top-level `data`.
- Deterministic evidence: fixtures now represent raw wrapped entity, acknowledgment, preference, workflow-list, list-search, and boolean-cancellation responses, including nested custom `data`, empty workflow results, and `false` cancellation. Direct cursor and Topic Subscription envelopes remain covered without an extra unwrap.
- Safety: unwrapping is explicit at affected endpoint call sites and exactly one level deep. Missing or malformed wrappers flow into endpoint-specific validation so execution errors retain n8n item context and do not expose raw response bodies, payloads, credentials, or idempotency keys.
- Owner-observed evidence: the owner exercised the node in an actual local n8n editor against Novu Cloud. Before this fix, an empty workflow list and ordinary Topic responses exposed raw-envelope mismatches. After the fix the owner reported smoke behavior was “much better” and then that everything else was solid. Exact n8n/Novu versions and operation-by-operation results were not recorded, so complete live compatibility and delivery are not claimed.

## Batch 9: release-candidate qualification and documentation

- Status: implemented locally; awaiting review
- Base: synchronized `main` at `00e97fe`
- Package: remains private `@blackswampai/n8n-nodes-novu@0.1.0`

### Delivered

- Replaced both theme assets byte-for-byte with Novu's official immutable gradient favicon and protected its SHA-256 in deterministic and release checks.
- Added sanitized importable customer-onboarding and topic opt-in/out examples using only Manual Trigger, Edit Fields, and this node.
- Added structured actual-editor/Novu Cloud smoke instructions, proposed release notes, and a verification/submission checklist. README, compatibility, testing, branding, operation matrix, and release guidance are synchronized.
- Recorded the public repository, HTTP 200 canonical homepage, npm `E404` availability evidence, and planned temporary-token-to-OIDC first-publication transition without enabling publication.

### Evidence and limitations

- Local validation on Node 24.18.0: frozen `npm ci` installed 734 packages; format/write and check, official n8n lint, strict production/test typecheck, 165 Vitest tests across 12 files, build, official source/built scan, private release audit, package boundary (60 files, 35,956 packed bytes, 191,789 unpacked bytes), workspace constructor/icon load, isolated packed install/load, and `git diff --check` passed. The isolated smoke required execution outside the managed sandbox after sandboxed process spawning returned `EPERM`.
- Development advisories: `npm ci` reported upstream deprecations, three unapproved transitive install scripts, and 18 audit findings (12 moderate, 6 high); no runtime dependency was added. Existing missing `n8n-workflow` sourcemap-source warnings remain non-failing.
- Existing owner smoke is limited to the observations recorded above. The owner also completed the requested source-checkout visual check in an actual local n8n editor, reported the official gradient icon was “perfect,” and authorized moving on; this confirms the requested picker/canvas/node-panel/credential-form surfaces in light and dark themes. Exact n8n version and screenshots were not recorded.
- Exact versions, complete operation coverage, automated live tests, provider delivery, packed-tarball visual confirmation, pinned self-hosted Novu, and Creator Portal icon/version evidence remain incomplete or unrecorded. The broader structured editor/API checklist remains open.
- The separate release audit is expected to report only three Batch 10 blockers: private package, absent `scan:published`, and absent `publish.yml`. Batch 9 intentionally does not remove them.

## Next batch

Batch 10: human release checkpoint, separately reviewed release preparation, publication authorization, npm/provenance verification, and Creator Portal submission.

## Batch 10: release and post-release evidence

- Status: released; repository, npm, provenance, official scanner, GitHub release, and published-package load gates complete
- Release preparation: [PR #12](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/12) merged as `e494a9b06c7616fbd640022a3273b9f41ac0a2fa`
- Final scanner retry-policy correction: [PR #13](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/13) merged as final release commit `b043909cc7cfa2faa4d8e997407032f7a8e4ea73`; PR checks passed
- Post-merge CI: [run 34072567276](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34072567276) passed Node 22.22.0 and Node 24 lanes on `b043909cc7cfa2faa4d8e997407032f7a8e4ea73`
- Package: public `@blackswampai/n8n-nodes-novu@0.1.0`; n8n verification is not claimed

### Prepared

- Removed the private package guard and added a tag-only GitHub Actions workflow. The publish job alone has `id-token: write`; the dependent published verifier is fresh and read-only.
- Added npm minimum-version and token/OIDC preparation helpers plus exact-success, bounded post-publication scanner policy and tests.
- Preserved the Novu identity, resources, official icon hash, docs/examples, zero runtime dependencies, host-provided peer, and packed-load safeguards in the public release audit.
- Made README/release documentation evergreen for an unverified self-hosted Community Nodes package. The owner confirms the first-publication `NPM_TOKEN` secret exists; its value was not inspected.

### Evidence and remaining gates

- Local validation on Node 24.18.0: formatting/check, official n8n lint, strict production/test typecheck, 169 Vitest tests across 13 files, build, official source/built scan, public release audit in both local and exact `v0.1.0` tag contexts, package boundary (60 files, 35,977 packed bytes, 191,957 unpacked bytes), workspace and isolated packed-install loading of exactly 1 node and 1 credential, npm minimum-version verification with npm 11.16.0, and `git diff --check` passed. The isolated install and npm-version process checks required execution outside the managed sandbox after sandboxed child-process spawning returned `EPERM`. Existing missing `n8n-workflow` sourcemap-source warnings remain non-failing advisories.
- The annotated `v0.1.0` tag object `f92dfa7ff66f1dea56578b843787917834ff3039` peels to the reviewed release commit `b043909cc7cfa2faa4d8e997407032f7a8e4ea73`.
- Publish workflow [run 34072798768](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34072798768) published the package once. The one-time publish job passed, npm accepted public version 0.1.0 with signed provenance, and that publish job was not rerun. The first verifier attempt encountered a registry 404 before metadata was visible; after propagation, rerunning only the failed verifier produced a passing second attempt.
- The official scanner reported exactly: “Package @blackswampai/n8n-nodes-novu@0.1.0 has passed all security checks”. Provenance passed and the source was fetched at `b043909`. `npm view` reports version and `latest` as 0.1.0 with matching repository, homepage, and MIT metadata, no runtime dependencies, host peer `n8n-workflow`, and SLSA predicate `https://slsa.dev/provenance/v1`.
- A published-registry install using `--ignore-scripts --no-package-lock --omit=peer` succeeded; compiled loading registered exactly 1 node and 1 credential. The public, non-draft, non-prerelease [GitHub release](https://github.com/BlackSwampAI/n8n-nodes-novu/releases/tag/v0.1.0) is available.
- This section records the state immediately after 0.1.0. Subsequently, on September 9, 2026, the owner confirmed npm Trusted Publisher for owner `BlackSwampAI`, repository `n8n-nodes-novu`, workflow `publish.yml`, no environment, with direct npm publish allowed, and confirmed revocation of the temporary granular token; the GitHub `NPM_TOKEN` secret was independently verified absent. Creator Portal submission and card version/logo inspection remain pending. Do not describe the node as n8n verified until n8n confirms it.
- Existing limited local editor/Cloud and source-checkout icon observations remain as recorded in Batch 9. Exact live versions, complete operation coverage, delivery, packed-editor visuals, and pinned self-hosted evidence remain incomplete.

## Declarative-first action-node refactor

- Status: implemented locally on `refactor/declarative-actions`; awaiting review
- Architecture: removed the node-wide `execute()` method. Eighteen ordinary operations now use declarative request routing, focused request/response hooks, and function pagination. Notification Trigger Workflow is the sole operation-specific `customOperations` path so its opt-in idempotency retries remain confined to the verified route and key.
- Compatibility: all public resources, operation values, controls, versioned paths, request bodies, response shapes, workflow locator/list search, pagination limits and failure guards, delete/cancel acknowledgments, and documented limitations remain unchanged. Credential authentication still owns US/EU/custom base URL selection.
- Deterministic evidence: real node-description tests verify 18 routed operations, no node-wide execute method, the trigger custom operation, encoded request construction, omission behavior, raw-envelope validation, cursor pagination/exact limits/repeated-cursor failure, and the existing operation-specific behavior and retry suite.
- Final validation: format check, official n8n lint, strict production/test typecheck, 181 Vitest tests across 14 files, build, official source scan, workspace constructor/icon load of exactly 1 node and 1 credential, public release audit/package boundary (54 files, 38,305 packed bytes, 196,136 unpacked bytes), isolated packed-package install/load of exactly 1 node and 1 credential outside the managed sandbox, and `git diff --check` passed. Known upstream `n8n-workflow` missing-sourcemap warnings remain non-failing advisories.
- Continuation behavior: ordinary operations now rely on n8n's declarative routing engine for per-item continuation and error-item construction instead of the former hand-built `{ error }` item. Successful output shapes and item pairing are unchanged; exact engine-produced network/continuation error items require a fresh actual-editor run.
- Limited live/editor evidence: after the refactor, the owner ran the node in an actual n8n editor against their Novu Cloud instance, successfully retrieved the available objects they could exercise, successfully created a topic, and reported that the exercised behavior appeared to work as advertised. Exact n8n and Novu versions, screenshots, and operation-by-operation results were not recorded, so this is a bounded smoke observation rather than complete live coverage.
- Evidence still pending: no complete operation matrix, self-hosted Novu check, provider delivery observation, or Creator Portal inspection is claimed for this refactor. The packed artifact was installed and its compiled registration loaded in isolation, but that package-level smoke does not extend the limited editor/API evidence beyond the actions the owner reported.

## 0.1.1 release preparation

- Status: release-preparation [PR #16](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/16) merged at `dbb30f2`; Node 22 and Node 24 checks green; separate immutable tag/publication authorization pending
- Base: synchronized `main` merge `4003050`
- Package: prepared as `@blackswampai/n8n-nodes-novu@0.1.1`; no dependency or runtime-contract change
- Scope: packages the declarative-first refactor, standard declarative continuation/error behavior for 18 ordinary operations, the unchanged custom Trigger Workflow retry path, and the hardened declarative/custom-operation load smoke.
- Authentication: prerequisites closed on September 9, 2026. The owner confirmed npm Trusted Publishing for owner `BlackSwampAI`, repository `n8n-nodes-novu`, workflow `publish.yml`, no environment, with direct npm publish allowed, and confirmed revocation of the temporary 0.1.0 token. The GitHub `NPM_TOKEN` secret was independently verified absent. Local npm is unauthenticated and could not independently query the trust configuration, so the configuration evidence is explicitly owner-confirmed rather than tool-observed.
- Local deterministic evidence: frozen `npm ci` installed 734 packages; format check, official n8n lint, strict production/test typecheck, 181 Vitest tests across 14 files, build, official source scan, release audit, package boundary (54 files, 38,306 packed bytes, 196,136 unpacked bytes), workspace load of exactly 1 node and 1 credential, isolated packed-package install/load outside the managed sandbox with exactly 1 node and 1 credential, and `git diff --check` passed. The separate skill release audit was rerun outside the sandbox and passed with 0 warnings; no local `v0.1.1` tag exists. `npm ci` reported 19 audit advisories (12 moderate, 7 high) in the local development/host tooling graph; the shipped package retains zero runtime dependencies and exposes only `dist`. PR/release CI installs the pinned npm 11.19.0; no claim is made that the local validation used that npm version.
- Subsequent outcome: immutable `v0.1.1` was created at commit `06fd46c`, but GitHub Actions run `34345618333` failed during authentication preparation before npm publish. Version 0.1.1 is not available on npm; its tag must remain unchanged and unused for recovery.

## 0.1.2 OIDC release recovery

- Status: released; repository, npm, provenance, official scanner, GitHub release, and published-package load gates complete
- Recovery [PR #18](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/18) merged at `8241b1434d2098ffdf4dd3002db467496be8d8e0`. PR CI [run 34347315840](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34347315840) passed Node 22.22.0 and Node 24 with full gates; fresh main CI [run 34347704168](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34347704168) passed full gates on the exact commit.
- Root cause: actions/setup-node v6 exported its exact `XXXXX-XXXXX-XXXXX-XXXXX` sentinel, and the former helper rejected every nonempty value before the publish step.
- Recovery: package version 0.1.2 accepts only the exact setup-node sentinel (plus absent/empty token state), removes only the literal npmrc placeholder, and clears the sentinel through `GITHUB_ENV` for subsequent workflow steps. Every other nonempty token remains rejected, and there is no token fallback.
- Completed local evidence: frozen `npm ci` added 734 packages; format check, official n8n lint, strict production/test typecheck, 185 Vitest tests across 14 files, build, official source/built scan, release audit, package boundary (54 files, 38,308 packed bytes, 196,136 unpacked bytes), workspace load of exactly 1 node and 1 credential, isolated packed-package install/load outside the managed sandbox with exactly 1 node and 1 credential, and `git diff --check` passed. An independent skill audit passed with 0 warnings. Exact npm version checks returned `E404` for both 0.1.1 and 0.1.2; the remote tag query found only `v0.1.1`, with no `v0.1.2`. `npm ci` reported 19 audit advisories (12 moderate, 7 high) in the local development/host tooling graph; the shipped package retains zero runtime dependencies and exposes only `dist`.
- The annotated `v0.1.2` tag object `e18565fe5bef47ba795077063768630817c5e805` peels to `8241b1434d2098ffdf4dd3002db467496be8d8e0`; immutable `v0.1.1` remains untouched and unpublished. Local `main` was synchronized and clean at the release commit before this documentation branch.
- Publish workflow [run 34348117075](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34348117075) publish job `102455684505` passed authentication preparation and npm release. The initial verifier exhausted six bounded attempts solely on the exact “No package metadata found” propagation response. After npm metadata appeared and the official scanner passed locally, GitHub **Re-run failed jobs** reran only the verifier—not the successful publish job—and verifier job `102455684387` passed.
- Published verification reported provenance passed; source fetched from `github.com/BlackSwampAI/n8n-nodes-novu@8241b14`; package downloaded and analyzed; and the exact package passed all security checks. npm reports `@blackswampai/n8n-nodes-novu@0.1.2`, `latest=0.1.2`, the correct repository and `https://blackswampai.com/n8n-nodes/novu/` homepage, SLSA predicate `https://slsa.dev/provenance/v1`, integrity `sha512-RB/Me9+o6eB1OtAgeYWYXqL2RS3NF2UwmtY6xPxYNUAO7F+Q3eGKzDIzAWLnzG2sZb00pTNlt02q9EWlVNlWQw==`, and shasum `cd26ca3545132cba725094d5266f56f3efcabf96`.
- A fresh exact-version registry install with `--ignore-scripts --no-package-lock --omit=peer` added only one package; compiled loading registered exactly 1 node and 1 credential, and the owned temporary directory was removed. The public, non-draft, non-prerelease [GitHub release](https://github.com/BlackSwampAI/n8n-nodes-novu/releases/tag/v0.1.2) was published at `2026-09-09T12:02:00Z`.
- Evidence still pending: Creator Portal submission/card inspection remains incomplete, and n8n verification is not claimed. No new Novu live/API/editor, self-hosted, or provider-delivery evidence was collected for this release.
