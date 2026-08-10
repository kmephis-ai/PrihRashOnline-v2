# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

## R0 — завершён

### MASTER-G0 / Truth — **complete**
`TEST-001 + SEC-001 + FIN-001 + DATA-001 + DOC-001 = DONE`.

### MASTER-G1 / Autonomous delivery + AI engineering — **complete**
`SEC-003 + CI-001 + CI-002 + CI-003 + AIENG-001 + AIENG-002 + AIENG-003 = DONE`.

### MASTER-G2 / Recoverability — **complete**
`DR-001 + OBS-001 + FINOPS-001 = DONE`.

`AIENG-001 = DONE`; `AIENG-002 = DONE`; `AIENG-003 = DONE`.

## R1 / Canonical Financial Platform — завершённая волна

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS.
- `TEST-010` — **DONE**, Issue #100 Main Verification PASS.
- `OBS-010` — **DONE**, Issue #103 Main Verification PASS.
- `PERF-010` — **DONE**, Issue #105 Main Verification PASS.
- `PERF-011` — **DONE**, Issue #108 Main Verification PASS.
- `PERF-012` — **DONE**, Issue #110 Main Verification PASS.
- `PERF-013` — **DONE**, Issue #112 Main Verification PASS.
- `PERF-014` — **DONE**, Issue #114 Main Verification PASS.
- `DOC-010` — **DONE**, Issue #116 Main Verification PASS.

FIN-010 authority: `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA-010 authority: `PRH_CANONICAL_TRANSACTION_V1`. ARCH-010: `PRH_APPLICATION_CORE_V1`, `io_authority: false`. ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. ANL-010: `PRH_ANALYTICS_CONTRACT_V1@1.0.0`; `financial_write=false`.

### MASTER-G3 / Canonical platform — **complete**; historical pre-close state: open

`FIN-010 + DATA-010 + ARCH-010 + ARCH-011 + ANL-010 + MIG-010 + PERF-014 + DOC-010 = DONE`; private full-history reconciliation = PASS; independently generated synthetic 20k/50k performance = PASS.

## R2 / Family Finance Center — текущая волна

- `DESIGN-020` — **DONE**, Issue #118 Main Verification PASS.
- `VIZ-020` — **DONE**, Issue #120 Main Verification PASS.
- `HOME-020` — **DONE**, Issue #122 Main Verification PASS.
- `TX-020` — **DONE**, Issue #124 Main Verification PASS.
- `EXP-020` — **DONE**, Issue #126 Main Verification PASS.
- `INC-020` — **DONE**, Issue #128 Main Verification PASS.
- `CF-020` — **DONE**, Issue #130 Main Verification PASS, merge `35262221f9e773b652903818c971bb9f2297567d`.
- `BUD-020` Budget Control dashboard — **IN_PROGRESS**, Issue #132; current R2 writer, branch `agent/BUD-020-budget-control`.

### BUD-020 current boundary

`PRH_BUDGET_CONTROL_V1@1.0.0` вводит explicit `TOTAL_EXPENSE_LINEAR_PERIOD_V1` budget scope поверх FIN-010/VIZ-020/TX-020 без новой financial truth.

- full-period budget, explicit period/currency и `as_of_exclusive` задаются планом;
- elapsed budget вычисляется deterministic integer `ROUND_HALF_UP_POSITIVE` по elapsed_days/total_days;
- exact elapsed fact и `BUDGET_VARIANCE` вычисляет только FIN-010 для того же окна/currency/budget;
- run-rate/projection — planning-only, не FIN-TRUTH;
- `BUDGET_ALERT_V1`: `OVER_BUDGET` при elapsed FIN variance < 0; `AT_RISK` при variance >= 0 и projected utilization >= 9500 bp; иначе `ON_TRACK`;
- VIZ specs configuration-only, runtime financial rows separate/private;
- TX drill ограничен elapsed window и типами `expense/refund`; navigation не содержит денежных значений и не даёт write authority;
- Budget Control не является account-balance/liquidity truth;
- generic runtime save остаётся `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`;
- public evidence — independently generated synthetic only; `FREE_ONLY` mandatory.

Normative doc: `docs/analytics/BUDGET_CONTROL.md`. Core: `lib/budget/budget_control.js`. Tests: `tests/budget_control_contract_test.js`, `tests/budget_control_visual_test.js`.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical machine anchors: **Current write authority = false**. The **owner-verified MIG-010 private full-history reconciliation** remains completed correctness proof.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Any future irreversible financial write requires fresh exact-bound owner authorization.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract. `AIENG-001`, `AIENG-002`, `AIENG-003` are DONE. `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` enforce one-writer continuation. Read-only multi-AI reviewers have `writer_authority=false`; machine gates and Main Verification remain authoritative.

## Current delivery chain

```text
active Roadmap Issue
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health + Web App render smoke
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE
```

## Current runtime truth

Private primary store/runtime: Google Sheets + Apps Script; family UI: private `MYSELF` Apps Script Web Dashboard. Public GitHub finance/render evidence is independently generated synthetic only. DEV delivery is exact-SHA autonomous. PROD/cutover/destructive data actions remain separate policy gates. `FREE_ONLY` mandatory.

## Что намеренно не утверждается

BUD-020 не считается DONE до autonomous merge + Main Verification/Issue close. Budget projection не является FIN-TRUTH или balance/liquidity truth. BUD-020 не разрешает Google write. Historical MIG-010 authorization не переносится на future mutation. Private Dashboard не сделан публичным.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.

Stale lower-priority document никогда не разрешает bypass current machine gate.
