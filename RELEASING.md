# Releasing an n8n community node

Releases are user-authorized and publish only from `.github/workflows/publish.yml`. Never run `npm publish` locally for an n8n release.

## Finalize the generated repository

Complete the README initialization checklist. `npm run release:check` enters template mode only when the normalized git origin is exactly this template repository. Every generated repository uses normal mode and must have final identity, no placeholders/examples, and no `private: true`.

## Prepublication gate

Run on the exact release commit:

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run package:check
git diff --check
```

Inspect the dry-run tarball and install it in a disposable n8n instance. Verify node/credential loading, representative operations, error handling, and triggers where present. CI must pass on Node 22.22.0 and Node 24.

## First publication only

npm requires a package to exist before Trusted Publisher configuration. For a genuinely new package, create a narrowly scoped, temporary granular token with publish access only to that package and store it only as the `NPM_TOKEN` Actions secret. After explicit user approval, tag the reviewed commit with an annotated immutable `v0.1.0` tag and let GitHub Actions publish with provenance.

Immediately after success, configure npm Trusted Publishing for the exact GitHub owner, repository, `publish.yml`, and no environment unless the workflow declares one. Delete the GitHub secret and revoke the token. Existing packages skip token bootstrap and use OIDC from the first release.

## Verify and preserve history

Verify the workflow, npm version and `latest` tag, SLSA provenance attestation, package contents/load smoke, and matching GitHub release. Never reuse an npm version or move/delete a published tag; fix forward with a new version.
