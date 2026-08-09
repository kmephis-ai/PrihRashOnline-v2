# TEST-010 — слоистая архитектура тестов

`roadmap_id: TEST-010`  
`contract: PRH_TEST_ARCHITECTURE_V1@1.0.0`

## Цель

TEST-010 делает test suite явной архитектурной системой, а не набором файлов и substring-проверок. Test classification сама по себе не меняет product/financial semantics и не даёт runtime или financial-write authority.

## Слои

- `PURE_DOMAIN_APPLICATION` — финансовые/domain/application property и invariant contracts. Этот слой не зависит от `SpreadsheetApp`, `UrlFetchApp`, `HtmlService`, browser `window/document`.
- `MIGRATION_RECOVERY` — source/canonical reconciliation, full-history migration, repair/resume/readback/rollback contracts.
- `ADAPTER_INTEGRATION` — repository ports, adapters и mapping integration.
- `RUNTIME_INTEGRATION` — Apps Script/runtime/deploy/backup/restore integration contracts.
- `UI_E2E` — dashboard rendering, responsive и end-to-end UI behavior.
- `POLICY_GOVERNANCE` — security/privacy/FREE_ONLY/docs/AI/Roadmap/CI governance.

Один tracked test обязан классифицироваться ровно в один слой. `unclassified` и ambiguous classification — red gate, а не повод использовать default/fallback layer.

## Deterministic inventory

`lib/testing/test_architecture.js` сканирует `tests/*_test.js`, сортирует пути и применяет versioned patterns из `lib/testing/test_architecture.v1.json`.

Machine invariants:

- inventory deterministic;
- layer IDs уникальны;
- file budgets versioned;
- любой неизвестный test fail-closed;
- одна test path не может получить несколько authority layers;
- public finance data остаётся `SYNTHETIC_ONLY`;
- paid dependency не требуется.

## Pure suite и full suite

`node tools/run-layered-tests.js pure` выполняет только `PURE_DOMAIN_APPLICATION` и перед запуском подтверждает source-level отсутствие platform service tokens.

`node tools/run-layered-tests.js full` выполняет все tracked tests в `PATH_ASC` порядке. Это локальная deterministic агрегация; она **не заменяет** отдельные named PR gates, responsive Playwright, Trusted DEV Deploy, Trusted Runtime Health, CI-003 merge или Main Verification.

## Structured machine contracts вместо brittle substring authority

TEST-010 не запрещает regex вообще. Regex допустим для bounded semantic assertions. Запрещён паттерн, когда lifecycle/gate authority зависит от stale hard-coded имени прошлого writer или случайного форматирования YAML/Markdown.

`lib/testing/structured_contract_parsers.js` вводит:

- `parseProjectStatusEntries()` / `currentRoadmapWriters()` — line-based parsing Roadmap status bullets в `{id,lifecycle}`;
- `branchRoadmapId()` — exact branch convention parsing;
- `parseWorkflowSteps()` / `workflowStepMap()` — indentation-aware parsing named workflow steps и их `run` bodies.

`docs-drift-scan`, `ai-contract-scan` и lifecycle documentation tests должны использовать эти structured helpers для current-writer/workflow gate authority вместо hard-coded `ANL-010`, `MIG-010` или source-wide `- name:` regex.

## Regression budgets

`max_files` ограничивает не производительность приложения, а бесконтрольный рост test authority внутри слоя. Изменение бюджета требует versioned contract change и review, а не автоматического увеличения после red CI.

Runtime-duration telemetry выводится runner'ом как техническое значение. На v1 hard execution time budget не используется как нестабильный CI blocker; hard limit остаётся workflow timeout. Это исключает flaky wall-clock gating на shared runners.

## Privacy / cost / safety

- real или real-derived household finance fixtures запрещены;
- private runtime locators, OAuth, backup payload/keys запрещены;
- `FREE_ONLY` неизменен;
- TEST-010 не выполняет financial mutation;
- MIG-010 owner authorization не переиспользуется;
- red security/privacy/financial/migration gate нельзя отключить ради taxonomy PASS.

## Definition of Done

TEST-010 завершён только когда:

1. taxonomy/inventory/structured-parser behavior contracts PASS;
2. representative stale lifecycle assertions переведены на structured state;
3. pure suite PASS;
4. full existing contract suite + UI gate PASS;
5. secret/privacy/FREE_ONLY/docs/AI/Roadmap gates PASS;
6. exact candidate Trusted DEV Deploy + Trusted Runtime Health PASS;
7. CI-003 autonomous merge PASS;
8. Main Verification закрывает Issue #100 как `DONE`.
