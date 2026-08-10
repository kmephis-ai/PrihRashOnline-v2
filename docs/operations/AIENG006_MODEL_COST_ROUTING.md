# AIENG-006 — маршрутизация AI-нагрузок и стоимости

## Назначение

`PRH_AI_MODEL_COST_ROUTING_V1@1.0.0` отделяет три разные вещи, которые нельзя смешивать в одном gate:

1. локальные детерминированные machine checks;
2. интерактивную AI-помощь в доступной пользователю ChatGPT subscription surface;
3. отдельно тарифицируемый OpenAI API.

Главный принцип: **ни один required machine gate не зависит от модели, ChatGPT capacity или API billing**. Если AI-assisted engineering временно недоступен, required работа корректно приостанавливается, а уже определённые machine gates не обходятся и не заменяются ручным marker.

## Внутренние lanes Sol / Terra / Luna

`SOL`, `TERRA`, `LUNA` — внутренние project workload lanes. Они не являются vendor model IDs и не утверждают наличие конкретной модели в пользовательском аккаунте.

- `SOL` — сбалансированная повседневная инженерная работа;
- `TERRA` — глубокое reasoning, архитектура, security/migration review;
- `LUNA` — лёгкие drafting/classification/repetitive review задачи.

Фактическая доступность конкретной модели/режима в ChatGPT считается **current account runtime truth**. Policy принимает только capability states `AVAILABLE | EXHAUSTED | UNAVAILABLE | UNKNOWN`; она не хранит вечный список entitlement/лимитов.

## Execution surfaces

### LOCAL_DETERMINISTIC

Единственный surface для `MACHINE_GATE`. Он не требует AI model и не имеет model billing. Сюда относятся contract tests, privacy/secret/FREE_ONLY scans, financial reconciliation, migration checks, browser tests, immutable candidate verification и другие deterministic required checks.

### CHATGPT_SUBSCRIPTION

Интерактивная AI-assisted инженерная поверхность. Она может использовать внутренние lanes и fallback order, но не получает machine authority. Отсутствие capacity не превращает AI-ответ в surrogate для red/непройденного CI.

### OPENAI_API

Считается отдельно тарифицируемой API-поверхностью. В AIENG-006:

- `enabled=false`;
- automatic billing enablement запрещён;
- required machine gates запрещены;
- required engineering не маршрутизируется в API;
- paid API не является required dependency проекта.

## Текущая внешняя billing/model boundary

Официальные материалы OpenAI были повторно проверены 2026-08-10. Для policy используется только стабильная граница: ChatGPT subscription и OpenAI API имеют отдельные billing surfaces, API usage не включается автоматически в ChatGPT Plus, а фактическая model availability/usage limits может зависеть от текущего плана/аккаунта и меняться. Поэтому проект не hard-code'ит текущий model picker как постоянный entitlement.

Source scope: official OpenAI Help Center по ChatGPT Plus/billing и official OpenAI API Pricing. Эти источники фиксируют внешнюю billing boundary, но не являются authority для внутреннего выбора Sol/Terra/Luna.

## Routing rules

### Required machine work

`MACHINE_GATE -> RUN_LOCAL_DETERMINISTIC` при любом состоянии Sol/Terra/Luna. Модельная exhaustion не влияет на machine correctness.

### Required AI-assisted engineering

Пример `STANDARD_ENGINEERING`:

`SOL -> TERRA -> LUNA`.

Первый `AVAILABLE` lane выбирается детерминированно. `UNKNOWN` не считается доступным. Если ни один разрешённый lane не доступен, результат = `PAUSE_REQUIRED_WORK`. API fallback не выполняется.

Для `DEEP_REVIEW` fallback намеренно уже: `TERRA -> SOL`; лёгкий lane не используется как автоматическая замена глубокого review.

### Optional AI work

Optional workload может пройти по своему fallback order. При отсутствии capacity возвращается `DEFER_OPTIONAL`; это не failure required delivery и не причина включать paid API.

## Reason codes

- `AI_ROUTE_MACHINE_GATE_LOCAL_ONLY`;
- `AI_ROUTE_SUBSCRIPTION_AVAILABLE`;
- `AI_ROUTE_FALLBACK_USED`;
- `AI_ROUTE_REQUIRED_CAPACITY_EXHAUSTED`;
- `AI_ROUTE_OPTIONAL_DEFERRED`;
- `AI_ROUTE_API_SEPARATE_BILLING_DISABLED`.

Все решения сохраняют `machine_gate_bypass=false`, `api_used=false` для policy v1.

## Privacy-safe telemetry

Public telemetry содержит только allowlisted metadata:

- schema/version;
- workload class;
- required flag;
- route/lane;
- capability state;
- reason code;
- fallback count.

Запрещены prompt/response, real financial payload, account identifiers, API keys, access/refresh tokens и billing tokens.

## FREE_ONLY

`FREE_ONLY` здесь означает: отдельно тарифицируемый API/service не становится обязательной зависимостью required engineering или CI. Уже выбранная пользователем интерактивная subscription surface может использоваться для AI-assisted работы в пределах её текущей доступности, но exhaustion не разрешает автоматическую покупку/API overage.

## Machine evidence

- `lib/ai/model_cost_routing.v1.json`;
- `lib/ai/model_cost_routing.js`;
- `tests/ai_model_cost_routing_contract_test.js`;
- named `AI model/cost routing` PR gate;
- TEST-010 classification;
- `Language policy`/docs/privacy/FREE_ONLY/full layered regression.

## Rollback

Откатить AIENG-006 contract/core/tests/docs/gates. Локальные deterministic machine gates, текущий Apps Script runtime и financial authorities при этом не меняются.
