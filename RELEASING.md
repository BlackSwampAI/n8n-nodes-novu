# Releasing an n8n community node

This repository is private-initialization work and has no publish workflow. `private: true` is an intentional fail-closed publication guard. Never run `npm publish`, create release tags, or add publishing credentials while the package remains private.

## Current private state

The working identity is `@blackswampai/n8n-nodes-novu@0.1.0`, but it is not installable from npm. On 2026-09-06 the repository was observed public with default branch `main`, the canonical homepage returned HTTP 200, and npm returned `E404` for the package name (availability evidence, not reservation). Recheck all three at release. The package must stay private and without a publish workflow until the human release checkpoint.

## Prepublication gate

Run on the exact release commit:

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
git diff --check
```

Inspect the dry-run tarball and install it in a disposable n8n instance. Verify node/credential loading, representative operations, error handling, and triggers where present. CI must pass on Node 22.22.0 and Node 24.

## Separately reviewed release preparation

Before any tag, a dedicated release-preparation change must:

1. recheck the public repository and `https://blackswampai.com/n8n-nodes/novu/` content and links;
2. recheck scoped npm/package naming, repository links, current n8n rules, and every evidence tier;
3. unset `private: true` only at the explicit human checkpoint;
4. restore a tag-only `publish.yml` with minimal permissions and immutable version/tag checks;
5. add the current npm authentication, version, provenance, and post-publication scanner helpers;
6. keep irreversible publication in a publish job and fresh read-only registry/provenance/package scanning in a dependent verify-published job; and
7. pass the full release audit on the exact reviewed commit before creating a tag.

None of those release-only components belong in the private prerelease package.

## Future first publication only

npm requires a package to exist before Trusted Publisher configuration. For this genuinely new package, the owner plans to create a narrowly scoped, temporary granular token and store it only as the `NPM_TOKEN` Actions secret. Do not assume the secret exists or inspect secrets. After explicit user approval, tag the reviewed commit with an annotated immutable `v0.1.0` tag and let GitHub Actions publish with provenance.

Immediately after success, configure npm Trusted Publishing for the exact GitHub owner, repository, tag-only `publish.yml`, and no environment unless the workflow declares one. Delete the GitHub secret and revoke the token. Existing packages skip token bootstrap and use OIDC from the first release.

## Verify and preserve history

Verify the workflow, npm version and `latest` tag, SLSA provenance attestation, package contents/load smoke, and matching GitHub release. Never reuse an npm version or move/delete a published tag; fix forward with a new version.
