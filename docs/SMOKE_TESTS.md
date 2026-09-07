# Manual release-candidate smoke tests

Run this checklist only in an owner-controlled Novu Cloud development environment and a disposable supported n8n instance. Record exact n8n, package, Novu environment/edition, date, operator, and sanitized evidence. Never use production data. Prefix created IDs `bsa-novu-test-<runId>-`; inventory exact objects and delete only those objects.

## Setup and presentation

- [x] Pre-release source-checkout icon review: after running `npm run dev` and the requested local n8n visual check, the owner reported the official gradient icon was “perfect” and authorized moving on. This confirms the requested node picker, canvas, node panel, and credential-form surfaces in light and dark themes. Exact n8n version and screenshots were not recorded; restart the development server after future icon changes and hard refresh if cached.
- [ ] For final package evidence, install the packed tarball rather than relying on the source checkout; confirm one Novu node and one Novu API credential register. Repeat the icon checks against this installed artifact.
- [ ] Confirm US, EU, and Custom credential conditionals. Use only the owned environment's actual region. Confirm wrong-region authentication produces useful guidance without exposing the key.
- [ ] Exercise the read-only credential test. Confirm an empty workflow list is valid and manual workflow entry remains available if list access is denied.
- [ ] Inspect all resource/operation conditional fields, blank-state messages, JSON expressions, From List and By ID workflow locators.

## Data and execution

- [ ] Import both files from `examples/`; attach the test credential after import and replace every example ID before execution.
- [ ] Run Subscriber Create or Update/Get/Get Many/Update/Delete with two input items; verify expressions, one output per resource, pairing, exact list limit, empty list, and Continue On Fail. **Destructive:** Delete only run-prefixed subscribers.
- [ ] Run Topic Create/Get/Get Many/Update/Delete; verify custom `data`, pagination, and encoded keys. **Destructive:** Topic Delete also removes subscriptions.
- [ ] Create two topic relationships, list them, then delete one by relationship identifier. Confirm partial-result envelopes remain honest. **Destructive:** subscriber-only deletion removes all that subscriber's relationships in the topic.
- [ ] Read preferences, change one non-critical channel, read back, then restore the captured original value. Do not assume the change affects queued work.
- [ ] Trigger a development workflow with a stable run-specific idempotency key. Inspect the acknowledgment and Novu activity separately. **Provider-cost/side effect:** start with in-app or an owner-controlled test inbox; an acknowledgment is not delivery.
- [ ] Trigger a workflow with a deliberate delay/digest and cancel its transaction while eligible. **Side effect:** cancellation cannot recall delivered messages.
- [ ] Verify Topic trigger fan-out using only test subscribers. **Provider-cost:** fan-out may create multiple provider sends.

## Cleanup and evidence

- [ ] Restore preferences before deleting resources. Remove exact relationship identifiers, then exact run-prefixed topics and subscribers. Never use bulk/delete-all cleanup.
- [ ] Verify each exact created identifier is absent. Preserve sanitized request/result notes; never save API keys, real addresses, raw production payloads, or unsanitized screenshots.
- [ ] Record skipped operations and why. Do not summarize partial coverage as full live compatibility.

Self-hosted Novu requires a separate pinned-version run. Creator Portal logo/version inspection occurs only after authorized publication and submission.
