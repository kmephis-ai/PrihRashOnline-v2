# AI Playbook — Migration review

<!-- PRH_AI_PLAYBOOK_META_V1
{"playbook_id":"MIGRATION_REVIEW","version":"1.0.0","language":"ru","mode":"READ_ONLY","catalog":"PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0","authority_granted_by_playbook":false}
-->

## Режим

`READ_ONLY`, `writer_authority=false`. Playbook проверяет migration plan/exact SHA/evidence, но не выполняет write, не создаёт разрешение на необратимое действие и не меняет owner-private data.

## Входы

Нужны migration contract, immutable SHA или deterministic plan, public-safe evidence и только статус owner-private reconciliation/evidence, если он доступен. Реальные строки/агрегаты домохозяйства не копируются в public repository или review output.

## Порядок

1. Закрепить scope и versioned migration contracts.
2. Проверить backup/rollback checkpoint и восстановимость.
3. Проверить provenance, stable identity, duplicate-preservation и deterministic mapping.
4. Проверить idempotency/resume/retry behavior и отсутствие silent row loss/change.
5. Проверить reconciliation: unexplained mismatch не может быть принят как clean completion; для завершённой MIG-010 историческая граница остаётся `unexplainedMismatch=0`.
6. Проверить write boundary. Review не может создать, продлить или переиспользовать старое разрешение. Любое новое необратимое финансовое действие требует **fresh exact-bound owner authorization** для конкретного плана/candidate.
7. Выдать findings в формате `severity/evidence/recommendation/confidence` и отдельно `write_authority_status`.

## Privacy

Public evidence = `synthetic-only public evidence`. Owner-private reconciliation остаётся private. Нельзя публиковать spreadsheet IDs, private runtime locators, source rows, household totals или derived real fixtures.

## Stop conditions

Если предлагается real write без свежей exact-bound owner authorization, `Current write authority = false`. Если reconciliation содержит необъяснённое расхождение, completion запрещён. Если reviewer просят самостоятельно выполнить migration write, playbook остаётся READ_ONLY и возвращает blocker.

## Authority

Migration review не переопределяет FIN-TRUTH, MIG contracts, backup policy или live owner authorization. Historical authorization не является reusable capability для следующей операции.
