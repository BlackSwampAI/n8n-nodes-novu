# n8n submission and first-release checklist

Checked against current n8n guidance on 2026-09-06: [node development](https://docs.n8n.io/connect/create-nodes/), [verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines/), [submit a community node](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/), and [n8n-node tool](https://docs.n8n.io/connect/create-nodes/build-your-node/using-the-n8n-node-tool/).

## Package and evidence

- [x] Exactly one external service (Novu); English UI/documentation; MIT license.
- [x] Public repository and npm metadata match the Black Swamp AI author/repository identity.
- [x] No external runtime dependencies; `n8n-workflow` remains host-provided.
- [x] Authentication, operations, limitations, examples, error behavior, pagination, idempotency, and accepted-versus-delivered semantics are documented.
- [x] Full deterministic/build/scan/package/isolated-load gates pass on the exact release commit.
- [ ] Record exact supported n8n and Novu Cloud versions from guarded editor/API smoke; record skipped self-hosted/provider tiers.
- [x] Owner confirmed the source-checkout gradient icon on the requested local n8n editor surfaces in both themes; exact n8n version and screenshots were not recorded.
- [ ] Inspect both theme icons from the packed artifact in a clean supported n8n instance.
- [ ] Inspect the exact submitted package version/logo in Creator Portal.

## Release evidence and 0.1.2 recovery

- [x] GitHub repository observed public on 2026-09-06 (`isPrivate: false`, default branch `main`). Recheck at release.
- [x] Canonical homepage observed HTTP 200 on 2026-09-06. Recheck content and links at release.
- [x] Scoped npm name was rechecked and public `@blackswampai/n8n-nodes-novu@0.1.0` was accepted by npm.
- [x] Human approved the exact artifact, release notes, remaining limitations, and release-prep diff.
- [x] Release-preparation branch removes `private: true`, adds `scan:published`, and provides tag-only `.github/workflows/publish.yml` with minimal permissions, immutable tag/version checks, and npm provenance. Since May 1, 2026, n8n requires GitHub Actions publication with provenance.
- [x] The narrowly scoped temporary granular token was used only for the authorized first 0.1.0 publication; its value was never inspected or exposed.
- [x] Publish and fresh read-only published-package/provenance scanning are separate dependent jobs.
- [x] Full release audit, PR checks, and post-merge Node 22.22.0/24 CI passed on exact release commit `b043909cc7cfa2faa4d8e997407032f7a8e4ea73`.
- [x] The authorized immutable annotated `v0.1.0` tag peels to the reviewed commit; Actions published once. Only the initially failed verifier was rerun after registry metadata propagation.
- [x] Verified npm version/latest 0.1.0, signed SLSA provenance, official scanner success, published-registry install/load, and the public GitHub release.
- [x] GitHub `NPM_TOKEN` secret independently verified absent on 2026-09-09.
- [x] On 2026-09-09, the owner confirmed npm Trusted Publishing for owner `BlackSwampAI`, repository `n8n-nodes-novu`, workflow `publish.yml`, no environment, with direct npm publish allowed. Local unauthenticated npm could not independently query this configuration.
- [x] Owner confirmed revocation of the temporary token used for 0.1.0.
- [x] Preserve immutable `v0.1.1` at commit `06fd46c`; run `34345618333` failed during authentication preparation before npm publish, and npm 0.1.1 remains unpublished. Do not alter or reuse the tag.
- [x] Recovery PR #18 and fresh main CI passed full Node 22.22.0/24 gates on exact release commit `8241b1434d2098ffdf4dd3002db467496be8d8e0`.
- [x] Annotated `v0.1.2` peels to the reviewed commit; OIDC publish succeeded once, and only the failed verifier was rerun after bounded registry propagation delay.
- [x] Verified exact npm 0.1.2/latest, SLSA provenance, repository/homepage/integrity metadata, official scanner success, exact-version registry install/load, and public non-draft/non-prerelease GitHub release.
- [ ] Submit the exact intended version to Creator Portal and inspect the card version/logo; n8n verification is not yet complete.

The 0.1.0 and recovery 0.1.2 approval, tagging, and publication were completed under human authorization. The failed pre-publication 0.1.1 tag remains immutable. Creator Portal submission/card inspection remains human-only pending, and n8n verification is not claimed.
