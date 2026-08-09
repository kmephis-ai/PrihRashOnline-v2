# PrihRashOnline-v2 — public-safe AI context

Этот контекст безопасен для public repository и не содержит real financial data, private runtime locator, OAuth/backup material или owner-private paths.

## Что это за проект

Household-finance application: текущий runtime — private Google Sheets + Google Apps Script + private Web Dashboard; GitHub — engineering control plane. Цель — maintainable modular monolith с pure financial/domain rules и repository adapters.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **каноническая Executable GitHub Roadmap v2.3** для порядка работ/dependencies.
3. GitHub Issues — live lifecycle/status конкретного Roadmap item.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Architecture/ADR/operations docs.

Chat history/memory и старые Library-копии Roadmap не являются authority. Если task явно предоставляет `Master Audit v2.1` или `AI Development Playbook v1.0`, применяйте их по precedence из `AGENTS.md`.

## Current R0 truth

R0 machine-proven complete: TEST/SEC/FIN/DATA truth, reproducible supply chain, exact-SHA autonomous delivery, encrypted restore, privacy-safe observability, `FREE_ONLY`, documentation truth, AIENG-001 repository contract, AIENG-002 executable Roadmap protocol и AIENG-003 read-only multi-AI review прошли собственные Main Verification gates.

`MASTER-G0`, `MASTER-G1` и `MASTER-G2` закрыты. R1 / Canonical Financial Platform — текущая wave.

## Current R1 truth

- `FIN-010` KPI Dictionary v1 — DONE, Issue #85 Main Verification PASS.
- `DATA-010` Canonical Transaction v1 — DONE, Issue #87 Main Verification PASS.
- `ARCH-010` Pure domain/application core — DONE, Issue #89 Main Verification PASS.
- `ARCH-011` Transaction Repository Port + Google Sheets adapter — DONE, Issue #91 Main Verification PASS.
- `MIG-010` deterministic full-history migration — current P0 writer, Issue #96, draft PR #97.

ARCH-011 established `PRH_TRANSACTION_REPOSITORY_V1`: storage-neutral read/query/write-interface contract. Current Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`; adapter existence is not financial-write authority.

MIG-010 current candidate:

- `lib/migration/full_history_migration.v1.json` — `PRH_FULL_HISTORY_MIGRATION_V1` policy;
- `lib/migration/full_history_migration.js` — deterministic dry-run, <=100 batches, HMAC resume, target revision precondition, DR backup binding, irreversible-action authorization check, private reconciliation;
- `tests/full_history_migration_contract_test.js` — interruption/resume/idempotency synthetic drill;
- `tools/mig010-owner.js` — owner-local encrypted-backup snapshot/dry-run/state CLI;
- `tests/mig010_owner_tool_contract_test.js` — private-path/outside-repo, encrypted-backup binding, stdout privacy and write-disabled contracts;
- `docs/operations/MIG010_FULL_HISTORY_MIGRATION.md` — owner-private runbook.

Public CI uses independently generated synthetic data. Private mapper/snapshot/state/resume secret/backup remain outside repository. `execute/write/apply` in owner tool intentionally fail closed until an explicit irreversible-action stage is approved.

## Current delivery

```text
Roadmap Issue IN_PROGRESS
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health + Web App render smoke v2
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE/closed
```

После INC-001 Dashboard render не использует `HtmlTemplate.evaluate()` для `DashboardWebApp`; raw `HtmlOutput` placeholder injection проверяется privacy-safe authenticated Web render smoke v2. Это обязательная часть runtime health, а не ручной deployment marker.

## Executable continuation protocol

- `docs/operations/AIENG002_ROADMAP_TASK_PROTOCOL.md`;
- `.ai-context/roadmap-task-packet.schema.json`;
- `tools/roadmap-task-protocol.js`.

Resolver продолжает единственный `IN_PROGRESS` writer или выбирает один highest-priority dependency-ready `READY` item. Multiple writers/missing dependencies/private context fail closed.

## Read-only multi-AI review

- `.ai-context/MULTI_AI_REVIEW_CONTEXT.md`;
- `.ai-context/multi-ai-review-packet.schema.json`;
- `.ai-context/multi-ai-review-report.schema.json`;
- `tools/multi-ai-review-protocol.js`;
- `docs/operations/AIENG003_MULTI_AI_REVIEW_PROTOCOL.md`.

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers получают только public-safe exact-candidate context, остаются `READ_ONLY`, `writer_authority: false`. Unresolved P0/P1 блокирует review; P2/P3 advisory. Конфликт разрешают policy/spec/tests/ADR, а не model voting. Review не отменяет machine gates и не может отметить Issue DONE.

## Privacy / financial / cost boundaries

- Public finance data — independently generated synthetic only.
- Real or real-derived household finance data/aggregates/screenshots/exports stay private.
- Private deployment identifiers, authenticated responses, OAuth, backups/keys stay private.
- Full-history migration **не объявлена завершённой**.
- MIG-010 merge/code readiness не разрешает real write.
- New canonical mutation требует idempotency/preconditions/readback/reconciliation/rollback и отдельный irreversible-action authorization.
- `FREE_ONLY` обязателен; required checks не требуют paid provider.

## FIN-010 financial semantics boundary

KPI Dictionary v1 наследует `FIN-TRUTH-v1`: posted-only, integer minor units, transfer-neutral household KPIs, refund как expense reduction, no implicit floating-point rounding. Current evaluation single-currency; mixed currency fail-closed до versioned FX layer. Partial period задаётся explicit `[start,end)` window без hidden proration.

UI, chart renderer и legacy total cells не являются источником KPI truth.

## DATA-010 canonical data boundary

Canonical Transaction v1 отделяет portable domain fields от Google Sheet layout. Stable `transaction_id` и logical source identity обязательны; `source_position` — mutable locator, не identity. Money остаётся integer `amount_minor` + explicit currency.

Для DATA-001 legacy compatibility используется `CONTENT_FINGERPRINT_V1`, stable при row movement. Изменение imported source fingerprint/record identity после canonical import fail-closed.

## ARCH-010 / ARCH-011 boundaries

`lib/domain/**`, `lib/finance/**`, `lib/migration/**`, `lib/application/**` — pure in-process boundary без `SpreadsheetApp`, DOM/storage/network authority. `PRH_APPLICATION_CORE_V1` фиксирует `io_authority=false`, `financial_write_authority=false`, `network_authority=false`.

`PRH_TRANSACTION_REPOSITORY_V1` находится снаружи pure semantics. Fake repository даёт synthetic-only optimistic/idempotent write contract для tests. Google adapter read/query работает через versioned mapping; Google row остаётся mutable `source_position`. Real canonical mutation в current Google adapter блокируется.

## MIG-010 irreversible boundary

State machine: `CODE_READY -> OWNER_PRIVATE_SNAPSHOT -> OWNER_DRY_RUN -> AUTHORIZATION_REQUIRED -> BATCHING -> PRIVATE_RECONCILIATION -> OWNER_VERIFIED`.

До `AUTHORIZATION_REQUIRED` никакие реальные financial writes не выполняются. GitHub Actions, merge PR и AI-agent не могут автоматически создать `IRREVERSIBLE_ACTION_AUTHORIZED`. Перед будущим first write нужны exact plan hash, свежий DR-001 backup evidence и migration-specific write adapter/readback/rollback semantics.

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Roadmap Issue
4. `/docs/PROJECT_STATUS.md`
5. `/docs/operations/MIG010_FULL_HISTORY_MIGRATION.md`
6. `/lib/migration/full_history_migration.v1.json`
7. `/docs/architecture/TRANSACTION_REPOSITORY_PORT.md`
8. `/lib/repository/transaction_repository.v1.json`
9. `/docs/finance/KPI_DICTIONARY.md`
10. `/docs/data/CANONICAL_TRANSACTION_SCHEMA.md`
11. `/docs/architecture/PURE_DOMAIN_APPLICATION_CORE.md`
12. `/docs/operations/AIENG002_ROADMAP_TASK_PROTOCOL.md`
13. `/docs/operations/AIENG003_MULTI_AI_REVIEW_PROTOCOL.md`
14. `/docs/architecture.md`
15. `/docs/RELEASE_PROCESS.md`
16. `/docs/data-model.md`
17. exact candidate code/tests/workflows

## Не выводить из контекста

Не считать автоматически завершёнными full-history migration, MIG-010, PROD/Yandex cutover, public Web App, paid AI/API, Git history rewrite или Roadmap item без Main Verification и требуемого private evidence. Repository/migration protocol existence не является financial-write authority.

## Scope handoff

- `AIENG-001` — DONE.
- `AIENG-002` — DONE.
- `AIENG-003` — DONE.
- `FIN-010` — DONE.
- `DATA-010` — DONE.
- `ARCH-010` — DONE.
- `ARCH-011` — DONE.
- `MIG-010` — current R1 P0 writer.
- `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010` — dependency/priority-gated после current writer.
