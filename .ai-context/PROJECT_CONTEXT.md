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
- `PERF-011` — **current P1 writer**, Issue #108, branch `agent/PERF-011-revision-aware-read-cache`.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## PERF-011 revision-aware cache boundary

`PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0` decorates read/query operations only. It cannot define financial semantics and cannot inherit write authority from a wrapped repository.

Exact HIT preconditions:

- cache schema/version matches;
- repository schema matches;
- versioned adapter/mapping namespace matches;
- versioned projection identity matches;
- exact 64-hex repository revision is freshly probed before the HIT;
- operation and normalized operation/query identity match;
- TTL not expired.

Key identity includes SHA-256 normalized operation identity. `QUERY` uses authoritative `normalizeQuery()`, so semantically equivalent query ordering does not create duplicate entries. If a repository advertises `capabilities.projection=true`, explicit `projection_identity` is mandatory; missing identity fails closed.

Revision change invalidates all entries before HIT. Unknown revision fails closed before the underlying loader. Adapter/mapping/projection version change yields a different key namespace/MISS even with same revision/query.

Bounds: TTL default 30s/max 300s; entries default 64/hard max 512; LRU eviction. Eviction only turns a future request into MISS. Explicit invalidation clears entries and forgets the last revision.

PERF-011 deliberately does not cache the exact revision probe and does not implement PERF-012 single-scan refresh. On MISS, PERF-010 projection path remains authoritative.

Cache layer `writeBatch()` always returns `BLOCKED / REVISION_CACHE_WRITE_NOT_AUTHORIZED`.

Privacy-safe telemetry includes only HIT/MISS/EMPTY, reason, operation, cache-key SHA-256, domain-separated revision hash prefix, entry count, age, eviction and invalidation counts. Raw query, transaction ID, adapter/projection namespace and financial/canonical payload are absent.

Normative runbook: `docs/operations/PERF011_REVISION_AWARE_CACHE.md`. Named canonical PR gate: `Revision-aware read cache`. Supplemental workflow `PERF-011 Cache Contract` is not completion authority.

## PERF-010 verified projection boundary

`PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` is DONE. Header discovery is separated from data-plane reads; canonical Google rows are read only through required contiguous column spans and bounded row groups. Generic financial write stays blocked. PERF-011 key namespace binds to the projection version rather than redefining projection behavior.

## OBS-010 verified SLO/error-budget boundary

`PRH_SLO_ERROR_BUDGET_V1@1.0.0` uses integer ppm/bps and SLI AVAILABILITY/LATENCY/CORRECTNESS/FRESHNESS/MIGRATION_ERRORS. Correctness accepts allowlisted technical machine evidence only. It has no financial truth/write authority and requires no paid provider.

## TEST-010 verified testing boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies all tracked tests into pure, migration/recovery, adapter/integration, runtime, UI/E2E and policy/governance. Unknown/ambiguous classification is fail-closed. Shared lifecycle/workflow parsers remove hard-coded successor authority.

## ANL-010 verified analytics boundary

`PRH_ANALYTICS_CONTRACT_V1@1.0.0` defines renderer/storage-neutral query/results and delegates financial KPI semantics to FIN-010 `evaluateKpis()`. `financial_write=false`.

## MIG-010 historical verified boundary

Owner-private full-history migration remains DONE/OWNER_VERIFIED with `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Owner-confirmed occurrence identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. This one-time authorization/evidence never grants later generic write authority. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations.

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

PERF-011 remains IN_PROGRESS until its cache/docs/machine evidence is green and Main Verification closes Issue #108.

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

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Issue #108
4. `/docs/PROJECT_STATUS.md`
5. `/docs/operations/PERF011_REVISION_AWARE_CACHE.md`
6. `/lib/repository/revision_aware_cache.v1.json`
7. `/lib/repository/revision_aware_cache.js`
8. `/tests/repository_cache_adapter_contract_test.js`
9. `/docs/operations/PERF010_QUERY_PROJECTION.md`
10. exact candidate code/tests/workflows

## Scope handoff

`AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`; `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010` = DONE. `PERF-011` = current R1 writer. PERF-012+ remain dependency-gated until its Main Verification.