# OBS-010 — SLO и error budget

Roadmap item: `OBS-010`  
Contract: `PRH_SLO_CONTRACT_V1@1.0.0`  
Cost class: `FREE_ONLY`  
Data class: synthetic/public-safe + private technical metadata only

## Назначение

OBS-010 добавляет детерминированный слой SLO поверх существующего OBS-001 audit/telemetry baseline. Он не вычисляет финансовые KPI и не является источником финансовой истины. Его задача — одинаково интерпретировать технические observations и выдавать ограниченный privacy-safe health/error-budget report.

## SLI v1

- `availability` — доля успешных технических health observations, objective `99.5%`;
- `latency` — доля observations не медленнее `1500 ms`, objective `95%`;
- `correctness` — PASS/FAIL только от allowlisted machine-contract evidence, objective `100%`;
- `freshness` — доля observations не старше `15 минут`, objective `99%`;
- `migration_errors` — доля проверенных migration/reconciliation units без технически зафиксированной ошибки, objective `100%`.

Все thresholds/objectives/minimum sample counts versioned в `lib/observability/slo.v1.json`. Тесты передают явные timestamps/durations; evaluator не читает wall clock, SpreadsheetApp, DOM, network или внешний provider.

## Error budget

Для каждого SLI evaluator считает `good_count`, `bad_count`, `total_count`, допустимое число bad observations и остаток error budget. Состояния:

- `PASS` — достаточно samples и bad observations нет;
- `DEGRADED` — bad observations есть, но versioned budget ещё не превышен;
- `EXHAUSTED` — bad observations больше допустимого budget;
- `INSUFFICIENT_DATA` — observations есть, но minimum sample threshold ещё не достигнут;
- `UNKNOWN` — observations для SLI отсутствуют.

Aggregate state: `FAIL`, если хотя бы один SLI `EXHAUSTED`; `WARN`, если нет exhausted, но есть `DEGRADED`, `INSUFFICIENT_DATA` или `UNKNOWN`; иначе `PASS`.

## Correctness authority

`correctness` не принимает суммы, KPI values, canonical rows или произвольные payload. В v1 разрешены только bounded technical sources:

- `FINANCIAL_RECONCILIATION`;
- `CANONICAL_SCHEMA`;
- `ANALYTICS_PARITY`;
- `MIGRATION_RECONCILIATION`;
- `RUNTIME_HEALTH`.

Финансовая семантика остаётся у FIN/DATA/ANL/MIG contracts. OBS-010 хранит только факт PASS/FAIL соответствующей machine authority.

## Privacy boundary

Observation schema deny-by-default. Unknown field отклоняется. `SecurityPrivacyPolicy.js` разрешает только SLO technical metadata (`sliId`, status, objective, threshold, counts, remaining budget, bounded reason code). Existing forbidden financial field rules (`amount`, `income`, `expense`, `balance`, `description`, `category`, `account`, `transaction`, `payload` и др.) не ослабляются.

Public CI использует только synthetic observations. Real или real-derived household finance values в SLO evidence запрещены.

## Cost и providers

Evaluator — локальный CommonJS-модуль без network/provider dependency. Prometheus, Grafana, внешняя БД или monitoring SaaS не являются required dependency. `FREE_ONLY` остаётся обязательным.

## Rollback

Revert OBS-010 contract/evaluator/tests/docs и SLO allowlist fields. OBS-001 bounded audit journal, финансовые операции и runtime data migration не требуют восстановления.
