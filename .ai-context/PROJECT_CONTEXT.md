# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys и owner-private payload запрещены.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **Executable GitHub Roadmap v2.3**, канонический Roadmap.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

## Current R0 truth

R0 machine-proven complete. `MASTER-G0`, `MASTER-G1`, `MASTER-G2` закрыты. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`.

## Current R1 truth

`MASTER-G3 / Canonical platform` — complete. Independently generated synthetic 20k/50k performance = PASS.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS.
- `TEST-010` — **DONE**, Issue #100 Main Verification PASS.
- `OBS-010` — **DONE**, Issue #103 Main Verification PASS.
- `PERF-010..014` — **DONE**.
- `DOC-010` — **DONE**, Issue #116 Main Verification PASS; `PRH_R1_DOCUMENTATION_V1@1.0.0` verified.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current R2 truth

DESIGN-020, VIZ-020, HOME-020, TX-020, EXP-020, INC-020, CF-020, BUD-020, OBL-020, DQ-020 and PWA-020 are DONE/Main Verification PASS. PWA-020 Issue #137 merged through PR #140, merge `c6910df6679fdc894635092c27cd3c463a69a364`.

`NOT_PROVEN_CURRENT_HOST` remains the current Apps Script HtmlService service-worker state; private financial/authenticated responses are never allowed in PWA cache. `PROF-020` remains P2 and is not current writer.

## Current R4 truth

AIENG-002 resolver compared explicit READY P1 candidates `YC-040` Issue #141 and `AUTH-040` Issue #142. Both dependencies were prevalidated DONE; priority and wave tie, Roadmap order selected `YC-040` first.

- `YC-040` — **current writer**, Issue #141, branch `agent/YC-040-ydb-serverless-poc`; IN_PROGRESS until Main Verification.
- `AUTH-040` — **READY**, Issue #142; `writer_authority=false` until a future resolver selection.

## YC-040 YDB Serverless PoC boundary

Machine contract: `lib/ydb/ydb_serverless_poc.v1.json` (`PRH_YDB_SERVERLESS_POC_V1@1.0.0`). YQL: `lib/ydb/canonical_transactions_v1.yql`. Core: `lib/ydb/ydb_serverless_poc.js`. Human contract: `docs/architecture/YDB_SERVERLESS_POC.md`. Test: `tests/ydb_serverless_poc_contract_test.js`. Named gate: `YDB Serverless PoC`.

Rules:

- YC-040 is `OFFLINE_SCHEMA_ADAPTER_POC`, not a live YDB deployment/cutover.
- Required CI needs no Yandex Cloud resource, endpoint, database ID, billing account ID or cloud credentials.
- Google remains current authoritative runtime/store; YDB canonical write owner = false; real replication = false.
- DATA-010 canonical transaction maps losslessly to YDB-shaped rows. Money remains integer minor units. Exact canonical RFC3339 timestamp text is preserved as `Utf8` to avoid changing source representation.
- Official YDB Serverless free-tier reference was checked on 2026-08-10: 1,000,000 RU/month and 1 GiB storage, with excess usage billable; free allowance is billing-account scoped and cloud quotas are not treated as billing caps.
- Required safety envelope is stricter: 250,000 RU/month, 256 MiB storage, 100,000 requests/month internal guard, 5 RU/s peak guard.
- `paidOverageAllowed=false`; billing state other than `FREE_TIER_CONFIRMED_CURRENT` blocks reservation.
- Production `PR_CONFIG.FINOPS.PROVIDERS` intentionally remains empty; PoC does not create runtime cloud authority.
- Public telemetry is allowlisted RU/storage/request counts/utilization/circuit/status metadata only; financial payload and private cloud locators forbidden.
- `FREE_ONLY` mandatory; no paid dependency/provider required for CI.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. YC-040 contract test is `ADAPTER_INTEGRATION`. Unknown or ambiguous test classification fails.

## MIG-010 historical verified boundary

Owner-private migration remains DONE/OWNER_VERIFIED with `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed occurrence identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Authorized execution was governed by `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` is exact-bound and non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Generic Google financial write remains blocked by `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current delivery

```text
PR Validation
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

YC-040 remains open until schema/round-trip/FREE_ONLY cost-guard/privacy/full layered evidence are green, trusted exact-head deploy/runtime health passes and Main Verification closes Issue #141.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review is supplementary evidence and never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Private deployment/database/billing identifiers, credentials, OAuth, backups/keys and real financial models stay private. Family Web App remains private `MYSELF`. YC-040 uses independent synthetic records only. `FREE_ONLY` remains mandatory.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`. DATA-010: `PRH_CANONICAL_TRANSACTION_V1`. ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google mutation blocked with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. YC-040 is offline adapter/cost-policy evidence only; `financial_truth=false`, `ydb_canonical_write_ownership=false`, `billing_enablement=false`.

## Scope handoff

All R1 items and the R2 P1 baseline are DONE. `MASTER-G3 = complete`. `YC-040` is the single active writer. `AUTH-040` is READY without writer authority.
