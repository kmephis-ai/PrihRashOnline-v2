# AI Playbook — Documentation drift

<!-- PRH_AI_PLAYBOOK_META_V1
{"playbook_id":"DOCS_DRIFT","version":"1.0.0","language":"ru","mode":"VALIDATE_OR_REPAIR_ACTIVE_WRITER","catalog":"PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0","authority_granted_by_playbook":false}
-->

## Назначение

Playbook проверяет, что human docs, AI context и GitHub lifecycle не расходятся с authoritative Roadmap/Issues/exact-SHA machine evidence. Сам playbook не выдаёт write authority: repair допустим только в уже существующем active writer scope.

## Порядок

1. Запустить `node tools/docs-drift-scan.js`.
2. Запустить `node tools/language-policy-scan.js` и language contract.
3. Запустить `node tools/ai-contract-scan.js`.
4. Сверить `docs/PROJECT_STATUS.md`, `.ai-context/PROJECT_CONTEXT.md`, live Issue и PR exact head.
5. Если режим read-only — выдать drift findings без mutation.
6. Если существует один active writer и drift входит в его scope — исправить только соответствующие docs/context в той же ветке.
7. Повторить scanners и считать repair завершённым только при machine PASS.

## Source precedence

Human documentation не сильнее `machine evidence`. Roadmap execution status определяется live Issue + exact-SHA tests/workflows/Main Verification, а не формулировкой README/status. `LANG-RU` обязателен для normative human-facing текста.

## Stop conditions

Не ремонтировать docs, если отсутствует active writer authority, если изменение требует нового Roadmap scope, если в public docs попали private financial/runtime данные или scanner остаётся red после локализованного исправления.

## Границы

Docs-drift repair не меняет FIN-TRUTH, migration authority, release chain, Roadmap order или backend write policy. Он устраняет только documentation/context drift в разрешённом active scope. `FREE_ONLY` обязателен.
