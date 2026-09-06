# Testing and evidence

The package uses a layered evidence model. Passing a lower tier never implies a higher tier passed.

## Deterministic tiers

- TypeScript Vitest tests cover helpers, metadata, per-item execution, malformed inputs/responses, paging, continuation, retry confinement, and scaffold/release invariants using documented response shapes and deterministic mocks.
- `npm run scan:source` runs the official n8n community-package scanner against both source patterns and built JavaScript/package metadata. Findings are release gates; scanner development advisories remain advisories unless the tool reports failure.
- `npm run smoke:load` loads the registered node and credential constructors from the workspace build, verifies credential references, and validates packaged SVG/PNG icon confinement and SVG viewBoxes.
- `npm run package:check` performs the private release audit and dry-run tarball allowlist check.
- `npm run smoke:install` packs the package, installs it without lifecycle scripts, a lockfile, or peer installation in an owned temporary consumer, supplies only the development tree's host-provided `n8n-workflow` peer, and reruns the constructor/icon smoke against the installed copy.

## Exact local gate

```sh
npm ci
npm run format
npm run format:check
env -u NO_COLOR npm run lint
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

`NO_COLOR` is unset for the official CLI because its forced-color behavior otherwise conflicts with an injected environment value. Known missing upstream `n8n-workflow` sourcemap-source warnings from Vitest are non-failing development advisories, not evidence of a package defect or a live integration.

## Unexecuted tiers and guards

- Live Novu API: requires an owner-controlled development environment, explicit test credential, run-scoped subscriber/topic identifiers, exact cleanup, and low-cost test workflows. Never enable destructive tests from credential presence alone.
- Actual n8n: install the packed artifact into a clean supported instance, then inspect credential conditionals, all resource/operation states, expressions, pairing, continuation, and light/dark icons. A constructor load is not editor evidence.
- Self-hosted Novu: requires a specifically pinned release and edition; no parity is inferred from Cloud docs.
- Delivery: inspect Novu activity/inbox or an owner-controlled test inbox. Trigger acknowledgments prove acceptance/processing only.
- Creator Portal: applies only after authorized npm publication/submission; visually verify the exact submitted version and logo independently of npm/editor state.

No credentials, live API calls, provider delivery, editor session, self-hosted instance, or Portal submission have been used through Batch 7. See [project status](STATUS.md) for batch-specific evidence.
