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

FIN-010 authority: `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`.  
DATA-010 authority: `PRH_CANONICAL_TRANSACTION_V1`.  
ARCH-010: `PRH_APPLICATION_CORE_V1`, `io_authority: false`, no network/financial-write authority.  
ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.  
ANL-010: `PRH_ANALYTICS_CONTRACT_V1@1.0.0`; renderer/storage-neutral, `financial_write=false`.  
PERF-010..014 do not redefine FIN-TRUTH.  
DOC-010: `PRH_R1_DOCUMENTATION_V1@1.0.0`.

### MASTER-G3 / Canonical platform — **complete**; historical pre-close state: open

`FIN-010 + DATA-010 + ARCH-010 + ARCH-011 + ANL-010 + MIG-010 + PERF-014 + DOC-010 = DONE`; private full-history reconciliation = PASS; independently generated synthetic 20k/50k performance = PASS.

## R2 / Family Finance Center — текущая волна

- `DESIGN-020` — **DONE**, Issue #118 Main Verification PASS.
- `VIZ-020` — **DONE**, Issue #120 Main Verification PASS.
- `HOME-020` — **DONE**, Issue #122 Main Verification PASS.
- `TX-020` — **DONE**, Issue #124 Main Verification PASS.
- `EXP-020` — **DONE**, Issue #126 Main Verification PASS.
- `INC-020` — **DONE**, Issue #128 Main Verification PASS, PR #129 merge `507e2cd32f28104b1a81bc02aa7856be41be58b2`.
- `CF-020` Cash Flow dashboard — **IN_PROGRESS**, Issue #130; current R2 writer, branch `agent/CF-020-cash-flow-dashboard`.

### Verified R2 foundations

`PRH_DESIGN_SYSTEM_V1@1.0.0` — presentation-only.  
`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` — configuration-only ChartSpec/WidgetSpec + Filter/Drill context, no financial/query/storage/write authority.  
`PRH_FINANCIAL_HOME_V1@1.0.0` — FIN-backed Home composition; liquidity is not proxied from Cash Flow.  
`PRH_TRANSACTION_EXPLORER_V1@1.0.0` — canonical exploration/edit-draft validation; runtime save remains `WRITE_BLOCKED` / `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.  
`PRH_EXPENSE_ANALYTICS_V1@1.0.0` — FIN-backed Expense analysis, DONE.  
`PRH_INCOME_ANALYTICS_V1@1.0.0` — FIN-backed Income source/time/stability analysis, DONE.

### CF-020 current boundary

CF-020 вводит `PRH_CASH_FLOW_DASHBOARD_V1@1.0.0` поверх FIN-010/HOME-020/VIZ-020/TX-020.

- `inflow = FIN-010 INCOME`;
- `outflow = FIN-010 EXPENSE`;
- `net = FIN-010 CASH_FLOW`;
- `inflow - outflow = net` проверяется для period, comparison и каждого trend bucket;
- DAY/MONTH/YEAR dynamics используют отдельный FIN-010 evaluation на bucket; суммы buckets обязаны совпадать с period totals;
- transfers нейтральны и не входят в inflow/outflow/net или drill component filters;
- refund влияет на outflow только через FIN-TRUTH Expense semantics;
- comparison — только explicit equal-day windows, `implicit_proration=false`;
- `Δ inflow - Δ outflow = Δ net` является обязательным conservation invariant;
- VIZ specs configuration-only: net LINE, inflow BAR, outflow BAR, comparison BAR; real render data separate/private;
- drill использует VIZ context + bounded TX query: INFLOW=`income`, OUTFLOW=`expense/refund`, NET=`income/expense/refund`; transfer excluded;
- navigation state не содержит денежных значений и не даёт write authority;
- `liquidity_state = NOT_A_BALANCE_METRIC`, `account_balance_authority=false`; Cash Flow не заменяет balance/liquidity truth;
- `CashFlowWebApp.html` — synthetic responsive evidence surface;
- public telemetry: version/hash/bucket-count/status/reason/timing only;
- named gates: `Cash Flow`, `Cash Flow visual gate`;
- `FREE_ONLY` mandatory; external CDN/provider не требуется.

Normative doc: `docs/analytics/CASH_FLOW_DASHBOARD.md`. Core: `lib/cashflow/cash_flow_dashboard.js`. Tests: `tests/cash_flow_dashboard_contract_test.js`, `tests/cash_flow_visual_test.js`.

BUD-020/OBL-020/PWA-020 и другие sibling items не входят в scope текущего writer.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`.

Historical machine anchors: **Current write authority = false**. The **owner-verified MIG-010 private full-history reconciliation** remains completed correctness proof.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Any future irreversible financial write requires fresh exact-bound owner authorization.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract. `AIENG-001`, `AIENG-002`, `AIENG-003` are DONE.

`tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` enforce one-writer continuation. Read-only multi-AI reviewers always have `writer_authority=false`; machine gates and Main Verification remain authoritative.

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

- private primary store/runtime: Google Sheets + Apps Script;
- family UI: private `MYSELF` Apps Script Web Dashboard;
- public GitHub finance/render evidence: independently generated synthetic only;
- DEV delivery exact-SHA autonomous;
- PROD/cutover/destructive data actions — separate policy gates;
- `FREE_ONLY` mandatory.

## Что намеренно не утверждается

- CF-020 не считается DONE до autonomous merge + Main Verification/Issue close;
- Cash Flow не является balance/liquidity/Net Worth truth;
- CF-020 не разрешает Google write;
- standalone synthetic Cash Flow surface не означает публикацию private runtime route;
- historical MIG-010 authorization не переносится на future mutation;
- Google -> Yandex cutover не выполнен;
- private Dashboard не сделан публичным;
- paid cloud/AI/OCR/observability/cache/design/visualization provider не включён.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.

Stale lower-priority document никогда не разрешает bypass current machine gate.
