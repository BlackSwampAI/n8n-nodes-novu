# @blackswampai/n8n-nodes-novu

An independent n8n community integration for the Novu notification platform.

This project is not affiliated with, endorsed by, sponsored by, or maintained by Novu or n8n. Product names and marks belong to their respective owners and are used only to identify compatibility. The package is not official, approved, or verified by n8n or Novu.

## Installation

This is an unverified community package for self-hosted n8n. In n8n, open **Settings → Community Nodes**, select **Install**, enter `@blackswampai/n8n-nodes-novu`, accept the community-node risk prompt, and install. See n8n's [manual Community Nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation/). It is not available through verified-node discovery unless n8n later approves it.

## Compatibility

- n8n and Novu Cloud: the owner exercised the node in a local n8n editor against Novu Cloud. Exact versions and operation-by-operation evidence were not recorded, so this is limited smoke evidence rather than a compatibility claim.
- Self-hosted Novu: unverified; no compatibility version is claimed
- Node.js development baseline: 22.22.0 or newer

## Credentials

The registered **Novu API** credential stores a secret API key and selects US (`https://api.novu.co`), EU (`https://eu.api.novu.co`), or a custom base URL. Novu server API authentication uses `Authorization: ApiKey <secret>` and never fails over between regions.

A custom base URL must use HTTPS. It may contain a reverse-proxy path prefix; surrounding whitespace and trailing slashes are normalized. User information, query strings, fragments, malformed URLs, and paths ending in `/v1` or `/v2` are rejected. API versions belong to individual operation routes, which prevents doubled versions. There is no option to disable TLS verification.

The credential test performs `GET /v2/workflows?limit=1`, requiring no subscriber or mutation. It maps 401, 403, 404, and 429 responses to setup guidance. n8n's declarative credential-test mechanism handles connection/DNS/TLS failures with its standard network error rather than this node's richer execution-time mapping; no live credential test has been run for this scaffold.

## Operations

The Subscriber resource implements:

- Create or Update, with optional strict duplicate rejection
- Get by external subscriber ID
- Get Many with filters, limits, and forward cursor pagination
- Update selected fields or explicitly clear them to null
- Delete

Common profile fields are typed inputs; Custom Data accepts an expression-capable JSON object or null. Update sends selected fields only. List results retain input-item linkage and empty lists emit no fabricated item.

The Subscriber Preference resource gets the full global/workflow preference envelope and updates global or workflow-specific channel settings. Email, SMS, in-app, push, chat, and tool each use Unchanged/Enabled/Disabled controls, so PATCH requests omit unrelated settings and preserve `false`. Workflow references may be a Novu internal `_id`, identifier, or slug. Get supports documented criticality and context-key filters. Schedule and context mutation remain deferred, and changing a preference is not claimed to cancel already queued work.

The Topic resource implements Create or Update, Get, Get Many, Update, and Delete. Topic keys remain distinct from internal IDs and are encoded in paths. Create accepts an optional display name and flat custom-data object or null; strict creation is optional. Get Many uses forward `after` pagination with Novu's documented maximum of 100 per request, without exposing raw cursors or `includeCursor`. Delete returns only the targeted key and Novu's actual acknowledgment; deleting a topic irreversibly removes its subscriptions.

Topic Subscription implements Create, Get Many, and Delete using Novu's current `subscriptions` array. Create may cause Novu to create a missing topic. Mutation responses preserve partial-result `data`, `meta`, and `errors` instead of claiming all entries succeeded. Subscriber-only deletion removes every relationship for that subscriber in the topic; relationship identifiers can target narrower removals. Context-scoped relationships and per-subscription preferences remain deferred.

Trigger Workflow supports either one subscriber or one Topic recipient. Topic mode sends `{ "type": "Topic", "topicKey": "..." }` and lets Novu perform fan-out; it does not loop through members or broadcast globally. Fan-out may affect provider usage and billing. The response remains acceptance/processing evidence, not delivery proof.

The Notification resource implements **Trigger Workflow** for one subscriber or one Topic per input item. It sends the workflow identifier as REST field `name`, the selected recipient as `to`, and an object payload. The full Novu acknowledgment is preserved, including its transaction ID when returned. An acknowledgment means Novu accepted or reported processing of the request; it does not prove email, SMS, push, or in-app delivery.

Workflow identifiers can be searched and paginated From List or entered manually By ID; list permissions never make manual entry a prerequisite. The Workflow resource implements Get and Get Many, returns full workflow objects, and keeps public `workflowId` distinct from internal `_id`. Workflow lists use their endpoint-specific offset/limit pagination.

Notification also implements **Cancel Execution** by transaction ID. It reports Novu's actual boolean result and can cancel only eligible active or pending work such as delays or digests. It cannot recall messages already delivered.

Transaction ID and Idempotency Key are separate optional inputs. Transaction ID supports tracing and later cancellation but is not API-boundary deduplication. When enabled for the Novu organization, Idempotency Key caches a request result for a finite 24-hour window. The opt-in retry control requires that key and makes no more than three total attempts for HTTP 408, 409 in-progress, 429, 500/502/503/504, or status-free network/timeout failures. Numeric `Retry-After` values are respected up to 30 seconds; longer values surface an error rather than waiting less than Novu requested. Without `Retry-After`, delays are one then two seconds. Do not combine this policy with n8n node-level retries.

Get Many uses Novu's forward cursor pagination. Novu documents a minimum cursor-list limit of 1 and a maximum of 100, using `/v2/subscribers` as its pagination example; the node requests at most that documented maximum, detects repeated/malformed cursors, and enforces the requested total limit exactly. No automatic retries are performed. Subscriber behavior is contract-tested with mocks. The owner reported broader post-envelope-fix smoke behavior as solid, but exact operation coverage and versions were not recorded.

Shared requests use n8n's authenticated HTTP helper, URL-encode every path segment, and map 401, 403, 404, 429 (including `Retry-After` when present), and network failures without copying upstream bodies or secrets into messages. Subscriber calls remain no-retry; only Trigger Workflow can opt into the bounded idempotency-protected policy described above.

## Development

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run scan:source
npm run package:check
npm run smoke:load
npm run smoke:install
```

See [project status](https://github.com/BlackSwampAI/n8n-nodes-novu/blob/main/docs/STATUS.md), [ADR 0001](https://github.com/BlackSwampAI/n8n-nodes-novu/blob/main/docs/decisions/0001-node-architecture.md), and the [implementation gameplan](https://github.com/BlackSwampAI/n8n-nodes-novu/blob/main/docs/Novu-n8n-Codex-Gameplan.md).

## Examples

- [Customer onboarding](examples/customer-onboarding.json) creates or updates a sanitized example Subscriber, then triggers a manually identified onboarding workflow.
- [Topic opt-in/out](examples/topic-opt-in-out.json) creates a test Topic and relationship; the destructive opt-out node is disabled by default.

After import, select your Novu API credential, replace every `bsa-example-*` value with owned test identifiers, and replace `replace-with-workflow-id` with an active development workflow identifier before executing. The examples contain no credential, secret, real customer data, or dependency on another community package. See the [manual smoke checklist](docs/SMOKE_TESTS.md) before live execution.

## Troubleshooting

- **Authentication fails:** confirm the API key, environment permissions, and US/EU region. The node never fails over regions. A custom reverse-proxy URL must be HTTPS and must not end in `/v1` or `/v2`.
- **Workflow trigger succeeds but no message arrives:** the returned acknowledgment is acceptance/processing evidence, not delivery. Inspect the workflow's active state, steps, Novu activity, subscriber preferences, and provider/test inbox.
- **Topic results differ from subscriber count:** Novu performs topic fan-out, and a subscriber may have multiple relationships. Partial subscription mutation details remain in `meta` and `errors`.
- **Retry is unavailable or rejected:** the bounded trigger retry requires a nonempty Idempotency Key and organization-level Novu idempotency support. Do not stack it with n8n node retries.
- **Installation fails:** confirm this is a self-hosted n8n instance with Community Nodes enabled, enter the exact scoped package name, and inspect the n8n logs. This package is not available through verified-node discovery unless n8n approves it.

See the [changelog](CHANGELOG.md), [operation matrix](docs/api-matrix.md), and [testing evidence guide](docs/testing.md) when diagnosing version or contract behavior.

## Resources

- [Novu API reference](https://docs.novu.co/api-reference)
- [n8n node development](https://docs.n8n.io/connect/create-nodes/)
- [n8n community-node verification](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/)
- [Brand provenance](docs/branding.md)
- [Proposed release notes](docs/RELEASE_NOTES.md)
- [Submission checklist](docs/SUBMISSION_CHECKLIST.md)

## License

[MIT](LICENSE.md)
