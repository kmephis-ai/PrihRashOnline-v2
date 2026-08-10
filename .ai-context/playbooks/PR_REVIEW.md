# AI Playbook — Read-only PR review

<!-- PRH_AI_PLAYBOOK_META_V1
{"playbook_id":"PR_REVIEW","version":"1.0.0","language":"ru","mode":"READ_ONLY","catalog":"PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0","authority_granted_by_playbook":false}
-->

## Режим

`READ_ONLY`, `writer_authority=false`. Этот playbook предназначен для независимого review exact SHA/diff и никогда не создаёт commit, branch, Issue, PR, merge, deployment или lifecycle transition.

## Входы

Нужны immutable candidate SHA, diff/patch, public-safe AI context и явно заданный review scope. Если SHA изменился во время review, вывод относится только к старому SHA и не переносится автоматически на новый candidate.

## Порядок

1. Закрепить immutable SHA и проверить, что diff относится именно к нему.
2. Загрузить public-safe context и authoritative contracts, относящиеся к scope.
3. Проверить архитектурную согласованность и отсутствие нового скрытого source of truth.
4. Проверить security/privacy/`FREE_ONLY`, public synthetic evidence и authority boundaries.
5. Проверить tests/CI/docs/lifecycle drift только как reviewer: ничего не исправлять самостоятельно.
6. Сопоставить выводы с machine evidence. `red machine gate` имеет больший вес, чем мнение reviewer.
7. Выдать только actionable findings.

## Формат findings

Каждое замечание содержит `severity`, `evidence`, `recommendation`, `confidence`. Evidence должен указывать конкретный файл/строку/check/behavior; предположение явно помечается как предположение.

## Stop conditions

Если для вывода требуется private household payload, недоступный exact SHA или mutation repository state, остановить соответствующую часть review и зафиксировать недостаток evidence. Нельзя просить real financial values для public proof.

## Конфликты

Review не голосует против tests/spec/ADR. При конфликте нескольких AI решающими остаются authoritative contract, machine tests и Issue scope. Reviewer не меняет active writer и не берёт следующий Roadmap item.
