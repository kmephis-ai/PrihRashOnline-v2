# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Этот файл не может отменять красный gate.

## R0 — завершён

### MASTER-G0 / Truth — **complete**

`TEST-001 + SEC-001 + FIN-001 + DATA-001 + DOC-001 = DONE`.

### MASTER-G1 / Autonomous delivery + AI engineering — **complete**

`SEC-003 + CI-001 + CI-002 + CI-003 + AIENG-001 + AIENG-002 + AIENG-003 = DONE`.

### MASTER-G2 / Recoverability — **complete**

`DR-001 + OBS-001 + FINOPS-001 = DONE`.

## R1 / Canonical Financial Platform — текущая волна

- `FIN-010` Versioned KPI Dictionary — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` Canonical transaction schema v1 — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` Pure domain/application core — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` Repository interfaces + Google Sheets adapter — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` Deterministic full-history migration — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED`, fresh encrypted post-write reconciliation PASS.
- `ANL-010` Analytics extension contract v1 — **DONE**, Issue #98 Main Verification PASS.
- `TEST-010` Layered test architecture — **DONE**, Issue #100 Main Verification PASS.
- `OBS-010` SLO/error-budget layer — **DONE**, Issue #103 Main Verification PASS.
- `PERF-010` Query projection/minimal ranges — **DONE**, Issue #105 Main Verification PASS.
- `PERF-011` Revision-aware read cache — **DONE**, Issue #108 Main Verification PASS.
- `PERF-012` Single-scan refresh pipeline — **IN_PROGRESS**, Issue #110; current R1 writer.
- последующие `PERF-013..014`, `DOC-010` и другие items остаются dependency/priority-gated.

FIN-010: `PRH_KPI_DICTIONARY_V1` / `FIN-TRUTH-v1`.  
DATA-010: `PRH_CANONICAL_TRANSACTION_V1`.  
ARCH-010: `PRH_APPLICATION_CORE_V1`, `io_authority=false`, `financial_write_authority=false`, `network_authority=false`.  
ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write остаётся fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.  
ANL-010: `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, renderer/storage-neutral, `financial_write=false`.  
TEST-010: `PRH_TEST_ARCHITECTURE_V1@1.0.0`.  
OBS-010: `PRH_SLO_ERROR_BUDGET_V1@1.0.0`.  
PERF-010: `PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0`.  
PERF-011: `PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0`.

## PERF-012 current truth

PERF-012 вводит `PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` как bounded point-in-time refresh coordinator поверх authoritative `PRH_TRANSACTION_REPOSITORY_V1`, PERF-010 projection и ANL-010 analytics semantics.

Каждый refresh cycle вызывает `repository.readAll()` ровно один раз, валидирует canonical collection и вычисляет exact 64-hex content revision через `repositoryRevision()` на том же snapshot. Separate `getRevision()` перед чтением намеренно не используется: текущий Google adapter сам вычисляет revision через canonical read, поэтому такой probe удвоил бы scan budget до начала dashboard calculations.

Внутри cycle `READ_ALL`, `GET_BY_ID`, `QUERY` и `ANALYTICS` обслуживаются из immutable snapshot. Repository query semantics делегируются authoritative `applyQuery()`, analytics — `evaluateAnalytics()`/FIN-010. Underlying `getRevision/getById/query` для logical consumers не вызываются.

Snapshot не является cross-cycle cache. Он ограничен `max_age_ms` и `max_operations`, explicit invalidation fail-closed. Изменение источника после начала cycle не создаёт mixed result: активный cycle остаётся point-in-time snapshot, а следующий cycle обязан снова materialize canonical dataset и получает новый revision.

Telemetry public-safe: snapshot status/reason, SHA-256 cycle hash, domain-separated revision hash prefix, canonical snapshot read count, logical/reuse counts, operation counts, age/bounds/invalidation. Raw query, transaction identity, canonical rows и financial payload запрещены.

`writeBatch()` всегда `BLOCKED / SINGLE_SCAN_REFRESH_WRITE_NOT_AUTHORIZED`. PERF-012 не вводит incremental aggregates PERF-013 и не меняет PERF-010/PERF-011/ANL-010 semantics.

Normative runbook: `docs/operations/PERF012_SINGLE_SCAN_REFRESH.md`. Named canonical PR gate: `Single-scan refresh pipeline`.

## PERF-011 verified boundary

PERF-011 завершён Main Verification. `PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0` остаётся bounded read/query decorator для independent repository requests: каждый потенциальный HIT требует exact repository revision probe, key включает adapter/mapping/projection namespace и normalized operation identity; unknown/stale revision fail-closed. Cache не создаёт financial/query/write authority.

PERF-012 не ослабляет этот contract: request cache и refresh snapshot имеют разные lifetimes/authority. Cache полезен между независимыми requests; single-scan snapshot устраняет повторные reads внутри одного связного refresh cycle.

## PERF-010 verified boundary

PERF-010 завершён Main Verification. `PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` отделяет header discovery от data-plane reads: rows читаются только requested mapped contiguous column spans и bounded row intervals. Synthetic 4-row/20-column evidence: full-width baseline 80 cells, mapped readAll 60, getById 19, representative narrow query 35; projected query result exact-parity с authoritative repository baseline.

Google gateway fail-closed при ambiguous duplicate mapped physical headers и не использует generic financial write authority. `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED` остаётся действующим.

## OBS-010 verified boundary

OBS-010 завершён Main Verification. `PRH_SLO_ERROR_BUDGET_V1@1.0.0` использует integer ppm/bps, half-open windows и SLI `AVAILABILITY`, `LATENCY`, zero-tolerance `CORRECTNESS`, `FRESHNESS`, zero-tolerance `MIGRATION_ERRORS`. Observation shapes deny-by-default; correctness принимает только allowlisted technical PASS/FAIL evidence. Financial/raw payload запрещён; `FREE_ONLY`, `financial_write=false`, `financial_correctness=false`.

## TEST-010 verified boundary

TEST-010 завершён Main Verification. `PRH_TEST_ARCHITECTURE_V1@1.0.0` разделяет `PURE_DOMAIN_APPLICATION`, `MIGRATION_RECOVERY`, `ADAPTER_INTEGRATION`, `RUNTIME_INTEGRATION`, `UI_E2E`, `POLICY_GOVERNANCE`. `unclassified_test=FAIL`, `ambiguous_classification=FAIL`, `duplicate_machine_authority=FAIL`; current-writer/workflow authority использует shared structured parsers.

## ANL-010 verified boundary

ANL-010 завершён Main Verification. `PRH_ANALYTICS_QUERY_V1` / `PRH_ANALYTICS_RESULT_V1` сохраняют deterministic query identity, canonical/KPI provenance и делегируют financial calculations FIN-010 `evaluateKpis()`.

## MIG-010 verified historical boundary

MIG-010 owner-private flow completed:

```text
RESOLVED_REBUILD_DRY_RUN = PASS
-> exact execution package/request
-> owner IRREVERSIBLE_ACTION_AUTHORIZED
-> STAGING + READBACK
-> FINALIZED_PENDING_RECONCILIATION
-> FRESH ENCRYPTED BACKUP
-> POST-WRITE RECONCILIATION
-> OWNER_VERIFIED
-> PR/Main Verification
-> DONE
```

Private evidence established `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Generic repository write authority did not change. Hidden staging/rollback cleanup was not performed automatically and is not implied by DONE. Owner-confirmed identical operations remain represented by `CONTENT_FINGERPRINT_OCCURRENCE_V1`.

### MASTER-G3 / Canonical platform — **open**

Private full-history reconciliation gate is PASS. MASTER-G3 still requires `FIN-010 + DATA-010 + ARCH-010 + ARCH-011 + ANL-010 + MIG-010 + PERF-014 + DOC-010 = DONE` and synthetic performance PASS.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract.

- `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` define continuation, one-writer ownership and lifecycle.
- `tools/multi-ai-review-protocol.js` + `PRH_MULTI_AI_REVIEW_PACKET_V1` / `PRH_MULTI_AI_REVIEW_REPORT_V1` define supplementary exact-candidate review.
- reviewers always `READ_ONLY`, `writer_authority=false`; unresolved P0/P1 blocks review evidence, P2/P3 advisory.
- required checks deterministic/local and require no paid AI/API provider.

## Current runtime truth

- private primary store/runtime: Google Sheets + Apps Script;
- family UI: private `MYSELF` Apps Script Web Dashboard;
- trusted runtime health includes authenticated Web App render smoke v2;
- public GitHub finance content: independently generated synthetic only;
- DEV delivery: exact-SHA autonomous pipeline;
- PROD/cutover/destructive data actions: separate policy gates;
- `FREE_ONLY` mandatory; paid-by-usage provider activation is not automatic.

## Что намеренно не утверждается

- PERF-012 не считается DONE до CI-003 merge + Main Verification/Issue close;
- single-scan snapshot — point-in-time input одного bounded refresh cycle, а не вечный cache;
- новый cycle всегда требует нового canonical snapshot read;
- PERF-012 не вводит incremental aggregates PERF-013 или scale gate PERF-014;
- PERF-011 cache HIT по-прежнему никогда не разрешён без exact revision proof;
- PERF-010 projection instrumentation, PERF-011 cache telemetry и PERF-012 refresh telemetry не разрешают financial payload;
- owner authorization MIG-010 не переносится на future mutations;
- hidden MIG staging/rollback cleanup не выполнен автоматически;
- Google -> Yandex cutover не выполнен;
- private Dashboard не сделан публичным;
- public Git history rewrite не authorized/executed;
- paid cloud/AI/OCR/observability/cache provider не включён.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. repository `docs/ROADMAP.md` v2.3;
3. external Master Audit / AI Development Playbook, когда явно предоставлены;
4. active Roadmap Issue/task packet;
5. executable exact-SHA code/tests/workflows;
6. architecture/ADR/operations docs;
7. README/user docs;
8. historical changelog/release notes.

Stale lower-priority документ никогда не разрешает bypass current machine gate.
