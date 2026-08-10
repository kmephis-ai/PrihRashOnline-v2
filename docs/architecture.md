# Архитектура ПрихРасхOnline v2

## Текущее состояние

ПрихРасхOnline v2 — приватное household-finance приложение на Google Sheets + Apps Script. GitHub является инженерным **control plane** для code/tests/contracts/docs/policy и не является financial data store.

R0 (`MASTER-G0..G2`) и R1 `MASTER-G3 / Canonical platform` завершены. `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` прошли Main Verification. R2 `DESIGN-020`, `VIZ-020`, `HOME-020` также DONE. Текущий единственный R2 writer — `TX-020`.

Канонические entry points:

- `docs/ROADMAP.md` — executable order/dependencies;
- `docs/architecture/R1_C4_CONTEXT.md` — R1 context/trust boundaries;
- `docs/data/R1_DATA_LINEAGE.md` — end-to-end lineage;
- `docs/architecture/TRANSACTION_EXPLORER.md` + `lib/explorer/transaction_explorer.v1.json` — TX-020;
- `docs/design/DESIGN_SYSTEM.md` — DESIGN-020;
- `docs/architecture/VISUALIZATION_FOUNDATION.md` — VIZ-020;
- `lib/home/financial_home.v1.json` — HOME-020.

Google Sheets adapter остаётся текущим storage adapter; future YDB adapter должен проходить те же canonical/repository/financial contracts без big-bang domain rewrite.

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
DESIGN/VIZ/HOME/TX read/view layers
```

Lower view layers не переопределяют canonical/FIN authority.

## Canonical transaction + financial truth

Canonical schema: `PRH_CANONICAL_TRANSACTION_V1`. Financial contract: `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`.

**Legacy totals/cells не являются golden truth или authoritative financial source.** Financial calculations используют canonical records + FIN-010 evaluator. Transaction Explorer не вычисляет KPI.

## Pure application boundary — ARCH-010 — DONE

`PRH_APPLICATION_CORE_V1` имеет `io_authority: false`, `network_authority: false`, `financial_write_authority: false`. `SpreadsheetApp`, DOM/UI и network services запрещены внутри pure core.

## Repository boundary — ARCH-011 — DONE

`PRH_TRANSACTION_REPOSITORY_V1` отделяет domain от storage. Current Google adapter поддерживает bounded read/query; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

`source_position` — mutable adapter provenance и не является logical identity.

## Analytics boundary — ANL-010 — DONE

`PRH_ANALYTICS_CONTRACT_V1@1.0.0` renderer/storage-neutral; KPI measures делегируются FIN-010. Authority: `io=false`, `network=false`, `financial_write=false`, `ui=false`.

## Performance/read boundaries — PERF-010..014 — DONE

PERF-010 projection, PERF-011 exact-revision cache, PERF-012 single-scan refresh, PERF-013 incremental aggregates и PERF-014 synthetic 20k/50k gate оптимизируют reads/recompute, но не создают alternative FIN truth и не открывают writes. PERF-014 timings — CI guardrails, не production SLA.

## DESIGN-020 / VIZ-020 / HOME-020 — DONE

`PRH_DESIGN_SYSTEM_V1@1.0.0` — presentation tokens/theme/a11y/responsive authority only.  
`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` — configuration-only ChartSpec/WidgetSpec, Filter/Drill contexts, transient render dataset and replaceable renderer adapter; no financial/query/storage/write authority.  
`PRH_FINANCIAL_HOME_V1@1.0.0` — FIN-backed Home view composition. Budget missing -> `NOT_CONFIGURED`; liquidity without balance source -> `UNAVAILABLE_PENDING_BALANCE_SOURCE`; no fake cash-flow balance.

External CDN/paid provider не требуется; `FREE_ONLY` mandatory.

## Transaction Explorer boundary — TX-020 — IN_PROGRESS

Machine contract: `PRH_TRANSACTION_EXPLORER_V1@1.0.0`; human contract: `docs/architecture/TRANSACTION_EXPLORER.md`.

### Query/read authority

Explorer consumes validated `PRH_CANONICAL_TRANSACTION_V1` records and provides deterministic read projection only:

- date/account/category/member/type/status filters;
- bounded text search over `counterparty`, `description`, `tags`;
- allowlisted sort fields;
- stable `transaction_id` tie-breaker;
- SHA-256 normalized query identity;
- `OFFSET_LIMIT_V1`, default 50, max page 200.

Unknown query fields, invalid date ranges, invalid sort/filter values and oversized page/search requests fail closed.

### Result projection

`PRH_TRANSACTION_EXPLORER_ROW_V1` contains canonical display fields. Explorer does not aggregate rows, calculate Income/Expense/Cash Flow, or change transaction meaning. Real result rows are private runtime data.

### Edit draft and mutation boundary

`PRH_TRANSACTION_EDIT_DRAFT_V1` validates edits through DATA-010 `normalizeCanonicalTransaction()`.

Immutable fields: schema, schema version, transaction identity and provenance/source identity. A valid draft still has `financial_write_authorized=false`.

Runtime save is deliberately:

```text
WRITE_BLOCKED
GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED
```

TX-020 does not grant generic Google write authority. A future write policy must separately prove idempotency, preconditions, bounded scope, fresh backup, readback, reconciliation and rollback. Historical MIG authorization is non-reusable.

### Scale / UI

Synthetic 20k/50k tests exercise search/filter/sort/page behavior. `TransactionExplorerWebApp.html` is responsive desktop/laptop/mobile synthetic UI evidence with search, filters, sorting, pagination and edit drawer. It does not silently create or replace a private Apps Script route.

Named gates: `Transaction Explorer`, `Transaction Explorer visual gate`.

## MIG-010 historical boundary — DONE

Machine contract: `PRH_FULL_HISTORY_MIGRATION_V1@1.0.0`.

**Current write authority = false.** The **owner-verified MIG-010 private full-history reconciliation** remains the completed correctness proof; it does not grant later generic write authority.

Private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, provenance complete, idempotent rerun verified. Owner-confirmed preserve-all identity strategy: `CONTENT_FINGERPRINT_OCCURRENCE_V1`.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions/AI cannot reuse it for future mutations.

## Trust/privacy boundaries

### Public GitHub

Allowed: code/contracts/docs, independently generated synthetic finance/Home/Explorer/render fixtures, technical PASS/FAIL/hash/count/timing evidence.

Forbidden: real or **real-derived** transaction rows/IDs/amounts/aggregates/distributions, real Explorer/Home/render payload, private screenshots/exports, authenticated responses, OAuth, backup bytes/keys and private deployment locators.

### Private runtime

Google Sheets + Apps Script contain private household data. Web App remains `MYSELF`. Real transaction/search/Home/renderer payload is private and is not public telemetry.

## Observability / cost

OBS telemetry is allowlisted technical metadata only. Financial rows/values are not telemetry. `FREE_ONLY` mandatory; no paid search/table/CDN dependency is required.

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
Home / Transaction Explorer / domain dashboards
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
