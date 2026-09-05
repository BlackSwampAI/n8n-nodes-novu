# n8n-nodes-novu

An independent n8n community integration for the Novu notification platform.

This project is not affiliated with, endorsed by, sponsored by, or maintained by Novu or n8n. Product names and marks belong to their respective owners and are used only to identify compatibility. The package is an early private scaffold: it is not official, approved, verified, or ready to publish.

## Installation

Installation is intentionally unavailable while the Batch 1 scaffold remains private. A future release will follow the [n8n community-node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Compatibility

- n8n: not yet exercised; the scaffold uses n8n Nodes API version 1 and strict mode
- Novu Cloud: documented US and EU APIs reviewed on September 5, 2026; not live-tested
- Self-hosted Novu: unverified; no compatibility version is claimed
- Node.js development baseline: 22.22.0 or newer

## Credentials

The registered **Novu API** credential stores a secret API key and selects the US, EU, or a custom base URL. Novu server API authentication uses `Authorization: ApiKey <secret>`. Its scaffold credential test performs a read-only workflow-list request limited to one result. Robust custom URL validation and diagnostic error mapping are intentionally deferred to Batch 2.

## Operations

No API operation is usable in the Batch 1 scaffold. The proposed first-release operations and their documented contracts are tracked in [API coverage](https://github.com/BlackSwampAI/n8n-nodes-novu/blob/main/docs/API_COVERAGE.md). They will be implemented one reviewed batch at a time.

## Development

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run package:check
```

See [project status](https://github.com/BlackSwampAI/n8n-nodes-novu/blob/main/docs/STATUS.md), [ADR 0001](https://github.com/BlackSwampAI/n8n-nodes-novu/blob/main/docs/decisions/0001-node-architecture.md), and the [implementation gameplan](https://github.com/BlackSwampAI/n8n-nodes-novu/blob/main/docs/Novu-n8n-Codex-Gameplan.md).

## Resources

- [Novu API reference](https://docs.novu.co/api-reference)
- [n8n node development](https://docs.n8n.io/integrations/creating-nodes/)
- [n8n community-node verification](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/)

## License

[MIT](LICENSE.md)
