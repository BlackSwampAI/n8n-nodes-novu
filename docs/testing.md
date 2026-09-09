# Testing and evidence

The package uses a layered evidence model. Passing a lower tier never implies a higher tier passed.

## Deterministic tiers

- TypeScript Vitest tests cover helpers, real declarative routing metadata and hooks, custom-operation execution, per-item expressions, malformed inputs/responses, function paging, continuation, retry confinement, and scaffold/release invariants using documented response shapes and deterministic mocks.
- `npm run scan:source` runs the official n8n community-package scanner against both source patterns and built JavaScript/package metadata. Findings are release gates; scanner development advisories remain advisories unless the tool reports failure.
- `npm run smoke:load` loads the registered node and credential constructors from the workspace build, verifies credential references, and validates packaged SVG/PNG icon confinement and SVG viewBoxes.
- `npm run package:check` performs the public release-candidate audit and dry-run tarball allowlist check.
- `npm run scan:published` is reserved for the fresh read-only post-publication job. It requires exact official scanner success and retries only bounded, recognized registry/provenance propagation failures.
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
- Actual n8n: the owner confirmed the source-checkout gradient icon rendered correctly on the requested light/dark editor surfaces, without recording the exact n8n version or screenshots. The broader structured checklist remains open: install the packed artifact into a clean supported instance, then inspect credential conditionals, all resource/operation states, expressions, pairing, continuation, and packed light/dark icons. A constructor load or source-checkout visual is not packed-artifact evidence.
- Self-hosted Novu: requires a specifically pinned release and edition; no parity is inferred from Cloud docs.
- Delivery: inspect Novu activity/inbox or an owner-controlled test inbox. Trigger acknowledgments prove acceptance/processing only.
- Creator Portal: applies only after authorized npm publication/submission; visually verify the exact submitted version and logo independently of npm/editor state.

The owner exercised the node in a local n8n editor against Novu Cloud and reported the post-envelope-fix experience as much better and otherwise solid. The owner separately confirmed the requested source-checkout gradient icon surfaces in both themes as “perfect.” Exact versions, screenshots, packed-artifact visuals, and operation-by-operation results were not recorded; this does not satisfy the broader structured live/editor tier. No provider delivery, pinned self-hosted, or Creator Portal evidence exists. Use [the manual smoke checklist](SMOKE_TESTS.md) to close those gaps. See [project status](STATUS.md) for batch-specific evidence.

The September 9 declarative-first refactor passed formatting, official n8n lint, strict typecheck, 181 deterministic Vitest tests across 14 files, build, official source scan, workspace loading, the 54-file package boundary, and isolated packed-package install/load outside the managed sandbox. Both load smokes registered exactly 1 node and 1 credential. The owner then ran a limited actual n8n editor smoke against their Novu Cloud instance: retrieving the available objects they could exercise and creating a topic succeeded, and the owner reported that the exercised behavior appeared to work as advertised. Exact n8n/Novu versions, screenshots, and operation-by-operation results were not recorded, so this observation does not establish complete live coverage, provider delivery, self-hosted compatibility, or Creator Portal behavior.

The declarative resource suites resolve the real operation metadata and invoke its actual `preSend`, `postReceive`, and function-pagination hooks per item. They do not use removed programmatic executors. HTTP status sanitization is covered at hook level; n8n's actual routing-engine handling of status-free network failures, Continue On Fail, and its standard error-item shape remains an editor/integration evidence gap.
