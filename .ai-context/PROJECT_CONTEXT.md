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
- `ARCH-010` Pure domain/application core — current writer, Issue #89.

ARCH-010 candidate:

- `lib/application/application_core.v1.json` — `PRH_APPLICATION_CORE_V1` authority/use-case/dependency contract;
- `lib/application/financial_core.js` — pure canonical validation/KPI/migration use-cases;
- `tests/pure_domain_application_core_contract_test.js` — behavior + static dependency boundary;
- `docs/architecture/PURE_DOMAIN_APPLICATION_CORE.md` — normative architecture boundary.

Pure core не имеет I/O/network/financial-write authority. ARCH-011 repository adapter запускается только после ARCH-010 Main Verification.

## Current delivery

```text
Roadmap Issue IN_PROGRESS
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE/closed
```

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
- Full-history migration не объявлена завершённой.
- New canonical mutation требует отдельный Roadmap contract с idempotency/preconditions/readback/reconciliation/rollback.
- `FREE_ONLY` обязателен; required checks не требуют paid provider.

## FIN-010 financial semantics boundary

KPI Dictionary v1 наследует `FIN-TRUTH-v1`: posted-only, integer minor units, transfer-neutral household KPIs, refund как expense reduction, no implicit floating-point rounding. Current evaluation single-currency; mixed currency fail-closed до versioned FX layer. Partial period задаётся explicit `[start,end)` window без hidden proration.

UI, chart renderer и legacy total cells не являются источником KPI truth.

## DATA-010 canonical data boundary

Canonical Transaction v1 отделяет portable domain fields от Google Sheet layout. Stable `transaction_id` и logical source identity обязательны; `source_position` — mutable locator, не identity. Money остаётся integer `amount_minor` + explicit currency. Account/category/member/project/tags — domain dimensions, а не spreadsheet headers.

Для DATA-001 legacy compatibility используется `CONTENT_FINGERPRINT_V1`, stable при row movement. Изменение imported source fingerprint/record identity после canonical import fail-closed.

## ARCH-010 pure application boundary

`lib/domain/**`, `lib/finance/**`, `lib/migration/**`, `lib/application/**` — pure in-process boundary. Application use-cases принимают plain data и переиспользуют canonical/KPI/migration contracts; они не должны обращаться к `SpreadsheetApp`, Apps Script UI, DOM, storage или network.

`PRH_APPLICATION_CORE_V1` фиксирует `io_authority=false`, `financial_write_authority=false`, `network_authority=false`. Static CI contract блокирует imports из pure core в top-level runtime/UI modules.

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Roadmap Issue
4. `/docs/PROJECT_STATUS.md`
5. `/docs/finance/KPI_DICTIONARY.md`
6. `/docs/data/CANONICAL_TRANSACTION_SCHEMA.md`
7. `/docs/architecture/PURE_DOMAIN_APPLICATION_CORE.md`
8. `/lib/application/application_core.v1.json`
9. `/docs/operations/AIENG002_ROADMAP_TASK_PROTOCOL.md`
10. `/docs/operations/AIENG003_MULTI_AI_REVIEW_PROTOCOL.md`
11. `/docs/architecture.md`
12. `/docs/RELEASE_PROCESS.md`
13. `/docs/data-model.md`
14. exact candidate code/tests/workflows

## Не выводить из контекста

Не считать автоматически завершёнными full-history migration, ARCH-010, ARCH-011, PROD/Yandex cutover, public Web App, paid AI/API, Git history rewrite или Roadmap item без Main Verification. Pure application core не является repository adapter и не имеет write authority.

## Scope handoff

- `AIENG-001` — DONE.
- `AIENG-002` — DONE.
- `AIENG-003` — DONE.
- `FIN-010` — DONE.
- `DATA-010` — DONE.
- `ARCH-010` — current R1 writer.
- `ARCH-011` — dependency-blocked до ARCH-010 DONE.
