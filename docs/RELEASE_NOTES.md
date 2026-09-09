# Release notes: 0.1.2

This recovery release delivers the declarative-first n8n architecture intended for 0.1.1 without changing public parameters, successful output shapes, or Novu request contracts. The immutable `v0.1.1` tag exists, but its GitHub Actions run failed during authentication preparation before npm publication; version 0.1.1 is not available on npm and the tag will not be altered or reused.

Highlights:

- Route all 18 ordinary operations through n8n declarative requests, focused validation/mapping hooks, and endpoint-specific pagination.
- Keep Trigger Workflow as the sole custom operation so its opt-in, idempotency-protected retry policy remains unchanged and confined.
- Use n8n's standard declarative continuation and error handling for ordinary operations.
- Recognize declarative-only and custom-operation node architectures in workspace and packed-package load smoke tests.
- Accept only actions/setup-node v6's exact authentication sentinel during OIDC preparation, remove only its literal npmrc placeholder, and clear the sentinel for the publish step; all real token values remain rejected.

Important limitations: this package is independent and not official or verified. Trigger acknowledgment does not prove channel delivery. Broadcast, bulk APIs, workflow editing, providers, webhooks, Inbox state, agents/ACI, raw requests, and automatic legacy fallback are not included. Self-hosted compatibility is unverified. See the README and API coverage for exact behavior.

Observed live coverage remains limited: the owner retrieved available objects and created a topic in an actual editor against Novu Cloud, but exact versions and operation-by-operation evidence were not recorded. Version 0.1.2 was published through npm Trusted Publishing with provenance, passed the official published-package scanner, and loaded successfully from a fresh exact-version registry install. Creator Portal submission/card inspection remains pending; this package is not described as n8n verified.
