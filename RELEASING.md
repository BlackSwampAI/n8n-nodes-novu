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

This existing package publishes through npm Trusted Publishing only. The GitHub `NPM_TOKEN` secret was independently verified absent on September 9, 2026. The workflow contains no token fallback or token injection. Its authentication helper fails closed if a genuine, non-sentinel `NODE_AUTH_TOKEN` appears and otherwise removes only setup-node's literal empty token placeholder; it never broadly deletes npm configuration.

Exception: actions/setup-node v6 exports the exact sentinel `XXXXX-XXXXX-XXXXX-XXXXX` when `registry-url` is configured. The helper accepts only that sentinel, removes only the literal npmrc placeholder, and appends an empty `NODE_AUTH_TOKEN` assignment to `GITHUB_ENV` for subsequent steps. Any other nonempty token remains a hard failure.

On September 9, 2026, the owner confirmed npm Trusted Publishing is configured for:

- owner `BlackSwampAI`
- repository `n8n-nodes-novu`
- workflow `publish.yml`
- no GitHub Environment
- direct npm publish allowed

Local npm is unauthenticated and could not independently query this trust configuration; this is owner-confirmed evidence. The owner also confirmed that the temporary granular token used for 0.1.0 has been revoked, and the GitHub `NPM_TOKEN` secret was independently verified absent. Authentication prerequisites are therefore closed. Never print, inspect, or store credentials. Immutable tagging and publication still require separate post-merge human authorization.

The immutable `v0.1.1` tag at commit `06fd46c` must not be changed, deleted, or reused. Workflow run `34345618333` failed in Prepare npm authentication before npm publish because the setup-node sentinel was rejected; npm version 0.1.1 was never published. Recovery proceeds only as version 0.1.2 with its own reviewed commit and tag.

Recovery 0.1.2 completed through the reviewed commit `8241b1434d2098ffdf4dd3002db467496be8d8e0` and immutable annotated tag. Publish workflow run `34348117075` published once through OIDC. Its first verifier exhausted bounded registry-propagation attempts; after metadata appeared, **Re-run failed jobs** reran only the verifier, which passed. This is the required pattern when publication has already succeeded; never rerun the successful publish job.

## Publish and verify

The `publish` job runs all deterministic/package gates, prepares authentication, and invokes `npm run release` with provenance. The fresh dependent `verify-published` job is read-only and runs the official scanner against the exact published package/version. Only the publish job receives `id-token: write`.

If publication succeeded but propagation delayed verification, use **Re-run failed jobs** so only the verifier reruns. Never rerun a successful immutable publish job. Require npm version/latest, SLSA provenance, exact scanner success, tarball contents/load, tag CI, and the GitHub release before calling the release complete.

Creator Portal submission is a separate human gate. Record the exact submitted version and visually inspect the Portal card version/logo independently of source, packed, npm, and editor presentation.
