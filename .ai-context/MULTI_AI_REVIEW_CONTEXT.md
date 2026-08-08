# AIENG-003 — public-safe контекст независимого review

Этот файл определяет только входной контекст reviewer'а. Он не является памятью пользователя и не должен содержать приватные financial/runtime/credential/backup данные.

## Назначение

Независимый reviewer получает один immutable candidate и работает строго `READ_ONLY`. Review дополняет deterministic CI, но не заменяет его и не создаёт второй источник истины.

Обязательные роли:

- `ARCHITECTURE` — границы слоёв, coupling, архитектурные инварианты;
- `SECURITY_PRIVACY` — privacy, secrets, trust boundaries, `FREE_ONLY`;
- `FINANCIAL_DATA` — финансовая семантика, schema/migration/reconciliation риски;
- `TEST_OPERATIONS` — тестируемость, failure modes, observability, rollback/runbook.

## Разрешённый вход

- Roadmap ID, Issue/PR number;
- exact 40-char candidate SHA;
- public diff/changed paths;
- public-safe contract/test/workflow/docs evidence;
- synthetic-only fixtures и результаты.

## Запрещённый вход

- реальные или real-derived финансовые данные/агрегаты/screenshots;
- private runtime URL/deployment identifiers;
- OAuth/refresh tokens/client secrets/private keys;
- backup bytes/keys/decrypted data;
- owner-private local paths.

## Полномочия и finding contract

Reviewer не имеет права создавать/изменять branch, Issue, PR, merge/deploy, secrets или финансовые записи. Единственный writer — primary Roadmap writer.

Finding имеет bounded поля `severity/code/path/summary/evidence/recommendation/confidence/resolved`. `evidence` — короткая public-safe ссылка/описание проверяемого факта; raw model response, financial payload или private runtime body не допускаются.

Unresolved `P0/P1` блокирует review evidence; `P2/P3` advisory. Конфликт reviewer'ов разрешается executable contracts/tests/spec/ADR, а не голосованием моделей.

Даже `PASS` всех reviewers не означает `DONE`: authoritative completion остаётся `PR Validation -> Trusted DEV Deploy -> Trusted Runtime Health -> CI-003 autonomous squash merge -> Main Verification`.
