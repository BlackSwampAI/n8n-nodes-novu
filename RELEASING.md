# Releasing an n8n community node

Release `@blackswampai/n8n-nodes-novu` only through the tag-triggered GitHub Actions workflow. Never run `npm publish` locally. npm versions and release tags are immutable; fixes ship as a new version.

## Before tagging

Confirm the public repository/default branch, canonical homepage, scoped npm name, package metadata, current n8n requirements, and every evidence tier. Run the full gate on the exact reviewed commit:

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run scan:source
npm run release:check
npm run package:check
npm run smoke:load
npm run smoke:install
git diff --check
```

Require green ordinary CI on that commit, inspect the packed artifact in a supported disposable n8n instance, and review the release notes and remaining evidence gaps. The user must explicitly authorize the release before an annotated `v<version>` tag is created and pushed.

## Trusted Publishing authentication

This existing package publishes through npm Trusted Publishing only. The GitHub `NPM_TOKEN` secret was independently verified absent on September 9, 2026. The workflow contains no token fallback or token injection. Its authentication helper fails closed if a nonempty `NODE_AUTH_TOKEN` appears and otherwise removes only setup-node's literal empty token placeholder; it never broadly deletes npm configuration.

Before authorizing a tag, the owner must confirm npm Trusted Publishing is configured for:

- owner `BlackSwampAI`
- repository `n8n-nodes-novu`
- workflow `publish.yml`
- no GitHub Environment
- direct npm publish allowed

Local npm is unauthenticated and cannot query this trust configuration, so owner confirmation is a human-only blocking gate. Revocation of the temporary 0.1.0 token remains unconfirmed and must also be closed by the owner. Never print, inspect, or store credentials.

## Publish and verify

The `publish` job runs all deterministic/package gates, prepares authentication, and invokes `npm run release` with provenance. The fresh dependent `verify-published` job is read-only and runs the official scanner against the exact published package/version. Only the publish job receives `id-token: write`.

If publication succeeded but propagation delayed verification, use **Re-run failed jobs** so only the verifier reruns. Never rerun a successful immutable publish job. Require npm version/latest, SLSA provenance, exact scanner success, tarball contents/load, tag CI, and the GitHub release before calling the release complete.

Creator Portal submission is a separate human gate. Record the exact submitted version and visually inspect the Portal card version/logo independently of source, packed, npm, and editor presentation.
