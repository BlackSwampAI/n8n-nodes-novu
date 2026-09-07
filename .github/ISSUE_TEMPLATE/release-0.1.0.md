---
name: Release 0.1.0
about: Track the first provenance-backed npm release
title: 'Release v0.1.0'
labels: release
assignees: ''
---

- [x] Scoped npm name rechecked immediately before release; npm accepted public `@blackswampai/n8n-nodes-novu@0.1.0`
- [x] Public repository/default branch and canonical homepage content/links rechecked
- [x] All template placeholders and unused examples removed
- [x] README installation, compatibility, credentials, operations, and license sections complete
- [x] `npm ci`, format check, lint, strict production/test typecheck, Vitest, build, release audit, and dry-run package checks pass
- [x] Published registry artifact installs and loads successfully with 1 node and 1 credential
- [x] Release-prep change removes `private: true` for human review
- [x] Tag-only `publish.yml` added with minimal permissions and current auth/version/provenance helpers
- [x] Publication and fresh read-only published-package/provenance/scanner verification are separate dependent jobs
- [x] Full release audit passes on exact reviewed commit `b043909cc7cfa2faa4d8e997407032f7a8e4ea73`
- [x] Owner confirms the temporary granular npm token exists as GitHub Actions secret `NPM_TOKEN`; never inspect or expose it
- [x] Release commit is on `main`; PR checks and post-merge Node 22.22.0/24 CI are green
- [x] User explicitly authorized release; annotated immutable `v0.1.0` tag object `f92dfa7ff66f1dea56578b843787917834ff3039` peels to the reviewed release commit
- [x] Publish workflow run 34072798768 published once; after registry propagation, only the failed verifier was rerun and attempt 2 passed
- [x] npm version and `latest` are `0.1.0`; signed SLSA provenance and the official scanner passed
- [x] Public, non-draft, non-prerelease GitHub release exists at https://github.com/BlackSwampAI/n8n-nodes-novu/releases/tag/v0.1.0
- [ ] npm Trusted Publisher configured for owner `BlackSwampAI`, repository `n8n-nodes-novu`, workflow `publish.yml`, no environment
- [ ] `NPM_TOKEN` secret deleted and temporary npm token revoked
- [ ] Creator Portal submitted for exact version and card version/logo inspected
