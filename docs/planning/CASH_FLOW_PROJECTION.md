# PROJ-030 — Cash-flow Projection

## Назначение

`PRH_CASH_FLOW_PROJECTION_V1@1.0.0` создаёт объяснимый deterministic baseline для будущего cash flow. Projection — это **модель/сценарий**, а не финансовая истина и не наблюдение. `FIN-TRUTH-v1`, KPI Dictionary и canonical transactions остаются неизменными.

Observed facts поступают только из `PRH_LONG_TERM_TRENDS_V1@1.0.0`: monthly, ungrouped, `comparison=NONE`, measure `CASH_FLOW`. TREND/ANL-010 остаются единственным источником фактического cash flow.

## Observed history

Модель использует только complete monthly buckets. Partial месяц не применяется к baseline/backtest, чтобы неполный период не выглядел как полный факт. Требуется минимум шесть непрерывных complete months — это даёт 3 месяца начального окна и минимум 3 walk-forward backtest samples.

Каждый observed month обязан быть обычным ANL-010 result с `grain=NONE`. Gap между complete monthly buckets даёт fail-closed вместо скрытого заполнения истории.

## Deterministic baseline

Model ID: `ROLLING_MEAN_3_COMPLETE_MONTHS_V1`.

Для backtest прогноз месяца `t` вычисляется только из трёх observed месяцев `t-3..t-1`. Future fact access запрещён. Среднее считается в exact integer minor units с `INTEGER_DIVISION_HALF_AWAY_FROM_ZERO`.

Future forecast использует `FIXED_ORIGIN_MEAN`: среднее последних трёх complete observed months вычисляется один раз в forecast origin и остаётся baseline для всего horizon. Это специально простой baseline; DS-052 позднее сможет сравнивать forecast model v1 с ним, но не заменяет его молча.

## Backtest

Walk-forward backtest публикует внутри private result:

- `sample_count`;
- `mean_absolute_error_minor`;
- `mean_error_minor`;
- points с prediction/actual/error для synthetic/private runtime analysis.

Public telemetry не содержит эти финансовые величины.

## Uncertainty band

Текущий метод — `BACKTEST_MAE_SYMMETRIC`:

`lower = projected - MAE`, `upper = projected + MAE`.

Это **не statistical confidence interval** и не probability statement. Contract явно хранит `statistical_confidence_interval=false`. Band показывает исторический масштаб ошибки простого deterministic baseline и не должен интерпретироваться как гарантия.

## Scenario layer

Scenario отделён от observed facts:

- horizon: 1..12 месяцев;
- `monthly_adjustment_minor` — explicit signed adjustment каждого будущего месяца;
- optional `one_off_adjustments` — explicit signed adjustment конкретного future month.

Каждая forecast row раздельно хранит `baseline_cash_flow_minor`, `scenario_adjustment_minor`, `projected_cash_flow_minor`, `uncertainty_lower_minor`, `uncertainty_upper_minor`. Scenario не переписывает observed trend или canonical history.

One-off month обязан попадать в выбранный horizon; duplicate month запрещён. Arithmetic работает только в safe integer minor units и fail-closed при overflow/invalid value.

## Границы Roadmap

PROJ-030 не реализует:

- ML/DS forecast (`DS-052`);
- balance/net-worth projection;
- Goals/Wish-list (`GOAL-030`);
- liquidity/risk (`RISK-030`);
- финансовую запись или scenario-to-canonical mutation.

Optional ML в будущем должен сравниваться с этим deterministic baseline и иметь отдельную model/evaluation authority.

## Provenance и privacy

Projection result ссылается на TREND, Period Engine, AnalyticsQuery, KPI Dictionary и `FIN-TRUTH-v1`, но содержит `financial_truth=false`, `projection_not_observation=true`, `future_fact_access=false`, `scenario_separate_from_observed=true`, `canonical_mutation=false`.

Public CI использует только independently generated synthetic finance data. Telemetry содержит только model ID/kind, observed/backtest/horizon counts, one-off count, uncertainty method и status/reason code — без cash-flow values, MAE amounts, private IDs или scenario financial payload.

## Стоимость и authority

`FREE_ONLY` mandatory. Внешний model/API/network/storage не требуется. Contract имеет `financial_truth=false`, `financial_write=false`, `canonical_mutation=false`, `storage/network/runtime/model_provider=false`.

## Machine gate

Named gate `Cash-flow projection` выполняет `tests/cash_flow_projection_contract_test.js`. Он проверяет fixed-origin baseline, half-away rounding, walk-forward no-lookahead, exact synthetic MAE/mean error, scenario separation, uncertainty band, partial-month exclusion, short-history/gap/shape failures, one-off horizon validation, input immutability и privacy-safe telemetry.

Gate относится к `PURE_DOMAIN_APPLICATION`.

## Definition of Done

PROJ-030 завершён только после green named gate, existing TREND/FIN/MIG/analytics/profile/AI/LANG-RU/privacy/FREE_ONLY/full layered/UI/PWA regressions, immutable exact candidate, Trusted DEV Deploy, Trusted Runtime Health, CI-003 autonomous merge и Main Verification.
