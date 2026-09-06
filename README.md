# n8n-nodes-novu

An independent n8n community integration for the Novu notification platform.

This project is not affiliated with, endorsed by, sponsored by, or maintained by Novu or n8n. Product names and marks belong to their respective owners and are used only to identify compatibility. The package is an early private scaffold: it is not official, approved, verified, or ready to publish.

## Installation

Installation is intentionally unavailable while this prerelease package remains private. A future release will follow the [n8n community-node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Compatibility

- n8n: not yet exercised in the editor; the package uses n8n Nodes API version 1 and strict mode
- Novu Cloud: documented US and EU APIs reviewed on September 5, 2026; not live-tested
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

Common profile fields are typed inputs; Custom Data accepts an expression-capable JSON object or null. Update sends selected fields only. List results retain input-item linkage and empty lists emit no fabricated item. Notification, preference, topic, subscription, and workflow operations remain unavailable until their planned batches.

Get Many uses Novu's forward cursor pagination. Novu documents a minimum cursor-list limit of 1 and a maximum of 100, using `/v2/subscribers` as its pagination example; the node requests at most that documented maximum, detects repeated/malformed cursors, and enforces the requested total limit exactly. No automatic retries are performed. All Subscriber behavior is contract-tested with mocks but has not yet been exercised against a live Novu environment.

Shared requests use n8n's authenticated HTTP helper, URL-encode every path segment, and map 401, 403, 404, 429 (including `Retry-After` when present), and network failures without copying upstream bodies or secrets into messages. The single retry-policy seam currently permits only `none`; this batch performs no automatic retries.

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
