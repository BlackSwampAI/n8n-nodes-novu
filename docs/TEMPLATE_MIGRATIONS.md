# Template migrations

This project adopts applicable safeguards from the Black Swamp AI community-node template explicitly. A marker change records reviewed adoption; it is not proof that release-only infrastructure is appropriate for a private package.

## Template 2.0.0 — PR #7 private hardening

PR [#7](https://github.com/BlackSwampAI/n8n-nodes-novu/pull/7) scoped the package as `@blackswampai/n8n-nodes-novu@0.1.0`, retained `private: true`, removed the publication workflow, pinned the development toolchain, added source/package/load checks, and preserved the immutable official Novu icon. Post-merge `main` CI [run 34025348837](https://github.com/BlackSwampAI/n8n-nodes-novu/actions/runs/34025348837) passed.

## Template 2.0.1 — Batch 7 applicable safeguards

Adopted in the Batch 7 working change:

- stronger orchestrator/builder boundaries, branch and file-allowlist checks, bounded tools, and evidence requirements;
- completed API matrix, testing guide, branding record, batch handoff, and pull-request checklist;
- constructor, credential-reference, icon, workspace-load, and isolated packed-install/load verification;
- release audits covering documentation, scoped identity, exact advertised resources, and private/no-publish state.

Intentionally deferred until a separately reviewed release-preparation change: making the canonical homepage available; removing `private: true`; restoring a tag-only `publish.yml`; adding current npm authentication, version, provenance, and post-publication scanner helpers; and splitting irreversible publish from fresh read-only published verification. Those components are inapplicable while publication is blocked.
