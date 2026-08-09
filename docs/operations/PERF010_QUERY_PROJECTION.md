# PERF-010 — query projection и minimal-range reads

Roadmap item: `PERF-010`  
Contract: `PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0`  
Depends on: `ARCH-011`  
Cost class: `FREE_ONLY`  
Data class: synthetic/public-safe tests + private runtime values never emitted as telemetry

## Цель

PERF-010 уменьшает объём чтения текущего Google Sheets adapter без изменения `PRH_TRANSACTION_REPOSITORY_V1`, canonical transaction semantics или финансовых KPI.

Ключевой принцип: **control-plane header discovery может читать одну полную строку заголовков; data-plane rows читаются только по явно requested mapped column spans и bounded row interval.**

## Read paths

### `readAll()` / `getRevision()`

Читают все canonical-required mapped headers, но не unmapped worksheet columns. На текущей synthetic 20-column fixture canonical mapping использует 15 columns.

### `getById(id)`

1. scan только header `ID` по data rows;
2. определить единственный source row;
3. дочитать full mapped projection только для этой строки;
4. преобразовать в прежний canonical transaction.

Duplicate ID fail-closed.

### `query(query)`

1. `normalizeQuery()` остаётся authoritative query-shape normalizer;
2. planner строит filter/sort projection: всегда `ID` + `Дата и время`, плюс только headers реально задействованных filters;
3. projected scan выбирает matching source row numbers и canonical ordering (`occurred_at`, `transaction_id`);
4. offset/limit применяются к matching set;
5. выбранные row numbers группируются в contiguous row intervals;
6. full mapped headers дочитываются только для выбранной page;
7. результат сохраняет прежний `PRH_REPOSITORY_QUERY_RESULT_V1` shape.

PERF-010 adapter logic не вычисляет KPI/amount semantics. Synthetic parity contract сравнивает projected query с authoritative `applyQuery()` на том же canonical set.

## Projection planner

`lib/adapters/google_sheets_projection.v1.json` versioned определяет:

- base query headers;
- mapping query filter -> source headers;
- strict read-request fields;
- two-phase query execution;
- privacy-safe read telemetry fields;
- отсутствие financial/write/network/paid-provider authority.

`lib/adapters/google_sheets_projection.js` реализует deterministic query header projection, source column spans и contiguous row grouping. Unknown header/request/projection fails closed.

## Apps Script gateway

`GoogleTransactionRepositoryGateway.js` version `1.1.0`:

- header row discovery: `getRange(1, 1, 1, lastColumn)`;
- validates complete required workbook header contract;
- data rows: one `getRange()` per requested contiguous column span;
- supports `required_headers`, optional `start_row`, `row_count`;
- no `getDataRange()`, `setValue(s)`, `appendRow`, delete/write path;
- returns `read_plan` with technical counts only.

`read_plan` does not contain transaction values, amounts, categories, descriptions, account IDs or source payload.

## Synthetic performance evidence

Current fixture: 4 rows, 20 source columns, 15 mapped canonical columns.

- old full-width data baseline: `80` cells;
- projected `readAll`: `60` cells;
- `getById`: `4 × ID + 1 × 15 = 19` cells;
- narrow type/status/category query: projected scan `5 × 4` + selected full row `15 = 35` cells.

These numbers are deterministic contract evidence, not production finance/runtime telemetry.

## Safety boundaries

- public finance test data independently generated synthetic only;
- financial values never enter projection telemetry;
- `writeBatch()` remains `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`;
- FIN-TRUTH, KPI Dictionary, Canonical Transaction, migration, analytics and SLO semantics unchanged;
- no cache/incremental aggregate semantics are introduced here;
- no paid provider; `FREE_ONLY` remains mandatory.

## Machine evidence

Named PR gate: `Query projection minimal ranges` -> `node tests/repository_projection_adapter_contract_test.js`.

Full TEST-010 layered suite must also include that test under `ADAPTER_INTEGRATION`.

## Rollback

Revert projection planner, gateway projected-read behavior, adapter two-phase reads, tests/docs/workflow integration. ARCH-011 repository interface/canonical semantics and blocked write policy remain unchanged.
