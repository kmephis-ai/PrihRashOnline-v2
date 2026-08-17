# XRAY-090 — Financial Health X-Ray: детерминированные правила семейного финансового здоровья

`XRAY-090` вводит `PRH_FINANCIAL_HEALTH_XRAY_V1@1.0.0` — read-only diagnostic domain layer, который преобразует уже доказанные upstream состояния и метрики в объяснимые typed findings. X-Ray не является новым финансовым движком: он не пересчитывает canonical transactions, не меняет `FIN-TRUTH-v1`, не создаёт balance truth и не использует LLM для принятия решения.

## Зачем нужен отдельный слой

Пользователю нужен не набор разрозненных графиков, а понятный ответ: где есть риск, где данных недостаточно и куда перейти для проверки. Но такой ответ нельзя получать свободной интерпретацией AI. Поэтому X-Ray использует versioned registry правил. У каждого правила фиксированы `rule_id`, версия, family, источник, diagnostic policy, missing-data semantics, explanation code и read-only drill target.

Результат X-Ray — диагностическая подсказка продукта. Severity и diagnostic score не являются финансовой истиной, вероятностью дефолта, медицинским/кредитным рейтингом или доказательством причинности.

## Источники

Registry допускает только versioned upstream contracts, которые уже существуют в PrihRash:

- `RISK-030` — emergency runway и scenario liquidity;
- `ANL-090` — contribution/change decomposition;
- `ANL-091` — concentration/distribution/seasonality;
- `BAL-030` — reconciliation quality;
- `SCOPE-070` — analysis-scope identity;
- `TREND-030` — long-term trend context;
- `BUD-020` — budget alert state;
- `SUB-030` — recurring/subscription detection context.

X-Ray принимает normalized signals, а не финансовые строки. Signal хранит только тип диагностического значения, versioned source contract, hash source/evidence/context, provenance kind и read-only drill descriptor. Raw amounts, labels, account/category/member/project IDs и transaction IDs не входят в finding или public telemetry.

## Контекст и fail-closed

Assessment context содержит валюту и hash идентичностей периода/analysis scope. Каждый signal обязан быть exact-bound к тому же `context_hash`. Смешивание другого currency/period/scope context блокируется до rule evaluation.

Signal state может быть `AVAILABLE`, `MISSING`, `INCOMPATIBLE` или `REVIEW_REQUIRED`. Отсутствующий или missing signal создаёт finding `INSUFFICIENT`; incompatible — `INCOMPATIBLE`; upstream review — `REVIEW_REQUIRED`. Никакой из этих случаев не становится `CLEAR`.

Это ключевой принцип X-Ray: **нет доказательства ≠ всё хорошо**.

## Baseline registry v1

Версия `1.0.0` содержит девять deterministic правил:

1. `XRAY_EMERGENCY_RUNWAY` — переиспользует `HOUSEHOLD_BUFFER_POLICY_V1` из RISK-030: `CRITICAL`, `WARNING`, `OK`, `INSUFFICIENT_DATA`.
2. `XRAY_CASH_FLOW_DEFICIT` — переиспользует RISK-030 scenario states: shortfall/buffer risk/stable/missing burn-rate context.
3. `XRAY_SAVINGS_STABILITY` — product diagnostic policy поверх normalized share положительных savings periods в basis points; threshold policy versioned и не меняет upstream amounts.
4. `XRAY_INCOME_DEPENDENCE` — diagnostic threshold поверх `TOP1_BPS` для income concentration из ANL-091.
5. `XRAY_BUDGET_PRESSURE` — отображает `BUDGET_ALERT_V1` states `OVER_BUDGET`, `AT_RISK`, `ON_TRACK` без пересчёта бюджета.
6. `XRAY_RECURRING_COMMITMENTS` — count-only diagnostic policy для normalized recurring commitment count; финансовые суммы не используются.
7. `XRAY_EXPENSE_CONCENTRATION` — diagnostic threshold поверх expense `TOP1_BPS` из ANL-091.
8. `XRAY_CHANGE_CONCENTRATION` — diagnostic threshold для доли доминирующего contribution driver из ANL-090.
9. `XRAY_BALANCE_RECONCILIATION` — `MISMATCH` никогда не маскируется как health PASS и переводит finding в `REVIEW_REQUIRED`.

Numeric policies работают только с bounded integer `BASIS_POINTS`/`COUNT`. Денежной floating-point арифметики в X-Ray нет. Thresholds являются versioned product diagnostics, а не новыми KPI formulas.

## Findings и score

Finding state: `TRIGGERED`, `CLEAR`, `INSUFFICIENT`, `INCOMPATIBLE`, `REVIEW_REQUIRED`.

Severity: `CRITICAL`, `HIGH`, `WARNING`, `INFO`, `NONE`. Для presentation/ranking используется bounded score `100/75/50/25/0`. Он полностью определяется severity и не трактуется как вероятность или финансовая величина. Overall score равен максимальному severity score среди findings, поэтому он не суммирует несопоставимые финансовые показатели.

Finding не хранит исходное numeric/enum значение. Вместо этого сохраняется `diagnostic_value_hash`, source/evidence/context hashes, policy id, reason/explanation code и read-only drill descriptor. Это позволяет воспроизводить происхождение решения, не превращая public evidence в канал утечки финансовых данных.

## Drill-through

Каждое правило имеет bounded default target: `FINANCIAL_RISK`, `ANALYTICS_STUDIO`, `BUDGET_CONTROL`, `SUBSCRIPTIONS` или `BALANCE_RECONCILIATION`. Drill descriptor может нести только hash query/scope/state identity. `financial_payload=false`, `private_ids=false`, `read_only=true` являются обязательными invariant.

UI-интеграция не входит в текущий bounded engineering unit. Domain contract только гарантирует безопасный воспроизводимый descriptor, который будущий product layer сможет связать с реальным Local-first navigation flow и отдельно доказать Product Ready/UAT.

## RISK-030 adapter

Reference adapter `signalsFromLiquidityRisk()` принимает только `PRH_LIQUIDITY_RISK_RESULT_V1@1.0.0` с безопасной provenance: `financial_truth=false`, Cash Flow не является current-balance proxy, FX не выполнялся, canonical mutation/write отсутствуют, evidence read-only и без embedded financial payload.

Adapter создаёт ровно два X-Ray signals — emergency runway и scenario risk — и хэширует source/evidence identity. Он не читает суммы ликвидности и не повторяет формулы RISK-030.

## Приватность и telemetry

Public telemetry допускает только schema/version, counts по finding states/severity, overall severity, rule/family/state/reason и короткие hash prefixes. Запрещены currency-specific amounts, labels, raw source IDs, raw finding IDs, drill payload и финансовые значения.

GitHub tests используют только independently generated synthetic inputs. Private household evidence может существовать только в авторизованном runtime и не должно попадать в repo/artifacts/logs.

## Проверки

`financial_health_xray_contract_test.js` проверяет:

- deterministic registry и ordering;
- triggered/clear/missing/incompatible/review states;
- принцип missing never clear;
- bounded numeric thresholds и hostile enum/input rejection;
- mixed context/source contract fail-closed;
- RISK-030 adapter boundary;
- stable result identity при перестановке signals;
- 64 bounded property iterations;
- read-only evidence/drill;
- отсутствие causal/LLM/financial-write authority;
- public telemetry без financial/private payload.

Canonical PR Validation дополнительно обязан сохранить зелёными RISK-030, ANL-090, ANL-091, BAL-030, SCOPE-070, budget/subscription, FIN/privacy/FREE_ONLY и полный layered suite. `DONE_ENGINEERING` допускается только после trusted exact-head chain, autonomous merge и Main Verification PASS.
