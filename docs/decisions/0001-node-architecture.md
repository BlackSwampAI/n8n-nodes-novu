# ADR 0001: Novu node architecture

- Status: Amended September 9, 2026
- Date: September 5, 2026

## Decision

Use the repository's current `@n8n/node-cli` TypeScript scaffold and one regular declarative-first Novu action node. All 18 ordinary operations route through `routing.request`, focused `preSend` request construction/validation, `postReceive` response validation/mapping, and n8n function pagination for cursor or offset lists. Notification → Trigger Workflow alone uses `INodeType.customOperations` because its opt-in idempotent retry contract requires operation-specific control. The node has no node-wide `execute()` method.

Keep `n8n-workflow` host-provided and add no runtime dependencies. Use n8n's authenticated request helpers instead of the Novu SDK, Axios, or a retry package.

Store only the API origin plus optional reverse-proxy prefix in credentials. Each operation supplies its documented `/v1` or `/v2` route; there is no package-wide API version and no regional failover.

Credential authentication continues to select and validate the US, EU, or custom base URL. Declarative operations own explicit relative `/v1` or `/v2` routes, while the custom trigger continues through the authenticated transport and its retry-safety invariant.

Defer a dedicated n8n trigger node for Novu outbound webhooks. It requires paid-plan test access, signature/raw-body/replay validation, delivery lifecycle design, and verified endpoint-registration behavior. Also defer raw-request escape hatches and legacy API fallback.

## Rationale

The API is mostly request/response oriented, so n8n's declarative engine can own ordinary per-item execution, pairing, and continuation. Focused hooks retain PATCH omission, heterogeneous envelopes, endpoint-specific pagination, partial topic-subscription results, and honest mutation outputs. Trigger retry behavior remains isolated behind `customOperations`; no unrelated framework or prohibited runtime dependency is introduced.

## Sources

- [n8n node file structure](https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/structure/)
- [n8n verification guidelines](https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/)
- [n8n community-node submission](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/)
- [Novu API overview](https://docs.novu.co/api-reference)
- [Novu webhooks](https://docs.novu.co/platform/integrations/webhooks)
