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
- `PERF-010` — **DONE**; `PERF-011` — **DONE**; `PERF-012` — **DONE**; `PERF-013` — **DONE**; `PERF-014` — **DONE**.
- `DOC-010` — **DONE**, Issue #116 Main Verification PASS; `PRH_R1_DOCUMENTATION_V1@1.0.0` verified.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current R2 truth

- `DESIGN-020` — **DONE**, Issue #118 Main Verification PASS.
- `VIZ-020` — **DONE**, Issue #120 Main Verification PASS.
- `HOME-020` — **DONE**, Issue #122 Main Verification PASS.
- `TX-020` — **DONE**, Issue #124 Main Verification PASS.
- `EXP-020` — **DONE**, Issue #126 Main Verification PASS.
- `INC-020` — **DONE**, Issue #128 Main Verification PASS.
- `CF-020` — **DONE**, Issue #130 Main Verification PASS.
- `BUD-020` — **current R2 writer**, Issue #132, branch `agent/BUD-020-budget-control`; IN_PROGRESS до Main Verification.

## BUD-020 Budget Control boundary

Machine contract: `lib/budget/budget_control.v1.json` (`PRH_BUDGET_CONTROL_V1@1.0.0`). Core: `lib/budget/budget_control.js`. Human contract: `docs/analytics/BUDGET_CONTROL.md`. Browser evidence: `BudgetControlWebApp.html`. Tests: `tests/budget_control_contract_test.js`, `tests/budget_control_visual_test.js`.

Rules:

- BUD consumes FIN-010/VIZ-020/TX-020 and does not redefine their contracts.
- Budget scope is explicit `TOTAL_EXPENSE_LINEAR_PERIOD_V1`; full-period budget is not silently passed to partial fact windows.
- Elapsed budget uses deterministic integer `ROUND_HALF_UP_POSITIVE` over elapsed_days/total_days.
- Exact elapsed `EXPENSE` and `BUDGET_VARIANCE` come from FIN-010 for the same explicit window/currency/elapsed budget.
- Run-rate/projection are planning-only derived metrics, never FIN-TRUTH.
- `BUDGET_ALERT_V1`: `OVER_BUDGET` when elapsed FIN variance < 0; `AT_RISK` when elapsed variance >= 0 and projected utilization >= 9500 bp; otherwise `ON_TRACK`.
- VIZ specs remain configuration-only and runtime financial render rows remain private/transient.
- TX drill is bounded to the elapsed window and `expense/refund`; navigation contains no financial/budget values and grants no write authority.
- Budget Control is not account-balance/liquidity truth.
- Public evidence is independently generated synthetic only. `FREE_ONLY` mandatory; external CDN/provider not required.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. BUD core contract is `PURE_DOMAIN_APPLICATION`; BUD browser visual test is `UI_E2E`. Unknown or ambiguous test classification fails.

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

BUD-020 remains open until its contract/full layered/visual evidence are green, trusted exact-head deploy/runtime health passes and Main Verification closes Issue #132.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority=false`; review is supplementary evidence and never overrides red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Private deployment identifiers, authenticated responses, OAuth, backups/keys and real Home/TX/Analytics/Budget models stay private. Family Web App remains private `MYSELF`. `FREE_ONLY` remains mandatory.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`. DATA-010: `PRH_CANONICAL_TRANSACTION_V1`. ARCH-010: `PRH_APPLICATION_CORE_V1`; no I/O/network/financial-write authority. ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google mutation blocked with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. BUD-020 is a FIN-backed budget read/planning model only; `financial_write=false`.

## Scope handoff

All R1 items plus DESIGN-020/VIZ-020/HOME-020/TX-020/EXP-020/INC-020/CF-020 are DONE. `MASTER-G3 = complete`. `BUD-020` is the single current R2 writer.
