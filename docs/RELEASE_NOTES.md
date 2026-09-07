# Proposed release notes: 0.1.0

Initial independent n8n community-node release for Novu notification workflows.

Highlights:

- Synchronize Subscriber profiles and read/update channel preferences.
- Create and manage Topics and Topic Subscription relationships.
- Trigger an existing Novu workflow for one Subscriber or Topic and preserve Novu's processing acknowledgment.
- Search or manually enter workflow identifiers, inspect workflows, and cancel eligible pending executions.
- Use US, EU, or validated Custom API bases with secret-safe errors and no regional failover.
- Apply optional, bounded notification retries only when protected by an organization-enabled Novu Idempotency Key.

Important limitations: this package is independent and not official or verified. Trigger acknowledgment does not prove channel delivery. Broadcast, bulk APIs, workflow editing, providers, webhooks, Inbox state, agents/ACI, raw requests, and automatic legacy fallback are not included. Self-hosted compatibility is unverified. See the README and API coverage for exact behavior.

Publication remains blocked until the Batch 10 human release checkpoint removes `private: true`, restores a reviewed tag-only provenance workflow, and completes publication verification.
