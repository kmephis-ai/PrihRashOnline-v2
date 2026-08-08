# OBS-001 — privacy-safe audit/telemetry baseline

Roadmap item: `OBS-001`  
Cost class: `FREE_ONLY`  
Data class: private technical metadata only

## Purpose

The runtime audit journal is an observability aid, not part of financial transaction correctness. A correct financial operation must not become an outage only because the audit journal is full or audit persistence is temporarily unavailable.

## Bounded retention

`13 Журнал` remains bounded by `PR_CONFIG.MAX_AUDIT_ROWS` (1000 data rows). When the journal reaches the bound, the runtime removes the oldest 250 data rows and preserves the header and the newest events. Physical grid capacity is restored after deletion so the next write can proceed without manual sheet maintenance.

The warning threshold is 800 data rows. At or above that level the health state is `WARN / AUDIT_CAPACITY_WARNING`. Rotation drops the retained set below the warning threshold, allowing health to recover to `PASS / OK` after a successful write.

## Failure isolation

`appendAudit_` sanitizes the event first, then attempts bounded persistence under the document lock. Audit/storage/lock failures are classified into bounded technical reason codes and return an empty audit event ID instead of propagating the audit failure into the financial operation.

This is intentional: audit correctness and financial transaction correctness are separate failure domains. Callers that require a persisted audit event for a non-financial administrative workflow may inspect the returned event ID or the health snapshot explicitly.

## Privacy-safe health state

A minimal audit health signal is stored in Apps Script Script Properties. It contains technical metadata only:

- status and bounded reason code;
- cumulative and consecutive audit failure counters;
- current journal capacity percent;
- last rotation row count;
- last success/failure timestamps.

No transaction rows, amounts, descriptions, categories, accounts, merchants, formulas, raw payloads or authenticated HTML are stored in this health state.

`SecurityPrivacyPolicy.js` remains the authoritative allowlist for audit/telemetry metadata. OBS-001 only adds the audit health counters/capacity fields to that existing allowlist; forbidden financial field rules are unchanged.

## Technical telemetry baseline

The existing allowlist continues to support build/schema/dataset revision, action/success/error class, latency, cache state, rows examined/written, quota/resource class, backup age, reconciliation/runtime-health status and technical reason/status fields. These are observability metadata, not financial facts.

## Cost and external services

OBS-001 adds no external telemetry provider, paid API, database or monitoring SaaS. It uses the existing private audit sheet plus Apps Script Script Properties and therefore remains within the project `FREE_ONLY` policy.

## Rollback

Revert the OBS-001 PR. The change does not modify `01 Операции`, KPI semantics, migration provenance or financial values. Existing audit rows remain ordinary technical audit history; no data migration is required.
