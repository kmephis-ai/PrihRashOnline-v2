# Модель данных и границы записи

## Текущее положение

Google Sheets остаётся private primary store/current adapter. Public GitHub не является финансовой базой и не содержит real/real-derived household finance data.

R1 (`FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010`) завершён Main Verification; `MASTER-G3 / Canonical platform` complete. R2 `DESIGN-020`, `VIZ-020`, `HOME-020` — DONE. Текущий единственный writer — `TX-020`.

## Основные private sheets

| Лист | Роль | Write boundary |
|---|---|---|
| `01 Операции` | canonical transaction surface | Dashboard/Home/TX read-only; mutation only by separately proven policy |
| `09 Настройки` | technical settings/status | bounded technical writes |
| `10 Контроль` | private KPI/control snapshots | separately authorized append/readback |
| `11 Предпросмотр` | proposal staging/review | proposal state, not canonical truth |
| `13 Журнал` | privacy-safe technical audit | bounded technical append |
| `14 Аналитика` | spreadsheet analytics/fallback | not canonical FIN truth |

Generic Google canonical write remains fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Financial truth

`PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1` owns Income / Expense / Cash Flow / Savings / Budget variance semantics, transfer/refund behavior, integer minor units and explicit period/currency rules.

Legacy totals are not golden truth. Analytics, performance, VIZ, HOME and TX do not create alternative financial formulas.

## Canonical Transaction v1

`PRH_CANONICAL_TRANSACTION_V1` defines stable transaction identity, RFC3339 occurred time, type/status, integer `amount_minor`, currency, household dimensions and provenance.

`source_position` is mutable adapter provenance and **не является logical identity**. Spreadsheet columns/header order are adapter concerns.

## Repository / storage

`PRH_TRANSACTION_REPOSITORY_V1` separates canonical data from storage. Current Google adapter supports read/query. Generic Google write is blocked by `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Analytics / performance — DONE

`ANL-010` — DONE; `PRH_ANALYTICS_RESULT_V1` is a derived read model, not persistence/financial authority.  
`PERF-010..014` — DONE; projection/cache/single-scan/incremental aggregates/synthetic scale are derived read/performance layers and do not authorize writes.

## DESIGN / VIZ / HOME — DONE

Design theme/layout state is presentation-only. VIZ specs are configuration-only; real renderer datasets/options remain private transient data. `PRH_FINANCIAL_HOME_VIEW_V1` is a derived private Home view model and does not create storage authority.

HOME budget is explicit-only; missing plan -> `NOT_CONFIGURED`. Liquidity has no value until a versioned balance observation source; `UNAVAILABLE_PENDING_BALANCE_SOURCE` prevents cash-flow-as-balance drift.

## TX-020 Transaction Explorer view model

Machine contract: `PRH_TRANSACTION_EXPLORER_V1@1.0.0`.

Explorer adds **no canonical entity and no persistent table**. It operates over validated canonical records and returns `PRH_TRANSACTION_EXPLORER_ROW_V1` projections.

### Query state

`PRH_TRANSACTION_EXPLORER_QUERY_V1` contains only query configuration:

- explicit date range;
- account/category/member/type/status filter IDs;
- bounded text search;
- allowlisted sort field/direction;
- offset/limit;
- deterministic SHA-256 query identity.

Query state contains no calculated KPI truth. A private query may reference private IDs in memory; those IDs are not public telemetry/evidence.

### Result rows

Explorer result rows contain canonical display fields including transaction identity, occurred time, dimensions and exact canonical `amount_minor`. These values remain private at runtime. Public tests/screenshots use independently generated synthetic records only.

Result rows are not aggregates, cache authority or new storage. Explorer does not rewrite canonical values during projection.

### Edit draft

`PRH_TRANSACTION_EDIT_DRAFT_V1` is transient validation state:

```text
original canonical transaction
        + allowlisted patch
        ↓
PRH_CANONICAL_TRANSACTION_V1 validator
        ↓
VALID | INVALID
```

Immutable fields: schema, schema_version, transaction_id and provenance/source identity. `VALID` means schema-valid only; it does not mean write-authorized.

### Save state

Current TX save path is explicitly:

```text
WRITE_BLOCKED
reason = GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED
financial_write_authorized = false
```

No new sheet/table/cache/write log is created by TX-020. A future write-enabled editor requires a separate versioned financial-write policy with idempotency, preconditions, backup, readback, reconciliation and rollback.

## MIG-010 historical boundary

MIG-010 deterministic full-history migration — **DONE / OWNER_VERIFIED**. Private post-write evidence: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, provenance complete, idempotent rerun verified.

Owner-confirmed occurrence identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable; GitHub Actions/AI cannot reuse it for future edits. Generic Google write authority remains false.

## Recovery / observability

DR-001 owner backup is private/encrypted. OBS telemetry permits technical metadata only; financial values, canonical rows, private Explorer query/result/edit candidates are not public telemetry.

TX public telemetry allowlist: schema/version/query hash, matched/page counts, offset/limit, elapsed time, edit state and reason code.

## Public GitHub privacy boundary

Allowed: code/contracts/docs, independently generated synthetic finance/Home/Explorer/render fixtures and technical PASS/FAIL/hash/count/timing evidence.

Forbidden: real or **real-derived** transaction rows/IDs/amounts/totals/aggregates/category distributions/seasonality, private Explorer/Home/render payload, screenshots/exports/reports, authenticated responses, OAuth/private clasp, backup bytes/key or private deployment locators.

`FREE_ONLY` mandatory. External paid search/table/CDN provider is not required.

## Canonical / derived hierarchy

```text
PRH_CANONICAL_TRANSACTION_V1       canonical data authority
        ↓
FIN-TRUTH-v1 / KPI Dictionary     financial semantics
        ↓
Analytics/read models              derived analysis
        ↓
Home / Transaction Explorer       derived private view state
        ↓
UI                                presentation only
```

Lower layers cannot override higher financial/data authority. `TX-020` is the single current R2 writer.
