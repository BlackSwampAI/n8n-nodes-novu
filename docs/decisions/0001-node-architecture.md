# ADR 0001: Novu node architecture

- Status: Accepted for Batch 1
- Date: September 5, 2026

## Decision

Use the repository's current `@n8n/node-cli` TypeScript scaffold and one regular programmatic Novu action node. Organize later descriptions and request construction by resource, using small shared helpers only for URL validation, transport, JSON input, response mapping, and endpoint-specific pagination.

Keep `n8n-workflow` host-provided and add no runtime dependencies. Use n8n's authenticated request helpers instead of the Novu SDK, Axios, or a retry package.

Store only the API origin plus optional reverse-proxy prefix in credentials. Each operation supplies its documented `/v1` or `/v2` route; there is no package-wide API version and no regional failover.

The Batch 1 node advertises no operation and fails clearly if executed. Resources become visible only in their implementation batch.

Defer a dedicated n8n trigger node for Novu outbound webhooks. It requires paid-plan test access, signature/raw-body/replay validation, delivery lifecycle design, and verified endpoint-registration behavior. Also defer raw-request escape hatches and legacy API fallback.

## Rationale

The API is mostly request/response oriented, but item linkage, PATCH omission, heterogeneous envelopes, endpoint-specific pagination, partial topic-subscription results, and guarded retries require narrow programmatic control. A small node built on n8n primitives preserves those semantics without introducing a custom framework or prohibited runtime dependency.

## Sources

- [n8n node file structure](https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/structure/)
- [n8n verification guidelines](https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/)
- [n8n community-node submission](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/)
- [Novu API overview](https://docs.novu.co/api-reference)
- [Novu webhooks](https://docs.novu.co/platform/integrations/webhooks)
