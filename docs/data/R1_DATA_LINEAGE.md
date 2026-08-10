# R1 Data Lineage — source → canonical → analytics → UI

Статус: нормативный public-safe lineage map для R1.  
Machine documentation map: `lib/documentation/r1_documentation.v1.json` (`PRH_R1_DOCUMENTATION_V1@1.0.0`).  
Roadmap: `DOC-010`.

## 1. Основной read lineage

```text
Private Google Sheets operations
    |
    | GoogleTransactionRepositoryGateway.js
    | bounded platform reads
    v
Google Sheets transaction adapter
    | lib/adapters/google_sheets_transaction_repository.js
    | versioned mapping
    v
PRH_TRANSACTION_REPOSITORY_V1
    |
    v
PRH_CANONICAL_TRANSACTION_V1
    |
    +-----------------------> FIN-TRUTH-v1 / PRH_KPI_DICTIONARY_V1
    |                                |
    |                                v
    +-----------------------> PRH_ANALYTICS_CONTRACT_V1
                                      |
                                      v
                              AnalyticsResult + provenance
                                      |
                                      v
                           private Web Dashboard / view adapters
```

Financial truth originates from canonical transactions + KPI Dictionary. Storage, cache, aggregates and UI are downstream consumers.

## 2. Source / adapter layer

Current source is private Google Sheets. Platform paths:

- `GoogleTransactionRepositoryGateway.js` — Apps Script read boundary;
- `lib/adapters/google_sheets_operations_mapping.v1.json` — current sheet → canonical mapping policy;
- `lib/adapters/google_sheets_transaction_repository.js` — adapter implementation;
- `lib/adapters/google_sheets_projection.v1.json` / `google_sheets_projection.js` — PERF-010 projected-read plan.

Human contracts:

- `docs/architecture/TRANSACTION_REPOSITORY_PORT.md`;
- `docs/operations/PERF010_QUERY_PROJECTION.md`.

Tests/checks:

- `tests/repository_adapter_contract_test.js` → `Transaction repository adapter`;
- `tests/repository_projection_adapter_contract_test.js` → `Query projection minimal ranges`.

Google row/column position is adapter/provenance state. It never defines logical transaction identity or KPI semantics. Generic Google canonical write remains blocked with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## 3. Canonical transaction layer

Machine schema: `lib/domain/canonical_transaction.v1.schema.json` (`PRH_CANONICAL_TRANSACTION_V1`).  
Validator: `lib/domain/canonical_transaction.js`.  
Human contract: `docs/data/CANONICAL_TRANSACTION_SCHEMA.md`.  
Test/check: `tests/canonical_transaction_schema_contract_test.js` → `Canonical transaction schema`.

Canonical layer normalizes transaction identity, event time, type/status, exact integer minor units/currency, household dimensions and provenance. Unknown or invalid shape fails closed.

## 4. Financial truth layer

Machine contract: `lib/finance/kpi_dictionary.v1.json` (`PRH_KPI_DICTIONARY_V1`, `FIN-TRUTH-v1`).  
Evaluator: `lib/finance/kpi_dictionary.js`.  
Human contract: `docs/finance/KPI_DICTIONARY.md`.  
Tests/checks:

- `tests/kpi_dictionary_contract_test.js` → `KPI Dictionary`;
- `tests/financial_reconciliation_contract_test.js` → `Financial reconcile synthetic`.

This layer owns Income/Expense/Cash Flow/Savings/Budget/Refund/Transfer semantics. No downstream layer may introduce alternative formulas.

## 5. Analytics layer

Machine contract: `lib/analytics/analytics_contract.v1.json` (`PRH_ANALYTICS_CONTRACT_V1@1.0.0`).  
Engine: `lib/analytics/analytics_engine.js`.  
Human contract: `docs/analytics/ANALYTICS_EXTENSION_CONTRACT.md`.  
Tests/check: `tests/analytics_extension_contract_test.js`, `tests/analytics_query_edge_contract_test.js` → `Analytics extension contract`.

`AnalyticsQuery` selects canonical data; supported measures delegate to FIN-010. `AnalyticsResult.provenance` binds analytics contract, canonical/KPI/FIN versions and exact input revision.

## 6. R1 performance lineage

Performance layers change **where/how often data is read or recomputed**, not what money means.

### PERF-010 — projection

`PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` narrows physical Google ranges/rows. It is upstream of canonical mapping and preserves repository query parity.

### PERF-011 — revision-aware cache

`PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0` may reuse independent read/query results only after exact revision confirmation. Stale/unknown revision fails closed.

### PERF-012 — single-scan refresh

`PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` materializes one immutable canonical snapshot for one bounded linked refresh cycle. Query/analytics consumers reuse that snapshot; cross-cycle reuse is forbidden.

### PERF-013 — incremental aggregates

`PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0` materializes MONTH/CATEGORY_ID/ACCOUNT_ID buckets. A hash-bound exact-revision state and deterministic ADDED/REMOVED/CHANGED delta select affected buckets; every bucket is still recomputed through FIN-010.

### PERF-014 — scale gate

`PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0` is CI evidence over independently generated 20k/50k synthetic canonical operations. It measures revision/analytics/single-scan/full+incremental aggregate paths and enforces read=1/write=0 for the linked refresh benchmark. Timings are CI guardrails, not production SLA.

Named checks are respectively:

- `Query projection minimal ranges`;
- `Revision-aware read cache`;
- `Single-scan refresh pipeline`;
- `Incremental analytics aggregates`;
- `Synthetic scale performance`.

## 7. Migration lineage — historical private write path

```text
legacy source snapshot
  -> deterministic migration plan
  -> owner-private exact execution package
  -> IRREVERSIBLE_ACTION_AUTHORIZED
  -> hidden staging + readback
  -> FINALIZED_PENDING_RECONCILIATION
  -> fresh encrypted backup
  -> post-write reconciliation
  -> OWNER_VERIFIED / DONE
```

Contracts/runbooks:

- `lib/migration/full_history_migration.v1.json` (`PRH_FULL_HISTORY_MIGRATION_V1@1.0.0`);
- `lib/migration/mig010_execution_policy.v1.json` (`MIG010_EXECUTION_POLICY_V1@1.0.0`);
- `docs/operations/MIG010_FULL_HISTORY_MIGRATION.md`;
- `docs/operations/MIG010_AUTHORIZED_EXECUTION.md`.

Owner-confirmed identical occurrences use `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical authorization is not reusable and does not change generic repository write policy.

## 8. Recovery lineage

DR-001 canonical/private backup path is owner-local and encrypted before disk persistence. Human runbook: `docs/operations/DR001_DIRECT_OWNER_BACKUP.md`.

Backup bytes/key/OAuth and restored private datasets are never public CI evidence. Restore drill proves recoverability but does not become financial truth.

## 9. Observability lineage

OBS-001/OBS-010 receive only technical allowlisted metadata.  
Machine SLO contract: `lib/observability/slo_error_budget.v1.json` (`PRH_SLO_ERROR_BUDGET_V1@1.0.0`).  
Human contracts: `docs/operations/OBS001_AUDIT_TELEMETRY.md`, `docs/operations/OBS010_SLO_ERROR_BUDGET.md`.  
Test/check: `tests/slo_error_budget_policy_contract_test.js` → `SLO error budget`.

Raw canonical rows, amounts, descriptions, private aggregates and query payload are not telemetry.

## 10. Delivery lineage

Source changes are linked to an exact candidate SHA:

```text
Roadmap Issue
-> branch/PR
-> PR Validation
-> immutable candidate artifact
-> Trusted DEV Deploy
-> authenticated Trusted Runtime Health
-> autonomous squash merge
-> Main Verification
-> Issue DONE
```

Normative runbook: `docs/RELEASE_PROCESS.md`. A successful deployment proves code/runtime identity, not authorization to mutate private finance data.

## 11. Lineage invariants

1. Canonical transaction + KPI Dictionary are upstream of analytics, caches, aggregates and UI.
2. Every derived result has reconstructable contract/revision provenance.
3. Performance optimization never changes financial formulas or grants writes.
4. Private real/derived financial payload never becomes public fixture/evidence.
5. Generic Google financial write remains fail-closed.
6. MIG-010 owner authorization is historical, exact-bound and non-reusable.
7. `FREE_ONLY` remains mandatory across all current R1 paths.
8. A human document can describe machine truth but cannot override a failing machine gate.
