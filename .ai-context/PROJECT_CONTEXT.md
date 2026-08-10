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
- `PERF-012` — DONE, Issue #110 Main Verification PASS.
- `PERF-013` — DONE, Issue #112 Main Verification PASS.
- `PERF-014` — **current P1 writer**, Issue #114, branch `agent/PERF-014-synthetic-scale-gates`.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## PERF-014 synthetic scale boundary

`PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0` defines blocking CI guardrails for deterministic synthetic 20k/50k canonical datasets. Wall-clock ceilings are regression thresholds with runner-variance margin, not production/user-facing SLA.

`PRH_SYNTHETIC_SCALE_FIXTURE_V1` generates only independently synthetic valid transactions in memory from a fixed seed. It never reads private runtime, does not use production-derived values/distributions and does not persist the generated 20k/50k arrays as repository fixtures/artifacts.

Profiles `SCALE_20K` and `SCALE_50K` measure authoritative canonical revision, representative ANL-010 full recompute, PERF-012 linked single-scan refresh, PERF-013 aggregate full build, bounded incremental update and fresh parity rebuild. A named ceiling breach is a PR failure.

Read/write budget is explicit: one canonical `readAll()` per PERF-012 linked refresh cycle and zero underlying financial writes. The cycle write facade remains blocked.

Incremental performance cannot override correctness. Bounded delta is 100/250 changed transactions; PERF-013 must report affected-bucket-only recompute and the incremental state must exactly equal a fresh full aggregate rebuild.

Public evidence contains only profile/dataset/delta counts, elapsed milliseconds, technical read/write counters, changed/affected/recomputed bucket counts and PASS/FAIL. Transaction identities, bucket labels, financial values, canonical rows and source fingerprints are forbidden.

`financial_write=false`; no migration/network/provider authority and no paid dependency. Normative runbook: `docs/operations/PERF014_SYNTHETIC_SCALE_GATE.md`. Named canonical PR gate: `Synthetic scale performance`.

## PERF-013 verified aggregate boundary

`PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0` is DONE. MONTH/CATEGORY_ID/ACCOUNT_ID materializations use FIN-010 formulas, exact canonical revision/state hash and deterministic affected-bucket delta with fresh full-build parity. Mixed currency fails closed; no write/provider authority.

## PERF-012 verified single-scan boundary

`PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` is DONE. One bounded refresh cycle materializes one validated canonical snapshot, derives exact content revision from that snapshot and serves linked repository/analytics consumers locally. It has no cross-cycle reuse or write authority.

## PERF-011 verified cache boundary

`PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0` is DONE. Independent request cache HIT still requires exact revision confirmation; stale/unknown revision fails closed and cache has no financial/write authority.

## PERF-010 verified projection boundary

`PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` is DONE. Header discovery is separated from data-plane reads; Google canonical rows are read only through required mapped contiguous spans/rows. Generic write stays blocked.

## OBS-010 verified SLO/error-budget boundary

`PRH_SLO_ERROR_BUDGET_V1@1.0.0` uses integer ppm/bps and SLI AVAILABILITY/LATENCY/CORRECTNESS/FRESHNESS/MIGRATION_ERRORS. Correctness accepts allowlisted technical machine evidence only. No financial truth/write or paid-provider authority.

## TEST-010 verified testing boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies all tracked tests into pure, migration/recovery, adapter/integration, runtime, UI/E2E and policy/governance. Unknown/ambiguous classification is fail-closed.

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

PERF-014 remains IN_PROGRESS until 20k/50k scale/docs/machine evidence is green and Main Verification closes Issue #114.

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
PERF-013: `PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1`; affected-bucket materialization authority only.  
PERF-014: `PRH_SYNTHETIC_SCALE_GATE_V1`; synthetic CI performance-gate authority only.

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Issue #114
4. `/docs/PROJECT_STATUS.md`
5. `/docs/operations/PERF014_SYNTHETIC_SCALE_GATE.md`
6. `/lib/performance/synthetic_scale_gate.v1.json`
7. `/lib/testing/synthetic_scale_fixture.js`
8. `/tests/synthetic_scale_performance_contract_test.js`
9. `/docs/operations/PERF013_INCREMENTAL_AGGREGATES.md`
10. `/docs/operations/PERF012_SINGLE_SCAN_REFRESH.md`
11. exact candidate code/tests/workflows

## Scope handoff

`AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`; `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010`, `PERF-011`, `PERF-012`, `PERF-013` = DONE. `PERF-014` = current R1 writer. `DOC-010` remains dependency-gated until its Main Verification.
