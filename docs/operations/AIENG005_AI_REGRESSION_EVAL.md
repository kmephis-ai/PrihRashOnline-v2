# AIENG-005 — детерминированный AI regression/eval suite

## Назначение

`PRH_AI_EVAL_SUITE_V1@1.0.0` фиксирует небольшой воспроизводимый набор golden-задач для проверки инженерного поведения ИИ в PrihRashOnline-v2. Это не рейтинг моделей и не попытка измерить «интеллект». Цель — обнаруживать регрессии в тех свойствах, которые уже являются обязательными для проекта: discipline по Roadmap scope, выбор machine tests, privacy, синхронизация документации и качество read-only review.

Required CI выполняется полностью локально и детерминированно. Внешняя модель, сеть, OpenAI API или другой отдельно оплачиваемый AI provider для gate не нужны. `FREE_ONLY` остаётся обязательным.

## Что является authority

Eval suite не создаёт новый source of truth. При конфликте действуют существующие источники в порядке `AGENTS.md` / `docs/ROADMAP.md` / live GitHub Issues / exact-SHA code-tests-workflows / versioned contracts. Golden expectation кодирует ожидаемое поведение для regression detection, но не может самостоятельно изменить Roadmap status, финансовую истину, writer authority, merge/deploy policy или migration authorization.

`eval_grants_authority=false`. Все authority flags контракта равны `false`.

## Набор задач

Suite содержит 12 synthetic/public-safe tasks в пяти измерениях:

- `SCOPE_DISCIPLINE` — продолжение единственного active writer, запрет соседнего writer до Main Verification, обход BLOCKED cloud item через другой ready item;
- `TEST_SELECTION` — ожидаемые gates для AI governance/docs и analytics contract changes;
- `PRIVACY` — запрет real/real-derived household evidence, credentials/authenticated payload/private runtime locator в public eval и разрешение independently generated synthetic metadata;
- `DOCS_ROADMAP_SYNC` — lifecycle handoff и обязательная синхронизация versioned contract/test inventory;
- `REVIEW_QUALITY` — `READ_ONLY` review с `severity/evidence/recommendation/confidence` и запрет отменять red machine gate текстовым мнением.

Каждый task содержит scenario и точный нормализованный expected result. В expected result нет финансовых значений, transaction rows, private identifiers или runtime payload.

## Baseline

`tests/fixtures/ai_eval_baseline.v1.json` — versioned baseline для `PRH_AI_EVAL_SUITE_V1@1.0.0`. Он содержит только independently authored synthetic policy results. Поля `external_model_used=false`, `paid_dependency_required=false`, `public_finance_data=SYNTHETIC_ONLY` являются fail-closed boundary.

Baseline должен совпадать с текущими golden expectations после canonical normalization. Missing task, unknown task, изменение ожидаемого action/test/docs/privacy/review результата или попытка потребовать paid dependency дают FAIL.

Когда в будущем меняются AI instructions, routing или добровольно тестируется новая model configuration, её результат сначала приводится внешним harness к тому же узкому result schema. `tools/ai-eval-runner.js --candidate <file>` сравнивает candidate с versioned baseline. Required CI при этом продолжает проверять сам baseline без сетевого model call, поэтому недоступность модели не блокирует обычную разработку.

## Нормализация результата

Допустимы только точные поля:

`task_id`, `action`, `roadmap_id`, `tests`, `docs`, `evidence_class`, `review_mode`, `finding_fields`, `policy_stop`, `paid_dependency_required`.

Set-like arrays (`tests`, `docs`, `finding_fields`) сортируются перед сравнением; duplicate values запрещены. Unknown/extra keys запрещены. `paid_dependency_required` обязан оставаться `false`.

## Machine gate

Named gate `AI regression eval` выполняет:

```text
node tools/ai-eval-runner.js
node tests/ai_eval_suite_contract_test.js
```

Contract test дополнительно доказывает fail-closed поведение на изменённом scope action, неполном test selection, privacy regression, плохом review finding schema, missing/unknown task, paid dependency, extra result field, duplicate set value и unsafe baseline metadata.

Gate относится к `POLICY_GOVERNANCE` в `PRH_TEST_ARCHITECTURE_V1@1.0.0` и входит в полный layered regression inventory.

## Privacy и финансовая безопасность

Production financial data в eval suite запрещены. Public evidence — только synthetic либо public-safe technical metadata. Eval не получает финансовую write authority и не может отменить `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`, исторические migration boundaries или требование fresh exact-bound owner authorization для будущей необратимой финансовой операции.

## Definition of Done AIENG-005

AIENG-005 завершён только когда golden contract, baseline, evaluator, runner, adversarial tests, LANG-RU/TEST-010/PR Validation integration и lifecycle docs находятся на одном exact candidate SHA; затем должны пройти existing privacy/security/FIN/MIG/full layered/UI/PWA gates, Trusted DEV Deploy, Trusted Runtime Health, CI-003 autonomous merge и Main Verification.
