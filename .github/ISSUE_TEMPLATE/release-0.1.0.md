---
name: Release 0.1.0
about: Track the first provenance-backed npm release
title: 'Release v0.1.0'
labels: release
assignees: ''
---

- [ ] Scoped npm name rechecked immediately before release; current candidate is `@blackswampai/n8n-nodes-novu`
- [ ] Canonical homepage `https://blackswampai.com/n8n-nodes/novu/` is provisioned and returns a successful public page (currently HTTP 404)
- [ ] All template placeholders and unused examples removed
- [ ] README installation, compatibility, credentials, operations, and license sections complete
- [ ] `npm ci`, format check, lint, strict production/test typecheck, Vitest, build, release audit, and dry-run package checks pass
- [ ] Packed artifact installs or loads successfully in a disposable n8n instance
- [ ] Separately reviewed release-prep change unsets `private: true` only after explicit human approval
- [ ] Tag-only `publish.yml` restored with minimal permissions and current auth/version/provenance helpers
- [ ] Publication and fresh read-only published-package/provenance/scanner verification are separate dependent jobs
- [ ] Full release audit passes on the exact reviewed commit before tagging
- [ ] Temporary granular npm token stored only as GitHub Actions secret `NPM_TOKEN` if first-package bootstrap requires it
- [ ] Release commit is on `main` and CI is green
- [ ] User explicitly authorizes release and annotated immutable `v0.1.0` tag points to the reviewed release commit
- [ ] Publish workflow succeeds
- [ ] npm `latest` is `0.1.0` and SLSA provenance is present
- [ ] GitHub release exists
- [ ] npm Trusted Publisher configured for the tag-only `publish.yml`
- [ ] `NPM_TOKEN` secret deleted and temporary npm token revoked
