# AIENG-003 — read-only multi-AI review protocol

`protocol_version: 1`  
`packet_schema: PRH_MULTI_AI_REVIEW_PACKET_V1`  
`report_schema: PRH_MULTI_AI_REVIEW_REPORT_V1`

## Цель

Дать primary Roadmap writer независимую проверку exact candidate по четырём областям риска, не создавая дополнительных writers и не превращая мнение модели в release authority.

Канонический порядок/dependencies задаёт repository `docs/ROADMAP.md` (`Executable GitHub Roadmap v2.3`), а live lifecycle конкретного item — GitHub Issue.

## Immutable review packet

Review начинается только с packet schema `PRH_MULTI_AI_REVIEW_PACKET_V1` (`.ai-context/multi-ai-review-packet.schema.json`). Packet содержит:

- `roadmap_id`, Issue и PR;
- exact `candidate_sha`;
- `review_mode: READ_ONLY`;
- `writer_authority: false`;
- четыре обязательные specialist roles;
- public-safe `changed_paths` и `public_evidence_refs`.

Private runtime/credential/owner-path признаки отклоняются fail-closed до review.

## Reviewer report

Каждый reviewer формирует `PRH_MULTI_AI_REVIEW_REPORT_V1` с той же exact candidate identity и ровно одной ролью:

1. `ARCHITECTURE`;
2. `SECURITY_PRIVACY`;
3. `FINANCIAL_DATA`;
4. `TEST_OPERATIONS`.

Один `reviewer_id` не может закрыть две роли. Повтор роли также не считается дополнительным required-role evidence.

Finding ограничен полями `severity`, `code`, `path`, `summary`, `evidence`, `recommendation`, `confidence`, `resolved`. Поле `evidence` содержит только короткий public-safe проверяемый факт/ссылку. Raw model response, runtime body, financial payload и произвольное `rawPayload`-поле schema не допускает.

## Arbitration

- unresolved `P0/P1` → review `BLOCKED`;
- unresolved `P2/P3` → advisory, review может быть `PASS`;
- missing role → `INCOMPLETE`;
- candidate mismatch, duplicate role/reviewer, write authority или private context → fail-closed `BLOCKED`.

Разногласия разрешаются в порядке repository source precedence: policy → canonical spec/Roadmap → executable contracts/tests → ADR/docs. Голосование моделей не меняет финансовую семантику или safety policy.

## Writer boundary

Reviewer никогда не получает GitHub/Apps Script writer authority. Исправление accepted finding выполняет **тот же primary Roadmap writer** на своей ветке, после чего появляется новый exact candidate и review выполняется заново.

Запрещено использовать reviewer как механизм для:

- push/merge/deploy;
- изменения Issue status;
- запроса/использования secrets;
- финансовых mutations;
- обхода красного CI;
- включения платного provider/API.

## Completion authority

Multi-AI review — supplementary evidence. Он не может самостоятельно перевести Roadmap item в `DONE`.

Обычный item остаётся завершённым только после:

`PR Validation -> Trusted DEV Deploy -> Trusted Runtime Health -> CI-003 autonomous squash merge -> Main Verification -> Issue DONE/closed`.

`tools/multi-ai-review-protocol.js` и `tests/multi_ai_review_protocol_contract_test.js` являются deterministic local reference implementation. Required check не зависит от внешнего или платного AI provider и сохраняет `FREE_ONLY`.
