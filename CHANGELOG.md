# Changelog

## Unreleased

## 0.1.1 - 2026-09-09

- Refactor 18 ordinary operations to n8n declarative routing while keeping public parameters, API requests, and successful output contracts unchanged.
- Keep Trigger Workflow as the sole custom operation so its bounded, idempotency-protected retry policy remains isolated.
- Adopt n8n's standard declarative continuation and error behavior for ordinary operations.
- Harden compiled package loading for declarative and operation-specific custom node architectures.

## 0.1.0 - 2026-09-06

- Establish the private Batch 1 Novu package scaffold, API contract inventory, and architecture record.
- Add the Batch 2 credential and shared transport foundation.
- Add the Batch 3 Subscriber lifecycle operations with explicit partial updates and cursor pagination.
- Add the Batch 4 Trigger Workflow notification action and opt-in idempotency-protected retries.
- Add Batch 5 global and workflow-specific Subscriber Preference Get and Update operations.
- Add Batch 6 Topic lifecycle operations with flat custom data and forward cursor pagination.
- Add Batch 7 Topic Subscription lifecycle operations and Topic workflow recipients.
- Add Batch 8 Workflow discovery, searchable/manual workflow selection, and pending execution cancellation.
- Correct ordinary Novu raw HTTP response-envelope handling while preserving direct list/subscription envelopes.
- Add Batch 9 release-candidate documentation, sanitized workflows, manual smoke/submission checklists, and the immutable official gradient icon.
