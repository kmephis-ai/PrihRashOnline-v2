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

- `DESIGN-020` — **DONE**, Issue #118 Main Verification PASS, PR #119 merge `9337dfb1288ebc3e0c746ab744b61bb1051e14ea`.
- `VIZ-020` — **DONE**, Issue #120 Main Verification PASS, PR #121 merge `66139972b1fc910fc7bc0e614ecfdc7d5b754adf`.
- `HOME-020` — **DONE**, Issue #122 Main Verification PASS, PR #123 merge `24e6e57e1b2b803dd0d2176376207fd524674dd3`.
- `TX-020` — **DONE**, Issue #124 Main Verification PASS, PR #125 merge `38a6d6bece459f61a2cf3d9af2cd8419274b258b`.
- `EXP-020` Expense Analytics — **IN_PROGRESS**, Issue #126; current R2 writer, branch `agent/EXP-020-expense-analytics`.

### Verified R2 foundations

`PRH_DESIGN_SYSTEM_V1@1.0.0` — presentation tokens/theme/a11y/responsive only.  
`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` — configuration-only ChartSpec/WidgetSpec, deterministic Filter/Drill contexts and replaceable `ECHARTS_6` adapter; no financial/query/storage/write authority.  
`PRH_FINANCIAL_HOME_V1@1.0.0` — one FIN-010 result, explicit budget, fail-safe liquidity capability state.  
`PRH_TRANSACTION_EXPLORER_V1@1.0.0` — canonical row search/filter/sort/pagination/edit-draft validation; generic runtime save remains `WRITE_BLOCKED` / `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

### EXP-020 current boundary

EXP-020 вводит `PRH_EXPENSE_ANALYTICS_V1@1.0.0` поверх FIN-010/ANL-010/VIZ-020/TX-020.

- primary/comparison Expense totals sourced from FIN-010 `evaluateKpis()`;
- trend состоит из explicit bounded buckets, каждый bucket имеет FIN-010 parity, сумма bucket totals равна period EXPENSE;
- category mix использует FIN-TRUTH `by_expense_category_minor`: expense добавляет, refund уменьшает, transfer нейтрален;
- сумма категорий обязана равняться EXPENSE, residual = 0; ambiguous negative category bucket fail-closed;
- comparable periods только explicit equal-day windows, без implicit proration;
- drivers = current category expense − comparison category expense; сумма drivers обязана равняться total Expense delta;
- VIZ WidgetSpecs `LINE` / `DONUT` / `BAR` configuration-only; render datasets передаются отдельно;
- drill использует `PRH_FILTER_CONTEXT_V1` + `PRH_DRILL_CONTEXT_V1` и bounded TX-020 query к `TRANSACTION_EXPLORER`; navigation state не содержит денежных значений;
- `ExpenseAnalyticsWebApp.html` — synthetic responsive evidence surface, не новый write/runtime authority;
- public telemetry: version/hash/count/status/reason metadata only, no financial payload;
- named gates: `Expense Analytics`, `Expense Analytics visual gate`;
- `FREE_ONLY` mandatory; external CDN/provider не требуется.

Normative doc: `docs/analytics/EXPENSE_ANALYTICS.md`. Core: `lib/expense/expense_analytics.js`. Tests: `tests/expense_analytics_contract_test.js`, `tests/expense_analytics_visual_test.js`.

INC-020/CF-020/BUD-020 и другие sibling items не входят в scope текущего writer.

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

- EXP-020 не считается DONE до autonomous merge + Main Verification/Issue close;
- Expense Analytics не владеет FIN formulas и не разрешает Google write;
- standalone synthetic Expense surface не означает публикацию private runtime route;
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
