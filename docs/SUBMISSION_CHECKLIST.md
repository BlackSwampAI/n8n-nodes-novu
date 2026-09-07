# n8n submission and first-release checklist

Checked against current n8n guidance on 2026-09-06: [node development](https://docs.n8n.io/connect/create-nodes/), [verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines/), [submit a community node](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/), and [n8n-node tool](https://docs.n8n.io/connect/create-nodes/build-your-node/using-the-n8n-node-tool/).

## Package and evidence

- [ ] Exactly one external service (Novu); English UI/documentation; MIT license.
- [ ] Public repository and npm metadata match the Black Swamp AI author/repository identity.
- [ ] No external runtime dependencies; `n8n-workflow` remains host-provided.
- [ ] Authentication, operations, limitations, examples, error behavior, pagination, idempotency, and accepted-versus-delivered semantics are documented.
- [ ] Full deterministic/build/scan/package/isolated-load gates pass on the exact release commit.
- [ ] Record exact supported n8n and Novu Cloud versions from guarded editor/API smoke; record skipped self-hosted/provider tiers.
- [x] Owner confirmed the source-checkout gradient icon on the requested local n8n editor surfaces in both themes; exact n8n version and screenshots were not recorded.
- [ ] Inspect both theme icons from the packed artifact in a clean supported n8n instance.
- [ ] Inspect the exact submitted package version/logo in Creator Portal.

## Batch 10 release transition

- [x] GitHub repository observed public on 2026-09-06 (`isPrivate: false`, default branch `main`). Recheck at release.
- [x] Canonical homepage observed HTTP 200 on 2026-09-06. Recheck content and links at release.
- [ ] Recheck npm name immediately before publishing; its 2026-09-06 `E404` is availability evidence, not reservation.
- [ ] Human approves the exact artifact, release notes, remaining limitations, and release-prep diff.
- [x] Release-preparation branch removes `private: true`, adds `scan:published`, and provides tag-only `.github/workflows/publish.yml` with minimal permissions, immutable tag/version checks, and npm provenance. Since May 1, 2026, n8n requires GitHub Actions publication with provenance.
- [x] Owner confirms the narrowly scoped temporary granular token exists only as GitHub Actions `NPM_TOKEN`; never inspect or expose it.
- [x] Publish and fresh read-only published-package/provenance scanning are separate dependent jobs.
- [ ] Full release audit and ordinary CI pass on the exact reviewed release commit before tagging.
- [ ] After explicit approval, create the immutable annotated version tag and let Actions publish. Never rerun a successful immutable publish job.
- [ ] Verify npm version/latest, provenance, tarball, install/load, GitHub release, and Creator Portal submission.
- [ ] Configure npm Trusted Publishing for owner `BlackSwampAI`, repository `n8n-nodes-novu`, workflow `publish.yml`, no environment; then delete the GitHub secret and revoke the temporary token.

Approval, publication, tagging, and Creator Portal submission are Batch 10 human-controlled actions.
