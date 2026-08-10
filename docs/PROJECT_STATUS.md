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

- `FIN-010` Versioned KPI Dictionary — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` Canonical transaction schema v1 — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` Pure domain/application core — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` Repository interfaces + Google Sheets adapter — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` Deterministic full-history migration — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` Analytics extension contract v1 — **DONE**, Issue #98 Main Verification PASS.
- `TEST-010` Layered test architecture — **DONE**, Issue #100 Main Verification PASS.
- `OBS-010` SLO/error-budget layer — **DONE**, Issue #103 Main Verification PASS.
- `PERF-010` Query projection/minimal ranges — **DONE**, Issue #105 Main Verification PASS.
- `PERF-011` Revision-aware read cache — **DONE**, Issue #108 Main Verification PASS.
- `PERF-012` Single-scan refresh pipeline — **DONE**, Issue #110 Main Verification PASS.
- `PERF-013` Incremental analytics aggregates — **DONE**, Issue #112 Main Verification PASS.
- `PERF-014` Synthetic scale performance gates — **DONE**, Issue #114 Main Verification PASS.
- `DOC-010` Architecture/data/KPI/operations documentation contract — **DONE**, Issue #116 Main Verification PASS.

FIN-010 authority: `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`.  
DATA-010 authority: `PRH_CANONICAL_TRANSACTION_V1`.  
ARCH-010: `PRH_APPLICATION_CORE_V1`, no I/O/network/financial-write authority.  
ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write остаётся fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.  
ANL-010: `PRH_ANALYTICS_CONTRACT_V1@1.0.0`; renderer/storage-neutral, `financial_write=false`.  
PERF-010..014 read/performance layers не меняют FIN-TRUTH.  
DOC-010: `PRH_R1_DOCUMENTATION_V1@1.0.0`; documentation coherence only.

### MASTER-G3 / Canonical platform — **complete**; historical pre-close state: open

`FIN-010 + DATA-010 + ARCH-010 + ARCH-011 + ANL-010 + MIG-010 + PERF-014 + DOC-010 = DONE`; private full-history reconciliation = PASS; independently generated synthetic 20k/50k performance = PASS.

## R2 / Family Finance Center — текущая волна

- `DESIGN-020` Design system + responsive shell — **DONE**, Issue #118 Main Verification PASS, PR #119 autonomous merge `9337dfb1288ebc3e0c746ab744b61bb1051e14ea`.
- `VIZ-020` Versioned visualization foundation — **DONE**, Issue #120 Main Verification PASS, PR #121 autonomous merge `66139972b1fc910fc7bc0e614ecfdc7d5b754adf`.
- `HOME-020` Financial Home dashboard — **IN_PROGRESS**, Issue #122; current R2 writer, branch `agent/HOME-020-financial-home`.

### DESIGN-020 verified boundary

`PRH_DESIGN_SYSTEM_V1@1.0.0` задаёт semantic typography/color/spacing/radius/elevation/focus/motion tokens, light/dark themes, `:focus-visible`, reduced-motion policy и responsive breakpoints 760/1250 px. External CDN/font/design provider не требуется; `FREE_ONLY` сохраняется.

### VIZ-020 verified boundary

`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` определяет configuration-only `PRH_CHART_SPEC_V1` / `PRH_WIDGET_SPEC_V1`, chart registry (`BAR`, `LINE`, `DONUT`), deterministic `PRH_FILTER_CONTEXT_V1` / `PRH_DRILL_CONTEXT_V1`, transient runtime render dataset и replaceable `ECHARTS_6` adapter. Specs не содержат financial rows/amount payload. Real renderer data/options остаются private runtime data. Renderer не имеет query/network/storage/persistence/financial-write authority; external CDN не требуется; `FREE_ONLY` mandatory.

### HOME-020 current boundary

HOME-020 вводит `PRH_FINANCIAL_HOME_V1@1.0.0` и `PRH_FINANCIAL_HOME_VIEW_V1` поверх FIN-010 + VIZ-020 + DESIGN-020.

- Income / Expense / Cash Flow / Savings / Budget variance происходят из одного FIN-010 `evaluateKpis()` result; Home/UI не дублируют KPI formulas.
- Budget требует explicit `budget_minor` того же периода/валюты; без плана state = `NOT_CONFIGURED`.
- Liquidity **не** подменяется cash flow. Пока versioned balance-observation source отсутствует, state = `UNAVAILABLE_PENDING_BALANCE_SOURCE`, future dependency = `BAL-030`.
- Alerts используют versioned explainable predicates над already-evaluated FIN outputs/capability states: `NEGATIVE_CASH_FLOW`, `BUDGET_OVERRUN`, `BUDGET_NOT_CONFIGURED`, `LIQUIDITY_SOURCE_UNAVAILABLE`.
- Drill navigation использует `PRH_HOME_DRILL_ENVELOPE_V1` + VIZ `PRH_DRILL_CONTEXT_V1`; period и FilterContext сохраняются, financial values в navigation state не помещаются.
- Home WidgetSpecs остаются configuration-only; real Home view/render data private, public tests independently generated synthetic only.
- `FinancialHomeWebApp.html` — responsive synthetic/browser UI evidence; existing private Dashboard остаётся совместимым до explicit navigation/runtime integration.
- named gates: `Financial Home` + `Financial Home visual gate`.

Следующие R2 dashboards (`EXP-020`, `INC-020` и другие зависимые work items) не берутся этим writer и остаются dependency-gated канонической Roadmap.

## MIG-010 historical safety boundary

Owner-private MIG-010 evidence: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Private post-write reconciliation = PASS. Generic repository write authority не изменилась.

Owner-confirmed duplicate-preservation capability remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`; это public-safe имя identity strategy без private resolution payload.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` была exact-bound и не переносится: GitHub Actions/AI не могут создать или повторно использовать её для future mutations. Новый irreversible financial write требует нового exact-bound owner authorization.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract.

- `AIENG-001 + AIENG-002 + AIENG-003 = DONE`;
- `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` enforce one-writer continuation;
- `tools/multi-ai-review-protocol.js` поддерживает read-only exact-candidate review;
- reviewers всегда `READ_ONLY`, `writer_authority=false`; unresolved P0/P1 blocks supplementary review evidence;
- required checks deterministic/local; paid AI/API dependency не требуется.

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
- existing Dashboard native SVG renderer остаётся рабочим; VIZ-020 foundation не означал silent cutover;
- HOME-020 browser surface пока является new responsive view contract/synthetic gate и не объявляет новый private runtime route без отдельной integration boundary;
- public GitHub finance/render evidence: independently generated synthetic only;
- DEV delivery exact-SHA autonomous;
- PROD/cutover/destructive data actions — отдельные policy gates;
- `FREE_ONLY` mandatory; paid-by-usage provider activation не автоматический.

## Что намеренно не утверждается

- HOME-020 не считается DONE до autonomous merge + Main Verification/Issue close;
- liquidity value не существует без versioned balance source;
- budget plan не выводится из истории автоматически;
- HOME-020 не даёт financial write/storage/network authority;
- Google -> Yandex cutover не выполнен;
- private Dashboard не сделан публичным;
- public Git history rewrite не authorized/executed;
- paid cloud/AI/OCR/observability/cache/design/visualization provider не включён.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.

Stale lower-priority document никогда не разрешает bypass current machine gate.
