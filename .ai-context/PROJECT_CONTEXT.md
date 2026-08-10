# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys и owner-private payload запрещены.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **каноническая Executable GitHub Roadmap v2.3**.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Architecture/ADR/operations docs.

Chat history/memory и stale Roadmap copies not authority. При явно предоставленных `Master Audit v2.1` / `AI Development Playbook v1.0` действует precedence из `AGENTS.md`.

## Current R0 truth

R0 machine-proven complete. `MASTER-G0`, `MASTER-G1`, `MASTER-G2` закрыты. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`.

## Current R1 truth

- `FIN-010` — DONE.
- `DATA-010` — DONE.
- `ARCH-010` — DONE, Issue #89 Main Verification PASS.
- `ARCH-011` — DONE, Issue #91 Main Verification PASS.
- `MIG-010` — DONE, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` evidence retained historically.
- `ANL-010` — DONE, Issue #98 Main Verification PASS.
- `TEST-010` — DONE, Issue #100 Main Verification PASS.
- `OBS-010` — DONE, Issue #103 Main Verification PASS.
- `PERF-010` — DONE, Issue #105 Main Verification PASS.
- `PERF-011` — DONE, Issue #108 Main Verification PASS.
- `PERF-012` — **current P1 writer**, Issue #110, branch `agent/PERF-012-single-scan-refresh`.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## PERF-012 single-scan refresh boundary

`PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` coordinates one bounded point-in-time refresh cycle. It cannot define financial/query semantics and cannot inherit write authority.

Cycle start:

- exactly one `repository.readAll()` canonical snapshot materialization;
- canonical collection validation;
- exact 64-hex revision derived by authoritative `repositoryRevision()` from that same validated snapshot;
- no separate underlying `getRevision()` call, because the current Google revision producer itself performs a canonical read and would duplicate the scan;
- snapshot is immutable and cannot be reused across refresh cycles.

Within one cycle, `READ_ALL`, `GET_BY_ID`, `QUERY` and `ANALYTICS` are served from the immutable snapshot. Repository query semantics reuse `applyQuery()`. Analytics reuses `evaluateAnalytics()`/FIN-010 and must return matching `provenance.input_revision`. Underlying `getRevision/getById/query` are not called by logical consumers.

A cycle is bounded by age and operation count. Expiry, explicit invalidation and operation-budget exhaustion fail closed. External mutation after cycle start cannot partially alter the active point-in-time snapshot; the next cycle performs a new canonical read and derives the new revision.

Telemetry is technical only: snapshot status/reason, SHA-256 cycle hash, domain-separated revision hash prefix, canonical snapshot read count, logical/reuse/operation counts, age/bounds/invalidation. Raw query, transaction identity, canonical rows and financial payload are forbidden.

`writeBatch()` always returns `BLOCKED / SINGLE_SCAN_REFRESH_WRITE_NOT_AUTHORIZED`.

Normative runbook: `docs/operations/PERF012_SINGLE_SCAN_REFRESH.md`. Named canonical PR gate: `Single-scan refresh pipeline`.

## PERF-011 verified cache boundary

`PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0` is DONE. It remains the exact-revision cache for independent repository requests: potential HIT always performs exact revision confirmation, query identity is normalized, adapter/mapping/projection namespace is versioned, stale/unknown revision fails closed, and cache has no financial/write authority.

PERF-012 does not weaken PERF-011. Cache and refresh snapshot have different lifetimes: PERF-011 reuses independent request results only after exact revision probe; PERF-012 reuses one already materialized immutable canonical snapshot inside one bounded refresh cycle.

## PERF-010 verified projection boundary

`PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` is DONE. Header discovery is separated from data-plane reads; canonical Google rows are read only through required mapped contiguous column spans and bounded row groups. Generic financial write stays blocked.

## OBS-010 verified SLO/error-budget boundary

`PRH_SLO_ERROR_BUDGET_V1@1.0.0` uses integer ppm/bps and SLI AVAILABILITY/LATENCY/CORRECTNESS/FRESHNESS/MIGRATION_ERRORS. Correctness accepts allowlisted technical machine evidence only. It has no financial truth/write authority and requires no paid provider.

## TEST-010 verified testing boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies all tracked tests into pure, migration/recovery, adapter/integration, runtime, UI/E2E and policy/governance. Unknown/ambiguous classification is fail-closed. Shared lifecycle/workflow parsers remove hard-coded successor authority.

## ANL-010 verified analytics boundary

`PRH_ANALYTICS_CONTRACT_V1@1.0.0` defines renderer/storage-neutral query/results and delegates financial KPI semantics to FIN-010 `evaluateKpis()`. `financial_write=false`.

## MIG-010 historical verified boundary

Owner-private full-history migration remains DONE/OWNER_VERIFIED with `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Owner-confirmed occurrence identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Authorized execution was governed by `MIG010_EXECUTION_POLICY_V1@1.0.0`; finalize could enter `FINALIZED_PENDING_RECONCILIATION` and was not considered complete until post-write reconciliation reached the verified boundary. This one-time authorization/evidence never grants later generic write authority. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations.

## Current delivery

```text
Roadmap Issue IN_PROGRESS
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health + Web App render smoke v2
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE/closed
```

PERF-012 remains IN_PROGRESS until its single-scan/docs/machine evidence is green and Main Verification closes Issue #110.

## Executable continuation protocol

`tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` select/continue exactly one dependency-ready writer. Multiple writers, missing dependencies or private context fail closed.

## Read-only multi-AI review

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers always `READ_ONLY`, `writer_authority:false`; P0/P1 block, P2/P3 advisory. Review never overrides machine gates/Main Verification.

## Privacy / financial / cost boundaries

Real or real-derived household finance data stays private. Public finance fixtures are independently generated synthetic only. Private deployment identifiers, authenticated responses, OAuth, backups/keys и migration artifacts stay private. `FREE_ONLY` remains mandatory.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`.  
DATA-010: `PRH_CANONICAL_TRANSACTION_V1`.  
ARCH-010: `PRH_APPLICATION_CORE_V1`; no I/O/network/financial-write authority.  
ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; Google mutation blocked.  
ANL-010: `PRH_ANALYTICS_CONTRACT_V1`; no financial-write authority.  
TEST-010: `PRH_TEST_ARCHITECTURE_V1`; test authority only.  
OBS-010: `PRH_SLO_ERROR_BUDGET_V1`; technical SLO authority only.  
PERF-010: `PRH_GOOGLE_QUERY_PROJECTION_V1`; read-plan authority only.  
PERF-011: `PRH_REVISION_AWARE_READ_CACHE_V1`; cache reuse authority only.  
PERF-012: `PRH_SINGLE_SCAN_REFRESH_V1`; bounded refresh snapshot reuse authority only.

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Issue #110
4. `/docs/PROJECT_STATUS.md`
5. `/docs/operations/PERF012_SINGLE_SCAN_REFRESH.md`
6. `/lib/repository/single_scan_refresh.v1.json`
7. `/lib/repository/single_scan_refresh.js`
8. `/tests/repository_refresh_pipeline_adapter_contract_test.js`
9. `/docs/operations/PERF011_REVISION_AWARE_CACHE.md`
10. `/docs/operations/PERF010_QUERY_PROJECTION.md`
11. exact candidate code/tests/workflows

## Scope handoff

`AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`; `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010`, `PERF-011` = DONE. `PERF-012` = current R1 writer. PERF-013+ remain dependency-gated until its Main Verification.
