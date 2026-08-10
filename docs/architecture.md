# Архитектура ПрихРасхOnline v2

## Текущее состояние

ПрихРасхOnline v2 — приватное household-finance приложение на Google Sheets + Apps Script. GitHub — инженерный **control plane** для code/tests/contracts/docs/policy и не является financial data store.

R0 (`MASTER-G0..G2`) и R1 `MASTER-G3 / Canonical platform` завершены. R2 `DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020` DONE/Main Verification PASS. Текущий единственный R2 writer — `EXP-020`.

Канонические entry points:

- `docs/ROADMAP.md` — executable order/dependencies;
- `docs/architecture/R1_C4_CONTEXT.md` — R1 context/trust boundaries;
- `docs/data/R1_DATA_LINEAGE.md` — end-to-end lineage;
- `docs/analytics/EXPENSE_ANALYTICS.md` + `lib/expense/expense_analytics.v1.json` — EXP-020;
- `docs/architecture/TRANSACTION_EXPLORER.md` — verified TX-020;
- `docs/design/DESIGN_SYSTEM.md` — DESIGN-020;
- `docs/architecture/VISUALIZATION_FOUNDATION.md` — VIZ-020.

Google Sheets adapter остаётся current storage adapter; future YDB adapter должен проходить те же canonical/repository/financial contracts без big-bang domain rewrite.

## Основной поток authority

```text
private Google Sheets
        ↓ adapter
PRH_TRANSACTION_REPOSITORY_V1
        ↓
PRH_CANONICAL_TRANSACTION_V1
        ↓
FIN-TRUTH-v1 / PRH_KPI_DICTIONARY_V1
        ↓
PRH_ANALYTICS_CONTRACT_V1
        ↓
EXP-020 FIN-backed expense read model
        ↓
VIZ / TX drill / UI presentation
```

Lower read/view layers не переопределяют canonical/FIN authority.

## Canonical transaction + financial truth

Canonical schema: `PRH_CANONICAL_TRANSACTION_V1`. Financial contract: `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`.

**Legacy totals/cells не являются golden truth или authoritative financial source.** Financial calculations используют canonical records + FIN-010 evaluator. UI/VIZ/TX/EXP не создают альтернативную financial truth.

## Pure application boundary — ARCH-010 — DONE

`PRH_APPLICATION_CORE_V1` имеет `io_authority: false`, `network_authority: false`, `financial_write_authority: false`. `SpreadsheetApp`, DOM/UI и network services запрещены внутри pure core.

## Repository boundary — ARCH-011 — DONE

`PRH_TRANSACTION_REPOSITORY_V1` отделяет domain от storage. Current Google adapter поддерживает bounded read/query; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

`source_position` — mutable adapter provenance и не является logical identity.

## Analytics boundary — ANL-010 — DONE

`PRH_ANALYTICS_CONTRACT_V1@1.0.0` renderer/storage-neutral; KPI measures делегируются FIN-010. Authority: `io=false`, `network=false`, `financial_write=false`, `ui=false`.

## Performance/read boundaries — PERF-010..014 — DONE

Projection/cache/single-scan/incremental aggregates/synthetic scale optimize reads/recompute but do not create alternative FIN truth or write authority. PERF-014 timings are CI guardrails, not production SLA.

## DESIGN / VIZ / HOME / TX — DONE

`PRH_DESIGN_SYSTEM_V1@1.0.0` — presentation tokens/theme/a11y/responsive only.  
`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` — configuration-only ChartSpec/WidgetSpec, Filter/Drill contexts, transient render dataset and replaceable renderer adapter; no financial/query/storage/write authority.  
`PRH_FINANCIAL_HOME_V1@1.0.0` — FIN-backed Home view composition.  
`PRH_TRANSACTION_EXPLORER_V1@1.0.0` — canonical read/search/edit-draft layer; runtime save remains `WRITE_BLOCKED` with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

External CDN/paid provider не требуется; `FREE_ONLY` mandatory.

## Expense Analytics boundary — EXP-020 — IN_PROGRESS

Machine contract: `PRH_EXPENSE_ANALYTICS_V1@1.0.0`; human contract: `docs/analytics/EXPENSE_ANALYTICS.md`.

### Financial source

Primary and comparison Expense totals come from FIN-010 `evaluateKpis()`. Trend buckets also use FIN-010, and their exact sum must equal period Expense. EXP-020 does not duplicate gross expense/refund/transfer formulas.

### Category mix

Category partition uses FIN-TRUTH `aggregateTransactions()` / `by_expense_category_minor`: expense adds, refund reduces, transfer is neutral. Category sum must equal period EXPENSE and residual must be zero. A negative category bucket is fail-closed rather than silently coerced for DONUT rendering.

### Comparison / drivers

Only explicit equal-day windows are comparable; implicit proration is forbidden. Driver per category = current FIN-backed category Expense − comparison FIN-backed category Expense. Sum of all drivers must equal total Expense delta.

### Visualization / drill

EXP produces configuration-only VIZ WidgetSpecs: `LINE`, `DONUT`, `BAR`; runtime data remains separate. Drill uses `PRH_FILTER_CONTEXT_V1` / `PRH_DRILL_CONTEXT_V1` and maps to bounded `PRH_TRANSACTION_EXPLORER_QUERY_V1`. Navigation context contains no financial payload.

### Authority / privacy

EXP has no storage/network/financial-write authority. Public tests/screenshots are independently generated synthetic only. Public telemetry is limited to hashes/counts/status/reason/timing metadata. `ExpenseAnalyticsWebApp.html` is synthetic browser evidence and does not silently create a private route.

Named gates: `Expense Analytics`, `Expense Analytics visual gate`.

## MIG-010 historical boundary — DONE

Machine contract: `PRH_FULL_HISTORY_MIGRATION_V1@1.0.0`.

**Current write authority = false.** The **owner-verified MIG-010 private full-history reconciliation** remains completed correctness proof; it does not grant later generic write authority.

Private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, provenance complete, idempotent rerun verified. Owner-confirmed identity strategy: `CONTENT_FINGERPRINT_OCCURRENCE_V1`.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion before post-write reconciliation.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions/AI cannot reuse it for future mutations.

## Trust/privacy boundaries

### Public GitHub

Allowed: code/contracts/docs, independently generated synthetic finance/Home/TX/EXP/render fixtures, technical PASS/FAIL/hash/count/timing evidence.

Forbidden: real or **real-derived** transaction rows/IDs/amounts/aggregates/distributions, real Explorer/Home/Expense/render payload, private screenshots/exports, authenticated responses, OAuth, backup bytes/keys and private deployment locators.

### Private runtime

Google Sheets + Apps Script contain private household data. Web App remains `MYSELF`. Real financial/query/render payload stays private and is not public telemetry.

## Observability / cost

OBS telemetry is allowlisted technical metadata only. Financial rows/values are not telemetry. `FREE_ONLY` mandatory; no paid analytics/CDN/search provider is required.

## Delivery trust chain

```text
PR Validation
  ↓
Trusted DEV Deploy
  ↓
Trusted Runtime Health
  ↓
CI-003 autonomous squash merge
  ↓
Main Verification
```

Delivery PASS does not authorize financial mutation.

## Target architecture

```text
PWA / family clients
        ↓
Home / Expense Analytics / Transaction Explorer / domain dashboards
        ↓
DESIGN + VIZ view adapters
        ↓
Application + Analytics
        ↓
Canonical domain + FIN rules
        ↓
PRH_TRANSACTION_REPOSITORY_V1
        ↓
Google Sheets adapter  <->  future YDB adapter
```

## Documentation authority / fail-closed

Source precedence: security/privacy/cost/irreversible policy → `docs/ROADMAP.md` + live Issues → exact-SHA code/tests/workflows → versioned contracts → human docs.

Red CI is fixed on the same writer branch. Markdown never overrides a failing machine gate.
