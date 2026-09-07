---
name: Release 0.1.0
about: Track the first provenance-backed npm release
title: 'Release v0.1.0'
labels: release
assignees: ''
---

- [ ] Scoped npm name rechecked immediately before release; current candidate is `@blackswampai/n8n-nodes-novu`
- [ ] Public repository/default branch and canonical homepage content/links rechecked (both prerequisites were observed satisfied on 2026-09-06)
- [ ] All template placeholders and unused examples removed
- [ ] README installation, compatibility, credentials, operations, and license sections complete
- [ ] `npm ci`, format check, lint, strict production/test typecheck, Vitest, build, release audit, and dry-run package checks pass
- [ ] Packed artifact installs or loads successfully in a disposable n8n instance
- [x] Release-prep change removes `private: true` for human review
- [x] Tag-only `publish.yml` added with minimal permissions and current auth/version/provenance helpers
- [x] Publication and fresh read-only published-package/provenance/scanner verification are separate dependent jobs
- [ ] Full release audit passes on the exact reviewed commit before tagging
- [x] Owner confirms the temporary granular npm token exists as GitHub Actions secret `NPM_TOKEN`; never inspect or expose it
- [ ] Release commit is on `main` and CI is green
- [ ] User explicitly authorizes release and annotated immutable `v0.1.0` tag points to the reviewed release commit
- [ ] Publish workflow succeeds
- [ ] npm `latest` is `0.1.0` and SLSA provenance is present
- [ ] GitHub release exists
- [ ] npm Trusted Publisher configured for owner `BlackSwampAI`, repository `n8n-nodes-novu`, workflow `publish.yml`, no environment
- [ ] `NPM_TOKEN` secret deleted and temporary npm token revoked
- [ ] Creator Portal submitted for exact version and card version/logo inspected
