# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys и owner-private payload запрещены.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **каноническая Executable GitHub Roadmap v2.3**.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

Chat history/memory и stale Roadmap copies not authority.

## Current R0 truth

R0 machine-proven complete. `MASTER-G0`, `MASTER-G1`, `MASTER-G2` закрыты. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`.

## Current R1 truth

- `FIN-010` — DONE, Issue #85 Main Verification PASS.
- `DATA-010` — DONE, Issue #87 Main Verification PASS.
- `ARCH-010` — DONE, Issue #89 Main Verification PASS.
- `ARCH-011` — DONE, Issue #91 Main Verification PASS.
- `MIG-010` — DONE, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — DONE, Issue #98 Main Verification PASS.
- `TEST-010` — DONE, Issue #100 Main Verification PASS.
- `OBS-010` — DONE, Issue #103 Main Verification PASS.
- `PERF-010` — DONE, Issue #105 Main Verification PASS.
- `PERF-011` — DONE, Issue #108 Main Verification PASS.
- `PERF-012` — DONE, Issue #110 Main Verification PASS.
- `PERF-013` — DONE, Issue #112 Main Verification PASS.
- `PERF-014` — DONE, Issue #114 Main Verification PASS.
- `DOC-010` — DONE, Issue #116 Main Verification PASS.

`MASTER-G3 / Canonical platform` — **complete**. Private full-history reconciliation = PASS; independently generated synthetic 20k/50k performance = PASS.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current R2 truth

- `DESIGN-020` — **DONE**, Issue #118 Main Verification PASS, PR #119 autonomous merge `9337dfb1288ebc3e0c746ab744b61bb1051e14ea`.
- `VIZ-020` — **DONE**, Issue #120 Main Verification PASS, PR #121 autonomous merge `66139972b1fc910fc7bc0e614ecfdc7d5b754adf`.
- `HOME-020` — **DONE**, Issue #122 Main Verification PASS, PR #123 autonomous merge `24e6e57e1b2b803dd0d2176376207fd524674dd3`.
- `TX-020` — **current R2 writer**, Issue #124, branch `agent/TX-020-transaction-explorer`; IN_PROGRESS до Main Verification.

`PRH_DESIGN_SYSTEM_V1@1.0.0` remains presentation-only; no financial/query/storage/write authority.  
`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` remains configuration/interaction/replaceable-renderer authority only; no financial/query/storage/write authority.  
`PRH_FINANCIAL_HOME_V1@1.0.0` remains FIN-backed Home composition only; no financial-write/storage/network/balance-observation authority.

## TX-020 Transaction Explorer boundary

Machine contract: `lib/explorer/transaction_explorer.v1.json` (`PRH_TRANSACTION_EXPLORER_V1@1.0.0`). Core: `lib/explorer/transaction_explorer.js`. Browser surface: `TransactionExplorerWebApp.html`. Tests: `tests/transaction_explorer_contract_test.js`, `tests/transaction_explorer_visual_test.js`. Named gates: `Transaction Explorer`, `Transaction Explorer visual gate`.

Rules:

- Explorer consumes `PRH_CANONICAL_TRANSACTION_V1`; it does not redefine canonical shape or FIN-TRUTH.
- Query supports explicit date/account/category/member/type/status filters, bounded text search, allowlisted sort fields and offset/limit page semantics.
- Normalized query identity is deterministic SHA-256; stable sort uses `transaction_id` tie-breaker.
- Page size is bounded to max 200; synthetic 20k/50k interaction profiles exercise search/filter/sort/page behavior.
- Result rows are projections of canonical transaction fields, not new financial calculations.
- Edit draft accepts only allowlisted editable fields and becomes `VALID` only through DATA-010 `normalizeCanonicalTransaction()` plus immutable source-identity check.
- Runtime save remains `WRITE_BLOCKED` with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`; financial write authority is false.
- A future write policy must separately prove idempotency, preconditions, backup, readback, reconciliation and rollback before Google mutation can be enabled.
- Public telemetry is restricted to schema/version/query-hash/count/timing/edit-state/reason-code metadata; private rows/IDs/amounts are not public telemetry.
- Public tests/browser evidence use independently generated synthetic transactions only.
- `FREE_ONLY` mandatory; no external provider/CDN required.

Canonical TX-020 entry points:

1. `docs/ROADMAP.md`
2. live Issue #124
3. `docs/PROJECT_STATUS.md`
4. `lib/explorer/transaction_explorer.v1.json`
5. `lib/explorer/transaction_explorer.js`
6. `TransactionExplorerWebApp.html`
7. `tests/transaction_explorer_contract_test.js`
8. `tests/transaction_explorer_visual_test.js`
9. exact candidate workflows/evidence

EXP-020/INC-020/CF-020/PWA-020 and other sibling scopes are not part of the current writer.

## DOC-010 verified documentation-coherence boundary

`PRH_R1_DOCUMENTATION_V1@1.0.0` maps normative docs to versioned contracts/source/tests/named gates. DOC-010 is DONE/Main Verification PASS. Documentation cannot override Roadmap/live Issues/exact-SHA machine gates.

Canonical R1 maps remain `docs/architecture/R1_C4_CONTEXT.md`, `docs/data/R1_DATA_LINEAGE.md`, `lib/documentation/r1_documentation.v1.json`, `tests/r1_documentation_contract_test.js`.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. DESIGN/VIZ/HOME/TX contracts and UI visual tests are `UI_E2E`. Unknown/ambiguous test classification fails.

## ANL / FIN / PERF authority

`PRH_ANALYTICS_CONTRACT_V1@1.0.0` remains renderer/storage-neutral and delegates KPI semantics to FIN-010; analytics authority explicitly remains `financial_write=false`. PERF-010..014 optimize reads/reuse/recompute but cannot redefine financial truth. TX-020 projects canonical rows and does not become analytics/finance authority.

## MIG-010 historical verified boundary

Owner-private migration remains DONE/OWNER_VERIFIED with `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`. Historical finalize entered `FINALIZED_PENDING_RECONCILIATION` and was not completion until post-write reconciliation returned PASS/OWNER_VERIFIED.

Owner-confirmed preserve-all identity capability remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`; no private owner resolution payload is included here.

Historical authorization is exact-bound. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions/AI cannot reuse it for future mutations. Generic financial write remains blocked by `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current delivery

```text
Roadmap Issue
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health + Web App render smoke v2
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE/closed
```

TX-020 remains open until contract/scale/visual/full suites are green, trusted exact-head deploy/runtime evidence passes and Main Verification closes Issue #124.

## Executable continuation protocol

`tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` select exactly one dependency-ready writer. Multiple writers, missing dependencies or private context fail closed.

## Read-only multi-AI review

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority:false`; unresolved P0/P1 blocks supplementary review evidence. Review never overrides machine gates/Main Verification.

## Privacy / financial / cost boundaries

Real or real-derived household finance data stays private. Public finance/render/Explorer fixtures are independently generated synthetic only. Private deployment identifiers, authenticated responses, OAuth, backups/keys, migration artifacts, real Home models, real transaction rows and renderer options stay private. `FREE_ONLY` remains mandatory.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`.  
DATA-010: `PRH_CANONICAL_TRANSACTION_V1`.  
ARCH-010: `PRH_APPLICATION_CORE_V1`; no I/O/network/financial-write authority.  
ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google mutation blocked.  
ANL-010: `PRH_ANALYTICS_CONTRACT_V1`; `financial_write=false`.  
TEST-010: `PRH_TEST_ARCHITECTURE_V1`; test authority only.  
OBS-010: `PRH_SLO_ERROR_BUDGET_V1`; technical SLO authority only.  
PERF-010..014: read/performance authority only.  
DOC-010: `PRH_R1_DOCUMENTATION_V1`; documentation coherence only.  
DESIGN-020: `PRH_DESIGN_SYSTEM_V1`; presentation semantics only.  
VIZ-020: `PRH_VISUALIZATION_FOUNDATION_V1`; visualization config/interaction/renderer-adapter only.  
HOME-020: `PRH_FINANCIAL_HOME_V1`; FIN-backed view composition only.  
TX-020: `PRH_TRANSACTION_EXPLORER_V1`; canonical row exploration/edit-draft validation only; financial_write=false.

## Scope handoff

`AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`; all R1 items, `DESIGN-020`, `VIZ-020`, `HOME-020` = DONE. `MASTER-G3 = complete`. `TX-020` is the single current R2 writer.
