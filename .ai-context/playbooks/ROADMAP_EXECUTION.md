# AI Playbook — Roadmap execution

<!-- PRH_AI_PLAYBOOK_META_V1
{"playbook_id":"ROADMAP_EXECUTION","version":"1.0.0","language":"ru","mode":"ACTIVE_WRITER","catalog":"PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0","authority_granted_by_playbook":false}
-->

## Когда применять

Используй этот playbook только для команды продолжения разработки по canonical Roadmap. Он сокращает повторяемый процесс, но не выдаёт права: writer authority возникает только из live Roadmap Issue, `AGENTS.md` и действующих machine policies.

## Входы

Нужны `docs/ROADMAP.md`, live GitHub Issues, public-safe `.ai-context/PROJECT_CONTEXT.md` и текущий запрос продолжения. Resolver authority — `PRH_ROADMAP_TASK_V2`; при расхождении human summary с machine evidence побеждают Issue/tests/workflows.

## Порядок

1. Загрузить `AGENTS.md`, Roadmap и live lifecycle.
2. Если уже существует один active writer, продолжить **same Roadmap item** и ту же ветку/PR. Если active writer нет — разрешить dependency-ready item по `priority → wave → order`.
3. Проверить зависимости, goal/non-goals, privacy, `FREE_ONLY`, data/write boundaries и evidence packet.
4. Подтвердить, что существует ровно **один active writer**. Параллельный writer не создавать.
5. Реализовать только scope выбранного item; соседний Roadmap item не поглощать «заодно».
6. Запустить/дождаться обязательных machine gates. `red machine gate` нельзя заменить текстовым объяснением, review или manual marker.
7. При red gate локализовать machine-evidenced причину и исправлять её в **том же item/PR**. Не начинать следующий Roadmap item до Main Verification.
8. После green PR Validation заморозить exact candidate SHA. Любой commit создаёт новый candidate.
9. Следовать trusted chain: PR Validation → Trusted DEV Deploy → Trusted Runtime Health → CI-003 autonomous merge → Main Verification.
10. Считать item DONE только после Main Verification, затем заново запустить resolver.

## Stop conditions

Остановить mutation текущего item и выдать blocker, если обнаружены несколько active writers, незакрытая dependency, policy-gated owner action, необходимость private data в public evidence или unresolved red machine gate. Owner-gated financial/cloud action не подменяется «широкой автономией» AI.

## Выход

Фиксировать `roadmap_id`, Issue, branch, PR, exact candidate SHA, machine evidence, merge SHA и Main Verification. Human-facing summary писать по-русски. Public finance evidence — synthetic only; `FREE_ONLY` обязателен.
