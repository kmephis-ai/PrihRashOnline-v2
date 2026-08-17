# RISK-030 — ликвидность и финансовый риск

`RISK-030` вводит `PRH_LIQUIDITY_FINANCIAL_RISK_V1@1.0.0` — чистый deterministic domain layer поверх завершённых `NW-030` и `PROJ-030`. Он рассчитывает два объяснимых индикатора: emergency runway и forward scenario liquidity. Слой не становится новым источником финансовой истины, не изменяет canonical transactions и не получает financial-write, storage, network или deployment authority.

## Источники и границы истины

Текущая ликвидность **не** выводится из Cash Flow. Начальный остаток берётся только из явно выбранных положительных `ACCOUNT`/`ASSET` positions внутри проверенного `PRH_NET_WORTH_RESULT_V1`. Выбор `liquid_position_ids` является отдельной конфигурацией оценки: `null` означает, что классификация ликвидных позиций ещё не задана, а пустой массив означает осознанно подтверждённую нулевую ликвидность. Отрицательный account balance и `LIABILITY` нельзя объявить ликвидным активом.

`PROJ-030` используется только как будущая **дельта** к уже установленной текущей ликвидности. Для каждого forecast month применяется формула `projected_liquidity(t) = projected_liquidity(t-1) + projected_cash_flow_minor(t)`. Это не превращает projection в observation и не разрешает использовать периодный Cash Flow как proxy текущего balance.

`PRH_CASH_FLOW_PROJECTION_RESULT_V1` в текущей upstream версии не содержит currency. Поэтому RISK-030 не имеет права молча угадывать её: input требует `projection_currency` как explicit caller context, sourced from того же normalized projection/query context. `currency`, `projection_currency` и `NW snapshot.currency` обязаны совпасть; FX conversion в v1 запрещён. В provenance это ограничение фиксируется как `EXPLICIT_CALLER_CONTEXT_REQUIRED`.

Period context также bounded: valuation date NW snapshot не может быть позже первого forecast month и не может отстоять от него более чем на 31 день. Более старый или future-dated snapshot даёт `RISK_PERIOD_CONTEXT_MISMATCH`, а не silently смешанный показатель.

## Emergency runway

Runway использует только explicit inputs:

`runway_months_basis_points = floor(current_liquidity_minor * 10000 / essential_monthly_outflow_minor)`.

`10000` basis points = один месяц. Division выполняется через bounded integer arithmetic с conservative floor. `essential_monthly_outflow_minor` — не canonical fact и не FIN-TRUTH; это явный planning input с provenance `DECLARED_PLANNING` или `SYNTHETIC_TEST`. Если он отсутствует, числовой runway не создаётся: состояние `INSUFFICIENT_DATA`, а overall assessment остаётся `PARTIAL` при наличии liquidity selection.

Versioned `HOUSEHOLD_BUFFER_POLICY_V1` использует deterministic product thresholds: меньше 3 месяцев — `CRITICAL`, от 3 до менее 6 — `WARNING`, 6 и более — `OK`. Это техническая policy-классификация продукта, а не персональная инвестиционная/кредитная рекомендация и не изменение financial truth.

## Scenario liquidity risk

Сценарная траектория начинается с explicit selected NW liquidity и последовательно применяет `PROJ-030 projected_cash_flow_minor`. Если running liquidity становится отрицательной, state = `SHORTFALL`, а result сохраняет первый forecast month shortfall. Если shortfall нет и известен essential outflow, minimum projected liquidity переводится в тот же months-basis-points buffer: ниже 3 месяцев — `BUFFER_CRITICAL`, ниже 6 — `BUFFER_WARNING`, иначе `STABLE`.

Если essential outflow неизвестен, но liquidity selection есть, scenario path всё равно может доказать явный `SHORTFALL`; при отсутствии shortfall state = `BURN_RATE_REQUIRED`, чтобы система не выдавала ложный числовой PASS.

## Missing-data и fail-closed semantics

- `liquid_position_ids = null` → `INSUFFICIENT_DATA / LIQUIDITY_SELECTION_REQUIRED`; числовая текущая ликвидность не вычисляется.
- `liquid_position_ids = []` → explicit zero liquidity, а не missing state.
- unknown/duplicate/ineligible position → fail closed до расчёта.
- tampered `NW-030` result отвергается через deterministic recomputation из snapshot.
- если выбранная liquid account position несёт `reconciliation_state=MISMATCH`, итоговый assessment получает `REVIEW_REQUIRED / NET_WORTH_RECONCILIATION_REVIEW_REQUIRED`; downstream слой не скрывает BAL/NW disagreement за зелёным risk state.
- malformed/tampered `PROJ-030` forecast, broken month sequence, arithmetic, uncertainty или provenance → fail closed.
- currency mismatch → fail closed; silent FX отсутствует.
- unsafe integer/ratio overflow → fail closed.

## Evidence и privacy

`PRH_LIQUIDITY_RISK_EVIDENCE_V1` содержит только assessment identity, upstream result identities/hashes и explicit `read_only=true`, `mutation_authority=false`, `financial_payload_embedded=false`. Он предназначен для private-runtime reproducibility и не является public telemetry.

Public-safe `PRH_LIQUIDITY_RISK_TELEMETRY_V1` содержит только schema/version/status/reason, counts и categorical states. В telemetry запрещены currency, amounts, runway numeric values, position IDs, Net Worth identity и projection hashes. Public tests используют исключительно independently generated synthetic finance fixtures.

## FREE_ONLY и rollback

RISK-030 не требует LLM, external API, market-data provider, CDN или paid service. `FREE_ONLY=true`; все authority flags false. Rollback — удалить RISK-030 contract/core/test/doc/gate. `NW-030`, `PROJ-030`, `BAL-030`, canonical financial data и Local-first product runtime при этом не изменяются.

## Machine evidence

Named PR gate `Liquidity & financial risk` выполняет `tests/liquidity_financial_risk_contract_test.js`. Он покрывает stable/warning/critical/shortfall cases, explicit zero vs missing selection, missing burn-rate state, deterministic identity, currency mismatch, tampered upstream results, position eligibility, conservative integer ratio, privacy-safe telemetry и отсутствие platform/write APIs. `DONE_ENGINEERING` допустим только после полного native + ADWF consumer exact-head chain, autonomous merge и Main Verification PASS.
