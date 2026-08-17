# OBS-010 — SLO и error budget

Roadmap item: `OBS-010`  
Contract: `PRH_SLO_ERROR_BUDGET_V1@1.0.0`  
Cost class: `FREE_ONLY`  
Data class: synthetic/public-safe + private technical metadata only

## Назначение

OBS-010 добавляет детерминированный SLO/error-budget слой поверх существующего OBS-001 audit/telemetry baseline. Он не вычисляет финансовые KPI и не является источником финансовой истины. Его задача — одинаково интерпретировать bounded technical observations и выдавать privacy-safe machine health/error-budget state.

## Precision и window semantics

Ratios хранятся целыми `ppm` (`1_000_000 = 100%`), burn error budget — целыми `bps` (`10_000 = 100% бюджета`). Для good ratio используется integer floor, для budget burn — integer ceil. Это исключает floating-point расхождения между CI/runtime.

Evaluation window — half-open `[start_ms, end_ms)`. Timestamps задаются явно как integer Unix epoch milliseconds. Evaluator сам не читает wall clock, поэтому tests/replay deterministic.

## SLI v1

- `AVAILABILITY` — доля успешных technical health observations, objective `995000 ppm` = `99.5%`, minimum `20` samples;
- `LATENCY` — доля observations не медленнее `2000 ms`, objective `950000 ppm` = `95%`, minimum `20` samples;
- `CORRECTNESS` — PASS/FAIL только от allowlisted machine-contract evidence, objective `1000000 ppm` = `100%`, minimum `20` samples;
- `FRESHNESS` — доля observations с technical age не больше `900000 ms` = `15 минут`, objective `990000 ppm` = `99%`, minimum `5` samples;
- `MIGRATION_ERRORS` — доля technical migration/reconciliation observations без error, objective `1000000 ppm` = `100%`, minimum `20` samples.

Все thresholds/objectives/minimum sample counts versioned в `lib/observability/slo_error_budget.v1.json`.

## Error budget states

Для каждого SLI evaluator считает `observed_good_ppm`, `bad_sample_count`, `allowed_bad_ppm`, `consumed_bad_ppm`, `remaining_budget_ppm` и `budget_consumed_bps`.

Budget bands:

- `HEALTHY` — consumed budget `<= 5000 bps`; service status `PASS`;
- `WATCH` — `5001..8000 bps`;
- `CRITICAL` — `8001..10000 bps`;
- `BREACHED` — выше `10000 bps`.

Если telemetry недостаточна, результат `UNKNOWN`, а не implicit green. OBS-001 telemetry state `WARN` может деградировать observability state, но не меняет финансовую correctness authority; telemetry `FAIL` даёт `UNKNOWN/TELEMETRY_UNAVAILABLE`.

Для zero-tolerance `CORRECTNESS` и `MIGRATION_ERRORS` допустимый bad budget равен `0 ppm`: любое подтверждённое bad observation немедленно даёт `BREACHED`.

## Correctness authority

`CORRECTNESS` не принимает суммы, KPI values, canonical rows или произвольные payload. Observation обязан содержать allowlisted technical `source`:

- `FINANCIAL_RECONCILIATION`;
- `CANONICAL_SCHEMA`;
- `ANALYTICS_PARITY`;
- `MIGRATION_RECONCILIATION`;
- `RUNTIME_HEALTH`.

Финансовая семантика остаётся у FIN/DATA/ANL/MIG contracts. OBS-010 хранит только PASS/FAIL signal существующей machine authority; `financial_correctness=false` и `financial_write=false` закреплены в schema.

## Privacy boundary

Observation shapes deny-by-default: неизвестные поля отклоняются, а каждый SLI принимает только собственный bounded technical shape. `SecurityPrivacyPolicy.js` разрешает только SLO technical metadata (`sliId`, status, objective ppm, threshold ms, sample/bad counts, remaining budget ppm, budget burn bps, budget state, bounded reason code).

Existing forbidden financial field rules (`amount`, `income`, `expense`, `balance`, `description`, `category`, `account`, `transaction`, `payload` и др.) не ослабляются. `toAuditMetadata()` не переносит raw observations или correctness source в audit payload.

Public CI использует только independently generated synthetic observations. Real или real-derived household finance values в SLO evidence запрещены.

## Service aggregation и alerts

`evaluateService()` вычисляет все пять SLI и выбирает худшее состояние по versioned order. Raw observations в service result не возвращаются. `alert=true` только для `CRITICAL`, `BREACHED`, `UNKNOWN`; `WATCH` остаётся ранним предупреждением.

Этот contract предоставляет machine-safe state/report foundation. Он не требует внешнего dashboard SaaS и не делает Grafana/Prometheus обязательными.

## Cost и providers

Evaluator — локальный CommonJS-модуль без SpreadsheetApp, DOM, network, external provider или write API. `external_provider_required=false`, `paid_dependency_required=false`; `FREE_ONLY` остаётся обязательным.

## Machine evidence

Authoritative PR gate: `SLO error budget` -> `node tests/slo_error_budget_policy_contract_test.js`. Full layered suite также обязан включать этот test.

## Rollback

Revert OBS-010 contract/evaluator/test/docs/workflow integration и SLO technical allowlist fields. OBS-001 bounded audit journal, финансовые операции и runtime data migration не требуют восстановления.
